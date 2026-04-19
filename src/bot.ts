import puppeteer, { type Browser, type Page } from "puppeteer";

const GAME_URL = "https://pokelike.xyz/";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const humanDelay = (min = 300, max = 700) => sleep(min + Math.random() * (max - min));

// ─── Screen detection ───────────────────────────────────────────────────────

async function activeScreen(page: Page): Promise<string> {
  return page.evaluate((): string => {
    const ids = [
      "title-screen", "trainer-screen", "starter-screen", "map-screen",
      "battle-screen", "catch-screen", "item-screen", "swap-screen",
      "trade-screen", "shiny-screen", "badge-screen", "transition-screen",
      "gameover-screen", "win-screen",
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el?.classList.contains("active")) return id;
    }
    return "unknown";
  });
}

// Move Tutor overlay sits on top of map-screen (#item-equip-modal with #btn-skip-tutor)
async function isMoveTutorOpen(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const m = document.getElementById("item-equip-modal");
    return m !== null && m.querySelector("#btn-skip-tutor") !== null;
  });
}

// Item equip modal (after picking item from item-screen)
async function isItemEquipOpen(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const m = document.getElementById("item-equip-modal");
    return m !== null && m.querySelector("#btn-equip-to-bag") !== null;
  });
}

async function screenText(page: Page): Promise<string> {
  return page.evaluate((): string => {
    const active = document.querySelector<HTMLElement>(".screen.active");
    return (active?.innerText ?? document.body.innerText).replace(/\s+/g, " ").trim().slice(0, 200);
  });
}

async function clickSel(page: Page, sel: string): Promise<boolean> {
  try { await page.click(sel); return true; } catch { return false; }
}

async function clickFirst(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s: string): boolean => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return true; }
    }
    return false;
  }, sel);
}

// ─── Enable "Auto Skip All Battles" in settings once at startup ─────────────

async function enableAutoSkip(page: Page) {
  await page.evaluate((): void => {
    try {
      const raw = localStorage.getItem("poke_settings");
      const s = Object.assign({ autoSkipBattles: false, autoSkipAllBattles: false, autoSkipEvolve: true, darkMode: false }, raw ? JSON.parse(raw) : {});
      s.autoSkipAllBattles = true;
      s.autoSkipBattles = true;
      s.autoSkipEvolve = true;
      localStorage.setItem("poke_settings", JSON.stringify(s));
    } catch { /* ignore */ }
  });
  console.log("  [init] Auto-skip battles enabled in settings");
}

// ─── Dismiss tutorial overlay if present ────────────────────────────────────

async function dismissTutorial(page: Page) {
  await page.evaluate((): void => {
    const overlay = document.getElementById("tutorial-overlay");
    overlay?.click();
    // Also set the localStorage flag so it never shows again
    localStorage.setItem("poke_tutorial_seen", "1");
  });
}

// ─── Screen handlers ─────────────────────────────────────────────────────────

async function handleTitle(page: Page) {
  console.log("  [title] Starting new run");
  await clickSel(page, "#btn-new-run");
  await sleep(800);
}

async function handleTrainer(page: Page) {
  console.log("  [trainer] Selecting BOY");
  await clickSel(page, "#trainer-boy");
  await sleep(800);
}

async function handleStarter(page: Page) {
  await page.waitForFunction((): boolean => {
    const cards = document.querySelectorAll<HTMLElement>("#starter-choices .poke-card");
    return cards.length > 0 && (cards[0]?.getBoundingClientRect().width ?? 0) > 0;
  }, { timeout: 5000 }).catch(() => {});

  // Starter IDs: 1=Bulbasaur, 4=Charmander, 7=Squirtle
  // Charmander is physical attacker, good for early game — prefer fire type
  const picked = await page.evaluate((): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#starter-choices .poke-card"));
    const preferred = cards.find((c) => {
      const t = c.textContent?.toLowerCase() ?? "";
      return t.includes("charmander") || t.includes("chimchar") || t.includes("torchic");
    });
    const target = preferred ?? cards[0];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "";
    target?.click();
    return name;
  });

  if (!picked) {
    const bounds = await page.evaluate((): { x: number; y: number } | null => {
      const r = document.querySelector<HTMLElement>("#starter-choices .poke-card")?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    });
    if (bounds) await page.mouse.click(bounds.x, bounds.y);
    console.log("  [starter] Picked (mouse fallback)");
  } else {
    console.log(`  [starter] Picked: ${picked}`);
  }
  await sleep(800);
}

