import type { Page } from "puppeteer";

import { CROSS_SPECIES_EVOLUTION_BST, GEN1_EVOLUTIONS } from "../data/gen1-evolutions.js";
import { GEN1_SPECIES_BST } from "../data/gen1-species.js";
import type { TeamMemberForItem } from "../item-intel.js";
import { sleep } from "../page-utils.js";

function speciesBaseStatTotal(speciesId: number): number | undefined {
  const base = GEN1_SPECIES_BST[speciesId];
  if (typeof base === "number") return base;
  return CROSS_SPECIES_EVOLUTION_BST[speciesId];
}

interface BagEntry {
  idx: number;
  id: string;
  usable: boolean;
}

interface UsableSnapshot {
  team: TeamMemberForItem[];
  bag: BagEntry[];
  currentMap: number;
}

function sumBst(m: TeamMemberForItem): number {
  const b = m.baseStats;
  if (!b) return 320;
  return (b.hp ?? 0) + (b.atk ?? 0) + (b.def ?? 0) + (b.speed ?? 0) + (b.special ?? 0);
}

function powerScore(m: TeamMemberForItem): number {
  return sumBst(m) * Math.sqrt(m.level);
}

function levelsUntilNaturalEvo(m: TeamMemberForItem): number | null {
  if (m.speciesId === 133) return Math.max(0, 36 - m.level);
  const row = GEN1_EVOLUTIONS[m.speciesId];
  if (!row) return null;
  return Math.max(0, row.level - m.level);
}

function estimatedMoonStoneBstGain(m: TeamMemberForItem): number {
  if (m.speciesId === 133) {
    const vaporeon = speciesBaseStatTotal(134);
    if (typeof vaporeon !== "number") return -Infinity;
    return vaporeon - sumBst(m);
  }
  const row = GEN1_EVOLUTIONS[m.speciesId];
  if (!row) return -Infinity;
  const intoTotal = speciesBaseStatTotal(row.into);
  if (typeof intoTotal !== "number") return -Infinity;
  return intoTotal - sumBst(m);
}

function pickRareCandySlot(team: TeamMemberForItem[], currentMap: number, candyCount: number, minReserve: number): number {
  const usable = team
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.level < 100);
  if (usable.length === 0) return -1;

  const bestAmong = (pairs: Array<{ p: TeamMemberForItem; i: number }>): number => {
    let best = -1;
    let bestS = -Infinity;
    for (const { p, i } of pairs) {
      const s = powerScore(p);
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    }
    return best;
  };

  const nearEvo = usable.filter(({ p }) => {
    const lu = levelsUntilNaturalEvo(p);
    return lu !== null && lu >= 1 && lu <= 3;
  });

  if (candyCount <= minReserve) {
    if (nearEvo.length === 0) return -1;
    return bestAmong(nearEvo);
  }

  if (nearEvo.length > 0) return bestAmong(nearEvo);
  if (currentMap >= 7) return bestAmong(usable);
  return bestAmong(usable);
}

function pickMaxReviveSlot(team: TeamMemberForItem[]): number {
  const fainted = team.map((p, i) => ({ p, i })).filter(({ p }) => (p.currentHp ?? 1) <= 0);
  if (fainted.length === 0) return -1;
  let best = -1;
  let bestS = -Infinity;
  for (const { p, i } of fainted) {
    const s = powerScore(p);
    if (s > bestS) {
      bestS = s;
      best = i;
    }
  }
  return best;
}

