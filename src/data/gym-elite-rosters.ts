/**
 * Mirrors pokelike-source-files/data.js GYM_LEADERS + ELITE_4 team slots
 * (species, level, held item, and authored base stats).
 *
 * Boss stats are authored in data.js with a single `special` that the game's
 * `battle.js getEffectiveStat` uses for BOTH Sp. Atk and Sp. Def (via the
 * `spdef ?? special` fallback). Mirroring the authored stats here — rather
 * than deriving from `GEN1_BASE_STATS` at sim time — keeps our win-probability
 * sim faithful to the real game for bosses whose authored `special` differs
 * from PokeAPI's Gen-2+ Sp. Atk (e.g. Growlithe: Gen-1 special=50, but
 * PokeAPI Sp. Atk=70), and crucially restores the high Sp. Def on mons like
 * Sabrina's Alakazam (authored special=135, but Gen-2+ Sp. Def=95 on PokeAPI).
 *
 * See tests/contract/rosters-match.test.ts for the drift check.
 */

export interface BossBaseStats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  /** Gen-1 authored special stat — serves as both Sp. Atk and Sp. Def at sim time. */
  special: number;
  /** Optional explicit Sp. Def. If omitted, the sim falls back to `special`. */
  spdef?: number;
}

export interface BossSlotDef {
  speciesId: number;
  level: number;
  /** data.js heldItem id, or null */
  heldItemId: string | null;
  /** Authored base stats from data.js GYM_LEADERS / ELITE_4. */
  baseStats: BossBaseStats;
}

export interface GymRosterDef {
  moveTier: number;
  team: BossSlotDef[];
}

