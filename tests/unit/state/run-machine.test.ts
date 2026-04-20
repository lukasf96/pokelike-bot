import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RunMachine } from "../../../src/state/run-machine.ts";
import type { GameSnapshot, Phase, Pokemon, Tick } from "../../../src/state/types.ts";

let tickCounter = 0;

function makeGame(over: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    team: [],
    bag: [],
    currentMap: 0,
    eliteIndex: 0,
    badges: 0,
    ...over,
  };
}

function makeTick(phase: Phase, over: Partial<Tick> = {}): Tick {
  tickCounter += 1;
  return {
    tickId: tickCounter,
    observedAt: Date.now(),
    phase,
    game: over.game ?? null,
    ui: over.ui ?? {},
    ...over,
  };
}

function makePokemon(over: Partial<Pokemon> & Pick<Pokemon, "speciesId">): Pokemon {
  return {
    name: "Test",
    level: 10,
    types: ["Normal"],
    hp: { current: 30, max: 30 },
    isShiny: false,
    moveTier: 1,
    heldItemId: null,
    ...over,
  };
}

describe("RunMachine", () => {
  it("emits run-started on the first tick and a phase-changed from unknown", () => {
    const rm = new RunMachine();
    const events = rm.step(makeTick({ kind: "title" }));
    const kinds = events.map((e) => e.type);
    assert.ok(kinds.includes("run-started"));
    const pc = events.find((e) => e.type === "phase-changed");
    assert.ok(
      pc && pc.type === "phase-changed" && pc.from.kind === "unknown" && pc.to.kind === "title",
    );
    assert.equal(rm.runNumber, 1);
  });

  it("emits phase-changed only when the phase kind actually changes", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }));
    const second = rm.step(makeTick({ kind: "map" }));
    assert.equal(
      second.filter((e) => e.type === "phase-changed").length,
      0,
      "same kind twice → no phase-changed",
    );
    assert.equal(rm.turnNumber, 2);
  });

  it("emits run-ended=won when the phase becomes 'win'", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }, { game: makeGame({ badges: 8 }) }));
    const events = rm.step(makeTick({ kind: "win" }));
    const ended = events.find((e) => e.type === "run-ended");
    assert.ok(ended && ended.type === "run-ended");
    assert.equal(ended.outcome, "won");
    assert.equal(ended.runNumber, 1);
  });

  it("emits run-ended=lost when the battle phase reports isDefeat", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }));
    const events = rm.step(
      makeTick(
        { kind: "battle" },
        {
          ui: {
            battle: {
              isDefeat: true,
              skipVisible: false,
              continueVisible: false,
              title: "Brock",
              subtitle: "Level 14",
            },
          },
          game: makeGame(),
        },
      ),
    );
    const ended = events.find((e) => e.type === "run-ended");
    assert.ok(ended && ended.type === "run-ended" && ended.outcome === "lost");
  });

  it("emits run-ended=lost as a fallback when phase drops back to title from in-run", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }, { game: makeGame() }));
    const events = rm.step(makeTick({ kind: "title" }));
    const ended = events.find((e) => e.type === "run-ended");
    assert.ok(ended && ended.type === "run-ended" && ended.outcome === "lost");
  });

  it("emits a second run-started (run++) when entering in-run again after a loss", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }, { game: makeGame() }));
    rm.step(makeTick({ kind: "title" })); // run-ended=lost
    const events = rm.step(makeTick({ kind: "map" }, { game: makeGame({ currentMap: 0 }) }));

    const started = events.filter((e) => e.type === "run-started");
    assert.equal(started.length, 1);
    assert.equal(rm.runNumber, 2);
    assert.equal(rm.turnNumber, 1);
  });

  it("emits run-ended exactly once per run", () => {
    const rm = new RunMachine();
    rm.step(makeTick({ kind: "map" }, { game: makeGame() }));
    rm.step(makeTick({ kind: "win" })); // ended
    const again = rm.step(makeTick({ kind: "win" })); // stay ended
    assert.equal(again.filter((e) => e.type === "run-ended").length, 0);
  });

  it("preserves the last team snapshot across a mid-battle wipe", () => {
    const rm = new RunMachine();
    const gameWithTeam = makeGame({
      team: [makePokemon({ speciesId: 1, level: 10, types: ["Grass"] })],
    });
    rm.step(makeTick({ kind: "map" }, { game: gameWithTeam }));
    rm.step(makeTick({ kind: "battle" }, { game: makeGame({ currentMap: 0, team: [] }) }));
    assert.equal(
      rm.lastGame!.team.length,
      1,
      "lastGame should retain the old team for defeat logging",
    );
  });
});
