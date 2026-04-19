import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import { logRunEnd } from "../run-log.js";
import { clickSel, sleep } from "../page-utils.js";

export async function handleWin(page: Page): Promise<void> {
  logAction("win", "WON THE GAME — starting new run…");
  await logRunEnd(page, "won");
  await clickSel(page, "#btn-play-again");
  await sleep(1000);
}
