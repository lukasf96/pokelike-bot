/**
 * Predicted-vs-actual battle outcome log (F-012).
 *
 * Workflow:
 *   - `setPendingBattle(prediction)` is called by the map handler whenever it
 *     picks a combat node (battle / trainer / gym / elite / legendary / wild).
 *   - `resolvePendingBattle(won)` is called by the bot loop when the phase
 *     transitions out of `battle`, or the run ends in defeat.
 *   - Each resolution appends one JSONL row to `logs/battle-outcomes.jsonl`.
 *
 * The resulting file feeds `scripts/calibration.mjs`, which reports the
 * reliability curve (pWin bucket → empirical win rate) so we can detect and
 * correct systematic over-estimation (e.g. early-gym full-HP sweeps).
 */

import fs from "node:fs";
import path from "node:path";

import { logAction, logError } from "./logger.js";

export interface BattleOutcomePrediction {
  runNumber: number;
  tick: number;
  surfaceKind: string;
  category: string;
  mapIndex: number;
  eliteIndex: number;
  pWin: number;
  teamMaxLevel: number;
  aliveTeamSize: number;
  hpRatio: number;
  bossImminent: boolean;
  /** Free-form extras (boss name, lead types, etc.) — optional. */
  extra?: Record<string, unknown>;
}

export interface BattleOutcomeRow extends BattleOutcomePrediction {
  timestamp: string;
  won: boolean;
  resolvedTick: number;
}

const LOG_DIR = path.join(process.cwd(), "logs");
const DEFAULT_LOG_FILE = path.join(LOG_DIR, "battle-outcomes.jsonl");

function logFilePath(): string {
  return process.env.POKELIKE_BATTLE_OUTCOME_LOG ?? DEFAULT_LOG_FILE;
}

let pending: BattleOutcomePrediction | null = null;
let loggedPathTip = false;

function appendRow(row: BattleOutcomeRow): void {
  try {
    const file = logFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, { encoding: "utf8" });
    if (!loggedPathTip) {
      loggedPathTip = true;
      logAction("battle-outcome", `Logging to ${file}`);
    }
  } catch (e) {
    logError(`[battle-outcome] Failed to write: ${String(e)}`);
  }
}

/**
 * Stash a prediction. Overwrites any existing pending prediction, because a
 * second map decision without an intervening resolution means we mis-classified
 * the previous node and should ignore the stale prediction.
 */
export function setPendingBattle(prediction: BattleOutcomePrediction): void {
  pending = prediction;
}

/** True when a prediction is outstanding and awaiting resolution. */
export function hasPendingBattle(): boolean {
  return pending !== null;
}

/**
 * Resolve + append. `resolvedTick` is the bot loop tick at the moment of
 * resolution; callers should pass the current turn number so offline analysis
 * can co-locate with `pokelike-runs.jsonl` and `run-detail-log`.
 *
 * Resolution is idempotent within a tick — further calls without an intervening
 * `setPendingBattle` are no-ops.
 */
export function resolvePendingBattle(won: boolean, resolvedTick: number): void {
  if (!pending) return;
  const row: BattleOutcomeRow = {
    ...pending,
    timestamp: new Date().toISOString(),
    won,
    resolvedTick,
  };
  appendRow(row);
  pending = null;
}

/** Drop a pending prediction without resolving it (used on run reset). */
export function clearPendingBattle(): void {
  pending = null;
}

/** Test/debug accessor. */
export function _peekPendingBattle(): BattleOutcomePrediction | null {
  return pending;
}
