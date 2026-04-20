/**
 * Monte Carlo win-rate estimate (A5) — mirrors game enemy construction + battle-sim.runBattle.
 */

import { LEGENDARY_SPECIES_IDS, catchBucketIdsForMap, getMapLevelRange } from "../intel/catch-pool.js";
import { GEN1_BASE_STATS, type Gen1BaseStatsRow } from "../data/gen1-base-stats.js";
import { ELITE_ROSTERS, GYM_ROSTERS, type BossSlotDef } from "../data/gym-elite-rosters.js";
import { GEN1_SPECIES_TYPES } from "../data/gen1-species.js";
import { type NodeIntel, eligibleTrainerSpeciesIds } from "../intel/battle-intel.js";
import { calcHp, getMoveTierForMap, runBattle, type SimPokemon } from "./battle-sim.js";

const DEFAULT_SAMPLES = 56;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** game.js getLevelForNode — layer unknown on map screen; randomize difficulty within band. */
function sampleNodeLevel(mapIndex: number, rng: () => number): number {
  const [minL, maxL] = getMapLevelRange(mapIndex);
  const t = rng();
  const base = Math.round(minL + t * (maxL - minL));
  const spread = Math.max(1, Math.round((maxL - minL) / 8));
  return Math.min(maxL, Math.max(minL, base + Math.floor(rng() * spread)));
}

function wildBattleLevel(mapIndex: number, rng: () => number): number {
  const raw = sampleNodeLevel(mapIndex, rng);
  return mapIndex >= 1 ? Math.max(1, raw - 1) : raw;
}

function trainerTeamSize(mapIndex: number): number {
  if (mapIndex === 0) return 1;
  if (mapIndex <= 2) return 2;
  return 3;
}

function speciesFromRow(
  speciesId: number,
  level: number,
  moveTier: number,
  heldItemId: string | null,
): SimPokemon {
  const row = GEN1_BASE_STATS[speciesId];
  const types = GEN1_SPECIES_TYPES[speciesId] ?? ["Normal"];
  if (!row) {
    const hp = 50;
    const mx = calcHp(hp, level);
    return {
      speciesId,
      name: `Species${speciesId}`,
      level,
      currentHp: mx,
      maxHp: mx,
      types: [...types],
      baseStats: { hp, atk: 50, def: 50, special: 50, spdef: 50, speed: 50 },
      heldItem: heldItemId ? { id: heldItemId } : null,
      moveTier,
    };
  }
  const baseStats: Gen1BaseStatsRow = { ...row };
  const mx = calcHp(baseStats.hp, level);
  return {
    speciesId,
    name: `Species${speciesId}`,
    level,
    currentHp: mx,
    maxHp: mx,
    types: [...types],
    baseStats,
    heldItem: heldItemId ? { id: heldItemId } : null,
    moveTier,
  };
}

function buildGymEnemyTeam(mapIndex: number): SimPokemon[] {
  const idx = Math.min(Math.max(0, mapIndex), GYM_ROSTERS.length - 1);
  const gym = GYM_ROSTERS[idx]!;
  return gym.team.map((slot) =>
    speciesFromRow(slot.speciesId, slot.level, gym.moveTier, slot.heldItemId),
  );
}

function buildEliteEnemyTeam(eliteIndex: number): SimPokemon[] {
  const idx = Math.min(Math.max(0, eliteIndex), ELITE_ROSTERS.length - 1);
  const roster = ELITE_ROSTERS[idx]!;
  return roster.team.map((slot: BossSlotDef) =>
    speciesFromRow(slot.speciesId, slot.level, 2, slot.heldItemId),
  );
}

function sampleTrainerEnemyTeam(mapIndex: number, trainerKey: string, rng: () => number): SimPokemon[] {
  const level = sampleNodeLevel(mapIndex, rng);
  const moveTier = getMoveTierForMap(mapIndex);
  const size = trainerTeamSize(mapIndex);
  let ids = eligibleTrainerSpeciesIds(trainerKey, mapIndex);
  if (ids.length === 0) return [];
  ids = [...ids];
  shuffleInPlace(ids, rng);
  const picks: number[] = [];
  for (let i = 0; i < size; i++) picks.push(ids[i % ids.length]!);
  return picks.map((id) => speciesFromRow(id, level, moveTier, null));
}

function sampleWildEnemyTripleThenPick(mapIndex: number, rng: () => number): SimPokemon[] {
  const bucket = catchBucketIdsForMap(mapIndex);
  if (bucket.length === 0) return [];
  const copy = [...bucket];
  shuffleInPlace(copy, rng);
  const triple = copy.slice(0, Math.min(3, copy.length));
  const pick = triple[Math.floor(rng() * triple.length)]!;
  const level = wildBattleLevel(mapIndex, rng);
  const moveTier = getMoveTierForMap(mapIndex);
  return [speciesFromRow(pick, level, moveTier, null)];
}