// ─── Map path planning ───────────────────────────────────────────────────────



async function handleMap(page: Page) {
  await dismissTutorial(page);

  const result = await page.evaluate((): { picked: boolean; log: string } => {
    // Node type is encoded in the sprite image href inside each <g>
    function spriteToType(href: string): string {
      if (href.includes("catchPokemon"))       return "catch";
      if (href.includes("grass"))              return "battle";
      if (href.includes("itemIcon"))           return "item";
      if (href.includes("Poke Center") || href.includes("PokeCenter")) return "pokecenter";
      if (href.includes("moveTutor"))          return "move_tutor";
      if (href.includes("legendaryEncounter")) return "legendary";
      if (href.includes("questionMark"))       return "question";
      if (href.includes("tradeIcon"))          return "trade";
      return "unknown";
    }

    function nodeScore(type: string, lowHp: boolean): number {
      switch (type) {
        case "legendary":  return 8;
        case "pokecenter": return lowHp ? 10 : -2;
        case "catch":      return 4;
        case "item":       return 3;
        case "move_tutor": return 3;
        case "question":   return 2;
        case "trade":      return 1;
        case "unknown":    return 1;
        case "trainer":    return -1;
        case "battle":     return -2;
        default:           return 0;
      }
    }

    // Try to read team HP — window.state exists but 'let state' is NOT on window in classic scripts.
    // Access it via the closure by eval-ing the variable name directly.
    let hpRatio = 1;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team: Array<{ currentHp: number; maxHp: number }> = st?.team ?? [];
      const tot = team.reduce((s: number, p: { currentHp: number }) => s + p.currentHp, 0);
      const mx  = team.reduce((s: number, p: { maxHp: number }) => s + p.maxHp, 0);
      if (mx > 0) hpRatio = tot / mx;
    } catch { /* state not accessible */ }
    const lowHp = hpRatio < 0.6;

    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g"))
      .filter(g => (g.getAttribute("style") ?? "").includes("cursor: pointer"));

    if (clickable.length === 0) return { picked: false, log: "no clickable nodes" };

    type Candidate = { g: SVGGElement; type: string; score: number };
    const candidates: Candidate[] = clickable.map(g => {
      const img = g.querySelector<SVGImageElement>("image");
      const href = img?.getAttribute("href") ?? img?.getAttribute("xlink:href") ?? "";
      const type = spriteToType(href);
      return { g, type, score: nodeScore(type, lowHp) };
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    best.g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const summary = candidates.map(c => `${c.type}(${c.score})`).join(", ");
    const log = `hp=${Math.round(hpRatio * 100)}% lowHp=${lowHp} | ${summary} → picked ${best.type}`;
    return { picked: true, log };
  });

  console.log(`  [map] ${result.log}`);
  if (!result.picked) { await sleep(1500); return; }
  await sleep(1200);
}

async function handleBattle(page: Page) {
  // With autoSkipAllBattles=true, the Skip button is hidden and battle resolves automatically.
  // We only need to click Continue after the animation.
  const skipVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-auto-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none" && !btn.disabled;
  });

  if (skipVisible) {
    console.log("  [battle] Clicking Skip");
    await clickSel(page, "#btn-auto-battle");
    await page.waitForFunction((): boolean => {
      const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
      return btn !== null && btn.style.display !== "none";
    }, { timeout: 20000 }).catch(() => {});
    await sleep(300);
  }

  // Wait for Continue to be enabled (not just visible)
  const continueVisible = await page.evaluate((): boolean => {
    const btn = document.getElementById("btn-continue-battle") as HTMLButtonElement | null;
    return btn !== null && btn.style.display !== "none";
  });

  if (continueVisible) {
    console.log("  [battle] Clicking Continue");
    await clickSel(page, "#btn-continue-battle");
    await sleep(800);
  }
}

