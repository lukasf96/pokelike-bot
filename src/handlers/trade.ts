import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import {
  isHardProtectedRelease,
  tradeAdjustedGainForSlot,
} from "../intel/release-candidate-intel.js";
import { selectMoonStoneInBag, selectReleaseTeam } from "../state/selectors.js";
import { clickSel, sleep } from "../utility/page-utils.js";

/** B5: expected single-mon swing should clear variance + coverage cost. */
const MIN_TRADE_ADJUSTED_GAIN = 60;

/**
 * game.js doTradeNode: offer is random from getCatchChoices (same BST bucket as map),
 * 3 levels higher — accept when adjusted gain (raw − coverage penalties) beats threshold.
 */
export const handleTrade: Handler = async (tick, { page }) => {
  if (!tick.game) {
    await clickSel(page, "#btn-skip-trade");
    await sleep(800);
    return;
  }
  const team = selectReleaseTeam(tick.game);
  const moonStoneInBag = selectMoonStoneInBag(tick.game);
  const mapIndex = tick.game.currentMap;

  if (team.length === 0) {
    await clickSel(page, "#btn-skip-trade");
    await sleep(800);
    return;
  }

  let bestIdx = -1;
  let bestGain = -Infinity;
  for (let i = 0; i < team.length; i++) {
    const m = team[i]!;
    if (isHardProtectedRelease(m, moonStoneInBag)) continue;
    const adj = tradeAdjustedGainForSlot(team, i, mapIndex);
    if (adj > bestGain) {
      bestGain = adj;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0 && bestGain >= MIN_TRADE_ADJUSTED_GAIN) {
    logAction(
      "trade",
      `Accepting slot ${bestIdx} (adjusted gain ~${bestGain.toFixed(0)} ≥ ${MIN_TRADE_ADJUSTED_GAIN})`,
    );
    await page.evaluate((idx: number) => {
      const rows = document.querySelectorAll<HTMLElement>("#trade-team-list .trade-member-row");
      rows[idx]?.click();
    }, bestIdx);
  } else {
    logAction(
      "trade",
      `Skipping (best adjusted gain ${bestGain === -Infinity ? "n/a" : bestGain.toFixed(0)} < ${MIN_TRADE_ADJUSTED_GAIN} or no eligible slot)`,
    );
    await clickSel(page, "#btn-skip-trade");
  }

  await sleep(800);
};
