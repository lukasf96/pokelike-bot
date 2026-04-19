import type { Page } from "puppeteer";

import { clickFirst, sleep } from "../page-utils.js";

export async function handleGameOver(page: Page): Promise<void> {
  await clickFirst(page, "#gameover-screen button");
  await sleep(500);
}
