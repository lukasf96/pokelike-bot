import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

export async function handleSwap(page: Page): Promise<void> {
  const result = await page.evaluate((): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"));
    if (cards.length === 0) {
      (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
      return "cancelled";
    }

    let lowestIdx = 0;
    let lowestLevel = Infinity;
    cards.forEach((c, i) => {
      const lvText = c.querySelector<HTMLElement>(".poke-level")?.textContent ?? "";
      const lv = parseInt(lvText.replace(/[^0-9]/g, "")) || 99;
      if (lv < lowestLevel) {
        lowestLevel = lv;
        lowestIdx = i;
      }
    });

    const target = cards[lowestIdx];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return `released lv${lowestLevel} ${name}`;
  });

  console.log(`  [swap] ${result}`);
  await sleep(800);
}
