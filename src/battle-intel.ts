/**
 * Matchup intel derived from pokelike-source-files (game.js TRAINER_BATTLE_CONFIG,
 * data.js GYM_LEADERS / ELITE_4).
 *
 * Species typings mirror `fetchPokemonById` (PokeAPI) via static GEN1_SPECIES_TYPES.
 * Effectiveness uses PokeAPI-derived TYPE_CHART (same source as modern typings).
 */

import { TYPE_CHART } from "./data/type-chart.js";
import { GEN1_SPECIES_TYPES } from "./data/gen1-species.js";

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

// game.js TRAINER_BATTLE_CONFIG — keys must match map.js TRAINER_SPRITE_KEYS / filename stems
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

/** First Pokémon’s types per gym (data.js GYM_LEADERS order). */
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

/** Full gym teams’ types for matchup scoring (data.js). */
const GYM_TEAM_TYPES: string[][][] = [
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

/** Elite Four + Champion — teams in order (data.js ELITE_4). */
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
  | { category: "wild" }
  | { category: "trainer"; key: string }
  | { category: "gym"; mapIndex: number }
  | { category: "elite"; eliteIndex: number }
  | { category: "neutral" };

function poolSpeciesTypes(ids: number[]): string[][] {
  return ids.map((id) => typesForSpeciesId(id));
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

export function inferNodeIntel(hrefRaw: string, context: { currentMap: number; eliteIndex: number }): NodeIntel {
  const href = decodeURIComponent(hrefRaw.split("?")[0] ?? "").trim();
  const m = href.match(/([^/]+)\.(png|gif)$/i);
  const stemRaw = (m?.[1] ?? "").replace(/%20/g, " ");
  const stem = stemRaw.toLowerCase();

  if (href.includes("grass.png") || stem === "grass") return { category: "wild" };
  if (stem === "champ") return { category: "elite", eliteIndex: context.eliteIndex };

  for (const key of TRAINER_SPECIES_POOL.keys()) {
    if (stem === key.toLowerCase()) return { category: "trainer", key };
  }

  const gymStems = new Set(["brock", "misty", "erika", "koga", "sabrina", "blaine", "giovanni", "lt. surge"]);
  if (gymStems.has(stem)) return { category: "gym", mapIndex: context.currentMap };

  return { category: "neutral" };
}

export function enemyTypingsForIntel(intel: NodeIntel): string[][] {
  switch (intel.category) {
    case "wild":
      return [];
    case "trainer": {
      const ids = TRAINER_SPECIES_POOL.get(intel.key);
      return ids ? poolSpeciesTypes(ids) : [];
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

/** Lead Pokémon we expect to face first (slot 0). */
export function leadEnemyTypesForIntel(intel: NodeIntel): string[] {
  switch (intel.category) {
    case "gym": {
      const mi = Math.min(Math.max(0, intel.mapIndex), GYM_FIRST_LEAD_TYPES.length - 1);
      return GYM_FIRST_LEAD_TYPES[mi] ?? ["Normal"];
    }
    case "elite": {
      const ei = Math.min(Math.max(0, intel.eliteIndex), ELITE_TEAM_TYPES.length - 1);
      const team = ELITE_TEAM_TYPES[ei];
      return team?.[0] ?? ["Normal"];
    }
    case "trainer": {
      const ids = TRAINER_SPECIES_POOL.get(intel.key);
      if (!ids?.length) return ["Normal"];
      return typesForSpeciesId(ids[0]);
    }
    default:
      return ["Normal"];
  }
}

/** Sort old indices so the best lead is index 0 (first alive in battle). */
export function computeTeamOrder(team: TeamMemberBrief[], leadEnemyTypes: string[]): number[] {
  const n = team.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  function leadScore(idx: number): number {
    const p = team[idx];
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

  indices.sort((a, b) => leadScore(b) - leadScore(a));
  return indices;
}

export interface MapCandidateBrief {
  href: string;
  /** Detected kind before inferNodeIntel (grass, catch, …). */
  surfaceKind: string;
}

export function scoreCandidate(
  lowHp: boolean,
  cand: MapCandidateBrief,
  team: TeamMemberBrief[],
  context: { currentMap: number; eliteIndex: number },
): number {
  let base = 1;

  if (cand.surfaceKind === "legendary") base = 8;
  else if (cand.surfaceKind === "pokecenter") base = lowHp ? 10 : -2;
  else if (cand.surfaceKind === "catch") base = 4;
  else if (cand.surfaceKind === "item" || cand.surfaceKind === "move_tutor") base = 3;
  else if (cand.surfaceKind === "question") base = 2;
  else if (cand.surfaceKind === "battle") base = 1;
  else if (cand.surfaceKind === "trade") base = 1;

  const intel = inferNodeIntel(cand.href, context);
  const typings =
    intel.category === "neutral" && (cand.surfaceKind === "battle" || cand.surfaceKind === "unknown")
      ? []
      : enemyTypingsForIntel(intel);

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
  context: { currentMap: number; eliteIndex: number },
): { intel: NodeIntel; leadEnemyTypes: string[]; enemyTypings: string[][] } {
  const intel = inferNodeIntel(chosen.href, context);
  return {
    intel,
    leadEnemyTypes: leadEnemyTypesForIntel(intel),
    enemyTypings: enemyTypingsForIntel(intel),
  };
}

export function shouldReorderForBattle(intel: NodeIntel, enemyTypings: string[][]): boolean {
  if (intel.category === "gym" || intel.category === "elite") return true;
  if (intel.category === "trainer" && enemyTypings.length > 0) return true;
  return false;
}