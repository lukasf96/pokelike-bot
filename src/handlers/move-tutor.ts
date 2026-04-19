import type { Page } from "puppeteer";

import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";
import { pickTutorSlot, type TutorTeamSlot } from "../tutor-intel.js";

interface GameStateShape {
  team?: TutorTeamSlot[];
}

export async function handleMoveTutor(page: Page): Promise<void> {
  const team = await page.evaluate((): TutorTeamSlot[] => {
    const st = (window as unknown as { state?: GameStateShape }).state;
    const raw = st?.team;
    if (!raw || !Array.isArray(raw)) return [];

    return raw.map((p) => ({
      speciesId: Number(p.speciesId),
      level: Math.max(1, Number(p.level)),
      moveTier: p.moveTier !== undefined ? Number(p.moveTier) : undefined,
    }));
  });

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
