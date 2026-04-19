import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

export async function handleTitle(page: Page): Promise<void> {
  console.log("  [title] Starting new run");
  await clickSel(page, "#btn-new-run");
  await sleep(800);
}
