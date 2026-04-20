/**
 * Item scoring aligned with pokelike-source-files/data.js (ITEM_POOL, TYPE_ITEM_MAP)
 * and battle.js (physical/special split, team-wide items).
 */

import { attackingStabTypes, typeEffectiveness } from "./battle-intel.js";

/** Inverse of data.js TYPE_ITEM_MAP — held item id → attacking type boosted (+50% damage). */
export const TYPE_BOOST_ATTACK_TYPE: Record<string, string> = {
  sharp_beak: "Flying",
  charcoal: "Fire",
  mystic_water: "Water",
  magnet: "Electric",
  miracle_seed: "Grass",
  twisted_spoon: "Psychic",
  black_belt: "Fighting",
  soft_sand: "Ground",
  silver_powder: "Bug",
  hard_stone: "Rock",
  dragon_fang: "Dragon",
  poison_barb: "Poison",
  spell_tag: "Ghost",
  silk_scarf: "Normal",
};

/** data.js GEN1_EVOLUTIONS keys + 133 (Eevee) — mirror canEvolve() */
const CAN_EVOLVE_SPECIES = new Set<number>([
  1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 21, 23, 27, 29, 30, 32, 33, 35, 37, 39, 41, 43, 44,
  46, 48, 50, 52, 54, 56, 58, 60, 61, 63, 64, 66, 67, 69, 70, 72, 74, 75, 77, 79, 81, 84, 86, 88,
  90, 92, 93, 95, 96, 98, 100, 102, 104, 109, 111, 116, 118, 120, 123, 129, 138, 140, 147, 148, 133,
]);

export interface TeamMemberForItem {
  types: string[];
  baseStats?: {
    hp?: number;
    atk?: number;
    def?: number;
    speed?: number;
    special?: number;
    spdef?: number;
  };
  level: number;
  speciesId: number;
  currentHp?: number;
  maxHp?: number;
  heldItem?: { id: string };
}

function capType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function bst(m: TeamMemberForItem): number {
  const b = m.baseStats;
  if (!b) return 320;
  // data.js computes bst = sum(baseStats). Must include spdef to stay in sync
  // with catch-intel's `GEN1_SPECIES_BST` (which sums all six stats).
  return (
    (b.hp ?? 0) + (b.atk ?? 0) + (b.def ?? 0) + (b.speed ?? 0) + (b.special ?? 0) + (b.spdef ?? 0)
  );
}

function isPhysicalAttacker(m: TeamMemberForItem): boolean {
  return (m.baseStats?.atk ?? 0) > (m.baseStats?.special ?? 0);
}

/**
 * STAB weight for a type-boost item. A +50% damage item is *only* useful to a
 * Pokémon that actually attacks with that type — handing `charcoal` to a
 * Blastoise produces literally zero combat benefit. So we gate hard:
 *   • primary STAB (this type is what they'd pick in `attackingStabTypes`) → 2.2
 *   • secondary typing (Bulbasaur/Poison has Poison in types but Grass as STAB) → 1.4
 *   • unrelated typing → 0 (was 0.35; diagnostic: twisted_spoon landed on
 *     Blastoise because 0.35 × BST × √L beat a fresh Psychic's 2.2 × BST × √L
 *     only marginally, and lost when Blastoise's level was high).
 */
function stabMultiplier(types: string[], attackType: string): number {
  const cap = capType(attackType);
  const stab = new Set(attackingStabTypes(types).map(capType));
  if (stab.has(cap)) return 2.2;
  if (types.some((t) => capType(t) === cap)) return 1.4;
  return 0;
}

function powerPhysical(m: TeamMemberForItem): number {
  return (m.baseStats?.atk ?? 55) * Math.sqrt(m.level);
}

function powerSpecial(m: TeamMemberForItem): number {
  return (m.baseStats?.special ?? 55) * Math.sqrt(m.level);
}

/** Carry proxy: battles usually go through the strongest mon; Lucky Egg rewards only participate in battles. */
function luckyEggSlotFitness(p: TeamMemberForItem): number {
  if (p.level >= 100) return -1e9;
  const lv = Math.max(1, p.level);
  const carry = bst(p) * Math.sqrt(lv);
  // Tie-breaker: levels still compound through an upcoming evolution.
  return CAN_EVOLVE_SPECIES.has(p.speciesId) ? carry * 1.06 : carry;
}

/** Base tiers — same spirit as prior bot priority; tweaked in scoreItemPick. */
const ITEM_BASE: Record<string, number> = {
  lucky_egg: 100,
  life_orb: 90,
  choice_band: 85,
  choice_specs: 85,
  leftovers: 80,
  shell_bell: 75,
  scope_lens: 70,
  wide_lens: 65,
  expert_belt: 60,
  assault_vest: 55,
  muscle_band: 55,
  wise_glasses: 55,
  focus_sash: 50,
  focus_band: 45,
  metronome: 45,
  max_revive: 95,
  rare_candy: 70,
  moon_stone: 65,
  choice_scarf: 42,
  eviolite: 38,
  air_balloon: 36,
  rocky_helmet: 52,
};