// Pokemon strength scoring: BST-based (higher is better)
// We know the BST pools from data.js — prioritize high-BST Pokemon
const STRONG_POKEMON = new Set([
  // veryHigh BST: 6,9,65,68,94,112,130,131,143,147,148,149
  "charizard","blastoise","alakazam","machamp","gengar","rhydon","gyarados","lapras","snorlax","dragonair","dragonite",
  // high BST pool
  "venusaur","victreebel","arcanine","slowbro","starmie","scyther","electabuzz","magmar","pinsir","tauros","aerodactyl","kabutops","omastar",
  // midHigh pool
  "nidoking","nidoqueen","cloyster","dewgong","muk","weezing","hypno","kangaskhan","seadra","seaking",
  // good mid tier
  "haunter","dugtrio","dodrio","magneton","exeggutor","hitmonlee","hitmonchan","electrode","chansey",
]);

async function handleCatch(page: Page) {
  const picked = await page.evaluate((strong: string[]): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#catch-choices .poke-card"));
    if (cards.length === 0) return "none";

    // Score each card: strong pokemon get high score, shiny gets bonus
    const scored = cards.map((c) => {
      const name = (c.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "").toLowerCase();
      const isShiny = c.querySelector(".shiny-badge, [class*='shiny']") !== null ||
        (c.textContent?.includes("★") ?? false) || (c.textContent?.includes("Shiny") ?? false);
      const score = strong.includes(name) ? 10 : 0;
      return { c, name, score: score + (isShiny ? 5 : 0) };
    });

    scored.sort((a, b) => b.score - a.score);
    const target = scored[0]?.c;
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return name;
  }, Array.from(STRONG_POKEMON));

  console.log(`  [catch] Caught: ${picked}`);
  await sleep(800);
}

// Item priority from data.js analysis:
// Best: lucky_egg (map 4+), life_orb, choice_band, choice_specs, leftovers, shell_bell, scope_lens
// Good: wide_lens, expert_belt, muscle_band, wise_glasses, assault_vest, focus_sash
// Usable: max_revive > moon_stone > rare_candy (all go to bag automatically via game code)
const ITEM_PRIORITY: Record<string, number> = {
  lucky_egg: 100, life_orb: 90, choice_band: 85, choice_specs: 85,
  leftovers: 80, shell_bell: 75, scope_lens: 70, wide_lens: 65,
  expert_belt: 60, assault_vest: 55, muscle_band: 55, wise_glasses: 55,
  focus_sash: 50, focus_band: 45, metronome: 45,
  // Usable items (go straight to bag)
  max_revive: 95, rare_candy: 70, moon_stone: 65,
  // Type boosts — decent
  charcoal: 40, mystic_water: 40, thunderbolt: 40, miracle_seed: 40,
  twisted_spoon: 40, black_belt: 40, dragon_fang: 40,
  sharp_beak: 35, choice_scarf: 35, eviolite: 35,
};

