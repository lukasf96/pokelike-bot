import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

export async function handleMoveTutor(page: Page): Promise<void> {
  const result = await page.evaluate((): string => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return "no-modal";

    const tutorBtns = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-tutor]"));
    if (tutorBtns.length > 0) {
      const move = tutorBtns[0]?.textContent?.replace("→", "").trim() ?? "move";
      tutorBtns[0]?.click();
      return `upgraded to: ${move}`;
    }

    modal.querySelector<HTMLButtonElement>("#btn-skip-tutor")?.click();
    return "skipped (all mastered)";
  });

  console.log(`  [tutor] ${result}`);
  await sleep(600);
}
