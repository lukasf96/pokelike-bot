export const GAME_URL = "https://pokelike.xyz/";

/** Semantic version string from the title screen (e.g. "Pokemon Roguelike v1.3.1"). Update when validating the bot against a new release. */
export const EXPECTED_POKELIKE_GAME_VERSION = "1.3.1";

/** `game.js` `saveRun()` writes the active run here; `let state` is not on `window`, so this is the reliable source in production. */
export const POKE_CURRENT_RUN_LS_KEY = "poke_current_run";
