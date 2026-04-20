import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { deriveEliteIndex, parseDefeatContext } from "../../src/run-log.ts";
import type { GameSnapshot } from "../../src/state/types.ts";

// ── deriveEliteIndex ────────────────────────────────────────────────────────
//
// This fn is the fix for a bug we shipped: `state.eliteIndex` in localStorage
// is stale during Elite Four (doElite4 doesn't saveRun between fights), so we
// have to derive the index from the live battle title/subtitle instead.

describe("deriveEliteIndex", () => {
  it("reads 1-based Elite Four subtitle and converts to 0-based index", () => {
    assert.equal(deriveEliteIndex("Lorelei: Lorelei!", "Elite Four - Battle 1/4", 0), 0);
    assert.equal(deriveEliteIndex("Bruno: Bruno!", "Elite Four - Battle 2/4", 0), 1);
    assert.equal(deriveEliteIndex("Agatha: Agatha!", "Elite Four - Battle 3/4", 0), 2);
    assert.equal(deriveEliteIndex("Lance: Lance!", "Elite Four - Battle 4/4", 0), 3);
  });

  it("recognises Final Battle subtitle as champion (index 4)", () => {
    assert.equal(deriveEliteIndex("Champion: Gary!", "Final Battle!", 0), 4);
    assert.equal(deriveEliteIndex("anything", "Final Battle!", 0), 4);
  });

  it("recognises Champion title even when subtitle is missing", () => {
    assert.equal(deriveEliteIndex("Champion: Gary!", "", 0), 4);
  });

  it("falls back to name when subtitle parsing fails (stale / missing)", () => {
    assert.equal(deriveEliteIndex("Elite Four: Agatha!", "", 0), 2);
    assert.equal(deriveEliteIndex("Elite Four: LANCE!", "something unrelated", 0), 3);
  });

  it("returns the provided fallback when nothing matches", () => {
    assert.equal(deriveEliteIndex("Random text", "no match here", 7), 7);
    assert.equal(deriveEliteIndex("", "", 0), 0);
  });

  it("tolerates whitespace and casing in the subtitle regex", () => {
    assert.equal(deriveEliteIndex("x", "elite four - battle  3  /  4", 0), 2);
  });
});

// ── parseDefeatContext ──────────────────────────────────────────────────────

function makeGame(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    team: [],
    bag: [],
    currentMap: 0,
    eliteIndex: 0,
    badges: 0,
    ...overrides,
  };
}

describe("parseDefeatContext", () => {
  it("returns null when title is empty", () => {
    assert.equal(parseDefeatContext("", "", null), null);
  });

  it("parses wild Pokémon encounter", () => {
    const ctx = parseDefeatContext("Wild Pidgeotto appeared!", "Level 14", null);
    assert.deepEqual(ctx, { kind: "wild", pokemon: "Pidgeotto", level: 14 });
  });

  it("parses legendary encounter with Lv subtitle", () => {
    const ctx = parseDefeatContext("A legendary Moltres appeared!", "Lv 55", null);
    assert.deepEqual(ctx, { kind: "wild", pokemon: "Moltres", level: 55 });
  });

  it("parses gym battle with mapIndex from snapshot", () => {
    const ctx = parseDefeatContext(
      "Gym Battle vs Misty!",
      "Cascade Badge is on the line!",
      makeGame({ currentMap: 1 }),
    );
    assert.deepEqual(ctx, {
      kind: "gym",
      leader: "Misty",
      badge: "Cascade Badge",
      mapIndex: 1,
    });
  });

  it("parses Elite Four defeat and derives the correct in-loop index", () => {
    const ctx = parseDefeatContext(
      "Agatha: Agatha!",
      "Elite Four - Battle 3/4",
      makeGame({ currentMap: 8, eliteIndex: 0 }), // snapshot is stale at 0
    );
    assert.deepEqual(ctx, {
      kind: "elite",
      title: "Agatha",
      name: "Agatha",
      eliteIndex: 2, // derived from subtitle, NOT from the stale snapshot
    });
  });

  it("parses Champion defeat as eliteIndex 4", () => {
    const ctx = parseDefeatContext("Champion: Gary!", "Final Battle!", makeGame({ currentMap: 8 }));
    assert.deepEqual(ctx, {
      kind: "elite",
      title: "Champion",
      name: "Gary",
      eliteIndex: 4,
    });
  });

  it("parses regular trainer", () => {
    const ctx = parseDefeatContext("Bug Catcher Will wants to battle!", "", null);
    assert.deepEqual(ctx, { kind: "trainer", name: "Bug Catcher Will" });
  });

  it("returns kind=unknown for unrecognised titles (so we keep the raw strings in logs)", () => {
    const ctx = parseDefeatContext("Something weird happened", "with a subtitle", null);
    assert.deepEqual(ctx, {
      kind: "unknown",
      battleTitle: "Something weird happened",
      battleSubtitle: "with a subtitle",
    });
  });
});
