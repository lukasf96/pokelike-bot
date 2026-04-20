/**
 * Pure string helpers that mirror logic we embed inside `page.evaluate`
 * closures (where we can't import modules). Keeping a copy here lets us
 * unit-test the parsing rules without a browser, and the contract tests in
 * `tests/contract/` assert that the matching regex in the game source still
 * produces URLs we can parse.
 */

/**
 * Extract Pokédex id from a sprite URL that renderPokemonCard() produces.
 *
 * The game writes either:
 *   https://raw.githubusercontent.com/.../sprites/pokemon/<id>.png
 *   https://raw.githubusercontent.com/.../sprites/pokemon/shiny/<id>.png
 *
 * Returns `null` when the URL doesn't match — snapshot.ts then falls back to
 * `speciesId = 0`, which `handlers/catch.ts` treats as "skip scoring".
 */
export function parseSpeciesIdFromSpriteUrl(src: string): number | null {
  if (!src) return null;
  const m = src.match(/\/sprites\/pokemon\/(?:shiny\/)?(\d+)\.png/i);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
