import type { Page } from "puppeteer";

import { readGameState } from "../game-state.js";
import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";
import { scoreCatchCandidate } from "../catch-intel.js";

interface CatchOption {
  index: number;
  speciesId: number;
  level: number;
  isShiny: boolean;
  name: string;
}

export async function handleCatch(page: Page): Promise<void> {
  const [gs, options] = await Promise.all([
    readGameState(page),
    page.evaluate((): CatchOption[] => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>("#catch-choices .poke-card"));
      return cards.map((c, i) => {
        const nameEl = c.querySelector<HTMLElement>(".poke-name");
        const name = nameEl?.textContent?.trim() ?? "?";
        const levelEl = c.querySelector<HTMLElement>(".poke-level, [class*='level']");
        const levelText = levelEl?.textContent?.replace(/[^0-9]/g, "") ?? "";
        const level = levelText ? parseInt(levelText, 10) : 5;
        const speciesIdAttr = c.getAttribute("data-species-id") ?? c.getAttribute("data-id") ?? "";
        const speciesId = speciesIdAttr ? parseInt(speciesIdAttr, 10) : 0;
        const isShiny =
          c.querySelector(".shiny-badge, [class*='shiny']") !== null ||
          (c.textContent?.includes("★") ?? false) ||
          (c.textContent?.includes("Shiny") ?? false);
        return { index: i, speciesId, level, isShiny, name };
      });
    }),
  ]);

  const teamTypes = gs.team.map((p) => p.types);
  const mapIndex = gs.currentMap;

  if (options.length === 0) {
    logAction("catch", "No catch options found");
    return;
  }

  const scored = options.map((opt) => ({
    opt,
    score: opt.speciesId > 0
      ? scoreCatchCandidate(opt.speciesId, opt.level, opt.isShiny, teamTypes, mapIndex)
      : opt.isShiny ? 50 : 0,
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  logAction(
    "catch",
    `Scored: ${scored.map((s) => `${s.opt.name}(${s.score.toFixed(0)})`).join(", ")} → picking ${best.opt.name}`,
  );

  await page.evaluate((idx: number) => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#catch-choices .poke-card"));
    cards[idx]?.click();
  }, best.opt.index);

  await sleep(800);
}
