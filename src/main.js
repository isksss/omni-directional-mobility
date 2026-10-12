import * as THREE from "three";
import { createCity, resolveBuildingCollision } from "./city.js";
import { createEnemy, syncEnemy, updateEnemyHealthBar } from "./enemy-visuals.js";
import { constrainRope } from "./flight.js";
import { updateEnemy, updateEnemyAI } from "./enemies.js";
import "./style.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const hud = document.querySelector("#hud");
const pauseError = document.querySelector("#pause-error");
const notice = document.querySelector("#notice");
const reticle = document.querySelector("#reticle");
const hookStatus = document.querySelector("#hook-status");
const enemyCountValue = document.querySelector("#enemy-count");
const killCountValue = document.querySelector("#kill-count");
const speedValue = document.querySelector("#speed-value");
const altitudeValue = document.querySelector("#altitude-value");
const playerHealthValue = document.querySelector("#player-health-value");
const playerHealthBar = document.querySelector("#player-health-bar");
const damageOverlay = document.querySelector("#damage-overlay");
const sensitivityInputs = [...document.querySelectorAll("[data-vertical-sensitivity]")];
const sensitivityOutputs = [...document.querySelectorAll("[data-sensitivity-value]")];
let verticalSensitivity = 1;
function setVerticalSensitivity(value) {
  verticalSensitivity = THREE.MathUtils.clamp(Number(value), 0.2, 2);
  sensitivityInputs.forEach((input) => {
    input.value = String(verticalSensitivity);
  });
  sensitivityOutputs.forEach((output) => {
    output.textContent = `${verticalSensitivity.toFixed(1)}×`;
  });
}
sensitivityInputs.forEach((input) =>
  input.addEventListener("input", () => setVerticalSensitivity(input.value)),
);
setVerticalSensitivity(verticalSensitivity);

const DEFAULT_KEY_BINDINGS = {
  moveForward: "KeyW",
  moveBackward: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  hookLeft: "KeyQ",
  hookRight: "KeyE",
  jump: "Space",
  boost: "ShiftLeft",
  weaponSwitch: "KeyV",
};
const KEY_ACTIONS = [
  ["moveForward", "前進"],
  ["moveBackward", "後退"],
  ["moveLeft", "左移動"],
  ["moveRight", "右移動"],
  ["hookLeft", "左フック"],
  ["hookRight", "右フック"],
  ["jump", "ジャンプ／巻き取り"],
  ["boost", "ブースト"],
  ["weaponSwitch", "武器切り替え"],
];
function loadKeyBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem("omni-key-bindings"));
    const values = KEY_ACTIONS.map(([action]) => saved?.[action]);
    if (
      values.every((code) => typeof code === "string" && code) &&
      new Set(values).size === values.length
    ) {
      return Object.fromEntries(KEY_ACTIONS.map(([action], index) => [action, values[index]]));
    }
  } catch {}
  return { ...DEFAULT_KEY_BINDINGS };
}
const keyBindings = loadKeyBindings();
const keySettings = [...document.querySelectorAll("[data-key-settings]")];
let pendingBinding = null;
function formatKey(code) {
  const labels = {
    Space: "SPACE",
    ShiftLeft: "SHIFT",
    ShiftRight: "SHIFT",
    ControlLeft: "CTRL",
    ControlRight: "CTRL",
    AltLeft: "ALT",
    AltRight: "ALT",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return labels[code] ?? code.replace(/^Key|^Digit/, "").toUpperCase();
}
function updateKeySettings() {
  for (const settings of keySettings) {
    settings.querySelectorAll("[data-bind-action]").forEach((button) => {
      const action = button.dataset.bindAction;
      const key = pendingBinding === action ? "入力待ち…" : formatKey(keyBindings[action]);
      button.textContent = key;
      button.setAttribute(
        "aria-label",
        `${KEY_ACTIONS.find(([key]) => key === action)[1]}のキー: ${key}`,
      );
      button.setAttribute("aria-pressed", String(pendingBinding === action));
    });
  }
  document.querySelectorAll("[data-key-label]").forEach((element) => {
    const action = element.dataset.keyLabel;
    element.textContent =
      action === "movement"
        ? ["moveForward", "moveLeft", "moveBackward", "moveRight"]
            .map((key) => formatKey(keyBindings[key]))
            .join(" ")
        : formatKey(keyBindings[action]);
  });
}
function setKeySettingsStatus(message) {
  keySettings.forEach((settings) => {
    settings.querySelector("[data-key-setting-status]").textContent = message;
  });
}
function saveKeyBindings() {
  try {
    localStorage.setItem("omni-key-bindings", JSON.stringify(keyBindings));
  } catch {}
}
for (const settings of keySettings) {
  const list = settings.querySelector("[data-key-binding-list]");
  for (const [action, label] of KEY_ACTIONS) {
    const row = document.createElement("div");
    row.className = "key-binding-row";
    const name = document.createElement("span");
    name.textContent = label;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bindAction = action;
    row.append(name, button);
    list.append(row);
  }
  settings.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.hasAttribute("data-reset-key-bindings")) {
      pendingBinding = null;
      Object.assign(keyBindings, DEFAULT_KEY_BINDINGS);
      saveKeyBindings();
      updateKeySettings();
      setKeySettingsStatus("初期設定に戻しました");
    } else if (button?.dataset.bindAction) {
      pendingBinding = button.dataset.bindAction;
      updateKeySettings();
      setKeySettingsStatus(
        `${KEY_ACTIONS.find(([action]) => action === pendingBinding)[1]}のキーを押してください（Escでキャンセル）`,
      );
    }
  });
}
updateKeySettings();
document.addEventListener(
  "keydown",
  (event) => {
    if (!pendingBinding) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === "Escape") {
      pendingBinding = null;
      updateKeySettings();
      setKeySettingsStatus("");
      return;
    }
    if (!event.code || event.code === "Unidentified") {
      setKeySettingsStatus("このキーは割り当てできません");
      return;
    }
    const conflict = KEY_ACTIONS.find(
      ([action]) =>
        action !== pendingBinding &&
        (keyBindings[action] === event.code ||
          (action === "boost" && keyBindings.boost === "ShiftLeft" && event.code === "ShiftRight")),
    );
    if (conflict) {
      setKeySettingsStatus(`${formatKey(event.code)}は「${conflict[1]}」に割り当て済みです`);
      return;
    }
    const action = pendingBinding;
    keyBindings[action] = event.code;
    pendingBinding = null;
    saveKeyBindings();
    updateKeySettings();
    setKeySettingsStatus(
      `${KEY_ACTIONS.find(([key]) => key === action)[1]}を${formatKey(event.code)}に設定しました`,
    );
  },
  true,
);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#111827");
scene.fog = new THREE.FogExp2("#111827", 0.0031);

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
renderer.toneMappingExposure = 1.18;

