import type { Page } from "puppeteer";

import { logRunEnd } from "../run-log.js";
import { clickSel, sleep } from "../page-utils.js";

export async function handleWin(page: Page): Promise<void> {
  console.log("  [win] WON THE GAME! Starting new run...");
  await logRunEnd(page, "won");
  await clickSel(page, "#btn-play-again");
  await sleep(1000);
}
