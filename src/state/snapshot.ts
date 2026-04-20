/**
 * Single source of truth for "what does the world look like right now?"
 *
 * One `page.evaluate` per tick captures: active screen + overlays → `Phase`,
 * `localStorage[poke_current_run]` → `GameSnapshot` (or null), and any
 * phase-specific UI bits the matching handler will need (so handlers never
 * read state via `page.evaluate` themselves — they only click).
 *
 * IMPORTANT: Avoid nested `function` declarations / class methods inside the
 * evaluate body. tsx emits `__name(...)` helpers that exist only in Node —
 * the browser evaluate context has no `__name`. Inline arrow functions and
 * loops are fine.
 */

import type { Page } from "puppeteer";

import { POKE_CURRENT_RUN_LS_KEY } from "../utility/constants.js";
import type { GameSnapshot, PhaseKind, Tick, TickUi } from "./types.js";

interface RawObservation {
  phaseKind: PhaseKind;
  game: GameSnapshot | null;
  ui: TickUi;
  observedAt: number;
}

interface ObserveOptions {
  lsKey: string;
  /** Whether to capture the screen-text peek (mildly expensive). */
  withPeek: boolean;
}

export interface ObserveDeps {
  /** Disable phase-specific UI prefetch; useful for cheap polling/back-pressure. Defaults to true. */
  withUi?: boolean;
  /** Capture screen-text peek (used for transition logging). Defaults to true. */
  withPeek?: boolean;
}

