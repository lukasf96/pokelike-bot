import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import { sleep } from "../page-utils.js";
import { pickTutorSlot } from "../tutor-intel.js";
import { selectTutorTeam } from "../state/selectors.js";

export const handleMoveTutor: Handler = async (tick, { page }) => {
  const team = tick.game ? selectTutorTeam(tick.game) : [];
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
};
