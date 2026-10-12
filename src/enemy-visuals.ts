import * as THREE from "three";
import { CITY_ROADS, getRoadLength, getRoadPosition, terrainHeight } from "./city-layout.ts";
import type { RandomSource } from "./game-types.ts";
import { getEnemyGait, smoothHeading } from "./enemies.ts";

export interface EnemyActor {
  roadId: string;
  roadDistance: number;
  roadDirection: 1 | -1;
  navX: number;
  navZ: number;
  speed: number;
  moveSpeed: number;
  walkPhase: number;
  idlePhase: number;
  walking: boolean;
  heading: number;
  targetHeading: number;
  aimBlend: number;
  aimPitch: number;
  searchTimer: number;
  lastSeenX: number;
  lastSeenZ: number;
  hasLastSeen: boolean;
  lookYaw: number;
  health: number;
  maxHealth: number;
  attackTimer: number;
  aiTimer: number;
  canSeePlayer: boolean;
  aiming: boolean;
  alerted: boolean;
  arms: THREE.Group[];
  elbows: THREE.Group[];
  legs: THREE.Group[];
  knees: THREE.Group[];
  body: THREE.Mesh;
  pelvis: THREE.Mesh;
  head: THREE.Group;
  rifle: THREE.Group;
  group: THREE.Group;
  healthBar: THREE.Group;
  healthFill: THREE.Mesh;
  healthFillMaterial: THREE.MeshBasicMaterial;
  shotLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  shotTimer: number;
}

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
const rifleMaterial = new THREE.MeshStandardMaterial({
  color: "#161c20",
  metalness: 0.72,
  roughness: 0.34,
});
const scopeMaterial = new THREE.MeshStandardMaterial({
  color: "#242b30",
  metalness: 0.68,
  roughness: 0.3,
});
const bootGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.32);
const chestPlateGeometry = new THREE.BoxGeometry(0.45, 0.31, 0.12);
const chestLightGeometry = new THREE.BoxGeometry(0.24, 0.035, 0.025);
const rifleReceiverGeometry = new THREE.BoxGeometry(0.18, 0.15, 0.58);
const rifleStockGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.3);
const rifleBarrelGeometry = new THREE.CylinderGeometry(0.035, 0.045, 0.48, 6);
const scopeGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.19, 6);
const rifleGripGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.12);
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

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

