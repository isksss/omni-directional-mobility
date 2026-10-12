import * as THREE from "three";
import { constrainRope } from "./flight.js";
import { getEnemyGait, updateEnemy } from "./enemies.js";
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
const buildings = [];
const object = new THREE.Object3D();

function groundRect(width, depth, x, z, y, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

const groundMaterial = new THREE.MeshStandardMaterial({ color: "#19232c", roughness: 1 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: "#202a33", roughness: 0.95 });
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: "#2b343a", roughness: 0.95 });
const lineMaterial = new THREE.MeshBasicMaterial({
  color: "#67716d",
  transparent: true,
  opacity: 0.35,
});
groundRect(540, 540, 0, 0, -0.08, groundMaterial);

function groundStrips(width, depth, axis, y, material, offset = 0) {
  const strips = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, depth), material, 9);
  for (let i = -4; i <= 4; i++) {
    object.position.set(axis === "x" ? 0 : i * 48 + offset, y, axis === "x" ? i * 48 + offset : 0);
    object.rotation.set(-Math.PI / 2, 0, 0);
    object.updateMatrix();
    strips.setMatrixAt(i + 4, object.matrix);
  }
  scene.add(strips);
}
groundStrips(citySize, 8, "x", 0.005, roadMaterial);
groundStrips(8, citySize, "z", 0.006, roadMaterial);
for (const side of [-1, 1]) {
  groundStrips(citySize, 1.7, "x", 0.012, sidewalkMaterial, side * 5.1);
  groundStrips(1.7, citySize, "z", 0.013, sidewalkMaterial, side * 5.1);
}

const roadDashes = new THREE.InstancedMesh(
  new THREE.BoxGeometry(6, 0.025, 0.18),
  lineMaterial,
  900,
);
let dashCount = 0;
for (let road = -4; road <= 4; road++) {
  for (let at = -220; at <= 220; at += 12) {
    object.position.set(at, 0.027, road * 48);
    object.rotation.set(0, 0, 0);
    object.updateMatrix();
    roadDashes.setMatrixAt(dashCount++, object.matrix);
    object.position.set(road * 48, 0.028, at);
    object.rotation.set(0, Math.PI / 2, 0);
    object.updateMatrix();
    roadDashes.setMatrixAt(dashCount++, object.matrix);
  }
}
roadDashes.count = dashCount;
scene.add(roadDashes);

const facadeMaterials = ["#293441", "#303744", "#30333b", "#26353a", "#35333a"].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.08 }),
);
const facadeMatrices = facadeMaterials.map(() => []);
const facadeMeshes = [];
const roofMatrices = [];
const antennaMatrices = [];
const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const roofMaterial = new THREE.MeshStandardMaterial({ color: "#454950", roughness: 0.9 });
const antennaMaterial = new THREE.MeshStandardMaterial({
  color: "#8e9998",
  metalness: 0.62,
  roughness: 0.42,
});
const antennaGeometry = new THREE.CylinderGeometry(0.09, 0.14, 1, 5);
const windowGeometry = new THREE.BoxGeometry(0.72, 1, 0.12);
const litWindowMaterial = new THREE.MeshStandardMaterial({
  color: "#ffc774",
  emissive: "#ed9c43",
  emissiveIntensity: 1.15,
  roughness: 0.7,
});
const darkWindowMaterial = new THREE.MeshStandardMaterial({
  color: "#35404b",
  emissive: "#263b4d",
  emissiveIntensity: 0.35,
  roughness: 0.8,
});
const litWindows = Array.from({ length: 16 }, () => []);
const darkWindows = Array.from({ length: 16 }, () => []);

function addWindow(x, y, z, rotation, lit, chunk) {
  object.position.set(x, y, z);
  object.rotation.set(0, rotation, 0);
  object.scale.set(1, 1, 1);
  object.updateMatrix();
  (lit ? litWindows : darkWindows)[chunk].push(object.matrix.clone());
}

