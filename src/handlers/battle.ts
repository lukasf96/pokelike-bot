import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

export async function handleBattle(page: Page): Promise<void> {
  const skipVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-auto-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none" && !btn.disabled;
  });

  if (skipVisible) {
    console.log("  [battle] Clicking Skip");
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
    console.log("  [battle] Clicking Continue");
    await clickSel(page, "#btn-continue-battle");
    await sleep(800);
  }
}
