import test from "node:test";
import assert from "node:assert/strict";
import {
  formatZoneTimeRemaining,
  getRoundOutcome,
  getSafeZoneRadius,
  isOutsideSafeZone,
  ZONE_FINAL_RADIUS,
  ZONE_START_RADIUS,
} from "./battle-royale.ts";
import { createSeededRandom } from "./game-utils.ts";
import { updateLoot, type LootPickup } from "./loot.ts";
import { addAmmo, consumeRound, createWeapons, reloadWeapon } from "./weapons.ts";

test("safe zone waits, shrinks monotonically and stops at its final radius", () => {
  assert.equal(getSafeZoneRadius(0), ZONE_START_RADIUS);
  assert.equal(getSafeZoneRadius(20), ZONE_START_RADIUS);
  assert.equal(getSafeZoneRadius(110), 151.5);
  assert.equal(getSafeZoneRadius(300), ZONE_FINAL_RADIUS);
  assert.equal(formatZoneTimeRemaining(0), "00:20");
  assert.equal(formatZoneTimeRemaining(19.99), "00:01");
  assert.equal(formatZoneTimeRemaining(20), "03:00");
  assert.equal(formatZoneTimeRemaining(110), "01:30");
  assert.equal(formatZoneTimeRemaining(200), "00:00");
  assert.equal(formatZoneTimeRemaining(201), "00:00");
});

test("safe-zone membership and battle outcome handle boundary states", () => {
  assert.equal(isOutsideSafeZone({ x: 3, y: 10, z: 4 }, 5), false);
  assert.equal(isOutsideSafeZone({ x: 3, y: 0, z: 4.1 }, 5), true);
  assert.equal(getRoundOutcome(100, 1), null);
  assert.equal(getRoundOutcome(0, 1), "lost");
  assert.equal(getRoundOutcome(100, 0), "won");
});

test("weapons consume finite magazines, reload from reserve and cap collected ammo", () => {
  const [sniper] = createWeapons();
  assert.equal(sniper.magazine, sniper.magazineSize);
  assert.equal(consumeRound(sniper), true);
  assert.equal(sniper.magazine, 5);
  sniper.magazine = 0;
  assert.equal(consumeRound(sniper), false);
  assert.equal(reloadWeapon(sniper), 6);
  assert.equal(sniper.magazine, 6);
  assert.equal(sniper.reserve, 6);
  assert.equal(addAmmo(sniper, 100), 30);
  assert.equal(sniper.reserve, sniper.maxReserve);
  assert.equal(addAmmo(sniper), 0);
});

test("nearby loot is collected once, while rejected pickups remain", () => {
  const makePickup = (x: number): LootPickup => ({
    kind: "medkit",
    amount: 40,
    phase: 0,
    collected: false,
    group: {
      position: { x, y: 0, z: 0 },
      rotation: { y: 0 },
      visible: true,
    } as LootPickup["group"],
  });
  const nearby = makePickup(0);
  const distant = makePickup(10);
  const pickups = [nearby, distant];
  const collected = updateLoot(pickups, { x: 2, y: 0, z: 0 }, 1, () => true);
  assert.deepEqual(collected, [nearby]);
  assert.equal(nearby.group.visible, false);
  assert.equal(distant.collected, false);
  assert.deepEqual(
    updateLoot(pickups, { x: 2, y: 0, z: 0 }, 2, () => false),
    [],
  );
  assert.equal(distant.collected, false);
});

test("seeded randomness repeats the same sequence", () => {
  const first = createSeededRandom(741);
  const second = createSeededRandom(741);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});
