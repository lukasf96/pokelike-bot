import type { Page } from "puppeteer";

import { enemyTypingsForIntel, type NodeIntel } from "../intel/battle-intel.js";
import { logAction } from "../logging/logger.js";
import {
  heldItemFitnessAtSlot,
  optimalHeldItemPermutation,
  type HeldItemFitnessCtx,
} from "../intel/item-intel.js";
import type { HandlerCtx } from "../state/handler.js";
import { selectItemTeam } from "../state/selectors.js";
import type { GameSnapshot, Tick } from "../state/types.js";
import { sleep } from "../utility/page-utils.js";

/** Build the next-boss item context from the current game snapshot. */
function bossItemCtx(game: GameSnapshot, tick?: Tick): HeldItemFitnessCtx {
  const intel: NodeIntel =
    game.currentMap >= 8
      ? { category: "elite", eliteIndex: game.eliteIndex }
      : { category: "gym", mapIndex: game.currentMap };
  const typings = enemyTypingsForIntel(intel, {
    currentMap: game.currentMap,
    eliteIndex: game.eliteIndex,
  });
  // bossImminent when the map offers the gym/elite node on this layer.
  // We use this to veto `lucky_egg` placement pre-boss (see item-intel).
  const candidates = tick?.ui.map?.candidates ?? [];
  const bossImminent = candidates.some((c) => c.surfaceKind === "gym" || c.surfaceKind === "elite");
  const ctx: HeldItemFitnessCtx = {};
  if (typings.length > 0) ctx.nextBossTypings = typings;
  if (bossImminent) ctx.bossImminent = true;
  return ctx;
}

/** Click `#item-bar` badge at `bagBadgeIdx` (same order as `state.items`), then Equip/Swap onto `slotIdx`. */
async function equipBagHeldItemOntoSlot(
  page: Page,
  bagBadgeIdx: number,
  slotIdx: number,
): Promise<boolean> {
  const clicked = await page.evaluate((badgeIdx: number): boolean => {
    const bar = document.getElementById("item-bar");
    const badges = bar?.querySelectorAll(".item-badge");
    const el = badges?.[badgeIdx];
    if (!el) return false;
    (el as HTMLElement).click();
    return true;
  }, bagBadgeIdx);

  if (!clicked) return false;
  await sleep(450);

  const equipped = await page.evaluate((slot: number): boolean => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return false;
    const btn = modal.querySelector<HTMLButtonElement>(`button[data-idx="${slot}"]`);
    if (!btn || btn.classList.contains("equip-btn-unequip")) return false;
    btn.click();
    return true;
  }, slotIdx);

  await sleep(520);
  return equipped;
}

/**
 * Click held item on team slot `teamIdxSource`, then Swap onto `teamIdxTarget`
 * (game `openItemEquipModal` + row button — exchanges both held items).
 */
async function performOneHeldSwap(
  page: Page,
  teamIdxSource: number,
  teamIdxTarget: number,
): Promise<boolean> {
  const opened = await page.evaluate((i: number): boolean => {
    const slots = document.querySelectorAll("#team-bar .team-slot");
    const itemEl = slots[i]?.querySelector<HTMLElement>(".team-slot-item");
    if (!itemEl) return false;
    itemEl.click();
    return true;
  }, teamIdxSource);

  if (!opened) return false;
  await sleep(450);

  const swapped = await page.evaluate((j: number): boolean => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return false;
    const btn = modal.querySelector<HTMLButtonElement>(`button[data-idx="${j}"]`);
    if (!btn || btn.classList.contains("equip-btn-unequip")) return false;
    btn.click();
    return true;
  }, teamIdxTarget);

  await sleep(520);
  return swapped;
}

/**
 * After completing a map node we're back on the map: reshuffle held items among holders
 * when total `heldItemFitnessAtSlot` improves (see pokelike `openItemEquipModal` swap flow).
 */
export async function maybeOptimizeHeldItemSwaps(
  initialTick: Tick,
  ctx: HandlerCtx,
): Promise<void> {
  if (!initialTick.game) return;
  const team = selectItemTeam(initialTick.game);
  const bossCtx = bossItemCtx(initialTick.game, initialTick);
  const opt = optimalHeldItemPermutation(team, bossCtx);
  if (!opt) return;

  const { slots, itemIds, bestPerm, before, after, gain } = opt;

  /** Goal item id at holder position `pos` (index into `slots` / `itemIds`). */
  const goal = bestPerm.map((srcIdx) => itemIds[srcIdx]!);
  const cur = [...itemIds];

  let steps = 0;
  const maxSteps = 14;

  while (cur.some((c, i) => c !== goal[i]) && steps < maxSteps) {
    const t = cur.findIndex((c, i) => c !== goal[i]);
    if (t < 0) break;
    const need = goal[t]!;
    const u = cur.findIndex((c, ti) => ti !== t && c === need);
    if (u < 0) break;

    const ok = await performOneHeldSwap(ctx.page, slots[t]!, slots[u]!);
    if (!ok) {
      logAction("held-swaps", `Aborted (UI) after ${steps} swap(s)`);
      return;
    }

    [cur[t], cur[u]] = [cur[u]!, cur[t]!];
    steps += 1;
  }

  if (steps > 0) {
    logAction(
      "held-swaps",
      `Fitness ${before.toFixed(0)} → ${after.toFixed(0)} (+${gain.toFixed(0)}, ${steps} swap(s))`,
    );
  }
}

