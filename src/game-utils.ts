import type { RandomSource } from "./game-types.ts";

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function randomBetween(random: RandomSource, min: number, max: number): number {
  return min + random() * (max - min);
}
