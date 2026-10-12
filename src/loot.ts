import * as THREE from "three";
import { nearestRoadPosition, terrainHeight } from "./city-layout.ts";
import type { Position3, RandomSource } from "./game-types.ts";
import { randomBetween } from "./game-utils.ts";
import type { AmmoType } from "./weapons.ts";

interface PickupBase {
  group: THREE.Group;
  phase: number;
  collected: boolean;
  baseY?: number;
}

export interface AmmoPickup extends PickupBase {
  kind: "ammo";
  ammoType: AmmoType;
}

export interface MedkitPickup extends PickupBase {
  kind: "medkit";
  amount: number;
}

export type LootPickup = AmmoPickup | MedkitPickup;

const crateGeometry = new THREE.BoxGeometry(0.9, 0.55, 0.72);
const medkitGeometry = new THREE.BoxGeometry(0.78, 0.54, 0.68);
const ammoMaterials: Record<AmmoType, THREE.MeshStandardMaterial> = {
  sniper: new THREE.MeshStandardMaterial({
    color: "#b8873e",
    emissive: "#4d3211",
    metalness: 0.45,
    roughness: 0.42,
  }),
  assault: new THREE.MeshStandardMaterial({
    color: "#bc623a",
    emissive: "#512311",
    metalness: 0.35,
    roughness: 0.5,
  }),
};
const medkitMaterial = new THREE.MeshStandardMaterial({
  color: "#e8ebe2",
  emissive: "#4d5a3f",
  roughness: 0.55,
});
const redMaterial = new THREE.MeshBasicMaterial({ color: "#ed534c" });
const ammoGlowMaterial = new THREE.MeshBasicMaterial({ color: "#ffe17b" });
const medkitGlowMaterial = new THREE.MeshBasicMaterial({ color: "#8affb1" });
const ringGeometry = new THREE.TorusGeometry(0.72, 0.045, 5, 20);
const beaconGeometry = new THREE.CylinderGeometry(0.035, 0.06, 0.65, 6);
const bulletGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.32, 6);

function makePickupGroup(kind: LootPickup["kind"], ammoType?: AmmoType): THREE.Group {
  const group = new THREE.Group();
  const isMedkit = kind === "medkit";
  const accent = isMedkit ? medkitGlowMaterial : ammoGlowMaterial;
  const ring = new THREE.Mesh(ringGeometry, accent);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  const beacon = new THREE.Mesh(beaconGeometry, accent);
  beacon.position.y = 0.76;
  group.add(beacon);

  const box = new THREE.Mesh(
    isMedkit ? medkitGeometry : crateGeometry,
    isMedkit ? medkitMaterial : ammoMaterials[ammoType ?? "sniper"],
  );
  box.position.y = 0.38;
  group.add(box);

  if (isMedkit) {
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.04), redMaterial);
    vertical.position.set(0, 0.39, -0.35);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.04), redMaterial);
    horizontal.position.set(0, 0.39, -0.35);
    group.add(vertical, horizontal);
  } else {
    for (let index = -1; index <= 1; index++) {
      const bullet = new THREE.Mesh(bulletGeometry, ammoGlowMaterial);
      bullet.position.set(index * 0.2, 0.78, 0);
      group.add(bullet);
    }
  }
  return group;
}

function roadPosition(random: RandomSource): [number, number] {
  const x = randomBetween(random, -210, 210);
  const z = randomBetween(random, -210, 210);
  const nearest = nearestRoadPosition(x, z);
  return [nearest.x, nearest.z];
}

export function createLoot(scene: THREE.Scene, random: RandomSource): LootPickup[] {
  const pickups: LootPickup[] = [];
  const place = (pickup: LootPickup) => {
    const [x, z] = roadPosition(random);
    pickup.baseY = terrainHeight(x, z);
    pickup.group.position.set(x, pickup.baseY + 0.1, z);
    scene.add(pickup.group);
    pickups.push(pickup);
  };

  for (let index = 0; index < 12; index++) {
    const ammoType: AmmoType = random() < 0.5 ? "sniper" : "assault";
    place({
      kind: "ammo",
      ammoType,
      group: makePickupGroup("ammo", ammoType),
      phase: randomBetween(random, 0, Math.PI * 2),
      collected: false,
    });
  }
  for (let index = 0; index < 8; index++) {
    place({
      kind: "medkit",
      amount: 40,
      group: makePickupGroup("medkit"),
      phase: randomBetween(random, 0, Math.PI * 2),
      collected: false,
    });
  }
  return pickups;
}

export function updateLoot(
  pickups: LootPickup[],
  player: Position3,
  time: number,
  canCollect: (pickup: LootPickup) => boolean,
): LootPickup[] {
  const collected: LootPickup[] = [];
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    pickup.group.position.y = (pickup.baseY ?? 0) + 0.1 + Math.sin(time * 2 + pickup.phase) * 0.08;
    pickup.group.rotation.y = time * 0.55 + pickup.phase;
    const dx = player.x - pickup.group.position.x;
    const dz = player.z - pickup.group.position.z;
    if (dx * dx + dz * dz > 3.2 ** 2 || Math.abs(player.y - pickup.group.position.y) > 3) continue;
    if (!canCollect(pickup)) continue;
    pickup.collected = true;
    pickup.group.visible = false;
    collected.push(pickup);
  }
  return collected;
}
