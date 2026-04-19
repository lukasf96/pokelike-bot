import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";
import { scoreCatchCandidate } from "../catch-intel.js";

export const handleCatch: Handler = async (tick, { page }) => {
  const options = tick.ui.catch?.options ?? [];
  if (options.length === 0) {
    logAction("catch", "No catch options found");
    return;
  }

  const teamTypes = tick.game ? tick.game.team.map((p) => p.types) : [];
  const mapIndex = tick.game?.currentMap ?? 0;

  const scored = options.map((opt) => ({
    opt,
    score:
      opt.speciesId > 0
        ? scoreCatchCandidate(opt.speciesId, opt.level, opt.isShiny, teamTypes, mapIndex)
        : opt.isShiny
          ? 50
          : 0,
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
};
