# Pokelike Bot — Testing Suite

## Why

The bot is glued to a live game we don't control. Two things blow us up silently:

1. **Our own logic regresses** — a catch-scoring tweak or sim change shifts win
   probabilities in a way we notice only 200 runs later.
2. **The game changes under us** — a DOM id rename, a new `localStorage` field,
   a tweaked subtitle string, and the bot either hangs, flies blind (remember
   `speciesId=0` silently disabling catch scoring) or hallucinates
   decisions from stale state (stuck `eliteIndex=0`).

The suite has two layers aimed at each failure mode.

## Structure

```
tests/
├── README.md                 ← this file
├── unit/                     ← pure logic, sub-second, no I/O
│   ├── run-log.test.ts
│   ├── game-version.test.ts
│   ├── catch-pool.test.ts
│   ├── catch-intel.test.ts
│   ├── battle-intel.test.ts
│   ├── battle-intel-extras.test.ts
│   ├── selectors.test.ts
│   ├── item-intel.test.ts
│   ├── release-candidate-intel.test.ts
│   ├── tutor-intel.test.ts
│   ├── data/
│   │   └── gen1-min-level.test.ts
│   ├── sim/
│   │   ├── battle-sim.test.ts
│   │   ├── game-move-pool.test.ts
│   │   └── win-probability.test.ts
│   └── state/
│       ├── state-parsers.test.ts
│       └── run-machine.test.ts
└── contract/                 ← assertions against pokelike-source-files
    ├── game-source.test.ts   ← DOM selectors, localStorage schema, URL shapes
    └── rosters-match.test.ts ← GYM_ROSTERS / ELITE_ROSTERS mirror the game
```

### Unit tests

Each pure module in `src/` gets a companion under `tests/unit/`. These must be
deterministic (inject `rng`, freeze seeds), fast (< 50 ms each), and side-effect
free (no fs/network). Scope per file:

| Module                   | What to cover                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `run-log.ts`             | `parseDefeatContext`, `deriveEliteIndex` — all defeat kinds; Elite 4 1–4/4 and "Final Battle"; name-fallback when subtitle is empty |
| `state/parsers.ts`       | `parseSpeciesIdFromSpriteUrl` for normal / shiny / malformed URLs                                                                   |
| `game-version.ts`        | `parseGameVersionFromTitleText` for tagged and loose version strings                                                                |
| `catch-pool.ts`          | Bucket membership + legendary exclusion; `getMapLevelRange` bounds                                                                  |
| `catch-intel.ts`         | Ordering invariants: counter beats BST; duplicate-STAB penalty; urgency when team has no counter; shiny bump                        |
| `battle-intel.ts`        | Type chart, STAB selection, `inferNodeIntel` URL dispatch, lead reordering, `scoreCandidate` grind/tiny-team branches               |
| `sim/battle-sim.ts`      | `calcHp` parity with game formula; `runBattle` determinism given same seed; STAB + type eff + held-item multipliers                |
| `sim/win-probability.ts` | `estimateBattleWinProbability` seeded output stability; refusal thresholds in `adjustMapScoreWithWinProbability`                    |
| `sim/game-move-pool.ts`  | Shape invariants: 17 types × 3 tiers × physical+special; non-decreasing power                                                       |
| `item-intel.ts`          | `scoreItemPick` / `heldItemFitnessAtSlot` / `optimalHeldItemPermutation` (type-boost + eviolite + mis-assignment swap)              |
| `release-candidate-intel.ts` | Protected-release rules; `redundancyReleaseBias` when STAB is fully resisted; `pickSwapReleaseSlot` fallback order              |
| `tutor-intel.ts`         | Final-evo preference; BST×√level tiebreak; skip-if-tutored                                                                          |
| `data/gen1-min-level.ts` | Evolution trigger levels (Ivysaur=16, Charizard=36, Mewtwo=55) match `data.js`                                                      |
| `state/run-machine.ts`   | Run lifecycle: start/end/phase-changed, defeat fallback, `lastGame` preservation across team wipes                                  |

### Contract tests

These parse `pokelike-source-files/` at test time and assert that our
assumptions about the game still hold. They are the tripwires for silent game
updates. Each assertion corresponds to a behaviour-critical assumption in the
bot code — when one fails, the bot would misbehave silently.

