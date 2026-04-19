import type { Page } from "puppeteer";

import { GEN1_SPECIES_BST } from "../data/gen1-species.js";
import { readGameState } from "../game-state.js";
import { clickSel, sleep } from "../page-utils.js";

interface ShinyScreenSnapshot {
  team: Array<{ speciesId: number; level: number }>;
  shinySpeciesId: number;
  shinyLevel: number;
}

function shouldTakeShiny(snapshot: ShinyScreenSnapshot): boolean {
  const { team, shinySpeciesId, shinyLevel } = snapshot;
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

async function handleShiny(page: Page): Promise<void> {
  const gs = await readGameState(page);
  const team = gs.team.map((p) => ({ speciesId: p.speciesId, level: p.level }));

  const { shinySpeciesId, shinyLevel } = await page.evaluate((): { shinySpeciesId: number; shinyLevel: number } => {
    const img = document.querySelector<HTMLImageElement>("#shiny-content img.poke-sprite");
    const src = img?.getAttribute("src") ?? "";
    const idFromShiny = src.match(/\/pokemon\/shiny\/(\d+)\.png/i);
    const idFromPlain = src.match(/\/pokemon\/(\d+)\.png/i);
    const shinySpeciesId = idFromShiny
      ? Number(idFromShiny[1])
      : idFromPlain
        ? Number(idFromPlain[1])
        : 0;

    const lvEl = document.querySelector("#shiny-content .poke-level");
    const lvText = lvEl?.textContent ?? "";
    const lvMatch = lvText.match(/(\d+)/);
    const shinyLevel = lvMatch ? Number(lvMatch[1]) : 0;

    return { shinySpeciesId, shinyLevel };
  });

  const snapshot: ShinyScreenSnapshot = { team, shinySpeciesId, shinyLevel };

  const take = shouldTakeShiny(snapshot);

  if (take) {
    const took = await clickSel(page, "#btn-take-shiny");
    if (took) {
      console.log("  [shiny] Took shiny!");
    } else {
      await clickSel(page, "#btn-skip-shiny");
      console.log("  [shiny] Skipped shiny (take button missing)");
    }
  } else {
    const skipped = await clickSel(page, "#btn-skip-shiny");
    if (skipped) {
      console.log(
        `  [shiny] Skipped weak shiny (species ${snapshot.shinySpeciesId} Lv${snapshot.shinyLevel} vs team)`,
      );
    } else {
      await clickSel(page, "#btn-take-shiny");
      console.log("  [shiny] Took shiny (skip button missing)");
    }
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
