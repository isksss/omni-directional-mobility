import test from "node:test";
import assert from "node:assert/strict";
import { getEnemyGait, updateEnemy, updateEnemyAI } from "./enemies.ts";

test("enemy gait swings the arms opposite the legs and bends the stepping knee", () => {
  assert.deepEqual(getEnemyGait(Math.PI / 2), { leg: 0.48, knee: 0.65, arm: -0.32 });
  assert.deepEqual(getEnemyGait((Math.PI * 3) / 2), { leg: -0.48, knee: 0, arm: 0.32 });
});

test("enemies can turn at intersections and continue along the crossing road", () => {
  const enemy = { axis: "x", lane: 0, along: 46, direction: 1, speed: 4 };
  const values = [0, 0];

  updateEnemy(enemy, 1, () => values.shift());

  assert.deepEqual(enemy, { axis: "z", lane: 48, along: 46, direction: -1, speed: 4 });
});

test("enemies turn around at the edge of the district", () => {
  const enemy = { axis: "x", lane: 0, along: 190, direction: 1, speed: 4 };

  updateEnemy(enemy, 1, () => 1);

  assert.equal(enemy.along, 190);
  assert.equal(enemy.direction, -1);
});

test("enemies acquire a visible player and fire with a cooldown", () => {
  const enemy = { axis: "x", lane: 0, along: 0, direction: 1 };
  const player = { x: 12, y: 0, z: 0 };

  assert.deepEqual(
    updateEnemyAI(enemy, 0.2, player, [], () => 0),
    { hit: true },
  );
  assert.equal(enemy.canSeePlayer, true);
  assert.equal(enemy.aiming, true);
  assert.equal(
    updateEnemyAI(enemy, 0.2, player, [], () => 0),
    null,
  );
});

test("buildings block enemy detection and attacks", () => {
  const enemy = { axis: "x", lane: 0, along: 0, direction: 1 };
  const player = { x: 15, y: 0, z: 0 };
  const buildings = [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }];

  assert.equal(
    updateEnemyAI(enemy, 0.2, player, buildings, () => 0),
    null,
  );
  assert.equal(enemy.canSeePlayer, false);
});

test("enemies can see and shoot through an open entrance", () => {
  const enemy = { axis: "z", lane: 8, along: -10, direction: 1 };
  const player = { x: 8, y: 0, z: 0 };
  const buildings = [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }];

  assert.deepEqual(
    updateEnemyAI(enemy, 0.2, player, buildings, () => 0),
    { hit: true },
  );
});