async function handleItem(page: Page) {
  const picked = await page.evaluate((priority: Record<string, number>): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"));
    if (cards.length === 0) return "none";

    // Extract item id from the card content (name text → match to priority map)
    const scored = cards.map((c) => {
      const name = c.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "";
      // Convert name to likely id: lowercase, spaces to underscores
      const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const score = priority[id] ?? 20; // unknown items get baseline score
      return { c, name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const target = scored[0]?.c;
    const name = target?.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "item";
    target?.click();
    return `${name} (score: ${scored[0]?.score ?? 0})`;
  }, ITEM_PRIORITY);

  console.log(`  [item] Picked: ${picked}`);
  await sleep(800);
}

// Item equip: equip to first Pokemon (or bag if all have items)
async function handleItemEquip(page: Page) {
  // Try equipping to the first Pokemon that has no held item
  const result = await page.evaluate((): string => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return "no-modal";

    // Find first Equip button (not Swap, not Unequip)
    const equipBtns = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-idx]"))
      .filter(b => !b.classList.contains("equip-btn-swap") && !b.classList.contains("equip-btn-unequip"));

    if (equipBtns.length > 0) {
      equipBtns[0]?.click();
      return "equipped to pokemon";
    }

    // All Pokemon have items — keep in bag
    (modal.querySelector<HTMLButtonElement>("#btn-equip-to-bag"))?.click();
    return "kept in bag";
  });

  console.log(`  [item-equip] ${result}`);
  await sleep(600);
}

// Move Tutor: always upgrade the first non-maxed Pokemon's move (Tier 2 moves are much stronger)
async function handleMoveTutor(page: Page) {
  const result = await page.evaluate((): string => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return "no-modal";

    const tutorBtns = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-tutor]"));
    if (tutorBtns.length > 0) {
      const move = tutorBtns[0]?.textContent?.replace("→", "").trim() ?? "move";
      tutorBtns[0]?.click();
      return `upgraded to: ${move}`;
    }

    // All Pokemon already maxed
    (modal.querySelector<HTMLButtonElement>("#btn-skip-tutor"))?.click();
    return "skipped (all mastered)";
  });

  console.log(`  [tutor] ${result}`);
  await sleep(600);
}