function pickMoonStoneSlot(team: TeamMemberForItem[]): number {
  const eeveeIdx = team.findIndex((p) => p.speciesId === 133);
  if (eeveeIdx >= 0) return eeveeIdx;

  let bestIdx = -1;
  let bestKey = -Infinity;
  for (let i = 0; i < team.length; i += 1) {
    const m = team[i]!;
    const row = GEN1_EVOLUTIONS[m.speciesId];
    if (!row) continue;
    const until = row.level - m.level;
    if (until >= 1 && until <= 4) continue;
    const gain = estimatedMoonStoneBstGain(m);
    if (gain <= 80) continue;
    const key = gain * Math.sqrt(m.level);
    if (key > bestKey) {
      bestKey = key;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function shouldUseMaxRevive(snap: UsableSnapshot): boolean {
  const alive = snap.team.filter((p) => (p.currentHp ?? 1) > 0).length;
  const hasFainted = snap.team.some((p) => (p.currentHp ?? 1) <= 0);
  if (!hasFainted) return false;
  return snap.currentMap >= 8 || alive < 4;
}

async function readUsableSnapshot(page: Page): Promise<UsableSnapshot> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const team: TeamMemberForItem[] = (st?.team ?? []).map((p: Record<string, unknown>) => ({
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      baseStats: p.baseStats as TeamMemberForItem["baseStats"],
      level: Number(p.level ?? 1),
      speciesId: Number(p.speciesId ?? 0),
      currentHp: typeof p.currentHp === "number" ? p.currentHp : undefined,
      maxHp: typeof p.maxHp === "number" ? p.maxHp : undefined,
      heldItem: p.heldItem as TeamMemberForItem["heldItem"],
    }));
    const bag: BagEntry[] = (st?.items ?? []).map((it: Record<string, unknown>, idx: number) => ({
      idx,
      id: String(it.id ?? ""),
      usable: !!it.usable,
    }));
    const currentMap = Number(st?.currentMap ?? 0);
    return { team, bag, currentMap };
  });
}

async function clickUsableItemOnSlot(page: Page, bagIdx: number, slotIdx: number): Promise<boolean> {
  const opened = await page.evaluate((badgeIdx: number): boolean => {
    const bar = document.getElementById("item-bar");
    const badges = bar?.querySelectorAll(".item-badge");
    const el = badges?.[badgeIdx];
    if (!el) return false;
    (el as HTMLElement).click();
    return true;
  }, bagIdx);

  if (!opened) return false;
  await sleep(450);

  return page.evaluate((slot: number): boolean => {
    const modal = document.getElementById("usable-item-modal");
    if (!modal) return false;
    const row = modal.querySelector<HTMLElement>(`.equip-pokemon-row[data-idx="${slot}"]`);
    if (!row || row.style.pointerEvents === "none") return false;
    row.click();
    return true;
  }, slotIdx);
}

type NextUse =
  | { itemId: "max_revive" | "rare_candy" | "moon_stone"; bagIdx: number; slotIdx: number }
  | null;

function planNextUse(snap: UsableSnapshot): NextUse {
  const usableBag = snap.bag.filter((b) => b.usable && b.id);
  const countId = (id: string) => usableBag.filter((b) => b.id === id).length;

  const maxReviveIdx = usableBag.find((b) => b.id === "max_revive")?.idx;
  if (maxReviveIdx !== undefined && shouldUseMaxRevive(snap)) {
    const slot = pickMaxReviveSlot(snap.team);
    if (slot >= 0) return { itemId: "max_revive", bagIdx: maxReviveIdx, slotIdx: slot };
  }

  const rareIdx = usableBag.find((b) => b.id === "rare_candy")?.idx;
  if (rareIdx !== undefined) {
    const candyCount = countId("rare_candy");
    const minReserve = snap.currentMap < 7 ? 2 : 0;
    const slot = pickRareCandySlot(snap.team, snap.currentMap, candyCount, minReserve);
    if (slot >= 0) return { itemId: "rare_candy", bagIdx: rareIdx, slotIdx: slot };
  }

  const moonIdx = usableBag.find((b) => b.id === "moon_stone")?.idx;
  if (moonIdx !== undefined) {
    const slot = pickMoonStoneSlot(snap.team);
    if (slot >= 0) return { itemId: "moon_stone", bagIdx: moonIdx, slotIdx: slot };
  }

  return null;
}

/**
 * Consumes usable bag items via `#usable-item-modal` (A2 in `.docs/BOT_IMPROVEMENTS.md`).
 * Invoked from map flow before held-item bag equip / swaps.
 */
export async function maybeUseUsableItems(page: Page): Promise<void> {
  let used = 0;
  const maxIter = 24;

  for (let iter = 0; iter < maxIter; iter += 1) {
    const snap = await readUsableSnapshot(page);
    const next = planNextUse(snap);
    if (!next) break;

    const ok = await clickUsableItemOnSlot(page, next.bagIdx, next.slotIdx);
    if (!ok) {
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#btn-cancel-use")?.click();
      });
      await sleep(200);
      console.log(`  [usable] UI abort (${next.itemId})`);
      break;
    }
    used += 1;
    console.log(`  [usable] ${next.itemId} → slot ${next.slotIdx} (map ${snap.currentMap})`);
    await sleep(520);
  }

  if (used > 0) {
    console.log(`  [usable] consumed ${used} usable item(s)`);
  }
}
