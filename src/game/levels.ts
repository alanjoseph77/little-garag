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
  /** How much of the surroundings to show: 1 = meadow, 2 = plus the town, 3 = plus the city. */
  tier: 1 | 2 | 3;
  /** Dark sky, glowing lamps and headlights. */
  night?: boolean;
  /** Stars to collect before the bays open. */
  stars?: { x: number; z: number }[];
  /** A parcel to pick up and take to the drop-off before the bays open. */
  delivery?: { pickup: { x: number; z: number }; dropoff: { x: number; z: number } };
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
    cones: slalom(6, 8.9, 1.95, 1.7),
    tier: 1
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
    cones: slalom(4, 9.4, 2.4, 1.8),
    tier: 2
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
    cones: slalom(6, 9.2, 1.75, 1.3),
    tier: 3
  },
  {
    id: 4,
    name: 'Night Drive',
    goal: 'Use your headlights and park in all three bays',
    bays: [
      { x: 20.4, z: -1.6, angle: 0 },
      { x: 20.4, z: 2.6, angle: 0 },
      { x: 15.6, z: -4.85, angle: Math.PI / 2 }
    ],
    cones: slalom(5, 8.9, 1.75, 1.5),
    tier: 2,
    night: true
  },
  {
    id: 5,
    name: 'Star Hunt',
    goal: 'Collect 5 stars, then park',
    bays: [{ x: 20.4, z: -1.6, angle: 0 }],
    cones: [],
    tier: 1,
    stars: [
      { x: 9.8, z: -3.4 },
      { x: 14.0, z: -4.6 },
      { x: 18.0, z: -4.2 },
      { x: 20.6, z: 2.4 },
      { x: 13.2, z: 5.8 }
    ]
  },
  {
    id: 6,
    name: 'Delivery Run',
    goal: 'Pick up the parcel, deliver it, then park',
    bays: [{ x: 20.4, z: 0.6, angle: 0 }],
    cones: slalom(5, 9.2, 2.0, 1.6),
    tier: 3,
    delivery: { pickup: { x: 9.6, z: -5.0 }, dropoff: { x: 19.4, z: 5.4 } }
  }
];
