import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { pickSwapReleaseSlot } from "../release-candidate-intel.js";
import { selectMoonStoneInBag, selectReleaseTeam } from "../state/selectors.js";
import { sleep } from "../page-utils.js";

export const handleSwap: Handler = async (tick, { page }) => {
  if (!tick.game) {
    await sleep(600);
    return;
  }
  const team = selectReleaseTeam(tick.game);
  const moonStoneInBag = selectMoonStoneInBag(tick.game);

  const slot = pickSwapReleaseSlot(team, moonStoneInBag, tick.game.currentMap);
  const m = team[slot];

  const result = await page.evaluate((releaseIdx: number): string => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"),
    );
    if (cards.length === 0 || releaseIdx < 0 || releaseIdx >= cards.length) {
      (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
      return "cancelled";
    }
    const target = cards[releaseIdx];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return `released slot${releaseIdx} ${name}`;
  }, slot);

  logAction("swap", `${result} (lv${m?.level ?? "?"} speciesId=${m?.speciesId ?? "?"})`);
  await sleep(800);
};
