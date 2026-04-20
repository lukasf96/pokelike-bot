/**
 * Contract: our mirror in `src/data/gym-elite-rosters.ts` must match the
 * teams defined in `pokelike-source-files/data.js`. The bot's win-probability
 * sim feeds those rosters directly, so any drift silently corrupts pWinBoss.
 *
 * We parse data.js with a lightweight regex extractor rather than evaling it
 * (eval'ing the game file would pull in missing globals). The parser pulls
 * speciesId / level / heldItem.id / baseStats for each entry — the surface
 * `win-probability.ts` feeds into `runBattle`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ELITE_ROSTERS, GYM_ROSTERS } from "../../src/data/gym-elite-rosters.ts";

const DATA_JS = path.resolve("pokelike-source-files", "Pokemon Roguelike_files", "data.js");

interface ParsedBaseStats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  special: number;
  spdef?: number;
}

interface ParsedSlot {
  speciesId: number;
  level: number;
  heldItemId: string | null;
  baseStats: ParsedBaseStats;
}

interface ParsedRoster {
  name: string;
  team: ParsedSlot[];
}

/** Extract the body of `const <arrayName> = [ ... ];` from a JS source. */
function extractArrayBody(src: string, arrayName: string): string {
  const rx = new RegExp(`const\\s+${arrayName}\\s*=\\s*\\[`);
  const m = rx.exec(src);
  assert.ok(m, `could not find ${arrayName} declaration in data.js`);
  let depth = 1;
  let i = m.index + m[0].length;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    if (depth === 0) break;
  }
  return src.slice(m.index + m[0].length, i);
}

/** Walk `src` from `from` and return the offsets of each top-level `{...}` span between matching braces at depth 1. */
function topLevelObjectSpans(src: string, from: number, to: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let depth = 0;
  let start = -1;
  for (let i = from; i < to; i++) {
    const c = src[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        spans.push([start, i + 1]);
        start = -1;
      }
    }
  }
  return spans;
}

/** Very narrow parser: pulls speciesId / level / heldItem.id per slot from data.js. */
function parseRosters(src: string, arrayName: string): ParsedRoster[] {
  const body = extractArrayBody(src, arrayName);
  return topLevelObjectSpans(body, 0, body.length).map(([s, e]) => {
    const rosterText = body.slice(s, e);
    const name = rosterText.match(/name:\s*'([^']+)'/)?.[1] ?? "?";

    // Locate the team array and parse each slot object individually so nested
    // `baseStats: { ... }` don't confuse field extraction.
    const teamStart = rosterText.indexOf("team:");
    const bracketStart = rosterText.indexOf("[", teamStart);
    const bracketEnd = findMatchingBracket(rosterText, bracketStart);
    const slotSpans = topLevelObjectSpans(rosterText, bracketStart + 1, bracketEnd);

    const slots: ParsedSlot[] = slotSpans.map(([ss, se]) => {
      const t = rosterText.slice(ss, se);
      const speciesId = Number(t.match(/speciesId:\s*(\d+)/)?.[1] ?? 0);
      const level = Number(t.match(/\blevel:\s*(\d+)/)?.[1] ?? 0);
      const heldItemId = t.match(/heldItem:\s*\{\s*id:\s*'([^']+)'/)?.[1] ?? null;
      const baseStats = parseBaseStats(t);
      return { speciesId, level, heldItemId, baseStats };
    });

    return { name, team: slots };
  });
}

/** Pull a numeric stat from a `baseStats: { ... }` literal in data.js. */
function parseBaseStats(slotText: string): ParsedBaseStats {
  const bsMatch = slotText.match(/baseStats:\s*\{([^}]*)\}/);
  assert.ok(bsMatch, `slot is missing baseStats: ${slotText.slice(0, 80)}`);
  const body = bsMatch[1]!;
  const num = (key: string): number => {
    const m = new RegExp(`\\b${key}\\s*:\\s*(\\d+)`).exec(body);
    assert.ok(m, `baseStats missing ${key}: ${body}`);
    return Number(m[1]);
  };
  const spdefMatch = /\bspdef\s*:\s*(\d+)/.exec(body);
  const out: ParsedBaseStats = {
    hp: num("hp"),
    atk: num("atk"),
    def: num("def"),
    speed: num("speed"),
    special: num("special"),
  };
  if (spdefMatch) out.spdef = Number(spdefMatch[1]);
  return out;
}

function findMatchingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length;
}

describe("GYM_ROSTERS mirrors data.js GYM_LEADERS", () => {
  const parsed = parseRosters(fs.readFileSync(DATA_JS, "utf8"), "GYM_LEADERS");

  it("has the same number of gym rosters (8)", () => {
    assert.equal(GYM_ROSTERS.length, 8);
    assert.equal(parsed.length, 8);
  });

  for (let i = 0; i < 8; i++) {
    it(`gym #${i} (${parsed[i]?.name ?? "?"}) team matches`, () => {
      const ours = GYM_ROSTERS[i]!.team;
      const theirs = parsed[i]!.team;
      assert.equal(
        ours.length,
        theirs.length,
        `gym #${i} team size differs (${ours.length} vs ${theirs.length})`,
      );
      for (let s = 0; s < ours.length; s++) {
        assert.equal(ours[s]!.speciesId, theirs[s]!.speciesId, `gym #${i} slot ${s} speciesId`);
        assert.equal(ours[s]!.level, theirs[s]!.level, `gym #${i} slot ${s} level`);
        assert.equal(ours[s]!.heldItemId, theirs[s]!.heldItemId, `gym #${i} slot ${s} heldItem`);
        assertBaseStatsMatch(ours[s]!.baseStats, theirs[s]!.baseStats, `gym #${i} slot ${s}`);
      }
    });
  }
});

describe("ELITE_ROSTERS mirrors data.js ELITE_4", () => {
  const parsed = parseRosters(fs.readFileSync(DATA_JS, "utf8"), "ELITE_4");

  it("has the same number of elite rosters (5)", () => {
    assert.equal(ELITE_ROSTERS.length, 5);
    assert.equal(parsed.length, 5);
  });

  for (let i = 0; i < 5; i++) {
    it(`elite #${i} (${parsed[i]?.name ?? "?"}) team matches`, () => {
      const ours = ELITE_ROSTERS[i]!.team;
      const theirs = parsed[i]!.team;
      assert.equal(ours.length, theirs.length);
      for (let s = 0; s < ours.length; s++) {
        assert.equal(ours[s]!.speciesId, theirs[s]!.speciesId, `elite #${i} slot ${s} speciesId`);
        assert.equal(ours[s]!.level, theirs[s]!.level, `elite #${i} slot ${s} level`);
        assert.equal(ours[s]!.heldItemId, theirs[s]!.heldItemId, `elite #${i} slot ${s} heldItem`);
        assertBaseStatsMatch(ours[s]!.baseStats, theirs[s]!.baseStats, `elite #${i} slot ${s}`);
      }
    });
  }
});

/**
 * Assert that every authored stat matches. We intentionally do NOT require
 * `spdef` to be present in either side — data.js almost never authors it, and
 * our mirror omits it when absent (the sim applies `spdef ?? special` at run
 * time, matching game `battle.js getEffectiveStat`). When both sides do
 * author spdef explicitly, they must agree.
 */
function assertBaseStatsMatch(
  ours: { hp: number; atk: number; def: number; speed: number; special: number; spdef?: number },
  theirs: ParsedBaseStats,
  ctx: string,
): void {
  assert.equal(ours.hp, theirs.hp, `${ctx} hp`);
  assert.equal(ours.atk, theirs.atk, `${ctx} atk`);
  assert.equal(ours.def, theirs.def, `${ctx} def`);
  assert.equal(ours.speed, theirs.speed, `${ctx} speed`);
  assert.equal(ours.special, theirs.special, `${ctx} special`);
  if (theirs.spdef !== undefined || ours.spdef !== undefined) {
    assert.equal(ours.spdef, theirs.spdef, `${ctx} spdef`);
  }
}
