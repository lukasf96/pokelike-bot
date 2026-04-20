import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  _peekPendingBattle,
  clearPendingBattle,
  hasPendingBattle,
  resolvePendingBattle,
  setPendingBattle,
  type BattleOutcomePrediction,
} from "../../../src/logging/battle-outcome-log.ts";

const sample: BattleOutcomePrediction = {
  runNumber: 7,
  tick: 42,
  surfaceKind: "gym",
  category: "gym",
  mapIndex: 1,
  eliteIndex: 0,
  pWin: 0.32,
  teamMaxLevel: 14,
  aliveTeamSize: 3,
  hpRatio: 0.8,
  bossImminent: true,
};

let tmpDir: string;
let logFile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pokelike-bo-"));
  logFile = path.join(tmpDir, "battle-outcomes.jsonl");
  process.env.POKELIKE_BATTLE_OUTCOME_LOG = logFile;
  clearPendingBattle();
});

afterEach(() => {
  delete process.env.POKELIKE_BATTLE_OUTCOME_LOG;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("battle-outcome-log", () => {
  it("setPending + hasPending + resolve appends one JSONL row", () => {
    assert.equal(hasPendingBattle(), false);
    setPendingBattle(sample);
    assert.equal(hasPendingBattle(), true);
    resolvePendingBattle(true, 43);
    assert.equal(hasPendingBattle(), false);

    const raw = fs.readFileSync(logFile, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    assert.equal(lines.length, 1, "expected exactly one line written");
    const row = JSON.parse(lines[0]!);
    assert.equal(row.pWin, 0.32);
    assert.equal(row.won, true);
    assert.equal(row.resolvedTick, 43);
    assert.equal(row.runNumber, 7);
    assert.equal(typeof row.timestamp, "string");
  });

  it("resolve without a pending prediction is a no-op", () => {
    resolvePendingBattle(false, 99);
    assert.ok(!fs.existsSync(logFile), "no file should be written");
  });

  it("setPending overwrites any stale prediction (no double resolve)", () => {
    setPendingBattle({ ...sample, pWin: 0.1 });
    setPendingBattle({ ...sample, pWin: 0.9 });
    assert.equal(_peekPendingBattle()?.pWin, 0.9);
    resolvePendingBattle(true, 55);
    const row = JSON.parse(fs.readFileSync(logFile, "utf8").trim());
    assert.equal(row.pWin, 0.9);
  });

  it("clearPendingBattle drops a stale prediction without writing", () => {
    setPendingBattle(sample);
    clearPendingBattle();
    assert.equal(hasPendingBattle(), false);
    resolvePendingBattle(false, 1);
    assert.ok(!fs.existsSync(logFile));
  });
});