export const GYM_ROSTERS: readonly GymRosterDef[] = [
  // Brock
  {
    moveTier: 0,
    team: [
      {
        speciesId: 74,
        level: 12,
        heldItemId: null,
        baseStats: { hp: 40, atk: 80, def: 100, speed: 20, special: 30 },
      },
      {
        speciesId: 95,
        level: 14,
        heldItemId: null,
        baseStats: { hp: 35, atk: 45, def: 160, speed: 70, special: 30 },
      },
    ],
  },
  // Misty
  {
    moveTier: 0,
    team: [
      {
        speciesId: 120,
        level: 18,
        heldItemId: null,
        baseStats: { hp: 30, atk: 45, def: 55, speed: 85, special: 70 },
      },
      {
        speciesId: 121,
        level: 20,
        heldItemId: null,
        baseStats: { hp: 60, atk: 75, def: 85, speed: 115, special: 100 },
      },
    ],
  },
  // Lt. Surge
  {
    moveTier: 1,
    team: [
      {
        speciesId: 25,
        level: 20,
        heldItemId: "eviolite",
        baseStats: { hp: 35, atk: 55, def: 40, speed: 90, special: 50 },
      },
      {
        speciesId: 100,
        level: 23,
        heldItemId: "magnet",
        baseStats: { hp: 40, atk: 30, def: 50, speed: 100, special: 55 },
      },
      {
        speciesId: 26,
        level: 26,
        heldItemId: "life_orb",
        baseStats: { hp: 60, atk: 90, def: 55, speed: 110, special: 90 },
      },
    ],
  },
  // Erika
  {
    moveTier: 1,
    team: [
      {
        speciesId: 114,
        level: 26,
        heldItemId: "leftovers",
        baseStats: { hp: 65, atk: 55, def: 115, speed: 60, special: 100 },
      },
      {
        speciesId: 71,
        level: 31,
        heldItemId: "poison_barb",
        baseStats: { hp: 80, atk: 105, def: 65, speed: 70, special: 100 },
      },
      {
        speciesId: 45,
        level: 32,
        heldItemId: "miracle_seed",
        baseStats: { hp: 75, atk: 80, def: 85, speed: 50, special: 110 },
      },
    ],
  },
  // Koga
  {
    moveTier: 1,
    team: [
      {
        speciesId: 109,
        level: 38,
        heldItemId: "rocky_helmet",
        baseStats: { hp: 40, atk: 65, def: 95, speed: 35, special: 60 },
      },
      {
        speciesId: 109,
        level: 38,
        heldItemId: "rocky_helmet",
        baseStats: { hp: 40, atk: 65, def: 95, speed: 35, special: 60 },
      },
      {
        speciesId: 89,
        level: 40,
        heldItemId: "poison_barb",
        baseStats: { hp: 105, atk: 105, def: 75, speed: 50, special: 65 },
      },
      {
        speciesId: 110,
        level: 44,
        heldItemId: "leftovers",
        baseStats: { hp: 65, atk: 90, def: 120, speed: 60, special: 85 },
      },
    ],
  },
  // Sabrina
  {
    moveTier: 1,
    team: [
      {
        speciesId: 122,
        level: 40,
        heldItemId: "twisted_spoon",
        baseStats: { hp: 40, atk: 45, def: 65, speed: 90, special: 100 },
      },
      {
        speciesId: 49,
        level: 41,
        heldItemId: "silver_powder",
        baseStats: { hp: 70, atk: 65, def: 60, speed: 90, special: 90 },
      },
      {
        speciesId: 64,
        level: 42,
        heldItemId: "eviolite",
        baseStats: { hp: 40, atk: 35, def: 30, speed: 105, special: 120 },
      },
      {
        speciesId: 65,
        level: 44,
        heldItemId: "scope_lens",
        baseStats: { hp: 55, atk: 50, def: 45, speed: 120, special: 135 },
      },
    ],
  },
  // Blaine
  {
    moveTier: 2,
    team: [
      {
        speciesId: 77,
        level: 47,
        heldItemId: "charcoal",
        baseStats: { hp: 50, atk: 85, def: 55, speed: 90, special: 65 },
      },
      {
        speciesId: 58,
        level: 47,
        heldItemId: "eviolite",
        baseStats: { hp: 55, atk: 70, def: 45, speed: 60, special: 50 },
      },
      {
        speciesId: 78,
        level: 48,
        heldItemId: "charcoal",
        baseStats: { hp: 65, atk: 100, def: 70, speed: 105, special: 80 },
      },
      {
        speciesId: 59,
        level: 53,
        heldItemId: "life_orb",
        baseStats: { hp: 90, atk: 110, def: 80, speed: 95, special: 100 },
      },
    ],
  },
  // Giovanni
  {
    moveTier: 2,
    team: [
      {
        speciesId: 51,
        level: 55,
        heldItemId: "soft_sand",
        baseStats: { hp: 35, atk: 100, def: 50, speed: 120, special: 50 },
      },
      {
        speciesId: 31,
        level: 53,
        heldItemId: "poison_barb",
        baseStats: { hp: 90, atk: 82, def: 87, speed: 76, special: 75 },
      },
      {
        speciesId: 34,
        level: 54,
        heldItemId: "soft_sand",
        baseStats: { hp: 81, atk: 92, def: 77, speed: 85, special: 75 },
      },
      {
        speciesId: 111,
        level: 56,
        heldItemId: "hard_stone",
        baseStats: { hp: 80, atk: 85, def: 95, speed: 25, special: 30 },
      },
      {
        speciesId: 112,
        level: 60,
        heldItemId: "rocky_helmet",
        baseStats: { hp: 105, atk: 130, def: 120, speed: 40, special: 45 },
      },
    ],
  },
];

