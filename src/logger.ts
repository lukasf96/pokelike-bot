/**
 * Structured, color-coded CLI output for bot runs.
 * Honors https://no-color.org/ via NO_COLOR.
 * Set POKELIKE_DEBUG_SCREEN=1 to print full raw screen text (up to 200 chars) on transitions.
 */

const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";

function paint(code: string, s: string): string {
  if (noColor) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}

export const style = {
  dim: (s: string) => paint("2", s),
  bold: (s: string) => paint("1", s),
  red: (s: string) => paint("31", s),
  green: (s: string) => paint("32", s),
  yellow: (s: string) => paint("33", s),
  blue: (s: string) => paint("34", s),
  magenta: (s: string) => paint("35", s),
  cyan: (s: string) => paint("36", s),
  gray: (s: string) => paint("90", s),
};

/** Scope → ANSI color code (foreground). */
const SCOPE_STYLE: Record<string, string> = {
  init: "36",
  title: "35",
  trainer: "35",
  starter: "32",
  map: "36",
  battle: "31",
  catch: "32",
  item: "33",
  "item-equip": "33",
  badge: "33",
  trade: "34",
  swap: "34",
  shiny: "35",
  tutor: "34",
  eevee: "35",
  win: "32",
  usable: "33",
  "held-swaps": "90",
  "held-bag": "90",
  "run-log": "90",
  stuck: "33",
  error: "31",
};

function styleForScreen(screen: string): (s: string) => string {
  if (screen === "title-screen" || screen === "trainer-screen" || screen === "starter-screen") {
    return style.magenta;
  }
  if (screen === "map-screen") return style.cyan;
  if (screen === "battle-screen") return style.red;
  if (screen === "catch-screen") return style.green;
  if (screen === "item-screen" || screen === "item-equip") return style.yellow;
  if (screen === "badge-screen") return style.bold;
  if (screen === "win-screen") return style.green;
  if (screen === "gameover-screen") return style.red;
  if (screen === "unknown") return style.gray;
  return style.bold;
}

export function logBlank(): void {
  console.log();
}

export function logInfo(line: string): void {
  console.log(line);
}

export function logInfoDim(line: string): void {
  console.log(style.dim(line));
}

export function logStartupBanner(): void {
  console.log(style.bold(style.cyan("Pokelike bot")));
  console.log(style.dim("─".repeat(42)));
}

export function logNavigating(url: string): void {
  console.log(style.dim(`Navigating to ${url} …`));
}

export function logRunStarted(run: number): void {
  console.log(style.bold(`Run ${run}`) + style.dim(" — Ctrl+C to stop"));
  console.log();
}

export function logTurnHeader(run: number, turn: number, screen: string): void {
  const scr = styleForScreen(screen)(screen);
  const runLabel = noColor ? `run ${run}` : paint("1;36", `run ${run}`);
  console.log(`  ${runLabel} ${style.dim("·")} ${style.dim(`turn ${turn}`)} ${style.dim("·")} ${scr}`);
}

/**
 * Compact context for screen transitions. Returns null → no extra line (handlers carry detail).
 */
export function screenPeekLine(screen: string, raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  if (process.env.POKELIKE_DEBUG_SCREEN === "1") {
    return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
  }

  switch (screen) {
    case "map-screen":
    case "catch-screen":
    case "item-screen":
    case "swap-screen":
    case "trade-screen":
    case "shiny-screen":
      return null;
    case "title-screen":
      return summarizeTitle(trimmed);
    case "trainer-screen":
      return "Trainer · choose appearance";
    case "starter-screen":
      return "Starter · pick 1 of 3";
    case "battle-screen":
      return summarizeBattlePeek(trimmed);
    case "badge-screen": {
      const m = trimmed.match(/You earned[^.]+/);
      return m ? m[0] : abbrev(trimmed, 76);
    }
    case "item-equip":
    case "move-tutor":
      return null;
    case "eevee-choice":
      return "Eevee · evolution branch";
    case "transition-screen":
      return abbrev(trimmed, 76);
    case "gameover-screen":
      return abbrev(trimmed, 76);
    case "win-screen":
      return abbrev(trimmed, 76);
    default:
      return abbrev(trimmed, 76);
  }
}

export function logScreenPeek(peek: string): void {
  console.log(`  ${style.dim("│")} ${style.dim(peek)}`);
}

function summarizeTitle(text: string): string {
  const vMatch = text.match(/\bv([\d]+\.[\d]+(?:\.[\d]+)?)\b/);
  const v = vMatch ? `v${vMatch[1]}` : null;
  const parts: string[] = [];
  if (v) parts.push(v);
  if (/\bNORMAL\s+MODE\b/i.test(text)) parts.push("NORMAL");
  else if (/\bHARD\s+MODE\b/i.test(text)) parts.push("HARD");
  if (/\bNUZLOCKE\b/i.test(text)) parts.push("NUZLOCKE");
  return parts.length > 0 ? `Title · ${parts.join(" · ")}` : abbrev(text, 76);
}

function summarizeBattlePeek(text: string): string | null {
  const cut = text.indexOf("YOUR TEAM");
  const head = (cut >= 0 ? text.slice(0, cut) : text).replace(/\s+/g, " ").trim();
  if (!head) return null;
  return abbrev(head, 88);
}

function abbrev(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function logAction(scope: string, message: string): void {
  const code = SCOPE_STYLE[scope] ?? "90";
  const tag = paint(code, `[${scope}]`);
  console.log(`  ${tag} ${message}`);
}

export function logWarn(message: string): void {
  console.warn(`${style.yellow("warning")} ${message}`);
}

export function logError(message: string): void {
  console.error(`${style.red("error")} ${message}`);
}

export function logGameOverRunBanner(nextRun: number): void {
  console.log();
  console.log(style.dim("═".repeat(48)));
  console.log(style.yellow(style.bold(`Game over — run ${nextRun}`)));
  console.log(style.dim("═".repeat(48)));
  console.log();
}
