import type { Page } from "puppeteer";

import { EXPECTED_POKELIKE_GAME_VERSION } from "./constants.js";
import { logWarn } from "./logger.js";
import { observe } from "./state/snapshot.js";

/** Extract semver from title screen copy such as "POKELIKE Pokemon Roguelike v1.3.1". */
export function parseGameVersionFromTitleText(text: string): string | null {
  const tagged = text.match(/Pokemon Roguelike\s+v([\d.]+)/i);
  if (tagged?.[1]) return tagged[1];
  const loose = text.match(/\bv([\d]+\.[\d]+(?:\.[\d]+)?)\b/);
  return loose?.[1] ?? null;
}

/** Compare detected title-screen version to {@link EXPECTED_POKELIKE_GAME_VERSION}; warn on mismatch or parse failure. */
export async function warnIfUnexpectedGameVersion(page: Page): Promise<void> {
  try {
    const tick = await observe(page, 0, { withUi: false, withPeek: true });
    if (tick.phase.kind !== "title") {
      logWarn(
        `[pokelike-bot] Could not verify game version (expected title screen, got "${tick.phase.kind}"). ` +
          `This bot is maintained for Pokelike v${EXPECTED_POKELIKE_GAME_VERSION}.`,
      );
      return;
    }
    const text = tick.ui.peek?.raw ?? "";
    const detected = parseGameVersionFromTitleText(text);
    if (!detected) {
      logWarn(
        `[pokelike-bot] Could not read game version from the title screen. ` +
          `This bot targets v${EXPECTED_POKELIKE_GAME_VERSION}; if the game updated, check for breaking changes ` +
          `(changelog, UI selectors) and update EXPECTED_POKELIKE_GAME_VERSION in src/constants.ts after testing.`,
      );
      return;
    }
    if (detected !== EXPECTED_POKELIKE_GAME_VERSION) {
      logWarn(
        `[pokelike-bot] Game version mismatch: title screen shows v${detected}, bot is built for v${EXPECTED_POKELIKE_GAME_VERSION}. ` +
          `Automation may break — review for breaking changes before relying on this run.`,
      );
    }
  } catch (err) {
    logWarn(
      `[pokelike-bot] Could not verify game version (${String(err)}). ` +
        `Maintained for Pokelike v${EXPECTED_POKELIKE_GAME_VERSION}.`,
    );
  }
}
