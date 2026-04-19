import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";
import { dismissTutorial } from "./startup.js";

export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);

  const result = await page.evaluate((): { picked: boolean; log: string } => {
    // Nested `function` declarations make tsx emit `__name()` — invalid in browser evaluate().
    const spriteToType = (href: string): string => {
      if (href.includes("catchPokemon")) return "catch";
      if (href.includes("grass")) return "battle";
      if (href.includes("itemIcon")) return "item";
      if (href.includes("Poke Center") || href.includes("PokeCenter")) return "pokecenter";
      if (href.includes("moveTutor")) return "move_tutor";
      if (href.includes("legendaryEncounter")) return "legendary";
      if (href.includes("questionMark")) return "question";
      if (href.includes("tradeIcon")) return "trade";
      return "unknown";
    };

    const nodeScore = (type: string, lowHp: boolean): number => {
      switch (type) {
        case "legendary":
          return 8;
        case "pokecenter":
          return lowHp ? 10 : -2;
        case "catch":
          return 4;
        case "item":
          return 3;
        case "move_tutor":
          return 3;
        case "question":
          return 2;
        case "trade":
          return 1;
        case "unknown":
          return 1;
        case "trainer":
          return -1;
        case "battle":
          return -2;
        default:
          return 0;
      }
    };

    let hpRatio = 1;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team: Array<{ currentHp: number; maxHp: number }> = st?.team ?? [];
      const tot = team.reduce((s: number, p: { currentHp: number }) => s + p.currentHp, 0);
      const mx = team.reduce((s: number, p: { maxHp: number }) => s + p.maxHp, 0);
      if (mx > 0) hpRatio = tot / mx;
    } catch {
      /* state not accessible */
    }
    const lowHp = hpRatio < 0.6;

    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );

    if (clickable.length === 0) return { picked: false, log: "no clickable nodes" };

    type Candidate = { g: SVGGElement; type: string; score: number };
    const candidates: Candidate[] = clickable.map((g) => {
      const img = g.querySelector<SVGImageElement>("image");
      const href = img?.getAttribute("href") ?? img?.getAttribute("xlink:href") ?? "";
      const type = spriteToType(href);
      return { g, type, score: nodeScore(type, lowHp) };
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    best.g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const summary = candidates.map((c) => `${c.type}(${c.score})`).join(", ");
    const log = `hp=${Math.round(hpRatio * 100)}% lowHp=${lowHp} | ${summary} → picked ${best.type}`;
    return { picked: true, log };
  });

  console.log(`  [map] ${result.log}`);
  if (!result.picked) {
    await sleep(1500);
    return;
  }
  await sleep(1200);
}
