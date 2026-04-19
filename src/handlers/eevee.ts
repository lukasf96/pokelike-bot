import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";

/** Matches `EEVEE_EVOLUTIONS` render order in game `data.js`. */
const EEVEE_CARD_LABELS = ["Flareon", "Vaporeon", "Jolteon"] as const;

interface EeveeScores {
  flareon: number;
  vaporeon: number;
  jolteon: number;
}

function normalizeType(t: string): string {
  const s = t.trim();
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Heuristic from `.docs/BOT_IMPROVEMENTS.md` A1: map-aware + missing role on team; Map 5+ defaults to Vaporeon. */
export function pickEeveelutionCardIndex(currentMap: number, rawTeamTypes: string[]): number {
  const types = new Set(rawTeamTypes.map(normalizeType).filter((x) => x.length > 0));
  const hasWater = types.has("Water");
  const hasElectric = types.has("Electric");
  const hasFire = types.has("Fire");

  if (currentMap >= 4) {
    if (!hasWater) return 1;
    if (!hasElectric) return 2;
    if (!hasFire) return 0;
    return 1;
  }

  const s: EeveeScores = { flareon: 0, vaporeon: 0, jolteon: 0 };

  if (currentMap <= 0) s.vaporeon += 12;
  if (currentMap === 1) s.jolteon += 12;
  if (currentMap === 2) s.jolteon += 10;
  if (currentMap === 3) s.flareon += 12;

  if (!hasWater) s.vaporeon += 6;
  if (!hasElectric) s.jolteon += 6;
  if (!hasFire) s.flareon += 6;

  if (s.flareon === 0 && s.vaporeon === 0 && s.jolteon === 0) return 1;

  const scoresArr: number[] = [s.flareon, s.vaporeon, s.jolteon];
  const bestScore = Math.max(scoresArr[0], scoresArr[1], scoresArr[2]);
  for (const idx of [1, 2, 0] as const) {
    if (scoresArr[idx] === bestScore) return idx;
  }
  return 1;
}

export const handleEeveeChoice: Handler = async (tick, { page }) => {
  const game = tick.game;
  const currentMap = game?.currentMap ?? 0;
  const teamTypes = game ? game.team.flatMap((p) => p.types) : [];

  const idx = pickEeveelutionCardIndex(currentMap, teamTypes);
  const label = EEVEE_CARD_LABELS[idx] ?? "Vaporeon";

  const clicked = await page.evaluate((cardIndex: number) => {
    const root = document.getElementById("eevee-choices");
    if (!root) return false;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(":scope > div"));
    const card = cards[cardIndex];
    if (!card) return false;
    card.click();
    return true;
  }, idx);

  logAction("eevee", `Chose ${label} (idx=${idx}) map=${currentMap} clicked=${clicked}`);
  await sleep(600);
};
