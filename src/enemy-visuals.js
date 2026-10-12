import * as THREE from "three";
import { getEnemyGait } from "./enemies.js";

const bodyGeometry = new THREE.CylinderGeometry(0.22, 0.29, 0.64, 6);
const pelvisGeometry = new THREE.BoxGeometry(0.4, 0.24, 0.28);
const helmetGeometry = new THREE.DodecahedronGeometry(0.22, 0);
const neckGeometry = new THREE.CylinderGeometry(0.09, 0.11, 0.14, 6);
const visorGeometry = new THREE.BoxGeometry(0.31, 0.085, 0.045);
const upperArmGeometry = new THREE.CylinderGeometry(0.085, 0.12, 0.36, 6);
const lowerArmGeometry = new THREE.CylinderGeometry(0.075, 0.1, 0.31, 6);
const upperLegGeometry = new THREE.CylinderGeometry(0.13, 0.16, 0.4, 6);
const lowerLegGeometry = new THREE.CylinderGeometry(0.1, 0.13, 0.36, 6);
const jointGeometry = new THREE.SphereGeometry(0.11, 6, 5);
const armorMaterial = new THREE.MeshStandardMaterial({
  color: "#344352",
  metalness: 0.58,
  roughness: 0.42,
});
const suitMaterial = new THREE.MeshStandardMaterial({ color: "#202833", roughness: 0.78 });
const detailMaterial = new THREE.MeshStandardMaterial({
  color: "#ed684e",
  emissive: "#9f261c",
  emissiveIntensity: 0.8,
  metalness: 0.3,
  roughness: 0.48,
});
const visorMaterial = new THREE.MeshStandardMaterial({
  color: "#72efff",
  emissive: "#22cce8",
  emissiveIntensity: 2,
  metalness: 0.35,
  roughness: 0.25,
});
const jointMaterial = new THREE.MeshStandardMaterial({
  color: "#131a22",
  metalness: 0.65,
  roughness: 0.38,
});
const bootGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.32);
const chestPlateGeometry = new THREE.BoxGeometry(0.45, 0.31, 0.12);
const chestLightGeometry = new THREE.BoxGeometry(0.24, 0.035, 0.025);
const healthTrackGeometry = new THREE.PlaneGeometry(1.2, 0.13);
const healthFillGeometry = new THREE.PlaneGeometry(1.04, 0.075);
const healthTrackMaterial = new THREE.MeshBasicMaterial({
  color: "#10151b",
  transparent: true,
  opacity: 0.88,
  side: THREE.DoubleSide,
});
const shotGeometry = new THREE.BufferGeometry();
shotGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));

