/**
 * Pure port of pokelike-source-files/battle.js auto-battle (1v1 active, full teams).
 * RNG is injected so Monte-Carlo can vary damage rolls / crits / Focus Band.
 */

import { GEN1_EVOLUTIONS } from "../data/gen1-evolutions.js";
import { typeEffectiveness } from "../intel/battle-intel.js";
import { MOVE_POOL, type MovePoolKey } from "./game-move-pool.js";

export interface SimBaseStats {
  hp: number;
  atk: number;
  def: number;
  special: number;
  spdef?: number;
  speed: number;
}

/** Mirrors in-game pokemon battle object (subset). */
export interface SimPokemon {
  speciesId: number;
  name?: string;
  nickname?: string | null;
  level: number;
  currentHp: number;
  maxHp: number;
  types: string[];
  baseStats: SimBaseStats;
  heldItem?: { id: string } | null;
  moveTier?: number;
  _transformed?: boolean;
}

interface SimMove {
  name: string;
  power: number;
  type: string;
  isSpecial?: boolean;
  /** Struggle */
  typeless?: boolean;
  /** Splash / Teleport */
  noDamage?: boolean;
}

const TYPE_ITEM_MAP: Partial<Record<string, string>> = {
  Flying: "sharp_beak",
  Fire: "charcoal",
  Water: "mystic_water",
  Electric: "magnet",
  Grass: "miracle_seed",
  Psychic: "twisted_spoon",
  Fighting: "black_belt",
  Ground: "soft_sand",
  Bug: "silver_powder",
  Rock: "hard_stone",
  Dragon: "dragon_fang",
  Poison: "poison_barb",
  Ghost: "spell_tag",
  Normal: "silk_scarf",
};

