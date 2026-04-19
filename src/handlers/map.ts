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
import { sleep } from "../page-utils.js";
import { maybeEquipBagHeldItems, maybeOptimizeHeldItemSwaps } from "./held-item-swaps.js";
import { maybeUseUsableItems } from "./usable-item.js";
import { dismissTutorial } from "./startup.js";

/** Successful `page.evaluate` snapshot of the map layer (non-empty clickable set). */
type MapPageOk = {
  empty: false;
  lowHp: boolean;
  /** Team members at 0 HP */
  nFainted: number;
  /** Team members above 0 HP but below 25% max HP */
  nCritical: number;
  hpRatio: number;
  currentMap: number;
  eliteIndex: number;
  team: TeamMemberBrief[];
  /** Raw team for battle simulation (base stats, HP, items). */
  teamRaw: unknown[];
  bagItemIds: string[];
  candidates: Array<{ href: string; surfaceKind: string; idx: number }>;
};

export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);
  await maybeUseUsableItems(page);
  await maybeEquipBagHeldItems(page);
  await maybeOptimizeHeldItemSwaps(page);

  const snapshot = (await page.evaluate(() => {
    let hpRatio = 1;
    let nFainted = 0;
    let nCritical = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team = (st?.team ?? []) as Array<{ currentHp: number; maxHp: number }>;
      const tot = team.reduce((s, p) => s + p.currentHp, 0);
      const mx = team.reduce((s, p) => s + p.maxHp, 0);
      if (mx > 0) hpRatio = tot / mx;
      for (const p of team) {
        const maxHp = p.maxHp ?? 1;
        const cur = p.currentHp ?? 0;
        if (cur <= 0) nFainted += 1;
        else if (maxHp > 0 && cur / maxHp < 0.25) nCritical += 1;
      }
    } catch {
      /* state not accessible */
    }
    const lowHp = nFainted >= 1 || nCritical >= 2 || hpRatio < 0.55;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const currentMap = Number(st?.currentMap ?? 0);
    const eliteIndex = Number(st?.eliteIndex ?? 0);
    const teamRaw = st?.team ?? [];
    const team: TeamMemberBrief[] = (teamRaw as Array<{ types?: string[] }>).map((p) => ({
      types: p.types ?? [],
    }));
    const bagItemIds = ((st?.items ?? []) as Array<{ id?: string }>)
      .map((it) => String(it?.id ?? ""))
      .filter(Boolean);

    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );

    if (clickable.length === 0) {
      return { empty: true as const, reason: "no clickable nodes" };
    }

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
      return { g, idx, href, surfaceKind };
    });

    return {
      empty: false as const,
      lowHp,
      nFainted,
      nCritical,
      hpRatio,
      currentMap,
      eliteIndex,
      team,
      teamRaw,
      bagItemIds,
      candidates: candidates.map(({ idx, href, surfaceKind }) => ({ idx, href, surfaceKind })),
    };
  })) as MapPageOk | { empty: true; reason: string };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team = st?.team;
      if (!Array.isArray(team) || team.length === 0) return;
      const next = permutation.map((i) => team[i]).filter(Boolean);
      if (next.length !== team.length) return;
      team.splice(0, team.length, ...next);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rtb = (window as any).renderTeamBar;
      if (typeof rtb === "function") rtb(team);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const save = (window as any).saveRun;
      if (typeof save === "function") save();
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
