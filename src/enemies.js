const ROAD_SPACING = 48;
const ROAD_LIMIT = 192;
const TURN_CHANCE = 0.32;
const EPSILON = 1e-9;

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
