import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  selectBagItemIds,
  selectMoonStoneInBag,
  selectTeamBrief,
  selectTeamHp,
} from "../../src/state/selectors.ts";
import type { GameSnapshot, Pokemon } from "../../src/state/types.ts";

function mon(over: Partial<Pokemon>): Pokemon {
  return {
    speciesId: 1,
    name: "Bulbasaur",
    level: 10,
    types: ["Grass", "Poison"],
    hp: { current: 30, max: 30 },
    isShiny: false,
    moveTier: 0,
    heldItemId: null,
    ...over,
  };
}

function snapshot(over: Partial<GameSnapshot>): GameSnapshot {
  return { team: [], bag: [], currentMap: 0, eliteIndex: 0, badges: 0, ...over };
}

describe("selectTeamHp", () => {
  it("returns ratio=1 and no fainted on a full team", () => {
    const g = snapshot({
      team: [mon({}), mon({ hp: { current: 20, max: 20 } })],
    });
    const s = selectTeamHp(g);
    assert.equal(s.fainted, 0);
    assert.equal(s.critical, 0);
    assert.equal(s.ratio, 1);
    assert.equal(s.lowHp, false);
  });

  it("counts fainted members (hp <= 0) and flags lowHp when any is fainted", () => {
    const g = snapshot({
      team: [mon({ hp: { current: 0, max: 30 } }), mon({})],
    });
    const s = selectTeamHp(g);
    assert.equal(s.fainted, 1);
    assert.equal(s.lowHp, true);
  });

  it("counts critical (<25%) and flags lowHp when ≥2 are critical", () => {
    const g = snapshot({
      team: [mon({ hp: { current: 5, max: 30 } }), mon({ hp: { current: 5, max: 30 } }), mon({})],
    });
    const s = selectTeamHp(g);
    assert.equal(s.critical, 2);
    assert.equal(s.lowHp, true);
  });

  it("flags lowHp on aggregate ratio below 0.55", () => {
    const g = snapshot({
      team: [mon({ hp: { current: 5, max: 30 } }), mon({ hp: { current: 10, max: 30 } })],
    });
    const s = selectTeamHp(g);
    assert.equal(s.lowHp, true);
    assert.ok(s.ratio < 0.55);
  });

  it("handles empty teams gracefully", () => {
    const s = selectTeamHp(snapshot({ team: [] }));
    assert.equal(s.ratio, 1);
    assert.equal(s.fainted, 0);
  });
});

describe("selectTeamBrief", () => {
  it("projects types, level, and fainted flag", () => {
    const brief = selectTeamBrief(
      snapshot({
        team: [mon({ level: 12 }), mon({ level: 8, hp: { current: 0, max: 20 } })],
      }),
    );
    assert.equal(brief.length, 2);
    assert.equal(brief[0]!.level, 12);
    assert.equal(brief[0]!.isFainted, false);
    assert.equal(brief[1]!.isFainted, true);
  });

  it("carries speciesId so lead ordering can demote Magikarp/Abra", () => {
    const brief = selectTeamBrief(
      snapshot({
        team: [mon({ speciesId: 129 }), mon({ speciesId: 63 }), mon({ speciesId: 1 })],
      }),
    );
    assert.equal(brief[0]!.speciesId, 129);
    assert.equal(brief[1]!.speciesId, 63);
    assert.equal(brief[2]!.speciesId, 1);
  });
});

describe("bag selectors", () => {
  it("selectBagItemIds filters out empty ids", () => {
    const g = snapshot({
      bag: [
        { idx: 0, id: "rare_candy", usable: true },
        { idx: 1, id: "", usable: false },
      ],
    });
    assert.deepEqual(selectBagItemIds(g), ["rare_candy"]);
  });

  it("selectMoonStoneInBag detects the moon_stone item", () => {
    assert.equal(
      selectMoonStoneInBag(snapshot({ bag: [{ idx: 0, id: "moon_stone", usable: true }] })),
      true,
    );
    assert.equal(
      selectMoonStoneInBag(snapshot({ bag: [{ idx: 0, id: "rare_candy", usable: true }] })),
      false,
    );
  });
});
