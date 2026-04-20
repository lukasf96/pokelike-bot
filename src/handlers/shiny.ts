import type { Handler } from "../state/handler.js";
import { GEN1_SPECIES_BST } from "../data/gen1-species.js";
import { logAction } from "../logging/logger.js";
import { clickSel, sleep } from "../utility/page-utils.js";
import type { GameSnapshot } from "../state/types.js";

interface ShinyDecisionInput {
  team: Array<{ speciesId: number; level: number }>;
  shinySpeciesId: number;
  shinyLevel: number;
}

function shouldTakeShiny(input: ShinyDecisionInput): boolean {
  const { team, shinySpeciesId, shinyLevel } = input;
  if (team.length < 6) return true;
  if (shinySpeciesId < 1 || shinyLevel < 1) return true;

  const shinyBst = GEN1_SPECIES_BST[shinySpeciesId];
  if (typeof shinyBst !== "number") return true;

  let weakest = Infinity;
  for (const p of team) {
    const b = GEN1_SPECIES_BST[p.speciesId];
    const bstVal = typeof b === "number" ? b : 320;
    const lvl = typeof p.level === "number" && p.level > 0 ? p.level : 1;
    const pow = bstVal * lvl;
    if (pow < weakest) weakest = pow;
  }

  const shinyPow = shinyBst * shinyLevel;
  return shinyPow >= weakest;
}

function teamForShiny(game: GameSnapshot | null): Array<{ speciesId: number; level: number }> {
  if (!game) return [];
  return game.team.map((p) => ({ speciesId: p.speciesId, level: p.level }));
}

export const handleShinyExtended: Handler = async (tick, { page }) => {
  const tradeContinue = await clickSel(page, "#btn-trade-continue");
  if (tradeContinue) {
    logAction("shiny", "Trade reveal — continuing");
    await sleep(800);
    return;
  }

  const shiny = tick.ui.shiny;
  const input: ShinyDecisionInput = {
    team: teamForShiny(tick.game),
    shinySpeciesId: shiny?.speciesId ?? 0,
    shinyLevel: shiny?.level ?? 0,
  };
  const take = shouldTakeShiny(input);

  if (take) {
    const took = await clickSel(page, "#btn-take-shiny");
    if (took) {
      logAction("shiny", "Took shiny!");
    } else {
      await clickSel(page, "#btn-skip-shiny");
      logAction("shiny", "Skipped shiny (take button missing)");
    }
  } else {
    const skipped = await clickSel(page, "#btn-skip-shiny");
    if (skipped) {
      logAction(
        "shiny",
        `Skipped weak shiny (species ${input.shinySpeciesId} Lv${input.shinyLevel} vs team)`,
      );
    } else {
      await clickSel(page, "#btn-take-shiny");
      logAction("shiny", "Took shiny (skip button missing)");
    }
  }

  await sleep(800);
};