scene.add(new THREE.HemisphereLight("#b9d7ff", "#27202a", 2.05));
scene.add(new THREE.AmbientLight("#7d8fae", 0.62));
const sunset = new THREE.DirectionalLight("#ffd0a0", 2.2);
sunset.position.set(-90, 130, -40);
scene.add(sunset);
const skylineGlow = new THREE.PointLight("#ff956e", 38, 230, 2);
skylineGlow.position.set(0, 32, -118);
scene.add(skylineGlow);

const random = (() => {
  let seed = 741;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
})();
const rand = (min, max) => min + random() * (max - min);
const citySize = 460;
const city = createCity(scene, random);
const { buildings, facadeMeshes } = city;

const enemies = [];
function spawnEnemy() {
  enemies.push(createEnemy(scene, camera, random, rand));
}
for (let i = 0; i < 20; i++) spawnEnemy();

const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  health: 100,
  maxHealth: 100,
  invulnerability: 0,
};
const previousPosition = new THREE.Vector3();
const EYE_HEIGHT = 1.62;
const MAX_HOOK_DISTANCE = 120;
const MAX_ALTITUDE = 145;
const WEAPONS = [
  { name: "SNIPER", range: 220, fireInterval: 550, automatic: false, damage: 100 },
  { name: "ASSAULT MG", range: 90, fireInterval: 95, automatic: true, damage: 25 },
];
const weaponName = document.querySelector("#weapon-name");
let weaponIndex = 0;
let nextShotAt = 0;
let firing = false;
const tethers = [null, null];
const ropeLengths = [0, 0];
let currentTarget = null;
let scoped = false;
let kills = 0;
let respawnTimer = 0;
let hasStarted = false;
const keys = new Set();
const raycaster = new THREE.Raycaster();
raycaster.far = MAX_HOOK_DISTANCE;
const screenCenter = new THREE.Vector2(0, 0);
const ropeStart = new THREE.Vector3();
const tetherConstraintAnchor = new THREE.Vector3();
const towardAnchor = new THREE.Vector3();
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const cableLines = [];
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

updatePlayerHealth();

function setGameUi() {
  const locked = document.pointerLockElement === canvas;
  startScreen.hidden = hasStarted;
  pauseScreen.hidden = !hasStarted || locked;
  hud.hidden = !locked;
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

function showLockError(message) {
  pauseError.textContent = message;
  pauseError.hidden = false;
}

let noticeTimer;
let damageFlashTimer = 0;
function showNotice(message) {
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("visible"), 1700);
}

function updatePlayerHealth() {
  playerHealthValue.textContent = String(Math.ceil(player.health));
  playerHealthBar.style.width = `${player.health}%`;
  playerHealthBar.classList.toggle("low", player.health <= 30);
}

