export function constrainRope(position, velocity, anchor, length) {
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
  if (outwardSpeed > 0) velocity.addScaledVector({ x: nx, y: ny, z: nz }, -outwardSpeed);
  return true;
}