for (let gx = -8; gx <= 7; gx++) {
  for (let gz = -8; gz <= 7; gz++) {
    if (random() < 0.08) continue;
    const x = gx * 24 + 12;
    const z = gz * 24 + 12;
    const width = rand(9, 15);
    const depth = rand(9, 15);
    const height = rand(14, 58);
    const chunk = Math.floor((gx + 8) / 4) + Math.floor((gz + 8) / 4) * 4;
    object.rotation.set(0, 0, 0);
    object.position.set(x, height / 2, z);
    object.scale.set(width, height, depth);
    object.updateMatrix();
    facadeMatrices[Math.floor(random() * facadeMaterials.length)].push(object.matrix.clone());
    object.position.set(x, height + 0.27, z);
    object.scale.set(width + 0.7, 0.55, depth + 0.7);
    object.updateMatrix();
    roofMatrices.push(object.matrix.clone());
    buildings.push({ x, z, width, depth, height });

    for (let floor = 2.6; floor < height - 1; floor += 4.3) {
      for (let offset = -width / 2 + 1.35; offset <= width / 2 - 1; offset += 3.7) {
        if (random() > 0.32) {
          const lit = random() < 0.65;
          addWindow(x + offset, floor, z - depth / 2 - 0.07, 0, lit, chunk);
          addWindow(x + offset, floor, z + depth / 2 + 0.07, Math.PI, lit, chunk);
        }
      }
      for (let offset = -depth / 2 + 1.35; offset <= depth / 2 - 1; offset += 3.7) {
        if (random() > 0.32) {
          const lit = random() < 0.65;
          addWindow(x - width / 2 - 0.07, floor, z + offset, Math.PI / 2, lit, chunk);
          addWindow(x + width / 2 + 0.07, floor, z + offset, -Math.PI / 2, lit, chunk);
        }
      }
    }

    if (random() < 0.82) {
      const count = random() < 0.2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ax =
          x + (count === 1 ? rand(-width * 0.26, width * 0.26) : (i ? 1 : -1) * width * 0.23);
        const az =
          z + (count === 1 ? rand(-depth * 0.26, depth * 0.26) : rand(-depth * 0.2, depth * 0.2));
        const antennaHeight = rand(2.3, 5.5);
        object.rotation.set(0, 0, 0);
        object.position.set(ax, height + antennaHeight / 2, az);
        object.scale.set(1, antennaHeight, 1);
        object.updateMatrix();
        antennaMatrices.push(object.matrix.clone());
      }
    }
  }
}

for (const [mat, matrices] of facadeMaterials.map((material, index) => [
  material,
  facadeMatrices[index],
])) {
  const facades = new THREE.InstancedMesh(unitBoxGeometry, mat, matrices.length);
  matrices.forEach((matrix, index) => facades.setMatrixAt(index, matrix));
  facades.instanceMatrix.needsUpdate = true;
  facadeMeshes.push(facades);
  scene.add(facades);
}
const roofs = new THREE.InstancedMesh(unitBoxGeometry, roofMaterial, roofMatrices.length);
roofMatrices.forEach((matrix, index) => roofs.setMatrixAt(index, matrix));
roofs.instanceMatrix.needsUpdate = true;
scene.add(roofs);
const antennae = new THREE.InstancedMesh(antennaGeometry, antennaMaterial, antennaMatrices.length);
antennaMatrices.forEach((matrix, index) => antennae.setMatrixAt(index, matrix));
antennae.instanceMatrix.needsUpdate = true;
scene.add(antennae);
for (let chunk = 0; chunk < litWindows.length; chunk++) {
  for (const [mat, matrices] of [
    [litWindowMaterial, litWindows[chunk]],
    [darkWindowMaterial, darkWindows[chunk]],
  ]) {
    if (!matrices.length) continue;
    const windows = new THREE.InstancedMesh(windowGeometry, mat, matrices.length);
    matrices.forEach((matrix, index) => windows.setMatrixAt(index, matrix));
    windows.instanceMatrix.needsUpdate = true;
    scene.add(windows);
  }
}

