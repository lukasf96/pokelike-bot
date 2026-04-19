/**
 * Mirrors pokelike-source-files/data.js GYM_LEADERS + ELITE_4 team slots
 * (species, level, held item). Base stats come from GEN1_BASE_STATS at sim time.
 */

export interface BossSlotDef {
  speciesId: number;
  level: number;
  /** data.js heldItem id, or null */
  heldItemId: string | null;
}

export interface GymRosterDef {
  moveTier: number;
  team: BossSlotDef[];
}

export const GYM_ROSTERS: readonly GymRosterDef[] = [
  {
    moveTier: 0,
    team: [
      { speciesId: 74, level: 12, heldItemId: null },
      { speciesId: 95, level: 14, heldItemId: null },
    ],
  },
  {
    moveTier: 0,
    team: [
      { speciesId: 120, level: 18, heldItemId: null },
      { speciesId: 121, level: 20, heldItemId: null },
    ],
  },
  {
    moveTier: 1,
    team: [
      { speciesId: 25, level: 20, heldItemId: "eviolite" },
      { speciesId: 100, level: 23, heldItemId: "magnet" },
      { speciesId: 26, level: 26, heldItemId: "life_orb" },
    ],
  },
  {
    moveTier: 1,
    team: [
      { speciesId: 114, level: 26, heldItemId: "leftovers" },
      { speciesId: 71, level: 31, heldItemId: "poison_barb" },
      { speciesId: 45, level: 32, heldItemId: "miracle_seed" },
    ],
  },
  {
    moveTier: 1,
    team: [
      { speciesId: 109, level: 38, heldItemId: "rocky_helmet" },
      { speciesId: 109, level: 38, heldItemId: "rocky_helmet" },
      { speciesId: 89, level: 40, heldItemId: "poison_barb" },
      { speciesId: 110, level: 44, heldItemId: "leftovers" },
    ],
  },
  {
    moveTier: 1,
    team: [
      { speciesId: 122, level: 40, heldItemId: "twisted_spoon" },
      { speciesId: 49, level: 41, heldItemId: "silver_powder" },
      { speciesId: 64, level: 42, heldItemId: "eviolite" },
      { speciesId: 65, level: 44, heldItemId: "scope_lens" },
    ],
  },
  {
    moveTier: 2,
    team: [
      { speciesId: 77, level: 47, heldItemId: "charcoal" },
      { speciesId: 58, level: 47, heldItemId: "eviolite" },
      { speciesId: 78, level: 48, heldItemId: "charcoal" },
      { speciesId: 59, level: 53, heldItemId: "life_orb" },
    ],
  },
  {
    moveTier: 2,
    team: [
      { speciesId: 51, level: 55, heldItemId: "soft_sand" },
      { speciesId: 31, level: 53, heldItemId: "poison_barb" },
      { speciesId: 34, level: 54, heldItemId: "soft_sand" },
      { speciesId: 111, level: 56, heldItemId: "hard_stone" },
      { speciesId: 112, level: 60, heldItemId: "rocky_helmet" },
    ],
  },
];

export const ELITE_ROSTERS: readonly { team: BossSlotDef[] }[] = [
  {
    team: [
      { speciesId: 87, level: 54, heldItemId: "mystic_water" },
      { speciesId: 91, level: 53, heldItemId: "rocky_helmet" },
      { speciesId: 80, level: 54, heldItemId: "leftovers" },
      { speciesId: 124, level: 56, heldItemId: "wise_glasses" },
      { speciesId: 131, level: 56, heldItemId: "shell_bell" },
    ],
  },
  {
    team: [
      { speciesId: 95, level: 53, heldItemId: "rocky_helmet" },
      { speciesId: 107, level: 55, heldItemId: "black_belt" },
      { speciesId: 106, level: 55, heldItemId: "muscle_band" },
      { speciesId: 95, level: 54, heldItemId: "hard_stone" },
      { speciesId: 68, level: 58, heldItemId: "choice_band" },
    ],
  },
  {
    team: [
      { speciesId: 94, level: 54, heldItemId: "spell_tag" },
      { speciesId: 42, level: 54, heldItemId: "poison_barb" },
      { speciesId: 93, level: 56, heldItemId: "life_orb" },
      { speciesId: 42, level: 56, heldItemId: "sharp_beak" },
      { speciesId: 94, level: 58, heldItemId: "scope_lens" },
    ],
  },
  {
    team: [
      { speciesId: 130, level: 56, heldItemId: "mystic_water" },
      { speciesId: 149, level: 56, heldItemId: "dragon_fang" },
      { speciesId: 148, level: 58, heldItemId: "eviolite" },
      { speciesId: 148, level: 60, heldItemId: "dragon_fang" },
      { speciesId: 149, level: 62, heldItemId: "choice_band" },
    ],
  },
  {
    team: [
      { speciesId: 18, level: 61, heldItemId: "sharp_beak" },
      { speciesId: 65, level: 59, heldItemId: "twisted_spoon" },
      { speciesId: 112, level: 61, heldItemId: "soft_sand" },
      { speciesId: 103, level: 61, heldItemId: "miracle_seed" },
      { speciesId: 6, level: 65, heldItemId: "charcoal" },
    ],
  },
];
