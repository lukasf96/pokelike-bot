import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import { clickSel, sleep } from "../utility/page-utils.js";

/** Run-end emission is owned by `RunMachine`; this handler just advances the UI. */
export const handleWin: Handler = async (_tick, { page }) => {
  logAction("win", "WON THE GAME — starting new run…");
  await clickSel(page, "#btn-play-again");
  await sleep(1000);
};
