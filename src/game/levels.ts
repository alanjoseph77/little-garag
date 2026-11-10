// The levels. Each one names a set of parking bays to fill and the cones to weave between.
// Finishing a level (every bay green) unlocks the next one, and the scenery around the yard grows.

export interface Bay {
  x: number;
  z: number;
  /** Direction the bay points, in radians. 0 = along +x (the closed end is on the east side). */
  angle: number;
}

export interface LevelDef {
  id: number;
  name: string;
  /** One line shown under the name in the level menu. */
  goal: string;
  bays: Bay[];
  cones: { x: number; z: number }[];
}

/** Size of one bay in metres: length along its angle, then width. */
export const BAY = { len: 4.0, wid: 2.8 };

const slalom = (n: number, x0: number, gap: number, swing: number) =>
  Array.from({ length: n }, (_, c) => ({ x: x0 + c * gap, z: c % 2 ? swing : -swing }));

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'Little Yard',
    goal: 'Park in both blue bays',
    bays: [
      { x: 20.4, z: -1.6, angle: 0 },
      { x: 20.4, z: 2.6, angle: 0 }
    ],
    cones: slalom(6, 8.9, 1.95, 1.7)
  },
  {
    id: 2,
    name: 'Little Town',
    goal: 'Park in all three bays',
    bays: [
      { x: 20.4, z: 0.6, angle: 0 },
      { x: 11.2, z: -4.85, angle: Math.PI / 2 },
      { x: 15.6, z: -4.85, angle: Math.PI / 2 }
    ],
    cones: slalom(4, 9.4, 2.4, 1.8)
  },
  {
    id: 3,
    name: 'Big City',
    goal: 'Park in all four bays',
    bays: [
      { x: 20.4, z: -2.4, angle: 0 },
      { x: 20.4, z: 1.8, angle: 0 },
      { x: 11.6, z: -4.85, angle: Math.PI / 2 },
      { x: 12.0, z: 5.85, angle: -Math.PI / 2 }
    ],
    cones: slalom(6, 9.2, 1.75, 1.3)
  }
];
