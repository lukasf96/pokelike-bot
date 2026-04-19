import {
  type MapCandidateBrief,
  type NodeIntel,
  type ScoreCandidateContext,
  bossLevelStats,
  inferNodeIntel,
  pickBattlePrepIntel,
  scoreCandidate,
  shouldReorderForBattle,
  computeTeamOrder,
  computeTeamOrderForQuestionMark,
} from "../battle-intel.js";
import { logAction } from "../logger.js";
import { adjustMapScoreWithWinProbability, estimateBattleWinProbability } from "../sim/win-probability.js";
import type { Handler, HandlerCtx } from "../state/handler.js";
import { selectBagItemIds, selectItemTeam, selectTeamBrief, selectTeamHp } from "../state/selectors.js";
import type { Tick } from "../state/types.js";
import { sleep } from "../page-utils.js";
import { maybeEquipBagHeldItems, maybeOptimizeHeldItemSwaps } from "./held-item-swaps.js";
import { maybeUseUsableItems } from "./usable-item.js";
import { dismissTutorial } from "./startup.js";

export const handleMap: Handler = async (initialTick, ctx) => {
  await dismissTutorial(ctx.page);

  // ── Pre-map upkeep: each helper performs UI clicks that mutate state, so each
  //    re-observes between iterations. We re-observe once here to pick up the
  //    final state before scoring map candidates. ────────────────────────────
  await maybeUseUsableItems(initialTick, ctx);
  let tick: Tick = await ctx.reobserve();
  await maybeEquipBagHeldItems(tick, ctx);
  tick = await ctx.reobserve();
  await maybeOptimizeHeldItemSwaps(tick, ctx);
  tick = await ctx.reobserve();

  if (tick.phase.kind !== "map" || !tick.game) {
    // Helpers may have transitioned us off the map (e.g. modal still open)
    return;
  }

  const game = tick.game;
  const candidates = tick.ui.map?.candidates ?? [];
  if (candidates.length === 0) {
    logAction("map", "no candidates");
    await sleep(1500);
    return;
  }

  const teamBrief = selectTeamBrief(game);
  const teamRaw = selectItemTeam(game);
  const bagItemIds = selectBagItemIds(game);
  const hp = selectTeamHp(game);
  const context = { currentMap: game.currentMap, eliteIndex: game.eliteIndex };

  // ── Boss lookahead ──────────────────────────────────────────────────────
  // pWinBoss tells us whether to detour for trainers / PC even if no boss
  // node is in the current candidate set. bossImminent flips when the boss
  // node is *one click away* (final pre-boss layer).
  const bossIntel: NodeIntel =
    game.currentMap >= 8
      ? { category: "elite", eliteIndex: game.eliteIndex }
      : { category: "gym", mapIndex: game.currentMap };
  const pWinBoss = estimateBattleWinProbability(bossIntel, teamRaw, bagItemIds, context);
  const bossImminent = candidates.some(
    (c) => c.surfaceKind === "gym" || c.surfaceKind === "elite",
  );
  const pcAvailable = candidates.some((c) => c.surfaceKind === "pokecenter");

  // Team-level / boss-level summary feeds Grind Mode in scoreCandidate.
  // Use ALIVE max level (a fainted L20 mon doesn't help us close the gap).
  let teamMaxLevel = 0;
  let aliveTeamSize = 0;
  for (const p of game.team) {
    if (p.hp.current <= 0) continue;
    aliveTeamSize += 1;
    if (p.level > teamMaxLevel) teamMaxLevel = p.level;
  }
  const { leadLevel: bossLeadLevel, maxLevel: bossMaxLevel } = bossLevelStats(
    game.currentMap,
    game.eliteIndex,
  );

  const scoreCtx: ScoreCandidateContext = {
    ...context,
    hpRatio: hp.ratio,
    bossImminent,
    pcAvailable,
    pWinBoss,
    teamMaxLevel,
    aliveTeamSize,
    bossLeadLevel,
    bossMaxLevel,
  };

  const scored = candidates.map((c) => {
    const cand: MapCandidateBrief = { href: c.href, surfaceKind: c.surfaceKind };
    const intel = inferNodeIntel(cand.href, context);
    const baseScore = scoreCandidate(hp.lowHp, cand, teamBrief, scoreCtx);
    const pWin = estimateBattleWinProbability(intel, teamRaw, bagItemIds, context);
    const adjusted = adjustMapScoreWithWinProbability(baseScore, intel, hp.lowHp, pWin);
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

  const chosen = candidates[bestIdx]!;
  const best = scored[bestIdx]!;
  const prep = pickBattlePrepIntel(
    { href: chosen.href, surfaceKind: chosen.surfaceKind },
    context,
  );

  if (shouldReorderForBattle(chosen.surfaceKind, prep.intel, prep.enemyTypings)) {
    const order =
      chosen.surfaceKind === "question"
        ? computeTeamOrderForQuestionMark(teamBrief, context)
        : computeTeamOrder(teamBrief, prep.leadTypingsPool);
    await reorderTeam(ctx, order);
    const detail = formatPrepDetail(chosen.surfaceKind, prep.intel);
    logAction("map", `team order → [${order.join(",")}] for ${prep.intel.category}${detail}`);
  }

  await ctx.page.evaluate((pickIndex: number) => {
    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );
    clickable[pickIndex]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, bestIdx);

  const summary = scored.map((r) => `${r.c.surfaceKind}(${r.adjusted.toFixed(1)})`).join(", ");

  logAction(
    "map",
    `→ ${chosen.surfaceKind} · score ${bestScore.toFixed(1)} · pWin ${best.pWin.toFixed(2)} · candidates ${summary}`,
  );
  const levelGap = bossMaxLevel - teamMaxLevel;
  logAction(
    "map",
    `Team hp ${Math.round(hp.ratio * 100)}% · faint ${hp.fainted} · crit ${hp.critical} · lowHp ${hp.lowHp} · map ${game.currentMap} · elite ${game.eliteIndex} · pWinBoss ${pWinBoss.toFixed(2)} · teamMaxL ${teamMaxLevel}/${bossMaxLevel} (gap ${levelGap})${bossImminent ? " · BOSS_IMMINENT" : ""}${pcAvailable ? " · pc" : ""}`,
  );

  await sleep(1200);
};

async function reorderTeam(ctx: HandlerCtx, order: number[]): Promise<void> {
  await ctx.page.evaluate((permutation: number[]) => {
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
}

function formatPrepDetail(surfaceKind: string, intel: ReturnType<typeof pickBattlePrepIntel>["intel"]): string {
  if (surfaceKind === "question") return " (?)";
  switch (intel.category) {
    case "trainer":
      return ` (${intel.key})`;
    case "gym":
      return ` (map ${intel.mapIndex})`;
    case "elite":
      return ` (elite ${intel.eliteIndex})`;
    case "wild":
      return ` (map ${intel.mapIndex})`;
    case "legendary":
      return " (legendary)";
    case "dynamic_trainer":
      return ` (dyn map ${intel.mapIndex})`;
    default:
      return "";
  }
}
