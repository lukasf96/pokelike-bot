import type { Page } from "puppeteer";

export async function activeScreen(page: Page): Promise<string> {
  return page.evaluate((): string => {
    const ids = [
      "title-screen",
      "trainer-screen",
      "starter-screen",
      "map-screen",
      "battle-screen",
      "catch-screen",
      "item-screen",
      "swap-screen",
      "trade-screen",
      "shiny-screen",
      "badge-screen",
      "transition-screen",
      "gameover-screen",
      "win-screen",
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el?.classList.contains("active")) return id;
    }
    return "unknown";
  });
}

/** Move Tutor overlay sits on top of map-screen (#item-equip-modal with #btn-skip-tutor) */
export async function isMoveTutorOpen(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const m = document.getElementById("item-equip-modal");
    return m !== null && m.querySelector("#btn-skip-tutor") !== null;
  });
}

/** Item equip modal (after picking item from item-screen) */
export async function isItemEquipOpen(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const m = document.getElementById("item-equip-modal");
    return m !== null && m.querySelector("#btn-equip-to-bag") !== null;
  });
}

/** Eevee Lv 36 / moon-stone branching evo — blocks until a card in `#eevee-choices` is clicked */
export async function isEeveeChoiceOpen(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    const overlay = document.getElementById("eevee-choice-overlay");
    if (!overlay) return false;
    const display = (overlay as HTMLElement).style.display;
    return display !== "none" && display !== "";
  });
}

export async function screenText(page: Page): Promise<string> {
  return page.evaluate((): string => {
    const active = document.querySelector<HTMLElement>(".screen.active");
    return (active?.innerText ?? document.body.innerText).replace(/\s+/g, " ").trim().slice(0, 200);
  });
}
