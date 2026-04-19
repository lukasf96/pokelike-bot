/**
 * Mirrors pokelike-source-files/data.js MAP_BST_RANGES, GEN1_BST_APPROX,
 * MAP_LEVEL_RANGES, LEGENDARY_IDS for getCatchChoices(mapIndex).
 */

import { GEN1_SPECIES_BST } from "./data/gen1-species.js";

export const LEGENDARY_IDS: ReadonlySet<number> = new Set([144, 145, 146, 150, 151]);

/** data.js LEGENDARY_IDS — articuno, zapdos, moltres, mewtwo, mew */
export const LEGENDARY_SPECIES_IDS: readonly number[] = [144, 145, 146, 150, 151];

/** data.js MAP_BST_RANGES */
const MAP_BST_RANGES = [
  { min: 200, max: 310 },
  { min: 280, max: 360 },
  { min: 340, max: 420 },
  { min: 340, max: 420 },
  { min: 400, max: 480 },
  { min: 400, max: 480 },
  { min: 460, max: 530 },
  { min: 460, max: 530 },
  { min: 530, max: 999 },
];

/** data.js GEN1_BST_APPROX */
const GEN1_BST_APPROX = {
  low: [
    10, 11, 13, 14, 16, 17, 19, 20, 21, 23, 27, 29, 32, 41, 46, 48, 52, 54, 56, 60, 69, 72, 74, 79, 81, 84, 86,
    96, 98, 100, 102, 108, 111, 116, 118, 120, 129, 133,
  ],
  midLow: [
    25, 30, 33, 35, 37, 39, 43, 50, 58, 61, 63, 66, 73, 77, 83, 92, 95, 96, 104, 109, 113, 114, 116, 120, 122,
    126, 127, 128, 138, 140,
  ],
  mid: [
    26, 36, 42, 49, 51, 64, 67, 70, 75, 82, 85, 93, 97, 101, 103, 105, 107, 110, 119, 121, 124, 125, 130, 137,
    139, 141,
  ],
  midHigh: [40, 44, 55, 62, 76, 80, 87, 88, 89, 90, 91, 99, 106, 115, 117, 123, 131, 132, 137, 142, 143],
  high: [
    3, 6, 9, 12, 15, 18, 22, 24, 28, 31, 34, 38, 45, 47, 53, 57, 59, 65, 68, 71, 76, 78, 80, 89, 94, 112, 121,
    130, 142, 143, 149,
  ],
  veryHigh: [6, 9, 65, 68, 94, 112, 130, 131, 143, 147, 148, 149],
};

/** data.js MAP_LEVEL_RANGES */
const MAP_LEVEL_RANGES: readonly [number, number][] = [
  [1, 5],
  [8, 15],
  [14, 21],
  [21, 29],
  [29, 37],
  [37, 43],
  [43, 47],
  [47, 52],
  [53, 64],
];

/** Inclusive [min, max] level band for the current map (data.js MAP_LEVEL_RANGES). */
export function getMapLevelRange(mapIndex: number): [number, number] {
  return MAP_LEVEL_RANGES[Math.min(mapIndex, MAP_LEVEL_RANGES.length - 1)]!;
}

export function catchBucketIdsForMap(mapIndex: number): number[] {
  const range = MAP_BST_RANGES[Math.min(mapIndex, MAP_BST_RANGES.length - 1)]!;
  let bucket: readonly number[];
  if (range.min >= 530) bucket = GEN1_BST_APPROX.veryHigh;
  else if (range.min >= 460) bucket = GEN1_BST_APPROX.high;
  else if (range.min >= 400) bucket = GEN1_BST_APPROX.midHigh;
  else if (range.min >= 340) bucket = GEN1_BST_APPROX.mid;
  else if (range.min >= 280) bucket = GEN1_BST_APPROX.midLow;
  else bucket = GEN1_BST_APPROX.low;

  const uniq = [...new Set(bucket)].filter((id) => !LEGENDARY_IDS.has(id));
  return uniq.length > 0 ? uniq : [...new Set(bucket)];
}

export function maxLevelForMap(mapIndex: number): number {
  const r = MAP_LEVEL_RANGES[Math.min(mapIndex, MAP_LEVEL_RANGES.length - 1)]!;
  return r[1];
}

export function avgBstCatchPool(mapIndex: number): number {
  const ids = catchBucketIdsForMap(mapIndex);
  if (ids.length === 0) return 360;
  let sum = 0;
  for (const id of ids) sum += GEN1_SPECIES_BST[id] ?? 360;
  return sum / ids.length;
}