const enemies = [];
const enemyBodyGeometry = new THREE.CylinderGeometry(0.22, 0.29, 0.64, 6);
const enemyPelvisGeometry = new THREE.BoxGeometry(0.4, 0.24, 0.28);
const enemyHelmetGeometry = new THREE.DodecahedronGeometry(0.22, 0);
const enemyNeckGeometry = new THREE.CylinderGeometry(0.09, 0.11, 0.14, 6);
const enemyVisorGeometry = new THREE.BoxGeometry(0.31, 0.085, 0.045);
const enemyUpperArmGeometry = new THREE.CylinderGeometry(0.085, 0.12, 0.36, 6);
const enemyLowerArmGeometry = new THREE.CylinderGeometry(0.075, 0.1, 0.31, 6);
const enemyUpperLegGeometry = new THREE.CylinderGeometry(0.13, 0.16, 0.4, 6);
const enemyLowerLegGeometry = new THREE.CylinderGeometry(0.1, 0.13, 0.36, 6);
const enemyJointGeometry = new THREE.SphereGeometry(0.11, 6, 5);
const enemyArmorMaterial = new THREE.MeshStandardMaterial({
  color: "#344352",
  metalness: 0.58,
  roughness: 0.42,
});
const enemySuitMaterial = new THREE.MeshStandardMaterial({
  color: "#202833",
  roughness: 0.78,
});
const enemyDetailMaterial = new THREE.MeshStandardMaterial({
  color: "#ed684e",
  emissive: "#9f261c",
  emissiveIntensity: 0.8,
  metalness: 0.3,
  roughness: 0.48,
});
const enemyVisorMaterial = new THREE.MeshStandardMaterial({
  color: "#72efff",
  emissive: "#22cce8",
  emissiveIntensity: 2,
  metalness: 0.35,
  roughness: 0.25,
});
const enemyJointMaterial = new THREE.MeshStandardMaterial({
  color: "#131a22",
  metalness: 0.65,
  roughness: 0.38,
});
const enemyBootGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.32);
const enemyChestPlateGeometry = new THREE.BoxGeometry(0.45, 0.31, 0.12);
const enemyChestLightGeometry = new THREE.BoxGeometry(0.24, 0.035, 0.025);
function syncEnemy(enemy) {
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
}
function spawnEnemy() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(enemyBodyGeometry, enemySuitMaterial);
  body.position.y = 1.12;
  group.add(body);

  const pelvis = new THREE.Mesh(enemyPelvisGeometry, enemySuitMaterial);
  pelvis.position.y = 0.77;
  group.add(pelvis);
  const chestPlate = new THREE.Mesh(enemyChestPlateGeometry, enemyArmorMaterial);
  chestPlate.position.set(0, 1.23, -0.2);
  group.add(chestPlate);
  const chestLight = new THREE.Mesh(enemyChestLightGeometry, enemyDetailMaterial);
  chestLight.position.set(0, 1.2, -0.27);
  group.add(chestLight);

  const neck = new THREE.Mesh(enemyNeckGeometry, enemyJointMaterial);
  neck.position.y = 1.51;
  group.add(neck);
  const helmet = new THREE.Mesh(enemyHelmetGeometry, enemyArmorMaterial);
  helmet.position.y = 1.69;
  group.add(helmet);
  const visor = new THREE.Mesh(enemyVisorGeometry, enemyVisorMaterial);
  visor.position.set(0, 1.69, -0.2);
  group.add(visor);

  const arms = [];
  const legs = [];
  const knees = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.4, 0);
    group.add(arm);
    const shoulder = new THREE.Mesh(enemyJointGeometry, enemyArmorMaterial);
    shoulder.scale.set(1.35, 1.1, 1.3);
    shoulder.position.y = -0.04;
    arm.add(shoulder);
    const upperArm = new THREE.Mesh(enemyUpperArmGeometry, enemySuitMaterial);
    upperArm.position.y = -0.19;
    arm.add(upperArm);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    arm.add(elbow);
    const elbowJoint = new THREE.Mesh(enemyJointGeometry, enemyJointMaterial);
    elbow.add(elbowJoint);
    const forearm = new THREE.Mesh(enemyLowerArmGeometry, enemyArmorMaterial);
    forearm.position.y = -0.15;
    elbow.add(forearm);
    const hand = new THREE.Mesh(enemyJointGeometry, enemySuitMaterial);
    hand.scale.set(0.78, 0.8, 0.82);
    hand.position.set(0, -0.31, -0.015);
    elbow.add(hand);
    arms.push(arm);

    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.78, 0);
    group.add(leg);
    const thigh = new THREE.Mesh(enemyUpperLegGeometry, enemySuitMaterial);
    thigh.position.y = -0.2;
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    leg.add(knee);
    const kneePad = new THREE.Mesh(enemyJointGeometry, enemyArmorMaterial);
    kneePad.scale.set(1.15, 0.95, 1.1);
    knee.add(kneePad);
    const shin = new THREE.Mesh(enemyLowerLegGeometry, enemyArmorMaterial);
    shin.position.y = -0.18;
    knee.add(shin);
    const boot = new THREE.Mesh(enemyBootGeometry, enemyJointMaterial);
    boot.position.set(0, -0.37, -0.06);
    knee.add(boot);
    legs.push(leg);
    knees.push(knee);
  }

  const enemy = {
    axis: random() < 0.5 ? "x" : "z",
    lane: (Math.floor(random() * 9) - 4) * 48,
    along: rand(-192, 192),
    direction: random() < 0.5 ? -1 : 1,
    speed: rand(1.4, 2.6),
    walkPhase: rand(0, Math.PI * 2),
    arms,
    legs,
    knees,
    group,
  };
  group.userData.enemy = enemy;
  syncEnemy(enemy);
  scene.add(group);
  enemies.push(enemy);
}
for (let i = 0; i < 20; i++) spawnEnemy();