function metronomeTeamBonus(team: TeamMemberForItem[]): number {
  if (team.length === 0) return 0;
  let best = 0;
  for (const p of team) {
    const pTypes = p.types.map(capType);
    let share = 0;
    for (const q of team) {
      if (q.types.some((t) => pTypes.includes(capType(t)))) share += 1;
    }
    if (share > best) best = share;
  }
  if (best >= 4) return 55;
  if (best >= 3) return 28;
  return 0;
}

/** Optional boss conditioning for `heldItemFitnessAtSlot`. */
export interface HeldItemFitnessCtx {
  /**
   * Typings of the next boss roster (e.g. `[["Water"], ["Water","Psychic"]]`
   * for Misty). When provided, an attacker that hits the boss super-effectively
   * is rewarded — this prevents Choice Band landing on a Normal-type when an
   * Electric Pokémon is sitting next to Misty.
   */
  nextBossTypings?: string[][];
  /**
   * True when the next map candidate layer exposes the boss. Used to filter
   * non-combat items (`lucky_egg`) out of equip decisions — we want combat
   * fitness on all 6 slots before we punch into the gym, not a 1.06× XP
   * multiplier on the carry.
   */
  bossImminent?: boolean;
}

/**
 * How well `itemId` fits on `team[slotIndex]` for reassignment / swap optimization.
 * Higher is better (same scale as best-slot search in `bestPokemonIndexForHeldItem`).
 */
export function heldItemFitnessAtSlot(
  itemId: string,
  slotIndex: number,
  team: TeamMemberForItem[],
  ctx?: HeldItemFitnessCtx,
): number {
  const p = team[slotIndex];
  if (!p) return -1e9;

  const bossMult = nextBossOffenseMultiplier(p, ctx);

  const atkT = TYPE_BOOST_ATTACK_TYPE[itemId];
  if (atkT) {
    const mult = stabMultiplier(p.types, atkT);
    // If this type-boost item's attack type doesn't even hit the next boss,
    // shrink the bonus so we don't gift `mystic_water` to a Squirtle that
    // can't hurt Misty.
    const itemHitsBoss = nextBossOffenseFromAttackType(atkT, ctx);
    return mult * bst(p) * Math.sqrt(Math.max(1, p.level)) * (itemHitsBoss * 0.6 + 0.4);
  }

  // Items that scale with raw offense should reward attackers who actually
  // damage the next boss. `bossMult` is in [0.5, 2.0]+ — we apply it only to
  // damage-amplifying items, not bulk/utility items.
  // Attacker-stat match: Choice Band / Muscle Band on a special attacker is
  // mis-assignment. We multiply by a factor that is 1.0 when the Pokémon's
  // dominant attacking stat matches, and 0.35 when it doesn't. Previously
  // choice_band used raw `powerPhysical` with no gate, and choice_specs
  // used raw `powerSpecial` — both landed on the wrong mon when the right
  // kind of attacker had slightly lower √L × stat.
  const phys = isPhysicalAttacker(p);
  switch (itemId) {
    case "choice_band":
      return powerPhysical(p) * (phys ? 1 : 0.35) * bossMult;
    case "choice_specs":
      return powerSpecial(p) * (phys ? 0.35 : 1) * bossMult;
    case "muscle_band": {
      const base = powerPhysical(p);
      return (phys ? base * 1.35 : base * 0.35) * bossMult;
    }
    case "wise_glasses": {
      const base = powerSpecial(p);
      return (!phys ? base * 1.35 : base * 0.35) * bossMult;
    }
    case "choice_scarf":
      return (p.baseStats?.speed ?? 50) * Math.sqrt(p.level);
    case "eviolite":
      return CAN_EVOLVE_SPECIES.has(p.speciesId) ? bst(p) * Math.sqrt(Math.max(1, p.level)) : -800;
    case "metronome": {
      const pTypes = p.types.map(capType);
      let share = 0;
      for (const q of team) {
        if (q.types.some((t) => pTypes.includes(capType(t)))) share += 1;
      }
      return share * 100 + bst(p);
    }
    case "lucky_egg":
      // Pre-boss, XP items are strictly worse than even a marginal combat
      // item — we need our 6 slots dedicated to winning the next fight,
      // not soaking up future XP. Return a deeply negative score so every
      // attacking/bulk item beats it.
      if (ctx?.bossImminent) return -1e5;
      return luckyEggSlotFitness(p);
    case "leftovers":
    case "rocky_helmet":
      return (p.baseStats?.hp ?? 60) * bst(p);
    case "assault_vest": {
      const sp = p.baseStats?.special ?? 50;
      const sd = p.baseStats?.spdef ?? p.baseStats?.special ?? 50;
      return sp + sd;
    }
    case "focus_sash":
    case "focus_band": {
      const bulk = (p.baseStats?.def ?? 50) + (p.baseStats?.spdef ?? p.baseStats?.special ?? 50);
      const offense = Math.max(powerPhysical(p), powerSpecial(p));
      return (offense - bulk * 0.35) * Math.max(1, bossMult);
    }
    case "life_orb":
    case "shell_bell":
    case "wide_lens":
    case "scope_lens":
      return Math.max(powerPhysical(p), powerSpecial(p)) * bossMult;
    case "expert_belt":
      // Expert Belt only triggers on super-effective hits — its value is
      // tightly tied to whether the holder actually hits the boss SE.
      return Math.max(powerPhysical(p), powerSpecial(p)) * (bossMult >= 1.5 ? 1.6 : 0.7);
    default:
      return bst(p) * Math.sqrt(Math.max(1, p.level));
  }
}

