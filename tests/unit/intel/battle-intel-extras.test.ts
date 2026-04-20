import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  avgEnemyPressureVsTeam,
  eligibleTrainerSpeciesIds,
  enemyTypingsForIntel,
  expectedQuestionMarkSurfaceBase,
  leadTypingsPoolForIntel,
  matchupAdjustment,
  pickBattlePrepIntel,
  scoreCandidate,
  shouldReorderForBattle,
  type IntelContext,
  type MapCandidateBrief,
  type ScoreCandidateContext,
  type TeamMemberBrief,
} from "../../../src/intel/battle-intel.ts";

const ctx3: IntelContext = { currentMap: 3, eliteIndex: 0 };

describe("eligibleTrainerSpeciesIds", () => {
  it("returns a non-empty list for known trainer keys", () => {
    const bugcatcher = eligibleTrainerSpeciesIds("bugcatcher", 1);
    assert.ok(bugcatcher.length > 0);
  });

  it("returns an empty list for unknown trainer keys", () => {
    assert.deepEqual(eligibleTrainerSpeciesIds("totally_made_up_trainer", 3), []);
  });

  it("filters the pool by the map's max level (prevents L99 evolutions)", () => {
    // On Map 0 the cap is low; any id whose minimum level exceeds it should drop out.
    const early = eligibleTrainerSpeciesIds("bugcatcher", 0);
    const late = eligibleTrainerSpeciesIds("bugcatcher", 7);
    assert.ok(
      late.length >= early.length,
      `late pool (${late.length}) should include early pool (${early.length})`,
    );
  });
});

describe("matchupAdjustment", () => {
  it("returns 0 when there are no enemy typings", () => {
    const team: TeamMemberBrief[] = [{ types: ["Water"], level: 10 }];
    assert.equal(matchupAdjustment(team, []), 0);
  });

  it("is positive when team offense dominates enemy defense", () => {
    const team: TeamMemberBrief[] = [
      { types: ["Electric"], level: 20 },
      { types: ["Electric"], level: 18 },
    ];
    // Enemy is pure Water — Electric 2× offense, Water-only offense ½× back.
    const adj = matchupAdjustment(team, [["Water"]]);
    assert.ok(adj > 0, `Electric vs Water should be +, got ${adj}`);
  });

  it("is negative when enemy pressure exceeds team offense", () => {
    const team: TeamMemberBrief[] = [
      { types: ["Grass"], level: 10 }, // weak vs Fire, resists Water
      { types: ["Grass"], level: 8 },
    ];
    const adj = matchupAdjustment(team, [["Fire"]]); // Fire 2× vs Grass, Grass ½× vs Fire
    assert.ok(adj < 0, `Grass vs Fire should be negative, got ${adj}`);
  });
});

describe("avgEnemyPressureVsTeam", () => {
  it("returns 1 for empty team or empty enemy typings", () => {
    assert.equal(avgEnemyPressureVsTeam([], [["Water"]]), 1);
    assert.equal(avgEnemyPressureVsTeam([{ types: ["Water"], level: 10 }], []), 1);
  });

  it("picks the worst-case mon per enemy typing (highest threat)", () => {
    // Enemy = Electric; team has Water (2×) and Ground (0×). Worst-case mon vs Electric
    // is the Water one, so pressure should be 2.
    const pressure = avgEnemyPressureVsTeam(
      [
        { types: ["Water"], level: 10 },
        { types: ["Ground"], level: 10 },
      ],
      [["Electric"]],
    );
    assert.equal(pressure, 2);
  });
});

describe("expectedQuestionMarkSurfaceBase", () => {
  it("is a finite positive number", () => {
    const v = expectedQuestionMarkSurfaceBase();
    assert.ok(Number.isFinite(v) && v > 0);
  });

  it("is stable (pure math, no RNG)", () => {
    assert.equal(expectedQuestionMarkSurfaceBase(), expectedQuestionMarkSurfaceBase());
  });
});

describe("enemyTypingsForIntel", () => {
  it("returns fixed gym typings for gym nodes", () => {
    const t = enemyTypingsForIntel({ category: "gym", mapIndex: 0 }, ctx3);
    assert.ok(t.length >= 2, `Brock has Geodude+Onix+…, got ${t.length}`);
    assert.ok(t.some((typings) => typings.includes("Rock")));
  });

  it("returns fixed elite typings for elite nodes", () => {
    const t = enemyTypingsForIntel({ category: "elite", eliteIndex: 0 }, ctx3);
    assert.ok(t.length >= 2);
  });

  it("returns [] for neutral nodes", () => {
    assert.deepEqual(enemyTypingsForIntel({ category: "neutral" }, ctx3), []);
  });

  it("pulls the catch bucket for wild / dynamic_trainer", () => {
    const wild = enemyTypingsForIntel({ category: "wild", mapIndex: 3 }, ctx3);
    assert.ok(wild.length > 0);
  });
});

