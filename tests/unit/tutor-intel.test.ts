import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pickTutorSlot, type TutorTeamSlot } from "../../src/tutor-intel.ts";

describe("pickTutorSlot", () => {
  it("returns null when every slot is already tutored (moveTier ≥ 2)", () => {
    const team: TutorTeamSlot[] = [
      { speciesId: 1, level: 20, moveTier: 2 },
      { speciesId: 25, level: 20, moveTier: 2 },
    ];
    assert.equal(pickTutorSlot(team), null);
  });

  it("prefers final-evolution Pokémon over mid-stage ones, even at lower level", () => {
    const team: TutorTeamSlot[] = [
      // Mid-stage, high level
      { speciesId: 1, level: 40, moveTier: 1 }, // Bulbasaur (evolves → Ivysaur → Venusaur)
      // Final evo, lower level
      { speciesId: 131, level: 25, moveTier: 1 }, // Lapras (no evo)
      // Another mid-stage
      { speciesId: 7, level: 30, moveTier: 1 }, // Squirtle
    ];
    assert.equal(pickTutorSlot(team), 1, "should pick the final-evo Lapras");
  });

  it("picks highest BST×√level among final-evos when multiple are eligible", () => {
    const team: TutorTeamSlot[] = [
      { speciesId: 131, level: 20, moveTier: 1 }, // Lapras — BST 535
      { speciesId: 143, level: 20, moveTier: 1 }, // Snorlax — BST 540
      { speciesId: 128, level: 25, moveTier: 1 }, // Tauros — BST 490 but higher level
    ];
    const pick = pickTutorSlot(team);
    assert.ok(pick !== null);
    // Snorlax at L20 ≈ 540·√20 = 2415 vs Tauros L25 ≈ 490·5 = 2450. Tauros wins.
    assert.equal(pick, 2);
  });

  it("falls back to the best eligible slot when no final-evos are eligible", () => {
    const team: TutorTeamSlot[] = [
      { speciesId: 1, level: 15, moveTier: 1 }, // Bulbasaur
      { speciesId: 25, level: 25, moveTier: 1 }, // Pikachu (still evolves into Raichu)
    ];
    const pick = pickTutorSlot(team);
    assert.equal(pick, 1, "higher-level mid-stage wins when no final-evos present");
  });

  it("skips slots already at moveTier=2 in the pool", () => {
    const team: TutorTeamSlot[] = [
      { speciesId: 143, level: 40, moveTier: 2 }, // Snorlax already tutored — skip
      { speciesId: 131, level: 10, moveTier: 1 }, // Lapras — picks this
    ];
    assert.equal(pickTutorSlot(team), 1);
  });
});
