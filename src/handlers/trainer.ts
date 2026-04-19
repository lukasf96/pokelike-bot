import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import { clickSel, sleep } from "../page-utils.js";

export async function handleTrainer(page: Page): Promise<void> {
  logAction("trainer", "Selecting BOY");
  await clickSel(page, "#trainer-boy");
  await sleep(800);
}