/** Best STAB-vs-boss multiplier this Pokémon could deliver. */
function nextBossOffenseMultiplier(p: TeamMemberForItem, ctx?: HeldItemFitnessCtx): number {
  const typings = ctx?.nextBossTypings;
  if (!typings || typings.length === 0) return 1;
  const stab = attackingStabTypes(p.types);
  if (stab.length === 0) return 1;
  let sum = 0;
  for (const enemy of typings) {
    let bestForThis = 0;
    for (const st of stab) {
      bestForThis = Math.max(bestForThis, typeEffectiveness(st, enemy));
    }
    sum += bestForThis;
  }
  const avg = sum / typings.length;
  // Squash to [0.5, 2.0] so the multiplier can't drown out base power.
  return Math.max(0.5, Math.min(2.0, avg));
}

/** Avg type effectiveness of `attackType` against the next boss roster. */
function nextBossOffenseFromAttackType(attackType: string, ctx?: HeldItemFitnessCtx): number {
  const typings = ctx?.nextBossTypings;
  if (!typings || typings.length === 0) return 1;
  let sum = 0;
  for (const enemy of typings) {
    sum += typeEffectiveness(attackType, enemy);
  }
  const avg = sum / typings.length;
  return Math.max(0.4, Math.min(2.0, avg));
}

function allIndexPermutations(size: number): number[][] {
  const base = [...Array(size).keys()];
  const out: number[][] = [];
  function permute(a: number[], start: number): void {
    if (start === size) {
      out.push([...a]);
      return;
    }
    for (let i = start; i < size; i += 1) {
      [a[start], a[i]] = [a[i]!, a[start]!];
      permute(a, start + 1);
      [a[start], a[i]] = [a[i]!, a[start]!];
    }
  }
  permute(base, 0);
  return out;
}

const MIN_HELD_PERM_IMPROVE = 6;

/**
 * Among Pokémon that already hold items, finds a permutation of those items that maximizes
 * sum of `heldItemFitnessAtSlot`. Returns null if fewer than two holders or gain below threshold.
 */
export function optimalHeldItemPermutation(
  team: TeamMemberForItem[],
  ctx?: HeldItemFitnessCtx,
): {
  slots: number[];
  itemIds: string[];
  bestPerm: number[];
  before: number;
  after: number;
  gain: number;
} | null {
  const slots: number[] = [];
  const itemIds: string[] = [];
  for (let i = 0; i < team.length; i += 1) {
    const id = team[i]?.heldItem?.id;
    if (id) {
      slots.push(i);
      itemIds.push(id);
    }
  }
  const k = slots.length;
  if (k < 2) return null;

  const scorePerm = (perm: number[]): number =>
    perm.reduce(
      (sum, srcIdx, slotPos) =>
        sum + heldItemFitnessAtSlot(itemIds[srcIdx]!, slots[slotPos]!, team, ctx),
      0,
    );

  const identity = [...Array(k).keys()];
  const before = scorePerm(identity);

  let bestPerm = identity;
  let after = before;
  for (const perm of allIndexPermutations(k)) {
    const sc = scorePerm(perm);
    if (sc > after) {
      after = sc;
      bestPerm = perm;
    }
  }

  const gain = after - before;
  if (gain < MIN_HELD_PERM_IMPROVE) return null;

  return { slots, itemIds, bestPerm, before, after, gain };
}

