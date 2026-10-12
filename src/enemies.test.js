import test from "node:test";
import assert from "node:assert/strict";
import { CITY_ROADS, getRoadLength, getRoadPosition } from "./city-layout.ts";
import { getEnemyGait, smoothHeading, updateEnemy, updateEnemyAI } from "./enemies.ts";

function makeEnemy(overrides = {}) {
  const enemy = {
    roadId: "dogen-lower",
    roadDistance: 0,
    roadDirection: 1,
    navX: 0,
    navZ: 0,
    speed: 2,
    moveSpeed: 2,
    heading: -Math.PI / 2,
    targetHeading: -Math.PI / 2,
    aimBlend: 0.9,
    aimPitch: 0,
    canSeePlayer: false,
    aiming: false,
    alerted: false,
    searchTimer: 0,
    lastSeenX: 0,
    lastSeenZ: 0,
    hasLastSeen: false,
    lookYaw: 0,
    attackTimer: 0,
    aiTimer: 0,
    ...overrides,
  };
  const location = getRoadPosition(enemy.roadId, enemy.roadDistance, enemy.roadDirection);
  enemy.navX = overrides.navX ?? location.x;
  enemy.navZ = overrides.navZ ?? location.z;
  return enemy;
}

test("enemy heading turns along the short arc and settles smoothly", () => {
  const halfway = smoothHeading(Math.PI - 0.1, -Math.PI + 0.1, 0.1, 10);
  assert.ok(halfway > Math.PI);
  assert.ok(Math.abs(smoothHeading(0, Math.PI / 2, 1, 10) - Math.PI / 2) < 0.001);
});

test("enemy gait swings the arms opposite the legs and bends the stepping knee", () => {
  assert.deepEqual(getEnemyGait(Math.PI / 2), { leg: 0.48, knee: 0.65, arm: -0.32 });
  assert.deepEqual(getEnemyGait((Math.PI * 3) / 2), { leg: -0.48, knee: 0, arm: 0.32 });
});

test("patrolling enemies follow curved roads and choose a connected branch", () => {
  const road = CITY_ROADS.find((candidate) => candidate.id === "dogen-lower");
  assert.ok(road);
  const length = getRoadLength(road.id);
  const enemy = makeEnemy({ roadDistance: length - 1, moveSpeed: 4 });

  assert.equal(
    updateEnemy(enemy, 1, () => 0),
    true,
  );
  assert.equal(enemy.roadId, "dogen-middle");
  assert.equal(enemy.roadDirection, 1);
  assert.ok(enemy.roadDistance > 0);
  const expected = getRoadPosition(enemy.roadId, enemy.roadDistance, enemy.roadDirection);
  assert.ok(Math.hypot(enemy.navX - expected.x, enemy.navZ - expected.z) < 0.001);

  const reverseBranch = makeEnemy({ roadDistance: length - 1, moveSpeed: 4 });
  updateEnemy(reverseBranch, 1, () => 0.99);
  assert.equal(reverseBranch.roadId, "hachiko-dogen-alley");
  assert.equal(reverseBranch.roadDirection, -1);
  assert.ok(Math.abs(reverseBranch.roadDistance - 3) < 0.1);
  const reverseExpected = getRoadPosition(
    reverseBranch.roadId,
    reverseBranch.roadDistance,
    reverseBranch.roadDirection,
  );
  assert.ok(
    Math.hypot(reverseBranch.navX - reverseExpected.x, reverseBranch.navZ - reverseExpected.z) <
      0.001,
  );
});

test("patrolling enemies turn around at dead-end streets", () => {
  const road = CITY_ROADS.find((candidate) => candidate.id === "dogen-upper");
  assert.ok(road);
  const length = getRoadLength(road.id);
  const enemy = makeEnemy({ roadId: road.id, roadDistance: length - 1, moveSpeed: 4 });

  updateEnemy(enemy, 1, () => 0);

  assert.equal(enemy.roadId, road.id);
  assert.equal(enemy.roadDirection, -1);
  assert.ok(Math.abs(enemy.roadDistance - 3) < 0.1);
});

test("enemies finish raising the rifle before firing", () => {
  const enemy = makeEnemy({ aimBlend: 0 });
  const player = { x: 12, y: 0, z: 0 };

  assert.equal(
    updateEnemyAI(enemy, 0.2, player, [], () => 0),
    null,
  );
  assert.equal(enemy.aiming, true);
  assert.ok(Math.abs(enemy.targetHeading + Math.PI / 2) < 0.001);
  enemy.aimBlend = 0.9;
  enemy.aiTimer = 0;
  assert.deepEqual(
    updateEnemyAI(enemy, 0.2, player, [], () => 0),
    { hit: true },
  );
});

test("enemies investigate a last seen position and return to roads after searching", () => {
  const enemy = makeEnemy();
  const player = { x: 12, y: 0, z: 0 };
  updateEnemyAI(enemy, 0.2, player, [], () => 0);
  assert.equal(enemy.canSeePlayer, true);
  assert.equal(enemy.hasLastSeen, true);
  assert.equal(enemy.searchTimer, 5);

  enemy.navX = 4;
  enemy.navZ = 0;
  enemy.heading = -Math.PI / 2;
  enemy.canSeePlayer = true;
  enemy.aiTimer = 0;
  updateEnemyAI(enemy, 0.2, player, [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }], () => 0);
  assert.equal(enemy.canSeePlayer, false);
  assert.equal(enemy.alerted, true);
  assert.ok(CITY_ROADS.some((road) => road.id === enemy.roadId));

  enemy.navX = 7;
  enemy.navZ = 2;
  enemy.searchTimer = 0.18;
  enemy.aiTimer = 0;
  updateEnemyAI(enemy, 0.2, player, [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }], () => 0);
  assert.equal(enemy.alerted, false);
  assert.ok(CITY_ROADS.some((road) => road.id === enemy.roadId));
});

test("buildings block enemy detection and attacks", () => {
  const enemy = makeEnemy();
  const player = { x: 15, y: 0, z: 0 };
  const buildings = [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }];

  assert.equal(
    updateEnemyAI(enemy, 0.2, player, buildings, () => 0),
    null,
  );
  assert.equal(enemy.canSeePlayer, false);
});

test("enemies can see through an open entrance", () => {
  const enemy = makeEnemy({ navX: 8, navZ: -10, heading: Math.PI, targetHeading: Math.PI });
  const player = { x: 8, y: 0, z: 0 };
  const buildings = [{ x: 8, z: 0, width: 5, depth: 8, height: 20 }];

  assert.equal(updateEnemyAI(enemy, 0.2, player, buildings, () => 0)?.hit, true);
});
