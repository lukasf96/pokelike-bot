import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MOVE_POOL, type MovePoolKey } from "../../../src/sim/game-move-pool.ts";

const ALL_TYPES: readonly MovePoolKey[] = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
];

// MOVE_POOL is a pure data table consumed by battle-sim. These tests pin its
// shape so accidental edits (missing tier, wrong split) show up immediately.

describe("MOVE_POOL", () => {
  it("covers every attacking type the game exposes", () => {
    for (const t of ALL_TYPES) {
      assert.ok(MOVE_POOL[t], `MOVE_POOL missing ${t}`);
    }
  });

  it("each type has exactly 3 physical + 3 special moves (tier 0/1/2)", () => {
    for (const t of ALL_TYPES) {
      const pool = MOVE_POOL[t];
      assert.equal(pool.physical.length, 3, `${t} physical should have 3 tiers`);
      assert.equal(pool.special.length, 3, `${t} special should have 3 tiers`);
    }
  });

  it("move power is monotonically non-decreasing across tiers", () => {
    for (const t of ALL_TYPES) {
      const pool = MOVE_POOL[t];
      for (const side of ["physical", "special"] as const) {
        const powers = pool[side].map((m) => m.power);
        assert.ok(
          powers[0]! <= powers[1]! && powers[1]! <= powers[2]!,
          `${t} ${side} tiers should be non-decreasing, got ${powers}`,
        );
      }
    }
  });

  it("all moves have a non-empty name and positive power", () => {
    for (const t of ALL_TYPES) {
      const pool = MOVE_POOL[t];
      for (const m of [...pool.physical, ...pool.special]) {
        assert.ok(m.name.length > 0, `${t}: empty move name`);
        assert.ok(m.power > 0, `${t} ${m.name}: non-positive power ${m.power}`);
      }
    }
  });
});
