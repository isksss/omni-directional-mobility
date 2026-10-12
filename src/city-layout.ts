export interface MapPoint {
  x: number;
  z: number;
}

export interface CityRoad {
  id: string;
  name: string;
  from: string;
  to: string;
  width: number;
  kind: "arterial" | "street" | "alley" | "pedestrian";
  points: readonly MapPoint[];
}

export interface RoadSample extends MapPoint {
  distance: number;
  heading: number;
}

export const CITY_NODES: Readonly<Record<string, MapPoint>> = {
  scramble: { x: 0, z: 0 },
  hachiko: { x: -18, z: 17 },
  dogenGate: { x: -36, z: -8 },
  dogenMid: { x: -102, z: -30 },
  dogenTop: { x: -210, z: -70 },
  bunkamura: { x: -48, z: 36 },
  shoto: { x: -130, z: 150 },
  koenGate: { x: -28, z: -32 },
  meijiCross: { x: 43, z: 0 },
  meijiMid: { x: 44, z: -90 },
  meijiNorth: { x: 49, z: -215 },
  meijiSouth: { x: 72, z: 215 },
  miyamaBase: { x: 75, z: 27 },
  miyamaMid: { x: 127, z: 78 },
  miyamaTop: { x: 215, z: 126 },
  aoyamaMid: { x: 124, z: -55 },
  aoyamaTop: { x: 215, z: -128 },
};

const point = (node: keyof typeof CITY_NODES): MapPoint => CITY_NODES[node];

