import {
  CITY_ROADS,
  connectedRoads,
  getRoadLength,
  getRoadPosition,
  nearestRoadPosition,
  terrainHeight,
} from "./city-layout.ts";
import type { BuildingBounds, Position3, RandomSource } from "./game-types.ts";
import type { EnemyActor } from "./enemy-visuals.ts";

const EPSILON = 1e-9;
const ENEMY_VISION_RANGE = 78;
const ENEMY_FIRE_RANGE = 46;
export const ENEMY_DAMAGE = 10;

export function smoothHeading(current: number, target: number, dt: number, rate = 8): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-rate * dt));
}

export function getEnemyGait(phase: number) {
  const stride = Math.sin(phase);
  return { leg: stride * 0.48, knee: Math.max(0, stride) * 0.65, arm: -stride * 0.32 };
}

function alignEnemyToNearestRoad(enemy: EnemyActor): void {
  const nearest = nearestRoadPosition(enemy.navX, enemy.navZ);
  const difference = Math.atan2(
    Math.sin(enemy.heading - nearest.heading),
    Math.cos(enemy.heading - nearest.heading),
  );
  enemy.roadId = nearest.roadId;
  enemy.roadDirection = Math.abs(difference) <= Math.PI / 2 ? 1 : -1;
  enemy.roadDistance =
    enemy.roadDirection > 0 ? nearest.distance : getRoadLength(nearest.roadId) - nearest.distance;
}

export function updateEnemyAI(
  enemy: EnemyActor,
  dt: number,
  player: Position3,
  buildings: BuildingBounds[],
  random: RandomSource = Math.random,
): { hit: boolean } | null {
  enemy.aiTimer -= dt;
  enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
  if (enemy.aiTimer > 0) return null;
  enemy.aiTimer = 0.18;

  const previousSight = enemy.canSeePlayer;
  const previousSearch = enemy.searchTimer;
  const x = enemy.navX;
  const z = enemy.navZ;
  const groundY = terrainHeight(x, z);
  const dx = player.x - x;
  const dy = player.y + 1.62 - (groundY + 1.3);
  const dz = player.z - z;
  const distance = Math.hypot(dx, dy, dz);
  const horizontalDistance = Math.hypot(dx, dz);
  const facingX = -Math.sin(enemy.heading);
  const facingZ = -Math.cos(enemy.heading);
  const facingDot = horizontalDistance ? (dx * facingX + dz * facingZ) / horizontalDistance : 1;
  const canSee =
    distance <= ENEMY_VISION_RANGE &&
    facingDot > (enemy.alerted ? -0.55 : -0.3) &&
    !buildings.some((building) =>
      blocksBuildingSight(x, groundY + 1.3, z, player.x, player.y + 1.62, player.z, building),
    );

  enemy.canSeePlayer = canSee;
  if (canSee) {
    enemy.targetHeading = Math.atan2(-dx, -dz);
    enemy.aimPitch = Math.atan2(dy, horizontalDistance);
    enemy.lastSeenX = player.x;
    enemy.lastSeenZ = player.z;
    enemy.hasLastSeen = true;
    enemy.searchTimer = 5;
    enemy.lookYaw = Math.atan2(
      Math.sin(enemy.targetHeading - enemy.heading),
      Math.cos(enemy.targetHeading - enemy.heading),
    );
  } else {
    enemy.searchTimer = Math.max(0, enemy.searchTimer - 0.18);
    if (enemy.hasLastSeen && enemy.searchTimer > 0) {
      const bearing = Math.atan2(-(enemy.lastSeenX - x), -(enemy.lastSeenZ - z));
      enemy.lookYaw = Math.atan2(
        Math.sin(bearing - enemy.heading),
        Math.cos(bearing - enemy.heading),
      );
    } else {
      enemy.lookYaw = 0;
    }
  }
  enemy.aiming = canSee && distance <= ENEMY_FIRE_RANGE;
  enemy.alerted = canSee || enemy.searchTimer > 0;

  if ((!canSee && previousSight) || (!canSee && previousSearch > 0 && enemy.searchTimer === 0)) {
    alignEnemyToNearestRoad(enemy);
  }
  if (!canSee || distance > ENEMY_FIRE_RANGE || enemy.attackTimer > 0 || enemy.aimBlend < 0.8)
    return null;

  enemy.attackTimer = 1.15 + random() * 0.35;
  return { hit: random() < Math.max(0.2, 0.82 - distance / 75) };
}

