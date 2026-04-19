/**
 * Pure derived views over `GameSnapshot`. These exist so handler-specific
 * adapter shapes (e.g. `TeamMemberForItem`, `TutorTeamSlot`) live in ONE
 * place — easy to keep aligned as `Pokemon` evolves.
 *
 * Add a selector here whenever a handler needs a non-trivial projection.
 * Never mutate inputs.
 */

import type { TeamMemberBrief } from "../battle-intel.js";
import type { TeamMemberForItem } from "../item-intel.js";
import type { ReleaseTeamMember } from "../release-candidate-intel.js";
import type { TutorTeamSlot } from "../tutor-intel.js";
import type { GameSnapshot, Pokemon } from "./types.js";

export interface TeamHpSummary {
  ratio: number;
  fainted: number;
  critical: number;
  /** Convenience flag matching the `lowHp` heuristic used in `handleMap`. */
  lowHp: boolean;
}

export function selectItemTeam(g: GameSnapshot): TeamMemberForItem[] {
  return g.team.map((p) => ({
    types: p.types,
    baseStats: p.baseStats,
    level: p.level,
    speciesId: p.speciesId,
    currentHp: p.hp.current,
    maxHp: p.hp.max,
    heldItem: p.heldItemId ? { id: p.heldItemId } : undefined,
  }));
}

export function selectTutorTeam(g: GameSnapshot): TutorTeamSlot[] {
  return g.team.map((p) => ({
    speciesId: p.speciesId,
    level: Math.max(1, p.level),
    moveTier: p.moveTier,
  }));
}

export function selectReleaseTeam(g: GameSnapshot): ReleaseTeamMember[] {
  return g.team.map((p) => ({
    speciesId: p.speciesId,
    level: p.level,
    isShiny: p.isShiny,
    heldItemId: p.heldItemId,
    moveTier: p.moveTier,
  }));
}

export function selectTeamBrief(g: GameSnapshot): TeamMemberBrief[] {
  return g.team.map((p) => ({ types: p.types }));
}

export function selectTeamHp(g: GameSnapshot): TeamHpSummary {
  let tot = 0;
  let mx = 0;
  let fainted = 0;
  let critical = 0;
  for (const p of g.team) {
    tot += p.hp.current;
    mx += p.hp.max;
    if (p.hp.current <= 0) fainted += 1;
    else if (p.hp.max > 0 && p.hp.current / p.hp.max < 0.25) critical += 1;
  }
  const ratio = mx > 0 ? tot / mx : 1;
  const lowHp = fainted >= 1 || critical >= 2 || ratio < 0.55;
  return { ratio, fainted, critical, lowHp };
}

export function selectMoonStoneInBag(g: GameSnapshot): boolean {
  return g.bag.some((it) => it.id === "moon_stone");
}

export function selectBagItemIds(g: GameSnapshot): string[] {
  return g.bag.map((it) => it.id).filter(Boolean);
}

export function pokemonByIndex(g: GameSnapshot, idx: number): Pokemon | undefined {
  return g.team[idx];
}
