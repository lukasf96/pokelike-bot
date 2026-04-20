import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  adjustMapScoreWithWinProbability,
  estimateBattleWinProbability,
  normalizeSimTeam,
} from "../../../src/sim/win-probability.ts";
import type { NodeIntel } from "../../../src/intel/battle-intel.ts";

const CTX = { currentMap: 0, eliteIndex: 0 };

describe("normalizeSimTeam", () => {
  it("skips entries without a speciesId and fills in defaults", () => {
    const team = normalizeSimTeam([
      {
        speciesId: 25,
        level: 20,
        types: ["Electric"],
        baseStats: { hp: 35, atk: 55, def: 40, special: 50, speed: 90 },
      },
      { speciesId: 0 }, // dropped
      null,
      { speciesId: 1, level: 5 }, // falls back to defaults
    ]);
    assert.equal(team.length, 2);
    assert.equal(team[0]!.speciesId, 25);
    assert.equal(team[1]!.speciesId, 1);
    assert.ok(team[1]!.baseStats.hp > 0, "missing baseStats should default from GEN1_BASE_STATS");
  });

  it("clamps level into [1, 100] and moveTier into [0, 2]", () => {
    const team = normalizeSimTeam([
      { speciesId: 1, level: 999, moveTier: 17 },
      { speciesId: 1, level: -5, moveTier: -5 },
    ]);
    assert.equal(team[0]!.level, 100);
    assert.equal(team[0]!.moveTier, 2);
    assert.equal(team[1]!.level, 1);
    assert.equal(team[1]!.moveTier, 0);
  });

  it("returns an empty team for non-array input", () => {
    assert.deepEqual(normalizeSimTeam(null), []);
    assert.deepEqual(normalizeSimTeam("not-an-array"), []);
  });
});

describe("estimateBattleWinProbability", () => {
  const STRONG_TEAM = [
    // Late-game carry: L60 Venusaur-equivalent stats
    {
      speciesId: 3,
      level: 60,
      types: ["Grass", "Poison"],
      currentHp: 180,
      maxHp: 180,
      baseStats: { hp: 80, atk: 82, def: 83, special: 100, speed: 80, spdef: 100 },
    },
  ];

  const WEAK_TEAM = [
    {
      speciesId: 10,
      level: 3,
      types: ["Bug"],
      currentHp: 18,
      maxHp: 18,
      baseStats: { hp: 45, atk: 30, def: 35, special: 20, speed: 45, spdef: 20 },
    },
  ];

  it("returns a value in [0, 1]", () => {
    const p = estimateBattleWinProbability(
      { category: "gym", mapIndex: 0 } satisfies NodeIntel,
      STRONG_TEAM,
      [],
      CTX,
      { samples: 16, seed: 1 },
    );
    assert.ok(p >= 0 && p <= 1, `p out of bounds: ${p}`);
  });

  it("is deterministic for a fixed seed and sample count", () => {
    const intel: NodeIntel = { category: "gym", mapIndex: 0 };
    const a = estimateBattleWinProbability(intel, STRONG_TEAM, [], CTX, { samples: 24, seed: 7 });
    const b = estimateBattleWinProbability(intel, STRONG_TEAM, [], CTX, { samples: 24, seed: 7 });
    assert.equal(a, b);
  });

  it("scores near-certain win for a massively overlevelled team vs early gym", () => {
    const p = estimateBattleWinProbability(
      { category: "gym", mapIndex: 0 } satisfies NodeIntel,
      STRONG_TEAM,
      [],
      { currentMap: 0, eliteIndex: 0 },
      { samples: 24, seed: 11 },
    );
    assert.ok(p > 0.8, `expected ≳ 0.8 vs Brock with L60 Venusaur, got ${p}`);
  });

  it("scores a very low win rate for a weak team vs the Elite 4", () => {
    const p = estimateBattleWinProbability(
      { category: "elite", eliteIndex: 4 } satisfies NodeIntel,
      WEAK_TEAM,
      [],
      { currentMap: 8, eliteIndex: 4 },
      { samples: 24, seed: 3 },
    );
    assert.ok(p < 0.3, `expected ≲ 0.3 vs Champion Gary with L3 Caterpie, got ${p}`);
  });

  it("returns 1.0 for non-battle node categories (safe default)", () => {
    const p = estimateBattleWinProbability(
      { category: "neutral" } satisfies NodeIntel,
      STRONG_TEAM,
      [],
      CTX,
      { samples: 8, seed: 0 },
    );
    assert.equal(p, 1);
  });

  it("returns 0 for an empty player team", () => {
    const p = estimateBattleWinProbability(
      { category: "wild", mapIndex: 0 } satisfies NodeIntel,
      [],
      [],
      CTX,
      { samples: 8, seed: 0 },
    );
    assert.equal(p, 0);
  });
});

