import type { Page } from "puppeteer";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const humanDelay = (min = 300, max = 700) => sleep(min + Math.random() * (max - min));

export async function clickSel(page: Page, sel: string): Promise<boolean> {
  try {
    await page.click(sel);
    return true;
  } catch {
    return false;
  }
}

export async function clickFirst(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s: string): boolean => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        el.click();
        return true;
      }
    }
    return false;
  }, sel);
}
