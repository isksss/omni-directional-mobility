import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { blocksBuildingSight, isGrounded, resolveBuildingCollision } from "./city.ts";
import { terrainHeight } from "./city-layout.ts";
import type { BuildingBounds } from "./game-types.ts";

const building: BuildingBounds = {
  x: 0,
  z: 0,
  width: 10,
  depth: 10,
  height: 12,
  entranceWidth: 2.8,
  entranceHeight: 2.7,
};

test("shared sight checks block roofs and walls but preserve open entrances and interiors", () => {
  assert.equal(blocksBuildingSight(0, 22, 0, 0, 1.69, 0, building), true);
  assert.equal(blocksBuildingSight(-10, 1.62, 0, 0, 1.62, 0, building), true);
  assert.equal(blocksBuildingSight(0, 1.62, -10, 0, 1.62, 0, building), false);
  assert.equal(blocksBuildingSight(0, 3, -10, 0, 3, 0, building), true);
  assert.equal(blocksBuildingSight(0, 1.62, 0, 0, 1.62, 10, building), true);
  assert.equal(blocksBuildingSight(-1, 1.62, 0, 1, 1.62, 0, building), false);
  assert.equal(blocksBuildingSight(-10, 20, 0, 10, 20, 0, building), false);
});

test("vehicles block shots below their roof without creating a doorway", () => {
  const vehicle: BuildingBounds = {
    x: 0,
    z: 0,
    width: 4.2,
    depth: 1.9,
    height: 1.4,
    entranceWidth: 0,
    entranceHeight: 0,
  };
  assert.equal(blocksBuildingSight(-4, 1.1, 0, 4, 1.1, 0, vehicle), true);
  assert.equal(blocksBuildingSight(0, 1.1, -4, 0, 1.1, 4, vehicle), true);
  assert.equal(blocksBuildingSight(-4, 1.6, 0, 4, 1.6, 0, vehicle), false);
  assert.equal(isGrounded({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 0, z: 0 }, [vehicle]), true);
});

test("hillside entrances use their own ground elevation for collision and sight", () => {
  const hillside: BuildingBounds = {
    ...building,
    x: 10.707667737769075,
    z: -130.9517992872279,
    width: 12,
    depth: 14.163787649944407,
    height: 30,
    baseY: 7.663791702044607,
  };
  const front = hillside.z - hillside.depth / 2;
  const entranceBaseY = terrainHeight(hillside.x, front);
  hillside.entranceBaseY = entranceBaseY;
  const previous = new Vector3(hillside.x, terrainHeight(hillside.x, front - 0.2), front - 0.2);
  const position = new Vector3(hillside.x, terrainHeight(hillside.x, front + 0.2), front + 0.2);
  const velocity = new Vector3(0, 0, 2);
  assert.ok(position.y - hillside.baseY! > 0.8);
  resolveBuildingCollision(position, previous, velocity, [hillside], previous.y);
  assert.equal(position.z, front + 0.2);
  assert.equal(velocity.z, 2);

  const exited = previous.clone();
  resolveBuildingCollision(exited, position, new Vector3(0, 0, -2), [hillside], position.y);
  assert.equal(exited.z, front - 0.2);
  for (const [offset, blocked] of [
    [2.5, false],
    [2.8, true],
    [-0.1, true],
  ] as const) {
    assert.equal(
      blocksBuildingSight(
        hillside.x,
        entranceBaseY + offset,
        front - 1,
        hillside.x,
        entranceBaseY + offset,
        front + 1,
        hillside,
      ),
      blocked,
    );
  }
});

test("roof landings are grounded while jumping, being inside and leaving the roof are not", () => {
  const elevated = { ...building, baseY: 8 };
  const previous = new Vector3(0, 20.4, 0);
  const position = new Vector3(0, 19.8, 0);
  const velocity = new Vector3(0, -4, 0);
  resolveBuildingCollision(position, previous, velocity, [elevated], previous.y);
  assert.equal(position.y, 20);
  assert.equal(isGrounded(position, velocity, [elevated]), true);
  velocity.y = 9.2;
  assert.equal(isGrounded(position, velocity, [elevated]), false);
  velocity.y = 0;
  assert.equal(isGrounded({ x: 0, y: 20.1, z: 0 }, velocity, [elevated]), false);
  assert.equal(isGrounded({ x: 0, y: 8, z: 0 }, velocity, [elevated]), false);
  assert.equal(isGrounded({ x: 5.1, y: 20, z: 0 }, velocity, [elevated]), false);
  assert.equal(isGrounded({ x: 0, y: 0, z: 0 }, velocity, []), true);
});
