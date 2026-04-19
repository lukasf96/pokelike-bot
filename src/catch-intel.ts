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
/** Boss typings for maps 0–8; shared with release/trade candidate logic. */
export const BOSS_TYPES_BY_MAP: readonly string[][] = [
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

/**
 * For the *next* boss specifically (mapIndex of the boss we're about to fight),
 * the lead typing matters more than the rest of the roster — the lead is what
 * decides the opener exchange. Used for the urgency bonus.
 */
const NEXT_BOSS_LEAD_TYPES: readonly string[][] = [
  ["Rock", "Ground"], // Brock — Geodude
  ["Water"],          // Misty — Staryu
  ["Electric"],       // Lt. Surge — Pikachu
  ["Grass"],          // Erika — Tangela
  ["Poison"],         // Koga — Koffing
  ["Psychic"],        // Sabrina — Mr. Mime
  ["Fire"],           // Blaine — Ponyta
  ["Ground"],         // Giovanni — Dugtrio
  ["Water", "Ice"],   // Lorelei — Dewgong
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

/** Count of team members whose primary STAB equals each lowercase type. */
function stabFrequency(teamTypes: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const types of teamTypes) {
    for (const t of attackingStabTypes(types)) {
      const lc = t.toLowerCase();
      freq.set(lc, (freq.get(lc) ?? 0) + 1);
    }
  }
  return freq;
}

/** True if any team member's STAB hits `bossTypes` super-effectively (≥2x). */
function teamHasCounterFor(teamTypes: string[][], bossTypes: readonly string[]): boolean {
  for (const types of teamTypes) {
    for (const stab of attackingStabTypes(types)) {
      for (const bt of bossTypes) {
        if (typeEffectiveness(stab, [bt]) >= 2) return true;
      }
    }
  }
  return false;
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

  // Base: final-evo BST × √level — rewards species that scale into the late
  // game, while still acknowledging current level.
  const finalBst = finalEvoBst(speciesId);
  let score = finalBst * sqrtLevel;

  // Evolution tier bonuses / penalties
  const steps = stepsToFinalEvo(speciesId);
  if (steps === 0) {
    score += 40;   // final evolution — most future fights using full power
  } else if (steps === 1) {
    score += 20;   // one step from final
  } else {
    score -= 15;   // base form far from final
  }

  const covered = coveredAttackTypes(teamTypes);
  const stabFreq = stabFrequency(teamTypes);
  const candidateStabRaw = attackingStabTypes(speciesTypes(speciesId));
  const candidateStab = candidateStabRaw.map((t) => t.toLowerCase());

  // ── (a) Next-boss urgency ────────────────────────────────────────────────
  // The boss whose map we're currently on (or about to enter) dominates our
  // immediate survival. Reward candidates that hit it super-effectively, and
  // *heavily* reward them when the team currently has nobody who does.
  // Decay quickly for boss maps further away.
  for (let m = mapIndex; m < BOSS_TYPES_BY_MAP.length && m < mapIndex + 4; m++) {
    const distance = m - mapIndex;
    const boss = BOSS_TYPES_BY_MAP[m]!;
    const lead = NEXT_BOSS_LEAD_TYPES[m] ?? boss;

    // Coverage gap: does the team already have a counter for this boss?
    const hasCounterAlready = teamHasCounterFor(teamTypes, lead);

    let hitsBoss = false;
    let hitsLead = false;
    for (const stab of candidateStab) {
      for (const bt of boss) {
        if (typeEffectiveness(stab, [bt]) >= 2) hitsBoss = true;
      }
      for (const lt of lead) {
        if (typeEffectiveness(stab, [lt]) >= 2) hitsLead = true;
      }
    }

    if (hitsLead && !hasCounterAlready) {
      // Team has *no* counter for this boss yet — major urgency.
      // Distance 0: 200 (this map's boss); 1: 110; 2: 50; 3: 25.
      const urgency = [200, 110, 50, 25][distance] ?? 0;
      score += urgency;
    } else if (hitsBoss) {
      // Team has someone, but more is welcome — and one counter is often not
      // enough (Misty 2HKOs a single Bulb L14). Diagnostic: Misty Run 1 lost
      // with Bulb L14 + Meowth/Tentacool/Cubone — the off-typing mons each
      // beat a 2nd Pikachu/Bellsprout in catch scoring because the bonus
      // here was only +40. Bumped to +120 for current-map boss so a 2nd SE
      // counter wins over generic high-BST carries.
      const bonus = [120, 50, 20, 8][distance] ?? 0;
      score += bonus;
    }

    // Penalty: if the candidate's STAB is *resisted* by every boss member
    // (≤0.5x to all) and the boss is in the next 2 maps, don't bring more
    // dead weight (e.g. Water against Misty).
    if (distance <= 1) {
      let allResisted = true;
      for (const stab of candidateStab) {
        for (const bt of boss) {
          if (typeEffectiveness(stab, [bt]) > 0.5) {
            allResisted = false;
            break;
          }
        }
        if (!allResisted) break;
      }
      if (allResisted) score -= distance === 0 ? 80 : 35;
    }
  }

  // ── (b) Duplicate STAB penalty ───────────────────────────────────────────
  // The 4th Water mon is far less valuable than the 1st. −30 per duplicate
  // STAB type the team already has 2+ copies of.
  //
  // Diagnostic from regression batch: Run 6 / Run 8 lost with 2-mon teams
  // of Bulbasaur+Bellsprout (both Grass/Poison — exact same STAB). The
  // mild −8 was nothing against Bellsprout's BST·√L of ~1050. When team
  // has ≤2 mons, a fully-redundant STAB catch is *bad* even if its raw BST
  // is high — apply a multiplicative cap so a non-redundant alternative
  // (any new type) wins.
  let allStabsAlreadyOnTeam = candidateStab.length > 0;
  for (const stab of candidateStab) {
    const dupes = stabFreq.get(stab) ?? 0;
    if (dupes >= 2) score -= 30 * (dupes - 1);
    else if (dupes === 1 && covered.has(stab)) score -= 8; // mild duplicate
    if ((stabFreq.get(stab) ?? 0) === 0) allStabsAlreadyOnTeam = false;
  }
  // Tiny teams (≤ 2 mons) need *type variance*, not more of the same.
  // teamTypes.length is the alive team size as passed by the caller.
  if (allStabsAlreadyOnTeam && teamTypes.length <= 2 && teamTypes.length > 0) {
    score *= 0.35;
  }

  // ── (c) Late-game carry bonus (Ice/Electric/Rock/Ghost STAB for Maps 6+) ─
  if (mapIndex >= 6) {
    for (const stab of candidateStab) {
      if (LATE_GAME_BONUS_TYPES.has(stab.charAt(0).toUpperCase() + stab.slice(1))) {
        score += 30;
        break;
      }
    }
  }

  // ── (d) Shiny bonus ──────────────────────────────────────────────────────
  if (isShiny && finalBst >= 400) score += 30;
  else if (isShiny) score += 10;

  // ── (e) Boss-imminent deadweight multiplier ─────────────────────────────
  // The additive ±200 in (a) is dwarfed by `BST × √level` for late-game
  // carries (Tauros L14 final BST 490 × 3.7 ≈ 1810). Diagnostic: Misty Run
  // 12 lost with Bulb + Pidgeotto + 2 Tauros — Tauros's massive BST score
  // beat every Pikachu/Bellsprout offered. Scale catches that don't help
  // the *current* map's boss multiplicatively so a counter-mon wins even
  // if its raw BST is half. Only applies when there's no team counter yet
  // (otherwise Tauros is fine — Bulbasaur already covers Misty).
  const currentBoss = BOSS_TYPES_BY_MAP[mapIndex];
  if (currentBoss && currentBoss.length > 0) {
    let candidateHitsBossSE = false;
    for (const stab of candidateStab) {
      for (const bt of currentBoss) {
        if (typeEffectiveness(stab, [bt]) >= 2) {
          candidateHitsBossSE = true;
          break;
        }
      }
      if (candidateHitsBossSE) break;
    }
    const teamCounter = teamHasCounterFor(teamTypes, currentBoss);
    if (!candidateHitsBossSE) {
      // No SE vs current boss = doesn't help the fight that ends the run.
      // 0.45x when team has no counter (urgent), 0.75x when covered.
      score *= teamCounter ? 0.75 : 0.45;
    }
  }

  return score;
}
