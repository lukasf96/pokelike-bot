import type { Handler } from "../state/handler.js";
import { sleep } from "../page-utils.js";

export const handleTransition: Handler = async () => {
  await sleep(2500);
};