// Swap: release the weakest Pokemon (lowest total base stats) to make room for the new one
async function handleSwap(page: Page) {
  const result = await page.evaluate((): string => {
    // The swap screen shows current team cards — pick the one to release
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"));
    if (cards.length === 0) {
      // Cancel if no cards
      (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
      return "cancelled";
    }

    // Release the last card (weakest/most recently added = usually lowest level)
    // Better: release the one with lowest level shown
    let lowestIdx = 0;
    let lowestLevel = Infinity;
    cards.forEach((c, i) => {
      const lvText = c.querySelector<HTMLElement>(".poke-level")?.textContent ?? "";
      const lv = parseInt(lvText.replace(/[^0-9]/g, "")) || 99;
      if (lv < lowestLevel) { lowestLevel = lv; lowestIdx = i; }
    });

    const target = cards[lowestIdx];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return `released lv${lowestLevel} ${name}`;
  });

  console.log(`  [swap] ${result}`);
  await sleep(800);
}

// Trade: accept if the Pokemon we'd give away is weaker than what we'd receive (+3 levels)
async function handleTrade(page: Page) {
  // The trade offers +3 levels on a random Pokemon. Since we can't preview the offer,
  // accept for low-BST or low-level Pokemon (first in team usually), decline otherwise.
  // For now: always decline to be safe (trade offer is unknown quality)
  console.log("  [trade] Declining trade");
  await clickSel(page, "#btn-skip-trade");
  await sleep(800);
}

// Shiny: always take it (shiny Pokemon = same quality, cosmetic + dex entry)
async function handleShiny(page: Page) {
  // Try taking the shiny
  const took = await clickSel(page, "#btn-take-shiny");
  if (took) {
    console.log("  [shiny] Took shiny!");
  } else {
    await clickSel(page, "#btn-skip-shiny");
    console.log("  [shiny] Skipped shiny");
  }
  await sleep(800);
}

// Also handle the trade-complete shiny reveal screen (#btn-trade-continue)
async function handleShinyExtended(page: Page) {
  const tradeContinue = await clickSel(page, "#btn-trade-continue");
  if (!tradeContinue) {
    await handleShiny(page);
  } else {
    console.log("  [shiny] Trade reveal — continuing");
  }
  await sleep(800);
}

async function handleBadge(page: Page) {
  console.log("  [badge] Advancing to next map");
  await clickSel(page, "#btn-next-map");
  await sleep(800);
}

async function handleTransition(_page: Page) {
  // Elite Four transition — auto-advances after 2 seconds (no button)
  await sleep(2500);
}

async function handleWin(page: Page) {
  console.log("  [win] WON THE GAME! Starting new run...");
  await clickSel(page, "#btn-play-again");
  await sleep(1000);
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function runBot() {
  console.log("Launching Pokelike bot...\n");

  const browser: Browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--window-size=1280,900", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  console.log(`Navigating to ${GAME_URL}...`);
  await page.goto(GAME_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);

  // Enable auto-skip so battles resolve without needing a Skip button click
  await enableAutoSkip(page);

  let turn = 0;
  let stuckCount = 0;
  let run = 1;
  let lastScreen = "";
  let prevScreen = "";

  console.log(`Bot started — Run #${run}. Press Ctrl+C to stop.\n`);

  while (true) {
    turn++;

    let screen: string;
    try {
      screen = await activeScreen(page);
    } catch {
      await sleep(1000);
      continue;
    }

    // Detect game over: title-screen appears after being in a real run
    const wasInRun = !["title-screen", "trainer-screen", "starter-screen", "unknown"].includes(prevScreen);
    if (screen === "title-screen" && wasInRun && prevScreen !== "title-screen") {
      run++;
      turn = 1;
      console.log(`\n${"=".repeat(50)}`);
      console.log(`GAME OVER — Starting Run #${run}`);
      console.log(`${"=".repeat(50)}\n`);
    }

    // Check for overlay modals on map-screen
    let tutorOpen = false;
    let itemEquipOpen = false;
    try {
      if (screen === "map-screen" || screen === "item-screen") {
        tutorOpen = await isMoveTutorOpen(page);
        if (!tutorOpen) itemEquipOpen = await isItemEquipOpen(page);
      }
    } catch { /* ignore */ }

    const effectiveScreen = tutorOpen ? "move-tutor" : itemEquipOpen ? "item-equip" : screen;

    if (effectiveScreen !== lastScreen) {
      let text = "";
      try { text = await screenText(page); } catch { /* ignore */ }
      console.log(`\n[run ${run} | turn ${turn}] ${effectiveScreen}`);
      if (text) console.log(`  ${text}`);
      lastScreen = effectiveScreen;
    }

    prevScreen = screen;

    try {
      if (tutorOpen) {
        await handleMoveTutor(page); stuckCount = 0;
      } else if (itemEquipOpen) {
        await handleItemEquip(page); stuckCount = 0;
      } else {
        switch (screen) {
          case "title-screen":
            await handleTitle(page); stuckCount = 0; break;
          case "trainer-screen":
            await handleTrainer(page); stuckCount = 0; break;
          case "starter-screen":
            await handleStarter(page); stuckCount = 0; break;
          case "map-screen":
            await handleMap(page); stuckCount = 0; break;
          case "battle-screen":
            await handleBattle(page); stuckCount = 0; break;
          case "catch-screen":
            await handleCatch(page); stuckCount = 0; break;
          case "item-screen":
            await handleItem(page); stuckCount = 0; break;
          case "swap-screen":
            await handleSwap(page); stuckCount = 0; break;
          case "trade-screen":
            await handleTrade(page); stuckCount = 0; break;
          case "shiny-screen":
            await handleShinyExtended(page); stuckCount = 0; break;
          case "badge-screen":
            await handleBadge(page); stuckCount = 0; break;
          case "transition-screen":
            await handleTransition(page); stuckCount = 0; break;
          case "win-screen":
            await handleWin(page); stuckCount = 0; break;
          case "gameover-screen":
            await clickFirst(page, "#gameover-screen button");
            await sleep(500); stuckCount = 0; break;
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
