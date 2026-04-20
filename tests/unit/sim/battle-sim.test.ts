import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calcDamage,
  calcHp,
  getBestMove,
  getEffectiveStat,
  getMoveTierForMap,
  runBattle,
  type SimPokemon,
} from "../../../src/sim/battle-sim.ts";

// Deterministic RNG for reproducible expectations.
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMon(over: Partial<SimPokemon> & { speciesId?: number; level?: number }): SimPokemon {
  const baseStats = {
    hp: 70,
    atk: 70,
    def: 70,
    special: 70,
    spdef: 70,
    speed: 70,
    ...(over.baseStats ?? {}),
  };
  const level = over.level ?? 20;
  const maxHp = calcHp(baseStats.hp, level);
  return {
    speciesId: over.speciesId ?? 1,
    name: "Test",
    level,
    currentHp: maxHp,
    maxHp,
    types: over.types ?? ["Normal"],
    baseStats,
    heldItem: over.heldItem ?? null,
    moveTier: over.moveTier ?? 1,
  };
}

describe("calcHp", () => {
  it("matches the in-game HP formula: floor(base*level/50) + level + 10", () => {
    // data.js Geodude baseHp=40, L12 → floor(40*12/50)+12+10 = 9+22 = 31
    assert.equal(calcHp(40, 12), 31);
    // Dragonite baseHp=91, L56 → floor(91*56/50)+56+10 = 101+66 = 167
    assert.equal(calcHp(91, 56), 167);
  });

  it("is monotonic in level and base HP", () => {
    assert.ok(calcHp(50, 20) > calcHp(50, 10));
    assert.ok(calcHp(100, 20) > calcHp(50, 20));
  });
});

describe("getMoveTierForMap", () => {
  it("returns tier 0 on maps 0–2, tier 1 thereafter", () => {
    assert.equal(getMoveTierForMap(0), 0);
    assert.equal(getMoveTierForMap(2), 0);
    assert.equal(getMoveTierForMap(3), 1);
    assert.equal(getMoveTierForMap(8), 1);
  });
});

describe("getBestMove", () => {
  it("returns the STAB type at the requested tier, honouring physical/special split", () => {
    const physical = getBestMove(
      ["Fire"],
      { hp: 50, atk: 100, def: 50, special: 40, speed: 60 },
      4,
      1,
    );
    assert.equal(physical.type, "Fire");
    assert.equal(physical.isSpecial, false);
    assert.equal(physical.name, "Fire Punch"); // Fire/physical tier 1

    const special = getBestMove(
      ["Fire"],
      { hp: 50, atk: 40, def: 50, special: 100, speed: 60 },
      4,
      1,
    );
    assert.equal(special.isSpecial, true);
    assert.equal(special.name, "Flamethrower"); // Fire/special tier 1
  });

  it("drops Normal in favour of a dual-type secondary", () => {
    const move = getBestMove(
      ["Normal", "Flying"],
      { hp: 50, atk: 80, def: 50, special: 40, speed: 60 },
      16,
      1,
    );
    assert.equal(move.type, "Flying");
  });

  it("special-cases Geodude-line: always Rock STAB even when Ground is listed", () => {
    const move = getBestMove(
      ["Rock", "Ground"],
      { hp: 40, atk: 80, def: 100, special: 30, speed: 20 },
      74,
      1,
    );
    assert.equal(move.type, "Rock");
  });

  it("returns a no-damage move for Magikarp (Splash) and Abra (Teleport)", () => {
    const karp = getBestMove(["Water"], undefined, 129, 1);
    assert.equal(karp.noDamage, true);
    const abra = getBestMove(["Psychic"], undefined, 63, 1);
    assert.equal(abra.noDamage, true);
  });

  it("clamps out-of-range tiers", () => {
    const move = getBestMove(
      ["Water"],
      { hp: 50, atk: 40, def: 50, special: 100, speed: 60 },
      7,
      99,
    );
    assert.equal(move.type, "Water");
  });
});

