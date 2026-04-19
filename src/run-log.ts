import fs from "node:fs";
import path from "node:path";

import type { Page } from "puppeteer";

export interface RunLogTeamMember {
  speciesId: number;
  name: string;
  level: number;
  types: string[];
  hp: { current: number; max: number };
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } | null;
  heldItemId: string | null;
  isShiny: boolean;
}

export interface RunLogEntry {
  timestamp: string;
  outcome: "won" | "lost";
  runNumber: number;
  botTurn: number;
  currentMap: number | null;
  eliteIndex: number | null;
  teamHpRatio: number | null;
  team: RunLogTeamMember[];
}

interface GameSnapshot {
  team: RunLogTeamMember[];
  currentMap: number | null;
  eliteIndex: number | null;
  teamHpRatio: number | null;
}

// ── Node-side state ──────────────────────────────────────────────────────────

const LOG_DIR = path.join(process.cwd(), "logs");
const DEFAULT_LOG_FILE = path.join(LOG_DIR, "pokelike-runs.jsonl");

function logFilePath(): string {
  return process.env.POKELIKE_RUN_LOG ?? DEFAULT_LOG_FILE;
}

let sessionRun = 1;
let sessionTurn = 0;
let lastSnapshot: GameSnapshot | null = null;
let loggedPathTip = false;

export function updateRunSession(run: number, turn: number): void {
  sessionRun = run;
  sessionTurn = turn;
}

// ── Browser-side snapshot ────────────────────────────────────────────────────

/**
 * Read live game state from `window.state`. Call each bot turn while the game
 * is running so the last good snapshot is available when the run ends.
 */
export async function snapshotGameState(page: Page): Promise<void> {
  const snap = await page.evaluate((): GameSnapshot | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = (window as any).state as Record<string, unknown> | undefined;
      const rawTeam = state?.team;
      if (!Array.isArray(rawTeam) || rawTeam.length === 0) return null;

      const team = (rawTeam as Array<Record<string, unknown>>).map((p) => {
        const bs = p.baseStats as Record<string, number> | undefined | null;
        const held = p.heldItem as { id?: string } | null | undefined;
        return {
          speciesId: Number(p.speciesId ?? 0),
          name: String(p.nickname ?? p.name ?? ""),
          level: Number(p.level ?? 0),
          types: Array.isArray(p.types) ? (p.types as unknown[]).map(String) : [],
          hp: { current: Number(p.currentHp ?? 0), max: Number(p.maxHp ?? 0) },
          baseStats:
            bs && typeof bs.hp === "number" && typeof bs.atk === "number"
              ? { hp: bs.hp, atk: bs.atk, def: bs.def, spa: bs.spa, spd: bs.spd, spe: bs.spe }
              : null,
          heldItemId: held?.id != null ? String(held.id) : null,
          isShiny: Boolean(p.isShiny),
        };
      });

      let tot = 0;
      let mx = 0;
      for (const p of rawTeam as Array<Record<string, unknown>>) {
        tot += Number(p.currentHp ?? 0);
        mx += Number(p.maxHp ?? 0);
      }

      return {
        team,
        currentMap: typeof state?.currentMap === "number" ? state.currentMap : null,
        eliteIndex: typeof state?.eliteIndex === "number" ? state.eliteIndex : null,
        teamHpRatio: mx > 0 ? tot / mx : null,
      };
    } catch {
      return null;
    }
  });

  if (snap) lastSnapshot = snap;
}

export function clearSnapshot(): void {
  lastSnapshot = null;
}

// ── File I/O ─────────────────────────────────────────────────────────────────

function appendRunLog(entry: RunLogEntry): void {
  try {
    const file = logFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
    if (!loggedPathTip) {
      loggedPathTip = true;
      console.log(`  [run-log] Logging to ${file}`);
    }
  } catch (e) {
    console.error("  [run-log] Failed to write:", e);
  }
}

export async function logRunEnd(page: Page, outcome: "won" | "lost"): Promise<void> {
  // Try one last live read, fall back to cached snapshot from earlier in the run.
  await snapshotGameState(page);
  const snap = lastSnapshot;

  appendRunLog({
    timestamp: new Date().toISOString(),
    outcome,
    runNumber: sessionRun,
    botTurn: sessionTurn,
    currentMap: snap?.currentMap ?? null,
    eliteIndex: snap?.eliteIndex ?? null,
    teamHpRatio: snap?.teamHpRatio ?? null,
    team: snap?.team ?? [],
  });
}

// ── Battle defeat detection ───────────────────────────────────────────────────

/** Returns true when the Continue button signals defeat (label "Continue..."). */
export async function isBattleDefeatContinueButton(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
    if (!btn || btn.style.display === "none") return false;
    return (btn.textContent ?? "").trim() === "Continue...";
  });
}