function addMesh(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

export function createEnemy(scene, camera, random, rand) {
  const group = new THREE.Group();
  addMesh(group, bodyGeometry, suitMaterial, [0, 1.12, 0]);
  addMesh(group, pelvisGeometry, suitMaterial, [0, 0.77, 0]);
  addMesh(group, chestPlateGeometry, armorMaterial, [0, 1.23, -0.2]);
  addMesh(group, chestLightGeometry, detailMaterial, [0, 1.2, -0.27]);
  addMesh(group, neckGeometry, jointMaterial, [0, 1.51, 0]);
  addMesh(group, helmetGeometry, armorMaterial, [0, 1.69, 0]);
  addMesh(group, visorGeometry, visorMaterial, [0, 1.69, -0.2]);

  const arms = [];
  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.4, 0);
    group.add(arm);
    addMesh(arm, jointGeometry, armorMaterial, [0, -0.04, 0], [1.35, 1.1, 1.3]);
    addMesh(arm, upperArmGeometry, suitMaterial, [0, -0.19, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    arm.add(elbow);
    addMesh(elbow, jointGeometry, jointMaterial, [0, 0, 0]);
    addMesh(elbow, lowerArmGeometry, armorMaterial, [0, -0.15, 0]);
    addMesh(elbow, jointGeometry, suitMaterial, [0, -0.31, -0.015], [0.78, 0.8, 0.82]);
    arms.push(arm);

    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.78, 0);
    group.add(leg);
    addMesh(leg, upperLegGeometry, suitMaterial, [0, -0.2, 0]);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    leg.add(knee);
    addMesh(knee, jointGeometry, armorMaterial, [0, 0, 0], [1.15, 0.95, 1.1]);
    addMesh(knee, lowerLegGeometry, armorMaterial, [0, -0.18, 0]);
    addMesh(knee, bootGeometry, jointMaterial, [0, -0.37, -0.06]);
    legs.push(leg);
    knees.push(knee);
  }

  const healthBar = new THREE.Group();
  const track = new THREE.Mesh(healthTrackGeometry, healthTrackMaterial);
  track.position.z = -0.01;
  healthBar.add(track);
  const healthFillMaterial = new THREE.MeshBasicMaterial({
    color: "#8affb1",
    side: THREE.DoubleSide,
  });
  const healthFill = new THREE.Mesh(healthFillGeometry, healthFillMaterial);
  healthFill.position.z = 0.01;
  healthBar.add(healthFill);
  scene.add(healthBar);

  const shotLine = new THREE.Line(
    shotGeometry.clone(),
    new THREE.LineBasicMaterial({ color: "#ff665c", transparent: true, opacity: 0.92 }),
  );
  shotLine.visible = false;
  shotLine.frustumCulled = false;
  scene.add(shotLine);

  const enemy = {
    axis: random() < 0.5 ? "x" : "z",
    lane: (Math.floor(random() * 9) - 4) * 48,
    along: rand(-192, 192),
    direction: random() < 0.5 ? -1 : 1,
    speed: rand(1.4, 2.6),
    walkPhase: rand(0, Math.PI * 2),
    health: 100,
    maxHealth: 100,
    attackTimer: random(),
    alertTimer: 0,
    arms,
    legs,
    knees,
    group,
    healthBar,
    healthFill,
    healthFillMaterial,
    shotLine,
    shotTimer: 0,
  };
  group.userData.enemy = enemy;
  updateEnemyHealthBar(enemy);
  syncEnemy(enemy, camera);
  scene.add(group);
  return enemy;
}

export function syncEnemy(enemy, camera) {
  enemy.group.position.set(
    enemy.axis === "x" ? enemy.along : enemy.lane,
    Math.abs(Math.sin(enemy.walkPhase * 2)) * 0.025,
    enemy.axis === "x" ? enemy.lane : enemy.along,
  );
  enemy.group.rotation.y =
    enemy.axis === "x"
      ? enemy.direction > 0
        ? -Math.PI / 2
        : Math.PI / 2
      : enemy.direction > 0
        ? Math.PI
        : 0;
  for (let i = 0; i < 2; i++) {
    const gait = getEnemyGait(enemy.walkPhase + i * Math.PI);
    enemy.legs[i].rotation.x = gait.leg;
    enemy.knees[i].rotation.x = gait.knee;
    enemy.arms[i].rotation.x = gait.arm;
  }
  enemy.group.updateMatrixWorld(true);
  enemy.healthBar.position.set(
    enemy.group.position.x,
    enemy.group.position.y + 2.25,
    enemy.group.position.z,
  );
  enemy.healthBar.quaternion.copy(camera.quaternion);
  enemy.healthBar.visible = camera.position.distanceTo(enemy.group.position) < 90;
}

export function updateEnemyHealthBar(enemy) {
  const ratio = enemy.health / enemy.maxHealth;
  enemy.healthFill.scale.x = ratio;
  enemy.healthFill.position.x = -0.52 * (1 - ratio);
  enemy.healthFillMaterial.color.set(
    ratio > 0.55 ? "#8affb1" : ratio > 0.25 ? "#ffd16a" : "#ff625f",
  );
}
