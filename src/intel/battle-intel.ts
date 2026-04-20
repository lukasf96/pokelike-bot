/**
 * Matchup intel derived from pokelike-source-files (game.js TRAINER_BATTLE_CONFIG,
 * data.js GYM_LEADERS / ELITE_4, getCatchChoices / MAP_BST_RANGES).
 */

import { catchBucketIdsForMap, LEGENDARY_SPECIES_IDS, maxLevelForMap } from "./catch-pool.js";
import { TYPE_CHART } from "../data/type-chart.js";
import { GEN1_SPECIES_TYPES } from "../data/gen1-species.js";
import { minLevelForSpecies } from "../data/gen1-min-level.js";
import { ELITE_ROSTERS, GYM_ROSTERS } from "../data/gym-elite-rosters.js";

/**
 * Lead level + roster max level for the upcoming boss (gym for currentMap≤7,
 * elite for currentMap=8). Used by Grind Mode to detect when the team is
 * dangerously under-levelled and we should detour into trainer/wild fights.
 */
export function bossLevelStats(
  currentMap: number,
  eliteIndex: number,
): { leadLevel: number; maxLevel: number } {
  if (currentMap >= 8) {
    const idx = Math.min(Math.max(0, eliteIndex), ELITE_ROSTERS.length - 1);
    const team = ELITE_ROSTERS[idx]?.team ?? [];
    if (team.length === 0) return { leadLevel: 50, maxLevel: 60 };
    const lead = team[0]!.level;
    let mx = lead;
    for (const s of team) if (s.level > mx) mx = s.level;
    return { leadLevel: lead, maxLevel: mx };
  }
  const idx = Math.min(Math.max(0, currentMap), GYM_ROSTERS.length - 1);
  const team = GYM_ROSTERS[idx]?.team ?? [];
  if (team.length === 0) return { leadLevel: 10, maxLevel: 12 };
  const lead = team[0]!.level;
  let mx = lead;
  for (const s of team) if (s.level > mx) mx = s.level;
  return { leadLevel: lead, maxLevel: mx };
}

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
  ["bugcatcher", [10, 11, 12, 13, 14, 15, 46, 47, 48, 49, 123, 127]],
  ["hiker", [27, 28, 50, 51, 66, 67, 68, 74, 75, 76, 95, 111, 112]],
  ["fisher", [54, 55, 60, 61, 62, 72, 73, 86, 87, 90, 91, 98, 99, 116, 117, 118, 119, 129, 130]],
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
  [
    ["Ghost", "Poison"],
    ["Poison", "Flying"],
    ["Ghost", "Poison"],
    ["Poison", "Flying"],
    ["Ghost", "Poison"],
  ],
  [["Water", "Flying"], ["Dragon", "Flying"], ["Dragon"], ["Dragon"], ["Dragon", "Flying"]],
  [["Normal", "Flying"], ["Psychic"], ["Ground", "Rock"], ["Grass", "Psychic"], ["Fire", "Flying"]],
];

export interface TeamMemberBrief {
  types: string[];
  /** Optional — when present, used to demote fainted members in lead ordering. */
  isFainted?: boolean;
  /** Optional — used as a tie-break in lead ordering so under-levelled good-typing mons don't lead. */
  level?: number;
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
  return pBattle * 1 + pTrainer * 1 + pCatch * 4 + (pItem + pMega) * 3 + pShiny * 3;
}

