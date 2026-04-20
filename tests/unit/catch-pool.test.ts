import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LEGENDARY_IDS,
  avgBstCatchPool,
  catchBucketIdsForMap,
  getMapLevelRange,
  maxLevelForMap,
} from "../../src/catch-pool.ts";

describe("getMapLevelRange / maxLevelForMap", () => {
  it("mirrors data.js MAP_LEVEL_RANGES for the canonical maps", () => {
    assert.deepEqual(getMapLevelRange(0), [1, 5]);
    assert.deepEqual(getMapLevelRange(4), [29, 37]);
    assert.deepEqual(getMapLevelRange(8), [53, 64]);
    assert.equal(maxLevelForMap(0), 5);
    assert.equal(maxLevelForMap(8), 64);
  });

  it("clamps out-of-range map indices to the last band", () => {
    assert.deepEqual(getMapLevelRange(99), [53, 64]);
    assert.equal(maxLevelForMap(99), 64);
  });
});

describe("catchBucketIdsForMap", () => {
  it("returns a non-empty deduplicated bucket for every map", () => {
    for (let m = 0; m <= 8; m++) {
      const ids = catchBucketIdsForMap(m);
      assert.ok(ids.length > 0, `bucket for map ${m} should not be empty`);
      assert.equal(new Set(ids).size, ids.length, `bucket for map ${m} should be unique`);
    }
  });

  it("excludes legendaries from every bucket", () => {
    for (let m = 0; m <= 8; m++) {
      const ids = catchBucketIdsForMap(m);
      for (const id of ids) {
        assert.ok(!LEGENDARY_IDS.has(id), `map ${m} bucket should not contain legendary id ${id}`);
      }
    }
  });

  it("scales average BST up from early to late game (buckets overlap, so check endpoints)", () => {
    // Adjacent maps intentionally share buckets (MAP_BST_RANGES 2 & 3 both
    // read from GEN1_BST_APPROX.mid), so strict monotonicity doesn't hold.
    // What must hold: map 0 (starter) << map 8 (Elite 4).
    const early = avgBstCatchPool(0);
    const late = avgBstCatchPool(8);
    assert.ok(late > early + 100, `late-game avg BST (${late}) should dwarf map-0 (${early})`);
    // And map 4+ (BST band starts at 400) must average higher than map 0.
    assert.ok(avgBstCatchPool(4) > early + 50);
  });
});
