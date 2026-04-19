import puppeteer, { type Browser } from "puppeteer";

import { GAME_URL } from "./constants.js";
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
import { handleTitle } from "./handlers/title.js";
import { handleTrade } from "./handlers/trade.js";
import { handleTrainer } from "./handlers/trainer.js";
import { handleTransition } from "./handlers/transition.js";
import { handleWin } from "./handlers/win.js";
import { clickFirst, humanDelay, sleep } from "./page-utils.js";
import { clearSnapshot, snapshotGameState, updateRunSession } from "./run-log.js";
import { activeScreen, isItemEquipOpen, isMoveTutorOpen, screenText } from "./screen-detection.js";

async function runBot(): Promise<void> {
  console.log("Launching Pokelike bot...\n");

  const browser: Browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--window-size=1280,900", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  );

  console.log(`Navigating to ${GAME_URL}...`);
  await page.goto(GAME_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);

  await enableAutoSkip(page);

  let turn = 0;
  let stuckCount = 0;
  let run = 1;
  let lastScreen = "";
  let prevScreen = "";

  console.log(`Bot started — Run #${run}. Press Ctrl+C to stop.\n`);

  while (true) {
    turn++;
    updateRunSession(run, turn);

    let screen: string;
    try {
      screen = await activeScreen(page);
    } catch {
      await sleep(1000);
      continue;
    }

    const wasInRun = !["title-screen", "trainer-screen", "starter-screen", "unknown"].includes(prevScreen);
    if (screen === "title-screen" && wasInRun && prevScreen !== "title-screen") {
      run++;
      turn = 1;
      updateRunSession(run, turn);
      clearSnapshot();
      console.log(`\n${"=".repeat(50)}`);
      console.log(`GAME OVER — Starting Run #${run}`);
      console.log(`${"=".repeat(50)}\n`);
    }

    if (!["title-screen", "trainer-screen", "starter-screen", "unknown"].includes(screen)) {
      snapshotGameState(page).catch(() => {});
    }

    let tutorOpen = false;
    let itemEquipOpen = false;
    try {
      if (screen === "map-screen" || screen === "item-screen") {
        tutorOpen = await isMoveTutorOpen(page);
        if (!tutorOpen) itemEquipOpen = await isItemEquipOpen(page);
      }
    } catch {
      /* ignore */
    }

    const effectiveScreen = tutorOpen ? "move-tutor" : itemEquipOpen ? "item-equip" : screen;

    if (effectiveScreen !== lastScreen) {
      let text = "";
      try {
        text = await screenText(page);
      } catch {
        /* ignore */
      }
      console.log(`\n[run ${run} | turn ${turn}] ${effectiveScreen}`);
      if (text) console.log(`  ${text}`);
      lastScreen = effectiveScreen;
    }

    prevScreen = screen;

    try {
      if (tutorOpen) {
        await handleMoveTutor(page);
        stuckCount = 0;
      } else if (itemEquipOpen) {
        await handleItemEquip(page);
        stuckCount = 0;
      } else {
        switch (screen) {
          case "title-screen":
            await handleTitle(page);
            stuckCount = 0;
            break;
          case "trainer-screen":
            await handleTrainer(page);
            stuckCount = 0;
            break;
          case "starter-screen":
            await handleStarter(page);
            stuckCount = 0;
            break;
          case "map-screen":
            await handleMap(page);
            stuckCount = 0;
            break;
          case "battle-screen":
            await handleBattle(page);
            stuckCount = 0;
            break;
          case "catch-screen":
            await handleCatch(page);
            stuckCount = 0;
            break;
          case "item-screen":
            await handleItem(page);
            stuckCount = 0;
            break;
          case "swap-screen":
            await handleSwap(page);
            stuckCount = 0;
            break;
          case "trade-screen":
            await handleTrade(page);
            stuckCount = 0;
            break;
          case "shiny-screen":
            await handleShinyExtended(page);
            stuckCount = 0;
            break;
          case "badge-screen":
            await handleBadge(page);
            stuckCount = 0;
            break;
          case "transition-screen":
            await handleTransition(page);
            stuckCount = 0;
            break;
          case "win-screen":
            await handleWin(page);
            stuckCount = 0;
            break;
          case "gameover-screen":
            await handleGameOver(page);
            stuckCount = 0;
            break;
          default:
            stuckCount++;
            if (stuckCount % 3 === 0) {
              console.log(`  [stuck ${stuckCount}] Trying any visible button...`);
              await clickFirst(page, ".screen.active button, .screen.active [role='button']");
              await humanDelay(500, 1000);
            } else {
              await sleep(600);
            }
        }
      }
    } catch (err) {
      console.log(`  [error] ${String(err).slice(0, 120)}`);
      await sleep(500);
    }

    await sleep(150);
  }
}

runBot().catch((err) => {
  console.error("Fatal crash:", err);
  process.exit(1);
});
