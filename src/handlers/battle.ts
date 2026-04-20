import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import { clickSel, sleep } from "../utility/page-utils.js";

/**
 * Defeat detection (`tick.ui.battle.isDefeat`) is consumed by `RunMachine` to emit
 * `run-ended`. This handler is purely UI-advancing.
 */
export const handleBattle: Handler = async (tick, { page }) => {
  const battle = tick.ui.battle;
  if (battle?.skipVisible) {
    logAction("battle", "Clicking Skip");
    await clickSel(page, "#btn-auto-battle");
    await page
      .waitForFunction(
        (): boolean => {
          const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
          return btn !== null && btn.style.display !== "none";
        },
        { timeout: 20000 },
      )
      .catch(() => {});
    await sleep(300);
  }

  const continueVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none";
  });

  if (continueVisible) {
    if (battle?.isDefeat) {
      logAction("battle", "Run lost — Continue…");
    }
    logAction("battle", "Clicking Continue");
    await clickSel(page, "#btn-continue-battle");
    await sleep(800);
  }
};
