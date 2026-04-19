import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

export async function handleStarter(page: Page): Promise<void> {
  await page
    .waitForFunction(
      (): boolean => {
        const cards = document.querySelectorAll<HTMLElement>(
          "#starter-choices .poke-card",
        );
        return (
          cards.length > 0 && (cards[0]?.getBoundingClientRect().width ?? 0) > 0
        );
      },
      { timeout: 5000 },
    )
    .catch(() => {});

  const picked = await page.evaluate((): string => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("#starter-choices .poke-card"),
    );
    const preferred = cards.find((c) => {
      const t = c.textContent?.toLowerCase() ?? "";
      return t.includes("bulbasaur");
    });
    const target = preferred ?? cards[0];
    const name =
      target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ??
      "";
    target?.click();
    return name;
  });

  if (!picked) {
    const bounds = await page.evaluate((): { x: number; y: number } | null => {
      const r = document
        .querySelector<HTMLElement>("#starter-choices .poke-card")
        ?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    });
    if (bounds) await page.mouse.click(bounds.x, bounds.y);
    console.log("  [starter] Picked (mouse fallback)");
  } else {
    console.log(`  [starter] Picked: ${picked}`);
  }
  await sleep(800);
}