function sampleDynamicTrainerEnemyTeam(mapIndex: number, rng: () => number): SimPokemon[] {
  const bucket = catchBucketIdsForMap(mapIndex);
  if (bucket.length === 0) return [];
  const level = sampleNodeLevel(mapIndex, rng);
  const moveTier = getMoveTierForMap(mapIndex);
  const size = trainerTeamSize(mapIndex);
  const copy = [...bucket];
  shuffleInPlace(copy, rng);
  const picks: number[] = [];
  for (let i = 0; i < size; i++) picks.push(copy[i % copy.length]!);
  return picks.map((id) => speciesFromRow(id, level, moveTier, null));
}

function sampleLegendaryEnemy(
  mapIndex: number,
  rng: () => number,
  blocked: ReadonlySet<number>,
): SimPokemon[] {
  const avail = LEGENDARY_SPECIES_IDS.filter((id) => !blocked.has(id));
  if (avail.length === 0) return [];
  const id = avail[Math.floor(rng() * avail.length)]!;
  const [, maxL] = getMapLevelRange(mapIndex);
  return [speciesFromRow(id, maxL, 2, null)];
}

function coerceBaseStats(raw: Record<string, unknown>, speciesId: number): Gen1BaseStatsRow {
  const fb = GEN1_BASE_STATS[speciesId];
  if (!raw || typeof raw !== "object") {
    return fb ?? { hp: 50, atk: 50, def: 50, special: 50, spdef: 50, speed: 50 };
  }
  const hp = Number(raw.hp ?? fb?.hp ?? 50);
  const atk = Number(raw.atk ?? fb?.atk ?? 50);
  const def = Number(raw.def ?? fb?.def ?? 50);
  const special = Number(raw.special ?? fb?.special ?? 50);
  const spdef = Number(raw.spdef ?? raw.special ?? fb?.spdef ?? fb?.special ?? 50);
  const speed = Number(raw.speed ?? fb?.speed ?? 50);
  return { hp, atk, def, special, spdef, speed };
}

/** Normalize Puppeteer snapshot pokemon into SimPokemon (full base stats). */
export function normalizeSimTeam(rawTeam: unknown): SimPokemon[] {
  if (!Array.isArray(rawTeam)) return [];
  const out: SimPokemon[] = [];
  for (const p of rawTeam) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const speciesId = Number(o.speciesId ?? 0);
    if (!speciesId) continue;
    const level = Math.min(100, Math.max(1, Number(o.level ?? 1)));
    const types = Array.isArray(o.types)
      ? (o.types as string[]).map((t) => String(t))
      : [...(GEN1_SPECIES_TYPES[speciesId] ?? ["Normal"])];
    const baseStats = coerceBaseStats((o.baseStats ?? {}) as Record<string, unknown>, speciesId);
    const currentHp = Math.max(0, Number(o.currentHp ?? 0));
    const maxHp = Math.max(1, Number(o.maxHp ?? calcHp(baseStats.hp, level)));
    const held = o.heldItem;
    const heldItem =
      held && typeof held === "object" && "id" in (held as object)
        ? { id: String((held as { id: unknown }).id) }
        : null;
    const moveTier = Number(o.moveTier ?? 1);
    out.push({
      speciesId,
      name: String(o.name ?? ""),
      nickname: o.nickname != null && o.nickname !== "" ? String(o.nickname) : null,
      level,
      currentHp,
      maxHp,
      types,
      baseStats,
      heldItem,
      moveTier: Math.max(0, Math.min(2, Number.isFinite(moveTier) ? moveTier : 1)),
    });
  }
  return out;
}

export interface BattleWinEstimateOptions {
  samples?: number;
  seed?: number;
}

/** Returns [0,1] — fraction of RNG samples where the player wins. */
export function estimateBattleWinProbability(
  intel: NodeIntel,
  rawPlayerTeam: unknown,
  bagItemIds: readonly string[],
  ctx: { currentMap: number; eliteIndex: number },
  opts?: BattleWinEstimateOptions,
): number {
  if (
    intel.category !== "wild" &&
    intel.category !== "legendary" &&
    intel.category !== "trainer" &&
    intel.category !== "dynamic_trainer" &&
    intel.category !== "gym" &&
    intel.category !== "elite"
  ) {
    return 1;
  }

  const playerTeam = normalizeSimTeam(rawPlayerTeam);
  if (playerTeam.length === 0) return 0;

  const samples = opts?.samples ?? DEFAULT_SAMPLES;
  const seedBase = (opts?.seed ?? 0x9e3779b9) ^ (ctx.currentMap * 1315423911) ^ (ctx.eliteIndex * 715827881);

  const blockedLegendary = new Set<number>(
    playerTeam.map((p) => p.speciesId).filter((id) => LEGENDARY_SPECIES_IDS.includes(id)),
  );

  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const rng = mulberry32(seedBase ^ (i * 2654435761));
    const enemies: SimPokemon[] =
      intel.category === "gym"
        ? buildGymEnemyTeam(intel.mapIndex)
        : intel.category === "elite"
          ? buildEliteEnemyTeam(intel.eliteIndex)
          : intel.category === "wild"
            ? sampleWildEnemyTripleThenPick(intel.mapIndex, rng)
            : intel.category === "dynamic_trainer"
              ? sampleDynamicTrainerEnemyTeam(intel.mapIndex, rng)
              : intel.category === "trainer"
                ? sampleTrainerEnemyTeam(ctx.currentMap, intel.key, rng)
                : intel.category === "legendary"
                  ? sampleLegendaryEnemy(ctx.currentMap, rng, blockedLegendary)
                  : [];

    if (enemies.length === 0) {
      wins++;
      continue;
    }

    const bag = bagItemIds.map((id) => ({ id }));
    if (runBattle(playerTeam, enemies, bag, [], rng)) wins++;
  }

  return wins / samples;
}

