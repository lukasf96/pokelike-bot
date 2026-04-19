/**
 * Matchup intel derived from pokelike-source-files (game.js TRAINER_BATTLE_CONFIG,
 * data.js GYM_LEADERS / ELITE_4, getCatchChoices / MAP_BST_RANGES).
 */

import { catchBucketIdsForMap, LEGENDARY_SPECIES_IDS, maxLevelForMap } from "./catch-pool.js";
import { TYPE_CHART } from "./data/type-chart.js";
import { GEN1_SPECIES_TYPES } from "./data/gen1-species.js";
import { minLevelForSpecies } from "./data/gen1-min-level.js";

function typesForSpeciesId(id: number): string[] {
  return GEN1_SPECIES_TYPES[id] ?? ["Normal"];
}

function capType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function typeEffectiveness(attackType: string, defenderTypes: string[]): number {
  let mult = 1;
  const row = TYPE_CHART[capType(attackType)];
  if (!row) return 1;
  for (const dt of defenderTypes) {
    const d = capType(dt);
    const v = row[d];
    if (v !== undefined) mult *= v;
  }
  return mult;
}

/** Mirrors getBestMove(): prefer non-Normal STAB when dual-typed. */
export function attackingStabTypes(types: string[]): string[] {
  if (types.length === 0) return ["Normal"];
  if (types.length === 1) return types;
  const nonNorm = types.filter((t) => t.toLowerCase() !== "normal");
  return nonNorm.length > 0 ? nonNorm : types;
}

const TRAINER_SPECIES_POOL: Map<string, number[]> = new Map([
  [
    "bugcatcher",
    [10, 11, 12, 13, 14, 15, 46, 47, 48, 49, 123, 127],
  ],
  ["hiker", [27, 28, 50, 51, 66, 67, 68, 74, 75, 76, 95, 111, 112]],
  [
    "fisher",
    [54, 55, 60, 61, 62, 72, 73, 86, 87, 90, 91, 98, 99, 116, 117, 118, 119, 129, 130],
  ],
  ["scientist", [81, 82, 88, 89, 92, 93, 94, 100, 101, 137]],
  ["teamrocket", [19, 20, 23, 24, 41, 42, 52, 53, 88, 89, 109, 110]],
  ["policeman", [58, 59]],
  ["firespitter", [4, 5, 6, 37, 38, 58, 59, 77, 78, 126, 136]],
]);

const GYM_FIRST_LEAD_TYPES: string[][] = [
  ["Rock", "Ground"],
  ["Water"],
  ["Electric"],
  ["Grass"],
  ["Poison"],
  ["Psychic"],
  ["Fire"],
  ["Ground"],
];

/** Gym roster typings per map index (0..7); used by map scoring and catch intel. */
export const GYM_TEAM_TYPES: string[][][] = [
  [
    ["Rock", "Ground"],
    ["Rock", "Ground"],
  ],
  [["Water"], ["Water", "Psychic"]],
  [["Electric"], ["Electric"], ["Electric"]],
  [["Grass"], ["Grass", "Poison"], ["Grass", "Poison"]],
  [["Poison"], ["Poison"], ["Poison"], ["Poison"]],
  [["Psychic"], ["Bug", "Poison"], ["Psychic"], ["Psychic"]],
  [["Fire"], ["Fire"], ["Fire"], ["Fire"]],
  [["Ground"], ["Poison", "Ground"], ["Poison", "Ground"], ["Ground", "Rock"], ["Ground", "Rock"]],
];

const ELITE_TEAM_TYPES: string[][][] = [
  [
    ["Water", "Ice"],
    ["Water", "Ice"],
    ["Water", "Psychic"],
    ["Ice", "Psychic"],
    ["Water", "Ice"],
  ],
  [["Rock", "Ground"], ["Fighting"], ["Fighting"], ["Rock", "Ground"], ["Fighting"]],
  [["Ghost", "Poison"], ["Poison", "Flying"], ["Ghost", "Poison"], ["Poison", "Flying"], ["Ghost", "Poison"]],
  [["Water", "Flying"], ["Dragon", "Flying"], ["Dragon"], ["Dragon"], ["Dragon", "Flying"]],
  [["Normal", "Flying"], ["Psychic"], ["Ground", "Rock"], ["Grass", "Psychic"], ["Fire", "Flying"]],
];

