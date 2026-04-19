import type { Page } from "puppeteer";

import { readGameState } from "../game-state.js";
import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";
import { pickTutorSlot, type TutorTeamSlot } from "../tutor-intel.js";

export async function handleMoveTutor(page: Page): Promise<void> {
  const gs = await readGameState(page);
  const team: TutorTeamSlot[] = gs.team.map((p) => ({
    speciesId: p.speciesId,
    level: Math.max(1, p.level),
    moveTier: p.moveTier,
  }));

  const chosenIdx = pickTutorSlot(team);

  const result = await page.evaluate((idx: number | null): string => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return "no-modal";

    if (idx === null) {
      modal.querySelector<HTMLButtonElement>("#btn-skip-tutor")?.click();
      return "skipped (all mastered)";
    }

    const btn = modal.querySelector<HTMLButtonElement>(`button[data-tutor="${idx}"]`);
    if (!btn) {
      modal.querySelector<HTMLButtonElement>("#btn-skip-tutor")?.click();
      return `skipped (no button for slot ${idx})`;
    }

    const move = btn.textContent?.replace("→", "").trim() ?? "move";
    btn.click();
    return `upgraded slot ${idx} to: ${move}`;
  }, chosenIdx);

  logAction("tutor", result);
  await sleep(600);
}
