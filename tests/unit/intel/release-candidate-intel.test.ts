import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  coveragePenaltyForRemovingSlot,
  expectedTradeOfferPowerScore,
  isHardProtectedRelease,
  pickSwapReleaseSlot,
  redundancyReleaseBias,
  slotPowerScore,
  tradeAdjustedGainForSlot,
  type ReleaseTeamMember,
} from "../../../src/intel/release-candidate-intel.ts";

function member(
  over: Partial<ReleaseTeamMember> & Pick<ReleaseTeamMember, "speciesId" | "level">,
): ReleaseTeamMember {
  return {
    isShiny: false,
    heldItemId: null,
    moveTier: 1,
    ...over,
  };
}

describe("slotPowerScore", () => {
  it("scales with BST × √level", () => {
    // Bulbasaur BST 318, L25 → 318·5 ≈ 1590
    const s = slotPowerScore(1, 25);
    assert.ok(s > 1400 && s < 1800, `Bulbasaur L25 score ${s} out of sane range`);
  });

  it("is monotonic in level", () => {
    assert.ok(slotPowerScore(1, 30) > slotPowerScore(1, 10));
  });

  it("falls back to a neutral BST for unknown species", () => {
    const score = slotPowerScore(9999, 10);
    assert.ok(Number.isFinite(score));
  });
});

describe("isHardProtectedRelease", () => {
  it("protects shinies, lucky_egg / eviolite holders, and tutored mons", () => {
    assert.ok(isHardProtectedRelease(member({ speciesId: 1, level: 10, isShiny: true }), false));
    assert.ok(
      isHardProtectedRelease(member({ speciesId: 1, level: 10, heldItemId: "lucky_egg" }), false),
    );
    assert.ok(
      isHardProtectedRelease(member({ speciesId: 1, level: 10, heldItemId: "eviolite" }), false),
    );
    assert.ok(isHardProtectedRelease(member({ speciesId: 1, level: 10, moveTier: 2 }), false));
  });

  it("protects Eevee when the bag has a Moon Stone (planned evolution)", () => {
    assert.ok(isHardProtectedRelease(member({ speciesId: 133, level: 10 }), true));
    assert.equal(isHardProtectedRelease(member({ speciesId: 133, level: 10 }), false), false);
  });

  it("does not protect an ordinary mon with no held item", () => {
    assert.equal(isHardProtectedRelease(member({ speciesId: 1, level: 10 }), false), false);
  });
});

describe("coveragePenaltyForRemovingSlot", () => {
  it("penalises removing the sole counter to an upcoming boss", () => {
    const team: ReleaseTeamMember[] = [
      // Only Electric on team — gives SE coverage vs Misty (Water).
      member({ speciesId: 25, level: 20 }), // Pikachu
      member({ speciesId: 19, level: 20 }), // Rattata
      member({ speciesId: 16, level: 20 }), // Pidgey
    ];
    const penalty = coveragePenaltyForRemovingSlot(team, 0, 1); // mapIndex=1 (Misty is next)
    assert.ok(penalty >= 40, `expected ≥40 penalty for losing Electric STAB, got ${penalty}`);
  });

  it("is zero when a duplicate covers the same STAB role", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 25, level: 20 }), // Pikachu (Electric)
      member({ speciesId: 100, level: 20 }), // Voltorb (Electric)
      member({ speciesId: 16, level: 20 }),
    ];
    const penalty = coveragePenaltyForRemovingSlot(team, 0, 1);
    assert.equal(penalty, 0);
  });
});

describe("redundancyReleaseBias", () => {
  it("biases release for duplicate STAB that is fully resisted by the next boss", () => {
    // Next boss is Blaine (Map 6 = Fire). Two Fire mons → Fire STAB resisted by
    // Fire across the whole roster, no SE anywhere → strong release bias (+350).
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 4, level: 15 }), // Charmander (Fire)
      member({ speciesId: 37, level: 15 }), // Vulpix (Fire)
      member({ speciesId: 16, level: 15 }), // Pidgey
    ];
    const bias = redundancyReleaseBias(team, 0, 6);
    assert.ok(
      bias >= 300,
      `expected strong release bias for fully-resisted duplicate STAB, got ${bias}`,
    );
  });

  it("is zero for a unique STAB type (protected by coverage)", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 25, level: 20 }), // Pikachu (unique Electric)
      member({ speciesId: 16, level: 20 }),
      member({ speciesId: 19, level: 20 }),
    ];
    assert.equal(redundancyReleaseBias(team, 0, 1), 0);
  });
});

describe("pickSwapReleaseSlot", () => {
  it("releases the weakest non-protected slot", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 3, level: 30 }), // strong Venusaur
      member({ speciesId: 10, level: 3 }), // weak Caterpie
      member({ speciesId: 25, level: 20 }),
    ];
    assert.equal(pickSwapReleaseSlot(team, false, 0), 1);
  });

  it("never picks a shiny", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 10, level: 3, isShiny: true }), // shiny but worst
      member({ speciesId: 19, level: 10 }),
      member({ speciesId: 16, level: 10 }),
    ];
    const pick = pickSwapReleaseSlot(team, false, 0);
    assert.notEqual(pick, 0);
  });

  it("falls back to lowest-level non-shiny when all are protected by held items", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 3, level: 30, heldItemId: "lucky_egg" }),
      member({ speciesId: 25, level: 15, heldItemId: "eviolite" }),
      member({ speciesId: 1, level: 5, moveTier: 2 }),
    ];
    const pick = pickSwapReleaseSlot(team, false, 0);
    assert.equal(pick, 2, "L5 is lowest among protected mons");
  });
});

describe("expectedTradeOfferPowerScore", () => {
  it("rises with map index (stronger catch pool) and trade-from level", () => {
    const early = expectedTradeOfferPowerScore(0, 10);
    const late = expectedTradeOfferPowerScore(6, 10);
    const higherLv = expectedTradeOfferPowerScore(0, 40);
    assert.ok(late > early, "higher map → stronger offer");
    assert.ok(higherLv > early, "higher trade-in level → stronger offer");
  });
});

describe("tradeAdjustedGainForSlot", () => {
  it("penalises trading away the sole counter for the next boss", () => {
    const team: ReleaseTeamMember[] = [
      member({ speciesId: 25, level: 10 }), // lone Electric for Misty
      member({ speciesId: 19, level: 10 }),
      member({ speciesId: 16, level: 10 }),
    ];
    const gainPikachu = tradeAdjustedGainForSlot(team, 0, 1);
    const gainRattata = tradeAdjustedGainForSlot(team, 1, 1);
    assert.ok(
      gainRattata > gainPikachu,
      `should prefer trading Rattata (${gainRattata}) over Pikachu (${gainPikachu}) when Misty is next`,
    );
  });
});
