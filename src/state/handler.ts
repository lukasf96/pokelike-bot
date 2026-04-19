/**
 * Handler contract. Every phase handler is `(tick, ctx) => Promise<void>`.
 *
 * Handlers MUST NOT call `page.evaluate` to read state — that's `observe()`'s job.
 * They MAY use `page` for clicks / keyboard input. They MAY call `ctx.reobserve()`
 * when they perform a sequence of clicks that mutates game state and they need a
 * fresh snapshot mid-handler (e.g. usable-item loop).
 */

import type { Page } from "puppeteer";

import type { Tick } from "./types.js";

export interface HandlerCtx {
  page: Page;
  /** Re-run `observe()` for handlers that perform multi-step click sequences. */
  reobserve: () => Promise<Tick>;
}

export type Handler = (tick: Tick, ctx: HandlerCtx) => Promise<void>;