export const ELITE_ROSTERS: readonly { team: BossSlotDef[] }[] = [
  // Lorelei
  {
    team: [
      {
        speciesId: 87,
        level: 54,
        heldItemId: "mystic_water",
        baseStats: { hp: 90, atk: 70, def: 80, speed: 70, special: 95 },
      },
      {
        speciesId: 91,
        level: 53,
        heldItemId: "rocky_helmet",
        baseStats: { hp: 50, atk: 95, def: 180, speed: 70, special: 85 },
      },
      {
        speciesId: 80,
        level: 54,
        heldItemId: "leftovers",
        baseStats: { hp: 95, atk: 75, def: 110, speed: 30, special: 100 },
      },
      {
        speciesId: 124,
        level: 56,
        heldItemId: "wise_glasses",
        baseStats: { hp: 65, atk: 50, def: 35, speed: 95, special: 95 },
      },
      {
        speciesId: 131,
        level: 56,
        heldItemId: "shell_bell",
        baseStats: { hp: 130, atk: 85, def: 80, speed: 60, special: 95 },
      },
    ],
  },
  // Bruno
  {
    team: [
      {
        speciesId: 95,
        level: 53,
        heldItemId: "rocky_helmet",
        baseStats: { hp: 35, atk: 45, def: 160, speed: 70, special: 30 },
      },
      {
        speciesId: 107,
        level: 55,
        heldItemId: "black_belt",
        baseStats: { hp: 50, atk: 105, def: 79, speed: 76, special: 35 },
      },
      {
        speciesId: 106,
        level: 55,
        heldItemId: "muscle_band",
        baseStats: { hp: 50, atk: 120, def: 53, speed: 87, special: 35 },
      },
      {
        speciesId: 95,
        level: 54,
        heldItemId: "hard_stone",
        baseStats: { hp: 35, atk: 45, def: 160, speed: 70, special: 30 },
      },
      {
        speciesId: 68,
        level: 58,
        heldItemId: "choice_band",
        baseStats: { hp: 90, atk: 130, def: 80, speed: 55, special: 65 },
      },
    ],
  },
  // Agatha
  {
    team: [
      {
        speciesId: 94,
        level: 54,
        heldItemId: "spell_tag",
        baseStats: { hp: 60, atk: 65, def: 60, speed: 110, special: 130 },
      },
      {
        speciesId: 42,
        level: 54,
        heldItemId: "poison_barb",
        baseStats: { hp: 75, atk: 80, def: 70, speed: 90, special: 75 },
      },
      {
        speciesId: 93,
        level: 56,
        heldItemId: "life_orb",
        baseStats: { hp: 45, atk: 50, def: 45, speed: 95, special: 115 },
      },
      {
        speciesId: 42,
        level: 56,
        heldItemId: "sharp_beak",
        baseStats: { hp: 75, atk: 80, def: 70, speed: 90, special: 75 },
      },
      {
        speciesId: 94,
        level: 58,
        heldItemId: "scope_lens",
        baseStats: { hp: 60, atk: 65, def: 60, speed: 110, special: 130 },
      },
    ],
  },
  // Lance
  {
    team: [
      {
        speciesId: 130,
        level: 56,
        heldItemId: "mystic_water",
        baseStats: { hp: 95, atk: 125, def: 79, speed: 81, special: 100 },
      },
      {
        speciesId: 149,
        level: 56,
        heldItemId: "dragon_fang",
        baseStats: { hp: 91, atk: 134, def: 95, speed: 80, special: 100 },
      },
      {
        speciesId: 148,
        level: 58,
        heldItemId: "eviolite",
        baseStats: { hp: 61, atk: 84, def: 65, speed: 70, special: 70 },
      },
      {
        speciesId: 148,
        level: 60,
        heldItemId: "dragon_fang",
        baseStats: { hp: 61, atk: 84, def: 65, speed: 70, special: 70 },
      },
      {
        speciesId: 149,
        level: 62,
        heldItemId: "choice_band",
        baseStats: { hp: 91, atk: 134, def: 95, speed: 80, special: 100 },
      },
    ],
  },
  // Gary (Champion)
  {
    team: [
      {
        speciesId: 18,
        level: 61,
        heldItemId: "sharp_beak",
        baseStats: { hp: 83, atk: 80, def: 75, speed: 101, special: 70 },
      },
      {
        speciesId: 65,
        level: 59,
        heldItemId: "twisted_spoon",
        baseStats: { hp: 55, atk: 50, def: 45, speed: 120, special: 135 },
      },
      {
        speciesId: 112,
        level: 61,
        heldItemId: "soft_sand",
        baseStats: { hp: 105, atk: 130, def: 120, speed: 40, special: 45 },
      },
      {
        speciesId: 103,
        level: 61,
        heldItemId: "miracle_seed",
        baseStats: { hp: 95, atk: 95, def: 85, speed: 55, special: 125 },
      },
      {
        speciesId: 6,
        level: 65,
        heldItemId: "charcoal",
        baseStats: { hp: 78, atk: 84, def: 78, speed: 100, special: 109 },
      },
    ],
  },
];
