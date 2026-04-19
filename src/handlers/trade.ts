import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

export async function handleTrade(page: Page): Promise<void> {
  console.log("  [trade] Declining trade");
  await clickSel(page, "#btn-skip-trade");
  await sleep(800);
}
