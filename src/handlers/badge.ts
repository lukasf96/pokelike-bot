import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import { clickSel, sleep } from "../utility/page-utils.js";

export const handleBadge: Handler = async (_tick, { page }) => {
  logAction("badge", "Advancing to next map");
  await clickSel(page, "#btn-next-map");
  await sleep(800);
};
