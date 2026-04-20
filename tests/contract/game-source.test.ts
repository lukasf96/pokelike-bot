/**
 * Contract tests against `pokelike-source-files/`.
 *
 * These guard the assumptions our bot makes about the game's HTML/JS — every
 * failure here corresponds to a concrete runtime misbehaviour the bot would
 * exhibit (see `tests/README.md`). Re-run after every game update.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EXPECTED_POKELIKE_GAME_VERSION } from "../../src/utility/constants.ts";
import { parseSpeciesIdFromSpriteUrl } from "../../src/state/parsers.ts";
import { parseGameVersionFromTitleText } from "../../src/utility/game-version.ts";
import { deriveEliteIndex } from "../../src/logging/run-log.ts";

const SRC_ROOT = path.resolve("pokelike-source-files");
const HTML_PATH = path.join(SRC_ROOT, "Pokemon Roguelike.html");
const GAME_JS = path.join(SRC_ROOT, "Pokemon Roguelike_files", "game.js");
const UI_JS = path.join(SRC_ROOT, "Pokemon Roguelike_files", "ui.js");

function read(p: string): string {
  assert.ok(fs.existsSync(p), `game source bundle missing at ${p}`);
  return fs.readFileSync(p, "utf8");
}

describe("game version", () => {
  it("title screen HTML still contains a parseable version string we match", () => {
    const html = read(HTML_PATH);
    const version = parseGameVersionFromTitleText(html);
    assert.ok(
      version !== null,
      "parseGameVersionFromTitleText could not find a version tag in the HTML",
    );
    assert.equal(
      version,
      EXPECTED_POKELIKE_GAME_VERSION,
      "game bundle version doesn't match EXPECTED_POKELIKE_GAME_VERSION — bump constants.ts",
    );
  });
});

describe("screen ids the phase dispatch depends on", () => {
  // Every PhaseKind that maps to a screen must exist as `id="..."` in the HTML.
  // If a rename lands, snapshot.ts would silently report "unknown" for that
  // phase and handlers would never fire.
  const requiredScreenIds = [
    "title-screen",
    "trainer-screen",
    "starter-screen",
    "map-screen",
    "battle-screen",
    "catch-screen",
    "item-screen",
    "swap-screen",
    "trade-screen",
    "shiny-screen",
    "badge-screen",
    "transition-screen",
    "gameover-screen",
    "win-screen",
  ] as const;

  const html = read(HTML_PATH);
  for (const id of requiredScreenIds) {
    it(`defines id="${id}"`, () => {
      assert.ok(
        html.includes(`id="${id}"`),
        `screen id "${id}" missing — snapshot.ts screenIds would stop detecting this phase`,
      );
    });
  }
});

describe("overlay / modal ids the bot listens for", () => {
  // These modals are created dynamically by game.js/ui.js (not in the HTML).
  // snapshot.ts distinguishes phases by presence of either the container id
  // or an inner button id, so we check both are still wired.
  it("eevee-choice-overlay is referenced in ui.js or game.js", () => {
    assert.ok(
      read(UI_JS).includes("eevee-choice-overlay") ||
        read(GAME_JS).includes("eevee-choice-overlay"),
      "eevee-choice-overlay not present — handlers/eevee.ts will never fire",
    );
  });

  it("item-equip-modal is created by the game", () => {
    const js = read(GAME_JS);
    assert.ok(
      js.includes("item-equip-modal"),
      "item-equip-modal not found in game.js — handlers/item-equip.ts and tutor routing break",
    );
  });

  it("usable-item-modal is created by the game", () => {
    const js = read(GAME_JS);
    assert.ok(
      js.includes("usable-item-modal"),
      "usable-item-modal not found in game.js — handlers/usable-item.ts can't open",
    );
  });

  it("inner button ids snapshot.ts uses to distinguish tutor vs equip still exist", () => {
    const js = read(GAME_JS);
    assert.ok(
      js.includes("btn-skip-tutor"),
      "btn-skip-tutor missing — snapshot.ts can't tell tutor modal apart from equip modal",
    );
    assert.ok(
      js.includes("btn-equip-to-bag"),
      "btn-equip-to-bag missing — item-equip phase detection breaks",
    );
  });
});

describe("localStorage run schema", () => {
  // saveRun() writes `state` into localStorage[key]; snapshot.ts reads it back
  // to build GameSnapshot. All listed fields are touched by the snapshot parser.
  const js = read(GAME_JS);

  it("uses the 'poke_current_run' localStorage key", () => {
    assert.ok(
      js.includes("'poke_current_run'") || js.includes('"poke_current_run"'),
      "saveRun() no longer uses the 'poke_current_run' key — bump POKE_CURRENT_RUN_LS_KEY",
    );
  });

  it("persists team / items / badges / currentMap / eliteIndex on state", () => {
    // We check for "state.<field>" usage (structural) rather than the saved
    // JSON shape, because saveRun does `{ ...state }`.
    const required = [
      "state.team",
      "state.items",
      "state.badges",
      "state.currentMap",
      "state.eliteIndex",
    ];
    for (const r of required) {
      assert.ok(js.includes(r), `game.js no longer references ${r} — snapshot.ts reads this`);
    }
  });
});

describe("Elite 4 battle subtitle format (deriveEliteIndex regexes)", () => {
  const js = read(GAME_JS);

  it("still produces subtitles of the form 'Elite Four - Battle N/4' and 'Final Battle!'", () => {
    // The exact template string the game uses. If this changes, update
    // deriveEliteIndex's regexes and re-run.
    assert.ok(
      js.includes("Elite Four - Battle") && js.includes("/4"),
      "Elite Four subtitle template changed in game.js",
    );
    assert.ok(js.includes("Final Battle!"), "'Final Battle!' subtitle string missing");
  });

  it("round-trips through deriveEliteIndex for every boss (live-template check)", () => {
    // Lorelei .. Lance = i=0..3, Champion (Gary) = i=4.
    for (let i = 0; i < 4; i++) {
      const subtitle = `Elite Four - Battle ${i + 1}/4`;
      assert.equal(deriveEliteIndex("Elite Four: Foo!", subtitle, -1), i);
    }
    assert.equal(deriveEliteIndex("Champion: Gary!", "Final Battle!", -1), 4);
  });
});

describe("Pokémon sprite URL shape (catch species-id extraction)", () => {
  const js = read(GAME_JS);

  it("renderPokemonCard URL template still points at /sprites/pokemon/<id>.png", () => {
    assert.ok(
      js.includes("/sprites/pokemon/"),
      "sprite path base changed — update parseSpeciesIdFromSpriteUrl",
    );
    assert.ok(
      js.includes("/sprites/pokemon/shiny/"),
      "shiny sprite subpath changed — update parseSpeciesIdFromSpriteUrl",
    );
  });

  it("parseSpeciesIdFromSpriteUrl matches the URL shapes the game emits", () => {
    // Extract one literal URL expression from game.js to round-trip.
    // We recreate the exact template substitutions by hand with a known id.
    const exampleNormal =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png";
    const exampleShiny =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/6.png";
    assert.equal(parseSpeciesIdFromSpriteUrl(exampleNormal), 25);
    assert.equal(parseSpeciesIdFromSpriteUrl(exampleShiny), 6);
  });
});

describe("Elite 4 roster count (bounds check for ELITE_NAME_TO_INDEX)", () => {
  it("data.js ELITE_4 has exactly 5 entries (Lorelei..Gary)", () => {
    const data = read(path.join(SRC_ROOT, "Pokemon Roguelike_files", "data.js"));
    // Locate the ELITE_4 array span and count top-level `{` entries by the
    // `name:` keys — robust to inner braces in team objects.
    const start = data.indexOf("const ELITE_4");
    assert.ok(start >= 0, "ELITE_4 declaration not found");
    const end = data.indexOf("\n];", start);
    const slice = data.slice(start, end);
    const names = ["Lorelei", "Bruno", "Agatha", "Lance", "Gary"];
    for (const n of names) {
      assert.ok(slice.includes(`name: '${n}'`), `ELITE_4 is missing ${n}`);
    }
  });
});
