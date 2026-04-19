import type { Handler } from "../state/handler.js";
import { clickFirst, sleep } from "../page-utils.js";

export const handleGameOver: Handler = async (_tick, { page }) => {
  await clickFirst(page, "#gameover-screen button");
  await sleep(500);
};
