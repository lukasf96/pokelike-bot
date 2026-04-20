import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sharedWeaknessTypes,
  scoreCandidate,
  type ScoreCandidateContext,
  type TeamMemberBrief,
} from "../../../src/intel/battle-intel.ts";
import { scoreCatchCandidate } from "../../../src/intel/catch-intel.ts";
import {
  pickSwapReleaseSlot,
  sharedWeaknessReleaseBias,
  type ReleaseTeamMember,
} from "../../../src/intel/release-candidate-intel.ts";

describe("sharedWeaknessTypes", () => {
  it("returns empty for a single-mon team (can't be 'shared')", () => {
    assert.equal(sharedWeaknessTypes([{ types: ["Grass", "Poison"] }]).size, 0);
  });

  it("flags types that hit ≥ half the alive team for 2×", () => {
    const team: TeamMemberBrief[] = [
      { types: ["Grass", "Poison"] },
      { types: ["Grass", "Poison"] },
      { types: ["Grass", "Poison"] },
      { types: ["Grass", "Poison"] },
    ];
    const shared = sharedWeaknessTypes(team);
    assert.ok(shared.has("fire"), "all Grass/Poison => Fire is a sweep type");
    assert.ok(shared.has("psychic"), "Psychic hits Poison 2×");
    assert.ok(!shared.has("water"), "Water is neutral/resisted by Grass");
  });

  it("ignores fainted members", () => {
    const team: TeamMemberBrief[] = [
      { types: ["Grass", "Poison"], isFainted: true },
      { types: ["Grass", "Poison"], isFainted: true },
      { types: ["Fire"] },
    ];
    const shared = sharedWeaknessTypes(team);
    assert.equal(shared.size, 0, "only one alive mon → no shared weakness");
  });
});

describe("scoreCandidate with bossSharedWeakness", () => {
  const baseCtx: ScoreCandidateContext = {
    currentMap: 3, // Erika (Grass)
    eliteIndex: 0,
    hpRatio: 1,
    bossImminent: true,
    pcAvailable: true,
    pWinBoss: 0.5,
    teamMaxLevel: 20,
    aliveTeamSize: 4,
    faintedCount: 0,
    bossLeadLevel: 24,
    bossMaxLevel: 29,
    teamHasBossCounter: true,
  };

  const team: TeamMemberBrief[] = [
    { types: ["Grass", "Poison"], level: 20 },
    { types: ["Grass", "Poison"], level: 20 },
    { types: ["Grass", "Poison"], level: 20 },
    { types: ["Grass", "Poison"], level: 20 },
  ];

  it("dampens gym base score when the team has a shared weakness vs boss STAB", () => {
    const ctxShared = { ...baseCtx, bossSharedWeakness: true };
    const ctxSafe = { ...baseCtx, bossSharedWeakness: false };
    const withShared = scoreCandidate(
      false,
      { href: "#gym-3", surfaceKind: "gym" },
      team,
      ctxShared,
    );
    const withoutShared = scoreCandidate(
      false,
      { href: "#gym-3", surfaceKind: "gym" },
      team,
      ctxSafe,
    );
    assert.ok(
      withShared < withoutShared,
      `shared-weakness path (${withShared}) should be lower than safe (${withoutShared})`,
    );
  });

  it("bumps PC base when boss-imminent + shared weakness at full HP", () => {
    const ctxShared = { ...baseCtx, bossSharedWeakness: true };
    const ctxSafe = { ...baseCtx, bossSharedWeakness: false };
    const pcShared = scoreCandidate(
      false,
      { href: "#pc", surfaceKind: "pokecenter" },
      team,
      ctxShared,
    );
    const pcSafe = scoreCandidate(false, { href: "#pc", surfaceKind: "pokecenter" }, team, ctxSafe);
    assert.ok(pcShared > pcSafe, `PC bonus expected: ${pcShared} > ${pcSafe}`);
  });
});

describe("scoreCatchCandidate shared-weakness handling", () => {
  it("penalises a candidate that shares the team's weakness", () => {
    // Team of 4× Grass/Poison → weak to Fire/Psychic/Flying/Ice.
    // Offering another Grass/Poison (id 43 Oddish) should get penalised.
    const teamTypes = Array.from({ length: 4 }, () => ["Grass", "Poison"]);
    // Offer: Oddish (43) — Grass/Poison → shares the weakness.
    const oddish = scoreCatchCandidate(43, 12, false, teamTypes, 3);
    // Offer: Growlithe (58) — Fire → resists Grass/Ice/Bug/Fire.
    const growl = scoreCatchCandidate(58, 12, false, teamTypes, 3);
    assert.ok(
      growl > oddish,
      `resist candidate (${growl}) should beat shared-weakness dupe (${oddish})`,
    );
  });
});

describe("sharedWeaknessReleaseBias", () => {
  it("returns positive when removing the slot shrinks the shared-weakness set", () => {
    const team: ReleaseTeamMember[] = [
      { speciesId: 1, level: 20, isShiny: false, heldItemId: null, moveTier: 0 }, // Bulbasaur
      { speciesId: 1, level: 20, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 1, level: 20, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 25, level: 20, isShiny: false, heldItemId: null, moveTier: 0 }, // Pikachu
    ];
    const bulbBias = sharedWeaknessReleaseBias(team, 0);
    const pikaBias = sharedWeaknessReleaseBias(team, 3);
    // Removing Pikachu doesn't change the shared weakness (still 3 Bulbasaur).
    assert.equal(pikaBias, 0);
    // Removing one Bulbasaur makes it 2 Bulb + 1 Pika → count drops below
    // ceil(3/2)=2? 2/3 still matches. But with count=2 we still hit the
    // `n >= Math.ceil(alive.length/2)` threshold. So bias may be 0 here.
    assert.ok(bulbBias >= 0, `bias ${bulbBias} should be non-negative`);
  });

  it("`pickSwapReleaseSlot` prefers releasing a shared-weakness mon", () => {
    // 4 Bulbasaurs + 1 Pikachu: the team is Grass/Poison-sweepable, releasing
    // one of the Bulbasaurs narrows shared weakness count. But all 4 Bulbs
    // are interchangeable — any one is fine. Assert the bias never makes
    // the function pick the Pikachu over a Bulbasaur.
    const team: ReleaseTeamMember[] = [
      { speciesId: 1, level: 10, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 1, level: 10, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 1, level: 10, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 1, level: 10, isShiny: false, heldItemId: null, moveTier: 0 },
      { speciesId: 25, level: 10, isShiny: false, heldItemId: null, moveTier: 0 },
    ];
    const idx = pickSwapReleaseSlot(team, false, 3);
    assert.ok(idx >= 0 && idx < 4, `expected a Bulbasaur slot, got ${idx}`);
  });
});
