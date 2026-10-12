export type AmmoType = "sniper" | "assault";

export interface Weapon {
  name: string;
  ammoType: AmmoType;
  range: number;
  fireInterval: number;
  automatic: boolean;
  damage: number;
  magazineSize: number;
  magazine: number;
  reserve: number;
  maxReserve: number;
  pickupAmount: number;
  emptyNoticeShown: boolean;
}

const WEAPON_LOADOUTS: Omit<Weapon, "emptyNoticeShown">[] = [
  {
    name: "SNIPER",
    ammoType: "sniper",
    range: 220,
    fireInterval: 550,
    automatic: false,
    damage: 100,
    magazineSize: 6,
    magazine: 6,
    reserve: 12,
    maxReserve: 36,
    pickupAmount: 6,
  },
  {
    name: "ASSAULT MG",
    ammoType: "assault",
    range: 90,
    fireInterval: 95,
    automatic: true,
    damage: 25,
    magazineSize: 30,
    magazine: 30,
    reserve: 60,
    maxReserve: 150,
    pickupAmount: 30,
  },
];

export function createWeapons(): Weapon[] {
  return WEAPON_LOADOUTS.map((weapon) => ({ ...weapon, emptyNoticeShown: false }));
}

export function consumeRound(weapon: Weapon): boolean {
  if (weapon.magazine <= 0) return false;
  weapon.magazine--;
  return true;
}

export function reloadWeapon(weapon: Weapon): number {
  const rounds = Math.min(weapon.magazineSize - weapon.magazine, weapon.reserve);
  weapon.magazine += rounds;
  weapon.reserve -= rounds;
  weapon.emptyNoticeShown = false;
  return rounds;
}

export function addAmmo(weapon: Weapon, amount = weapon.pickupAmount): number {
  const rounds = Math.min(weapon.maxReserve - weapon.reserve, amount);
  weapon.reserve += rounds;
  return rounds;
}