// A compact, connected street graph: the crossing is the low point, with the named hill roads radiating out.
export const CITY_ROADS: readonly CityRoad[] = [
  {
    id: "dogen-lower",
    name: "道玄坂",
    from: "scramble",
    to: "dogenGate",
    width: 13,
    kind: "arterial",
    points: [point("scramble"), { x: -12, z: -2 }, { x: -23, z: -4 }, point("dogenGate")],
  },
  {
    id: "dogen-middle",
    name: "道玄坂",
    from: "dogenGate",
    to: "dogenMid",
    width: 11,
    kind: "arterial",
    points: [point("dogenGate"), { x: -52, z: -10 }, { x: -77, z: -19 }, point("dogenMid")],
  },
  {
    id: "dogen-upper",
    name: "道玄坂",
    from: "dogenMid",
    to: "dogenTop",
    width: 9,
    kind: "street",
    points: [
      point("dogenMid"),
      { x: -126, z: -38 },
      { x: -151, z: -51 },
      { x: -180, z: -64 },
      point("dogenTop"),
    ],
  },
  {
    id: "bunkamura-dori",
    name: "文化村通り",
    from: "dogenGate",
    to: "bunkamura",
    width: 8,
    kind: "street",
    points: [point("dogenGate"), { x: -43, z: 4 }, { x: -47, z: 18 }, point("bunkamura")],
  },
  {
    id: "shoto-avenue",
    name: "松濤文化村通り",
    from: "bunkamura",
    to: "shoto",
    width: 7,
    kind: "street",
    points: [
      point("bunkamura"),
      { x: -66, z: 54 },
      { x: -91, z: 83 },
      { x: -115, z: 116 },
      point("shoto"),
    ],
  },
  {
    id: "koen-lower",
    name: "公園通り",
    from: "scramble",
    to: "koenGate",
    width: 8,
    kind: "street",
    points: [point("scramble"), { x: -10, z: -11 }, { x: -21, z: -24 }, point("koenGate")],
  },
  {
    id: "koen-upper",
    name: "公園通り",
    from: "koenGate",
    to: "shoto",
    width: 7,
    kind: "street",
    points: [
      point("koenGate"),
      { x: -39, z: -48 },
      { x: -57, z: -67 },
      { x: -82, z: -91 },
      { x: -106, z: -119 },
      point("shoto"),
    ],
  },
  {
    id: "dogen-shoto-alley",
    name: "百軒店の路地",
    from: "dogenMid",
    to: "shoto",
    width: 5,
    kind: "alley",
    points: [
      point("dogenMid"),
      { x: -91, z: -7 },
      { x: -102, z: 22 },
      { x: -121, z: 52 },
      { x: -137, z: 89 },
      point("shoto"),
    ],
  },
  {
    id: "station-front",
    name: "ハチ公前広場",
    from: "scramble",
    to: "hachiko",
    width: 5,
    kind: "pedestrian",
    points: [point("scramble"), { x: -7, z: 4 }, { x: -13, z: 11 }, point("hachiko")],
  },
  {
    id: "hachiko-dogen-alley",
    name: "駅前裏通り",
    from: "hachiko",
    to: "dogenGate",
    width: 5,
    kind: "alley",
    points: [point("hachiko"), { x: -25, z: 13 }, { x: -32, z: 5 }, point("dogenGate")],
  },
  {
    id: "station-east-link",
    name: "明治通り接続路",
    from: "scramble",
    to: "meijiCross",
    width: 9,
    kind: "street",
    points: [point("scramble"), { x: 12, z: 2 }, { x: 26, z: 3 }, point("meijiCross")],
  },
  {
    id: "meiji-north-lower",
    name: "明治通り",
    from: "meijiCross",
    to: "meijiMid",
    width: 10,
    kind: "arterial",
    points: [
      point("meijiCross"),
      { x: 45, z: -24 },
      { x: 42, z: -49 },
      { x: 43, z: -70 },
      point("meijiMid"),
    ],
  },
  {
    id: "meiji-north-upper",
    name: "明治通り",
    from: "meijiMid",
    to: "meijiNorth",
    width: 11,
    kind: "arterial",
    points: [
      point("meijiMid"),
      { x: 42, z: -123 },
      { x: 44, z: -156 },
      { x: 46, z: -186 },
      point("meijiNorth"),
    ],
  },
  {
    id: "meiji-south",
    name: "明治通り",
    from: "meijiCross",
    to: "meijiSouth",
    width: 10,
    kind: "arterial",
    points: [
      point("meijiCross"),
      { x: 46, z: 30 },
      { x: 51, z: 65 },
      { x: 57, z: 102 },
      { x: 66, z: 157 },
      point("meijiSouth"),
    ],
  },
  {
    id: "miyamasuzaka-lower",
    name: "宮益坂",
    from: "meijiCross",
    to: "miyamaBase",
    width: 11,
    kind: "arterial",
    points: [
      point("meijiCross"),
      { x: 54, z: 2 },
      { x: 65, z: 7 },
      { x: 71, z: 15 },
      point("miyamaBase"),
    ],
  },
  {
    id: "miyamasuzaka-middle",
    name: "宮益坂",
    from: "miyamaBase",
    to: "miyamaMid",
    width: 9,
    kind: "street",
    points: [
      point("miyamaBase"),
      { x: 85, z: 38 },
      { x: 98, z: 51 },
      { x: 112, z: 64 },
      point("miyamaMid"),
    ],
  },
  {
    id: "miyamasuzaka-upper",
    name: "宮益坂",
    from: "miyamaMid",
    to: "miyamaTop",
    width: 8,
    kind: "street",
    points: [
      point("miyamaMid"),
      { x: 151, z: 91 },
      { x: 177, z: 105 },
      { x: 197, z: 117 },
      point("miyamaTop"),
    ],
  },
  {
    id: "aoyama-lower",
    name: "青山通り",
    from: "meijiCross",
    to: "aoyamaMid",
    width: 11,
    kind: "arterial",
    points: [
      point("meijiCross"),
      { x: 61, z: -9 },
      { x: 82, z: -23 },
      { x: 104, z: -41 },
      point("aoyamaMid"),
    ],
  },
  {
    id: "aoyama-upper",
    name: "青山通り",
    from: "aoyamaMid",
    to: "aoyamaTop",
    width: 9,
    kind: "arterial",
    points: [
      point("aoyamaMid"),
      { x: 146, z: -72 },
      { x: 169, z: -89 },
      { x: 190, z: -108 },
      point("aoyamaTop"),
    ],
  },
  {
    id: "east-backstreet",
    name: "宮下裏通り",
    from: "meijiMid",
    to: "aoyamaMid",
    width: 5,
    kind: "alley",
    points: [
      point("meijiMid"),
      { x: 62, z: -78 },
      { x: 83, z: -64 },
      { x: 104, z: -55 },
      point("aoyamaMid"),
    ],
  },
  {
    id: "meiji-shoto-connector",
    name: "神南の坂道",
    from: "meijiMid",
    to: "koenGate",
    width: 6,
    kind: "alley",
    points: [
      point("meijiMid"),
      { x: 24, z: -80 },
      { x: 4, z: -66 },
      { x: -13, z: -50 },
      point("koenGate"),
    ],
  },
  {
    id: "south-east-connector",
    name: "宮益坂南側の道",
    from: "meijiSouth",
    to: "miyamaTop",
    width: 6,
    kind: "street",
    points: [
      point("meijiSouth"),
      { x: 107, z: 192 },
      { x: 141, z: 167 },
      { x: 175, z: 146 },
      point("miyamaTop"),
    ],
  },
];

