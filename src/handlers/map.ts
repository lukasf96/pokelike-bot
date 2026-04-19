import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";
import { dismissTutorial } from "./startup.js";

export async function handleMap(page: Page): Promise<void> {
  await dismissTutorial(page);

  const result = await page.evaluate(() => {
    let hpRatio = 1;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      const team = (st?.team ?? []) as Array<{ currentHp: number; maxHp: number }>;
      const tot = team.reduce((s, p) => s + p.currentHp, 0);
      const mx = team.reduce((s, p) => s + p.maxHp, 0);
      if (mx > 0) hpRatio = tot / mx;
    } catch {
      /* state not accessible */
    }
    const lowHp = hpRatio < 0.6;

    const clickable = Array.from(document.querySelectorAll<SVGGElement>("#map-container g")).filter((g) =>
      (g.getAttribute("style") ?? "").includes("cursor: pointer"),
    );

    if (clickable.length === 0) return { picked: false, log: "no clickable nodes" };

    const candidates = clickable.map((g) => {
      const img = g.querySelector<SVGImageElement>("image");
      const href = img?.getAttribute("href") ?? img?.getAttribute("xlink:href") ?? "";
      const type = href.includes("catchPokemon")
        ? "catch"
        : href.includes("grass")
          ? "battle"
          : href.includes("itemIcon")
            ? "item"
            : href.includes("Poke Center") || href.includes("PokeCenter")
              ? "pokecenter"
              : href.includes("moveTutor")
                ? "move_tutor"
                : href.includes("legendaryEncounter")
                  ? "legendary"
                  : href.includes("questionMark")
                    ? "question"
                    : href.includes("tradeIcon")
                      ? "trade"
                      : "unknown";
      const score =
        type === "legendary"
          ? 8
          : type === "pokecenter"
            ? lowHp
              ? 10
              : -2
            : type === "catch"
              ? 4
              : type === "item" || type === "move_tutor"
                ? 3
                : type === "question"
                  ? 2
                  : 1;
      return { g, type, score };
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    best.g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const summary = candidates.map((c) => `${c.type}(${c.score})`).join(", ");
    const log = `hp=${Math.round(hpRatio * 100)}% lowHp=${lowHp} | ${summary} → picked ${best.type}`;
    return { picked: true, log };
  }) as { picked: boolean; log: string };

  console.log(`  [map] ${result.log}`);
  if (!result.picked) {
    await sleep(1500);
    return;
  }
  await sleep(1200);
}
