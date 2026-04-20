import type { Handler } from "../state/handler.js";
import { itemNameToId, scoreItemPick } from "../intel/item-intel.js";
import { logAction } from "../logging/logger.js";
import { selectItemTeam } from "../state/selectors.js";
import { sleep } from "../utility/page-utils.js";

export const handleItem: Handler = async (tick, { page }) => {
  const names = tick.ui.item?.names ?? [];
  if (names.length === 0) {
    logAction("item", "No item cards — skip");
    await sleep(800);
    return;
  }

  const team = tick.game ? selectItemTeam(tick.game) : [];

  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < names.length; i += 1) {
    const id = itemNameToId(names[i]!);
    const s = scoreItemPick(id, team);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const pickedName = await page.evaluate((idx: number): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"));
    const c = cards[idx];
    const name = c?.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "item";
    c?.click();
    return name;
  }, bestIdx);

  logAction("item", `Picked: ${pickedName} (score ${bestScore.toFixed(1)})`);
  await sleep(800);
};