const ROAD_SUBDIVISIONS = 12;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function makeRoadSamples(road: CityRoad): RoadSample[] {
  const points: MapPoint[] = [];
  for (let segment = 0; segment < road.points.length - 1; segment++) {
    const p0 = road.points[Math.max(0, segment - 1)]!;
    const p1 = road.points[segment]!;
    const p2 = road.points[segment + 1]!;
    const p3 = road.points[Math.min(road.points.length - 1, segment + 2)]!;
    for (let index = 0; index < ROAD_SUBDIVISIONS; index++) {
      const t = index / ROAD_SUBDIVISIONS;
      points.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      });
    }
  }
  points.push(road.points[road.points.length - 1]!);
  let distance = 0;
  return points.map((current, index) => {
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    if (index > 0) distance += Math.hypot(current.x - previous.x, current.z - previous.z);
    return {
      ...current,
      distance,
      heading: Math.atan2(-(next.x - previous.x), -(next.z - previous.z)),
    };
  });
}

export const CITY_ROAD_SAMPLES = CITY_ROADS.map((road) => makeRoadSamples(road));
const roadById = new Map(CITY_ROADS.map((road) => [road.id, road]));
const roadSamplesById = new Map(
  CITY_ROADS.map((road, index) => [road.id, CITY_ROAD_SAMPLES[index]!]),
);
const rawOriginHeight =
  18 * Math.exp(-((155 / 105) ** 2 + (38 / 82) ** 2)) +
  17 * Math.exp(-((105 / 105) ** 2 + (110 / 95) ** 2)) +
  16 * Math.exp(-((135 / 110) ** 2 + (85 / 100) ** 2)) +
  12 * Math.exp(-((20 / 120) ** 2 + (200 / 100) ** 2));

export function terrainHeight(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const radialRise = Math.max(0, radius - 20) * 0.045;
  const dogenzakaHill = 18 * Math.exp(-(((x + 155) / 105) ** 2 + ((z + 38) / 82) ** 2));
  const shotoHill = 17 * Math.exp(-(((x + 105) / 105) ** 2 + ((z - 110) / 95) ** 2));
  const miyamasuzakaHill = 16 * Math.exp(-(((x - 135) / 110) ** 2 + ((z - 85) / 100) ** 2));
  const northHill = 12 * Math.exp(-(((x - 20) / 120) ** 2 + ((z + 200) / 100) ** 2));
  const valley = 3.5 * Math.exp(-((x / 45) ** 2 + (z / 45) ** 2));
  return Math.max(
    0,
    radialRise +
      dogenzakaHill +
      shotoHill +
      miyamasuzakaHill +
      northHill -
      rawOriginHeight -
      valley,
  );
}

