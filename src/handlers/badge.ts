import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

export async function handleBadge(page: Page): Promise<void> {
  console.log("  [badge] Advancing to next map");
  await clickSel(page, "#btn-next-map");
  await sleep(800);
}