export interface WinProbabilityAdjustOpts {
  /** Live alive-team size; used to apply stricter refusal floors when small. */
  aliveTeamSize?: number;
}

/** Scale raw map score — hard refusals + pWin multiplier (A5). */
export function adjustMapScoreWithWinProbability(
  baseScore: number,
  intel: NodeIntel,
  lowHp: boolean,
  pWin: number,
  opts: WinProbabilityAdjustOpts = {},
): number {
  const aliveTeamSize = opts.aliveTeamSize ?? 6;
  // Graduated refusal: when refused, return a deeply negative score that
  // *still preserves pWin ordering*. This way if every map candidate is a
  // refused trainer (no catch / item / PC alternative on the layer), we
  // pick the highest-pWin trainer rather than a uniform -1e9 (which makes
  // the bot pick whichever candidate happens to come first). Unrefused
  // candidates with positive scores always still win — `-1e6` ≪ any real
  // base score.
  const refused = (p: number): number => -1e6 + p * 1e3;

  if (intel.category === "legendary" && pWin < 0.55) return refused(pWin);
  // lowHp + uncertain trainer → run-over risk. Diagnostic: Run 4 (last
  // batch) walked solo Bulb L7 hp=0.565 into Officer at pWin=0.554 (just
  // squeaked past old 0.55 floor) and lost. Bumped to 0.65 so a battered
  // team only takes confidently-winnable trainers. Solo (alive=1) is
  // strictest: any uncertainty = death.
  const lowHpTrainerFloor = aliveTeamSize <= 1 ? 0.8 : 0.65;
  if (
    (intel.category === "trainer" || intel.category === "dynamic_trainer") &&
    lowHp &&
    pWin < lowHpTrainerFloor
  ) {
    return refused(pWin);
  }
  if (intel.category === "wild" && lowHp && pWin < 0.5) return refused(pWin);
  // Static trainers: hard refusal at sub-30% — losing one trainer = run
  // over, the +2 XP isn't worth gambling on a coin flip. Solo: 0.55 (no
  // backup mon, much smaller margin for variance/crit).
  const staticTrainerFloor = aliveTeamSize <= 1 ? 0.55 : 0.3;
  if (intel.category === "trainer" && pWin < staticTrainerFloor) {
    return refused(pWin);
  }
  // Dynamic trainers (Ace Trainer etc.) sample from the map's catch pool
  // which on Map 2 reaches L25 with strong BST mons. Variance is huge, so
  // demand a safer floor than for fixed-roster trainers. Diagnostic: Run 7
  // lost a 4-mon team to an Ace at pWin=0.429 (passed old 0.4 floor); Run 13
  // burned 3 mons winning at pWin=0.643 because dynamic rosters often pack a
  // single L25 BST monster that one-shots even when "expected" to win.
  //
  // Floor depends on team size: the smaller our team, the more catastrophic
  // a single bad sample is. With ≤2 mons one Ace L25 ≈ run-over even at
  // simulated pWin=1.0 (variance the sim doesn't see). Diagnostic: Run 11
  // (Bulb L10 + Slowpoke L6) accepted Ace at pWin=1.0 → instantly lost.
  const dynamicTrainerFloor = aliveTeamSize <= 2 ? 0.85 : aliveTeamSize <= 3 ? 0.65 : 0.5;
  if (intel.category === "dynamic_trainer" && pWin < dynamicTrainerFloor) {
    return refused(pWin);
  }
  if (intel.category === "wild" && pWin < 0.25) return refused(pWin);
  // Boss nodes (gym/elite) never get pWin-dampened — you have to walk into
  // them eventually to clear the map. Dampening them here just reorders
  // ties; the actual decision lives in `scoreCandidate`.
  if (intel.category === "gym" || intel.category === "elite") {
    return baseScore * (0.55 + 0.45 * pWin);
  }
  if (intel.category === "trainer" || intel.category === "dynamic_trainer") {
    // Trainers are *the* +2 XP source pre-Map 4. Even at pWin=0.4 (40% win)
    // their XP is worth detouring for. Use a gentler multiplier so they
    // remain favoured over a catch when Grind Mode is active. Floor at 0.65.
    return baseScore * Math.max(0.65, 0.7 + 0.3 * pWin);
  }
  if (intel.category === "wild") {
    return baseScore * Math.max(0.7, 0.75 + 0.25 * pWin);
  }
  if (intel.category === "legendary") {
    return baseScore * (0.55 + 0.45 * pWin);
  }
  return baseScore;
}
