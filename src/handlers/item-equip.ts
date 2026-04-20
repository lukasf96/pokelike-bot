import { enemyTypingsForIntel, type NodeIntel } from "../intel/battle-intel.js";
import type { Handler } from "../state/handler.js";
import { logAction } from "../logging/logger.js";
import {
  bestEmptySlotForHeldItem,
  bestPokemonIndexForHeldItem,
  type HeldItemFitnessCtx,
  itemNameToId,
} from "../intel/item-intel.js";
import { selectItemTeam } from "../state/selectors.js";
import { sleep } from "../utility/page-utils.js";

export const handleItemEquip: Handler = async (tick, { page }) => {
  const modalSnap = tick.ui.itemEquip;
  if (!modalSnap || !tick.game) {
    logAction("item-equip", "no-modal");
    await sleep(600);
    return;
  }

  const team = selectItemTeam(tick.game);
  const itemId = itemNameToId(modalSnap.itemName);

  const game = tick.game;
  const intel: NodeIntel =
    game.currentMap >= 8
      ? { category: "elite", eliteIndex: game.eliteIndex }
      : { category: "gym", mapIndex: game.currentMap };
  const bossTypings = enemyTypingsForIntel(intel, {
    currentMap: game.currentMap,
    eliteIndex: game.eliteIndex,
  });
  const bossCtx: HeldItemFitnessCtx | undefined =
    bossTypings.length > 0 ? { nextBossTypings: bossTypings } : undefined;

  const emptyFirst = bestEmptySlotForHeldItem(itemId, team, bossCtx);
  const bestAny = bestPokemonIndexForHeldItem(itemId, team, bossCtx);
  const preferredIdx =
    emptyFirst !== null && modalSnap.idxButtons.includes(emptyFirst) ? emptyFirst : bestAny;
  const equipIdx = modalSnap.idxButtons.includes(preferredIdx)
    ? preferredIdx
    : (modalSnap.idxButtons[0] ?? -1);

  const result = await page.evaluate(
    (payload: { equipIdx: number }): string => {
      const modal = document.getElementById("item-equip-modal");
      if (!modal) return "no-modal";

      if (payload.equipIdx >= 0) {
        const btn = modal.querySelector<HTMLButtonElement>(
          `button[data-idx="${payload.equipIdx}"]`,
        );
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

  logAction("item-equip", `${result} (${modalSnap.itemName} → ${itemId})`);
  await sleep(600);
};
