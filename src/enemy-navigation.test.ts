import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Scene } from "three";
import { getRoadPosition } from "./city-layout.ts";
import { createEnemy } from "./enemy-visuals.ts";
import { moveEnemyToward, updateEnemy, updateEnemyAI } from "./enemies.ts";

function searchingEnemy() {
  const enemy = createEnemy(
    new Scene(),
    new PerspectiveCamera(),
    () => 0.5,
    (min, max) => (min + max) / 2,
  );
  Object.assign(enemy, {
    roadId: "dogen-lower",
    roadDistance: 0,
    roadDirection: 1,
    navX: 0,
    navZ: 35,
    moveSpeed: 2,
    searchTimer: 0.18,
    hasLastSeen: true,
    alerted: true,
  });
  return enemy;
}

test("enemies walk back to their road after searching instead of teleporting", () => {
  const enemy = searchingEnemy();
  updateEnemyAI(enemy, 1 / 60, { x: 200, y: 0, z: 200 }, [], () => 0);
  assert.equal(enemy.searchTimer, 0);
  const roadDistance = enemy.roadDistance;
  const before = { x: enemy.navX, z: enemy.navZ };
  assert.equal(
    updateEnemy(enemy, 1 / 60, () => 0),
    true,
  );
  const step = Math.hypot(enemy.navX - before.x, enemy.navZ - before.z);
  assert.ok(step > 0 && step <= enemy.moveSpeed / 60 + 1e-9);
  assert.equal(enemy.roadDistance, roadDistance);
});

test("returning enemies reach the road and resume patrol within the movement budget", () => {
  const enemy = searchingEnemy();
  updateEnemyAI(enemy, 0.1, { x: 200, y: 0, z: 200 }, [], () => 0);
  const initialRoadId = enemy.roadId;
  const initialRoadDistance = enemy.roadDistance;
  for (let i = 0; i < 150; i++) {
    const x = enemy.navX;
    const z = enemy.navZ;
    updateEnemy(enemy, 0.1, () => 0);
    assert.ok(Math.hypot(enemy.navX - x, enemy.navZ - z) <= enemy.moveSpeed * 0.1 + 1e-9);
  }
  const roadPosition = getRoadPosition(enemy.roadId, enemy.roadDistance, enemy.roadDirection);
  assert.ok(Math.hypot(enemy.navX - roadPosition.x, enemy.navZ - roadPosition.z) < 1e-9);
  assert.ok(enemy.roadId !== initialRoadId || enemy.roadDistance > initialRoadDistance);
});

test("returning enemies still collide with walls rather than crossing them", () => {
  const enemy = searchingEnemy();
  enemy.navZ = 10;
  const wall = { x: 0, z: 5, width: 6, depth: 2, height: 20, entranceWidth: 0, entranceHeight: 0 };
  for (let i = 0; i < 30; i++) updateEnemy(enemy, 0.1, () => 0, [wall]);
  assert.ok(enemy.navZ >= 6.48 - 1e-9 && enemy.navZ < 10);
  assert.equal(enemy.roadDistance, 0);
});

test("shared pursuit movement preserves entrances, wall collisions and stopping distance", () => {
  const enemy = searchingEnemy();
  enemy.navZ = -6;
  const building = {
    x: 0,
    z: 0,
    width: 10,
    depth: 10,
    height: 12,
    entranceWidth: 2.8,
    entranceHeight: 2.7,
  };
  assert.equal(moveEnemyToward(enemy, 0, 0, 1, 4.5, [building]), true);
  assert.equal(enemy.navZ, -4.5);
  assert.equal(moveEnemyToward(enemy, 0, 0, 1, 4.5, [building]), false);
  enemy.navZ = -6;
  moveEnemyToward(enemy, 0, 0, 1, 0, [{ ...building, entranceWidth: 0, entranceHeight: 0 }]);
  assert.ok(enemy.navZ <= -5.48 + 1e-9);
});
