import type { Page } from "puppeteer";

import type { ReleaseTeamMember } from "../release-candidate-intel.js";
import { pickSwapReleaseSlot } from "../release-candidate-intel.js";
import { readGameState } from "../game-state.js";
import { sleep } from "../page-utils.js";

export async function handleSwap(page: Page): Promise<void> {
  const gs = await readGameState(page);
  const moonStoneInBag = gs.items.some((it) => it.id === "moon_stone");
  const snap = {
    team: gs.team.map((p): ReleaseTeamMember => ({
      speciesId: p.speciesId,
      level: p.level,
      isShiny: p.isShiny,
      heldItemId: p.heldItem?.id ?? null,
      moveTier: p.moveTier,
    })),
    moonStoneInBag,
  };

  const slot = pickSwapReleaseSlot(snap.team, snap.moonStoneInBag);
  const m = snap.team[slot];

  const result = await page.evaluate((releaseIdx: number): string => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"),
    );
    if (cards.length === 0 || releaseIdx < 0 || releaseIdx >= cards.length) {
      (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
      return "cancelled";
    }
    const target = cards[releaseIdx];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return `released slot${releaseIdx} ${name}`;
  }, slot);

  console.log(
    `  [swap] ${result} (lv${m?.level ?? "?"} speciesId=${m?.speciesId ?? "?"})`,
  );
  await sleep(800);
}
