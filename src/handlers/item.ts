import type { Page } from "puppeteer";

import { itemNameToId, scoreItemPick, type TeamMemberForItem } from "../item-intel.js";
import { sleep } from "../page-utils.js";

export async function handleItem(page: Page): Promise<void> {
  const snapshot = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"));
    const names = cards.map((c) => c.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "");
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
    return { names, team };
  });

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
