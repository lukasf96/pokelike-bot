/**
 * Run lifecycle owner. Single place that decides:
 *  - what `runNumber` / `turnNumber` we're on
 *  - when a run started
 *  - when a run ended (won / lost) — exactly once per run
 *  - when the active phase changed
 *
 * Inputs: a stream of `Tick`s from `observe()`.
 * Outputs: `RunEvent`s that downstream subscribers (logger, run-log) consume.
 *
 * Detection rules (by priority — first matching emits):
 *  - Phase=`win` and run not yet ended → run-ended ("won")
 *  - Phase=`battle` and `tick.ui.battle.isDefeat` and run not yet ended → run-ended ("lost")
 *  - Phase enters `title`/`trainer`/`starter` from an in-run phase and run not yet ended
 *      → run-ended ("lost") fallback (defeat we missed)
 *  - Transition from a non-in-run phase into an in-run phase → run-started (run++)
 */

import type { GameSnapshot, Phase, PhaseKind, Tick } from "./types.js";

export type RunOutcome = "won" | "lost";

export type RunEvent =
  | { type: "run-started"; runNumber: number }
  | { type: "phase-changed"; from: Phase; to: Phase }
  | { type: "run-ended"; outcome: RunOutcome; runNumber: number; lastGame: GameSnapshot | null };

const PRE_RUN_PHASES: ReadonlySet<PhaseKind> = new Set(["title", "trainer", "starter", "unknown"]);

function isInRun(p: PhaseKind): boolean {
  return !PRE_RUN_PHASES.has(p);
}

export class RunMachine {
  private _runNumber = 1;
  private _turnNumber = 0;
  private _prevPhase: Phase | null = null;
  /** Last non-empty `GameSnapshot` we observed in this run. Cleared on run-ended. */
  private _lastGame: GameSnapshot | null = null;
  /** Set when run-ended is emitted; cleared when run-started is emitted. */
  private _runEnded = false;
  private _started = false;

  get runNumber(): number {
    return this._runNumber;
  }
  get turnNumber(): number {
    return this._turnNumber;
  }
  /** Last seen game snapshot for the current run. Survives transient empty-team states post-wipe. */
  get lastGame(): GameSnapshot | null {
    return this._lastGame;
  }

  /** Advance one tick. Returns events to emit (in order). */
  step(tick: Tick): RunEvent[] {
    this._turnNumber += 1;
    const events: RunEvent[] = [];

    // ── Track last game snapshot (for defeat logging post-wipe) ──────────
    // When the live snapshot has a wiped team but we still hold the previous
    // roster, merge: keep the new map/elite/badges, keep the last team. This
    // mirrors the old `snapshotGameState` stitching so defeat logs survive a
    // mid-battle wipe.
    if (tick.game) {
      if (tick.game.team.length > 0 || this._lastGame === null) {
        this._lastGame = tick.game;
      } else {
        this._lastGame = { ...tick.game, team: this._lastGame.team };
      }
    }

    const prev = this._prevPhase;
    const cur = tick.phase;

    // ── Initial run-started ─────────────────────────────────────────────
    if (!this._started) {
      this._started = true;
      events.push({ type: "run-started", runNumber: this._runNumber });
    }

    // ── Phase change ────────────────────────────────────────────────────
    if (prev !== null && prev.kind !== cur.kind) {
      events.push({ type: "phase-changed", from: prev, to: cur });
    } else if (prev === null) {
      events.push({ type: "phase-changed", from: { kind: "unknown" }, to: cur });
    }

    // ── Run end detection (first matching wins) ─────────────────────────
    if (!this._runEnded) {
      if (cur.kind === "win") {
        events.push({
          type: "run-ended",
          outcome: "won",
          runNumber: this._runNumber,
          lastGame: this._lastGame,
        });
        this._runEnded = true;
      } else if (cur.kind === "battle" && tick.ui.battle?.isDefeat) {
        events.push({
          type: "run-ended",
          outcome: "lost",
          runNumber: this._runNumber,
          lastGame: this._lastGame,
        });
        this._runEnded = true;
      } else if (
        prev !== null &&
        isInRun(prev.kind) &&
        (cur.kind === "title" || cur.kind === "trainer" || cur.kind === "starter")
      ) {
        events.push({
          type: "run-ended",
          outcome: "lost",
          runNumber: this._runNumber,
          lastGame: this._lastGame,
        });
        this._runEnded = true;
      }
    }

    // ── Run start detection (re-entry into in-run after pre-run) ────────
    if (
      this._runEnded &&
      prev !== null &&
      !isInRun(prev.kind) &&
      isInRun(cur.kind)
    ) {
      this._runNumber += 1;
      this._turnNumber = 1;
      this._runEnded = false;
      this._lastGame = tick.game;
      events.push({ type: "run-started", runNumber: this._runNumber });
    }

    this._prevPhase = cur;
    return events;
  }
}
