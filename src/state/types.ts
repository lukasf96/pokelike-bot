/**
 * Canonical state model. Everything the bot reads about the game is one of these types.
 *
 * Rules:
 *  - `Pokemon`, `BagItem`, `GameSnapshot` are the only domain shapes for game data.
 *    Handler-specific views are derived via `state/selectors.ts`.
 *  - A `Tick` is the immutable observation of the world at one bot iteration. It is the
 *    sole input to handlers (besides the page handle for clicks).
 *  - `Phase` collapses the active screen + overlays into one routing key.
 */

export interface BaseStats {
  hp?: number;
  atk?: number;
  def?: number;
  speed?: number;
  special?: number;
  spdef?: number;
}

export interface Pokemon {
  speciesId: number;
  name: string;
  level: number;
  types: string[];
  baseStats?: BaseStats;
  hp: { current: number; max: number };
  isShiny: boolean;
  /** 0–2 tutor tier; ≥2 = upgraded moves */
  moveTier: number;
  heldItemId: string | null;
}

export interface BagItem {
  idx: number;
  id: string;
  usable: boolean;
}

export interface GameSnapshot {
  team: Pokemon[];
  bag: BagItem[];
  currentMap: number;
  eliteIndex: number;
  badges: number;
}

/** Discriminator for routing handlers. Overlays beat base screens (eevee > tutor > item-equip > screen). */
export type PhaseKind =
  | "title"
  | "trainer"
  | "starter"
  | "map"
  | "battle"
  | "catch"
  | "item"
  | "swap"
  | "trade"
  | "shiny"
  | "badge"
  | "transition"
  | "win"
  | "gameover"
  | "eevee-choice"
  | "move-tutor"
  | "item-equip"
  | "unknown";

export interface Phase {
  kind: PhaseKind;
}

// ── Phase-specific UI payloads (pre-fetched in the same evaluate) ───────────

export interface BattleUi {
  isDefeat: boolean;
  skipVisible: boolean;
  continueVisible: boolean;
  /** Title/subtitle for defeat-context parsing — only kept when `isDefeat` is true. */
  title: string;
  subtitle: string;
}

export interface MapCandidate {
  idx: number;
  href: string;
  surfaceKind: string;
}

export interface MapUi {
  candidates: MapCandidate[];
}

export interface CatchOption {
  index: number;
  speciesId: number;
  level: number;
  isShiny: boolean;
  name: string;
}

export interface CatchUi {
  options: CatchOption[];
}

export interface ItemUi {
  names: string[];
}

export interface ItemEquipUi {
  itemName: string;
  /** Slot indices the modal exposes as enabled equip targets (excludes unequip buttons). */
  idxButtons: number[];
}

export interface ShinyUi {
  speciesId: number;
  level: number;
}

/** Compact textual peek captured at observation time (replaces the standalone screenText() call). */
export interface ScreenPeek {
  raw: string;
}

export interface TickUi {
  battle?: BattleUi;
  map?: MapUi;
  catch?: CatchUi;
  item?: ItemUi;
  itemEquip?: ItemEquipUi;
  shiny?: ShinyUi;
  peek?: ScreenPeek;
}

export interface Tick {
  /** Monotonic, set by the bot loop. */
  tickId: number;
  /** Wall-clock when the page evaluate started (ms since epoch). */
  observedAt: number;
  phase: Phase;
  /** `null` when the active phase has no game state (title / trainer / starter / unknown). */
  game: GameSnapshot | null;
  ui: TickUi;
}