export function getRoadById(id: string): CityRoad {
  const road = roadById.get(id);
  if (!road) throw new Error(`Unknown city road: ${id}`);
  return road;
}

export function getRoadSamples(id: string): readonly RoadSample[] {
  const samples = roadSamplesById.get(id);
  if (!samples) throw new Error(`Unknown city road: ${id}`);
  return samples;
}

export function getRoadLength(id: string): number {
  const samples = getRoadSamples(id);
  return samples[samples.length - 1]!.distance;
}

export function getRoadPosition(id: string, distance: number, direction = 1): RoadSample {
  const samples = getRoadSamples(id);
  const progress = Math.max(
    0,
    Math.min(getRoadLength(id), direction > 0 ? distance : getRoadLength(id) - distance),
  );
  let low = 0;
  let high = samples.length - 1;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (samples[middle]!.distance < progress) low = middle;
    else high = middle;
  }
  const start = samples[low]!;
  const end = samples[high]!;
  const span = end.distance - start.distance;
  const fraction = span ? (progress - start.distance) / span : 0;
  const heading =
    direction > 0
      ? start.heading
      : Math.atan2(Math.sin(start.heading + Math.PI), Math.cos(start.heading + Math.PI));
  return {
    x: start.x + (end.x - start.x) * fraction,
    z: start.z + (end.z - start.z) * fraction,
    distance: progress,
    heading,
  };
}

export interface NearestRoadPosition extends RoadSample {
  roadId: string;
  distanceToRoad: number;
}

export function nearestRoadPosition(x: number, z: number): NearestRoadPosition {
  let nearest: NearestRoadPosition | null = null;
  for (const road of CITY_ROADS) {
    const samples = getRoadSamples(road.id);
    for (let index = 0; index < samples.length - 1; index++) {
      const start = samples[index]!;
      const end = samples[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const lengthSquared = dx * dx + dz * dz;
      const fraction = lengthSquared
        ? Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared))
        : 0;
      const roadX = start.x + dx * fraction;
      const roadZ = start.z + dz * fraction;
      const distanceToRoad = Math.hypot(x - roadX, z - roadZ);
      if (nearest && distanceToRoad >= nearest.distanceToRoad) continue;
      nearest = {
        x: roadX,
        z: roadZ,
        distance: start.distance + (end.distance - start.distance) * fraction,
        heading: start.heading,
        roadId: road.id,
        distanceToRoad,
      };
    }
  }
  if (!nearest) throw new Error("City road network is empty");
  return nearest;
}

export function roadNetworkClearance(x: number, z: number): number {
  let clearance = Number.POSITIVE_INFINITY;
  for (const road of CITY_ROADS) {
    const samples = getRoadSamples(road.id);
    for (let index = 0; index < samples.length - 1; index++) {
      const start = samples[index]!;
      const end = samples[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const lengthSquared = dx * dx + dz * dz;
      const fraction = lengthSquared
        ? Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared))
        : 0;
      const roadX = start.x + dx * fraction;
      const roadZ = start.z + dz * fraction;
      clearance = Math.min(clearance, Math.hypot(x - roadX, z - roadZ) - road.width / 2);
    }
  }
  return clearance;
}

export function connectedRoads(nodeId: string, excludingId?: string): readonly CityRoad[] {
  return CITY_ROADS.filter(
    (road) => road.id !== excludingId && (road.from === nodeId || road.to === nodeId),
  );
}

export function cityRoadsAreConnected(): boolean {
  const reached = new Set<string>();
  const pending = [CITY_ROADS[0]!.from];
  while (pending.length) {
    const node = pending.pop()!;
    if (reached.has(node)) continue;
    reached.add(node);
    for (const road of CITY_ROADS) {
      if (road.from === node) pending.push(road.to);
      else if (road.to === node) pending.push(road.from);
    }
  }
  return Object.keys(CITY_NODES).every((node) => reached.has(node));
}
