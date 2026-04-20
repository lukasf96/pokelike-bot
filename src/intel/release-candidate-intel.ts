/**
 * Shared “which slot to give up?” logic for swap (team full) and trade nodes.
 * Implements protections from BOT_IMPROVEMENTS B3/B5 and trade-specific gain thresholds.
 */

import { avgBstCatchPool } from "./catch-pool.js";
import { BOSS_TYPES_BY_MAP } from "./catch-intel.js";
import { attackingStabTypes, typeEffectiveness } from "./battle-intel.js";
import { GEN1_SPECIES_BST, GEN1_SPECIES_TYPES } from "../data/gen1-species.js";

export interface ReleaseTeamMember {
  speciesId: number;
  level: number;
  isShiny: boolean;
  /** Held item id, if any */
  heldItemId: string | null;
  /** 0–2 tutor tier; ≥2 = upgraded moves */
  moveTier: number;
}

export function slotPowerScore(speciesId: number, level: number): number {
  const bst = GEN1_SPECIES_BST[speciesId] ?? 300;
  return bst * Math.sqrt(Math.max(1, level));
}

function speciesAttackStabTypes(speciesId: number): string[] {
  const types = GEN1_SPECIES_TYPES[speciesId] ?? ["Normal"];
  return attackingStabTypes(types);
}

function teamStabTypeSet(team: ReleaseTeamMember[], excludeIndex: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < team.length; i++) {
    if (i === excludeIndex) continue;
    for (const t of speciesAttackStabTypes(team[i]!.speciesId)) {
      set.add(t.toLowerCase());
    }
  }
  return set;
}

function stabRelevantForUpcomingMaps(attackType: string, mapIndex: number): boolean {
  const a = attackType;
  for (let m = mapIndex; m < BOSS_TYPES_BY_MAP.length; m++) {
    for (const bossType of BOSS_TYPES_BY_MAP[m]!) {
      if (typeEffectiveness(a, [bossType]) >= 2) return true;
    }
  }
  return false;
}

/** B5: −40 per sole STAB type lost that is super-effective vs an upcoming boss typing. */
export function coveragePenaltyForRemovingSlot(
  team: ReleaseTeamMember[],
  slotIndex: number,
  mapIndex: number,
): number {
  const perRole = 40;
  const othersStab = teamStabTypeSet(team, slotIndex);
  let rolesLost = 0;
  for (const stab of speciesAttackStabTypes(team[slotIndex]!.speciesId)) {
    const lc = stab.toLowerCase();
    if (!stabRelevantForUpcomingMaps(stab, mapIndex)) continue;
    if (!othersStab.has(lc)) rolesLost++;
  }
  return perRole * rolesLost;
}

/**
 * Inverse of `coveragePenaltyForRemovingSlot`: a *bonus to release* (so it's
 * subtracted from `slotPowerScore`) when a slot's STAB type is duplicated on
 * the team and useless against the next boss. This is what finally lets
 * Squirtle (Water) be released by Map 2 when a Pikachu (Electric) is sitting
 * in the wings — currently `slotPowerScore = bst × √level` keeps a levelled
 * Squirtle stickier than the actual Misty answer.
 */
export function redundancyReleaseBias(
  team: ReleaseTeamMember[],
  slotIndex: number,
  mapIndex: number,
): number {
  const m = team[slotIndex]!;
  const myStabs = speciesAttackStabTypes(m.speciesId);
  const others = teamStabTypeSet(team, slotIndex);
  // Boss typings for the *next* boss (or current map's boss if we haven't
  // beaten it yet). We use `BOSS_TYPES_BY_MAP[mapIndex]` — `currentMap` is the
  // map currently being played.
  const nextBoss = BOSS_TYPES_BY_MAP[Math.min(mapIndex, BOSS_TYPES_BY_MAP.length - 1)] ?? [];

  let bias = 0;
  for (const stab of myStabs) {
    const lc = stab.toLowerCase();
    const isDup = others.has(lc);
    if (!isDup) continue; // not redundant; protected by coverage
    // Resisted by every boss typing? → useless dead weight.
    let allResisted = true;
    let anySE = false;
    for (const bt of nextBoss) {
      const eff = typeEffectiveness(stab, [bt]);
      if (eff > 0.5) allResisted = false;
      if (eff >= 2) anySE = true;
    }
    if (allResisted)
      bias += 350; // strong release bias
    else if (!anySE) bias += 80; // mildly redundant + neutral, lower bias
  }
  return bias;
}

/** Shiny, key held items, tutor tier 2, Eevee + Moon Stone. */
export function isHardProtectedRelease(
  member: ReleaseTeamMember,
  moonStoneInBag: boolean,
): boolean {
  if (member.isShiny) return true;
  const hid = member.heldItemId;
  if (hid === "lucky_egg" || hid === "eviolite") return true;
  if (member.moveTier >= 2) return true;
  if (member.speciesId === 133 && moonStoneInBag) return true;
  return false;
}

/**
 * Slot to release when the team is full (swap screen). Lowest effective power
 * (raw `slotPowerScore` minus a `redundancyReleaseBias`) among non-protected
 * members; fallback if all are protected matches legacy behavior.
 *
 * `mapIndex` is the *current* map (so `redundancyReleaseBias` knows which boss
 * is "next"). When unknown, pass 0 — the bias degrades to "release dead-weight
 * Water mons before Brock", which is also the right behaviour.
 */
export function pickSwapReleaseSlot(
  team: ReleaseTeamMember[],
  moonStoneInBag: boolean,
  mapIndex: number = 0,
): number {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < team.length; i++) {
    const m = team[i]!;
    if (isHardProtectedRelease(m, moonStoneInBag)) continue;
    const s = slotPowerScore(m.speciesId, m.level) - redundancyReleaseBias(team, i, mapIndex);
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  }
  if (best >= 0) return best;

  let fallbackIdx = -1;
  let fallbackLv = Infinity;
  for (let i = 0; i < team.length; i++) {
    const m = team[i]!;
    if (!m.isShiny && m.level < fallbackLv) {
      fallbackLv = m.level;
      fallbackIdx = i;
    }
  }
  return fallbackIdx >= 0 ? fallbackIdx : 0;
}

export function expectedTradeOfferPowerScore(mapIndex: number, tradeFromLevel: number): number {
  const avgBst = avgBstCatchPool(mapIndex);
  const offerLv = Math.min(100, tradeFromLevel + 3);
  return avgBst * Math.sqrt(Math.max(1, offerLv));
}

/** B5-style adjusted gain vs releasing `slotIndex` (higher = better trade). */
export function tradeAdjustedGainForSlot(
  team: ReleaseTeamMember[],
  slotIndex: number,
  mapIndex: number,
): number {
  const m = team[slotIndex]!;
  const cur = slotPowerScore(m.speciesId, m.level);
  const exp = expectedTradeOfferPowerScore(mapIndex, m.level);
  const raw = exp - cur;
  return raw - coveragePenaltyForRemovingSlot(team, slotIndex, mapIndex);
}
