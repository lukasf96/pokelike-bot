import type { Page } from "puppeteer";

import {
  type MapCandidateBrief,
  type TeamMemberBrief,
  pickBattlePrepIntel,
  scoreCandidate,
  shouldReorderForBattle,
  computeTeamOrder,
} from "../battle-intel.js";
import { sleep } from "../page-utils.js";
import { maybeEquipBagHeldItems, maybeOptimizeHeldItemSwaps } from "./held-item-swaps.js";
import { dismissTutorial } from "./startup.js";

/** Successful `page.evaluate` snapshot of the map layer (non-empty clickable set). */
type MapPageOk = {
  empty: false;
  lowHp: boolean;
  hpRatio: number;
  currentMap: number;
  eliteIndex: number;
  team: TeamMemberBrief[];
  candidates: Array<{ href: string; surfaceKind: string; idx: number }>;
};

export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);
  await maybeEquipBagHeldItems(page);
  await maybeOptimizeHeldItemSwaps(page);

  const snapshot = (await page.evaluate(() => {
    let hpRatio = 1;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team = (st?.team ?? []) as Array<{ currentHp: number; maxHp: number }>;
      const tot = team.reduce((s, p) => s + p.currentHp, 0);
      const mx = team.reduce((s, p) => s + p.maxHp, 0);
      if (mx > 0) hpRatio = tot / mx;
    } catch {
      /* state not accessible */
    }
    const lowHp = hpRatio < 0.6;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const currentMap = Number(st?.currentMap ?? 0);
    const eliteIndex = Number(st?.eliteIndex ?? 0);
    const team: TeamMemberBrief[] = (st?.team ?? []).map((p: { types?: string[] }) => ({
      types: p.types ?? [],
    }));

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
      hpRatio,
      currentMap,
      eliteIndex,
      team,
      candidates: candidates.map(({ idx, href, surfaceKind }) => ({ idx, href, surfaceKind })),
    };
  })) as MapPageOk | { empty: true; reason: string };

  if (snapshot.empty || snapshot.candidates.length === 0) {
    console.log(`  [map] ${"reason" in snapshot ? snapshot.reason : "no candidates"}`);
    await sleep(1500);
    return;
  }

  const context = { currentMap: snapshot.currentMap, eliteIndex: snapshot.eliteIndex };

  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < snapshot.candidates.length; i++) {
    const c = snapshot.candidates[i]!;
    const cand: MapCandidateBrief = { href: c.href, surfaceKind: c.surfaceKind };
    const s = scoreCandidate(snapshot.lowHp, cand, snapshot.team, context);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const chosen = snapshot.candidates[bestIdx]!;
  const prep = pickBattlePrepIntel(
    { href: chosen.href, surfaceKind: chosen.surfaceKind },
    context,
  );

  if (shouldReorderForBattle(prep.intel, prep.enemyTypings)) {
    const order = computeTeamOrder(snapshot.team, prep.leadTypingsPool);
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
      prep.intel.category === "trainer"
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

  const summary = snapshot.candidates
    .map((c, i) => {
      const cand: MapCandidateBrief = { href: c.href, surfaceKind: c.surfaceKind };
      const sc = scoreCandidate(snapshot.lowHp, cand, snapshot.team, context);
      return `${c.surfaceKind}(${sc.toFixed(1)})`;
    })
    .join(", ");

  console.log(
    `  [map] hp=${Math.round(snapshot.hpRatio * 100)}% lowHp=${snapshot.lowHp} map=${snapshot.currentMap} eliteIdx=${snapshot.eliteIndex} | ${summary} → picked ${chosen.surfaceKind} score=${bestScore.toFixed(1)}`,
  );

  await sleep(1200);
}
