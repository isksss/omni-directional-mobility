import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCity, resolveBuildingCollision } from "./city.ts";

const building = {
  x: 0,
  z: 0,
  width: 10,
  depth: 10,
  height: 12,
  entranceWidth: 2.8,
  entranceHeight: 2.7,
};

function move(previous, position, velocity = { x: 0, y: 0, z: 0 }, previousY = 0) {
  resolveBuildingCollision(position, previous, velocity, [building], previousY);
  return { position, velocity };
}

test("ground-floor entrance allows the player to enter and leave through the doorway", () => {
  const entered = move({ x: 0, y: 0, z: -5.2 }, { x: 0, y: 0, z: -4.8 });
  assert.equal(entered.position.z, -4.8);

  const exited = move({ x: 0, y: 0, z: -4.8 }, { x: 0, y: 0, z: -5.2 });
  assert.equal(exited.position.z, -5.2);
});

test("solid walls reject entry away from the doorway", () => {
  const result = move({ x: 3, y: 0, z: -5.2 }, { x: 3, y: 0, z: -4.8 });
  assert.equal(result.position.z, -5.2);
  assert.deepEqual(result.velocity, { x: 0, y: 0, z: 0 });
});

test("descending onto a building roof stops at the roof height", () => {
  const result = move(
    { x: 0, y: 12.4, z: 0 },
    { x: 0, y: 11.8, z: 0 },
    { x: 1, y: -4, z: 0 },
    12.4,
  );
  assert.equal(result.position.y, 12);
  assert.equal(result.velocity.y, 0);
});

test("city generation creates enterable buildings and leaves the scramble crossing open", () => {
  const oldDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        fillText() {},
      }),
    }),
  };
  let seed = 741;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  try {
    const { buildings, facadeMeshes } = createCity(new THREE.Scene(), random);
    assert.ok(buildings.length > 180);
    assert.ok(buildings.every((item) => item.entranceWidth > 0 && item.entranceHeight > 0));
    assert.ok(buildings.every((item) => !(Math.abs(item.x) < 24 && Math.abs(item.z) < 24)));
    assert.ok(facadeMeshes.length > 0);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
