/**
 * Central typed reader for `window.state` (C2/C3 in BOT_IMPROVEMENTS.md).
 * Every handler calls `readGameState(page)` instead of its own `(window as any).state` projection.
 */

import type { Page } from "puppeteer";

export interface GameStateTeamMember {
  speciesId: number;
  level: number;
  types: string[];
  baseStats?: { hp?: number; atk?: number; def?: number; speed?: number; special?: number; spdef?: number };
  currentHp: number;
  maxHp: number;
  isShiny: boolean;
  moveTier: number;
  heldItem?: { id: string } | null;
}

export interface GameStateBagEntry {
  idx: number;
  id: string;
  usable: boolean;
}

export interface GameState {
  currentMap: number;
  eliteIndex: number;
  team: GameStateTeamMember[];
  items: GameStateBagEntry[];
}

export async function readGameState(page: Page): Promise<GameState> {
  return page.evaluate((): GameState => {
    const st = (window as unknown as { state: Record<string, unknown> }).state;
    const rawTeam = (st?.team ?? []) as Array<Record<string, unknown>>;
    const rawItems = (st?.items ?? []) as Array<Record<string, unknown>>;

    const team: GameStateTeamMember[] = rawTeam.map((p) => ({
      speciesId: Number(p.speciesId ?? 0),
      level: Number(p.level ?? 1),
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      baseStats: p.baseStats as GameStateTeamMember["baseStats"],
      currentHp: typeof p.currentHp === "number" ? p.currentHp : 1,
      maxHp: typeof p.maxHp === "number" ? p.maxHp : 1,
      isShiny: Boolean(p.isShiny),
      moveTier: Math.max(0, Math.min(2, Number(p.moveTier ?? 0))),
      heldItem: p.heldItem != null
        ? { id: String((p.heldItem as Record<string, unknown>).id ?? "") }
        : null,
    }));

    const items: GameStateBagEntry[] = rawItems.map((it, idx) => ({
      idx,
      id: String(it.id ?? ""),
      usable: Boolean(it.usable),
    }));

    return {
      currentMap: Number(st?.currentMap ?? 0),
      eliteIndex: Number(st?.eliteIndex ?? 0),
      team,
      items,
    };
  });
}