function blocksBuildingSight(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  building: BuildingBounds,
): boolean {
  const baseY = building.baseY ?? 0;
  const min = [building.x - building.width / 2, baseY, building.z - building.depth / 2];
  const max = [
    building.x + building.width / 2,
    baseY + building.height,
    building.z + building.depth / 2,
  ];
  const start = [x1, y1, z1];
  const delta = [x2 - x1, y2 - y1, z2 - z1];
  let enter = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]!) < EPSILON) {
      if (start[axis]! < min[axis]! || start[axis]! > max[axis]!) return false;
      continue;
    }
    let first = (min[axis]! - start[axis]!) / delta[axis]!;
    let last = (max[axis]! - start[axis]!) / delta[axis]!;
    if (first > last) [first, last] = [last, first];
    enter = Math.max(enter, first);
    exit = Math.min(exit, last);
    if (enter > exit) return false;
  }
  if (exit < 0 || enter > 1) return false;

  const isDoor = (t: number) => {
    const px = x1 + delta[0]! * t;
    const py = y1 + delta[1]! * t;
    const pz = z1 + delta[2]! * t;
    return (
      Math.abs(pz - min[2]!) < 0.35 &&
      Math.abs(px - building.x) < (building.entranceWidth ?? 2.8) / 2 &&
      py < baseY + (building.entranceHeight ?? 2.7)
    );
  };
  const startsInside =
    x1 > min[0]! && x1 < max[0]! && y1 > min[1]! && y1 < max[1]! && z1 > min[2]! && z1 < max[2]!;
  const endsInside =
    x2 > min[0]! && x2 < max[0]! && y2 > min[1]! && y2 < max[1]! && z2 > min[2]! && z2 < max[2]!;
  if (!startsInside && enter >= 0 && enter <= 1 && !isDoor(enter)) return true;
  if (!endsInside && exit >= 0 && exit <= 1 && exit - enter > EPSILON && !isDoor(exit)) return true;
  return false;
}

export function updateEnemy(
  enemy: EnemyActor,
  dt: number,
  random: RandomSource = Math.random,
): boolean {
  let remaining = enemy.moveSpeed * dt;
  let moved = false;
  while (remaining > EPSILON) {
    const length = getRoadLength(enemy.roadId);
    const available = length - enemy.roadDistance;
    const step = Math.min(remaining, Math.max(0, available));
    enemy.roadDistance += step;
    remaining -= step;
    moved ||= step > EPSILON;

    if (step + EPSILON < available) break;
    const road = CITY_ROADS.find((candidate) => candidate.id === enemy.roadId)!;
    const node = enemy.roadDirection > 0 ? road.to : road.from;
    const nextRoads = connectedRoads(node, enemy.roadId);
    if (!nextRoads.length) {
      enemy.roadDirection = enemy.roadDirection === 1 ? -1 : 1;
      enemy.roadDistance = 0;
      continue;
    }
    const nextRoad = nextRoads[Math.floor(random() * nextRoads.length)]!;
    enemy.roadId = nextRoad.id;
    enemy.roadDirection = nextRoad.from === node ? 1 : -1;
    enemy.roadDistance = 0;
  }
  const position = getRoadPosition(enemy.roadId, enemy.roadDistance, enemy.roadDirection);
  enemy.navX = position.x;
  enemy.navZ = position.z;
  enemy.targetHeading = position.heading;
  return moved;
}