describe("getEffectiveStat", () => {
  it("applies eviolite's +50% DEF only when the holder can still evolve", () => {
    const base = { hp: 40, atk: 55, def: 60, special: 50, speed: 40 };
    const evoMon = makeMon({ speciesId: 1 /* Bulbasaur */, baseStats: base, level: 20 });
    const fullyEvo = makeMon({ speciesId: 3 /* Venusaur, no evo */, baseStats: base, level: 20 });

    const withEvi = getEffectiveStat(evoMon, "def", [{ id: "eviolite" }], [evoMon]);
    const without = getEffectiveStat(evoMon, "def", [], [evoMon]);
    const veniWithEvi = getEffectiveStat(fullyEvo, "def", [{ id: "eviolite" }], [fullyEvo]);
    const veniWithout = getEffectiveStat(fullyEvo, "def", [], [fullyEvo]);

    assert.ok(withEvi > without, `Bulbasaur DEF ${without} → with eviolite ${withEvi}`);
    assert.equal(veniWithEvi, veniWithout, "Venusaur shouldn't benefit from eviolite");
  });

  it("applies choice_scarf to speed", () => {
    const mon = makeMon({ baseStats: { hp: 50, atk: 50, def: 50, special: 50, speed: 100 } });
    const plain = getEffectiveStat(mon, "speed", [], [mon]);
    const scarfed = getEffectiveStat(mon, "speed", [{ id: "choice_scarf" }], [mon]);
    assert.ok(scarfed > plain * 1.4, `scarf should ~+50% speed (${plain} → ${scarfed})`);
  });

  it("clamps to a minimum of 1", () => {
    const weak = makeMon({ baseStats: { hp: 1, atk: 0, def: 0, special: 0, speed: 0 }, level: 1 });
    assert.ok(getEffectiveStat(weak, "atk", [], [weak]) >= 1);
  });

  // F-006 invariant: the `playerTeamOnly` argument gates team-wide items
  // regardless of which side owns the Pokémon being evaluated. This mirrors
  // `battle.js getEffectiveStat`, which reads `state.team` (the player's)
  // for the all-physical / all-special gates on muscle_band / wise_glasses.
  // If someone ever refactors getEffectiveStat to read the defender's own
  // team, enemy-held Eviolite / Muscle Band on gym leaders (Kadabra,
  // Pikachu, Dugtrio, Growlithe, Haunter, …) silently diverges from the
  // game and every related pWinBoss skews — this test catches that.
  it("team-wide item gates (muscle_band) read the supplied player team only", () => {
    const physicalAttacker = {
      hp: 70,
      atk: 120,
      def: 70,
      special: 40,
      speed: 70,
    };

    const enemy = makeMon({
      speciesId: 27,
      types: ["Ground"],
      baseStats: physicalAttacker,
      heldItem: { id: "muscle_band" },
    });

    const allPhysicalPlayerTeam = [
      makeMon({ speciesId: 100, baseStats: physicalAttacker }),
      makeMon({ speciesId: 101, baseStats: physicalAttacker }),
      makeMon({ speciesId: 102, baseStats: physicalAttacker }),
      makeMon({ speciesId: 103, baseStats: physicalAttacker }),
    ];
    const allSpecialPlayerTeam = allPhysicalPlayerTeam.map((p) =>
      makeMon({
        speciesId: p.speciesId,
        baseStats: { hp: 70, atk: 40, def: 70, special: 120, speed: 70 },
      }),
    );

    // Enemy's Muscle Band gates on the PLAYER team's composition — an
    // all-physical player team boosts the enemy's atk; an all-special
    // player team does not.
    const boosted = getEffectiveStat(enemy, "atk", [{ id: "muscle_band" }], allPhysicalPlayerTeam);
    const notBoosted = getEffectiveStat(
      enemy,
      "atk",
      [{ id: "muscle_band" }],
      allSpecialPlayerTeam,
    );

    assert.ok(
      boosted > notBoosted,
      `muscle_band on enemy must gate on PLAYER team composition (got ${boosted} vs ${notBoosted})`,
    );
    // Sanity: the boost is the ~1.5× from data.js (floor rounding allows a tiny margin).
    assert.ok(
      boosted >= Math.floor(notBoosted * 1.45),
      `muscle_band boost should be ~1.5× (got ${boosted / notBoosted})`,
    );
  });

  it("Eviolite on an enemy still gates on the enemy's own evolvability (not the player team)", () => {
    // Eviolite's gate is `canEvolve(pokemon.speciesId)` — this is evaluated
    // on the HOLDER, not the team. The playerTeamOnly arg only controls the
    // physical/special count gates. This test guards against a refactor
    // accidentally confusing the two.
    const base = { hp: 40, atk: 55, def: 60, special: 50, speed: 40 };
    const enemyKadabra = makeMon({ speciesId: 64 /* evolves to Alakazam */, baseStats: base });
    const enemyAlakazam = makeMon({ speciesId: 65 /* fully evolved */, baseStats: base });

    const withEvi = getEffectiveStat(enemyKadabra, "def", [{ id: "eviolite" }], []);
    const without = getEffectiveStat(enemyKadabra, "def", [], []);
    const fullyEvoWith = getEffectiveStat(enemyAlakazam, "def", [{ id: "eviolite" }], []);
    const fullyEvoWithout = getEffectiveStat(enemyAlakazam, "def", [], []);

    assert.ok(withEvi > without, "Kadabra should get eviolite bonus");
    assert.equal(fullyEvoWith, fullyEvoWithout, "Alakazam gets no eviolite bonus (fully evolved)");
  });
});

