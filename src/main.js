import * as THREE from "three";
import { constrainRope } from "./flight.js";
import "./style.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const hud = document.querySelector("#hud");
const pauseError = document.querySelector("#pause-error");
const notice = document.querySelector("#notice");
const reticle = document.querySelector("#reticle");
const hookStatus = document.querySelector("#hook-status");
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
let tether = null;
let ropeLength = 0;
let currentTarget = null;
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

function aimAtWall() {
  raycaster.setFromCamera(screenCenter, camera);
  const hit = raycaster
    .intersectObjects(facadeMeshes, false)
    .find(({ point }) => point.distanceTo(player.position) <= MAX_HOOK_DISTANCE);
  return hit ? { position: hit.point.clone() } : null;
}

function beginTether() {
  currentTarget = aimAtWall();
  if (!currentTarget) {
    showNotice("建物の壁に照準を合わせてください");
    return;
  }
  tether = currentTarget;
  ropeLength = Math.max(7, camera.position.distanceTo(tether.position));
  showNotice("ワイヤー接続 — SPACE で巻き取り");
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
  if (keys.has("KeyW")) moveDirection.add(moveForward);
  if (keys.has("KeyS")) moveDirection.sub(moveForward);
  if (keys.has("KeyD")) moveDirection.add(moveRight);
  if (keys.has("KeyA")) moveDirection.sub(moveRight);
  if (moveDirection.lengthSq() > 1) moveDirection.normalize();

  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
  if (moveDirection.lengthSq() > 0) {
    player.velocity.addScaledVector(moveDirection, (grounded ? 25 : 15) * (boost ? 1.8 : 1) * dt);
  }
  if (tether) {
    if (keys.has("Space")) ropeLength = Math.max(7, ropeLength - 15 * dt);
    towardAnchor.subVectors(tether.position, player.position);
    towardAnchor.y -= EYE_HEIGHT;
    const distance = towardAnchor.length();
    if (distance > 0) {
      const tension = THREE.MathUtils.clamp((distance - ropeLength + 4) / 4, 0, 1);
      player.velocity.addScaledVector(towardAnchor, (18 * tension * dt) / distance);
    }
  }
  player.velocity.y -= 21 * dt;

  const drag = tether ? Math.exp(-0.06 * dt) : Math.exp(-(grounded ? 3.8 : 0.16) * dt);
  player.velocity.x *= drag;
  player.velocity.z *= drag;
  const maxSpeed = boost ? 42 : tether ? 32 : grounded ? 13 : 25;
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  if (horizontalSpeed > maxSpeed) {
    const scale = maxSpeed / horizontalSpeed;
    player.velocity.x *= scale;
    player.velocity.z *= scale;
  }

  const previousY = player.position.y;
  player.position.addScaledVector(player.velocity, dt);
  if (tether) {
    tetherConstraintAnchor.copy(tether.position);
    tetherConstraintAnchor.y -= EYE_HEIGHT;
    constrainRope(player.position, player.velocity, tetherConstraintAnchor, ropeLength);
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

function updateCamera() {
  camera.position.copy(player.position);
  camera.position.y += EYE_HEIGHT;
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function updateTargetAndHud(time) {
  currentTarget = aimAtWall();
  reticle.classList.toggle("ready", !!currentTarget && !tether);
  reticle.classList.toggle("attached", !!tether);
  hookStatus.classList.toggle("ready", !!currentTarget && !tether);
  hookStatus.classList.toggle("attached", !!tether);
  hookStatus.lastChild.textContent = tether ? " ATTACHED" : currentTarget ? " LOCKED" : " SCANNING";

  if (tether) {
    for (let i = 0; i < cableLines.length; i++) {
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
  } else {
    cableLines.forEach((line) => {
      line.visible = false;
    });
  }

  if (time - lastHudUpdate > 0.1) {
    speedValue.textContent = String(Math.round(player.velocity.length() * 3.6));
    altitudeValue.textContent = String(Math.round(player.position.y));
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
  updateCamera();
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
    hasStarted = true;
    setGameUi();
    requestLock();
  });
}

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    keys.clear();
    tether = null;
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

canvas.addEventListener("click", (event) => {
  if (event.button !== 0 || document.pointerLockElement !== canvas) return;
  if (tether) tether = null;
  else beginTether();
});
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code))
    event.preventDefault();
  keys.add(event.code);
  if (
    event.code === "Space" &&
    !event.repeat &&
    !tether &&
    document.pointerLockElement === canvas &&
    player.position.y <= 0.03
  ) {
    player.velocity.y = 9.2;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

setGameUi();
