import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseGameVersionFromTitleText } from "../../src/game-version.ts";

describe("parseGameVersionFromTitleText", () => {
  it("parses the tagged form from the real title copy", () => {
    assert.equal(
      parseGameVersionFromTitleText("POKELIKE — Pokemon Roguelike v1.3.1"),
      "1.3.1",
    );
  });

  it("parses two-part semvers (minor-only)", () => {
    assert.equal(parseGameVersionFromTitleText("Pokemon Roguelike v2.4"), "2.4");
  });

  it("falls back to loose vX.Y.Z anywhere in the text", () => {
    assert.equal(
      parseGameVersionFromTitleText("Welcome!  v0.12.3  — enjoy"),
      "0.12.3",
    );
  });

  it("returns null when no version is present", () => {
    assert.equal(parseGameVersionFromTitleText("POKELIKE Pokemon Roguelike"), null);
    assert.equal(parseGameVersionFromTitleText(""), null);
  });

  it("requires a 'v' prefix (so 'Map 2.1' doesn't match)", () => {
    assert.equal(parseGameVersionFromTitleText("Map 2.1 ahead"), null);
  });
});
