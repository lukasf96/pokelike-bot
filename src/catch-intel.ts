/**
 * Scoring logic for catch choices, implementing B2 from BOT_IMPROVEMENTS.md.
 * Replaces the binary STRONG_POKEMON allow-list with a coverage-aware BST formula.
 */

import { GEN1_SPECIES_BST, GEN1_SPECIES_TYPES } from "./data/gen1-species.js";
import { GEN1_EVOLUTIONS, CROSS_SPECIES_EVOLUTION_BST } from "./data/gen1-evolutions.js";
import { typeEffectiveness, attackingStabTypes } from "./battle-intel.js";

/**
 * Boss types for maps 0–8 (indexed by mapIndex). Used to reward type coverage.
 * Sourced from GYM_FIRST_LEAD_TYPES / GYM_TEAM_TYPES / ELITE_TEAM_TYPES in battle-intel.ts.
 */
const BOSS_TYPES_BY_MAP: readonly string[][] = [
  ["Rock", "Ground"],         // Map 0 – Brock
  ["Water", "Psychic"],       // Map 1 – Misty
  ["Electric"],               // Map 2 – Lt. Surge
  ["Grass", "Poison"],        // Map 3 – Erika
  ["Poison"],                 // Map 4 – Koga
  ["Psychic", "Bug"],         // Map 5 – Sabrina
  ["Fire"],                   // Map 6 – Blaine
  ["Ground", "Poison", "Rock"], // Map 7 – Giovanni
  ["Water", "Ice", "Rock", "Fighting", "Ghost", "Dragon", "Normal", "Psychic", "Fire", "Flying"],
  // Map 8 – Elite Four (all types present)
];

/** Late-game carry types that score a large bonus on Maps 6–8. */
const LATE_GAME_BONUS_TYPES = new Set(["Ice", "Electric", "Rock", "Ghost"]);

function bst(speciesId: number): number {
  return GEN1_SPECIES_BST[speciesId] ?? 300;
}

function speciesTypes(speciesId: number): string[] {
  return GEN1_SPECIES_TYPES[speciesId] ?? ["Normal"];
}

/** Final evolution BST for a species (follows chain once). */
function finalEvoBst(speciesId: number): number {
  let id = speciesId;
  let depth = 0;
  while (depth < 3) {
    const evo = GEN1_EVOLUTIONS[id];
    if (!evo) break;
    id = evo.into;
    depth++;
  }
  return CROSS_SPECIES_EVOLUTION_BST[id] ?? GEN1_SPECIES_BST[id] ?? bst(speciesId);
}

/** Number of evolution steps remaining from this species. */
function stepsToFinalEvo(speciesId: number): number {
  let id = speciesId;
  let steps = 0;
  while (steps < 3) {
    const evo = GEN1_EVOLUTIONS[id];
    if (!evo) break;
    id = evo.into;
    steps++;
  }
  return steps;
}

/** Types team already has STAB coverage for. */
function coveredAttackTypes(teamTypes: string[][]): Set<string> {
  const covered = new Set<string>();
  for (const types of teamTypes) {
    for (const t of attackingStabTypes(types)) {
      covered.add(t.toLowerCase());
    }
  }
  return covered;
}

/**
 * Score a catch candidate per B2 recommendation.
 *
 * @param speciesId  Pokédex ID (1–151)
 * @param level      Current level of the offered Pokémon
 * @param isShiny    Whether it's shiny
 * @param teamTypes  Types array for each current team member
 * @param mapIndex   Current map (0-based)
 */
export function scoreCatchCandidate(
  speciesId: number,
  level: number,
  isShiny: boolean,
  teamTypes: string[][],
  mapIndex: number,
): number {
  const sqrtLevel = Math.sqrt(Math.max(1, level));

  // Base: BST × √level — rewards strong species at higher levels
  let score = bst(speciesId) * sqrtLevel;

  // Evolution potential: use final-evo BST for the scaling component
  const finalBst = finalEvoBst(speciesId);
  score = finalBst * sqrtLevel;

  // Evolution tier bonuses / penalties
  const steps = stepsToFinalEvo(speciesId);
  if (steps === 0) {
    score += 40;   // final evolution — most future fights using full power
  } else if (steps === 1) {
    score += 20;   // one step from final
  } else {
    score -= 15;   // base form far from final
  }

  // Type coverage: reward types the team is missing against upcoming bosses
  const covered = coveredAttackTypes(teamTypes);
  const candidateStab = attackingStabTypes(speciesTypes(speciesId)).map((t) => t.toLowerCase());

  // Bosses from current map onward
  for (let m = mapIndex; m < BOSS_TYPES_BY_MAP.length; m++) {
    for (const bossType of BOSS_TYPES_BY_MAP[m]!) {
      const effective = typeEffectiveness(bossType, [bossType]);
      // Check if candidate attacks the boss type super-effectively and team lacks this
      for (const stab of candidateStab) {
        const mult = typeEffectiveness(stab, [bossType]);
        if (mult >= 2 && !covered.has(stab)) {
          score += 25;
          break; // one bonus per boss type, not per STAB move
        }
      }
    }
  }

  // Late-game carry bonus: Ice/Electric/Rock/Ghost STAB for Maps 6+
  if (mapIndex >= 6) {
    for (const stab of candidateStab) {
      if (LATE_GAME_BONUS_TYPES.has(stab.charAt(0).toUpperCase() + stab.slice(1))) {
        score += 30;
        break;
      }
    }
  }

  // Duplicate penalty: same species already on team
  // (teamTypes doesn't include speciesId, so we can't check this here —
  //  the caller should pass this info separately; skip for now)

  // Shiny bonus: only if species also has decent base score (finalBst >= 400)
  if (isShiny && finalBst >= 400) {
    score += 30;
  } else if (isShiny) {
    score += 10; // small shiny bonus even for weak species
  }

  return score;
}
