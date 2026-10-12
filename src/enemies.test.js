import test from "node:test";
import assert from "node:assert/strict";
import { updateEnemy } from "./enemies.js";

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
