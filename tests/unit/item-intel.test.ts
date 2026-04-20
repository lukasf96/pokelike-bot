import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  bestEmptySlotForHeldItem,
  bestPokemonIndexForHeldItem,
  heldItemFitnessAtSlot,
  itemNameToId,
  optimalHeldItemPermutation,
  scoreItemPick,
  TYPE_BOOST_ATTACK_TYPE,
  type TeamMemberForItem,
} from "../../src/item-intel.ts";

function mon(over: Partial<TeamMemberForItem> & Pick<TeamMemberForItem, "types" | "level" | "speciesId">): TeamMemberForItem {
  return {
    baseStats: { hp: 60, atk: 60, def: 60, special: 60, spdef: 60, speed: 60, ...(over.baseStats ?? {}) },
    ...over,
  };
}

describe("itemNameToId", () => {
  it("lowercases, replaces whitespace, and strips punctuation", () => {
    assert.equal(itemNameToId("Lucky Egg"), "lucky_egg");
    assert.equal(itemNameToId("Mystic Water!"), "mystic_water");
    // Runs of whitespace collapse to a single underscore (`\s+` in the regex).
    assert.equal(itemNameToId("Moon  Stone"), "moon_stone");
  });
});

describe("TYPE_BOOST_ATTACK_TYPE", () => {
  it("maps each boost item to exactly one attack type", () => {
    const ids = Object.keys(TYPE_BOOST_ATTACK_TYPE);
    assert.ok(ids.length >= 14, `expected ≥14 boost items, got ${ids.length}`);
    assert.equal(TYPE_BOOST_ATTACK_TYPE.charcoal, "Fire");
    assert.equal(TYPE_BOOST_ATTACK_TYPE.miracle_seed, "Grass");
  });
});

describe("scoreItemPick", () => {
  const allPhysicalTeam: TeamMemberForItem[] = [
    mon({ speciesId: 4, level: 30, types: ["Fire"], baseStats: { hp: 60, atk: 95, def: 60, special: 60, speed: 60 } }),
    mon({ speciesId: 57, level: 30, types: ["Fighting"], baseStats: { hp: 60, atk: 105, def: 60, special: 60, speed: 60 } }),
    mon({ speciesId: 75, level: 30, types: ["Rock", "Ground"], baseStats: { hp: 55, atk: 95, def: 115, special: 45, speed: 35 } }),
    mon({ speciesId: 128, level: 30, types: ["Normal"], baseStats: { hp: 75, atk: 100, def: 95, special: 40, speed: 110 } }),
  ];

  const mixedTeam: TeamMemberForItem[] = [
    mon({ speciesId: 3, level: 30, types: ["Grass", "Poison"], baseStats: { hp: 80, atk: 82, def: 83, special: 100, speed: 80 } }),
    mon({ speciesId: 25, level: 30, types: ["Electric"], baseStats: { hp: 35, atk: 55, def: 40, special: 50, speed: 90 } }),
  ];

  it("gives lucky_egg a high base and life_orb a lower one", () => {
    assert.ok(scoreItemPick("lucky_egg", mixedTeam) > scoreItemPick("life_orb", mixedTeam));
  });

  it("boosts muscle_band when the team is all-physical", () => {
    const phys = scoreItemPick("muscle_band", allPhysicalTeam);
    const mixed = scoreItemPick("muscle_band", mixedTeam);
    assert.ok(phys > mixed, `expected all-physical team (${phys}) > mixed team (${mixed})`);
  });

  it("prefers max_revive when a teammate is fainted", () => {
    const faintedTeam: TeamMemberForItem[] = [
      mon({ speciesId: 1, level: 20, types: ["Grass"], currentHp: 0 }),
      mon({ speciesId: 25, level: 20, types: ["Electric"], currentHp: 40 }),
    ];
    const healthy: TeamMemberForItem[] = [
      mon({ speciesId: 1, level: 20, types: ["Grass"], currentHp: 50 }),
      mon({ speciesId: 25, level: 20, types: ["Electric"], currentHp: 40 }),
    ];
    assert.ok(scoreItemPick("max_revive", faintedTeam) > scoreItemPick("max_revive", healthy));
  });

  it("falls back to a neutral score for unknown items", () => {
    assert.equal(scoreItemPick("totally_made_up_item", mixedTeam), 20);
  });
});

