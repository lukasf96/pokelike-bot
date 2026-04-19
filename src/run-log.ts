/**
 * Run-log subscriber. Pure: takes `RunEvent` + `Tick` + `RunMachine`, appends one
 * JSONL line per `run-ended`. Preserves the `RunLogEntry` schema so existing log
 * tooling keeps working.
 */

import fs from "node:fs";
import path from "node:path";

import { logAction, logError } from "./logger.js";
import { endRunDetail, startRunDetail } from "./run-detail-log.js";
import type { RunEvent } from "./state/run-machine.js";
import type { GameSnapshot, Pokemon, Tick } from "./state/types.js";

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

const LOG_DIR = path.join(process.cwd(), "logs");
const DEFAULT_LOG_FILE = path.join(LOG_DIR, "pokelike-runs.jsonl");

function logFilePath(): string {
  return process.env.POKELIKE_RUN_LOG ?? DEFAULT_LOG_FILE;
}

let loggedPathTip = false;

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

function toLogTeam(team: Pokemon[]): RunLogTeamMember[] {
  return team.map((p) => ({
    speciesId: p.speciesId,
    name: p.name,
    level: p.level,
    types: p.types,
    hp: { current: p.hp.current, max: p.hp.max },
    heldItemId: p.heldItemId,
    isShiny: p.isShiny,
  }));
}

function teamHpRatio(team: Pokemon[]): number | null {
  let tot = 0;
  let mx = 0;
  for (const p of team) {
    tot += p.hp.current;
    mx += p.hp.max;
  }
  return mx > 0 ? tot / mx : null;
}

function parseDefeatContext(
  title: string,
  subtitle: string,
  game: GameSnapshot | null,
): DefeatContext | null {
  if (!title) return null;
  const mapIndex = game?.currentMap ?? -1;
  const eliteIdx = game?.eliteIndex ?? -1;

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
}

export function handleRunLogEvent(event: RunEvent, tick: Tick, currentTurn: number): void {
  // Per-run detail file is opened when a new run begins so handlers can stream
  // structured rows (decisions, catches, notes) into it as soon as the next
  // tick arrives.
  if (event.type === "run-started") {
    startRunDetail(event.runNumber);
    return;
  }
  if (event.type !== "run-ended") return;

  const lastGame = event.lastGame;
  const battleUi = tick.ui.battle;

  const defeatContext =
    event.outcome === "lost"
      ? parseDefeatContext(battleUi?.title ?? "", battleUi?.subtitle ?? "", lastGame)
      : null;

  const team = lastGame ? toLogTeam(lastGame.team) : [];

  appendRunLog({
    timestamp: new Date().toISOString(),
    outcome: event.outcome,
    runNumber: event.runNumber,
    botTurn: currentTurn,
    badges: lastGame?.badges ?? null,
    defeatContext,
    eliteIndex: lastGame?.eliteIndex ?? null,
    teamHpRatio: lastGame ? teamHpRatio(lastGame.team) : null,
    team,
  });

  const detailPath = endRunDetail({
    outcome: event.outcome,
    badges: lastGame?.badges ?? null,
    defeatContext,
    finalTeam: team,
  });
  if (detailPath) logAction("run-log", `Detail → ${detailPath}`);
}
