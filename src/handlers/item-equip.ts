import type { Page } from "puppeteer";

import {
  bestEmptySlotForHeldItem,
  bestPokemonIndexForHeldItem,
  itemNameToId,
  type TeamMemberForItem,
} from "../item-intel.js";
import { sleep } from "../page-utils.js";

export async function handleItemEquip(page: Page): Promise<void> {
  const ctx = await page.evaluate(() => {
    const modal = document.getElementById("item-equip-modal");
    if (!modal) return null;

    const itemName = modal.querySelector<HTMLElement>(".equip-item-name")?.textContent?.trim() ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const team: TeamMemberForItem[] = (st?.team ?? []).map((p: Record<string, unknown>) => ({
      types: Array.isArray(p.types) ? (p.types as string[]) : [],
      baseStats: p.baseStats as TeamMemberForItem["baseStats"],
      level: Number(p.level ?? 1),
      speciesId: Number(p.speciesId ?? 0),
      currentHp: typeof p.currentHp === "number" ? p.currentHp : undefined,
      maxHp: typeof p.maxHp === "number" ? p.maxHp : undefined,
      heldItem: p.heldItem as TeamMemberForItem["heldItem"],
    }));

    const idxButtons = Array.from(modal.querySelectorAll<HTMLButtonElement>("button[data-idx]")).filter(
      (b) => !b.classList.contains("equip-btn-unequip"),
    );

    return { itemName, team, idxButtons: idxButtons.map((b) => parseInt(b.dataset.idx ?? "-1", 10)) };
  });

  if (!ctx) {
    console.log("  [item-equip] no-modal");
    await sleep(600);
    return;
  }

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
