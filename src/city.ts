import * as THREE from "three";
import type { BuildingBounds, RandomSource } from "./game-types.ts";
import { randomBetween } from "./game-utils.ts";

export interface CityBuilding extends BuildingBounds {
  entranceWidth: number;
  entranceHeight: number;
}

const ROAD_SPACING = 48;
const ENTRANCE_WIDTH = 2.8;
const ENTRANCE_HEIGHT = 2.7;
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const transform = new THREE.Object3D();

function addMatrix(
  target: THREE.Matrix4[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotation = 0,
): void {
  transform.position.set(x, y, z);
  transform.rotation.set(0, rotation, 0);
  transform.scale.set(width, height, depth);
  transform.updateMatrix();
  target.push(transform.matrix.clone());
}

function addOrientedMatrix(
  target: THREE.Matrix4[],
  centerX: number,
  y: number,
  centerZ: number,
  localX: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotation: number,
): void {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  addMatrix(
    target,
    centerX + localX * cosine + localZ * sine,
    y,
    centerZ - localX * sine + localZ * cosine,
    width,
    height,
    depth,
    rotation,
  );
}

function addInstances(
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  matrices: THREE.Matrix4[],
): THREE.InstancedMesh | null {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// shortcut: procedural grain tiles cleanly but is not photographic; use scanned PBR maps for true photo accuracy.
function surfaceTexture(
  base: string,
  random: RandomSource,
  type: "road" | "concrete",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a city surface texture");
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 6000; index++) {
    const shade = random() < 0.5 ? "0, 0, 0" : "255, 255, 255";
    const alpha = randomBetween(random, 0.015, type === "road" ? 0.11 : 0.08);
    const size = randomBetween(random, 0.5, type === "road" ? 3 : 2);
    context.fillStyle = `rgba(${shade}, ${alpha})`;
    context.fillRect(random() * 512, random() * 512, size, size);
  }
  const patchCount = type === "road" ? 32 : 18;
  for (let index = 0; index < patchCount; index++) {
    context.fillStyle = `rgba(0, 0, 0, ${randomBetween(random, 0.025, 0.1)})`;
    context.fillRect(
      random() * 512,
      random() * 512,
      randomBetween(random, 18, 92),
      randomBetween(random, 3, type === "road" ? 24 : 12),
    );
  }
  if (type === "concrete") {
    context.fillStyle = "rgba(20, 22, 22, 0.12)";
    for (let seam = 64; seam < 512; seam += 64) {
      context.fillRect(seam, 0, 1, 512);
      context.fillRect(0, seam, 512, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function billboardTexture(label: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the city billboard canvas");
  const gradient = context.createLinearGradient(0, 0, 1024, 320);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#242235");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 320);
  context.fillStyle = accent;
  context.fillRect(0, 0, 20, 320);
  context.fillStyle = "#ffffff";
  context.font = "900 142px sans-serif";
  context.fillText(label, 56, 172);
  context.fillStyle = "#d7fa73";
  context.font = "600 38px sans-serif";
  context.fillText("SHIBUYA  /  SCRAMBLE CROSSING  /  渋谷", 60, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCity(
  scene: THREE.Scene,
  random: RandomSource,
): {
  buildings: CityBuilding[];
  facadeMeshes: THREE.InstancedMesh[];
  obstacles: BuildingBounds[];
} {
  const rand = (min: number, max: number) => randomBetween(random, min, max);
  const buildings: CityBuilding[] = [];
  const facadeMaterials = ["#62696b", "#747372", "#5e6569", "#596b6c", "#766d70"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.08 }),
  );
  const facadeMatrices: THREE.Matrix4[][] = facadeMaterials.map(() => []);
  const facadeMeshes: THREE.InstancedMesh[] = [];
  const roofMatrices: THREE.Matrix4[] = [];
  const antennaMatrices: THREE.Matrix4[] = [];
  const litWindows: THREE.Matrix4[][] = Array.from({ length: 16 }, () => []);
  const darkWindows: THREE.Matrix4[][] = Array.from({ length: 16 }, () => []);
  const windowFrames: THREE.Matrix4[][] = Array.from({ length: 16 }, () => []);
  const floorBandMatrices: THREE.Matrix4[] = [];
  const acUnitMatrices: THREE.Matrix4[] = [];
  const roofEquipmentMatrices: THREE.Matrix4[] = [];
  const floorMatrices: THREE.Matrix4[] = [];
  const counterMatrices: THREE.Matrix4[] = [];
  const shelfMatrices: THREE.Matrix4[] = [];
  const pillarMatrices: THREE.Matrix4[] = [];
  const ceilingLightMatrices: THREE.Matrix4[] = [];
  const awningMatrices: THREE.Matrix4[][] = Array.from({ length: 4 }, () => []);
  const awningMaterials = ["#e64f49", "#d7a83e", "#42a6a0", "#596da7"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  const windowGeometry = new THREE.BoxGeometry(0.74, 1.02, 0.06);
  const windowFrameGeometry = new THREE.BoxGeometry(0.94, 1.22, 0.12);
  const windowFrameMaterial = new THREE.MeshStandardMaterial({
    color: "#414d52",
    metalness: 0.52,
    roughness: 0.48,
  });
  const floorBandMaterial = new THREE.MeshStandardMaterial({
    color: "#667075",
    roughness: 0.82,
    metalness: 0.08,
  });
  const acUnitMaterial = new THREE.MeshStandardMaterial({
    color: "#697276",
    metalness: 0.45,
    roughness: 0.64,
  });
  const roofEquipmentMaterial = new THREE.MeshStandardMaterial({
    color: "#51595d",
    metalness: 0.32,
    roughness: 0.78,
  });
  const litWindowMaterial = new THREE.MeshStandardMaterial({
    color: "#ffc774",
    emissive: "#ed9c43",
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.42,
  });
  const darkWindowMaterial = new THREE.MeshStandardMaterial({
    color: "#35404b",
    emissive: "#263b4d",
    emissiveIntensity: 0.06,
    roughness: 0.34,
    metalness: 0.28,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: "#686d70", roughness: 0.92 });
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: "#8e9998",
    metalness: 0.62,
    roughness: 0.42,
  });
  const interiorFloorMaterial = new THREE.MeshStandardMaterial({
    color: "#525151",
    roughness: 0.92,
  });
  const interiorFixtureMaterial = new THREE.MeshStandardMaterial({
    color: "#795d46",
    roughness: 0.86,
  });
  const interiorMetalMaterial = new THREE.MeshStandardMaterial({
    color: "#4a535a",
    roughness: 0.55,
    metalness: 0.35,
  });
  const interiorLightMaterial = new THREE.MeshBasicMaterial({ color: "#ffe2a5" });

  function addWindow(
    x: number,
    y: number,
    z: number,
    rotation: number,
    lit: boolean,
    chunk: number,
  ): void {
    const inwardX = Math.sin(rotation) * 0.05;
    const inwardZ = Math.cos(rotation) * 0.05;
    addMatrix(windowFrames[chunk], x + inwardX, y, z + inwardZ, 1, 1, 1, rotation);
    addMatrix(
      (lit ? litWindows : darkWindows)[chunk],
      x - inwardX,
      y,
      z - inwardZ,
      1,
      1,
      1,
      rotation,
    );
  }

  for (let gx = -8; gx <= 7; gx++) {
    for (let gz = -8; gz <= 7; gz++) {
      const x = gx * 24 + 12;
      const z = gz * 24 + 12;
      // Keep the four blocks around the famous crossing open as a pedestrian plaza.
      if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
      if (random() < 0.06) continue;
      const width = rand(9, 15);
      const depth = rand(9, 15);
      const height = rand(14, 58);
      const chunk = Math.floor((gx + 8) / 4) + Math.floor((gz + 8) / 4) * 4;
      const facade = Math.floor(random() * facadeMaterials.length);
      const minZ = z - depth / 2;
      const entranceWidth = Math.min(ENTRANCE_WIDTH, width - 2.4);

      // Hollow wall panels leave a real ground-floor entrance instead of a painted doorway.
      addMatrix(
        facadeMatrices[facade],
        x - (width + entranceWidth) / 4,
        height / 2,
        minZ,
        (width - entranceWidth) / 2,
        height,
        0.55,
      );
      addMatrix(
        facadeMatrices[facade],
        x + (width + entranceWidth) / 4,
        height / 2,
        minZ,
        (width - entranceWidth) / 2,
        height,
        0.55,
      );
      addMatrix(
        facadeMatrices[facade],
        x,
        (height + ENTRANCE_HEIGHT) / 2,
        minZ,
        entranceWidth,
        height - ENTRANCE_HEIGHT,
        0.55,
      );
      addMatrix(facadeMatrices[facade], x, height / 2, z + depth / 2, width, height, 0.55);
      addMatrix(facadeMatrices[facade], x - width / 2, height / 2, z, 0.55, height, depth, 0);
      addMatrix(facadeMatrices[facade], x + width / 2, height / 2, z, 0.55, height, depth, 0);
      addMatrix(roofMatrices, x, height + 0.27, z, width + 0.7, 0.55, depth + 0.7);
      addMatrix(floorMatrices, x, 0.04, z, width - 0.7, 0.08, depth - 0.7);
      addMatrix(counterMatrices, x, 0.57, z + depth * 0.31, width * 0.62, 1.05, 0.58);
      addMatrix(shelfMatrices, x - width * 0.34, 1.15, z + 0.3, 0.42, 2.2, depth * 0.46);
      addMatrix(shelfMatrices, x + width * 0.34, 1.15, z + 0.3, 0.42, 2.2, depth * 0.46);
      addMatrix(pillarMatrices, x - width * 0.34, 1.45, z - depth * 0.18, 0.3, 2.9, 0.3);
      addMatrix(pillarMatrices, x + width * 0.34, 1.45, z - depth * 0.18, 0.3, 2.9, 0.3);
      addMatrix(ceilingLightMatrices, x, 2.82, z, width * 0.64, 0.07, 0.16);
      const awning = Math.floor(random() * awningMatrices.length);
      addMatrix(awningMatrices[awning], x, 3.05, minZ - 0.35, width * 0.86, 0.42, 0.72);
      buildings.push({
        x,
        z,
        width,
        depth,
        height,
        entranceWidth,
        entranceHeight: ENTRANCE_HEIGHT,
      });

      for (let floor = 4.3; floor < height - 1; floor += 4.3) {
        addMatrix(floorBandMatrices, x, floor, minZ - 0.34, width + 0.4, 0.16, 0.16);
        addMatrix(floorBandMatrices, x, floor, z + depth / 2 + 0.34, width + 0.4, 0.16, 0.16);
        addMatrix(floorBandMatrices, x - width / 2 - 0.34, floor, z, 0.16, 0.16, depth + 0.4);
        addMatrix(floorBandMatrices, x + width / 2 + 0.34, floor, z, 0.16, 0.16, depth + 0.4);
        if (random() < 0.28) {
          addMatrix(
            acUnitMatrices,
            x + rand(-width * 0.3, width * 0.3),
            floor - 0.62,
            minZ - 0.55,
            0.82,
            0.48,
            0.38,
          );
        }
      }
      for (let floor = 2.6; floor < height - 1; floor += 4.3) {
        for (let offset = -width / 2 + 1.35; offset <= width / 2 - 1; offset += 3.7) {
          const skipEntrance = floor < 3.4 && Math.abs(offset) < entranceWidth / 2 + 0.55;
          if (!skipEntrance && random() > 0.28) {
            const lit = random() < 0.18;
            addWindow(x + offset, floor, minZ - 0.34, 0, lit, chunk);
            addWindow(x + offset, floor, z + depth / 2 + 0.34, Math.PI, lit, chunk);
          }
        }
        for (let offset = -depth / 2 + 1.35; offset <= depth / 2 - 1; offset += 3.7) {
          if (random() > 0.28) {
            const lit = random() < 0.18;
            addWindow(x - width / 2 - 0.34, floor, z + offset, Math.PI / 2, lit, chunk);
            addWindow(x + width / 2 + 0.34, floor, z + offset, -Math.PI / 2, lit, chunk);
          }
        }
      }

      const equipmentCount = random() < 0.55 ? 1 : 2;
      for (let equipment = 0; equipment < equipmentCount; equipment++) {
        addMatrix(
          roofEquipmentMatrices,
          x + rand(-width * 0.28, width * 0.28),
          height + 0.85,
          z + rand(-depth * 0.28, depth * 0.28),
          1.65,
          1.15,
          1.45,
        );
      }

      if (random() < 0.82) {
        const count = random() < 0.2 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const ax =
            x + (count === 1 ? rand(-width * 0.26, width * 0.26) : (i ? 1 : -1) * width * 0.23);
          const az =
            z + (count === 1 ? rand(-depth * 0.26, depth * 0.26) : rand(-depth * 0.2, depth * 0.2));
          const antennaHeight = rand(2.3, 5.5);
          addMatrix(antennaMatrices, ax, height + antennaHeight / 2, az, 1, antennaHeight, 1);
        }
      }
    }
  }

  for (const [index, material] of facadeMaterials.entries()) {
    const mesh = addInstances(scene, unitBox, material, facadeMatrices[index]);
    if (mesh) facadeMeshes.push(mesh);
  }
  addInstances(scene, unitBox, roofMaterial, roofMatrices);
  addInstances(scene, unitBox, floorBandMaterial, floorBandMatrices);
  addInstances(scene, unitBox, acUnitMaterial, acUnitMatrices);
  addInstances(scene, unitBox, roofEquipmentMaterial, roofEquipmentMatrices);
  addInstances(
    scene,
    new THREE.CylinderGeometry(0.09, 0.14, 1, 5),
    antennaMaterial,
    antennaMatrices,
  );
  addInstances(scene, unitBox, interiorFloorMaterial, floorMatrices);
  addInstances(scene, unitBox, interiorFixtureMaterial, counterMatrices);
  addInstances(scene, unitBox, interiorMetalMaterial, shelfMatrices);
  addInstances(scene, unitBox, interiorMetalMaterial, pillarMatrices);
  addInstances(scene, unitBox, interiorLightMaterial, ceilingLightMatrices);
  for (const [index, material] of awningMaterials.entries()) {
    addInstances(scene, unitBox, material, awningMatrices[index]);
  }
  for (let chunk = 0; chunk < litWindows.length; chunk++) {
    addInstances(scene, windowFrameGeometry, windowFrameMaterial, windowFrames[chunk]);
    addInstances(scene, windowGeometry, litWindowMaterial, litWindows[chunk]);
    addInstances(scene, windowGeometry, darkWindowMaterial, darkWindows[chunk]);
  }

  // Give the four storefronts closest to the crossing distinctive, readable skyline signs.
  const billboards: [string, string, number, number][] = [
    ["QFRONT", "#e55b9b", 1, -1],
    ["SHIBUYA 109", "#d7fa73", -1, -1],
    ["TOKYU", "#f0a343", 1, 1],
    ["MAGNET", "#72d5e5", -1, 1],
  ];
  const signGeometry = new THREE.PlaneGeometry(8.5, 2.65);
  for (const [label, accent, sx, sz] of billboards) {
    const building = buildings
      .filter((candidate) => Math.sign(candidate.x) === sx && Math.sign(candidate.z) === sz)
      .sort(
        (a, b) =>
          Math.hypot(a.x - sx * 36, a.z - sz * 36) - Math.hypot(b.x - sx * 36, b.z - sz * 36),
      )[0];
    if (!building) continue;
    const faceZ = Math.abs(building.z) >= Math.abs(building.x);
    const rotation = faceZ ? (sz < 0 ? 0 : Math.PI) : sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    const panel = new THREE.Mesh(
      signGeometry,
      new THREE.MeshBasicMaterial({ map: billboardTexture(label, accent), side: THREE.DoubleSide }),
    );
    panel.position.set(
      faceZ
        ? building.x
        : building.x + (sx < 0 ? building.width / 2 + 0.34 : -building.width / 2 - 0.34),
      Math.min(building.height - 2, Math.max(8, building.height * 0.58)),
      faceZ
        ? building.z + (sz < 0 ? building.depth / 2 + 0.34 : -building.depth / 2 - 0.34)
        : building.z,
    );
    panel.rotation.y = rotation;
    scene.add(panel);
  }

  const roadTexture = surfaceTexture("#343838", random, "road");
  roadTexture.repeat.set(54, 2);
  const sidewalkTexture = surfaceTexture("#626767", random, "concrete");
  sidewalkTexture.repeat.set(54, 0.25);
  const groundTexture = surfaceTexture("#555b5c", random, "concrete");
  groundTexture.repeat.set(68, 68);
  const plazaTexture = surfaceTexture("#555b5c", random, "concrete");
  plazaTexture.repeat.set(7, 7);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: groundTexture,
    roughness: 0.96,
    bumpMap: groundTexture,
    bumpScale: 0.025,
  });
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: roadTexture,
    roughness: 0.96,
    bumpMap: roadTexture,
    bumpScale: 0.035,
  });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: sidewalkTexture,
    roughness: 0.94,
    bumpMap: sidewalkTexture,
    bumpScale: 0.018,
  });
  const markingMaterial = new THREE.MeshBasicMaterial({ color: "#d9ded8" });
  const fadedMarking = new THREE.MeshBasicMaterial({
    color: "#67716d",
    transparent: true,
    opacity: 0.35,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: "#7d8583", roughness: 0.9 });
  const streetLampMaterial = new THREE.MeshStandardMaterial({
    color: "#555f68",
    metalness: 0.55,
    roughness: 0.42,
  });
  const treeBarkMaterial = new THREE.MeshStandardMaterial({ color: "#514235", roughness: 1 });
  const treeLeafMaterial = new THREE.MeshStandardMaterial({ color: "#3d6657", roughness: 1 });
  const glowingLampMaterial = new THREE.MeshBasicMaterial({ color: "#ffe5b1" });
  const trafficMaterial = new THREE.MeshStandardMaterial({
    color: "#20272d",
    metalness: 0.3,
    roughness: 0.5,
  });
  const signalRedMaterial = new THREE.MeshBasicMaterial({ color: "#ff4848" });
  const signalAmberMaterial = new THREE.MeshBasicMaterial({ color: "#413626" });
  const signalGreenMaterial = new THREE.MeshBasicMaterial({ color: "#263d34" });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(540, 540), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);
  const crossingSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 56),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: plazaTexture,
      roughness: 0.97,
      bumpMap: plazaTexture,
      bumpScale: 0.02,
    }),
  );
  crossingSurface.rotation.x = -Math.PI / 2;
  crossingSurface.position.y = -0.025;
  crossingSurface.receiveShadow = true;
  scene.add(crossingSurface);

  function groundStrips(
    width: number,
    depth: number,
    axis: "x" | "z",
    y: number,
    material: THREE.Material,
    offset = 0,
  ): void {
    const strips = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, depth), material, 9);
    for (let i = -4; i <= 4; i++) {
      transform.position.set(
        axis === "x" ? 0 : i * ROAD_SPACING + offset,
        y,
        axis === "x" ? i * ROAD_SPACING + offset : 0,
      );
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.updateMatrix();
      strips.setMatrixAt(i + 4, transform.matrix);
    }
    strips.instanceMatrix.needsUpdate = true;
    strips.receiveShadow = true;
    scene.add(strips);
  }
  groundStrips(460, 8, "x", 0.005, roadMaterial);
  groundStrips(8, 460, "z", 0.006, roadMaterial);
  for (const side of [-1, 1]) {
    groundStrips(460, 1.7, "x", 0.012, sidewalkMaterial, side * 5.1);
    groundStrips(1.7, 460, "z", 0.013, sidewalkMaterial, side * 5.1);
  }

  const roadDashes: THREE.Matrix4[] = [];
  for (let road = -4; road <= 4; road++) {
    for (let at = -220; at <= 220; at += 12) {
      addMatrix(roadDashes, at, 0.027, road * ROAD_SPACING, 6, 0.025, 0.18);
      addMatrix(roadDashes, road * ROAD_SPACING, 0.028, at, 6, 0.025, 0.18, Math.PI / 2);
    }
  }
  addInstances(scene, unitBox, fadedMarking, roadDashes);

  // Four zebra crossings and stop bars turn the open central plaza into a scramble crossing.
  const crosswalkMatrices: THREE.Matrix4[] = [];
  const stopLineMatrices: THREE.Matrix4[] = [];
  for (const side of [-1, 1]) {
    for (let stripe = -8; stripe <= 8; stripe++) {
      const offset = stripe * 0.92;
      addMatrix(crosswalkMatrices, offset, 0.045, side * 10.6, 0.58, 0.035, 12.8);
      addMatrix(crosswalkMatrices, side * 10.6, 0.046, offset, 12.8, 0.035, 0.58);
    }
    addMatrix(stopLineMatrices, 0, 0.047, side * 18.1, 16.5, 0.035, 0.22);
    addMatrix(stopLineMatrices, side * 18.1, 0.047, 0, 0.22, 0.035, 16.5);
  }
  addInstances(scene, unitBox, markingMaterial, crosswalkMatrices);
  addInstances(scene, unitBox, markingMaterial, stopLineMatrices);

  // Curbs, trees, lamps and the signal poles are instanced to keep the dense district light to render.
  const curbMatrices: THREE.Matrix4[] = [];
  const treeTrunks: THREE.Matrix4[] = [];
  const treeCrowns: THREE.Matrix4[] = [];
  const lampPosts: THREE.Matrix4[] = [];
  const lampArms: THREE.Matrix4[] = [];
  const lampHeads: THREE.Matrix4[] = [];
  const trafficPoles: THREE.Matrix4[] = [];
  const trafficHeads: THREE.Matrix4[] = [];
  const signalLenses: THREE.Matrix4[][] = [[], [], []];
  const manholeMatrices: THREE.Matrix4[] = [];
  const drainMatrices: THREE.Matrix4[] = [];
  const vehiclePaints = ["#d2d0c6", "#424a4d", "#7b3730", "#3d5960"];
  const vehicleMaterials = vehiclePaints.map(
    (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.58, roughness: 0.32 }),
  );
  const vehicleBodies: THREE.Matrix4[][] = vehicleMaterials.map(() => []);
  const vehicleCabins: THREE.Matrix4[][] = vehicleMaterials.map(() => []);
  const vehicleGlass: THREE.Matrix4[] = [];
  const vehicleWheels: THREE.Matrix4[] = [];
  const vehicleBumpers: THREE.Matrix4[] = [];
  const vehicleHeadlights: THREE.Matrix4[] = [];
  const vehicleTailLights: THREE.Matrix4[] = [];
  const vehicleObstacles: BuildingBounds[] = [];
  const manholeMaterial = new THREE.MeshStandardMaterial({
    color: "#303435",
    metalness: 0.68,
    roughness: 0.76,
  });
  const drainMaterial = new THREE.MeshStandardMaterial({
    color: "#25292a",
    metalness: 0.65,
    roughness: 0.78,
  });
  const vehicleGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: "#29383e",
    metalness: 0.32,
    roughness: 0.19,
    clearcoat: 0.7,
  });
  const vehicleWheelMaterial = new THREE.MeshStandardMaterial({ color: "#181b1c", roughness: 0.9 });
  const vehicleBumperMaterial = new THREE.MeshStandardMaterial({
    color: "#363b3d",
    metalness: 0.42,
    roughness: 0.58,
  });
  const vehicleHeadlightMaterial = new THREE.MeshStandardMaterial({
    color: "#d4cdb1",
    emissive: "#71694c",
    emissiveIntensity: 0.14,
    roughness: 0.3,
  });
  const vehicleTailLightMaterial = new THREE.MeshStandardMaterial({
    color: "#732e2c",
    emissive: "#421412",
    emissiveIntensity: 0.2,
    roughness: 0.3,
  });
  for (let road = -4; road <= 4; road++) {
    for (let segment = -4; segment < 4; segment += 2) {
      const along = segment * ROAD_SPACING + ROAD_SPACING / 2;
      if (Math.abs(along) < 30 && Math.abs(road * ROAD_SPACING) < 30) continue;
      addMatrix(manholeMatrices, along, 0.025, road * ROAD_SPACING, 1, 0.035, 1);
      addMatrix(manholeMatrices, road * ROAD_SPACING, 0.026, along, 1, 0.035, 1);
      for (const side of [-1, 1]) {
        addMatrix(drainMatrices, along, 0.035, road * ROAD_SPACING + side * 3.45, 1.1, 0.025, 0.28);
        addMatrix(
          drainMatrices,
          road * ROAD_SPACING + side * 3.45,
          0.036,
          along,
          1.1,
          0.025,
          0.28,
          Math.PI / 2,
        );
      }
    }
  }
  for (let roadX = -4; roadX <= 4; roadX++) {
    for (let roadZ = -4; roadZ <= 4; roadZ++) {
      const x = roadX * ROAD_SPACING;
      const z = roadZ * ROAD_SPACING;
      if (!(Math.abs(x) < 30 && Math.abs(z) < 30)) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            addMatrix(curbMatrices, x + sx * 5.95, 0.09, z + sz * 5.95, 0.16, 0.18, 0.16);
          }
        }
      }
      if (Math.abs(roadX) <= 1 && Math.abs(roadZ) <= 1) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const px = x + sx * 7.4;
            const pz = z + sz * 7.4;
            addMatrix(trafficPoles, px, 2.45, pz, 0.16, 4.9, 0.16);
            addMatrix(trafficHeads, px - sx * 0.72, 4.2, pz - sz * 0.25, 0.42, 0.88, 0.36);
            addMatrix(signalLenses[0], px - sx * 0.72, 4.47, pz - sz * 0.44, 0.17, 0.17, 0.07);
            addMatrix(signalLenses[1], px - sx * 0.72, 4.2, pz - sz * 0.44, 0.17, 0.17, 0.07);
            addMatrix(signalLenses[2], px - sx * 0.72, 3.93, pz - sz * 0.44, 0.17, 0.17, 0.07);
          }
        }
      }
    }
  }
  for (let road = -4; road <= 4; road++) {
    for (let segment = -4; segment < 4; segment++) {
      const along = segment * ROAD_SPACING + ROAD_SPACING / 2;
      for (const side of [-1, 1]) {
        const positions: [number, number, number][] = [
          [along, side * 5.1, 0],
          [side * 5.1, along, 0],
        ];
        for (const [x, z] of positions) {
          addMatrix(treeTrunks, x, 1.15, z, 0.28, 2.3, 0.28);
          addMatrix(treeCrowns, x, 3.05, z, 1.55, 2.15, 1.55);
        }
      }
    }
  }
  for (let roadX = -4; roadX <= 4; roadX++) {
    for (let roadZ = -4; roadZ <= 4; roadZ++) {
      if ((roadX + roadZ) % 2 !== 0) continue;
      const x = roadX * ROAD_SPACING;
      const z = roadZ * ROAD_SPACING;
      if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
      for (const sx of [-1, 1]) {
        const px = x + sx * 5.65;
        const pz = z + (sx > 0 ? -5.7 : 5.7);
        addMatrix(lampPosts, px, 2.5, pz, 0.18, 5, 0.18);
        addMatrix(lampArms, px - sx * 0.75, 4.8, pz, 1.55, 0.12, 0.16);
        addMatrix(lampHeads, px - sx * 1.42, 4.72, pz, 0.68, 0.18, 0.52);
      }
    }
  }
  addInstances(
    scene,
    new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    manholeMaterial,
    manholeMatrices,
  );
  addInstances(scene, unitBox, drainMaterial, drainMatrices);
  addInstances(scene, unitBox, curbMaterial, curbMatrices);
  addInstances(scene, new THREE.CylinderGeometry(0.14, 0.2, 1, 6), treeBarkMaterial, treeTrunks);
  addInstances(scene, new THREE.DodecahedronGeometry(0.5, 1), treeLeafMaterial, treeCrowns);
  addInstances(scene, new THREE.CylinderGeometry(0.09, 0.13, 1, 6), streetLampMaterial, lampPosts);
  addInstances(scene, unitBox, streetLampMaterial, lampArms);
  addInstances(scene, unitBox, glowingLampMaterial, lampHeads);
  addInstances(
    scene,
    new THREE.CylinderGeometry(0.06, 0.09, 1, 6),
    streetLampMaterial,
    trafficPoles,
  );
  addInstances(scene, unitBox, trafficMaterial, trafficHeads);

  for (let index = 0; index < 18; index++) {
    const axis: "x" | "z" = random() < 0.5 ? "x" : "z";
    const lane = (Math.floor(random() * 9) - 4) * ROAD_SPACING;
    const along = rand(-210, 210);
    const side = random() < 0.5 ? -1 : 1;
    const x = axis === "x" ? along : lane + side * 2.4;
    const z = axis === "x" ? lane + side * 2.4 : along;
    if (Math.abs(x) < 28 && Math.abs(z) < 28) continue;
    const rotation = axis === "x" ? Math.PI / 2 : 0;
    const paint = Math.floor(random() * vehicleMaterials.length);
    addMatrix(vehicleBodies[paint], x, 0.5, z, 1.9, 0.62, 4.25, rotation);
    addMatrix(vehicleCabins[paint], x, 1.03, z, 1.48, 0.62, 2.1, rotation);
    addOrientedMatrix(vehicleGlass, x, 1.08, z, 0, -0.1, 1.34, 0.34, 1.95, rotation);
    addOrientedMatrix(vehicleBumpers, x, 0.32, z, 0, -2.16, 1.9, 0.12, 0.16, rotation);
    addOrientedMatrix(vehicleBumpers, x, 0.32, z, 0, 2.16, 1.9, 0.12, 0.16, rotation);
    addOrientedMatrix(vehicleHeadlights, x, 0.55, z, -0.58, -2.16, 0.24, 0.15, 0.045, rotation);
    addOrientedMatrix(vehicleHeadlights, x, 0.55, z, 0.58, -2.16, 0.24, 0.15, 0.045, rotation);
    addOrientedMatrix(vehicleTailLights, x, 0.55, z, -0.58, 2.16, 0.24, 0.18, 0.045, rotation);
    addOrientedMatrix(vehicleTailLights, x, 0.55, z, 0.58, 2.16, 0.24, 0.18, 0.045, rotation);
    for (const wheelX of [-0.94, 0.94]) {
      for (const wheelZ of [-1.38, 1.38]) {
        addOrientedMatrix(vehicleWheels, x, 0.32, z, wheelX, wheelZ, 1, 1, 1, rotation);
      }
    }
    vehicleObstacles.push({
      x,
      z,
      width: axis === "x" ? 4.25 : 1.9,
      depth: axis === "x" ? 1.9 : 4.25,
      height: 1.4,
      entranceWidth: 0,
      entranceHeight: 0,
    });
  }

  addInstances(scene, unitBox, vehicleBumperMaterial, vehicleBumpers);
  for (let index = 0; index < vehicleMaterials.length; index++) {
    addInstances(scene, unitBox, vehicleMaterials[index], vehicleBodies[index]);
    addInstances(scene, unitBox, vehicleMaterials[index], vehicleCabins[index]);
  }
  addInstances(scene, unitBox, vehicleGlassMaterial, vehicleGlass);
  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  addInstances(scene, wheelGeometry, vehicleWheelMaterial, vehicleWheels);
  addInstances(scene, unitBox, vehicleHeadlightMaterial, vehicleHeadlights);
  addInstances(scene, unitBox, vehicleTailLightMaterial, vehicleTailLights);
  for (let index = 0; index < signalLenses.length; index++) {
    addInstances(
      scene,
      new THREE.SphereGeometry(0.1, 8, 6),
      [signalRedMaterial, signalAmberMaterial, signalGreenMaterial][index],
      signalLenses[index],
    );
  }

  const station = new THREE.Group();
  station.position.set(-15.5, 0, 15.5);
  const stationFrameMaterial = new THREE.MeshStandardMaterial({
    color: "#3e4d55",
    metalness: 0.55,
    roughness: 0.48,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.1, 0.18), stationFrameMaterial);
    post.position.set(side * 3.2, 2.05, 0);
    station.add(post);
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(6.55, 0.2, 0.2), stationFrameMaterial);
  crossbar.position.y = 4.05;
  station.add(crossbar);
  const stationPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 1.8),
    new THREE.MeshBasicMaterial({
      map: billboardTexture("渋谷駅", "#72d5e5"),
      side: THREE.DoubleSide,
    }),
  );
  stationPanel.position.set(0, 4.95, -0.03);
  stationPanel.rotation.y = Math.PI;
  station.add(stationPanel);
  scene.add(station);

  const hachiko = new THREE.Group();
  hachiko.position.set(-15.5, 0, 11.8);
  const bronzeMaterial = new THREE.MeshStandardMaterial({
    color: "#866b43",
    metalness: 0.62,
    roughness: 0.48,
  });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#595d5d", roughness: 0.88 });
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.58, 1.45), stoneMaterial);
  pedestal.position.y = 0.29;
  hachiko.add(pedestal);
  const dogBody = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bronzeMaterial);
  dogBody.scale.set(1.25, 0.75, 0.9);
  dogBody.position.set(0, 1.08, 0.08);
  hachiko.add(dogBody);
  const dogNeck = new THREE.Mesh(new THREE.SphereGeometry(0.32, 9, 7), bronzeMaterial);
  dogNeck.scale.set(0.88, 1.15, 0.9);
  dogNeck.position.set(0, 1.35, -0.3);
  hachiko.add(dogNeck);
  const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 9, 7), bronzeMaterial);
  dogHead.position.set(0, 1.62, -0.48);
  hachiko.add(dogHead);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bronzeMaterial);
  muzzle.scale.set(1, 0.62, 1.2);
  muzzle.position.set(0, 1.52, -0.73);
  hachiko.add(muzzle);
  const earGeometry = new THREE.ConeGeometry(0.11, 0.28, 6);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, bronzeMaterial);
    ear.position.set(side * 0.2, 1.86, -0.48);
    ear.rotation.z = side * -0.25;
    hachiko.add(ear);
    for (const z of [-0.24, 0.27]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.56, 7), bronzeMaterial);
      leg.position.set(side * 0.2, 0.75, z);
      hachiko.add(leg);
    }
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.4, 7), bronzeMaterial);
  tail.position.set(0, 1.35, 0.57);
  tail.rotation.x = Math.PI / 3;
  hachiko.add(tail);
  scene.add(hachiko);

  return { buildings, facadeMeshes, obstacles: vehicleObstacles };
}