describe("adjustMapScoreWithWinProbability", () => {
  const legendary: NodeIntel = { category: "legendary" };
  const wild: NodeIntel = { category: "wild", mapIndex: 0 };
  const trainer: NodeIntel = { category: "trainer", key: "bugcatcher" };
  const dynamicTrainer: NodeIntel = { category: "dynamic_trainer", mapIndex: 0 };
  const gym: NodeIntel = { category: "gym", mapIndex: 0 };
  const elite: NodeIntel = { category: "elite", eliteIndex: 0 };

  it("refuses legendaries below the 0.55 floor", () => {
    assert.ok(adjustMapScoreWithWinProbability(100, legendary, false, 0.4) < 0);
    assert.ok(adjustMapScoreWithWinProbability(100, legendary, false, 0.7) > 0);
  });

  it("refuses low-hp wild fights below 0.5 pWin", () => {
    assert.ok(adjustMapScoreWithWinProbability(100, wild, true, 0.3) < 0);
    assert.ok(adjustMapScoreWithWinProbability(100, wild, true, 0.6) > 0);
  });

  it("refuses static trainers below 0.3 pWin (stricter when solo)", () => {
    assert.ok(adjustMapScoreWithWinProbability(100, trainer, false, 0.2) < 0);
    assert.ok(adjustMapScoreWithWinProbability(100, trainer, false, 0.45) > 0);
    // Solo → floor 0.55
    assert.ok(
      adjustMapScoreWithWinProbability(100, trainer, false, 0.45, { aliveTeamSize: 1 }) < 0,
    );
  });

  it("refuses dynamic trainers on tiny teams even at pWin=1 (variance blow-up)", () => {
    assert.ok(
      adjustMapScoreWithWinProbability(100, dynamicTrainer, false, 0.8, { aliveTeamSize: 2 }) < 0,
    );
    assert.ok(
      adjustMapScoreWithWinProbability(100, dynamicTrainer, false, 0.9, { aliveTeamSize: 4 }) > 0,
    );
  });

  it("refusals preserve pWin ordering (higher pWin → less negative)", () => {
    const low = adjustMapScoreWithWinProbability(100, trainer, false, 0.1);
    const mid = adjustMapScoreWithWinProbability(100, trainer, false, 0.2);
    assert.ok(mid > low, `expected ${mid} > ${low} (graduated refusal)`);
  });

  it("boss nodes (gym/elite) never get refused — only multiplied", () => {
    // The pokelike map terminates in a single boss node, so when a gym/elite
    // reaches `candidates` it's always the only option; refusing it would
    // just re-order against nothing. We keep it strictly multiplicative.
    const g = adjustMapScoreWithWinProbability(100, gym, false, 0.1);
    const e = adjustMapScoreWithWinProbability(100, elite, false, 0.1);
    assert.ok(g > 0 && e > 0, `bosses should never be negatived (got gym=${g}, elite=${e})`);
  });

  it("trainer multiplier has a floor (≥ 0.65× base score)", () => {
    const s = adjustMapScoreWithWinProbability(100, trainer, false, 0.0);
    // pWin=0 refuses, so test at the floor of the passing band:
    const s2 = adjustMapScoreWithWinProbability(100, trainer, false, 0.31);
    assert.ok(s2 >= 65, `trainer multiplier should be ≥0.65× (got ${s2})`);
    void s;
  });
});