describe("bestPokemonIndexForHeldItem", () => {
  const team: TeamMemberForItem[] = [
    mon({ speciesId: 1, level: 10, types: ["Grass", "Poison"], baseStats: { hp: 45, atk: 49, def: 49, special: 65, speed: 45 } }),
    mon({ speciesId: 25, level: 10, types: ["Electric"], baseStats: { hp: 35, atk: 55, def: 40, special: 50, speed: 90 } }),
    mon({ speciesId: 7, level: 10, types: ["Water"], baseStats: { hp: 44, atk: 48, def: 65, special: 50, speed: 43 } }),
  ];

  it("charcoal prefers a Fire STAB … but there isn't one, so picks a neutral holder", () => {
    const idx = bestPokemonIndexForHeldItem("charcoal", team);
    assert.ok(idx >= 0 && idx < team.length);
  });

  it("magnet lands on the Electric type", () => {
    assert.equal(bestPokemonIndexForHeldItem("magnet", team), 1);
  });

  it("miracle_seed lands on the Grass type", () => {
    assert.equal(bestPokemonIndexForHeldItem("miracle_seed", team), 0);
  });

  it("empty team → index 0 (safe default)", () => {
    assert.equal(bestPokemonIndexForHeldItem("miracle_seed", []), 0);
  });

  it("choice_band lands on the strongest physical attacker", () => {
    const idx = bestPokemonIndexForHeldItem("choice_band", team);
    assert.equal(idx, 1, "Pikachu has the highest atk × √L here");
  });
});

describe("bestEmptySlotForHeldItem", () => {
  it("skips slots that already hold items", () => {
    const team: TeamMemberForItem[] = [
      mon({
        speciesId: 1,
        level: 20,
        types: ["Grass", "Poison"],
        heldItem: { id: "miracle_seed" },
      }),
      mon({ speciesId: 25, level: 20, types: ["Electric"] }),
      mon({ speciesId: 7, level: 20, types: ["Water"] }),
    ];
    const idx = bestEmptySlotForHeldItem("magnet", team);
    assert.equal(idx, 1);
  });

  it("returns null when everyone already holds an item", () => {
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 1, level: 20, types: ["Grass"], heldItem: { id: "miracle_seed" } }),
      mon({ speciesId: 25, level: 20, types: ["Electric"], heldItem: { id: "magnet" } }),
    ];
    assert.equal(bestEmptySlotForHeldItem("charcoal", team), null);
  });
});

describe("heldItemFitnessAtSlot", () => {
  it("eviolite gets heavily penalized on a fully-evolved mon", () => {
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 3, level: 30, types: ["Grass", "Poison"] }), // Venusaur — no evo
      mon({ speciesId: 1, level: 30, types: ["Grass", "Poison"] }), // Bulbasaur — can evo
    ];
    const venu = heldItemFitnessAtSlot("eviolite", 0, team);
    const bulb = heldItemFitnessAtSlot("eviolite", 1, team);
    assert.ok(bulb > venu, `Bulbasaur (${bulb}) should fit eviolite better than Venusaur (${venu})`);
    assert.ok(venu < -100, `Venusaur eviolite score should be deeply negative, got ${venu}`);
  });

  it("type-boost items are amplified when they hit the next boss super-effectively", () => {
    // Misty = Water; Magnet → Electric → 2× Water.
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 25, level: 15, types: ["Electric"] }),
    ];
    const neutral = heldItemFitnessAtSlot("magnet", 0, team);
    const vsMisty = heldItemFitnessAtSlot("magnet", 0, team, { nextBossTypings: [["Water"], ["Water", "Psychic"]] });
    assert.ok(vsMisty > neutral, `boss-context fitness ${vsMisty} should exceed neutral ${neutral}`);
  });
});

describe("optimalHeldItemPermutation", () => {
  it("returns null when fewer than two Pokémon hold items", () => {
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 25, level: 20, types: ["Electric"], heldItem: { id: "magnet" } }),
      mon({ speciesId: 1, level: 20, types: ["Grass"] }),
    ];
    assert.equal(optimalHeldItemPermutation(team), null);
  });

  it("suggests swapping a mis-assigned type-boost pair", () => {
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 25, level: 25, types: ["Electric"], heldItem: { id: "miracle_seed" }, baseStats: { hp: 35, atk: 55, def: 40, special: 50, speed: 90 } }),
      mon({ speciesId: 3, level: 25, types: ["Grass", "Poison"], heldItem: { id: "magnet" }, baseStats: { hp: 80, atk: 82, def: 83, special: 100, speed: 80 } }),
    ];
    const res = optimalHeldItemPermutation(team);
    assert.ok(res, "should suggest a swap");
    assert.ok(res!.gain > 0, `gain should be positive, got ${res!.gain}`);
    // Swap: slot0 should receive item originally at slot1 (idx 1) and vice versa.
    assert.deepEqual(res!.bestPerm, [1, 0]);
  });

  it("returns null when the current assignment is already optimal", () => {
    const team: TeamMemberForItem[] = [
      mon({ speciesId: 25, level: 25, types: ["Electric"], heldItem: { id: "magnet" }, baseStats: { hp: 35, atk: 55, def: 40, special: 50, speed: 90 } }),
      mon({ speciesId: 3, level: 25, types: ["Grass", "Poison"], heldItem: { id: "miracle_seed" }, baseStats: { hp: 80, atk: 82, def: 83, special: 100, speed: 80 } }),
    ];
    assert.equal(optimalHeldItemPermutation(team), null);
  });
});
