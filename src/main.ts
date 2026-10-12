import * as THREE from "three";
import { blocksBuildingSight, createCity, isGrounded, resolveBuildingCollision } from "./city.ts";
import { terrainHeight } from "./city-layout.ts";
import { createEnemy, removeEnemy, syncEnemy, updateEnemyHealthBar } from "./enemy-visuals.ts";
import { constrainRope } from "./flight.ts";
import { ENEMY_DAMAGE, moveEnemyToward, updateEnemy, updateEnemyAI } from "./enemies.ts";
import {
  formatZoneTimeRemaining,
  getRoundOutcome,
  getSafeZoneRadius,
  isOutsideSafeZone,
  ZONE_DAMAGE_PER_SECOND,
  ZONE_START_DELAY,
  ZONE_START_RADIUS,
} from "./battle-royale.ts";
import { createSeededRandom, randomBetween } from "./game-utils.ts";
import { getElement } from "./dom.ts";
import { createLoot, updateLoot, type LootPickup } from "./loot.ts";
import { addAmmo, consumeRound, createWeapons, reloadWeapon } from "./weapons.ts";
import { clearPendingBinding, getVerticalSensitivity, keyBindings } from "./settings.ts";
import type { EnemyActor } from "./enemy-visuals.ts";
import "./style.css";

const canvas = getElement<HTMLCanvasElement>("#game");
const startScreen = getElement<HTMLElement>("#start-screen");
const pauseScreen = getElement<HTMLElement>("#pause-screen");
const hud = getElement<HTMLElement>("#hud");
const pauseError = getElement<HTMLElement>("#pause-error");
const notice = getElement<HTMLElement>("#notice");
const reticle = getElement<HTMLElement>("#reticle");
const hookStatus = getElement<HTMLElement>("#hook-status");
const enemyCountValue = getElement<HTMLElement>("#enemy-count");
const killCountValue = getElement<HTMLElement>("#kill-count");
const speedValue = getElement<HTMLElement>("#speed-value");
const altitudeValue = getElement<HTMLElement>("#altitude-value");
const playerHealthValue = getElement<HTMLElement>("#player-health-value");
const playerHealthBar = getElement<HTMLElement>("#player-health-bar");
const damageOverlay = getElement<HTMLElement>("#damage-overlay");
const weaponName = getElement<HTMLElement>("#weapon-name");
const ammoMagazineValue = getElement<HTMLElement>("#ammo-magazine");
const ammoReserveValue = getElement<HTMLElement>("#ammo-reserve");
const zoneStatus = getElement<HTMLElement>("#zone-status");
const gameOverScreen = getElement<HTMLElement>("#game-over-screen");
const gameOverTitle = getElement<HTMLElement>("#game-over-title");
const gameOverMessage = getElement<HTMLElement>("#game-over-message");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#9aaab0");
scene.fog = new THREE.FogExp2("#9aaab0", 0.0018);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight("#e0e9e9", "#4c4a43", 2.15));
scene.add(new THREE.AmbientLight("#d0d0c8", 0.55));
const sunlight = new THREE.DirectionalLight("#fff0d9", 3.1);
sunlight.position.set(-90, 130, -40);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.bias = -0.00035;
sunlight.shadow.normalBias = 0.025;
sunlight.shadow.autoUpdate = false;
const sunlightShadowCamera = sunlight.shadow.camera as THREE.OrthographicCamera;
sunlightShadowCamera.left = -245;
sunlightShadowCamera.right = 245;
sunlightShadowCamera.top = 245;
sunlightShadowCamera.bottom = -245;
sunlightShadowCamera.near = 1;
sunlightShadowCamera.far = 360;
sunlightShadowCamera.updateProjectionMatrix();
scene.add(sunlight);
const skylineGlow = new THREE.PointLight("#f0b58e", 7, 230, 2);
skylineGlow.position.set(0, 32, -118);
scene.add(skylineGlow);

const random = createSeededRandom(741);
const rand = (min: number, max: number) => randomBetween(random, min, max);
const citySize = 460;
const city = createCity(scene, random);
sunlight.shadow.needsUpdate = true;
const { buildings, facadeMeshes, obstacles } = city;
const worldBlockers = [...buildings, ...obstacles];
const loot = createLoot(scene, random);
const enemies: EnemyActor[] = [];
for (let i = 0; i < 20; i++) enemies.push(createEnemy(scene, camera, random, rand));
const enemyGroups = enemies.map((enemy) => enemy.group);

