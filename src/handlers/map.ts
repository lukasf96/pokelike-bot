import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import {
  type MapCandidateBrief,
  type TeamMemberBrief,
  inferNodeIntel,
  pickBattlePrepIntel,
  scoreCandidate,
  shouldReorderForBattle,
  computeTeamOrder,
  computeTeamOrderForQuestionMark,
} from "../battle-intel.js";
import { adjustMapScoreWithWinProbability, estimateBattleWinProbability } from "../sim/win-probability.js";
import { readGameState } from "../game-state.js";
import { sleep } from "../page-utils.js";
import { maybeEquipBagHeldItems, maybeOptimizeHeldItemSwaps } from "./held-item-swaps.js";
import { maybeUseUsableItems } from "./usable-item.js";
import { dismissTutorial } from "./startup.js";

/**
 * Filename stems from pokelike `map.js` — trainer nodes use `sprites/<key>.png` (not `grass.png`).
 * Gym bosses use `GYM_LEADER_SPRITES`; Elite champion layer uses `champ.png`.
 */
const MAP_SURFACE_STEMS_PAYLOAD = {
  trainerStems: [
    "acetrainer",
    "bugcatcher",
    "firespitter",
    "fisher",
    "hiker",
    "oldguy",
    "policeman",
    "scientist",
    "teamrocket",
  ],
  gymStems: ["brock", "misty", "lt. surge", "erika", "koga", "sabrina", "blaine", "giovanni"],
} as const;

