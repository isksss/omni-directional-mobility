export type RandomSource = () => number;

export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export interface BuildingBounds {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  baseY?: number;
  entranceBaseY?: number;
  entranceWidth?: number;
  entranceHeight?: number;
}