const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  health: 100,
  maxHealth: 100,
};
const previousPosition = new THREE.Vector3();
const EYE_HEIGHT = 1.62;
const MAX_HOOK_DISTANCE = 120;
const MAX_ALTITUDE = 145;
const WEAPONS = createWeapons();
let weaponIndex = 0;
let nextShotAt = 0;
let firing = false;
const tethers: ({ position: THREE.Vector3; distance: number } | null)[] = [null, null];
const ropeLengths = [0, 0];
let currentTarget: { position: THREE.Vector3; distance: number } | null = null;
const wallTargetCameraPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
const wallTargetCameraQuaternion = new THREE.Quaternion();
let scoped = false;
let kills = 0;
let roundElapsed = 0;
let zoneDamageTimer = 1;
let wasOutsideZone = false;
let roundFinished = false;
let hasStarted = false;
const keys = new Set<string>();
const raycaster = new THREE.Raycaster();
raycaster.far = MAX_HOOK_DISTANCE;
const screenCenter = new THREE.Vector2(0, 0);
const ropeStart = new THREE.Vector3();
const tetherConstraintAnchor = new THREE.Vector3();
const towardAnchor = new THREE.Vector3();
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const cableLines: THREE.Line[] = [];
for (let i = 0; i < 2; i++) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const material = new THREE.LineBasicMaterial({
    color: "#98efff",
    transparent: true,
    opacity: 0.8,
  });
  const line = new THREE.Line(geometry, material);
  line.visible = false;
  line.frustumCulled = false;
  scene.add(line);
  cableLines.push(line);
}
const zoneRing = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 128 }, (_, index) => {
      const angle = (index / 128) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      return new THREE.Vector3(
        x,
        terrainHeight(x * ZONE_START_RADIUS, z * ZONE_START_RADIUS) + 0.055,
        z,
      );
    }),
  ),
  new THREE.LineBasicMaterial({ color: "#64d7ff", transparent: true, opacity: 0.8 }),
);
zoneRing.scale.set(ZONE_START_RADIUS, 1, ZONE_START_RADIUS);
const zoneRingPositions = zoneRing.geometry.attributes.position as THREE.BufferAttribute;
zoneRing.frustumCulled = false;
scene.add(zoneRing);

updateWeaponHud();
updatePlayerHealth();

function setGameUi() {
  const locked = document.pointerLockElement === canvas;
  startScreen.hidden = hasStarted || roundFinished;
  pauseScreen.hidden = !hasStarted || locked || roundFinished;
  hud.hidden = !locked || roundFinished;
}

function requestLock() {
  try {
    const result = canvas.requestPointerLock();
    if (result?.catch)
      result.catch(() =>
        showLockError(
          "マウスロックを開始できませんでした。HTTPS または localhost で開いてください。",
        ),
      );
  } catch {
    showLockError("このブラウザではマウスロックを利用できません。");
  }
}

function showLockError(message: string): void {
  pauseError.textContent = message;
  pauseError.hidden = false;
}

let noticeTimer: number;
let damageFlashTimer = 0;
function showNotice(message: string): void {
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice.classList.remove("visible"), 1700);
}

function updatePlayerHealth(): void {
  playerHealthValue.textContent = String(Math.ceil(player.health));
  playerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
  playerHealthBar.classList.toggle("low", player.health <= 30);
}

function updateWeaponHud(): void {
  const weapon = WEAPONS[weaponIndex];
  weaponName.textContent = weapon.name;
  ammoMagazineValue.textContent = String(weapon.magazine);
  ammoReserveValue.textContent = String(weapon.reserve);
}

