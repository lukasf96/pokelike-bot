#!/usr/bin/env node
/**
 * One-off: downloads Gen 1 (IDs 1–151) Pokémon types from PokeAPI and writes src/data/gen1-species.ts.
 * Re-run only if you intentionally refresh data (frozen snapshot for the bot).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "src", "data");
const outFile = join(outDir, "gen1-species.ts");

function capType(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

async function fetchPokemon(id) {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!r.ok) throw new Error(`PokeAPI pokemon/${id}: HTTP ${r.status}`);
  const d = await r.json();
  const types = [...d.types]
    .sort((a, b) => a.slot - b.slot)
    .map((t) => capType(t.type.name.replace(/-/g, " ")));
  const displayName = d.name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const bst = d.stats.reduce((sum, s) => sum + s.base_stat, 0);
  return { id: d.id, name: displayName, types, bst };
}

async function main() {
  const rows = [];
  for (let id = 1; id <= 151; id++) {
    process.stdout.write(`\rFetching ${id}/151…`);
    rows.push(await fetchPokemon(id));
    await new Promise((r) => setTimeout(r, 80));
  }
  process.stdout.write("\n");

  await mkdir(outDir, { recursive: true });

  const header = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: https://pokeapi.co/api/v2/pokemon/{1..151}
 * Regenerate: node scripts/fetch-gen1-species.mjs
 * Matches game fetchPokemonById() type normalization (data.js).
 * Includes GEN1_SPECIES_BST (sum of six base stats) for trade / power heuristics.
 */

`;

  const typeLines = ["export const GEN1_SPECIES_TYPES: Record<number, string[]> = {"];
  const nameLines = ["export const GEN1_SPECIES_NAMES: Record<number, string> = {"];
  const bstLines = ["export const GEN1_SPECIES_BST: Record<number, number> = {"];
  for (const p of rows) {
    typeLines.push(`  ${p.id}: ${JSON.stringify(p.types)},`);
    nameLines.push(`  ${p.id}: ${JSON.stringify(p.name)},`);
    bstLines.push(`  ${p.id}: ${p.bst},`);
  }
  typeLines.push("};", "");
  nameLines.push("};", "");
  bstLines.push("};", "");

  const body = `${header}${typeLines.join("\n")}\n${nameLines.join("\n")}\n${bstLines.join("\n")}`;
  await writeFile(outFile, body, "utf8");
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