export interface TeamMemberBrief {
  types: string[];
}

export type NodeIntel =
  | { category: "wild"; mapIndex: number }
  | { category: "legendary" }
  | { category: "trainer"; key: string }
  | { category: "dynamic_trainer"; mapIndex: number }
  | { category: "gym"; mapIndex: number }
  | { category: "elite"; eliteIndex: number }
  | { category: "neutral" };

export interface IntelContext {
  currentMap: number;
  eliteIndex: number;
}

function poolSpeciesTypes(ids: number[]): string[][] {
  return ids.map((id) => typesForSpeciesId(id));
}

export function eligibleTrainerSpeciesIds(key: string, currentMap: number): number[] {
  const raw = TRAINER_SPECIES_POOL.get(key);
  if (!raw || raw.length === 0) return [];
  const maxL = maxLevelForMap(currentMap);
  const uniq = [...new Set(raw)];
  const eligible = uniq.filter((id) => minLevelForSpecies(id) <= maxL);
  return eligible.length > 0 ? eligible : uniq;
}

function avgPlayerOffenseVsPool(team: TeamMemberBrief[], enemyTypings: string[][]): number {
  if (team.length === 0 || enemyTypings.length === 0) return 1;

  let sumMon = 0;
  for (const p of team) {
    const stab = attackingStabTypes(p.types);
    let sumEnemy = 0;
    for (const et of enemyTypings) {
      let best = 0;
      for (const st of stab) {
        best = Math.max(best, typeEffectiveness(st, et));
      }
      sumEnemy += best;
    }
    sumMon += sumEnemy / enemyTypings.length;
  }
  return sumMon / team.length;
}

export function avgEnemyPressureVsTeam(team: TeamMemberBrief[], enemyTypings: string[][]): number {
  if (team.length === 0 || enemyTypings.length === 0) return 1;

  let pressure = 0;
  let count = 0;
  for (const et of enemyTypings) {
    const estab = attackingStabTypes(et);
    let worst = 0;
    for (const p of team) {
      let bestAgainstThisMon = 0;
      for (const est of estab) {
        bestAgainstThisMon = Math.max(bestAgainstThisMon, typeEffectiveness(est, p.types));
      }
      worst = Math.max(worst, bestAgainstThisMon);
    }
    pressure += worst;
    count += 1;
  }
  return count ? pressure / count : 1;
}

export function matchupAdjustment(team: TeamMemberBrief[], enemyTypings: string[][]): number {
  if (enemyTypings.length === 0) return 0;
  const offense = avgPlayerOffenseVsPool(team, enemyTypings);
  const defensePressure = avgEnemyPressureVsTeam(team, enemyTypings);
  const spread = offense - defensePressure;
  return spread * 4;
}

/**
 * game.js resolveQuestionMark (non-Nuzlocke): outcome weights × same base scores as scoreCandidate.
 * Shiny branch uses hasShinyCharm upper bound — we assume no charm (conservative).
 * The "mega" branch resolves as an extra item roll (no mega Pokémon in v1.3.1), so fold into item weight.
 */
export function expectedQuestionMarkSurfaceBase(): number {
  const pBattle = 0.22;
  const pTrainer = 0.2;
  const pCatch = 0.1;
  const pItem = 0.13;
  const pShiny = 0.07;
  const pMega = 0.28;
  return (
    pBattle * 1 +
    pTrainer * 1 +
    pCatch * 4 +
    (pItem + pMega) * 3 +
    pShiny * 3
  );
}