export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);
  await maybeUseUsableItems(page);
  await maybeEquipBagHeldItems(page);
  await maybeOptimizeHeldItemSwaps(page);

  const [gs, domResult] = await Promise.all([
    readGameState(page),
    page.evaluate(
      (payload: { trainerStems: readonly string[]; gymStems: readonly string[] }): {
        empty: true;
        reason: string;
      } | {
        empty: false;
        candidates: Array<{ href: string; surfaceKind: string; idx: number }>;
      } => {
        const trainerSet = new Set(payload.trainerStems);
        const gymSet = new Set(payload.gymStems);

        const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
          (g.getAttribute("style") ?? "").includes("cursor: pointer"),
        );
        if (clickable.length === 0) return { empty: true, reason: "no clickable nodes" };
        const candidates = clickable.map((g, idx) => {
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

          /** Decode path so `Poke%20Center.png` matches poke center checks (same as stem). */
          let pathForIncludes = "";
          try {
            pathForIncludes = decodeURIComponent((hrefRaw || "").split("?")[0] ?? "").toLowerCase();
          } catch {
            pathForIncludes = ((hrefRaw || "").split("?")[0] ?? "").toLowerCase();
          }

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
                            : trainerSet.has(stem)
                              ? "trainer"
                              : gymSet.has(stem)
                                ? "gym"
                                : stem === "poke center"
                                  ? "pokecenter"
                                  : "unknown";

          return { idx, href: hrefRaw, surfaceKind };
        });
        return { empty: false, candidates };
      },
      MAP_SURFACE_STEMS_PAYLOAD,
    ),
  ]);

  let nFainted = 0;
  let nCritical = 0;
  let hpRatio = 1;
  const tot = gs.team.reduce((s, p) => s + p.currentHp, 0);
  const mx = gs.team.reduce((s, p) => s + p.maxHp, 0);
  if (mx > 0) hpRatio = tot / mx;
  for (const p of gs.team) {
    if (p.currentHp <= 0) nFainted += 1;
    else if (p.maxHp > 0 && p.currentHp / p.maxHp < 0.25) nCritical += 1;
  }
  const lowHp = nFainted >= 1 || nCritical >= 2 || hpRatio < 0.55;

  const snapshot = domResult.empty
    ? domResult
    : {
        empty: false as const,
        lowHp,
        nFainted,
        nCritical,
        hpRatio,
        currentMap: gs.currentMap,
        eliteIndex: gs.eliteIndex,
        team: gs.team.map((p): TeamMemberBrief => ({ types: p.types })),
        teamRaw: gs.team,
        bagItemIds: gs.items.map((it) => it.id).filter(Boolean),
        candidates: domResult.candidates,
      };

  if (snapshot.empty || snapshot.candidates.length === 0) {
    logAction("map", `${"reason" in snapshot ? snapshot.reason : "no candidates"}`);
    await sleep(1500);
    return;
  }

  const context = { currentMap: snapshot.currentMap, eliteIndex: snapshot.eliteIndex };

  const scored = snapshot.candidates.map((c) => {
    const cand: MapCandidateBrief = { href: c.href, surfaceKind: c.surfaceKind };
    const intel = inferNodeIntel(cand.href, context);
    const baseScore = scoreCandidate(snapshot.lowHp, cand, snapshot.team, context);
    const pWin = estimateBattleWinProbability(intel, snapshot.teamRaw, snapshot.bagItemIds, context);
    const adjusted = adjustMapScoreWithWinProbability(baseScore, intel, snapshot.lowHp, pWin);
    return { c, pWin, adjusted };
  });

  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i]!.adjusted > bestScore) {
      bestScore = scored[i]!.adjusted;
      bestIdx = i;
    }
  }

  const chosen = snapshot.candidates[bestIdx]!;
  const best = scored[bestIdx]!;
  const prep = pickBattlePrepIntel(
    { href: chosen.href, surfaceKind: chosen.surfaceKind },
    context,
  );

  if (shouldReorderForBattle(chosen.surfaceKind, prep.intel, prep.enemyTypings)) {
    const order =
      chosen.surfaceKind === "question"
        ? computeTeamOrderForQuestionMark(snapshot.team, context)
        : computeTeamOrder(snapshot.team, prep.leadTypingsPool);
    await page.evaluate((permutation: number[]) => {
      let team: unknown[] | undefined;
      try {
        const st = new Function(
          "try { return typeof state !== 'undefined' ? state : undefined; } catch (e) { return undefined; }",
        )() as { team?: unknown[] } | undefined;
        team = st?.team as unknown[] | undefined;
      } catch {
        /* ignore */
      }
      const win = window as unknown as { state?: { team?: unknown[] } };
      if (!Array.isArray(team) || team.length === 0) team = win.state?.team;
      if (!Array.isArray(team) || team.length === 0) return;

      const next = permutation.map((i) => team![i]).filter(Boolean);
      if (next.length !== team.length) return;
      team.splice(0, team.length, ...next);

      let renderTeamBarRef: unknown;
      try {
        renderTeamBarRef = new Function(
          "try { return typeof renderTeamBar !== 'undefined' ? renderTeamBar : undefined; } catch (e) { return undefined; }",
        )();
      } catch {
        renderTeamBarRef = undefined;
      }
      if (typeof renderTeamBarRef === "function") (renderTeamBarRef as (t: unknown[]) => void)(team);

      let saveRunRef: unknown;
      try {
        saveRunRef = new Function(
          "try { return typeof saveRun !== 'undefined' ? saveRun : undefined; } catch (e) { return undefined; }",
        )();
      } catch {
        saveRunRef = undefined;
      }
      if (typeof saveRunRef === "function") (saveRunRef as () => void)();
    }, order);
    const detail =
      chosen.surfaceKind === "question"
        ? " (?)"
        : prep.intel.category === "trainer"
          ? ` (${prep.intel.key})`
          : prep.intel.category === "gym"
            ? ` (map ${prep.intel.mapIndex})`
            : prep.intel.category === "elite"
              ? ` (elite ${prep.intel.eliteIndex})`
              : prep.intel.category === "wild"
                ? ` (map ${prep.intel.mapIndex})`
                : prep.intel.category === "legendary"
                  ? " (legendary)"
                  : prep.intel.category === "dynamic_trainer"
                    ? ` (dyn map ${prep.intel.mapIndex})`
                    : "";
    logAction("map", `team order → [${order.join(",")}] for ${prep.intel.category}${detail}`);
  }

  await page.evaluate((pickIndex: number) => {
    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );
    const best = clickable[pickIndex];
    best?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, bestIdx);

  const summary = scored.map((r) => `${r.c.surfaceKind}(${r.adjusted.toFixed(1)})`).join(", ");

  logAction(
    "map",
    `→ ${chosen.surfaceKind} · score ${bestScore.toFixed(1)} · pWin ${best.pWin.toFixed(2)} · candidates ${summary}`,
  );
  logAction(
    "map",
    `Team hp ${Math.round(snapshot.hpRatio * 100)}% · faint ${snapshot.nFainted} · crit ${snapshot.nCritical} · lowHp ${snapshot.lowHp} · map ${snapshot.currentMap} · elite ${snapshot.eliteIndex}`,
  );

  await sleep(1200);
}
