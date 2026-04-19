import type { Page } from "puppeteer";

import { itemNameToId, scoreItemPick, type TeamMemberForItem } from "../item-intel.js";
import { readGameState } from "../game-state.js";
import { sleep } from "../page-utils.js";

export async function handleItem(page: Page): Promise<void> {
  const [gs, names] = await Promise.all([
    readGameState(page),
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"))
        .map((c) => c.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? ""),
    ),
  ]);
  const team: TeamMemberForItem[] = gs.team.map((p) => ({
    types: p.types,
    baseStats: p.baseStats,
    level: p.level,
    speciesId: p.speciesId,
    currentHp: p.currentHp,
    maxHp: p.maxHp,
    heldItem: p.heldItem ?? undefined,
  }));
  const snapshot = { names, team };

  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < snapshot.names.length; i += 1) {
    const name = snapshot.names[i]!;
    const id = itemNameToId(name);
    const s = scoreItemPick(id, snapshot.team);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  if (snapshot.names.length === 0) {
    console.log("  [item] No item cards — skip");
    await sleep(800);
    return;
  }

  const pickedName = await page.evaluate((idx: number): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"));
    const c = cards[idx];
    const name = c?.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "item";
    c?.click();
    return name;
  }, bestIdx);

  console.log(`  [item] Picked: ${pickedName} (score ${bestScore.toFixed(1)})`);
  await sleep(800);
}
