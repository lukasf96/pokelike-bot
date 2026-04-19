import type { Page } from "puppeteer";

import type { ReleaseTeamMember } from "../release-candidate-intel.js";
import { pickSwapReleaseSlot } from "../release-candidate-intel.js";
import { sleep } from "../page-utils.js";

interface SwapSnapshot {
  team: ReleaseTeamMember[];
  moonStoneInBag: boolean;
}

export async function handleSwap(page: Page): Promise<void> {
  const snap: SwapSnapshot = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const rawTeam = (st?.team ?? []) as Array<{
      speciesId?: number;
      level?: number;
      isShiny?: boolean;
      heldItem?: { id?: string } | null;
      moveTier?: number;
    }>;
    const rawItems = (st?.items ?? []) as Array<{ id?: string }>;
    const moonStoneInBag = rawItems.some((it) => String(it.id ?? "") === "moon_stone");
    const team: ReleaseTeamMember[] = rawTeam.map((p) => ({
      speciesId: Number(p.speciesId ?? 0),
      level: Number(p.level ?? 1),
      isShiny: Boolean(p.isShiny),
      heldItemId: p.heldItem?.id != null ? String(p.heldItem.id) : null,
      moveTier: Math.max(0, Math.min(2, Number(p.moveTier ?? 0))),
    }));
    return { team, moonStoneInBag };
  });

  const slot = pickSwapReleaseSlot(snap.team, snap.moonStoneInBag);
  const m = snap.team[slot];

  const result = await page.evaluate((releaseIdx: number): string => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"),
    );
    if (cards.length === 0 || releaseIdx < 0 || releaseIdx >= cards.length) {
      (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
      return "cancelled";
    }
    const target = cards[releaseIdx];
    const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
    target?.click();
    return `released slot${releaseIdx} ${name}`;
  }, slot);

  console.log(
    `  [swap] ${result} (lv${m?.level ?? "?"} speciesId=${m?.speciesId ?? "?"})`,
  );
  await sleep(800);
}
