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
  return { id: d.id, name: displayName, types };
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
 */

`;

  const typeLines = ["export const GEN1_SPECIES_TYPES: Record<number, string[]> = {"];
  const nameLines = ["export const GEN1_SPECIES_NAMES: Record<number, string> = {"];
  for (const p of rows) {
    typeLines.push(`  ${p.id}: ${JSON.stringify(p.types)},`);
    nameLines.push(`  ${p.id}: ${JSON.stringify(p.name)},`);
  }
  typeLines.push("};", "");
  nameLines.push("};", "");

  const body = `${header}${typeLines.join("\n")}\n${nameLines.join("\n")}`;
  await writeFile(outFile, body, "utf8");
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
