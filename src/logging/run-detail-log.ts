/**
 * Per-run detail log. One JSON file per run under `logs/runs/`, complementing
 * the rolling overview at `logs/pokelike-runs.jsonl`.
 *
 * Architecture:
 *   - Singleton recorder, owned by the bot loop. Starts on `run-started`,
 *     flushes + clears on `run-ended`.
 *   - Handlers push structured rows (`recordDecision`, `recordCatch`).
 *   - Every `logAction(scope, msg)` is mirrored into `notes[]` via the
 *     `subscribeToActions` hook in logger.ts — no coupling required.
 *
 * Filename format:
 *   logs/runs/run-<YYYYMMDDTHHMMSS>-<RRRR>.json
 *   where the timestamp is the run-start wall-clock UTC and RRRR is the
 *   zero-padded run number. Guarantees uniqueness across processes.
 *
 * Override directory with POKELIKE_RUN_DETAIL_DIR.
 */

import fs from "node:fs";
import path from "node:path";

import { logError, subscribeToActions } from "./logger.js";
import type { DefeatContext, RunLogTeamMember } from "./run-log.js";

export interface MapDecisionAlternative {
  kind: string;
  pWin: number;
  base: number;
  adjusted: number;
}

export interface MapDecisionContext {
  hpRatio: number;
  fainted: number;
  alive: number;
  teamMaxLevel: number;
  bossMaxLevel: number;
  pWinBoss: number;
  bossImminent: boolean;
  pcAvailable: boolean;
}

export interface MapDecisionEntry {
  tick: number;
  map: number;
  chosenIdx: number;
  chosen: MapDecisionAlternative;
  alternatives: MapDecisionAlternative[];
  ctx: MapDecisionContext;
}

export interface CatchEntry {
  tick: number;
  map: number;
  options: { name: string; speciesId: number; level: number; isShiny: boolean; score: number }[];
  pickedIndex: number;
  pickedName: string;
  teamBefore: { name: string; level: number; types: string[]; alive: boolean }[];
}

export interface NoteEntry {
  tick: number;
  scope: string;
  msg: string;
}

export interface RunDetail {
  runNumber: number;
  startedAt: string;
  endedAt?: string;
  outcome?: "won" | "lost";
  badges?: number | null;
  defeatContext?: DefeatContext | null;
  finalTeam?: RunLogTeamMember[];
  decisions: MapDecisionEntry[];
  catches: CatchEntry[];
  notes: NoteEntry[];
}

const LOG_DIR_DEFAULT = path.join(process.cwd(), "logs", "runs");
// Caps prevent a stuck/forever-looping run from filling disk. A normal
// finished run has ≲100 decisions, ≲30 catches, ≲500 notes.
const MAX_DECISIONS = 400;
const MAX_CATCHES = 80;
const MAX_NOTES = 2000;

let current: RunDetail | null = null;
let currentTurn = 0;
let currentRunNumber = 0;
let subscribed = false;

function logDir(): string {
  return process.env.POKELIKE_RUN_DETAIL_DIR ?? LOG_DIR_DEFAULT;
}

function recordNote(scope: string, msg: string): void {
  if (!current) return;
  if (current.notes.length >= MAX_NOTES) return;
  current.notes.push({ tick: currentTurn, scope, msg });
}

/** Called from the bot loop every tick so subsequent records know which turn they belong to. */
export function setCurrentTurn(turn: number): void {
  currentTurn = turn;
}

/** Current turn number as last set by the bot loop. */
export function getCurrentTurn(): number {
  return currentTurn;
}

/** Called from the bot loop when a new run starts; available to any subscriber. */
export function setCurrentRunNumber(runNumber: number): void {
  currentRunNumber = runNumber;
}

/** Current run number as last set by the bot loop. */
export function getCurrentRunNumber(): number {
  return currentRunNumber;
}

export function startRunDetail(runNumber: number): void {
  if (!subscribed) {
    subscribed = true;
    subscribeToActions(recordNote);
  }
  current = {
    runNumber,
    startedAt: new Date().toISOString(),
    decisions: [],
    catches: [],
    notes: [],
  };
}

export function recordDecision(entry: Omit<MapDecisionEntry, "tick">): void {
  if (!current) return;
  if (current.decisions.length >= MAX_DECISIONS) return;
  current.decisions.push({ tick: currentTurn, ...entry });
}

export function recordCatch(entry: Omit<CatchEntry, "tick">): void {
  if (!current) return;
  if (current.catches.length >= MAX_CATCHES) return;
  current.catches.push({ tick: currentTurn, ...entry });
}

/**
 * Flushes the current run buffer to disk.
 *
 * Returns the absolute path written, or `null` if no active run.
 *
 * Filename uses the *start* timestamp so filename ordering matches run
 * order even when runs end in unusual orders (manual reset, crash retry).
 */
export function endRunDetail(meta: {
  outcome: "won" | "lost";
  badges: number | null;
  defeatContext: DefeatContext | null;
  finalTeam: RunLogTeamMember[];
}): string | null {
  if (!current) return null;
  current.endedAt = new Date().toISOString();
  current.outcome = meta.outcome;
  current.badges = meta.badges;
  current.defeatContext = meta.defeatContext;
  current.finalTeam = meta.finalTeam;

  const padded = String(current.runNumber).padStart(4, "0");
  // 20260419T193512 — sortable, filesystem-safe, second precision is enough
  // since we always also include the run number in the prefix.
  const tsCompact = current.startedAt.replace(/[-:]/g, "").split(".")[0]!;
  const filename = `run-${tsCompact}-${padded}.json`;
  const out = path.join(logDir(), filename);

  try {
    fs.mkdirSync(logDir(), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  } catch (e) {
    logError(`[run-detail] write failed: ${String(e)}`);
  }

  current = null;
  return out;
}

/** Test/debug helper. */
export function _peekActiveRun(): RunDetail | null {
  return current;
}