export function inferNodeIntel(hrefRaw: string, context: IntelContext): NodeIntel {
  const href = decodeURIComponent(hrefRaw.split("?")[0] ?? "").trim();
  const m = href.match(/([^/]+)\.(png|gif)$/i);
  const stemRaw = (m?.[1] ?? "").replace(/%20/g, " ");
  const stem = stemRaw.toLowerCase();

  if (href.includes("legendaryEncounter")) return { category: "legendary" };
  if (href.includes("grass.png") || stem === "grass")
    return { category: "wild", mapIndex: context.currentMap };
  if (stem === "champ") return { category: "elite", eliteIndex: context.eliteIndex };

  if (stem === "acetrainer" || stem === "oldguy") {
    return { category: "dynamic_trainer", mapIndex: context.currentMap };
  }

  for (const key of TRAINER_SPECIES_POOL.keys()) {
    if (stem === key.toLowerCase()) return { category: "trainer", key };
  }

  const gymStems = new Set([
    "brock",
    "misty",
    "erika",
    "koga",
    "sabrina",
    "blaine",
    "giovanni",
    "lt. surge",
  ]);
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
      // For gym fights the lead does need to handle the boss's first mon, but
      // it also has to survive long enough to soften the rest. We weight the
      // first mon double and include the full roster (game.js iterates the
      // whole gym team in order). Sorting by *expected* matchup over this
      // pool produces a lead that fights well throughout the fight.
      const mi = Math.min(Math.max(0, intel.mapIndex), GYM_TEAM_TYPES.length - 1);
      const team = GYM_TEAM_TYPES[mi] ?? [];
      const leadFirst = GYM_FIRST_LEAD_TYPES[mi] ?? team[0] ?? ["Normal"];
      if (team.length === 0) return [leadFirst];
      return [leadFirst, ...team];
    }
    case "elite": {
      const ei = Math.min(Math.max(0, intel.eliteIndex), ELITE_TEAM_TYPES.length - 1);
      const team = ELITE_TEAM_TYPES[ei] ?? [];
      const lead = team[0] ?? ["Normal"];
      if (team.length === 0) return [lead];
      // Weight the lead double — it determines the opener exchange.
      return [lead, ...team];
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
  // Fainted Pokémon would be auto-skipped by the engine on send-out, wasting
  // initiative. Push them firmly to the back of the order.
  if (p.isFainted) return -1e8;
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
  // Tiny level term: favour higher-level mons among same-typing ties so we
  // don't lead a Lv8 Pikachu into a Lv20 Starmie when a Lv13 backup exists.
  const levelTerm = (p.level ?? 0) * 0.05;
  return bestOff * 6 - worstDef * 3 + levelTerm;
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
export function computeTeamOrderForQuestionMark(
  team: TeamMemberBrief[],
  context: IntelContext,
): number[] {
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

export interface ScoreCandidateContext extends IntelContext {
  /** Team HP ratio in [0,1]; used together with `bossImminent` for PC urgency. */
  hpRatio: number;
  /** True when at least one candidate on this layer is the boss (we're 1 click from it). */
  bossImminent: boolean;
  /** True when at least one candidate on this layer is a Pokemon Center (likely layer 7). */
  pcAvailable: boolean;
  /** Monte-Carlo win probability against the upcoming boss with current team. */
  pWinBoss: number;
  /** Highest level of any non-fainted team member (defaults to a high value when missing). */
  teamMaxLevel?: number;
  /** Sum of non-fainted team members (defaults to 6 when missing). */
  aliveTeamSize?: number;
  /** Number of fainted team members (drives forced PC priority). */
  faintedCount?: number;
  /** Boss lead-mon level (e.g. Brock=12, Misty=18). */
  bossLeadLevel?: number;
  /** Boss roster max level (e.g. Brock=14, Misty=20). */
  bossMaxLevel?: number;
  /** True when ≥1 team member's STAB hits the *current* map's boss SE. */
  teamHasBossCounter?: boolean;
}

export function scoreCandidate(
  lowHp: boolean,
  cand: MapCandidateBrief,
  team: TeamMemberBrief[],
  context: IntelContext | ScoreCandidateContext,
): number {
  // Boss-adjacency / PC-availability / pWinBoss live on ScoreCandidateContext —
  // older callers (tests, etc.) get the conservative defaults so behaviour
  // outside the map handler is unchanged.
  const ctx = context as Partial<ScoreCandidateContext>;
  const hpRatio = typeof ctx.hpRatio === "number" ? ctx.hpRatio : 1;
  const bossImminent = ctx.bossImminent === true;
  const pcAvailable = ctx.pcAvailable === true;
  const pWinBoss = typeof ctx.pWinBoss === "number" ? ctx.pWinBoss : 1;
  const teamMaxLevel = typeof ctx.teamMaxLevel === "number" ? ctx.teamMaxLevel : 100;
  const aliveTeamSize = typeof ctx.aliveTeamSize === "number" ? ctx.aliveTeamSize : team.length;
  const faintedCount = typeof ctx.faintedCount === "number" ? ctx.faintedCount : 0;
  const bossLeadLevel = typeof ctx.bossLeadLevel === "number" ? ctx.bossLeadLevel : 10;
  const bossMaxLevel = typeof ctx.bossMaxLevel === "number" ? ctx.bossMaxLevel : bossLeadLevel + 2;
  const teamHasBossCounter = ctx.teamHasBossCounter === true;

  // Pre-boss urgency mode (boss reachable in 1–2 layers): the Pokemon Center
  // layer is the *last* heal — refusing it routinely costs the run.
  const bossUrgency = bossImminent || (pcAvailable && hpRatio < 0.95);
  const bossWinShaky = pWinBoss < 0.6;

  // ── Grind Mode ──────────────────────────────────────────────────────────
  // Empirically, the dominant cause of boss losses (Brock and Misty alike)
  // is walking into the boss several levels under-levelled. Diagnostic from
  // last 15 runs: Bulbasaur entered Brock at L6–10 (boss has Onix L14), and
  // Misty at L11–14 (boss has Starmie L20). When the team's strongest mon
  // is multiple levels below the boss's strongest mon, route into trainer/
  // wild XP nodes hard and skip catches/items unless they fix that gap.
  const levelGap = bossMaxLevel - teamMaxLevel;
  const grindMode = levelGap >= 3 || (bossWinShaky && !bossImminent);
  const desperateGrind = levelGap >= 6 || pWinBoss < 0.35;
  const teamSaturated = aliveTeamSize >= 6;
  // ── Tiny-Team Mode ──────────────────────────────────────────────────────
  // Grind Mode without bodies isn't grinding, it's a 1-mon suicide run. If
  // Bulbasaur faints, the run ends; we need *type variance* before we
  // start farming XP. These overrides win against Grind Mode below.
  //   • aliveTeamSize ≤ 2: any catch is gold, even off-typing.
  //   • aliveTeamSize ≤ 3: catches still preferred over deep grinding.
  //
  // Diagnostic from regression batch: setting buildingTeam to ===3 made the
  // bot lose 5/12 runs at teamMaxLevel ≤ 7 because it walked L4-5 mons into
  // trainers. Keep ≤3 so we never push grinding before we have at least 4
  // bodies AND some type variance.
  // ── Weak-Team Mode ─────────────────────────────────────────────────────
  // Independent of team size: at very low max levels, even high-pWin trainer
  // fights blow up from RNG (one crit ends our lead). We won't actually
  // refuse them here (handled in adjustMapScoreWithWinProbability) — but we
  // do want PC seeking and catches to dominate map choice.
  const tinyTeam = aliveTeamSize <= 2;
  const buildingTeam = aliveTeamSize <= 3;
  const weakTeam = teamMaxLevel < 8;
  // Must-grind-counter: we already have a SE counter on the team but it's
  // ≥5 levels below the boss's strongest mon. More catches won't save us —
  // we need to LEVEL the counter or it gets OHKO'd. Diagnostic from Run 14
  // (and 5/16 of last batch): bot reached Brock with 5 mons all L4-5 because
  // tinyTeam catch=30 always beat battle=3-6 even when Bulbasaur was already
  // on the team. Override that default at small team sizes.
  const mustGrindCounter = teamHasBossCounter && bossMaxLevel - teamMaxLevel >= 5;

  let base = 1;

  if (cand.surfaceKind === "legendary") base = 8;
  else if (cand.surfaceKind === "pokecenter") {
    // PC is *the* clutch resource. Be much more eager:
    //   • boss-imminent + HP<95% → emergency heal (60).
    //   • Any fainted member → max-revive doesn't drop in until Map 9, so
    //     PC is the only restore. Diagnostic: Run 4 entered Ace Trainer at
    //     11% HP with 4 fainted and lost. Force PC seek (40) regardless of
    //     whether the boss is imminent.
    //   • mid-run HP<80% → strongly prefer (12).
    //   • mid-run HP<95% with PC available → mild prefer (4).
    if (bossUrgency && hpRatio < 0.95) base = 60;
    else if (faintedCount >= 2) base = 45;
    else if (faintedCount >= 1 && hpRatio < 0.7) base = 35;
    else if (faintedCount >= 1) base = 22;
    else if (lowHp) base = 14;
    else if (hpRatio < 0.8) base = 12;
    else if (hpRatio < 0.95) base = 4;
    else base = -2;
  } else if (cand.surfaceKind === "catch") {
    // Catch base reflects three competing forces:
    //   • Tiny team: must build type coverage NOW (Bulbasaur alone = run loss
    //     to anything that resists Grass/Poison or 2HKOs through bulk).
    //   • Coverage urgency: catch-intel scorer adds enemyTypings adjustment
    //     in `bonus` below, so this is the "default value of any catch slot".
    //   • Saturation: once full of viable mons, a fresh L5 mon replacing a
    //     levelled one is a net XP loss — drop sharply.
    // Solo (alive=1): catching the SECOND body always wins. One crit = run
    // over with a single carry, and the previous patch's mustGrindCounter
    // override (catch=8 vs battle=14) caused 8/13 last-batch runs to die
    // as a solo Bulbasaur. mustGrindCounter only kicks in at alive ≥ 2.
    if (aliveTeamSize <= 1) base = 30;
    else if (tinyTeam && mustGrindCounter)
      base = 14; // alive=2: split focus
    else if (tinyTeam) base = 30;
    else if (buildingTeam && mustGrindCounter) base = 5;
    else if (buildingTeam)
      base = 12; // Build coverage before grinding
    else if (bossImminent) base = -3;
    else if (teamSaturated && !desperateGrind) base = grindMode ? -2 : 1;
    else if (grindMode)
      base = 1; // grinding XP > catching for cap closing
    else base = 4;
  } else if (cand.surfaceKind === "item" || cand.surfaceKind === "move_tutor") {
    base = grindMode ? 2 : 3;
  } else if (cand.surfaceKind === "question") base = expectedQuestionMarkSurfaceBase();
  else if (
    cand.surfaceKind === "battle" ||
    cand.surfaceKind === "trainer" ||
    cand.surfaceKind === "gym" ||
    cand.surfaceKind === "elite"
  ) {
    // Trainer fights are the only +2 XP source pre-Map 4 and are by far the
    // best lever to close the boss level gap. Wild battles give +1 XP and
    // are still better than catch when we're full.
    //
    // Tiny-team override: cap battle/trainer scoring so a parallel catch
    // node always wins. Even Grind Mode is meaningless with a 1-mon team —
    // one bad RNG roll ends the run.
    if (cand.surfaceKind === "trainer") {
      // Solo: NEVER preferred over a catch (catch=30, this stays low). At
      // alive=2 with mustGrindCounter we still want grinding to be viable
      // (base 16 ≈ catch 14) — but strictly less than catch.
      if (aliveTeamSize <= 1) base = 4;
      else if (tinyTeam && mustGrindCounter) base = 16;
      else if (tinyTeam) base = 4;
      else if (buildingTeam && mustGrindCounter) base = 28;
      else if (buildingTeam)
        base = 10; // Catch slightly favoured at ≤3 mons
      else if (weakTeam)
        base = 26; // L<8 team with bodies: GRIND
      else if (desperateGrind) base = 35;
      else if (grindMode) base = 22;
      else if (bossWinShaky && !bossImminent) base = 8;
      else base = 2;
    } else if (cand.surfaceKind === "battle") {
      if (aliveTeamSize <= 1) base = 3;
      else if (tinyTeam && mustGrindCounter) base = 12;
      else if (tinyTeam) base = 3;
      else if (buildingTeam && mustGrindCounter) base = 18;
      else if (buildingTeam) base = 6;
      else if (weakTeam) base = 16;
      else if (desperateGrind) base = 14;
      else if (grindMode) base = 9;
      else base = 2;
    } else {
      // gym / elite — keep at 1 so they don't drown out PC/trainer scoring
      // in scoreCandidate; the actual decision to engage is forced by the
      // map graph (you must clear the boss to advance).
      base = 1;
    }
  } else if (cand.surfaceKind === "trade") base = 1;

  const intel = inferNodeIntel(cand.href, context);
  const typings =
    intel.category === "neutral" &&
    (cand.surfaceKind === "battle" ||
      cand.surfaceKind === "trainer" ||
      cand.surfaceKind === "gym" ||
      cand.surfaceKind === "elite" ||
      cand.surfaceKind === "unknown")
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

  // When we MUST grind (counter exists but is under-leveled, or weak team),
  // soften negative typing penalties for battle/trainer/wild nodes — pWin
  // already gates suicide fights, but a −10 matchup penalty on Bulbasaur
  // vs Map-1 Caterpie/Pidgey shouldn't make us skip a 100% pWin trainer.
  // Diagnostic: Run 14 t10 had trainer=−4.42 / battle=−1.61 with pWin=1.0
  // because matchupAdjustment returned −10 — so we lost a perfect grind.
  if (
    bonus < 0 &&
    (mustGrindCounter || weakTeam || desperateGrind) &&
    (cand.surfaceKind === "battle" || cand.surfaceKind === "trainer")
  ) {
    bonus *= 0.25;
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
  if (intel.category === "wild" || intel.category === "dynamic_trainer")
    return enemyTypings.length > 0;
  if (intel.category === "trainer" && enemyTypings.length > 0) return true;
  return false;
}
