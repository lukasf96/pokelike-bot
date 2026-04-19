/**
 * Central reader for active run state. The live game keeps `state` as a script `let` (not `window.state`)
 * but mirrors it to localStorage via `saveRun()` — same key as `run-log.ts` uses.
 *
 * IMPORTANT: Avoid nested `function` declarations inside `page.evaluate(...)`.
 * tsx emits `__name(...)` helpers that exist only in Node — the browser evaluate context has no `__name`.
 */

import type { Page } from "puppeteer";

import { POKE_CURRENT_RUN_LS_KEY } from "./constants.js";

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
  return page.evaluate((lsKey): GameState => {
    let fromStorage: Record<string, unknown> | undefined;
    try {
      const rawLs = localStorage.getItem(lsKey);
      if (rawLs) {
        const parsed = JSON.parse(rawLs) as unknown;
        if (parsed != null && typeof parsed === "object") fromStorage = parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }

    let fromLive: Record<string, unknown> | null = null;
    try {
      const s = new Function(
        "try { return typeof state !== 'undefined' ? state : undefined; } catch (e) { return undefined; }",
      )() as unknown;
      fromLive = s != null && typeof s === "object" ? (s as Record<string, unknown>) : null;
    } catch {
      /* ignore */
    }

    const fromWindow = (window as unknown as { state?: Record<string, unknown> }).state;

    const base = fromStorage ?? fromWindow ?? fromLive ?? {};
    let st: Record<string, unknown>;

    if (!fromStorage && fromWindow == null && fromLive == null) {
      st = base;
    } else {
      const persistTeam = fromStorage?.team;
      const persistItems = fromStorage?.items;
      const liveTeam = fromLive?.team ?? fromWindow?.team;
      const liveItems = fromLive?.items ?? fromWindow?.items;

      const teamRaw =
        Array.isArray(persistTeam) && persistTeam.length > 0
          ? persistTeam
          : Array.isArray(liveTeam) && liveTeam.length > 0
            ? liveTeam
            : Array.isArray(persistTeam)
              ? persistTeam
              : [];

      const itemsRaw =
        Array.isArray(persistItems) && persistItems.length > 0
          ? persistItems
          : Array.isArray(liveItems) && liveItems.length > 0
            ? liveItems
            : Array.isArray(persistItems)
              ? persistItems
              : [];

      st = {
        ...base,
        team: teamRaw,
        items: itemsRaw,
        currentMap:
          typeof base.currentMap === "number" ? base.currentMap : Number(base.currentMap ?? 0),
        eliteIndex:
          typeof base.eliteIndex === "number" ? base.eliteIndex : Number(base.eliteIndex ?? 0),
      };
    }

    const rawTeam = (st.team ?? []) as Array<Record<string, unknown>>;
    const team = rawTeam.map((p) => ({
      speciesId: Number(p.speciesId ?? 0),
      level: Number(p.level ?? 1),
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      baseStats: p.baseStats as GameStateTeamMember["baseStats"],
      currentHp: typeof p.currentHp === "number" ? p.currentHp : 1,
      maxHp: typeof p.maxHp === "number" ? p.maxHp : 1,
      isShiny: Boolean(p.isShiny),
      moveTier: Math.max(0, Math.min(2, Number(p.moveTier ?? 0))),
      heldItem:
        p.heldItem != null ? { id: String((p.heldItem as Record<string, unknown>).id ?? "") } : null,
    }));

    const rawItems = (st.items ?? []) as Array<Record<string, unknown>>;
    const items = rawItems.map((it, idx) => ({
      idx,
      id: String(it.id ?? ""),
      usable: Boolean(it.usable),
    }));

    return {
      currentMap: Number(st.currentMap ?? 0),
      eliteIndex: Number(st.eliteIndex ?? 0),
      team,
      items,
    };
  }, POKE_CURRENT_RUN_LS_KEY);
}