describe("leadTypingsPoolForIntel", () => {
  it("duplicates the lead mon's typing for gym nodes (weighted lead)", () => {
    const gym = leadTypingsPoolForIntel({ category: "gym", mapIndex: 0 }, ctx3);
    // First entry = lead mon (Geodude-ish Rock/Ground), and the full roster follows.
    assert.ok(gym.length >= 3, "lead + full roster");
  });

  it("returns [] for neutral nodes", () => {
    assert.deepEqual(leadTypingsPoolForIntel({ category: "neutral" }, ctx3), []);
  });
});

describe("shouldReorderForBattle", () => {
  it("always reorders for gym/elite/question-mark", () => {
    assert.ok(shouldReorderForBattle("gym", { category: "gym", mapIndex: 0 }, [["Rock"]]));
    assert.ok(shouldReorderForBattle("elite", { category: "elite", eliteIndex: 0 }, [["Ice"]]));
    assert.ok(shouldReorderForBattle("question", { category: "neutral" }, []));
  });

  it("reorders for trainers when enemy typings are known", () => {
    assert.ok(
      shouldReorderForBattle("trainer", { category: "trainer", key: "bugcatcher" }, [["Bug"]]),
    );
    assert.equal(
      shouldReorderForBattle("trainer", { category: "trainer", key: "bugcatcher" }, []),
      false,
    );
  });

  it("skips reorder for unknown surfaces", () => {
    assert.equal(shouldReorderForBattle("pokecenter", { category: "neutral" }, []), false);
    assert.equal(shouldReorderForBattle("catch", { category: "neutral" }, []), false);
  });
});

describe("pickBattlePrepIntel", () => {
  it("returns intel + matching enemy / lead typings pools", () => {
    const out = pickBattlePrepIntel(
      { href: "/sprites/brock.png", surfaceKind: "gym" } as MapCandidateBrief,
      { currentMap: 0, eliteIndex: 0 },
    );
    assert.equal(out.intel.category, "gym");
    assert.ok(out.enemyTypings.length > 0);
    assert.ok(out.leadTypingsPool.length > 0);
  });
});

describe("scoreCandidate", () => {
  const team: TeamMemberBrief[] = [
    { types: ["Grass", "Poison"], level: 20 },
    { types: ["Electric"], level: 18 },
    { types: ["Normal"], level: 15 },
  ];

  function ctxFor(over: Partial<ScoreCandidateContext>): ScoreCandidateContext {
    return {
      currentMap: 1,
      eliteIndex: 0,
      hpRatio: 1,
      bossImminent: false,
      pcAvailable: false,
      pWinBoss: 0.9,
      teamMaxLevel: 20,
      aliveTeamSize: 3,
      faintedCount: 0,
      bossLeadLevel: 18,
      bossMaxLevel: 20,
      teamHasBossCounter: true,
      ...over,
    };
  }

  it("prioritises Pokemon Center emergency heals when HP is low and boss is imminent", () => {
    const pc: MapCandidateBrief = { href: "/sprites/pokecenter.png", surfaceKind: "pokecenter" };
    const catchNode: MapCandidateBrief = { href: "/sprites/pokeball.png", surfaceKind: "catch" };
    const scored = scoreCandidate(
      true,
      pc,
      team,
      ctxFor({ hpRatio: 0.3, bossImminent: true, pcAvailable: true }),
    );
    const catchScored = scoreCandidate(
      true,
      catchNode,
      team,
      ctxFor({ hpRatio: 0.3, bossImminent: true, pcAvailable: true, aliveTeamSize: 5 }),
    );
    assert.ok(scored > catchScored, `PC emergency (${scored}) should beat catch (${catchScored})`);
  });

  it("PC scores negatively on a full-HP team (no need to heal)", () => {
    const pc: MapCandidateBrief = { href: "/sprites/pokecenter.png", surfaceKind: "pokecenter" };
    const s = scoreCandidate(false, pc, team, ctxFor({ hpRatio: 1, aliveTeamSize: 5 }));
    assert.ok(s < 0, `full-HP team shouldn't bother with PC (got ${s})`);
  });

  it("tiny-team catches score high (build coverage before grinding)", () => {
    const catchNode: MapCandidateBrief = { href: "/sprites/pokeball.png", surfaceKind: "catch" };
    const s = scoreCandidate(false, catchNode, team, ctxFor({ aliveTeamSize: 2 }));
    assert.ok(s >= 25, `tiny-team catch should score ≥25, got ${s}`);
  });

  it("catches on a saturated team de-prioritise (negative or near-zero)", () => {
    const catchNode: MapCandidateBrief = { href: "/sprites/pokeball.png", surfaceKind: "catch" };
    const s = scoreCandidate(
      false,
      catchNode,
      team,
      ctxFor({ aliveTeamSize: 6, bossImminent: true }),
    );
    assert.ok(s <= 1, `saturated+boss-imminent catch should be low, got ${s}`);
  });

  it("question-mark surfaces get a stable expected base score", () => {
    const q: MapCandidateBrief = { href: "/sprites/questionMark.png", surfaceKind: "question" };
    const s = scoreCandidate(false, q, team, ctxFor({}));
    assert.ok(s > 0);
  });
});
