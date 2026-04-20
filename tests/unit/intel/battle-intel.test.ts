import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  attackingStabTypes,
  bossLevelStats,
  computeTeamOrder,
  computeTeamOrderAssignment,
  enemySequenceForIntel,
  inferNodeIntel,
  typeEffectiveness,
} from "../../../src/intel/battle-intel.ts";

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

describe("enemySequenceForIntel", () => {
  const ctx = { currentMap: 5, eliteIndex: 0 };

  it("returns the ordered gym sequence for gym nodes", () => {
    // Sabrina (map 5): [Psychic, Bug/Poison, Psychic, Psychic].
    const seq = enemySequenceForIntel({ category: "gym", mapIndex: 5 }, ctx);
    assert.ok(seq !== null);
    assert.equal(seq!.length, 4);
    assert.deepEqual(seq![0], ["Psychic"]);
    assert.deepEqual(seq![1], ["Bug", "Poison"]);
  });

  it("returns the ordered elite sequence for elite nodes", () => {
    const seq = enemySequenceForIntel({ category: "elite", eliteIndex: 0 }, { ...ctx, currentMap: 8 });
    assert.ok(seq !== null);
    assert.equal(seq!.length, 5);
  });

  it("returns null for sampled-enemy categories", () => {
    assert.equal(enemySequenceForIntel({ category: "wild", mapIndex: 3 }, ctx), null);
    assert.equal(enemySequenceForIntel({ category: "trainer", key: "bugcatcher" }, ctx), null);
    assert.equal(
      enemySequenceForIntel({ category: "dynamic_trainer", mapIndex: 3 }, ctx),
      null,
    );
    assert.equal(enemySequenceForIntel({ category: "legendary" }, ctx), null);
    assert.equal(enemySequenceForIntel({ category: "neutral" }, ctx), null);
  });
});

describe("computeTeamOrderAssignment", () => {
  it("assigns slot-to-slot for Sabrina (Bug to Psychic leads, Fire to Venomoth)", () => {
    // Sabrina: [Psychic, Bug/Poison, Psychic, Psychic]. With Gen-2+ chart
    // mirrored from data.js, Bug vs Poison = 0.5 and Fire vs Bug = 2, so:
    //   Bug  → +6 on Psychic slot,   −12 on Bug/Poison slot
    //   Fire → neutral on Psychic,   best on Bug/Poison (Fire 2× Bug)
    // Lead-only scoring would place Bug on slot 0 but completely waste
    // Sabrina's slot-1 Venomoth — assignment places Fire there explicitly.
    const team = [
      { types: ["Bug"], level: 40 }, // Scyther-ish — SE vs Psychic
      { types: ["Fire"], level: 40 }, // Charizard-ish — SE vs Bug/Poison
      { types: ["Electric"], level: 40 }, // bench filler
      { types: ["Water"], level: 40 }, // bench filler
    ];
    const sabrina = [["Psychic"], ["Bug", "Poison"], ["Psychic"], ["Psychic"]];
    const order = computeTeamOrderAssignment(team, sabrina);

    // Fire (idx 1) is uniquely best vs slot 1 Venomoth (+6 over every
    // other team member) — the defining case the lead-only heuristic missed.
    assert.equal(order[1], 1, `expected Fire mon on slot 1, got ${order.join(",")}`);

    // Bug (idx 0) dominates Psychic slots — slot 0 is the natural landing.
    assert.equal(order[0], 0, `expected Bug mon on slot 0, got ${order.join(",")}`);

    // The remaining two slots are filled by the benchers (order preserved or
    // not, but they must be in {2, 3}).
    assert.deepEqual(new Set(order.slice(2)), new Set([2, 3]));
  });

  it("pushes fainted members to the bench across the assignment", () => {
    const team = [
      { types: ["Bug"], level: 40, isFainted: true }, // best typing but fainted
      { types: ["Fire"], level: 40 },
      { types: ["Normal"], level: 40 },
    ];
    const sabrina = [["Psychic"], ["Bug", "Poison"]];
    const order = computeTeamOrderAssignment(team, sabrina);
    // Fainted mon must not be assigned to a front slot.
    assert.ok(order.slice(0, 2).every((i) => i !== 0), `fainted mon leaked to front: ${order}`);
    assert.equal(order[order.length - 1], 0);
  });

  it("is a no-op when the enemy sequence is empty", () => {
    const team = [{ types: ["Fire"] }, { types: ["Water"] }];
    assert.deepEqual(computeTeamOrderAssignment(team, []), [0, 1]);
  });

  it("handles teams larger than the enemy sequence (bench overflow)", () => {
    const team = [
      { types: ["Normal"], level: 10 },
      { types: ["Bug"], level: 20 }, // best vs Psychic
      { types: ["Fire"], level: 15 }, // best vs Bug/Poison
      { types: ["Water"], level: 10 },
      { types: ["Grass"], level: 10 },
    ];
    const enemySequence = [["Psychic"], ["Bug", "Poison"]];
    const order = computeTeamOrderAssignment(team, enemySequence);
    assert.equal(order.length, 5);
    assert.equal(new Set(order).size, 5);
    assert.equal(order[0], 1);
    assert.equal(order[1], 2);
  });

  it("differs from lead-only ordering when a non-lead slot has a unique counter", () => {
    // Lead-only ranks mons by average matchup over the lead pool. With three
    // Psychic slots and one Bug/Poison slot, a second Bug-typed mon out-ranks
    // Fire on average — so lead-only stacks two Bugs up front and Fire falls
    // to slot 2, leaving Venomoth to fight Electric/Water at neutral damage.
    // Assignment instead earmarks Fire for slot 1 where it's uniquely best.
    const team = [
      { types: ["Bug"], level: 40 }, // SE vs three Psychic slots
      { types: ["Bug"], level: 40 }, // second Bug — bumps avg above Fire
      { types: ["Fire"], level: 40 }, // uniquely SE vs Bug/Poison slot
      { types: ["Water"], level: 40 },
    ];
    const sabrina = [["Psychic"], ["Bug", "Poison"], ["Psychic"], ["Psychic"]];
    const leadPool = [["Psychic"], ...sabrina];

    const assignmentOrder = computeTeamOrderAssignment(team, sabrina);
    const leadOnlyOrder = computeTeamOrder(team, leadPool);

    assert.equal(assignmentOrder[1], 2, `assignment should place Fire on slot 1`);
    assert.notEqual(
      leadOnlyOrder[1],
      2,
      `lead-only should prefer a Bug on slot 1 by average; got ${leadOnlyOrder.join(",")}`,
    );
  });
});
