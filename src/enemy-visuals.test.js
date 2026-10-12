import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createEnemy, syncEnemy, updateEnemyHealthBar } from "./enemy-visuals.ts";

test("enemy visuals expose a health gauge that follows its hit points", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const enemy = createEnemy(
    scene,
    camera,
    () => 0.5,
    (min, max) => (min + max) / 2,
  );

  assert.equal(enemy.group.userData.enemy, enemy);
  assert.equal(
    enemy.group.getObjectByName("enemy-rifle")?.getObjectByName("enemy-scope")?.visible,
    true,
  );
  enemy.aiming = true;
  syncEnemy(enemy, new THREE.PerspectiveCamera(), 1 / 60);
  assert.ok(enemy.aimBlend > 0 && enemy.aimBlend < 1);
  syncEnemy(enemy, new THREE.PerspectiveCamera(), 1);
  assert.ok(Math.abs(enemy.head.rotation.x - 0.18) < 0.001);
  assert.ok(enemy.arms[0].rotation.x > 1.4);
  assert.equal(enemy.arms[0].rotation.z, 0.45);
  assert.ok(Math.abs(enemy.elbows[0].rotation.x - 0.35) < 0.001);
  assert.equal(enemy.healthBar.parent, scene);
  enemy.health = 25;
  updateEnemyHealthBar(enemy);
  assert.equal(enemy.healthFill.scale.x, 0.25);
  assert.equal(enemy.healthFill.position.x, -0.39);
});