function damagePlayer(damage) {
  if (player.invulnerability > 0) return;
  player.health = Math.max(0, player.health - damage);
  updatePlayerHealth();
  damageOverlay.classList.remove("active");
  void damageOverlay.offsetWidth;
  damageOverlay.classList.add("active");
  damageFlashTimer = 0.24;
  if (player.health > 0) return;

  player.health = player.maxHealth;
  player.position.set(0, 0, 0);
  player.velocity.set(0, 0, 0);
  player.invulnerability = 3;
  tethers.fill(null);
  updatePlayerHealth();
  showNotice("撃破されました — 渋谷スクランブルで再出撃");
}

function showEnemyShot(enemy, hit) {
  const positions = enemy.shotLine.geometry.attributes.position;
  positions.setXYZ(0, enemy.group.position.x, 1.3, enemy.group.position.z);
  positions.setXYZ(1, player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
  positions.needsUpdate = true;
  enemy.shotLine.geometry.computeBoundingSphere();
  enemy.shotLine.material.color.set(hit ? "#ff625f" : "#ffc46b");
  enemy.shotLine.visible = true;
  enemy.shotTimer = 0.12;
}

function aimAtWall(maxDistance = MAX_HOOK_DISTANCE) {
  raycaster.far = maxDistance;
  raycaster.setFromCamera(screenCenter, camera);
  const hit = raycaster.intersectObjects(facadeMeshes, false)[0];
  raycaster.far = MAX_HOOK_DISTANCE;
  return hit ? { position: hit.point.clone(), distance: hit.distance } : null;
}

function aimAtEnemy(maxDistance = WEAPONS[weaponIndex].range) {
  raycaster.far = maxDistance;
  raycaster.setFromCamera(screenCenter, camera);
  const hit = raycaster.intersectObjects(
    enemies.map((enemy) => enemy.group),
    true,
  )[0];
  raycaster.far = MAX_HOOK_DISTANCE;
  if (!hit) return null;
  let target = hit.object;
  while (target && !target.userData.enemy) target = target.parent;
  return target ? { enemy: target.userData.enemy, distance: hit.distance } : null;
}

function beginTether(index) {
  if (tethers[index]) {
    tethers[index] = null;
    showNotice(`${index ? "右" : "左"}フックを解除`);
    return;
  }
  currentTarget = aimAtWall();
  if (!currentTarget) {
    showNotice("建物の壁に照準を合わせてください");
    return;
  }
  tethers[index] = currentTarget;
  ropeLengths[index] = Math.max(7, camera.position.distanceTo(currentTarget.position));
  showNotice(`${index ? "右" : "左"}フック接続 — Space で巻き取り`);
}

function fireGun(now = performance.now()) {
  const weapon = WEAPONS[weaponIndex];
  if (now < nextShotAt) return;
  nextShotAt = now + weapon.fireInterval;
  camera.updateMatrixWorld();
  const hit = aimAtEnemy(weapon.range);
  if (!hit) return;
  const wall = aimAtWall(weapon.range);
  if (wall && wall.distance < hit.distance) {
    showNotice("建物に遮られています");
    return;
  }
  const enemy = hit.enemy;
  enemy.health = Math.max(0, enemy.health - weapon.damage);
  updateEnemyHealthBar(enemy);
  if (enemy.health > 0) {
    showNotice(`敵に命中 — 残り HP ${enemy.health}`);
    return;
  }
  scene.remove(enemy.group, enemy.healthBar, enemy.shotLine);
  enemy.shotLine.geometry.dispose();
  enemy.shotLine.material.dispose();
  enemy.healthFillMaterial.dispose();
  enemies.splice(enemies.indexOf(enemy), 1);
  kills++;
  enemyCountValue.textContent = String(enemies.length);
  killCountValue.textContent = String(kills);
  showNotice(`敵を撃破 — ${kills} KILLS`);
}

function switchWeapon() {
  weaponIndex = (weaponIndex + 1) % WEAPONS.length;
  weaponName.textContent = WEAPONS[weaponIndex].name;
  nextShotAt = 0;
  showNotice(`武器切り替え — ${WEAPONS[weaponIndex].name}`);
}

function chaseEnemy(enemy, dt) {
  const x = enemy.axis === "x" ? enemy.along : enemy.lane;
  const z = enemy.axis === "x" ? enemy.lane : enemy.along;
  const dx = player.position.x - x;
  const dz = player.position.z - z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 4.5) return;
  const step = Math.min(distance - 4.5, 4.8 * dt);
  const nextX = x + (dx / distance) * step;
  const nextZ = z + (dz / distance) * step;
  enemy.axis = Math.abs(dx) >= Math.abs(dz) ? "x" : "z";
  enemy.direction = Math.sign(enemy.axis === "x" ? dx : dz) || enemy.direction;
  enemy.along = enemy.axis === "x" ? nextX : nextZ;
  enemy.lane = enemy.axis === "x" ? nextZ : nextX;
}

