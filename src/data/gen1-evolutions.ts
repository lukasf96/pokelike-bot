/**
 * Gen 1 evolution chain (mirrors `GEN1_EVOLUTIONS` in pokelike `data.js`).
 * `level` = level at which this species evolves into `into`.
 */
export interface Gen1EvolutionStep {
  into: number;
  level: number;
}

export const GEN1_EVOLUTIONS: Readonly<Record<number, Gen1EvolutionStep>> = {
  1: { into: 2, level: 16 },
  2: { into: 3, level: 32 },
  4: { into: 5, level: 16 },
  5: { into: 6, level: 36 },
  7: { into: 8, level: 16 },
  8: { into: 9, level: 36 },
  10: { into: 11, level: 7 },
  11: { into: 12, level: 10 },
  13: { into: 14, level: 7 },
  14: { into: 15, level: 10 },
  16: { into: 17, level: 18 },
  17: { into: 18, level: 36 },
  19: { into: 20, level: 20 },
  21: { into: 22, level: 20 },
  23: { into: 24, level: 22 },
  27: { into: 28, level: 22 },
  29: { into: 30, level: 16 },
  30: { into: 31, level: 36 },
  32: { into: 33, level: 16 },
  33: { into: 34, level: 36 },
  35: { into: 36, level: 36 },
  37: { into: 38, level: 32 },
  39: { into: 40, level: 36 },
  41: { into: 42, level: 22 },
  43: { into: 44, level: 21 },
  44: { into: 45, level: 36 },
  46: { into: 47, level: 24 },
  48: { into: 49, level: 31 },
  50: { into: 51, level: 26 },
  52: { into: 53, level: 28 },
  54: { into: 55, level: 33 },
  56: { into: 57, level: 28 },
  58: { into: 59, level: 34 },
  60: { into: 61, level: 25 },
  61: { into: 62, level: 40 },
  63: { into: 64, level: 16 },
  64: { into: 65, level: 36 },
  66: { into: 67, level: 28 },
  67: { into: 68, level: 40 },
  69: { into: 70, level: 21 },
  70: { into: 71, level: 36 },
  72: { into: 73, level: 30 },
  74: { into: 75, level: 25 },
  75: { into: 76, level: 40 },
  77: { into: 78, level: 40 },
  79: { into: 80, level: 37 },
  81: { into: 82, level: 30 },
  84: { into: 85, level: 31 },
  86: { into: 87, level: 34 },
  88: { into: 89, level: 38 },
  90: { into: 91, level: 36 },
  92: { into: 93, level: 25 },
  93: { into: 94, level: 38 },
  95: { into: 208, level: 40 },
  96: { into: 97, level: 26 },
  98: { into: 99, level: 28 },
  100: { into: 101, level: 30 },
  102: { into: 103, level: 36 },
  104: { into: 105, level: 28 },
  109: { into: 110, level: 35 },
  111: { into: 112, level: 42 },
  116: { into: 117, level: 32 },
  118: { into: 119, level: 33 },
  120: { into: 121, level: 36 },
  123: { into: 212, level: 40 },
  129: { into: 130, level: 20 },
  138: { into: 139, level: 40 },
  140: { into: 141, level: 40 },
  147: { into: 148, level: 30 },
  148: { into: 149, level: 55 },
};

/**
 * Base stat sums for evolution targets not covered by `GEN1_SPECIES_BST` (Onix→Steelix, Scyther→Scizor).
 * Source: PokeAPI (same as `GEN1_SPECIES_BST` in `gen1-species.ts`).
 */
export const CROSS_SPECIES_EVOLUTION_BST: Readonly<Record<number, number>> = {
  208: 510,
  212: 500,
};