export function createEnemy(
  scene: THREE.Scene,
  camera: THREE.Camera,
  random: RandomSource,
  rand: (min: number, max: number) => number,
): EnemyActor {
  const group = new THREE.Group();
  const body = addMesh(group, bodyGeometry, suitMaterial, [0, 1.12, 0]);
  const pelvis = addMesh(group, pelvisGeometry, suitMaterial, [0, 0.77, 0]);
  addMesh(group, chestPlateGeometry, armorMaterial, [0, 1.23, -0.2]);
  addMesh(group, chestLightGeometry, detailMaterial, [0, 1.2, -0.27]);
  addMesh(group, neckGeometry, jointMaterial, [0, 1.51, 0]);
  const head = new THREE.Group();
  head.position.set(0, 1.69, 0);
  addMesh(head, helmetGeometry, armorMaterial, [0, 0, 0]);
  addMesh(head, visorGeometry, visorMaterial, [0, 0, -0.2]);
  group.add(head);

  const rifle = new THREE.Group();
  rifle.name = "enemy-rifle";
  rifle.position.set(0, 1.35, -0.27);
  addMesh(rifle, rifleReceiverGeometry, rifleMaterial, [0, 0, -0.16]);
  addMesh(rifle, rifleStockGeometry, rifleMaterial, [0, 0.01, 0.23]);
  const barrel = addMesh(rifle, rifleBarrelGeometry, rifleMaterial, [0, 0, -0.65]);
  barrel.rotation.x = -Math.PI / 2;
  const scope = addMesh(rifle, scopeGeometry, scopeMaterial, [0, 0.12, -0.19]);
  scope.name = "enemy-scope";
  addMesh(rifle, rifleGripGeometry, rifleMaterial, [0, -0.14, -0.12]);
  group.add(rifle);

  const arms: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
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
    elbows.push(elbow);
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

  const patrolRoads = CITY_ROADS.filter((road) => road.kind !== "pedestrian");
  const road = patrolRoads[Math.floor(random() * patrolRoads.length)]!;
  const roadDirection: 1 | -1 = random() < 0.5 ? 1 : -1;
  const roadDistance = rand(0, getRoadLength(road.id));
  const location = getRoadPosition(road.id, roadDistance, roadDirection);
  const heading = location.heading;
  const enemy = {
    roadId: road.id,
    roadDistance,
    roadDirection,
    navX: location.x,
    navZ: location.z,
    speed: rand(1.4, 2.6),
    moveSpeed: 0,
    walkPhase: rand(0, Math.PI * 2),
    idlePhase: rand(0, Math.PI * 2),
    walking: false,
    heading,
    targetHeading: heading,
    aimBlend: 0,
    aimPitch: 0,
    searchTimer: 0,
    lastSeenX: 0,
    lastSeenZ: 0,
    hasLastSeen: false,
    lookYaw: 0,
    health: 100,
    maxHealth: 100,
    attackTimer: random(),
    aiTimer: 0,
    canSeePlayer: false,
    aiming: false,
    alerted: false,
    body,
    pelvis,
    head,
    rifle,
    arms,
    elbows,
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

export function syncEnemy(enemy: EnemyActor, camera: THREE.Camera, dt = 1 / 60): void {
  const groundY = terrainHeight(enemy.navX, enemy.navZ);
  enemy.group.position.set(enemy.navX, groundY, enemy.navZ);
  enemy.targetHeading = Number.isFinite(enemy.targetHeading) ? enemy.targetHeading : enemy.heading;
  enemy.heading = smoothHeading(enemy.heading, enemy.targetHeading, dt, enemy.walking ? 7 : 10);
  enemy.group.rotation.y = enemy.heading;
  enemy.aimBlend = THREE.MathUtils.damp(enemy.aimBlend, enemy.aiming ? 1 : 0, 8, dt);
  enemy.body.rotation.x = enemy.aimBlend * 0.035;
  enemy.rifle.rotation.x = enemy.aimPitch * enemy.aimBlend;
  enemy.body.rotation.z = enemy.walking
    ? Math.cos(enemy.walkPhase) * 0.025
    : Math.sin(enemy.idlePhase) * 0.008;
  enemy.pelvis.rotation.z = enemy.walking ? Math.sin(enemy.walkPhase) * 0.035 : 0;
  for (let i = 0; i < 2; i++) {
    const gait = getEnemyGait(enemy.walkPhase + i * Math.PI);
    enemy.legs[i].rotation.x = gait.leg;
    enemy.knees[i].rotation.x = gait.knee;
    const walkBlend = enemy.walking ? 1 : 0;
    enemy.arms[i].rotation.x = 1.2 + enemy.aimBlend * 0.3 + gait.arm * (0.04 + walkBlend * 0.22);
    enemy.arms[i].rotation.z = i === 0 ? 0.45 : -0.45;
    enemy.elbows[i].rotation.x = 0.48 - enemy.aimBlend * 0.13;
  }
  const searchLook = enemy.alerted
    ? Math.sin(enemy.idlePhase * 1.1) * 0.38
    : Math.sin(enemy.idlePhase * 0.65) * 0.24;
  const desiredLookYaw = enemy.canSeePlayer
    ? THREE.MathUtils.clamp(enemy.lookYaw, -0.24, 0.24)
    : THREE.MathUtils.clamp(enemy.lookYaw + searchLook, -0.9, 0.9);
  enemy.head.rotation.x = enemy.aimBlend * 0.18 + Math.sin(enemy.idlePhase) * 0.008;
  enemy.head.rotation.y = THREE.MathUtils.damp(enemy.head.rotation.y, desiredLookYaw, 5.5, dt);
  enemy.group.position.y =
    groundY +
    (enemy.walking
      ? Math.abs(Math.sin(enemy.walkPhase * 2)) * 0.045
      : Math.sin(enemy.idlePhase) * 0.008);
  enemy.group.updateMatrixWorld(true);
  enemy.healthBar.position.set(
    enemy.group.position.x,
    enemy.group.position.y + 2.25,
    enemy.group.position.z,
  );
  enemy.healthBar.quaternion.copy(camera.quaternion);
  enemy.healthBar.visible = camera.position.distanceTo(enemy.group.position) < 90;
}

export function removeEnemy(scene: THREE.Scene, enemy: EnemyActor): void {
  scene.remove(enemy.group, enemy.healthBar, enemy.shotLine);
  enemy.shotLine.geometry.dispose();
  enemy.shotLine.material.dispose();
  enemy.healthFillMaterial.dispose();
}

export function updateEnemyHealthBar(enemy: EnemyActor): void {
  const ratio = enemy.health / enemy.maxHealth;
  enemy.healthFill.scale.x = ratio;
  enemy.healthFill.position.x = -0.52 * (1 - ratio);
  enemy.healthFillMaterial.color.set(
    ratio > 0.55 ? "#8affb1" : ratio > 0.25 ? "#ffd16a" : "#ff625f",
  );
}
