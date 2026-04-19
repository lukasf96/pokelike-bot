import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

export async function handleTrainer(page: Page): Promise<void> {
  console.log("  [trainer] Selecting BOY");
  await clickSel(page, "#trainer-boy");
  await sleep(800);
}
