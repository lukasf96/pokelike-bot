import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import { isBattleDefeatContinueButton, logRunEnd } from "../run-log.js";
import { clickSel, sleep } from "../page-utils.js";

export async function handleBattle(page: Page): Promise<void> {
  const skipVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-auto-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none" && !btn.disabled;
  });

  if (skipVisible) {
    logAction("battle", "Clicking Skip");
    await clickSel(page, "#btn-auto-battle");
    await page
      .waitForFunction((): boolean => {
        const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
        return btn !== null && btn.style.display !== "none";
      }, { timeout: 20000 })
      .catch(() => {});
    await sleep(300);
  }

  const continueVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none";
  });

  if (continueVisible) {
    if (await isBattleDefeatContinueButton(page)) {
      logAction("battle", "Run lost — logging, then Continue…");
      await logRunEnd(page, "lost");
    }
    logAction("battle", "Clicking Continue");
    await clickSel(page, "#btn-continue-battle");
    await sleep(800);
  }
}
