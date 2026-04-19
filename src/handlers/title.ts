import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { clickSel, sleep } from "../page-utils.js";

export const handleTitle: Handler = async (_tick, { page }) => {
  logAction("title", "Starting new run");
  await clickSel(page, "#btn-new-run");
  await sleep(800);
};