const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
};
const EYE_HEIGHT = 1.62;
const MAX_HOOK_DISTANCE = 120;
const COLLISION_RADIUS = 0.48;
const MAX_ALTITUDE = 145;
const WEAPONS = [
  { name: "SNIPER", range: 220, fireInterval: 550, automatic: false },
  { name: "ASSAULT MG", range: 90, fireInterval: 95, automatic: true },
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
function showNotice(message) {
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("visible"), 1700);
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
  scene.remove(hit.enemy.group);
  enemies.splice(enemies.indexOf(hit.enemy), 1);
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

function updateEnemies(dt) {
  respawnTimer -= dt;
  if (enemies.length < 20 && respawnTimer <= 0) {
    spawnEnemy();
    respawnTimer = 1.8;
  }
  for (const enemy of enemies) {
    updateEnemy(enemy, dt, random);
    enemy.walkPhase += dt * enemy.speed * 2.5;
    syncEnemy(enemy);
  }
}

function resolveBuildings(previousY) {
  for (const building of buildings) {
    const minX = building.x - building.width / 2;
    const maxX = building.x + building.width / 2;
    const minZ = building.z - building.depth / 2;
    const maxZ = building.z + building.depth / 2;

    if (
      previousY >= building.height &&
      player.position.y < building.height &&
      player.velocity.y <= 0 &&
      player.position.x > minX &&
      player.position.x < maxX &&
      player.position.z > minZ &&
      player.position.z < maxZ
    ) {
      player.position.y = building.height;
      player.velocity.y = 0;
      return;
    }
    if (player.position.y >= building.height || player.position.y + 1.9 <= 0) continue;

    const overlapX =
      building.width / 2 + COLLISION_RADIUS - Math.abs(player.position.x - building.x);
    const overlapZ =
      building.depth / 2 + COLLISION_RADIUS - Math.abs(player.position.z - building.z);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    if (overlapX < overlapZ) {
      const side = player.position.x < building.x ? -1 : 1;
      player.position.x = building.x + side * (building.width / 2 + COLLISION_RADIUS);
      player.velocity.x = 0;
    } else {
      const side = player.position.z < building.z ? -1 : 1;
      player.position.z = building.z + side * (building.depth / 2 + COLLISION_RADIUS);
      player.velocity.z = 0;
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
  player.position.addScaledVector(player.velocity, dt);
  for (let i = 0; i < tethers.length; i++) {
    if (!tethers[i]) continue;
    tetherConstraintAnchor.copy(tethers[i].position);
    tetherConstraintAnchor.y -= EYE_HEIGHT;
    constrainRope(player.position, player.velocity, tetherConstraintAnchor, ropeLengths[i]);
  }
  resolveBuildings(previousY);

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
