#!/usr/bin/env node
/**
 * pWin calibration report.
 *
 * Reads `logs/battle-outcomes.jsonl` (produced by
 * `src/logging/battle-outcome-log.ts`) and prints a reliability curve:
 *   pWin bucket [0.0–0.1)…[0.9–1.0]   empirical wins / total = win%
 *
 * A well-calibrated estimator has empirical ≈ bucket midpoint. Systematic
 * over-estimation (empirical below bucket) is the symptom of F-012 — the
 * number we use to gate map decisions is lying to us.
 *
 * Optional filters:
 *   --category=gym,elite,trainer,dynamic_trainer,wild,legendary
 *   --map=0..8
 *   --since=<ISO timestamp>   (inclusive)
 *
 * Usage:
 *   node scripts/calibration.mjs
 *   node scripts/calibration.mjs --category=gym
 *   node scripts/calibration.mjs --category=trainer,dynamic_trainer --map=0
 */

import fs from "node:fs";
import path from "node:path";

const LOG_PATH = process.env.POKELIKE_BATTLE_OUTCOME_LOG
  ?? path.join(process.cwd(), "logs", "battle-outcomes.jsonl");

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}

function loadRows(file) {
  if (!fs.existsSync(file)) {
    console.error(`No battle outcome log at ${file}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* skip malformed */
    }
  }
  return rows;
}

function bucketIdx(p) {
  if (p >= 1) return 9;
  return Math.max(0, Math.min(9, Math.floor(p * 10)));
}

function bucketLabel(i) {
  const lo = (i / 10).toFixed(1);
  const hi = i === 9 ? "1.0" : ((i + 1) / 10).toFixed(1);
  return `${lo}-${hi}`;
}

function bar(frac, width = 20) {
  const filled = Math.round(frac * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function summarize(rows, label) {
  if (rows.length === 0) {
    console.log(`\n${label}: no rows.`);
    return;
  }
  const buckets = Array.from({ length: 10 }, () => ({ n: 0, w: 0, sumP: 0 }));
  let total = 0;
  let totalWins = 0;
  let sumP = 0;
  for (const r of rows) {
    const b = bucketIdx(r.pWin);
    buckets[b].n += 1;
    buckets[b].sumP += r.pWin;
    if (r.won) buckets[b].w += 1;
    total += 1;
    sumP += r.pWin;
    if (r.won) totalWins += 1;
  }
  const actual = totalWins / total;
  const mean = sumP / total;
  console.log(`\n${label}  (n=${total}, mean pWin=${mean.toFixed(3)}, actual=${actual.toFixed(3)}, gap=${(mean - actual).toFixed(3)})`);
  console.log("bucket    n    pred   actual   reliability          gap");
  for (let i = 0; i < 10; i++) {
    const b = buckets[i];
    if (b.n === 0) continue;
    const p = b.sumP / b.n;
    const a = b.w / b.n;
    const gap = p - a;
    const gapStr = (gap >= 0 ? "+" : "") + gap.toFixed(2);
    console.log(
      `${bucketLabel(i).padEnd(9)} ${String(b.n).padStart(3)}  ${p.toFixed(2)}   ${a.toFixed(2)}   [${bar(a)}]  ${gapStr}`,
    );
  }
}

function main() {
  const args = parseArgs();
  const rows = loadRows(LOG_PATH);
  const filterCategory = args.category
    ? new Set(args.category.split(",").map((s) => s.trim()))
    : null;
  const filterMap = args.map ? new Set(args.map.split(",").map((s) => Number(s))) : null;
  const since = args.since ? Date.parse(args.since) : null;

  const filtered = rows.filter((r) => {
    if (filterCategory && !filterCategory.has(r.category)) return false;
    if (filterMap && !filterMap.has(r.mapIndex)) return false;
    if (since && Date.parse(r.timestamp) < since) return false;
    return true;
  });

  console.log(`Loaded ${rows.length} rows from ${LOG_PATH}`);
  if (filterCategory || filterMap || since) {
    console.log(`After filter: ${filtered.length} rows`);
  }

  summarize(filtered, "ALL");
  if (!filterCategory) {
    const cats = [...new Set(filtered.map((r) => r.category))].sort();
    for (const c of cats) {
      summarize(filtered.filter((r) => r.category === c), `category=${c}`);
    }
  }
  if (!filterMap) {
    const maps = [...new Set(filtered.map((r) => r.mapIndex))].sort((a, b) => a - b);
    for (const m of maps) {
      summarize(filtered.filter((r) => r.mapIndex === m), `map=${m}`);
    }
  }
}

main();
