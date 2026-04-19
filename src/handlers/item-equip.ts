import type { Handler } from "../state/handler.js";
import { logAction } from "../logger.js";
import {
  bestEmptySlotForHeldItem,
  bestPokemonIndexForHeldItem,
  itemNameToId,
} from "../item-intel.js";
import { selectItemTeam } from "../state/selectors.js";
import { sleep } from "../page-utils.js";

export const handleItemEquip: Handler = async (tick, { page }) => {
  const modalSnap = tick.ui.itemEquip;
  if (!modalSnap || !tick.game) {
    logAction("item-equip", "no-modal");
    await sleep(600);
    return;
  }

  const team = selectItemTeam(tick.game);
  const itemId = itemNameToId(modalSnap.itemName);
  const emptyFirst = bestEmptySlotForHeldItem(itemId, team);
  const bestAny = bestPokemonIndexForHeldItem(itemId, team);
  const preferredIdx =
    emptyFirst !== null && modalSnap.idxButtons.includes(emptyFirst) ? emptyFirst : bestAny;
  const equipIdx = modalSnap.idxButtons.includes(preferredIdx)
    ? preferredIdx
    : (modalSnap.idxButtons[0] ?? -1);

  const result = await page.evaluate((payload: { equipIdx: number }): string => {
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
  }, { equipIdx });

  logAction("item-equip", `${result} (${modalSnap.itemName} → ${itemId})`);
  await sleep(600);
};
