import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

export async function handleItemEquip(page: Page): Promise<void> {
  const result = await page.evaluate((): string => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return "no-modal";

    const equipBtns = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-idx]")).filter(
      (b) => !b.classList.contains("equip-btn-swap") && !b.classList.contains("equip-btn-unequip"),
    );

    if (equipBtns.length > 0) {
      equipBtns[0]?.click();
      return "equipped to pokemon";
    }

    modal.querySelector<HTMLButtonElement>("#btn-equip-to-bag")?.click();
    return "kept in bag";
  });

  console.log(`  [item-equip] ${result}`);
  await sleep(600);
}
