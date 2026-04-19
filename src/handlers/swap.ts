import type { Page } from "puppeteer";

import { GEN1_SPECIES_BST } from "../data/gen1-species.js";
import { sleep } from "../page-utils.js";

interface SwapTeamMember {
  speciesId: number;
  level: number;
  isShiny: boolean;
}

interface SwapSnapshot {
  team: SwapTeamMember[];
  bag: Array<{ id: string }>;
}

export async function handleSwap(page: Page): Promise<void> {
  const snap: SwapSnapshot = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    const rawTeam = (st?.team ?? []) as Array<{ speciesId?: number; level?: number; isShiny?: boolean }>;
    const rawBag = (st?.bag ?? []) as Array<{ id?: string }>;
    return {
      team: rawTeam.map((p) => ({
        speciesId: Number(p.speciesId ?? 0),
        level: Number(p.level ?? 1),
        isShiny: Boolean(p.isShiny),
      })),
      bag: rawBag.map((b) => ({ id: String(b.id ?? "") })),
    };
  });

  const moonStoneInBag = snap.bag.some((b) => b.id === "moon_stone");
  const bstLookup = GEN1_SPECIES_BST;

  const result = await page.evaluate(
    (
      teamData: SwapTeamMember[],
      bst: Record<number, number>,
      moonStonePresent: boolean,
    ): string => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>("#swap-choices .poke-card"),
      );
      if (cards.length === 0) {
        (document.getElementById("btn-cancel-swap") as HTMLButtonElement | null)?.click();
        return "cancelled";
      }

      function powerScore(id: number, lv: number): number {
        return (bst[id] ?? 300) * Math.sqrt(Math.max(1, lv));
      }

      function isHardProtected(m: SwapTeamMember): boolean {
        if (m.isShiny) return true;
        // Never release Eevee (speciesId 133) while a Moon Stone is available
        if (m.speciesId === 133 && moonStonePresent) return true;
        return false;
      }

      let worstIdx = -1;
      let worstScore = Infinity;
      for (let i = 0; i < teamData.length; i++) {
        const m = teamData[i]!;
        if (isHardProtected(m)) continue;
        const s = powerScore(m.speciesId, m.level);
        if (s < worstScore) {
          worstScore = s;
          worstIdx = i;
        }
      }

      // Fallback: all slots hard-protected — release lowest-level non-shiny
      if (worstIdx === -1) {
        let fallbackLv = Infinity;
        for (let i = 0; i < teamData.length; i++) {
          const m = teamData[i]!;
          if (!m.isShiny && m.level < fallbackLv) {
            fallbackLv = m.level;
            worstIdx = i;
          }
        }
        if (worstIdx === -1) worstIdx = 0;
      }

      const target = cards[worstIdx];
      const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
      const lv = teamData[worstIdx]?.level ?? 0;
      target?.click();
      return `released slot${worstIdx} lv${lv} ${name} (score=${Math.round(worstScore)})`;
    },
    snap.team,
    bstLookup,
    moonStoneInBag,
  );

  console.log(`  [swap] ${result}`);
  await sleep(800);
}