function finishRound(outcome: "won" | "lost"): void {
  if (roundFinished) return;
  roundFinished = true;
  gameOverTitle.textContent = outcome === "won" ? "生還成功！" : "撃破されました";
  gameOverMessage.textContent =
    outcome === "won"
      ? `敵を全員撃破しました。${kills} KILLS`
      : `敵に倒されました。${kills} KILLS — 次の出撃でリベンジしよう。`;
  gameOverScreen.hidden = false;
  setGameUi();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function damagePlayer(damage: number, flash = true): void {
  if (roundFinished) return;
  player.health = Math.max(0, player.health - damage);
  updatePlayerHealth();
  if (flash && damageFlashTimer <= 0) {
    damageOverlay.classList.remove("active");
    void damageOverlay.offsetWidth;
    damageOverlay.classList.add("active");
    damageFlashTimer = 0.24;
  }
  if (player.health <= 0) finishRound("lost");
}

function showEnemyShot(enemy: EnemyActor, hit: boolean): void {
  const positions = enemy.shotLine.geometry.attributes.position;
  positions.setXYZ(0, enemy.group.position.x, enemy.group.position.y + 1.3, enemy.group.position.z);
  positions.setXYZ(1, player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
  positions.needsUpdate = true;
  enemy.shotLine.geometry.computeBoundingSphere();
  enemy.shotLine.material.color.set(hit ? "#ff625f" : "#ffc46b");
  enemy.shotLine.visible = true;
  enemy.shotTimer = 0.12;
}

function aimAtWall(): { position: THREE.Vector3; distance: number } | null {
  if (
    wallTargetCameraPosition.equals(camera.position) &&
    wallTargetCameraQuaternion.equals(camera.quaternion)
  )
    return currentTarget;
  raycaster.far = MAX_HOOK_DISTANCE;
  raycaster.setFromCamera(screenCenter, camera);
  const hit = raycaster.intersectObjects(facadeMeshes, false)[0];
  wallTargetCameraPosition.copy(camera.position);
  wallTargetCameraQuaternion.copy(camera.quaternion);
  currentTarget = hit ? { position: hit.point.clone(), distance: hit.distance } : null;
  return currentTarget;
}

function aimAtEnemy(
  maxDistance = WEAPONS[weaponIndex].range,
): { enemy: EnemyActor; position: THREE.Vector3 } | null {
  raycaster.far = maxDistance;
  raycaster.setFromCamera(screenCenter, camera);
  const hit = raycaster.intersectObjects(enemyGroups, true)[0];
  raycaster.far = MAX_HOOK_DISTANCE;
  if (!hit) return null;
  let target: THREE.Object3D | null = hit.object;
  while (target && !target.userData.enemy) target = target.parent;
  return target ? { enemy: target.userData.enemy as EnemyActor, position: hit.point } : null;
}

function beginTether(index: number): void {
  if (tethers[index]) {
    tethers[index] = null;
    showNotice(`${index ? "右" : "左"}フックを解除`);
    return;
  }
  updateCamera(0);
  currentTarget = aimAtWall();
  if (!currentTarget) {
    showNotice("建物の壁に照準を合わせてください");
    return;
  }
  tethers[index] = currentTarget;
  ropeLengths[index] = Math.max(7, camera.position.distanceTo(currentTarget.position));
  showNotice(`${index ? "右" : "左"}フック接続 — Space で巻き取り`);
}

function removeEnemyFromRound(enemy: EnemyActor, playerKill = false): void {
  const index = enemies.indexOf(enemy);
  if (index < 0) return;
  enemies.splice(index, 1);
  enemyGroups.splice(index, 1);
  removeEnemy(scene, enemy);
  if (playerKill) {
    kills++;
    killCountValue.textContent = String(kills);
  }
  enemyCountValue.textContent = String(enemies.length);
}

function fireGun(now = performance.now()): void {
  if (roundFinished) return;
  const weapon = WEAPONS[weaponIndex];
  if (now < nextShotAt) return;
  if (!consumeRound(weapon)) {
    if (!weapon.emptyNoticeShown) showNotice("弾切れ — リロードしてください");
    weapon.emptyNoticeShown = true;
    updateWeaponHud();
    return;
  }
  weapon.emptyNoticeShown = false;
  nextShotAt = now + weapon.fireInterval;
  updateWeaponHud();
  updateCamera(0);
  const hit = aimAtEnemy(weapon.range);
  if (!hit) return;
  if (
    worldBlockers.some((building) =>
      blocksBuildingSight(
        camera.position.x,
        camera.position.y,
        camera.position.z,
        hit.position.x,
        hit.position.y,
        hit.position.z,
        building,
      ),
    )
  ) {
    showNotice("遮蔽物に遮られています");
    return;
  }
  const enemy = hit.enemy;
  enemy.health = Math.max(0, enemy.health - weapon.damage);
  updateEnemyHealthBar(enemy);
  if (enemy.health > 0) {
    showNotice(`敵に命中 — 残り HP ${enemy.health}`);
    return;
  }
  removeEnemyFromRound(enemy, true);
  showNotice(`敵を撃破 — ${kills} KILLS`);
  if (enemies.length === 0) finishRound("won");
}

function switchWeapon(): void {
  weaponIndex = (weaponIndex + 1) % WEAPONS.length;
  updateWeaponHud();
  nextShotAt = 0;
  showNotice(`武器切り替え — ${WEAPONS[weaponIndex].name}`);
}

function reloadCurrentWeapon(): void {
  const weapon = WEAPONS[weaponIndex];
  const rounds = reloadWeapon(weapon);
  if (!rounds) {
    showNotice(
      weapon.magazine === weapon.magazineSize ? "弾倉は満タンです" : "予備弾薬がありません",
    );
    return;
  }
  updateWeaponHud();
  showNotice(`リロード完了 — ${weapon.magazine} / ${weapon.reserve}`);
}

function collectLoot(pickup: LootPickup): boolean {
  if (pickup.kind === "medkit") {
    const healed = Math.min(pickup.amount, player.maxHealth - player.health);
    if (healed <= 0) return false;
    player.health += healed;
    updatePlayerHealth();
    showNotice(`回復パックを使用 — HP +${healed}`);
    return true;
  }
  const weapon = WEAPONS.find((item) => item.ammoType === pickup.ammoType);
  if (!weapon) return false;
  const rounds = addAmmo(weapon);
  if (!rounds) return false;
  updateWeaponHud();
  showNotice(`${weapon.name} の弾薬 +${rounds}`);
  return true;
}

function updateEnemies(dt: number): void {
  roundElapsed += dt;
  const zoneRadius = getSafeZoneRadius(roundElapsed);
  if (zoneRing.scale.x !== zoneRadius) {
    zoneRing.scale.set(zoneRadius, 1, zoneRadius);
    for (let index = 0; index < zoneRingPositions.count; index++) {
      const x = zoneRingPositions.getX(index) * zoneRadius;
      const z = zoneRingPositions.getZ(index) * zoneRadius;
      zoneRingPositions.setY(index, terrainHeight(x, z) + 0.055);
    }
    zoneRingPositions.needsUpdate = true;
  }
  const outsideZone = isOutsideSafeZone(player.position, zoneRadius);
  if (outsideZone !== wasOutsideZone) {
    showNotice(
      outsideZone ? "安全エリア外 — エリア内へ移動してください" : "安全エリアに入りました",
    );
    wasOutsideZone = outsideZone;
  }
  if (outsideZone) {
    zoneDamageTimer -= dt;
    if (zoneDamageTimer <= 0) {
      damagePlayer(ZONE_DAMAGE_PER_SECOND, false);
      zoneDamageTimer += 1;
    }
  } else {
    zoneDamageTimer = 1;
  }
  damageFlashTimer = Math.max(0, damageFlashTimer - dt);
  if (damageFlashTimer === 0) damageOverlay.classList.remove("active");

  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    if (!enemy) continue;
    const shot = updateEnemyAI(enemy, dt, player.position, worldBlockers, random);
    const investigating = !enemy.canSeePlayer && enemy.searchTimer > 0 && enemy.hasLastSeen;
    const desiredSpeed = enemy.canSeePlayer ? 4.8 : investigating ? 3.1 : enemy.speed;
    enemy.moveSpeed = THREE.MathUtils.damp(enemy.moveSpeed, desiredSpeed, 4.5, dt);
    enemy.walking = enemy.canSeePlayer
      ? moveEnemyToward(enemy, player.position.x, player.position.z, dt, 4.5, worldBlockers)
      : investigating
        ? moveEnemyToward(enemy, enemy.lastSeenX, enemy.lastSeenZ, dt, 6, worldBlockers)
        : updateEnemy(enemy, dt, random, worldBlockers);
    if (enemy.walking) enemy.walkPhase += dt * Math.max(4, enemy.moveSpeed * 2.2);
    enemy.idlePhase += dt * (enemy.alerted ? 2.2 : 1.3);
    enemy.shotTimer = Math.max(0, enemy.shotTimer - dt);
    enemy.shotLine.visible = enemy.shotTimer > 0;
    syncEnemy(enemy, camera, dt);
    if (shot) {
      showEnemyShot(enemy, shot.hit);
      if (shot.hit) damagePlayer(ENEMY_DAMAGE);
    }
    if (isOutsideSafeZone(enemy.group.position, zoneRadius)) {
      enemy.health = Math.max(0, enemy.health - ZONE_DAMAGE_PER_SECOND * dt);
      updateEnemyHealthBar(enemy);
      if (enemy.health === 0) removeEnemyFromRound(enemy);
    }
    if (roundFinished) break;
  }
  const outcome = getRoundOutcome(player.health, enemies.length);
  if (outcome) finishRound(outcome);
}

function updateFlight(dt: number): void {
  const grounded = isGrounded(player.position, player.velocity, worldBlockers);
  moveForward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  moveRight.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  moveDirection.set(0, 0, 0);
  if (keys.has(keyBindings.moveForward)) moveDirection.add(moveForward);
  if (keys.has(keyBindings.moveBackward)) moveDirection.sub(moveForward);
  if (keys.has(keyBindings.moveRight)) moveDirection.add(moveRight);
  if (keys.has(keyBindings.moveLeft)) moveDirection.sub(moveRight);
  if (moveDirection.lengthSq() > 1) moveDirection.normalize();

  const boost =
    keyBindings.boost === "ShiftLeft"
      ? keys.has("ShiftLeft") || keys.has("ShiftRight")
      : keys.has(keyBindings.boost);
  if (moveDirection.lengthSq() > 0) {
    player.velocity.addScaledVector(moveDirection, (grounded ? 25 : 15) * (boost ? 1.8 : 1) * dt);
  }
  for (let i = 0; i < tethers.length; i++) {
    const tether = tethers[i];
    if (!tether) continue;
    if (keys.has(keyBindings.jump)) ropeLengths[i] = Math.max(7, ropeLengths[i] - 15 * dt);
    towardAnchor.subVectors(tether.position, player.position);
    towardAnchor.y -= EYE_HEIGHT;
    const distance = towardAnchor.length();
    if (distance > 0) {
      const tension = THREE.MathUtils.clamp((distance - ropeLengths[i] + 4) / 4, 0, 1);
      player.velocity.addScaledVector(towardAnchor, (18 * tension * dt) / distance);
    }
  }
  player.velocity.y -= 21 * dt;

  const hasTether = tethers.some(Boolean);
  const drag = hasTether ? Math.exp(-0.06 * dt) : Math.exp(-(grounded ? 3.8 : 0.16) * dt);
  player.velocity.x *= drag;
  player.velocity.z *= drag;
  const maxSpeed = boost ? 42 : hasTether ? 32 : grounded ? 13 : 25;
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  if (horizontalSpeed > maxSpeed) {
    const scale = maxSpeed / horizontalSpeed;
    player.velocity.x *= scale;
    player.velocity.z *= scale;
  }

  const previousY = player.position.y;
  previousPosition.copy(player.position);
  player.position.addScaledVector(player.velocity, dt);
  for (let i = 0; i < tethers.length; i++) {
    const tether = tethers[i];
    if (!tether) continue;
    tetherConstraintAnchor.copy(tether.position);
    tetherConstraintAnchor.y -= EYE_HEIGHT;
    constrainRope(player.position, player.velocity, tetherConstraintAnchor, ropeLengths[i]);
  }
  resolveBuildingCollision(
    player.position,
    previousPosition,
    player.velocity,
    worldBlockers,
    previousY,
  );

  const terrainY = terrainHeight(player.position.x, player.position.z);
  if (player.position.y < terrainY) {
    player.position.y = terrainY;
    if (player.velocity.y < 0) player.velocity.y = 0;
  }
  if (player.position.y > MAX_ALTITUDE) {
    player.position.y = MAX_ALTITUDE;
    if (player.velocity.y > 0) player.velocity.y *= -0.25;
  }
  const worldLimit = citySize / 2 - 10;
  for (const axis of ["x", "z"] as const) {
    if (Math.abs(player.position[axis]) > worldLimit) {
      player.position[axis] = Math.sign(player.position[axis]) * worldLimit;
      player.velocity[axis] *= -0.25;
    }
  }
}

function updateCamera(dt = 1): void {
  camera.position.copy(player.position);
  camera.position.y += EYE_HEIGHT;
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.fov = THREE.MathUtils.damp(camera.fov, scoped ? 22 : 62, 12, dt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function updateTargetAndHud(time: number): void {
  currentTarget = aimAtWall();
  const enemyTarget = aimAtEnemy();
  const hasTether = tethers.some(Boolean);
  reticle.classList.toggle("ready", !!enemyTarget);
  reticle.classList.toggle("enemy-target", !!enemyTarget);
  reticle.classList.toggle("attached", hasTether);
  hookStatus.classList.toggle("ready", !!currentTarget);
  hookStatus.classList.toggle("attached", hasTether);
  hookStatus.lastChild!.textContent = tethers
    .map(
      (tether, index) => `${index ? "R" : "L"} ${tether ? "LINK" : currentTarget ? "READY" : "—"}`,
    )
    .join(" · ");

  for (let i = 0; i < cableLines.length; i++) {
    const tether = tethers[i];
    if (!tether) {
      cableLines[i].visible = false;
      continue;
    }
    ropeStart
      .set(i === 0 ? -0.2 : 0.2, -0.16, -0.42)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    const positions = cableLines[i].geometry.attributes.position;
    positions.setXYZ(0, ropeStart.x, ropeStart.y, ropeStart.z);
    positions.setXYZ(1, tether.position.x, tether.position.y, tether.position.z);
    positions.needsUpdate = true;
    cableLines[i].geometry.computeBoundingSphere();
    cableLines[i].visible = true;
  }

  if (time - lastHudUpdate > 0.1) {
    speedValue.textContent = String(Math.round(player.velocity.length() * 3.6));
    altitudeValue.textContent = String(Math.round(player.position.y));
    enemyCountValue.textContent = String(enemies.length);
    zoneStatus.textContent = `SAFE ZONE ${roundElapsed < ZONE_START_DELAY ? "SHRINKS IN " : ""}${formatZoneTimeRemaining(roundElapsed)}`;
    lastHudUpdate = time;
  }
}

let lastHudUpdate = 0;
let previousTime = 0;
let frameHandle = 0;
function renderStatic(): void {
  updateCamera();
  renderer.render(scene, camera);
}
function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (!frameHandle) renderStatic();
}
window.addEventListener("resize", resize);
resize();

function frame(now: number): void {
  if (roundFinished) {
    frameHandle = 0;
    return;
  }
  frameHandle = requestAnimationFrame(frame);
  const time = now * 0.001;
  const dt = Math.min((now - previousTime) * 0.001 || 0, 0.08);
  previousTime = now;
  updateFlight(dt);
  updateCamera(dt);
  updateEnemies(dt);
  if (!roundFinished) {
    updateLoot(loot, player.position, time, collectLoot);
    if (firing && WEAPONS[weaponIndex].automatic) fireGun(now);
  }
  updateTargetAndHud(time);
  renderer.render(scene, camera);
}
function startLoop(): void {
  if (frameHandle) return;
  previousTime = performance.now();
  frameHandle = requestAnimationFrame(frame);
}
function stopLoop(): void {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  renderStatic();
}

for (const button of [
  getElement<HTMLButtonElement>("#start-button"),
  getElement<HTMLButtonElement>("#resume-button"),
]) {
  button.addEventListener("click", () => {
    clearPendingBinding();
    hasStarted = true;
    setGameUi();
    requestLock();
  });
}
getElement<HTMLButtonElement>("#retry-button").addEventListener("click", () =>
  window.location.reload(),
);

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    keys.clear();
    firing = false;
    tethers.fill(null);
    scoped = false;
    hud.classList.remove("scoped");
    cableLines.forEach((line) => {
      line.visible = false;
    });
    stopLoop();
  } else {
    pauseError.hidden = true;
    startLoop();
  }
  setGameUi();
});
document.addEventListener("pointerlockerror", () =>
  showLockError("マウスロックを開始できませんでした。HTTPS または localhost で開いてください。"),
);

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.0025;
  player.pitch = THREE.MathUtils.clamp(
    player.pitch - event.movementY * 0.002 * getVerticalSensitivity(),
    -1.45,
    1.45,
  );
});

canvas.addEventListener("mousedown", (event) => {
  if (document.pointerLockElement !== canvas) return;
  if (event.button === 0) {
    firing = true;
    fireGun();
  }
  if (event.button === 2) {
    scoped = true;
    hud.classList.add("scoped");
  }
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("mouseup", (event) => {
  if (event.button === 0) firing = false;
  if (event.button === 2) {
    scoped = false;
    hud.classList.remove("scoped");
  }
});
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
  if (document.pointerLockElement !== canvas) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code))
    event.preventDefault();
  keys.add(event.code);
  if (!event.repeat) {
    if (event.code === keyBindings.hookLeft) beginTether(0);
    if (event.code === keyBindings.hookRight) beginTether(1);
    if (event.code === keyBindings.weaponSwitch) switchWeapon();
    if (event.code === keyBindings.reload) reloadCurrentWeapon();
    if (
      event.code === keyBindings.jump &&
      !tethers.some(Boolean) &&
      isGrounded(player.position, player.velocity, worldBlockers)
    ) {
      player.velocity.y = 9.2;
    }
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

setGameUi();
