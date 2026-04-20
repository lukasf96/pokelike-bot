import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scoreCatchCandidate } from "../../../src/intel/catch-intel.ts";

// Species IDs used in these tests:
//   1  Bulbasaur   (Grass/Poison) → evolves through Venusaur (final BST 525)
//   69 Bellsprout  (Grass/Poison) → Weepinbell → Victreebel (final BST 490)
//   25 Pikachu     (Electric)      → Raichu                 (final BST 485)
//   86 Seel        (Water)         → Dewgong                (final BST 475)
//   96 Drowzee     (Psychic)       → Hypno                  (final BST 483)
//   74 Geodude     (Rock/Ground)   → Graveler → Golem       (final BST 495)

describe("scoreCatchCandidate", () => {
  it("gives a shiny final-evo a non-trivial positive score (regression: score=0 bug)", () => {
    // Pre-fix we returned 0 here because snapshot.ts reported speciesId=0.
    const score = scoreCatchCandidate(25, 4, /*isShiny*/ true, [], /*map*/ 0);
    assert.ok(score > 0, `expected > 0 for a shiny Pikachu, got ${score}`);
  });

  it("rewards a super-effective counter over a neutral catch when the team has none", () => {
    // On Misty (map 1) with only a Normal-type mon: Bellsprout (Grass SE vs
    // Staryu) must win over Seel (Water, no SE). This is the urgency lever —
    // the scorer gives +200 when the team lacks a counter for the next boss.
    const team = [["Normal"]];
    const bell = scoreCatchCandidate(69, 4, false, team, 1);
    const seel = scoreCatchCandidate(86, 4, false, team, 1);
    assert.ok(bell > seel, `Bellsprout (${bell}) should beat Seel (${seel}) when team has no Misty counter`);
  });

  it("prioritises the first SE counter when the team has none for the next boss", () => {
    // On Misty's map (1) with zero Water-hitters: Pikachu (Electric) must beat
    // a generic Psychic (Drowzee) by a wide margin.
    const teamNoCounter = [["Normal"]];
    const pika = scoreCatchCandidate(25, 4, false, teamNoCounter, 1);
    const drow = scoreCatchCandidate(96, 4, false, teamNoCounter, 1);
    assert.ok(
      pika > drow + 100,
      `Pikachu (${pika}) should dominate Drowzee (${drow}) as the only Misty counter`,
    );
  });

  it("penalises duplicate STAB on tiny teams (tests the 0.35× multiplier)", () => {
    // Team of 2 Grass/Poison → offering another Grass/Poison should be
    // multiplicatively capped so a type-variant candidate wins.
    const tiny = [
      ["Grass", "Poison"],
      ["Grass", "Poison"],
    ];
    const another = scoreCatchCandidate(69, 4, false, tiny, 0);
    const variant = scoreCatchCandidate(74, 4, false, tiny, 0); // Geodude Rock/Ground
    assert.ok(
      variant > another,
      `Geodude (${variant}) should beat a third Bellsprout (${another}) on a duplicate-type team`,
    );
  });

  it("rewards late-game carry types (Ice/Electric/Rock/Ghost STAB on Map 6+)", () => {
    // Isolate the +30 bonus: same species (Pikachu, Electric) on map 5 (no
    // bonus) vs map 6 (bonus). Other map-dependent terms are negligible here
    // because Electric doesn't SE-hit Sabrina (5) or Blaine (6), so the main
    // difference is the late-game bump.
    const team: string[][] = [["Normal"]];
    const map5 = scoreCatchCandidate(25, 20, false, team, 5);
    const map6 = scoreCatchCandidate(25, 20, false, team, 6);
    assert.ok(map6 > map5, `Electric STAB should score higher on map 6 (${map6}) than map 5 (${map5})`);
  });

  it("shiny bonus is stronger for high-BST species", () => {
    // Same level, no team context → only difference is shiny flag.
    const team: string[][] = [];
    const normal = scoreCatchCandidate(149 /*Dragonite*/, 50, false, team, 8);
    const shiny = scoreCatchCandidate(149, 50, true, team, 8);
    const diff = shiny - normal;
    assert.ok(diff >= 25 && diff <= 35, `shiny bump for Dragonite should be ~+30, got ${diff}`);
  });
});