| Contract                                                                      | Source file              | Why it matters                                                     |
| ----------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| Title screen contains `v<semver>`                                             | `Pokemon Roguelike.html` | `parseGameVersionFromTitleText` anchors on this                    |
| All 14 `PhaseKind` screen ids exist in the HTML                               | `Pokemon Roguelike.html` | `snapshot.ts` phase dispatch depends on each id                    |
| `saveRun()` persists `eliteIndex`, `team`, `badges`, `currentMap`, `items`    | `game.js`                | `snapshot.ts` reads these from localStorage                        |
| `doElite4()` sets `state.eliteIndex` in-loop without `saveRun()`              | `game.js`                | Documents the bug our `deriveEliteIndex` compensates for           |
| Battle subtitle format `Elite Four - Battle N/4` / `Final Battle!`            | `game.js`                | `deriveEliteIndex` regexes target these exact strings              |
| `renderPokemonCard()` builds sprite URLs as `/sprites/pokemon/[shiny/]ID.png` | `game.js`                | `parseSpeciesIdFromSpriteUrl` + catch scoring depend on this shape |
| `GYM_ROSTERS` mirrors `GYM_LEADERS` (name, badge, team species/levels)        | `data.js`                | Our win-probability sim builds gym teams from our mirror           |
| `ELITE_ROSTERS` mirrors `ELITE_4` (species/levels per boss)                   | `data.js`                | Same, for elite bosses                                             |
| Map-scoped `MAP_BST_RANGES` / `MAP_LEVEL_RANGES` mirror `data.js`             | `data.js`                | Catch-pool bucket selection                                        |
| Elite 4 boss count = 5 (Lorelei..Gary)                                        | `data.js`                | `ELITE_NAME_TO_INDEX` fallback; eliteIndex bounds checks           |

## Running

```sh
pnpm test            # unit + contract
pnpm test:unit       # fast loop while iterating on logic
pnpm test:contract   # run once after pulling a new game build
pnpm test:coverage   # unit + contract with line/branch/func % per file
```

Runner: Node's built-in `node:test` via `tsx` (no new deps). Node ≥ 22.

`test:coverage` uses Node's native `--experimental-test-coverage` — no
Istanbul / nyc. Puppeteer-coupled files (`bot.ts`, `handlers/*`,
`state/snapshot.ts`, `logger.ts`, …) are excluded so the report only reflects
testable modules.

## Conventions

- **One describe per exported function.** Test names read like the spec
  (`"returns 0 when team has no counter"`).
- **Fixtures near tests.** Hand-craft small Pokemon / team literals inline;
  don't import the massive `GEN1_SPECIES` tables unless testing them. Keep
  tests readable.
- **No randomness without a seed.** Monte Carlo tests must pass a stable
  `seed:` option and assert ranges (± 0.02 on fractions), not exact equality.
- **Contract tests are allowed to read `pokelike-source-files/`** — that's
  their whole point. Unit tests must not.
- **Every bug fix gets a regression test.** Before merging a fix, add a test
  that fails without it. The first two tests (`derive-eliteIndex` and
  `parseSpeciesIdFromSpriteUrl`) exist for exactly this reason.

## Coverage target

Puppeteer-coupled modules are excluded from the coverage report (they require
a live browser). Current status of the testable surface:

| Module                          | Lines % | Funcs % |
| ------------------------------- | ------: | ------: |
| `battle-intel.ts`               |   87.28 |   78.79 |
| `catch-intel.ts`                |  100.00 |   90.00 |
| `catch-pool.ts`                 |   97.80 |  100.00 |
| `item-intel.ts`                 |   81.53 |   70.97 |
| `release-candidate-intel.ts`    |   98.29 |  100.00 |
| `sim/battle-sim.ts`             |   91.91 |   96.67 |
| `sim/game-move-pool.ts`         |  100.00 |  100.00 |
| `sim/win-probability.ts`        |   80.11 |   64.00 |
| `state/parsers.ts`              |  100.00 |  100.00 |
| `state/run-machine.ts`          |  100.00 |  100.00 |
| `state/selectors.ts`            |   86.36 |   66.67 |
| `tutor-intel.ts`                |  100.00 |  100.00 |
| `data/*` (all six tables)       |  100.00 |  100.00 |
| **aggregate**                   |   **92.37** | **80.21** |

Functions still uncovered are mostly private helpers reached only via specific
branches (`leadTypingsPoolForIntel` fallbacks, `game-version.ts` puppeteer
wrapper, `run-log.ts` fs writes). Prioritize new tests on *behavioural*
branches before chasing the last few percent.

## What this suite _doesn't_ cover (yet)

- **Handlers (`src/handlers/*`).** They click the real page. Need puppeteer or
  a jsdom harness; out of scope for v1.
- **`state/snapshot.ts`'s `page.evaluate` body.** The string-parsing subsets
  are extracted into `state/parsers.ts` and tested there; the DOM-walking bits
  remain puppeteer-only for now.
- **End-to-end runs.** Deferred. The existing `logs/runs/*.json` already serve
  as a regression corpus — a future `tests/replay/` dir can diff recorded
  `MapDecisionEntry` alternatives against `scoreCandidate()` output to detect
  scoring drift.
