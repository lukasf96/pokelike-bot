import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseSpeciesIdFromSpriteUrl } from "../../src/state/parsers.ts";

// This fn is a regression guard for the "catch scoring silently disabled" bug
// (#3): the game emits sprites as /sprites/pokemon/<id>.png and we used to read
// a non-existent data-species-id attribute instead of the URL.

describe("parseSpeciesIdFromSpriteUrl", () => {
  const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

  it("parses a regular sprite URL", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/25.png`), 25);
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/150.png`), 150);
  });

  it("parses a shiny sprite URL", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/shiny/6.png`), 6);
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/shiny/151.png`), 151);
  });

  it("is case-insensitive about the extension", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/25.PNG`), 25);
  });

  it("returns null for URLs without a numeric id", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(""), null);
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/foo.png`), null);
    assert.equal(parseSpeciesIdFromSpriteUrl("https://example.com/pikachu.png"), null);
  });

  it("returns null for a malformed id of 0 (reserved / ambiguous)", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/0.png`), null);
  });

  it("tolerates trailing query strings / cache-busters", () => {
    assert.equal(parseSpeciesIdFromSpriteUrl(`${base}/25.png?v=2`), 25);
  });
});
