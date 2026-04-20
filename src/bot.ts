import puppeteer, { type Browser, type Page } from "puppeteer";

import { GAME_URL } from "./utility/constants.js";
import { warnIfUnexpectedGameVersion } from "./utility/game-version.js";
import {
  logAction,
  logError,
  logGameOverRunBanner,
  logNavigating,
  logRunStarted,
  logScreenPeek,
  logStartupBanner,
  logTurnHeader,
  screenPeekLine,
} from "./logging/logger.js";
import { handleBadge } from "./handlers/badge.js";
import { handleBattle } from "./handlers/battle.js";
import { handleCatch } from "./handlers/catch.js";
import { handleGameOver } from "./handlers/gameover.js";
import { handleItem } from "./handlers/item.js";
import { handleItemEquip } from "./handlers/item-equip.js";
import { handleMap } from "./handlers/map.js";
import { handleMoveTutor } from "./handlers/move-tutor.js";
import { enableAutoSkip } from "./handlers/startup.js";
import { handleShinyExtended } from "./handlers/shiny.js";
import { handleStarter } from "./handlers/starter.js";
import { handleSwap } from "./handlers/swap.js";
import { handleEeveeChoice } from "./handlers/eevee.js";
import { handleTitle } from "./handlers/title.js";
import { handleTrade } from "./handlers/trade.js";
import { handleTrainer } from "./handlers/trainer.js";
import { handleTransition } from "./handlers/transition.js";
import { handleWin } from "./handlers/win.js";
import { clickFirst, humanDelay, sleep } from "./utility/page-utils.js";
import { handleRunLogEvent } from "./logging/run-log.js";
import { setCurrentTurn } from "./logging/run-detail-log.js";
import type { Handler, HandlerCtx } from "./state/handler.js";
import { RunMachine, type RunEvent } from "./state/run-machine.js";
import { observe } from "./state/snapshot.js";
import type { PhaseKind, Tick } from "./state/types.js";

const HANDLERS: Partial<Record<PhaseKind, Handler>> = {
  title: handleTitle,
  trainer: handleTrainer,
  starter: handleStarter,
  map: handleMap,
  battle: handleBattle,
  catch: handleCatch,
  item: handleItem,
  swap: handleSwap,
  trade: handleTrade,
  shiny: handleShinyExtended,
  badge: handleBadge,
  transition: handleTransition,
  win: handleWin,
  gameover: handleGameOver,
  "eevee-choice": handleEeveeChoice,
  "move-tutor": handleMoveTutor,
  "item-equip": handleItemEquip,
};

interface LoopState {
  stuckCount: number;
}

async function safeObserve(page: Page, tickId: number): Promise<Tick> {
  try {
    return await observe(page, tickId);
  } catch {
    await sleep(1000);
    return {
      tickId,
      observedAt: Date.now(),
      phase: { kind: "unknown" },
      game: null,
      ui: {},
    };
  }
}

function processEvents(events: RunEvent[], tick: Tick, currentTurn: number): void {
  for (const e of events) {
    handleRunLogEvent(e, tick, currentTurn);
    if (e.type === "phase-changed") {
      const peek = screenPeekLine(e.to.kind, tick.ui.peek?.raw ?? "");
      if (peek) logScreenPeek(peek);
    }
  }
}

async function handleStuck(_tick: Tick, ctx: HandlerCtx, state: LoopState): Promise<void> {
  state.stuckCount += 1;
  if (state.stuckCount % 3 === 0) {
    logAction("stuck", `Trying any visible button… (×${state.stuckCount})`);
    await clickFirst(ctx.page, ".screen.active button, .screen.active [role='button']");
    await humanDelay(500, 1000);
  } else {
    await sleep(600);
  }
}

async function runBot(): Promise<void> {
  logStartupBanner();

  const browser: Browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--window-size=1280,900", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  );

  logNavigating(GAME_URL);
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#btn-new-run", { visible: true, timeout: 30000 });

  await enableAutoSkip(page);
  await warnIfUnexpectedGameVersion(page);

  const machine = new RunMachine();
  const loop: LoopState = { stuckCount: 0 };
  let tickId = 0;

  logRunStarted(machine.runNumber);

  while (true) {
    tickId += 1;
    const tick = await safeObserve(page, tickId);
    const events = machine.step(tick);
    setCurrentTurn(machine.turnNumber);

    for (const e of events) {
      if (e.type === "run-ended") {
        logGameOverRunBanner(e.runNumber + 1);
      } else if (e.type === "phase-changed") {
        logTurnHeader(machine.runNumber, machine.turnNumber, e.to.kind);
      }
    }
    processEvents(events, tick, machine.turnNumber);

    const ctx: HandlerCtx = {
      page,
      reobserve: () => observe(page, tickId),
    };

    const handler = HANDLERS[tick.phase.kind];
    try {
      if (handler) {
        await handler(tick, ctx);
        loop.stuckCount = 0;
      } else {
        await handleStuck(tick, ctx, loop);
      }
    } catch (err) {
      logAction("error", String(err).slice(0, 120));
      await sleep(500);
    }

    await sleep(150);
  }
}

runBot().catch((err) => {
  logError(`Fatal crash: ${String(err)}`);
  process.exit(1);
});
