#!/usr/bin/env node
/**
 * One-off: builds attack→defense effectiveness matrix from PokeAPI type resources.
 * Writes src/data/type-chart.ts for use with GEN1_SPECIES_TYPES (modern typings).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "src", "data");
const outFile = join(outDir, "type-chart.ts");

function cap(name) {
  const n = name.replace(/-/g, " ");
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

async function fetchType(name) {
  const r = await fetch(`https://pokeapi.co/api/v2/type/${name}`);
  if (!r.ok) throw new Error(`type/${name}: HTTP ${r.status}`);
  return r.json();
}

async function main() {
  const index = await fetch("https://pokeapi.co/api/v2/type?limit=100");
  const { results } = await index.json();
  const names = results.map((x) => x.name).filter(Boolean);
  const allTypes = names.map((n) => cap(n));

  const chart = {};
  for (const rawName of names) {
    process.stdout.write(`\rtype/${rawName}…`);
    const d = await fetchType(rawName);
    const atk = cap(d.name);
    const row = {};
    for (const t of allTypes) row[t] = 1;

    const to = (rel, mult) => {
      for (const x of rel ?? []) {
        row[cap(x.name)] = mult;
      }
    };

    to(d.damage_relations.double_damage_to, 2);
    to(d.damage_relations.half_damage_to, 0.5);
    to(d.damage_relations.no_damage_to, 0);

    chart[atk] = row;
    await new Promise((r) => setTimeout(r, 60));
  }
  process.stdout.write("\n");

  await mkdir(outDir, { recursive: true });

  const header = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Built from PokeAPI /type/{name} damage_relations (double/half/no damage_to).
 * Regenerate: node scripts/fetch-type-chart.mjs
 */

`;

  const lines = [
    "export const TYPE_CHART: Record<string, Record<string, number>> = ",
    JSON.stringify(chart, null, 2),
    " as Record<string, Record<string, number>>;",
    "",
  ];

  await writeFile(outFile, header + lines.join(""), "utf8");
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
