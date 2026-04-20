import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { minLevelForSpecies } from "../../../src/data/gen1-min-level.ts";

describe("minLevelForSpecies", () => {
  it("returns the evolution-trigger level for evolved species", () => {
    // data.js: Ivysaur (2) evolves at 16, Charizard (6) at 36, Venusaur (3) at 32.
    assert.equal(minLevelForSpecies(2), 16);
    assert.equal(minLevelForSpecies(3), 32);
    assert.equal(minLevelForSpecies(6), 36);
    // Mewtwo lands at L55.
    assert.equal(minLevelForSpecies(149), 55);
  });

  it("defaults to 1 for base-stage / unknown species", () => {
    assert.equal(minLevelForSpecies(1), 1); // Bulbasaur — unevolved
    assert.equal(minLevelForSpecies(132), 1); // Ditto — no evo chain
    assert.equal(minLevelForSpecies(9999), 1);
  });
});
