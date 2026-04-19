import fs from "node:fs";
import path from "node:path";

import type { Page } from "puppeteer";

import { POKE_CURRENT_RUN_LS_KEY } from "./constants.js";
import { logAction, logError } from "./logger.js";

export interface RunLogTeamMember {
  speciesId: number;
  name: string;
  level: number;
  types: string[];
  hp: { current: number; max: number };
  heldItemId: string | null;
  isShiny: boolean;
}

export type DefeatContext =
  | { kind: "wild"; pokemon: string; level: number }
  | { kind: "trainer"; name: string }
  | { kind: "gym"; leader: string; badge: string; mapIndex: number }
  | { kind: "elite"; title: string; name: string; eliteIndex: number }
  | { kind: "unknown"; battleTitle: string; battleSubtitle: string };

export interface RunLogEntry {
  timestamp: string;
  outcome: "won" | "lost";
  runNumber: number;
  botTurn: number;
  badges: number | null;
  defeatContext: DefeatContext | null;
  eliteIndex: number | null;
  teamHpRatio: number | null;
  team: RunLogTeamMember[];
}

interface GameSnapshot {
  team: RunLogTeamMember[];
  badges: number | null;
  eliteIndex: number | null;
  teamHpRatio: number | null;
  /** Current route map index (0–8); used when localStorage was cleared before defeat logging. */
  currentMap: number | null;
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
 * Reads `poke_current_run` into the Node-side cache.
 * Keeps badges / map index / elite index even when `team` is temporarily empty after a wipe.
 * If the save has an empty team but we still hold a roster from the previous tick, merge that roster
 * so defeat logs stay useful.
 */
export async function snapshotGameState(page: Page): Promise<void> {
  const snap = await page.evaluate((lsKey): GameSnapshot | null => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return null;
      const state = JSON.parse(raw) as Record<string, unknown>;
      const rawTeam = state.team;
      const rawTeamArr = Array.isArray(rawTeam) ? (rawTeam as Array<Record<string, unknown>>) : [];

      const team = rawTeamArr.map((p) => {
        const held = p.heldItem as { id?: string } | null | undefined;
        return {
          speciesId: Number(p.speciesId ?? 0),
          name: String(p.nickname ?? p.name ?? ""),
          level: Number(p.level ?? 0),
          types: Array.isArray(p.types) ? (p.types as unknown[]).map(String) : [],
          hp: { current: Number(p.currentHp ?? 0), max: Number(p.maxHp ?? 0) },
          heldItemId: held?.id != null ? String(held.id) : null,
          isShiny: Boolean(p.isShiny),
        };
      });

      let tot = 0;
      let mx = 0;
      for (const p of rawTeamArr) {
        tot += Number(p.currentHp ?? 0);
        mx += Number(p.maxHp ?? 0);
      }

      const cmRaw = Number(state.currentMap ?? NaN);
      const currentMap = Number.isFinite(cmRaw) && cmRaw >= 0 ? cmRaw : null;

      return {
        team,
        badges: typeof state.badges === "number" ? state.badges : null,
        eliteIndex: typeof state.eliteIndex === "number" ? state.eliteIndex : null,
        teamHpRatio: mx > 0 ? tot / mx : null,
        currentMap,
      };
    } catch {
      return null;
    }
  }, POKE_CURRENT_RUN_LS_KEY);

  if (!snap) return;

  if (snap.team.length === 0 && lastSnapshot && lastSnapshot.team.length > 0) {
    lastSnapshot = {
      ...snap,
      team: lastSnapshot.team,
      teamHpRatio: lastSnapshot.teamHpRatio,
    };
  } else {
    lastSnapshot = snap;
  }
}

export function clearSnapshot(): void {
  lastSnapshot = null;
}

// ── Defeat context ────────────────────────────────────────────────────────────

interface DefeatReadPayload {
  lsKey: string;
  fallbackMapIndex: number;
  fallbackEliteIndex: number;
}