export function resolveBuildingCollision(
  position: THREE.Vector3,
  previousPosition: THREE.Vector3,
  velocity: THREE.Vector3,
  buildings: BuildingBounds[],
  previousY: number,
): void {
  for (const building of buildings) {
    const minX = building.x - building.width / 2;
    const maxX = building.x + building.width / 2;
    const minZ = building.z - building.depth / 2;
    const maxZ = building.z + building.depth / 2;
    const entranceWidth = building.entranceWidth ?? 0;
    const entranceHeight = building.entranceHeight ?? 0;
    const wasInside =
      previousPosition.x > minX &&
      previousPosition.x < maxX &&
      previousPosition.z > minZ &&
      previousPosition.z < maxZ;
    const isInside =
      position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ;

    if (
      previousY >= building.height &&
      position.y < building.height &&
      velocity.y <= 0 &&
      isInside
    ) {
      position.y = building.height;
      velocity.y = 0;
      return;
    }
    if (position.y >= building.height || position.y + 1.9 <= 0) continue;

    if (isInside && position.y + 1.9 > building.height) {
      position.y = building.height - 1.9;
      velocity.y = 0;
    }
    if (wasInside !== isInside) {
      const crossedFront =
        (previousPosition.z <= minZ && position.z > minZ) ||
        (previousPosition.z >= minZ && position.z < minZ);
      const withinDoor =
        Math.abs(position.x - building.x) < entranceWidth / 2 - 0.15 &&
        Math.abs(previousPosition.x - building.x) < entranceWidth / 2 - 0.15 &&
        position.y + 1.9 <= entranceHeight &&
        crossedFront;
      if (!withinDoor) {
        position.x = previousPosition.x;
        position.z = previousPosition.z;
        velocity.x = 0;
        velocity.z = 0;
      }
      continue;
    }
    if (isInside) continue;

    const overlapX = building.width / 2 + 0.48 - Math.abs(position.x - building.x);
    const overlapZ = building.depth / 2 + 0.48 - Math.abs(position.z - building.z);
    if (overlapX <= 0 || overlapZ <= 0) continue;
    const approachingDoor =
      Math.abs(position.x - building.x) < entranceWidth / 2 - 0.15 &&
      position.z < minZ &&
      position.z > minZ - 0.48;
    if (approachingDoor && position.y + 1.9 <= entranceHeight) continue;

    if (overlapX < overlapZ) {
      const side = position.x < building.x ? -1 : 1;
      position.x = building.x + side * (building.width / 2 + 0.48);
      velocity.x = 0;
    } else {
      const side = position.z < building.z ? -1 : 1;
      position.z = building.z + side * (building.depth / 2 + 0.48);
      velocity.z = 0;
    }
  }
}
