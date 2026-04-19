import type { Page } from "puppeteer";

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


export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);
  await maybeUseUsableItems(page);
  await maybeEquipBagHeldItems(page);
  await maybeOptimizeHeldItemSwaps(page);

  const [gs, domResult] = await Promise.all([
    readGameState(page),
    page.evaluate((): { empty: true; reason: string } | { empty: false; candidates: Array<{ href: string; surfaceKind: string; idx: number }> } => {
      const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
        (g.getAttribute("style") ?? "").includes("cursor: pointer"),
      );
      if (clickable.length === 0) return { empty: true, reason: "no clickable nodes" };
      const candidates = clickable.map((g, idx) => {
        const img = g.querySelector<SVGImageElement>("image");
        const href = img?.getAttribute("href") ?? img?.getAttribute("xlink:href") ?? "";
        const surfaceKind = href.includes("catchPokemon")
          ? "catch"
          : href.includes("grass")
            ? "battle"
            : href.includes("itemIcon")
              ? "item"
              : href.includes("Poke Center") || href.includes("PokeCenter")
                ? "pokecenter"
                : href.includes("moveTutor")
                  ? "move_tutor"
                  : href.includes("legendaryEncounter")
                    ? "legendary"
                    : href.includes("questionMark")
                      ? "question"
                      : href.includes("tradeIcon")
                        ? "trade"
                        : "unknown";
        return { idx, href, surfaceKind };
      });
      return { empty: false, candidates };
    }),
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
    console.log(`  [map] ${"reason" in snapshot ? snapshot.reason : "no candidates"}`);
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
      const w = window as unknown as { state: { team: unknown[] }; renderTeamBar?: (t: unknown[]) => void; saveRun?: () => void };
      const team = w.state?.team;
      if (!Array.isArray(team) || team.length === 0) return;
      const next = permutation.map((i) => team[i]).filter(Boolean);
      if (next.length !== team.length) return;
      team.splice(0, team.length, ...next);
      if (typeof w.renderTeamBar === "function") w.renderTeamBar(team);
      if (typeof w.saveRun === "function") w.saveRun();
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
    console.log(`  [map] team order → [${order.join(",")}] for ${prep.intel.category}${detail}`);
  }

  await page.evaluate((pickIndex: number) => {
    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );
    const best = clickable[pickIndex];
    best?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, bestIdx);

  const summary = scored.map((r) => `${r.c.surfaceKind}(${r.adjusted.toFixed(1)})`).join(", ");

  console.log(
    `  [map] hp=${Math.round(snapshot.hpRatio * 100)}% faint=${snapshot.nFainted} crit=${snapshot.nCritical} lowHp=${snapshot.lowHp} map=${snapshot.currentMap} eliteIdx=${snapshot.eliteIndex} | ${summary} → picked ${chosen.surfaceKind} score=${bestScore.toFixed(1)} pWin≈${best.pWin.toFixed(2)}`,
  );

  await sleep(1200);
}