export function scoreItemPick(itemId: string, team: TeamMemberForItem[]): number {
  let score = ITEM_BASE[itemId];
  if (score === undefined) score = TYPE_BOOST_ATTACK_TYPE[itemId] !== undefined ? 38 : 20;

  const atkT = TYPE_BOOST_ATTACK_TYPE[itemId];
  if (atkT) {
    let best = 0;
    for (const p of team) {
      const mult = stabMultiplier(p.types, atkT);
      if (mult < 0.5) continue;
      const v = mult * bst(p) * Math.sqrt(Math.max(1, p.level));
      if (v > best) best = v;
    }
    score += Math.min(75, best / 12);
  }

  const physN = team.filter(isPhysicalAttacker).length;
  const specN = team.length - physN;
  const allPhysical = team.length > 0 && physN >= 4;
  const allSpecial = team.length > 0 && specN >= 4;

  if (itemId === "choice_band") {
    const mx = team.reduce((m, p) => Math.max(m, powerPhysical(p)), 0);
    score += Math.min(45, mx / 25);
  }
  if (itemId === "choice_specs") {
    const mx = team.reduce((m, p) => Math.max(m, powerSpecial(p)), 0);
    score += Math.min(45, mx / 25);
  }
  if (itemId === "muscle_band") {
    score += allPhysical ? 48 : physN >= 3 ? 20 : 0;
  }
  if (itemId === "wise_glasses") {
    score += allSpecial ? 48 : specN >= 3 ? 20 : 0;
  }
  if (itemId === "metronome") {
    score += metronomeTeamBonus(team);
  }
  if (itemId === "eviolite") {
    let mx = 0;
    for (const p of team) {
      if (!CAN_EVOLVE_SPECIES.has(p.speciesId)) continue;
      mx = Math.max(mx, bst(p) * Math.sqrt(p.level));
    }
    score += Math.min(50, mx / 15);
  }
  if (itemId === "max_revive") {
    if (team.some((p) => (p.currentHp ?? 1) <= 0)) score += 40;
  }
  if (itemId === "lucky_egg") {
    let bestCarry = 0;
    for (const p of team) {
      if (p.level >= 100) continue;
      const v = bst(p) * Math.sqrt(Math.max(1, p.level));
      if (v > bestCarry) bestCarry = v;
    }
    score += Math.min(22, bestCarry / 22);
  }
  if (itemId === "life_orb" || itemId === "shell_bell" || itemId === "wide_lens") {
    const mx = team.reduce((m, p) => Math.max(m, Math.max(powerPhysical(p), powerSpecial(p))), 0);
    score += Math.min(35, mx / 30);
  }
  if (itemId === "leftovers" || itemId === "rocky_helmet") {
    const mx = team.reduce((m, p) => Math.max(m, (p.baseStats?.hp ?? 50) * p.level), 0);
    score += Math.min(30, mx / 200);
  }
  if (itemId === "assault_vest") {
    const mx = team.reduce((acc, p) => {
      const v = (p.baseStats?.special ?? 0) + (p.baseStats?.spdef ?? p.baseStats?.special ?? 0);
      return Math.max(acc, v);
    }, 0);
    score += Math.min(25, mx / 80);
  }
  if (itemId === "focus_sash" || itemId === "focus_band") {
    const fragile = team.filter(
      (p) => (p.baseStats?.def ?? 50) + (p.baseStats?.spdef ?? p.baseStats?.special ?? 50) < 180,
    );
    if (fragile.length > 0) score += 22;
  }
  if (itemId === "choice_scarf") {
    const mx = team.reduce(
      (m, p) => Math.max(m, (p.baseStats?.speed ?? 50) * Math.sqrt(p.level)),
      0,
    );
    score += Math.min(35, mx / 28);
  }
  if (itemId === "expert_belt") {
    score += team.length >= 2 ? 15 : 0;
  }

  return score;
}

export function bestPokemonIndexForHeldItem(
  itemId: string,
  team: TeamMemberForItem[],
  ctx?: HeldItemFitnessCtx,
): number {
  if (team.length === 0) return 0;
  let bestI = 0;
  let best = -Infinity;
  for (let i = 0; i < team.length; i += 1) {
    const v = heldItemFitnessAtSlot(itemId, i, team, ctx);
    if (v > best) {
      best = v;
      bestI = i;
    }
  }
  return bestI;
}

/** Among Pokémon with no held item, best slot for `itemId`; `null` if everyone holds something. */
export function bestEmptySlotForHeldItem(
  itemId: string,
  team: TeamMemberForItem[],
  ctx?: HeldItemFitnessCtx,
): number | null {
  let bestI: number | null = null;
  let best = -Infinity;
  for (let i = 0; i < team.length; i += 1) {
    if (team[i]?.heldItem) continue;
    const v = heldItemFitnessAtSlot(itemId, i, team, ctx);
    if (v > best) {
      best = v;
      bestI = i;
    }
  }
  return bestI;
}

export function itemNameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
