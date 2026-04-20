/**
 * Contract: every type appearing in `GEN1_SPECIES_TYPES` MUST have a row in
 * the game's `TYPE_CHART` (parsed from `pokelike-source-files/data.js`).
 *
 * Why this matters — finding F-010:
 *   PokeAPI serves post-Gen-6 typings (Clefairy/Jigglypuff/Mr. Mime gained
 *   `Fairy`), but `data.js TYPE_CHART` has no Fairy row. An unknown attacking
 *   type in `typeEffectiveness` silently returns 1 on the game side but uses
 *   the post-Gen-6 multipliers in our bot's (PokeAPI-generated) mirror, so
 *   intel scoring (bestOff, worstDef, STAB boosts on held items, boss lead
 *   selection) drifts from what the game actually simulates. Worse, the bot
 *   would ascribe Fairy STAB to a Jigglypuff that in reality clicks Tackle.
 *
 *   To stay in lockstep we strip Fairy from `gen1-species.ts` (in the
 *   regenerator `scripts/fetch-gen1-species.mjs` and in the emitted file).
 *   This test fails if any species type lacks a `data.js` row — signalling
 *   either a new game patch added a type to TYPE_CHART (good, expected —
 *   re-run `pnpm gen:pokeapi-data`) or we regressed and re-introduced
 *   Fairy to species types.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GEN1_SPECIES_TYPES } from "../../src/data/gen1-species.ts";
import { TYPE_CHART } from "../../src/data/type-chart.ts";

const DATA_JS = path.resolve("pokelike-source-files", "Pokemon Roguelike_files", "data.js");

/** Pull the top-level key names from `const TYPE_CHART = { Normal: {...}, Fire: {...}, ... };`. */
function parseTypeChartRowNames(src: string): Set<string> {
  const m = /const\s+TYPE_CHART\s*=\s*\{/.exec(src);
  assert.ok(m, "could not find TYPE_CHART declaration in data.js");
  let depth = 1;
  let i = m.index + m[0].length;
  const bodyStart = i;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (depth === 0) break;
  }
  const body = src.slice(bodyStart, i);

  // Linear scan to capture only *top-level* row keys (the outer `{` of each
  // row; nested column entries open at innerDepth ≥ 2 and are skipped).
  // Tracks string literals so type names inside quoted strings don't match.
  const names = new Set<string>();
  let innerDepth = 0;
  let lastIdx = 0;
  let inString: string | null = null;
  let escape = false;
  for (let j = 0; j < body.length; j++) {
    const ch = body[j]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") {
      if (innerDepth === 0) {
        const tail = body.slice(lastIdx, j);
        const km = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/.exec(tail);
        if (km) names.add(km[1]!);
      }
      innerDepth++;
    } else if (ch === "}") {
      innerDepth--;
      if (innerDepth === 0) lastIdx = j + 1;
    }
  }
  return names;
}

describe("F-010 contract — species types are all known to the game's TYPE_CHART", () => {
  const gameChartRows = parseTypeChartRowNames(fs.readFileSync(DATA_JS, "utf8"));

  it("parses a non-trivial number of rows from data.js (sanity check on the parser)", () => {
    assert.ok(
      gameChartRows.size >= 15,
      `expected ≥15 type rows in data.js TYPE_CHART, got ${gameChartRows.size}: [${[...gameChartRows].join(", ")}]`,
    );
  });

  it("every type used in GEN1_SPECIES_TYPES has a row in data.js TYPE_CHART", () => {
    const missing: Array<{ speciesId: number; type: string }> = [];
    for (const [sidStr, types] of Object.entries(GEN1_SPECIES_TYPES)) {
      for (const t of types) {
        if (!gameChartRows.has(t)) missing.push({ speciesId: Number(sidStr), type: t });
      }
    }
    assert.deepEqual(
      missing,
      [],
      `Species types missing from game TYPE_CHART (strip from src/data/gen1-species.ts or regenerate once the game patches them in): ${missing
        .map((e) => `#${e.speciesId}→${e.type}`)
        .join(", ")}`,
    );
  });

  it("every type used in GEN1_SPECIES_TYPES has a row in the bot's TYPE_CHART mirror", () => {
    // Sanity for the mirror itself — if someone edits type-chart.ts by hand
    // and drops a row a species depends on, intel silently returns 1× on that
    // matchup instead of whatever the game actually rules.
    const missing: string[] = [];
    for (const types of Object.values(GEN1_SPECIES_TYPES)) {
      for (const t of types) {
        if (TYPE_CHART[t] === undefined && !missing.includes(t)) missing.push(t);
      }
    }
    assert.deepEqual(missing, [], `types missing from bot TYPE_CHART: [${missing.join(", ")}]`);
  });

  // F-010 specific regression: Fairy is the canonical drift vector (PokeAPI
  // emits it for 35, 36, 39, 40, 122 but data.js rejects it). Pin the fix.
  it("no species retains Fairy typing (F-010 regression)", () => {
    const withFairy: number[] = [];
    for (const [sidStr, types] of Object.entries(GEN1_SPECIES_TYPES)) {
      if (types.some((t) => t.toLowerCase() === "fairy")) withFairy.push(Number(sidStr));
    }
    assert.deepEqual(
      withFairy,
      [],
      `Fairy leaked back into species types: ${withFairy.join(", ")}`,
    );
  });
});
