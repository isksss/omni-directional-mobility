import test from "node:test";
import assert from "node:assert/strict";
import {
  CITY_ROADS,
  cityRoadsAreConnected,
  getRoadLength,
  getRoadPosition,
  getRoadSamples,
  nearestRoadPosition,
  terrainHeight,
} from "./city-layout.ts";

test("Shibuya road graph is connected and not limited to orthogonal grid roads", () => {
  assert.equal(cityRoadsAreConnected(), true);
  assert.ok(CITY_ROADS.some((road) => road.name === "道玄坂"));
  assert.ok(CITY_ROADS.some((road) => road.name === "宮益坂"));
  assert.ok(CITY_ROADS.some((road) => road.kind === "alley"));
  assert.ok(CITY_ROADS.some((road) => road.points.some((point) => point.x !== 0 && point.z !== 0)));
});

test("hill roads climb away from the scramble crossing", () => {
  const crossing = terrainHeight(0, 0);
  const dogenzaka = terrainHeight(-210, -70);
  const miyamasuzaka = terrainHeight(215, 126);
  assert.equal(crossing, 0);
  assert.ok(dogenzaka > crossing + 10);
  assert.ok(miyamasuzaka > crossing + 8);
  assert.ok(Math.abs(terrainHeight(1, 0) - crossing) < 0.2);
});

test("road positions can be followed from either end and projected back to the network", () => {
  const road = CITY_ROADS.find((candidate) => candidate.id === "dogen-lower");
  assert.ok(road);
  const length = getRoadLength(road.id);
  const fromStart = getRoadPosition(road.id, 0, 1);
  const fromEnd = getRoadPosition(road.id, 0, -1);
  assert.ok(Math.hypot(fromStart.x, fromStart.z) < 0.01);
  assert.ok(Math.hypot(fromEnd.x + 36, fromEnd.z + 8) < 0.1);
  const samples = getRoadSamples(road.id);
  const middle = samples[Math.floor(samples.length / 2)]!;
  const nearest = nearestRoadPosition(middle.x, middle.z);
  assert.equal(nearest.roadId, road.id);
  assert.ok(nearest.distanceToRoad < 0.01);
  assert.ok(length > 30);
});
