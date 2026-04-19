/**
 * Move-tutor targeting (BOT_IMPROVEMENTS.md B4): upgrades matter most on the carry that
 * will fight the most future battles — modeled as BST × √level among final-evolution Pokémon.
 */

import { GEN1_EVOLUTIONS } from "./data/gen1-evolutions.js";
import { GEN1_SPECIES_BST } from "./data/gen1-species.js";

export interface TutorTeamSlot {
  speciesId: number;
  level: number;
  moveTier?: number;
}

function isFinalEvolution(speciesId: number): boolean {
  return GEN1_EVOLUTIONS[speciesId] === undefined;
}

function carryScore(speciesId: number, level: number): number {
  const b = GEN1_SPECIES_BST[speciesId] ?? 300;
  return b * Math.sqrt(Math.max(1, level));
}

/**
 * Pick which team index should receive the tutor upgrade.
 * Prefers Pokémon already at their final evolution; otherwise falls back to best score among eligible slots.
 * Returns null only when every member already has moveTier ≥ 2.
 */
export function pickTutorSlot(team: readonly TutorTeamSlot[]): number | null {
  type Cand = { idx: number; score: number; finalEvo: boolean };

  const cands: Cand[] = [];
  for (let i = 0; i < team.length; i++) {
    const p = team[i];
    if (!p) continue;
    const mt = p.moveTier ?? 1;
    if (mt >= 2) continue;
    cands.push({
      idx: i,
      score: carryScore(p.speciesId, p.level),
      finalEvo: isFinalEvolution(p.speciesId),
    });
  }

  if (cands.length === 0) return null;

  const finals = cands.filter((c) => c.finalEvo);
  const pool = finals.length > 0 ? finals : cands;
  pool.sort((a, b) => b.score - a.score);
  return pool[0]!.idx;
}