describe("calcDamage", () => {
  it("applies STAB (1.5×) and type effectiveness (2×) multiplicatively", () => {
    const attacker = makeMon({
      types: ["Water"],
      baseStats: { hp: 50, atk: 50, def: 50, special: 100, speed: 60 },
      level: 20,
    });
    const defenderFire = makeMon({ types: ["Fire"], level: 20 });
    const defenderWater = makeMon({ types: ["Water"], level: 20 });
    const move = getBestMove(attacker.types, attacker.baseStats, attacker.speciesId, 1);

    const rngFire = seededRng(1);
    const rngWater = seededRng(1); // same seed isolates the non-RNG multipliers

    const dmgFire = calcDamage(attacker, defenderFire, move, [], [], [attacker], rngFire);
    const dmgWater = calcDamage(attacker, defenderWater, move, [], [], [attacker], rngWater);

    assert.equal(dmgFire.typeEff, 2, "Water→Fire should be 2×");
    assert.equal(dmgWater.typeEff, 0.5, "Water→Water should be 0.5×");
    // With STAB × eff baked in and identical RNG: Fire takes ~4× of what Water takes.
    assert.ok(
      dmgFire.damage >= dmgWater.damage * 3,
      `expected Fire dmg (${dmgFire.damage}) ≈ 4× Water dmg (${dmgWater.damage})`,
    );
  });

  it("returns 0 damage for immunity (Normal → Ghost)", () => {
    const attacker = makeMon({
      types: ["Normal"],
      baseStats: { hp: 50, atk: 100, def: 50, special: 50, speed: 60 },
    });
    const defender = makeMon({ types: ["Ghost"] });
    const move = getBestMove(attacker.types, attacker.baseStats, attacker.speciesId, 1);
    const { damage, typeEff } = calcDamage(
      attacker,
      defender,
      move,
      [],
      [],
      [attacker],
      seededRng(2),
    );
    assert.equal(typeEff, 0);
    assert.equal(damage, 0);
  });
});

describe("runBattle", () => {
  const STRONG = makeMon({
    types: ["Water"],
    baseStats: { hp: 100, atk: 100, def: 100, special: 100, speed: 100 },
    level: 60,
  });
  const WEAK = makeMon({
    types: ["Grass"],
    baseStats: { hp: 30, atk: 30, def: 30, special: 30, speed: 30 },
    level: 5,
  });

  it("is deterministic under the same seed", () => {
    const a = runBattle([STRONG], [WEAK], [], [], seededRng(42));
    const b = runBattle([STRONG], [WEAK], [], [], seededRng(42));
    assert.equal(a, b);
  });

  it("a very strong team beats a very weak one (pWin ≈ 1)", () => {
    let wins = 0;
    for (let i = 0; i < 10; i++) {
      if (runBattle([STRONG], [WEAK], [], [], seededRng(100 + i))) wins++;
    }
    assert.ok(wins >= 9, `expected near-certain win, got ${wins}/10`);
  });

  it("an empty player team loses immediately", () => {
    const won = runBattle([], [WEAK], [], [], seededRng(1));
    assert.equal(won, false);
  });

  it("an empty enemy team is a win", () => {
    const won = runBattle([STRONG], [], [], [], seededRng(1));
    assert.equal(won, true);
  });
});
