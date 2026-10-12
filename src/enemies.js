const ROAD_SPACING = 48;
const ROAD_LIMIT = 192;
const TURN_CHANCE = 0.32;
const EPSILON = 1e-9;
const ENEMY_VISION_RANGE = 78;
const ENEMY_FIRE_RANGE = 46;

export function getEnemyGait(phase) {
  const stride = Math.sin(phase);
  return { leg: stride * 0.48, knee: Math.max(0, stride) * 0.65, arm: -stride * 0.32 };
}

export function updateEnemyAI(enemy, dt, player, buildings, random = Math.random) {
  enemy.aiTimer = (enemy.aiTimer ?? 0) - dt;
  enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);
  if (enemy.aiTimer > 0) return null;
  enemy.aiTimer = 0.18;

  const x = enemy.axis === "x" ? enemy.along : enemy.lane;
  const z = enemy.axis === "x" ? enemy.lane : enemy.along;
  const dx = player.x - x;
  const dy = player.y + 1.62 - 1.3;
  const dz = player.z - z;
  const distance = Math.hypot(dx, dy, dz);
  const horizontalDistance = Math.hypot(dx, dz);
  const facingX = enemy.axis === "x" ? enemy.direction : 0;
  const facingZ = enemy.axis === "z" ? enemy.direction : 0;
  const facingDot = horizontalDistance ? (dx * facingX + dz * facingZ) / horizontalDistance : 1;
  const canSee =
    distance <= ENEMY_VISION_RANGE &&
    facingDot > -0.2 &&
    !buildings.some((building) =>
      blocksBuildingSight(x, 1.3, z, player.x, player.y + 1.62, player.z, building),
    );

  enemy.canSeePlayer = canSee;
  enemy.alerted = canSee || (enemy.alertTimer ?? 0) > 0;
  enemy.alertTimer = canSee ? 4 : Math.max(0, (enemy.alertTimer ?? 0) - 0.18);
  if (!canSee || distance > ENEMY_FIRE_RANGE || enemy.attackTimer > 0) return null;

  enemy.attackTimer = 1.15 + random() * 0.35;
  return { hit: random() < Math.max(0.2, 0.82 - distance / 75) };
}

function blocksBuildingSight(x1, y1, z1, x2, y2, z2, building) {
  const min = [building.x - building.width / 2, 0, building.z - building.depth / 2];
  const max = [building.x + building.width / 2, building.height, building.z + building.depth / 2];
  const start = [x1, y1, z1];
  const delta = [x2 - x1, y2 - y1, z2 - z1];
  let enter = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]) < EPSILON) {
      if (start[axis] < min[axis] || start[axis] > max[axis]) return false;
      continue;
    }
    let first = (min[axis] - start[axis]) / delta[axis];
    let last = (max[axis] - start[axis]) / delta[axis];
    if (first > last) [first, last] = [last, first];
    enter = Math.max(enter, first);
    exit = Math.min(exit, last);
    if (enter > exit) return false;
  }
  if (exit < 0 || enter > 1) return false;

  const isDoor = (t) => {
    const px = x1 + delta[0] * t;
    const py = y1 + delta[1] * t;
    const pz = z1 + delta[2] * t;
    return (
      Math.abs(pz - min[2]) < 0.35 &&
      Math.abs(px - building.x) < (building.entranceWidth ?? 2.8) / 2 &&
      py < (building.entranceHeight ?? 2.7)
    );
  };
  const startsInside =
    x1 > min[0] && x1 < max[0] && y1 > min[1] && y1 < max[1] && z1 > min[2] && z1 < max[2];
  const endsInside =
    x2 > min[0] && x2 < max[0] && y2 > min[1] && y2 < max[1] && z2 > min[2] && z2 < max[2];
  if (!startsInside && enter >= 0 && enter <= 1 && !isDoor(enter)) return true;
  if (!endsInside && exit >= 0 && exit <= 1 && exit - enter > EPSILON && !isDoor(exit)) return true;
  return false;
}

export function updateEnemy(enemy, dt, random = Math.random) {
  let remaining = enemy.speed * dt;
  while (remaining > EPSILON) {
    const boundary = enemy.direction > 0 ? ROAD_LIMIT : -ROAD_LIMIT;
    const intersection =
      enemy.direction > 0
        ? Math.min(boundary, (Math.floor(enemy.along / ROAD_SPACING) + 1) * ROAD_SPACING)
        : Math.max(boundary, (Math.ceil(enemy.along / ROAD_SPACING) - 1) * ROAD_SPACING);
    const distance = Math.abs(intersection - enemy.along);
    const step = Math.min(remaining, distance);
    enemy.along += enemy.direction * step;
    remaining -= step;

    if (step + EPSILON < distance) continue;
    if (Math.abs(enemy.along) >= ROAD_LIMIT - EPSILON) {
      enemy.direction *= -1;
    } else if (random() < TURN_CHANCE) {
      enemy.axis = enemy.axis === "x" ? "z" : "x";
      enemy.lane = enemy.along;
      enemy.direction = random() < 0.5 ? -1 : 1;
    }
  }
}
