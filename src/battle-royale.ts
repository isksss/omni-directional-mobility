import type { Position3 } from "./game-types.ts";

export const ZONE_START_DELAY = 20;
export const ZONE_SHRINK_DURATION = 180;
export const ZONE_START_RADIUS = 285;
export const ZONE_FINAL_RADIUS = 18;
export const ZONE_DAMAGE_PER_SECOND = 10;

export type RoundOutcome = "won" | "lost" | null;

export function getSafeZoneRadius(elapsed: number): number {
  const progress = Math.max(0, Math.min(1, (elapsed - ZONE_START_DELAY) / ZONE_SHRINK_DURATION));
  return ZONE_START_RADIUS + (ZONE_FINAL_RADIUS - ZONE_START_RADIUS) * progress;
}

export function isOutsideSafeZone(position: Position3, radius: number): boolean {
  return Math.hypot(position.x, position.z) > radius;
}

export function getZoneTimeRemaining(elapsed: number): number {
  return Math.max(0, ZONE_START_DELAY + ZONE_SHRINK_DURATION - elapsed);
}

export function formatZoneTimeRemaining(elapsed: number): string {
  const totalSeconds = Math.ceil(getZoneTimeRemaining(elapsed));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getRoundOutcome(playerHealth: number, enemiesAlive: number): RoundOutcome {
  if (playerHealth <= 0) return "lost";
  if (enemiesAlive === 0) return "won";
  return null;
}
