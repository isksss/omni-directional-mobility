import type * as THREE from "three";

export function constrainRope(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  anchor: THREE.Vector3,
  length: number,
): boolean {
  const dx = position.x - anchor.x;
  const dy = position.y - anchor.y;
  const dz = position.z - anchor.z;
  const distance = Math.hypot(dx, dy, dz);

  if (distance <= length || distance === 0) return false;

  const nx = dx / distance;
  const ny = dy / distance;
  const nz = dz / distance;
  position.set(anchor.x + nx * length, anchor.y + ny * length, anchor.z + nz * length);

  const outwardSpeed = velocity.x * nx + velocity.y * ny + velocity.z * nz;
  if (outwardSpeed > 0) {
    velocity.set(
      velocity.x - nx * outwardSpeed,
      velocity.y - ny * outwardSpeed,
      velocity.z - nz * outwardSpeed,
    );
  }
  return true;
}