export function inferNodeIntel(hrefRaw: string, context: IntelContext): NodeIntel {
  const href = decodeURIComponent(hrefRaw.split("?")[0] ?? "").trim();
  const m = href.match(/([^/]+)\.(png|gif)$/i);
  const stemRaw = (m?.[1] ?? "").replace(/%20/g, " ");
  const stem = stemRaw.toLowerCase();

  if (href.includes("legendaryEncounter")) return { category: "legendary" };
  if (href.includes("grass.png") || stem === "grass") return { category: "wild", mapIndex: context.currentMap };
  if (stem === "champ") return { category: "elite", eliteIndex: context.eliteIndex };

  if (stem === "acetrainer" || stem === "oldguy") {
    return { category: "dynamic_trainer", mapIndex: context.currentMap };
  }

  for (const key of TRAINER_SPECIES_POOL.keys()) {
    if (stem === key.toLowerCase()) return { category: "trainer", key };
  }

  const gymStems = new Set(["brock", "misty", "erika", "koga", "sabrina", "blaine", "giovanni", "lt. surge"]);
  if (gymStems.has(stem)) return { category: "gym", mapIndex: context.currentMap };

  return { category: "neutral" };
}

export function enemyTypingsForIntel(intel: NodeIntel, context: IntelContext): string[][] {
  switch (intel.category) {
    case "wild":
    case "dynamic_trainer":
      return poolSpeciesTypes(catchBucketIdsForMap(intel.mapIndex));
    case "legendary":
      return poolSpeciesTypes([...LEGENDARY_SPECIES_IDS]);
    case "trainer": {
      const ids = eligibleTrainerSpeciesIds(intel.key, context.currentMap);
      return ids.length > 0 ? poolSpeciesTypes(ids) : [];
    }
    case "gym": {
      const mi = Math.min(Math.max(0, intel.mapIndex), GYM_TEAM_TYPES.length - 1);
      return GYM_TEAM_TYPES[mi] ?? [];
    }
    case "elite": {
      const ei = Math.min(Math.max(0, intel.eliteIndex), ELITE_TEAM_TYPES.length - 1);
      return ELITE_TEAM_TYPES[ei] ?? [];
    }
    default:
      return [];
  }
}

export function leadTypingsPoolForIntel(intel: NodeIntel, context: IntelContext): string[][] {
  switch (intel.category) {
    case "gym": {
      const mi = Math.min(Math.max(0, intel.mapIndex), GYM_FIRST_LEAD_TYPES.length - 1);
      const t = GYM_FIRST_LEAD_TYPES[mi] ?? ["Normal"];
      return [t];
    }
    case "elite": {
      const ei = Math.min(Math.max(0, intel.eliteIndex), ELITE_TEAM_TYPES.length - 1);
      const team = ELITE_TEAM_TYPES[ei];
      const lead = team?.[0] ?? ["Normal"];
      return [lead];
    }
    case "legendary":
      return LEGENDARY_SPECIES_IDS.map((id) => typesForSpeciesId(id));
    case "wild":
    case "dynamic_trainer":
      return catchBucketIdsForMap(intel.mapIndex).map((id) => typesForSpeciesId(id));
    case "trainer": {
      const ids = eligibleTrainerSpeciesIds(intel.key, context.currentMap);
      return ids.map((id) => typesForSpeciesId(id));
    }
    default:
      return [];
  }
}

function leadScoreForTypes(p: TeamMemberBrief | undefined, leadEnemyTypes: string[]): number {
  if (!p) return -1e9;
  const stab = attackingStabTypes(p.types);
  let bestOff = 0;
  for (const st of stab) {
    bestOff = Math.max(bestOff, typeEffectiveness(st, leadEnemyTypes));
  }
  const est = attackingStabTypes(leadEnemyTypes);
  let worstDef = 0;
  for (const e of est) {
    worstDef = Math.max(worstDef, typeEffectiveness(e, p.types));
  }
  return bestOff * 6 - worstDef * 3;
}

/**
 * Expected lead matchup under uniform random lead typing (trainer shuffle / wild bucket / legendary pool).
 */
export function computeTeamOrder(team: TeamMemberBrief[], leadTypingsPool: string[][]): number[] {
  const n = team.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  if (leadTypingsPool.length === 0) {
    return indices;
  }

  function expectedLeadScore(idx: number): number {
    let sum = 0;
    for (const lt of leadTypingsPool) {
      sum += leadScoreForTypes(team[idx], lt);
    }
    return sum / leadTypingsPool.length;
  }

  indices.sort((a, b) => expectedLeadScore(b) - expectedLeadScore(a));
  return indices;
}