function updateEnemies(dt) {
  respawnTimer -= dt;
  player.invulnerability = Math.max(0, player.invulnerability - dt);
  damageFlashTimer = Math.max(0, damageFlashTimer - dt);
  if (damageFlashTimer === 0) damageOverlay.classList.remove("active");
  if (enemies.length < 20 && respawnTimer <= 0) {
    spawnEnemy();
    respawnTimer = 1.8;
  }
  for (const enemy of enemies) {
    const shot = updateEnemyAI(enemy, dt, player.position, buildings, random);
    if (enemy.canSeePlayer) chaseEnemy(enemy, dt);
    else updateEnemy(enemy, dt, random);
    enemy.walkPhase += dt * (enemy.canSeePlayer ? 7 : enemy.speed * 2.5);
    enemy.shotTimer = Math.max(0, enemy.shotTimer - dt);
    enemy.shotLine.visible = enemy.shotTimer > 0;
    syncEnemy(enemy, camera);
    if (shot) {
      showEnemyShot(enemy, shot.hit);
      if (shot.hit) damagePlayer(12);
    }
  }
}

function updateFlight(dt) {
  const grounded = player.position.y <= 0.02;
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
    if (!tethers[i]) continue;
    tetherConstraintAnchor.copy(tethers[i].position);
    tetherConstraintAnchor.y -= EYE_HEIGHT;
    constrainRope(player.position, player.velocity, tetherConstraintAnchor, ropeLengths[i]);
  }
  resolveBuildingCollision(
    player.position,
    previousPosition,
    player.velocity,
    buildings,
    previousY,
  );

  if (player.position.y < 0) {
    player.position.y = 0;
    if (player.velocity.y < 0) player.velocity.y = 0;
  }
  if (player.position.y > MAX_ALTITUDE) {
    player.position.y = MAX_ALTITUDE;
    if (player.velocity.y > 0) player.velocity.y *= -0.25;
  }
  const worldLimit = citySize / 2 - 10;
  for (const axis of ["x", "z"]) {
    if (Math.abs(player.position[axis]) > worldLimit) {
      player.position[axis] = Math.sign(player.position[axis]) * worldLimit;
      player.velocity[axis] *= -0.25;
    }
  }
}

function updateCamera(dt = 1) {
  camera.position.copy(player.position);
  camera.position.y += EYE_HEIGHT;
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.fov = THREE.MathUtils.damp(camera.fov, scoped ? 22 : 62, 12, dt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function updateTargetAndHud(time) {
  currentTarget = aimAtWall();
  const enemyTarget = aimAtEnemy();
  const hasTether = tethers.some(Boolean);
  reticle.classList.toggle("ready", !!enemyTarget);
  reticle.classList.toggle("enemy-target", !!enemyTarget);
  reticle.classList.toggle("attached", hasTether);
  hookStatus.classList.toggle("ready", !!currentTarget);
  hookStatus.classList.toggle("attached", hasTether);
  hookStatus.lastChild.textContent = tethers
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
    lastHudUpdate = time;
  }
}

let lastHudUpdate = 0;
let previousTime = 0;
let frameHandle = 0;
function renderStatic() {
  updateCamera();
  renderer.render(scene, camera);
}
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (!frameHandle) renderStatic();
}
window.addEventListener("resize", resize);
resize();

function frame(now) {
  frameHandle = requestAnimationFrame(frame);
  const time = now * 0.001;
  const dt = Math.min((now - previousTime) * 0.001 || 0, 0.08);
  previousTime = now;
  updateFlight(dt);
  updateEnemies(dt);
  if (firing && WEAPONS[weaponIndex].automatic) fireGun(now);
  updateCamera(dt);
  updateTargetAndHud(time);
  renderer.render(scene, camera);
}
function startLoop() {
  if (frameHandle) return;
  previousTime = performance.now();
  frameHandle = requestAnimationFrame(frame);
}
function stopLoop() {
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  renderStatic();
}

for (const button of [
  document.querySelector("#start-button"),
  document.querySelector("#resume-button"),
]) {
  button.addEventListener("click", () => {
    pendingBinding = null;
    updateKeySettings();
    setKeySettingsStatus("");
    hasStarted = true;
    setGameUi();
    requestLock();
  });
}

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
    player.pitch - event.movementY * 0.002 * verticalSensitivity,
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
    if (event.code === keyBindings.jump && !tethers.some(Boolean) && player.position.y <= 0.03) {
      player.velocity.y = 9.2;
    }
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

setGameUi();
