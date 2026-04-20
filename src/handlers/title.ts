import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import { clickSel, sleep } from "../utility/page-utils.js";

export const handleTitle: Handler = async (_tick, { page }) => {
  logAction("title", "Starting new run");
  await clickSel(page, "#btn-new-run");
  await sleep(800);
};
