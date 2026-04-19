import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import { clickSel, sleep } from "../page-utils.js";

export async function handleBadge(page: Page): Promise<void> {
  logAction("badge", "Advancing to next map");
  await clickSel(page, "#btn-next-map");
  await sleep(800);
}
