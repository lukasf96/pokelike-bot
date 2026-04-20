import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  attackingStabTypes,
  bossLevelStats,
  computeTeamOrder,
  inferNodeIntel,
  typeEffectiveness,
} from "../../src/battle-intel.ts";

describe("typeEffectiveness", () => {
  it("handles single-type defenders (Gen-1 chart)", () => {
    // Water vs Fire = 2×, Water vs Grass = ½×, Normal vs Ghost = 0×
    assert.equal(typeEffectiveness("Water", ["Fire"]), 2);
    assert.equal(typeEffectiveness("Water", ["Grass"]), 0.5);
    assert.equal(typeEffectiveness("Normal", ["Ghost"]), 0);
  });

  it("multiplies across dual-typed defenders", () => {
    // Electric vs Water/Flying = 2 × 2 = 4
    assert.equal(typeEffectiveness("Electric", ["Water", "Flying"]), 4);
    // Grass vs Fire/Flying = 0.5 × 0.5 = 0.25
    assert.equal(typeEffectiveness("Grass", ["Fire", "Flying"]), 0.25);
  });

  it("is case-insensitive on both attacker and defender", () => {
    assert.equal(typeEffectiveness("water", ["fire"]), 2);
    assert.equal(typeEffectiveness("WATER", ["FIRE"]), 2);
  });

  it("returns 1 for unknown types (safe default)", () => {
    assert.equal(typeEffectiveness("Cosmic", ["Fire"]), 1);
  });
});

describe("attackingStabTypes", () => {
  it("returns the single type for mono-typed Pokémon", () => {
    assert.deepEqual(attackingStabTypes(["Water"]), ["Water"]);
  });

  it("drops Normal in favour of the secondary when dual-typed", () => {
    assert.deepEqual(attackingStabTypes(["Normal", "Flying"]), ["Flying"]);
    assert.deepEqual(attackingStabTypes(["Flying", "Normal"]), ["Flying"]);
  });

  it("keeps both types when neither is Normal", () => {
    assert.deepEqual(attackingStabTypes(["Grass", "Poison"]), ["Grass", "Poison"]);
  });

  it("falls back to Normal for empty types", () => {
    assert.deepEqual(attackingStabTypes([]), ["Normal"]);
  });
});

describe("inferNodeIntel", () => {
  const ctx = { currentMap: 3, eliteIndex: 0 };

  it("classifies a grass encounter as wild on the current map", () => {
    assert.deepEqual(inferNodeIntel("/sprites/grass.png", ctx), {
      category: "wild",
      mapIndex: 3,
    });
  });

  it("classifies champ sprite as elite with the current eliteIndex", () => {
    assert.deepEqual(inferNodeIntel("/sprites/champ.png", { currentMap: 8, eliteIndex: 2 }), {
      category: "elite",
      eliteIndex: 2,
    });
  });

  it("classifies gym leader sprites as gym", () => {
    assert.deepEqual(inferNodeIntel("/sprites/misty.png", { ...ctx, currentMap: 1 }), {
      category: "gym",
      mapIndex: 1,
    });
  });

  it("classifies known trainer sprite stems", () => {
    assert.deepEqual(inferNodeIntel("/sprites/bugcatcher.png", ctx), {
      category: "trainer",
      key: "bugcatcher",
    });
  });

  it("classifies dynamic trainer sprites (acetrainer/oldguy)", () => {
    assert.deepEqual(inferNodeIntel("/sprites/acetrainer.png", ctx), {
      category: "dynamic_trainer",
      mapIndex: 3,
    });
  });

  it("classifies legendary encounters", () => {
    assert.equal(inferNodeIntel("/legendaryEncounter/foo.png", ctx).category, "legendary");
  });

  it("returns neutral for unknown sprite stems (item / PC / question mark)", () => {
    assert.equal(inferNodeIntel("/sprites/pokeball.png", ctx).category, "neutral");
  });
});

describe("bossLevelStats", () => {
  it("pulls Brock's roster when currentMap=0", () => {
    const { leadLevel, maxLevel } = bossLevelStats(0, 0);
    assert.equal(leadLevel, 12); // Geodude L12
    assert.equal(maxLevel, 14); // Onix L14
  });

  it("pulls Lance's roster for eliteIndex=3 at Map 8", () => {
    const { leadLevel, maxLevel } = bossLevelStats(8, 3);
    assert.equal(leadLevel, 56); // Gyarados L56
    assert.equal(maxLevel, 62); // Dragonite L62
  });

  it("clamps elite index to the available roster length", () => {
    const stats = bossLevelStats(8, 99);
    assert.ok(stats.leadLevel >= 50);
    assert.ok(stats.maxLevel >= stats.leadLevel);
  });
});

describe("computeTeamOrder", () => {
  it("puts the Electric mon first vs a Water/Flying lead (double SE)", () => {
    // Water-lead alone favours a Grass resist-and-SE mon, so we use a
    // double-SE scenario (Lance's Gyarados) to isolate the Electric pick.
    const team = [
      { types: ["Grass", "Poison"] }, // Bulbasaur — SE Grass but doubly-weak to Flying
      { types: ["Electric"] }, // Pikachu — 4× vs Water/Flying, neutral back
      { types: ["Normal"] },
    ];
    const order = computeTeamOrder(team, [["Water", "Flying"]]);
    assert.equal(order[0], 1);
  });

  it("pushes fainted Pokémon to the back", () => {
    const team = [
      { types: ["Electric"], isFainted: true }, // best typing but fainted
      { types: ["Normal"] },
      { types: ["Grass"] },
    ];
    const order = computeTeamOrder(team, [["Water"]]);
    assert.equal(order[order.length - 1], 0);
  });

  it("breaks ties on level (prefer higher-level lead among same typing)", () => {
    const team = [
      { types: ["Fire"], level: 8 },
      { types: ["Fire"], level: 13 },
    ];
    const order = computeTeamOrder(team, [["Grass"]]);
    assert.equal(order[0], 1);
  });

  it("returns identity order when the lead pool is empty", () => {
    const team = [{ types: ["Fire"] }, { types: ["Water"] }];
    assert.deepEqual(computeTeamOrder(team, []), [0, 1]);
  });
});