function capTypeKey(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function calcHp(baseHp: number, level: number): number {
  return Math.floor((baseHp * level) / 50) + level + 10;
}

function hasItem(items: readonly { id: string }[], id: string): boolean {
  return items.some((it) => it.id === id);
}

function getTypeBoostItem(moveType: string, items: readonly { id: string }[]): boolean {
  const cap = capTypeKey(moveType);
  const needed = TYPE_ITEM_MAP[cap];
  if (!needed) return false;
  return items.some((it) => it.id === needed);
}

function canEvolve(speciesId: number): boolean {
  return Object.prototype.hasOwnProperty.call(GEN1_EVOLUTIONS, speciesId) || speciesId === 133;
}

export function getMoveTierForMap(mapIndex: number): number {
  return mapIndex <= 2 ? 0 : 1;
}

export function getBestMove(types: string[], baseStats: SimBaseStats | undefined, speciesId: number, moveTier = 1): SimMove {
  if (speciesId === 129) return { name: "Splash", power: 0, type: "Normal", isSpecial: false, noDamage: true };
  if (speciesId === 63) return { name: "Teleport", power: 0, type: "Normal", isSpecial: false, noDamage: true };

  const isSpecial = (baseStats?.special ?? 0) >= (baseStats?.atk ?? 0);
  const tier = Math.max(0, Math.min(2, moveTier ?? 1));

  if ([74, 75, 76, 95].includes(speciesId)) {
    const move = MOVE_POOL.Rock[isSpecial ? "special" : "physical"][tier]!;
    return { ...move, type: "Rock", isSpecial };
  }

  for (const t of types) {
    if (t.toLowerCase() === "normal" && types.length > 1) continue;
    const cap = capTypeKey(t) as MovePoolKey;
    if (MOVE_POOL[cap]) {
      const move = MOVE_POOL[cap][isSpecial ? "special" : "physical"][tier]!;
      return { ...move, type: cap, isSpecial };
    }
  }
  return { name: "Tackle", power: 40, type: "Normal", isSpecial: false };
}

/** `playerTeamOnly` mirrors `state.team` in battle.js — muscle band / wise glasses / metronome counts use the player roster only. */
export function getEffectiveStat(
  pokemon: SimPokemon,
  stat: "atk" | "def" | "special" | "spdef" | "speed",
  items: readonly { id: string }[],
  playerTeamOnly: SimPokemon[],
): number {
  const rawStat =
    stat === "spdef"
      ? (pokemon.baseStats.spdef ?? pokemon.baseStats.special ?? 50)
      : (pokemon.baseStats[stat as keyof SimBaseStats] as number | undefined) ?? 50;
  let val = rawStat || 50;
  val = Math.floor((val * pokemon.level) / 50) + 5;

  const physicalCount = playerTeamOnly.filter((p) => (p.baseStats?.atk ?? 0) > (p.baseStats?.special ?? 0)).length;
  const specialCount = playerTeamOnly.filter((p) => (p.baseStats?.special ?? 0) >= (p.baseStats?.atk ?? 0)).length;
  const allPhysical = playerTeamOnly.length > 0 && physicalCount >= 4;
  const allSpecial = playerTeamOnly.length > 0 && specialCount >= 4;

  if (stat === "atk") {
    if (hasItem(items, "muscle_band") && allPhysical) val = Math.floor(val * 1.5);
  }
  if (stat === "def") {
    if (hasItem(items, "eviolite") && canEvolve(pokemon.speciesId)) val = Math.floor(val * 1.5);
    if (hasItem(items, "muscle_band") && allPhysical) val = Math.floor(val * 1.5);
    if (hasItem(items, "choice_band")) val = Math.floor(val * 0.8);
  }
  if (stat === "special") {
    if (hasItem(items, "wise_glasses") && allSpecial) val = Math.floor(val * 1.5);
  }
  if (stat === "spdef") {
    if (hasItem(items, "eviolite") && canEvolve(pokemon.speciesId)) val = Math.floor(val * 1.5);
    if (hasItem(items, "assault_vest")) val = Math.floor(val * 1.5);
    if (hasItem(items, "wise_glasses") && allSpecial) val = Math.floor(val * 1.5);
    if (hasItem(items, "choice_specs")) val = Math.floor(val * 0.8);
  }
  if (stat === "speed") {
    if (hasItem(items, "choice_scarf")) val = Math.floor(val * 1.5);
  }
  return Math.max(1, val);
}

export function calcDamage(
  attacker: SimPokemon,
  defender: SimPokemon,
  move: SimMove,
  attackerItems: readonly { id: string }[],
  defenderItems: readonly { id: string }[],
  playerTeamForMetronome: SimPokemon[],
  rng: () => number,
): { damage: number; typeEff: number; moveType: string; crit: boolean } {
  const lvl = attacker.level;
  const isSpecial = (attacker.baseStats?.special ?? 0) >= (attacker.baseStats?.atk ?? 0);
  const atk = getEffectiveStat(attacker, isSpecial ? "special" : "atk", attackerItems, playerTeamForMetronome);
  const def = getEffectiveStat(defender, isSpecial ? "spdef" : "def", defenderItems, playerTeamForMetronome);
  const power = move.power || 40;
  const moveType = move.type || "Normal";

  let damage = Math.floor(((2 * lvl) / 5 + 2) * ((power * atk) / def / 50) + 2);

  const typeEff = move.typeless ? 1 : typeEffectiveness(moveType, defender.types.length ? defender.types : ["Normal"]);
  damage = Math.floor(damage * typeEff);

  if (
    attacker.types?.some((t) => t.toLowerCase() === moveType.toLowerCase())
  ) {
    damage = Math.floor(damage * 1.5);
  }

  const typeBoostItem = getTypeBoostItem(moveType, attackerItems);
  if (typeBoostItem) damage = Math.floor(damage * 1.5);

  if (hasItem(attackerItems, "life_orb")) damage = Math.floor(damage * 1.3);
  if (hasItem(attackerItems, "wide_lens")) damage = Math.floor(damage * 1.2);

  if (isSpecial) {
    if (hasItem(attackerItems, "choice_specs")) damage = Math.floor(damage * 1.4);
  } else if (hasItem(attackerItems, "choice_band")) {
    damage = Math.floor(damage * 1.4);
  }

  if (hasItem(attackerItems, "metronome")) {
    if (playerTeamForMetronome.length > 0) {
      const sharedType = (attacker.types || []).find((t) => {
        const count = playerTeamForMetronome.filter((p) =>
          (p.types || []).some((pt) => pt.toLowerCase() === t.toLowerCase()),
        ).length;
        return count >= 4;
      });
      if (sharedType) damage = Math.floor(damage * 1.5);
    }
  }

  if (hasItem(attackerItems, "expert_belt") && typeEff >= 2) damage = Math.floor(damage * 1.3);
  if (hasItem(attackerItems, "air_balloon") && moveType.toLowerCase() === "ground") damage = 0;

  let critChance = 0.0625;
  if (hasItem(attackerItems, "scope_lens")) critChance = 0.2;
  const crit = rng() < critChance;
  if (crit) damage = Math.floor(damage * 1.5);

  const dmgVariance = 0.85 + rng() * 0.15;
  damage = typeEff === 0 ? 0 : Math.max(1, Math.floor(damage * dmgVariance));

  return { damage, typeEff, moveType, crit };
}

function cloneTeam(team: SimPokemon[]): SimPokemon[] {
  return team.map((p) => ({
    ...p,
    types: [...(p.types || [])],
    baseStats: { ...p.baseStats },
    heldItem: p.heldItem ? { ...p.heldItem } : null,
  }));
}

export function runBattle(
  playerTeamIn: SimPokemon[],
  enemyTeamIn: SimPokemon[],
  bagItems: readonly { id: string }[],
  enemyBagItems: readonly { id: string }[],
  rng: () => number,
): boolean {
  const pTeam = cloneTeam(playerTeamIn);
  const eTeam = cloneTeam(enemyTeamIn).map((p) => ({
    ...p,
    currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
    maxHp: p.maxHp !== undefined ? p.maxHp : calcHp(p.baseStats.hp, p.level),
  }));

  let rounds = 0;
  const MAX_ROUNDS = 300;

  while (
    pTeam.some((p) => p.currentHp > 0) &&
    eTeam.some((p) => p.currentHp > 0) &&
    rounds < MAX_ROUNDS
  ) {
    rounds++;

    const pEntry = pTeam.map((p, i) => ({ p, idx: i })).find((x) => x.p.currentHp > 0);
    const eEntry = eTeam.map((p, i) => ({ p, idx: i })).find((x) => x.p.currentHp > 0);
    if (!pEntry || !eEntry) break;

    const { p: pActive, idx: pIdx } = pEntry;
    const { p: eActive, idx: eIdx } = eEntry;

    if (pActive.speciesId === 132 && !pActive._transformed) {
      pActive._transformed = true;
      pActive.types = [...(eActive.types || ["Normal"])];
      pActive.baseStats = { ...eActive.baseStats };
    }

    const pActiveItems = pActive.heldItem ? [pActive.heldItem] : [];
    const eActiveItems = eActive.heldItem ? [eActive.heldItem] : [];

    const pSpeed = getEffectiveStat(pActive, "speed", pActiveItems, pTeam);
    const eSpeed = getEffectiveStat(eActive, "speed", eActiveItems, pTeam);

    const pMove = getBestMove(pActive.types || ["Normal"], pActive.baseStats, pActive.speciesId, pActive.moveTier ?? 1);
    const eMove = getBestMove(eActive.types || ["Normal"], eActive.baseStats, eActive.speciesId, eActive.moveTier ?? 1);
    const bothUseless = !!(pMove.noDamage && eMove.noDamage);

    const turns =
      pSpeed >= eSpeed
        ? [
            {
              attacker: pActive,
              aIdx: pIdx,
              side: "player" as const,
              target: eActive,
              tIdx: eIdx,
              tSide: "enemy" as const,
            },
            {
              attacker: eActive,
              aIdx: eIdx,
              side: "enemy" as const,
              target: pActive,
              tIdx: pIdx,
              tSide: "player" as const,
            },
          ]
        : [
            {
              attacker: eActive,
              aIdx: eIdx,
              side: "enemy" as const,
              target: pActive,
              tIdx: pIdx,
              tSide: "player" as const,
            },
            {
              attacker: pActive,
              aIdx: pIdx,
              side: "player" as const,
              target: eActive,
              tIdx: eIdx,
              tSide: "enemy" as const,
            },
          ];

    for (const { attacker, aIdx, side, target, tIdx, tSide } of turns) {
      if (attacker.currentHp <= 0 || target.currentHp <= 0) continue;

      let move = getBestMove(attacker.types || ["Normal"], attacker.baseStats, attacker.speciesId, attacker.moveTier ?? 1);
      if (bothUseless) {
        move = { name: "Struggle", power: 50, type: "Normal", isSpecial: false, typeless: true };
      }
      if (!move.noDamage && typeEffectiveness(move.type, target.types || ["Normal"]) === 0) {
        move = { name: "Struggle", power: 50, type: "Normal", isSpecial: false, typeless: true };
      }

      const attackerItems = side === "player" ? pActiveItems : eActiveItems;
      const defenderItems = side === "player" ? eActiveItems : pActiveItems;

      if (move.noDamage) continue;

      const { damage } = calcDamage(attacker, target, move, attackerItems, defenderItems, pTeam, rng);

      const targetPreHp = target.currentHp;
      target.currentHp = Math.max(0, target.currentHp - damage);

      if (
        target.currentHp === 0 &&
        targetPreHp > 0 &&
        tSide === "player" &&
        target.heldItem?.id === "focus_band" &&
        rng() < 0.2
      ) {
        target.currentHp = 1;
      }
      if (
        target.currentHp === 0 &&
        targetPreHp === target.maxHp &&
        tSide === "player" &&
        target.heldItem?.id === "focus_sash"
      ) {
        target.currentHp = 1;
      }

      if (side === "player" && attacker.heldItem?.id === "life_orb") {
        const recoil = Math.max(1, Math.floor(attacker.maxHp * 0.1));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      }

      if (target.heldItem?.id === "rocky_helmet") {
        const helmet = Math.max(1, Math.floor(attacker.maxHp * 0.12));
        attacker.currentHp = Math.max(0, attacker.currentHp - helmet);
      }

      if (side === "player" && attacker.heldItem?.id === "shell_bell") {
        const heal = Math.max(1, Math.floor(damage * 0.25));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) attacker.currentHp += actual;
      }

      void aIdx;
      void tIdx;
    }

    const active = pTeam.map((p, i) => ({ p, i })).find((x) => x.p.currentHp > 0);
    if (active?.p.heldItem?.id === "leftovers") {
      const heal = Math.max(1, Math.floor(active.p.maxHp / 16));
      const actual = Math.min(heal, active.p.maxHp - active.p.currentHp);
      if (actual > 0) active.p.currentHp += actual;
    }
  }

  const playerWon = pTeam.some((p) => p.currentHp > 0) && !eTeam.some((p) => p.currentHp > 0);
  return playerWon;
}
