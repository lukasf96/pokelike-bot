#!/usr/bin/env node
/**
 * Downloads Gen 1 base stats from PokeAPI — mirrors game fetchPokemonById().
 * Writes src/data/gen1-base-stats.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outFile = join(root, "src", "data", "gen1-base-stats.ts");

async function fetchPokemon(id) {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!r.ok) throw new Error(`pokeapi ${id}: HTTP ${r.status}`);
  const d = await r.json();
  const hp = d.stats.find((s) => s.stat.name === "hp")?.base_stat ?? 45;
  const atk = d.stats.find((s) => s.stat.name === "attack")?.base_stat ?? 50;
  const def = d.stats.find((s) => s.stat.name === "defense")?.base_stat ?? 50;
  const special = d.stats.find((s) => s.stat.name === "special-attack")?.base_stat ?? 50;
  const spdef = d.stats.find((s) => s.stat.name === "special-defense")?.base_stat ?? 50;
  const speed = d.stats.find((s) => s.stat.name === "speed")?.base_stat ?? 50;
  return { hp, atk, def, special, spdef, speed };
}

async function main() {
  const rows = [];
  for (let id = 1; id <= 151; id++) {
    process.stdout.write(`\rFetching ${id}/151…`);
    rows.push(await fetchPokemon(id));
    await new Promise((r) => setTimeout(r, 50));
  }
  process.stdout.write("\n");

  await mkdir(dirname(outFile), { recursive: true });

  const lines = rows.map(
    (s, i) =>
      `  ${i + 1}: { hp:${s.hp}, atk:${s.atk}, def:${s.def}, special:${s.special}, spdef:${s.spdef}, speed:${s.speed} },`,
  );
  const body = `/**
 * AUTO-GENERATED — base stats mirror game fetchPokemonById() (Gen 1).
 * Regenerate: node scripts/fetch-gen1-base-stats.mjs
 */

export interface Gen1BaseStatsRow {
  hp: number;
  atk: number;
  def: number;
  special: number;
  spdef: number;
  speed: number;
}

export const GEN1_BASE_STATS: Record<number, Gen1BaseStatsRow> = {
${lines.join("\n")}
};
`;
  await writeFile(outFile, body, "utf8");
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
