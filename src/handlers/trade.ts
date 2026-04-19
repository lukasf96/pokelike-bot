import type { Page } from "puppeteer";

import { avgBstCatchPool } from "../catch-pool.js";
import { GEN1_SPECIES_BST } from "../data/gen1-species.js";
import { clickSel, sleep } from "../page-utils.js";

function monPowerScore(level: number, speciesId: number): number {
  const bst = GEN1_SPECIES_BST[speciesId] ?? 360;
  return bst * Math.sqrt(Math.max(1, level));
}

function expectedOfferPowerScore(mapIndex: number, tradeFromLevel: number): number {
  const avgBst = avgBstCatchPool(mapIndex);
  const offerLv = Math.min(100, tradeFromLevel + 3);
  return avgBst * Math.sqrt(offerLv);
}

/**
 * game.js doTradeNode: offer is random from getCatchChoices (same BST bucket as map),
 * 3 levels higher — accept when expected value clearly beats the released member.
 */
export async function handleTrade(page: Page): Promise<void> {
  const snap = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const mapIndex = Number(st?.currentMap ?? 0);
    const team = (st?.team ?? []) as Array<{ level?: number; speciesId?: number }>;
    return {
      mapIndex,
      team: team.map((p) => ({
        level: Number(p.level ?? 1),
        speciesId: Number(p.speciesId ?? 0),
      })),
    };
  });

  if (snap.team.length === 0) {
    await clickSel(page, "#btn-skip-trade");
    await sleep(800);
    return;
  }

  let bestIdx = -1;
  let bestGain = 0;
  for (let i = 0; i < snap.team.length; i++) {
    const m = snap.team[i]!;
    const cur = monPowerScore(m.level, m.speciesId);
    const exp = expectedOfferPowerScore(snap.mapIndex, m.level);
    const gain = exp - cur;
    if (gain > bestGain) {
      bestGain = gain;
      bestIdx = i;
    }
  }

  const minGain = 20;
  if (bestIdx >= 0 && bestGain >= minGain) {
    console.log(
      `  [trade] Accepting slot ${bestIdx} (expected BST×√L gain ~${bestGain.toFixed(0)} vs release)`,
    );
    await page.evaluate((idx: number) => {
      const rows = document.querySelectorAll<HTMLElement>("#trade-team-list .trade-member-row");
      rows[idx]?.click();
    }, bestIdx);
  } else {
    console.log(`  [trade] Skipping (best gain ${bestGain.toFixed(0)} < ${minGain})`);
    await clickSel(page, "#btn-skip-trade");
  }

  await sleep(800);
}
