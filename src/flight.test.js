import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { constrainRope } from "./flight.ts";

test("a slack tether does not change position or velocity", () => {
  const position = new Vector3(3, 4, 0);
  const velocity = new Vector3(1, 2, 0);

  assert.equal(constrainRope(position, velocity, new Vector3(), 6), false);
  assert.deepEqual(position.toArray(), [3, 4, 0]);
  assert.deepEqual(velocity.toArray(), [1, 2, 0]);
});

test("a taut tether caps rope length and removes only outward velocity", () => {
  const position = new Vector3(12, 0, 0);
  const velocity = new Vector3(3, 4, 0);

  assert.equal(constrainRope(position, velocity, new Vector3(), 10), true);
  assert.deepEqual(position.toArray(), [10, 0, 0]);
  assert.deepEqual(velocity.toArray(), [0, 4, 0]);
});