/**
 * Minimum strict fitness improvement required to swap the item already on a
 * holder for one in the bag. The previously-equipped item goes back to the
 * bag, so a delta of 0 (ties) ping-pongs forever between two near-equivalent
 * items. 6 mirrors `MIN_HELD_PERM_IMPROVE` in item-intel.
 */
const MIN_BAG_REPLACE_IMPROVE = 6;

/**
 * Pull equipable held items out of the bag (`state.items`, non-`usable`): fill empty hands first,
 * then replace only when `heldItemFitnessAtSlot` improves by at least `MIN_BAG_REPLACE_IMPROVE`.
 */
export async function maybeEquipBagHeldItems(initialTick: Tick, ctx: HandlerCtx): Promise<void> {
  let moves = 0;
  const maxIter = 28;
  let tick: Tick = initialTick;
  // Replacing a held item returns the displaced item back to the bag. If the
  // scoring is symmetric (e.g. two mons that both want `eviolite`), without
  // a guard we can equip A→slotN, then B→slotN (displacing A), then
  // A→slotN again, forever. Track the (sourceItemId, slot) pairs we've
  // already equipped *this call* and refuse to repeat them.
  const equippedItemsBySlot = new Map<number, Set<string>>();

  for (let iter = 0; iter < maxIter; iter += 1) {
    if (!tick.game) break;
    const team = selectItemTeam(tick.game);
    const bag = tick.game.bag;
    const equipCandidates = bag.filter((b) => !b.usable && b.id);
    if (equipCandidates.length === 0) break;
    const bossCtx = bossItemCtx(tick.game, tick);

    const emptySlots: number[] = [];
    for (let i = 0; i < team.length; i += 1) {
      if (!team[i]?.heldItem) emptySlots.push(i);
    }

    let bagIdx = -1;
    let slotIdx = -1;
    let chosenItemId: string | undefined;

    const wasAlreadyEquipped = (slot: number, id: string): boolean =>
      equippedItemsBySlot.get(slot)?.has(id) === true;

    if (emptySlots.length > 0) {
      let bestFit = -Infinity;
      for (const b of equipCandidates) {
        for (const s of emptySlots) {
          if (wasAlreadyEquipped(s, b.id)) continue;
          const fit = heldItemFitnessAtSlot(b.id, s, team, bossCtx);
          if (fit > bestFit) {
            bestFit = fit;
            bagIdx = b.idx;
            slotIdx = s;
            chosenItemId = b.id;
          }
        }
      }
    } else {
      let bestDelta = -Infinity;
      for (const b of equipCandidates) {
        for (let s = 0; s < team.length; s += 1) {
          const curId = team[s]?.heldItem?.id;
          if (!curId) continue;
          if (wasAlreadyEquipped(s, b.id)) continue;
          const newFit = heldItemFitnessAtSlot(b.id, s, team, bossCtx);
          const oldFit = heldItemFitnessAtSlot(curId, s, team, bossCtx);
          const delta = newFit - oldFit;
          // Strict improvement only; ties cause ping-pong because the
          // displaced item returns to the bag and could re-equip next iter.
          if (delta < MIN_BAG_REPLACE_IMPROVE) continue;
          if (delta > bestDelta) {
            bestDelta = delta;
            bagIdx = b.idx;
            slotIdx = s;
            chosenItemId = b.id;
          }
        }
      }
      if (bagIdx < 0 || bestDelta < MIN_BAG_REPLACE_IMPROVE) break;
    }

    if (bagIdx < 0 || slotIdx < 0 || !chosenItemId) break;

    const ok = await equipBagHeldItemOntoSlot(ctx.page, bagIdx, slotIdx);
    if (!ok) {
      logAction("held-bag", `UI failed (bag idx ${bagIdx} → slot ${slotIdx})`);
      break;
    }
    moves += 1;
    let slotSet = equippedItemsBySlot.get(slotIdx);
    if (!slotSet) {
      slotSet = new Set<string>();
      equippedItemsBySlot.set(slotIdx, slotSet);
    }
    slotSet.add(chosenItemId);
    tick = await ctx.reobserve();
  }

  if (moves > 0) {
    logAction("held-bag", `Equipped ${moves} held item(s) from bag`);
  }
}
