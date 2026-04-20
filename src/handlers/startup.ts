import type { Page } from "puppeteer";

import { logAction } from "../logging/logger.js";

/** Enable "Auto Skip All Battles" in settings once at startup */
export async function enableAutoSkip(page: Page): Promise<void> {
  await page.evaluate((): void => {
    try {
      const raw = localStorage.getItem("poke_settings");
      const s = Object.assign(
        { autoSkipBattles: false, autoSkipAllBattles: false, autoSkipEvolve: true, darkMode: false },
        raw ? JSON.parse(raw) : {},
      );
      s.autoSkipAllBattles = true;
      s.autoSkipBattles = true;
      s.autoSkipEvolve = true;
      localStorage.setItem("poke_settings", JSON.stringify(s));
    } catch {
      /* ignore */
    }
  });
  logAction("init", "Auto-skip battles enabled in settings");
}

export async function dismissTutorial(page: Page): Promise<void> {
  await page.evaluate((): void => {
    const overlay = document.getElementById("tutorial-overlay");
    overlay?.click();
    localStorage.setItem("poke_tutorial_seen", "1");
  });
}