export async function observe(page: Page, tickId: number, deps: ObserveDeps = {}): Promise<Tick> {
  const opts: ObserveOptions = {
    lsKey: POKE_CURRENT_RUN_LS_KEY,
    withPeek: deps.withPeek ?? true,
  };
  const withUi = deps.withUi ?? true;

  const raw = await page.evaluate((o: ObserveOptions): RawObservation => {
    // ── 1. Phase resolution ──────────────────────────────────────────────
    const screenIds = [
      "title-screen",
      "trainer-screen",
      "starter-screen",
      "map-screen",
      "battle-screen",
      "catch-screen",
      "item-screen",
      "swap-screen",
      "trade-screen",
      "shiny-screen",
      "badge-screen",
      "transition-screen",
      "gameover-screen",
      "win-screen",
    ];
    let activeScreen = "unknown";
    for (const id of screenIds) {
      const el = document.getElementById(id);
      if (el?.classList.contains("active")) {
        activeScreen = id;
        break;
      }
    }

    const eeveeOverlay = document.getElementById("eevee-choice-overlay");
    const eeveeOpen =
      eeveeOverlay !== null &&
      (eeveeOverlay as HTMLElement).style.display !== "none" &&
      (eeveeOverlay as HTMLElement).style.display !== "";

    const equipModal = document.getElementById("item-equip-modal");
    const tutorOpen = equipModal !== null && equipModal.querySelector("#btn-skip-tutor") !== null;
    const itemEquipOpen =
      equipModal !== null && equipModal.querySelector("#btn-equip-to-bag") !== null;

    const screenToPhase: Record<string, PhaseKind> = {
      "title-screen": "title",
      "trainer-screen": "trainer",
      "starter-screen": "starter",
      "map-screen": "map",
      "battle-screen": "battle",
      "catch-screen": "catch",
      "item-screen": "item",
      "swap-screen": "swap",
      "trade-screen": "trade",
      "shiny-screen": "shiny",
      "badge-screen": "badge",
      "transition-screen": "transition",
      "win-screen": "win",
      "gameover-screen": "gameover",
    };

    const phaseKind: PhaseKind = eeveeOpen
      ? "eevee-choice"
      : tutorOpen
        ? "move-tutor"
        : itemEquipOpen
          ? "item-equip"
          : screenToPhase[activeScreen] ?? "unknown";

    // ── 2. Game snapshot from localStorage ───────────────────────────────
    let game: GameSnapshot | null = null;
    try {
      const raw = localStorage.getItem(o.lsKey);
      if (raw) {
        const st = JSON.parse(raw) as Record<string, unknown>;
        const teamRaw = Array.isArray(st.team) ? (st.team as Array<Record<string, unknown>>) : [];
        const itemsRaw = Array.isArray(st.items) ? (st.items as Array<Record<string, unknown>>) : [];

        const team = teamRaw.map((p) => {
          const held = p.heldItem as { id?: string } | null | undefined;
          return {
            speciesId: Number(p.speciesId ?? 0),
            name: String(p.nickname ?? p.name ?? ""),
            level: Number(p.level ?? 1),
            types: Array.isArray(p.types) ? (p.types as unknown[]).map(String) : [],
            baseStats: p.baseStats as GameSnapshot["team"][number]["baseStats"],
            hp: { current: Number(p.currentHp ?? 0), max: Number(p.maxHp ?? 0) },
            isShiny: Boolean(p.isShiny),
            moveTier: Math.max(0, Math.min(2, Number(p.moveTier ?? 0))),
            heldItemId: held?.id != null ? String(held.id) : null,
          };
        });

        const bag = itemsRaw.map((it, idx) => ({
          idx,
          id: String(it.id ?? ""),
          usable: Boolean(it.usable),
        }));

        game = {
          team,
          bag,
          currentMap: Number(st.currentMap ?? 0),
          eliteIndex: Number(st.eliteIndex ?? 0),
          badges: typeof st.badges === "number" ? st.badges : 0,
        };
      }
    } catch {
      game = null;
    }

    // ── 3. Phase-specific UI prefetch ────────────────────────────────────
    const ui: TickUi = {};

    if (phaseKind === "battle") {
      const auto = document.getElementById("btn-auto-battle") as HTMLButtonElement | null;
      const cont = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
      const skipVisible = auto !== null && auto.style.display !== "none" && !auto.disabled;
      const continueVisible = cont !== null && cont.style.display !== "none";
      const isDefeat = continueVisible && (cont?.textContent ?? "").trim() === "Continue...";
      ui.battle = {
        skipVisible,
        continueVisible,
        isDefeat,
        title: isDefeat ? (document.getElementById("battle-title")?.textContent ?? "").trim() : "",
        subtitle: isDefeat
          ? (document.getElementById("battle-subtitle")?.textContent ?? "").trim()
          : "",
      };
    }

    if (phaseKind === "map") {
      const groups = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter(
        (g) => (g.getAttribute("style") ?? "").includes("cursor: pointer"),
      );
      const candidates = groups.map((g, idx) => {
        const img = g.querySelector<SVGImageElement>("image");
        const hrefRaw = img?.getAttribute("href") ?? img?.getAttribute("xlink:href") ?? "";

        let pathDecoded = hrefRaw;
        try {
          pathDecoded = decodeURIComponent(hrefRaw.split("?")[0] ?? "");
        } catch {
          pathDecoded = hrefRaw.split("?")[0] ?? "";
        }
        const stemMatch = pathDecoded.match(/([^/]+)\.(png|gif|webp)$/i);
        const stem = (stemMatch?.[1] ?? "").replace(/%20/gi, " ").trim().toLowerCase();

        let pathForIncludes = "";
        try {
          pathForIncludes = decodeURIComponent((hrefRaw || "").split("?")[0] ?? "").toLowerCase();
        } catch {
          pathForIncludes = ((hrefRaw || "").split("?")[0] ?? "").toLowerCase();
        }

        const trainerStems = new Set([
          "acetrainer",
          "bugcatcher",
          "firespitter",
          "fisher",
          "hiker",
          "oldguy",
          "policeman",
          "scientist",
          "teamrocket",
        ]);
        const gymStems = new Set([
          "brock",
          "misty",
          "lt. surge",
          "erika",
          "koga",
          "sabrina",
          "blaine",
          "giovanni",
        ]);

        const surfaceKind = pathForIncludes.includes("catchpokemon")
          ? "catch"
          : pathForIncludes.includes("grass")
            ? "battle"
            : pathForIncludes.includes("itemicon")
              ? "item"
              : pathForIncludes.includes("poke center") || pathForIncludes.includes("pokecenter")
                ? "pokecenter"
                : pathForIncludes.includes("movetutor")
                  ? "move_tutor"
                  : pathForIncludes.includes("legendaryencounter")
                    ? "legendary"
                    : pathForIncludes.includes("questionmark")
                      ? "question"
                      : pathForIncludes.includes("tradeicon")
                        ? "trade"
                        : stem === "champ"
                          ? "elite"
                          : trainerStems.has(stem)
                            ? "trainer"
                            : gymStems.has(stem)
                              ? "gym"
                              : stem === "poke center"
                                ? "pokecenter"
                                : "unknown";

        return { idx, href: hrefRaw, surfaceKind };
      });
      ui.map = { candidates };
    }

    if (phaseKind === "catch") {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>("#catch-choices .poke-card"),
      );
      const options = cards.map((c, i) => {
        const nameEl = c.querySelector<HTMLElement>(".poke-name");
        const name = nameEl?.textContent?.trim() ?? "?";
        const levelEl = c.querySelector<HTMLElement>(".poke-level, [class*='level']");
        const levelText = levelEl?.textContent?.replace(/[^0-9]/g, "") ?? "";
        const level = levelText ? parseInt(levelText, 10) : 5;
        // renderPokemonCard() exposes no data-id attribute, but every card
        // carries a sprite whose URL encodes the Pokédex id:
        //   .../sprites/pokemon/<id>.png   (normal)
        //   .../sprites/pokemon/shiny/<id>.png (shiny)
        // Without this, speciesId was always 0 and handlers/catch.ts skipped
        // scoring entirely — the bot just picked whichever option came first.
        const speciesIdAttr = c.getAttribute("data-species-id") ?? c.getAttribute("data-id") ?? "";
        let speciesId = speciesIdAttr ? parseInt(speciesIdAttr, 10) : 0;
        if (!speciesId) {
          const img = c.querySelector<HTMLImageElement>("img.poke-sprite, img[src*='/sprites/pokemon/']");
          const src = img?.getAttribute("src") ?? "";
          const m = src.match(/\/sprites\/pokemon\/(?:shiny\/)?(\d+)\.png/i);
          if (m) speciesId = Number(m[1]);
        }
        const isShiny =
          c.querySelector(".shiny-badge, [class*='shiny']") !== null ||
          (c.textContent?.includes("★") ?? false) ||
          (c.textContent?.includes("Shiny") ?? false);
        return { index: i, speciesId, level, isShiny, name };
      });
      ui.catch = { options };
    }

    if (phaseKind === "item") {
      const names = Array.from(
        document.querySelectorAll<HTMLElement>("#item-choices .item-card"),
      ).map((c) => c.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "");
      ui.item = { names };
    }

    if (phaseKind === "item-equip") {
      const modal = document.getElementById("item-equip-modal");
      if (modal) {
        const itemName =
          modal.querySelector<HTMLElement>(".equip-item-name")?.textContent?.trim() ?? "";
        const idxButtons = Array.from(
          modal.querySelectorAll<HTMLButtonElement>("button[data-idx]"),
        )
          .filter((b) => !b.classList.contains("equip-btn-unequip"))
          .map((b) => parseInt(b.dataset.idx ?? "-1", 10))
          .filter((n) => Number.isFinite(n) && n >= 0);
        ui.itemEquip = { itemName, idxButtons };
      }
    }

    if (phaseKind === "shiny") {
      const img = document.querySelector<HTMLImageElement>("#shiny-content img.poke-sprite");
      const src = img?.getAttribute("src") ?? "";
      const idFromShiny = src.match(/\/pokemon\/shiny\/(\d+)\.png/i);
      const idFromPlain = src.match(/\/pokemon\/(\d+)\.png/i);
      const speciesId = idFromShiny
        ? Number(idFromShiny[1])
        : idFromPlain
          ? Number(idFromPlain[1])
          : 0;
      const lvEl = document.querySelector("#shiny-content .poke-level");
      const lvMatch = (lvEl?.textContent ?? "").match(/(\d+)/);
      const level = lvMatch ? Number(lvMatch[1]) : 0;
      ui.shiny = { speciesId, level };
    }

    if (o.withPeek) {
      const active = document.querySelector<HTMLElement>(".screen.active");
      const text = (active?.innerText ?? document.body.innerText)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      ui.peek = { raw: text };
    }

    return { phaseKind, game, ui, observedAt: Date.now() };
  }, opts);

  return {
    tickId,
    observedAt: raw.observedAt,
    phase: { kind: raw.phaseKind },
    game: raw.game,
    ui: withUi ? raw.ui : { peek: raw.ui.peek },
  };
}

/** Convenience: observe with no UI prefetch and no peek (cheap polling). */
export async function observeMinimal(page: Page, tickId: number): Promise<Tick> {
  return observe(page, tickId, { withUi: false, withPeek: false });
}