/** Matches resolveQuestionMark battle weights: wild vs dynamic trainer — expected lead matchup before rolling the outcome. */
export function computeTeamOrderForQuestionMark(team: TeamMemberBrief[], context: IntelContext): number[] {
  const n = team.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  const wildIntel: NodeIntel = { category: "wild", mapIndex: context.currentMap };
  const dynIntel: NodeIntel = { category: "dynamic_trainer", mapIndex: context.currentMap };
  const wildPool = leadTypingsPoolForIntel(wildIntel, context);
  const trainerPool = leadTypingsPoolForIntel(dynIntel, context);

  const pBattle = 0.22;
  const pTrainer = 0.2;
  const wSum = pBattle + pTrainer;

  function avgScoreOverPool(idx: number, pool: string[][]): number {
    if (pool.length === 0) return 0;
    let sum = 0;
    for (const lt of pool) {
      sum += leadScoreForTypes(team[idx], lt);
    }
    return sum / pool.length;
  }

  function expectedLeadScore(idx: number): number {
    const ew = wildPool.length > 0 ? (pBattle / wSum) * avgScoreOverPool(idx, wildPool) : 0;
    const et = trainerPool.length > 0 ? (pTrainer / wSum) * avgScoreOverPool(idx, trainerPool) : 0;
    return ew + et;
  }

  if (wildPool.length === 0 && trainerPool.length === 0) {
    return indices;
  }

  indices.sort((a, b) => expectedLeadScore(b) - expectedLeadScore(a));
  return indices;
}

export interface MapCandidateBrief {
  href: string;
  surfaceKind: string;
}

export function scoreCandidate(
  lowHp: boolean,
  cand: MapCandidateBrief,
  team: TeamMemberBrief[],
  context: IntelContext,
): number {
  let base = 1;

  if (cand.surfaceKind === "legendary") base = 8;
  else if (cand.surfaceKind === "pokecenter") base = lowHp ? 10 : -2;
  else if (cand.surfaceKind === "catch") base = 4;
  else if (cand.surfaceKind === "item" || cand.surfaceKind === "move_tutor") base = 3;
  else if (cand.surfaceKind === "question") base = expectedQuestionMarkSurfaceBase();
  else if (cand.surfaceKind === "battle") base = 1;
  else if (cand.surfaceKind === "trade") base = 1;

  const intel = inferNodeIntel(cand.href, context);
  const typings =
    intel.category === "neutral" && (cand.surfaceKind === "battle" || cand.surfaceKind === "unknown")
      ? []
      : enemyTypingsForIntel(intel, context);

  let bonus = typings.length ? matchupAdjustment(team, typings) : 0;

  if (intel.category === "trainer" && typings.length) {
    const spreadTypes = new Set(typings.flat());
    const teamTypes = new Set(team.flatMap((t) => t.types.map((x) => x.toLowerCase())));
    const onlyFireDefense = spreadTypes.has("Fire") && [...spreadTypes].every((t) => t === "Fire");
    if (onlyFireDefense && [...teamTypes].every((t) => t === "fire")) {
      bonus -= 5;
    }
  }

  if (cand.surfaceKind === "pokecenter" && !lowHp) {
    bonus = 0;
  }

  return base + bonus;
}

export function pickBattlePrepIntel(
  chosen: MapCandidateBrief,
  context: IntelContext,
): { intel: NodeIntel; leadTypingsPool: string[][]; enemyTypings: string[][] } {
  const intel = inferNodeIntel(chosen.href, context);
  return {
    intel,
    leadTypingsPool: leadTypingsPoolForIntel(intel, context),
    enemyTypings: enemyTypingsForIntel(intel, context),
  };
}

export function shouldReorderForBattle(
  surfaceKind: string,
  intel: NodeIntel,
  enemyTypings: string[][],
): boolean {
  if (surfaceKind === "question") return true;
  if (intel.category === "gym" || intel.category === "elite") return true;
  if (intel.category === "legendary") return enemyTypings.length > 0;
  if (intel.category === "wild" || intel.category === "dynamic_trainer") return enemyTypings.length > 0;
  if (intel.category === "trainer" && enemyTypings.length > 0) return true;
  return false;
}
