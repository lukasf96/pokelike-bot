import type { Page } from "puppeteer";

import {
  heldItemFitnessAtSlot,
  optimalHeldItemPermutation,
  type TeamMemberForItem,
} from "../item-intel.js";
import { sleep } from "../page-utils.js";

interface BagEntrySnapshot {
  idx: number;
  id: string;
  usable: boolean;
}

async function readTeamBagSnapshot(page: Page): Promise<{ team: TeamMemberForItem[]; bag: BagEntrySnapshot[] }> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const team = (st?.team ?? []).map((p: Record<string, unknown>) => ({
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      baseStats: p.baseStats as TeamMemberForItem["baseStats"],
      level: Number(p.level ?? 1),
      speciesId: Number(p.speciesId ?? 0),
      currentHp: typeof p.currentHp === "number" ? p.currentHp : undefined,
      maxHp: typeof p.maxHp === "number" ? p.maxHp : undefined,
      heldItem: p.heldItem as TeamMemberForItem["heldItem"],
    }));
    const bag: BagEntrySnapshot[] = (st?.items ?? []).map((it: Record<string, unknown>, idx: number) => ({
      idx,
      id: String(it.id ?? ""),
      usable: !!it.usable,
    }));
    return { team, bag };
  });
}

async function readTeamForItems(page: Page): Promise<TeamMemberForItem[]> {
  const s = await readTeamBagSnapshot(page);
  return s.team;
}

/** Click `#item-bar` badge at `bagBadgeIdx` (same order as `state.items`), then Equip/Swap onto `slotIdx`. */
async function equipBagHeldItemOntoSlot(page: Page, bagBadgeIdx: number, slotIdx: number): Promise<boolean> {
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
async function performOneHeldSwap(page: Page, teamIdxSource: number, teamIdxTarget: number): Promise<boolean> {
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
export async function maybeOptimizeHeldItemSwaps(page: Page): Promise<void> {
  const team = await readTeamForItems(page);
  const opt = optimalHeldItemPermutation(team);
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

    const ok = await performOneHeldSwap(page, slots[t]!, slots[u]!);
    if (!ok) {
      console.log(`  [held-swaps] aborted (UI) after ${steps} swap(s)`);
      return;
    }

    [cur[t], cur[u]] = [cur[u]!, cur[t]!];
    steps += 1;
  }

  if (steps > 0) {
    console.log(`  [held-swaps] fitness ${before.toFixed(0)} → ${after.toFixed(0)} (+${gain.toFixed(0)}, ${steps} swap(s))`);
  }
}

/**
 * Pull equipable held items out of the bag (`state.items`, non-`usable`): fill empty hands first,
 * then replace only when `heldItemFitnessAtSlot` does not drop (same rule as non-negative swaps).
 */
export async function maybeEquipBagHeldItems(page: Page): Promise<void> {
  let moves = 0;
  const maxIter = 28;

  for (let iter = 0; iter < maxIter; iter += 1) {
    const { team, bag } = await readTeamBagSnapshot(page);
    const equipCandidates = bag.filter((b) => !b.usable && b.id);
    if (equipCandidates.length === 0) break;

    const emptySlots: number[] = [];
    for (let i = 0; i < team.length; i += 1) {
      if (!team[i]?.heldItem) emptySlots.push(i);
    }

    let bagIdx = -1;
    let slotIdx = -1;

    if (emptySlots.length > 0) {
      let bestFit = -Infinity;
      for (const b of equipCandidates) {
        for (const s of emptySlots) {
          const fit = heldItemFitnessAtSlot(b.id, s, team);
          if (fit > bestFit) {
            bestFit = fit;
            bagIdx = b.idx;
            slotIdx = s;
          }
        }
      }
    } else {
      let bestDelta = -Infinity;
      for (const b of equipCandidates) {
        for (let s = 0; s < team.length; s += 1) {
          const curId = team[s]?.heldItem?.id;
          if (!curId) continue;
          const newFit = heldItemFitnessAtSlot(b.id, s, team);
          const oldFit = heldItemFitnessAtSlot(curId, s, team);
          const delta = newFit - oldFit;
          if (delta < 0) continue;
          if (delta > bestDelta) {
            bestDelta = delta;
            bagIdx = b.idx;
            slotIdx = s;
          }
        }
      }
      if (bagIdx < 0 || bestDelta < 0) break;
    }

    if (bagIdx < 0 || slotIdx < 0) break;

    const ok = await equipBagHeldItemOntoSlot(page, bagIdx, slotIdx);
    if (!ok) {
      console.log(`  [held-bag] UI failed (bag idx ${bagIdx} → slot ${slotIdx})`);
      break;
    }
    moves += 1;
  }

  if (moves > 0) {
    console.log(`  [held-bag] equipped ${moves} held item(s) from bag`);
  }
}
