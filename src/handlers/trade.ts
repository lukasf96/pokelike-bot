import type { Page } from "puppeteer";

import type { ReleaseTeamMember } from "../release-candidate-intel.js";
import {
  isHardProtectedRelease,
  tradeAdjustedGainForSlot,
} from "../release-candidate-intel.js";
import { clickSel, sleep } from "../page-utils.js";

/** B5: expected single-mon swing should clear variance + coverage cost. */
const MIN_TRADE_ADJUSTED_GAIN = 60;

/**
 * game.js doTradeNode: offer is random from getCatchChoices (same BST bucket as map),
 * 3 levels higher — accept when adjusted gain (raw − coverage penalties) beats threshold.
 */
export async function handleTrade(page: Page): Promise<void> {
  const snap = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const mapIndex = Number(st?.currentMap ?? 0);
    const rawTeam = (st?.team ?? []) as Array<{
      level?: number;
      speciesId?: number;
      isShiny?: boolean;
      heldItem?: { id?: string } | null;
      moveTier?: number;
    }>;
    const rawItems = (st?.items ?? []) as Array<{ id?: string }>;
    const moonStoneInBag = rawItems.some((it) => String(it.id ?? "") === "moon_stone");
    const team: ReleaseTeamMember[] = rawTeam.map((p) => ({
      speciesId: Number(p.speciesId ?? 0),
      level: Number(p.level ?? 1),
      isShiny: Boolean(p.isShiny),
      heldItemId: p.heldItem?.id != null ? String(p.heldItem.id) : null,
      moveTier: Math.max(0, Math.min(2, Number(p.moveTier ?? 0))),
    }));
    return { mapIndex, team, moonStoneInBag };
  });

  if (snap.team.length === 0) {
    await clickSel(page, "#btn-skip-trade");
    await sleep(800);
    return;
  }

  let bestIdx = -1;
  let bestGain = -Infinity;
  for (let i = 0; i < snap.team.length; i++) {
    const m = snap.team[i]!;
    if (isHardProtectedRelease(m, snap.moonStoneInBag)) continue;
    const adj = tradeAdjustedGainForSlot(snap.team, i, snap.mapIndex);
    if (adj > bestGain) {
      bestGain = adj;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0 && bestGain >= MIN_TRADE_ADJUSTED_GAIN) {
    console.log(
      `  [trade] Accepting slot ${bestIdx} (adjusted gain ~${bestGain.toFixed(0)} ≥ ${MIN_TRADE_ADJUSTED_GAIN})`,
    );
    await page.evaluate((idx: number) => {
      const rows = document.querySelectorAll<HTMLElement>("#trade-team-list .trade-member-row");
      rows[idx]?.click();
    }, bestIdx);
  } else {
    console.log(
      `  [trade] Skipping (best adjusted gain ${bestGain === -Infinity ? "n/a" : bestGain.toFixed(0)} < ${MIN_TRADE_ADJUSTED_GAIN} or no eligible slot)`,
    );
    await clickSel(page, "#btn-skip-trade");
  }

  await sleep(800);
}
