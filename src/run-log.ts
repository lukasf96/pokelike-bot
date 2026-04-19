import fs from "node:fs";
import path from "node:path";

import type { Page } from "puppeteer";

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
 * Read game state from localStorage["poke_current_run"] (written by saveRun() in game.js).
 * Called each bot turn so the Node-side cache stays fresh. The cache survives defeat because
 * clearSavedRun() fires before our handler runs, but our cached copy is already in Node memory.
 */
export async function snapshotGameState(page: Page): Promise<void> {
  const snap = await page.evaluate((): GameSnapshot | null => {
    try {
      const raw = localStorage.getItem("poke_current_run");
      if (!raw) return null;
      const state = JSON.parse(raw) as Record<string, unknown>;
      const rawTeam = state.team;
      if (!Array.isArray(rawTeam) || rawTeam.length === 0) return null;

      const team = (rawTeam as Array<Record<string, unknown>>).map((p) => {
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
      for (const p of rawTeam as Array<Record<string, unknown>>) {
        tot += Number(p.currentHp ?? 0);
        mx += Number(p.maxHp ?? 0);
      }

      return {
        team,
        badges: typeof state.badges === "number" ? state.badges : null,
        eliteIndex: typeof state.eliteIndex === "number" ? state.eliteIndex : null,
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

// ── Defeat context ────────────────────────────────────────────────────────────

/**
 * Read the battle screen DOM to figure out who just defeated us.
 * Must be called before the game clears the battle screen.
 */
async function readDefeatContext(page: Page): Promise<DefeatContext | null> {
  const cachedElite = lastSnapshot?.eliteIndex ?? -1;

  return page.evaluate(
    (eliteIndex: number): DefeatContext | null => {
    const title = (document.getElementById("battle-title")?.textContent ?? "").trim();
    const subtitle = (document.getElementById("battle-subtitle")?.textContent ?? "").trim();
    if (!title) return null;

    let mapIndex = -1;
    try {
      const raw = localStorage.getItem("poke_current_run");
      if (raw) mapIndex = Number((JSON.parse(raw) as Record<string, unknown>).currentMap ?? -1);
    } catch { /* ignore */ }

    // Wild Pokemon: "Wild Pidgey appeared!"
    const wild = title.match(/^Wild\s+(.+?)\s+appeared!$/i);
    if (wild) {
      const levelMatch = subtitle.match(/Level\s+(\d+)/i);
      return { kind: "wild", pokemon: wild[1]!, level: levelMatch ? Number(levelMatch[1]) : 0 };
    }

    // Legendary: "A legendary Zapdos appeared!"
    const legendary = title.match(/^A legendary\s+(.+?)\s+appeared!$/i);
    if (legendary) {
      const levelMatch = subtitle.match(/Lv\s+(\d+)/i);
      return { kind: "wild", pokemon: legendary[1]!, level: levelMatch ? Number(levelMatch[1]) : 0 };
    }

    // Gym Battle: "Gym Battle vs Misty!"
    const gym = title.match(/^Gym Battle vs\s+(.+?)!$/i);
    if (gym) {
      const badgeMatch = subtitle.match(/^(.+?)\s+is on the line!$/i);
      return { kind: "gym", leader: gym[1]!, badge: badgeMatch ? badgeMatch[1]! : "", mapIndex };
    }

    // Elite Four / Champion: "Elite Four: Lorelei!" or "Champion: Blue!"
    const elite = title.match(/^(.+?):\s+(.+?)!$/);
    if (elite) {
      return { kind: "elite", title: elite[1]!, name: elite[2]!, eliteIndex };
    }

    // Trainer: "Youngster Joey wants to battle!"
    const trainer = title.match(/^(.+?)\s+wants to battle!$/i);
    if (trainer) {
      return { kind: "trainer", name: trainer[1]! };
    }

    return { kind: "unknown", battleTitle: title, battleSubtitle: subtitle };
  }, cachedElite) as Promise<DefeatContext | null>;
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
  // Capture defeat context while the battle DOM is still intact.
  const defeatContext = outcome === "lost" ? await readDefeatContext(page) : null;

  // Try one final live state read, then fall back to cached snapshot.
  await snapshotGameState(page);
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
