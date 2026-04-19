import type { Page } from "puppeteer";

import {
  bestEmptySlotForHeldItem,
  bestPokemonIndexForHeldItem,
  itemNameToId,
  type TeamMemberForItem,
} from "../item-intel.js";
import { readGameState } from "../game-state.js";
import { sleep } from "../page-utils.js";

export async function handleItemEquip(page: Page): Promise<void> {
  const [gs, modalSnap] = await Promise.all([
    readGameState(page),
    page.evaluate((): { itemName: string; idxButtons: number[] } | null => {
      const modal = document.getElementById("item-equip-modal");
      if (!modal) return null;
      const itemName = modal.querySelector<HTMLElement>(".equip-item-name")?.textContent?.trim() ?? "";
      const idxButtons = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-idx]"))
        .filter((b) => !b.classList.contains("equip-btn-unequip"))
        .map((b) => parseInt(b.dataset.idx ?? "-1", 10));
      return { itemName, idxButtons };
    }),
  ]);

  if (!modalSnap) {
    console.log("  [item-equip] no-modal");
    await sleep(600);
    return;
  }

  const team: TeamMemberForItem[] = gs.team.map((p) => ({
    types: p.types,
    baseStats: p.baseStats,
    level: p.level,
    speciesId: p.speciesId,
    currentHp: p.currentHp,
    maxHp: p.maxHp,
    heldItem: p.heldItem ?? undefined,
  }));

  const ctx = { itemName: modalSnap.itemName, team, idxButtons: modalSnap.idxButtons };

  const itemId = itemNameToId(ctx.itemName);
  const emptyFirst = bestEmptySlotForHeldItem(itemId, ctx.team);
  const bestAny = bestPokemonIndexForHeldItem(itemId, ctx.team);
  const preferredIdx =
    emptyFirst !== null && ctx.idxButtons.includes(emptyFirst) ? emptyFirst : bestAny;
  const equipIdx =
    ctx.idxButtons.includes(preferredIdx) ? preferredIdx : (ctx.idxButtons[0] ?? -1);

  const result = await page.evaluate(
    (payload: { equipIdx: number }): string => {
      const modal = document.getElementById("item-equip-modal");
      if (!modal) return "no-modal";

      if (payload.equipIdx >= 0) {
        const btn = modal.querySelector<HTMLButtonElement>(`button[data-idx="${payload.equipIdx}"]`);
        if (btn && !btn.classList.contains("equip-btn-unequip")) {
          btn.click();
          return `equipped → slot ${payload.equipIdx}`;
        }
      }

      modal.querySelector<HTMLButtonElement>("#btn-equip-to-bag")?.click();
      return "kept in bag";
    },
    { equipIdx },
  );

  console.log(`  [item-equip] ${result} (${ctx.itemName} → ${itemId})`);
  await sleep(600);
}
