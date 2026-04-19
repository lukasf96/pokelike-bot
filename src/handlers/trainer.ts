import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { clickSel, sleep } from "../page-utils.js";

export const handleTrainer: Handler = async (_tick, { page }) => {
  logAction("trainer", "Selecting BOY");
  await clickSel(page, "#trainer-boy");
  await sleep(800);
};
