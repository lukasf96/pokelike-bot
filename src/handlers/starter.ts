import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import { sleep } from "../utility/page-utils.js";

export const handleStarter: Handler = async (_tick, { page }) => {
  await page
    .waitForFunction(
      (): boolean => {
        const cards = document.querySelectorAll<HTMLElement>("#starter-choices .poke-card");
        return cards.length > 0 && (cards[0]?.getBoundingClientRect().width ?? 0) > 0;
      },
      { timeout: 5000 },
    )
    .catch(() => {});

  // Bulbasaur (Grass/Poison) is the strongest first-two-bosses starter:
  //   - Grass STAB is 2x vs Brock (Rock/Ground) AND 2x vs Misty (Water).
  //   - Squirtle (Water) is 2x vs Brock but only 0.5x vs Misty — Misty is the
  //     historical bottleneck (~70% of run losses).
  //   - Charmander (Fire) is 0.5x vs both.
  // Fall back to any starter if Bulbasaur is missing for some reason.
  const picked = await page.evaluate((): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#starter-choices .poke-card"));
    const preferred = cards.find((c) => {
      const t = c.textContent?.toLowerCase() ?? "";
      return t.includes("bulbasaur");
    });
    const target = preferred ?? cards[0];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "";
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
    logAction("starter", "Picked (mouse fallback)");
  } else {
    logAction("starter", `Picked: ${picked}`);
  }
  await sleep(800);
};
