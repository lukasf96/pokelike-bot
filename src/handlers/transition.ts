import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

export async function handleTransition(_page: Page): Promise<void> {
  await sleep(2500);
}
