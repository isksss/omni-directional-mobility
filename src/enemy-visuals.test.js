import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createEnemy, updateEnemyHealthBar } from "./enemy-visuals.js";

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
  assert.equal(enemy.healthBar.parent, scene);
  enemy.health = 25;
  updateEnemyHealthBar(enemy);
  assert.equal(enemy.healthFill.scale.x, 0.25);
  assert.equal(enemy.healthFill.position.x, -0.39);
});
