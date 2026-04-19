import type { Page } from "puppeteer";

import { sleep } from "../page-utils.js";

const ITEM_PRIORITY: Record<string, number> = {
  lucky_egg: 100,
  life_orb: 90,
  choice_band: 85,
  choice_specs: 85,
  leftovers: 80,
  shell_bell: 75,
  scope_lens: 70,
  wide_lens: 65,
  expert_belt: 60,
  assault_vest: 55,
  muscle_band: 55,
  wise_glasses: 55,
  focus_sash: 50,
  focus_band: 45,
  metronome: 45,
  max_revive: 95,
  rare_candy: 70,
  moon_stone: 65,
  charcoal: 40,
  mystic_water: 40,
  thunderbolt: 40,
  miracle_seed: 40,
  twisted_spoon: 40,
  black_belt: 40,
  dragon_fang: 40,
  sharp_beak: 35,
  choice_scarf: 35,
  eviolite: 35,
};

export async function handleItem(page: Page): Promise<void> {
  const picked = await page.evaluate((priority: Record<string, number>): string => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("#item-choices .item-card"));
    if (cards.length === 0) return "none";

    const scored = cards.map((c) => {
      const name = c.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "";
      const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const score = priority[id] ?? 20;
      return { c, name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const target = scored[0]?.c;
    const name = target?.querySelector<HTMLElement>(".item-name")?.textContent?.trim() ?? "item";
    target?.click();
    return `${name} (score: ${scored[0]?.score ?? 0})`;
  }, ITEM_PRIORITY);

  console.log(`  [item] Picked: ${picked}`);
  await sleep(800);
}