/**
 * Parse battle title/subtitle; prefers localStorage map/elite index, falls back to last snapshot.
 */
async function readDefeatContext(page: Page, payload: DefeatReadPayload): Promise<DefeatContext | null> {
  return page.evaluate((ctx: DefeatReadPayload): DefeatContext | null => {
    const title = (document.getElementById("battle-title")?.textContent ?? "").trim();
    const subtitle = (document.getElementById("battle-subtitle")?.textContent ?? "").trim();
    if (!title) return null;

    let mapIndex = ctx.fallbackMapIndex >= 0 ? ctx.fallbackMapIndex : -1;
    let eliteIdx = ctx.fallbackEliteIndex >= 0 ? ctx.fallbackEliteIndex : -1;
    try {
      const raw = localStorage.getItem(ctx.lsKey);
      if (raw) {
        const st = JSON.parse(raw) as Record<string, unknown>;
        const cm = Number(st.currentMap ?? NaN);
        if (Number.isFinite(cm) && cm >= 0) mapIndex = cm;
        const ei = Number(st.eliteIndex ?? NaN);
        if (Number.isFinite(ei) && ei >= 0) eliteIdx = ei;
      }
    } catch {
      /* ignore */
    }

    const wild = title.match(/^Wild\s+(.+?)\s+appeared!$/i);
    if (wild) {
      const levelMatch = subtitle.match(/Level\s+(\d+)/i);
      return { kind: "wild", pokemon: wild[1]!, level: levelMatch ? Number(levelMatch[1]) : 0 };
    }

    const legendary = title.match(/^A legendary\s+(.+?)\s+appeared!$/i);
    if (legendary) {
      const levelMatch = subtitle.match(/Lv\s+(\d+)/i);
      return { kind: "wild", pokemon: legendary[1]!, level: levelMatch ? Number(levelMatch[1]) : 0 };
    }

    const gym = title.match(/^Gym Battle vs\s+(.+?)!$/i);
    if (gym) {
      const badgeMatch = subtitle.match(/^(.+?)\s+is on the line!$/i);
      return { kind: "gym", leader: gym[1]!, badge: badgeMatch ? badgeMatch[1]! : "", mapIndex };
    }

    const eliteMatch = title.match(/^(.+?):\s+(.+?)!$/);
    if (eliteMatch) {
      return {
        kind: "elite",
        title: eliteMatch[1]!,
        name: eliteMatch[2]!,
        eliteIndex: eliteIdx,
      };
    }

    const trainer = title.match(/^(.+?)\s+wants to battle!$/i);
    if (trainer) {
      return { kind: "trainer", name: trainer[1]! };
    }

    return { kind: "unknown", battleTitle: title, battleSubtitle: subtitle };
  }, payload);
}

// ── File I/O ─────────────────────────────────────────────────────────────────

function appendRunLog(entry: RunLogEntry): void {
  try {
    const file = logFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
    if (!loggedPathTip) {
      loggedPathTip = true;
      logAction("run-log", `Logging to ${file}`);
    }
  } catch (e) {
    logError(`[run-log] Failed to write: ${String(e)}`);
  }
}

export async function logRunEnd(page: Page, outcome: "won" | "lost"): Promise<void> {
  await snapshotGameState(page);

  const defeatContext =
    outcome === "lost"
      ? await readDefeatContext(page, {
          lsKey: POKE_CURRENT_RUN_LS_KEY,
          fallbackMapIndex: lastSnapshot?.currentMap ?? -1,
          fallbackEliteIndex:
            typeof lastSnapshot?.eliteIndex === "number" ? lastSnapshot.eliteIndex : -1,
        })
      : null;

  const snap = lastSnapshot;

  appendRunLog({
    timestamp: new Date().toISOString(),
    outcome,
    runNumber: sessionRun,
    botTurn: sessionTurn,
    badges: snap?.badges ?? null,
    defeatContext,
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
