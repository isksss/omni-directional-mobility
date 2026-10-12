import { Vector3 } from "three";
import { blocksBuildingSight, resolveBuildingCollision } from "./city.ts";
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
const collisionPrevious = new Vector3();
const collisionCandidate = new Vector3();
const collisionVelocity = new Vector3();
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

export function moveEnemyToward(
  enemy: EnemyActor,
  targetX: number,
  targetZ: number,
  dt: number,
  stoppingDistance: number,
  buildings: BuildingBounds[],
): boolean {
  const x = enemy.navX;
  const z = enemy.navZ;
  const dx = targetX - x;
  const dz = targetZ - z;
  const distance = Math.hypot(dx, dz);
  if (distance > 0) enemy.targetHeading = Math.atan2(-dx, -dz);
  if (distance <= stoppingDistance) return false;
  const step = Math.min(distance - stoppingDistance, enemy.moveSpeed * dt);
  const nextX = x + (dx / distance) * step;
  const nextZ = z + (dz / distance) * step;
  collisionPrevious.set(x, terrainHeight(x, z), z);
  collisionCandidate.set(nextX, terrainHeight(nextX, nextZ), nextZ);
  collisionVelocity.subVectors(collisionCandidate, collisionPrevious);
  resolveBuildingCollision(
    collisionCandidate,
    collisionPrevious,
    collisionVelocity,
    buildings,
    collisionPrevious.y,
  );
  const moved = collisionCandidate.x !== x || collisionCandidate.z !== z;
  enemy.navX = collisionCandidate.x;
  enemy.navZ = collisionCandidate.z;
  return moved;
}

export function updateEnemy(
  enemy: EnemyActor,
  dt: number,
  random: RandomSource = Math.random,
  buildings: BuildingBounds[] = [],
): boolean {
  const roadPosition = getRoadPosition(enemy.roadId, enemy.roadDistance, enemy.roadDirection);
  if (Math.hypot(enemy.navX - roadPosition.x, enemy.navZ - roadPosition.z) > EPSILON) {
    // shortcut: return directly and stop at walls; add pathfinding when detours are needed.
    return moveEnemyToward(enemy, roadPosition.x, roadPosition.z, dt, 0, buildings);
  }
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
