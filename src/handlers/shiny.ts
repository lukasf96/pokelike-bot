import type { Page } from "puppeteer";

import { clickSel, sleep } from "../page-utils.js";

async function handleShiny(page: Page): Promise<void> {
  const took = await clickSel(page, "#btn-take-shiny");
  if (took) {
    console.log("  [shiny] Took shiny!");
  } else {
    await clickSel(page, "#btn-skip-shiny");
    console.log("  [shiny] Skipped shiny");
  }
  await sleep(800);
}

/** Also handles the trade-complete shiny reveal screen (#btn-trade-continue) */
export async function handleShinyExtended(page: Page): Promise<void> {
  const tradeContinue = await clickSel(page, "#btn-trade-continue");
  if (!tradeContinue) {
    await handleShiny(page);
  } else {
    console.log("  [shiny] Trade reveal — continuing");
  }
  await sleep(800);
}
