import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

/** Pokemon strength scoring: BST-based (higher is better) */
const STRONG_POKEMON = new Set([
  "charizard",
  "blastoise",
  "alakazam",
  "machamp",
  "gengar",
  "rhydon",
  "gyarados",
  "lapras",
  "snorlax",
  "dragonair",
  "dragonite",
  "venusaur",
  "victreebel",
  "arcanine",
  "slowbro",
  "starmie",
  "scyther",
  "electabuzz",
  "magmar",
  "pinsir",
  "tauros",
  "aerodactyl",
  "kabutops",
  "omastar",
  "nidoking",
  "nidoqueen",
  "cloyster",
  "dewgong",
  "muk",
  "weezing",
  "hypno",
  "kangaskhan",
  "seadra",
  "seaking",
  "haunter",
  "dugtrio",
  "dodrio",
  "magneton",
  "exeggutor",
  "hitmonlee",
  "hitmonchan",
  "electrode",
  "chansey",
]);

export async function handleCatch(page: Page): Promise<void> {
  const picked = await page.evaluate(
    (strong: string[]): string => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>("#catch-choices .poke-card"));
      if (cards.length === 0) return "none";

      const scored = cards.map((c) => {
        const name = (c.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "").toLowerCase();
        const isShiny =
          c.querySelector(".shiny-badge, [class*='shiny']") !== null ||
          (c.textContent?.includes("★") ?? false) ||
          (c.textContent?.includes("Shiny") ?? false);
        const score = strong.includes(name) ? 10 : 0;
        return { c, name, score: score + (isShiny ? 5 : 0) };
      });

      scored.sort((a, b) => b.score - a.score);
      const target = scored[0]?.c;
      const name = target?.querySelector<HTMLElement>(".poke-name")?.textContent?.trim() ?? "?";
      target?.click();
      return name;
    },
    Array.from(STRONG_POKEMON),
  );

  console.log(`  [catch] Caught: ${picked}`);
  await sleep(800);
}
