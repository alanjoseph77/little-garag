// The world around the yard.
//   always   sky with clouds, grass, distant woods and hazy hills
//   level 1  trees, pines, bushes, grass tufts and flowers
//   level 2  a road with kerbs and pavements, houses, a corner shop and street lamps
//   level 3  office towers and flats, a building site with a crane, and a big wheel
// Everything stands outside the yard barrier, so none of it needs collision.
// Pieces are merged into a few meshes per level (see Batch) so phones can draw them quickly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  Batch, at, rng, noise2, vmat, tint, HORIZON, NIGHT_HORIZON, nightSkyTexture, glowTexture,
  skyTexture, grassTexture, barkTexture, leafTexture, tuftTexture, flowerTexture, roofTexture, brickTexture,
  houseTextures, shopFrontTexture, roadTexture, pavingTexture, glassFacadeTexture, flatsFacadeTexture,
  latticeTexture, shadowTexture
} from './scenery-kit';
import { canvasTexture } from './kit';

export interface Scenery {
  /** Show the scenery for levels 1..n. */
  setLevel(n: number): void;
  /** Switch between day and night: dark sky, glowing street lamps. */
  setNight(on: boolean): void;
  /** Turn the big wheel and swing the crane. */
  update(dt: number): void;
}

/** Colour of the haze at the horizon; the game uses it for the fog. */
export const HAZE = HORIZON;
/** The same at night. */
export const NIGHT_HAZE = NIGHT_HORIZON;

/** Where the street lamp heads are, collected as the lamps are built. */
const lampSpots: THREE.Vector3[] = [];

const CX = 10, CZ = 0;            // middle of the playable area
const SUN_X = 4 / 9, SUN_Z = 3 / 9; // how far a shadow reaches per metre of height (the sun is in the south-east)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const flat = (w: number, d: number) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
function scaleUV<T extends THREE.BufferGeometry>(g: T, su: number, sv: number): T {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}
const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

// ------------------------------------------------------------------ shared materials and shapes

function makeKit() {
  const sky = skyTexture();
  const reflect = new THREE.CanvasTexture(sky.image as HTMLCanvasElement);
  reflect.colorSpace = THREE.SRGBColorSpace;
  reflect.mapping = THREE.EquirectangularReflectionMapping;
  const awn = canvasTexture(128, 32, (c) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f1ede2' : '#a8323a'; c.fillRect(i * 16, 0, 16, 32); }
  });
  awn.wrapS = THREE.RepeatWrapping; awn.repeat.set(3, 1);
  const cutout = (map: THREE.Texture, o: THREE.MeshStandardMaterialParameters = {}) =>
    vmat({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, ...o });
  const shade = (round: boolean) => new THREE.MeshBasicMaterial({
    map: shadowTexture(round), transparent: true, depthWrite: false, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const styles = [
    { wall: '#e6dabd', door: '#3f5d4a', roof: '#a4553c', ridge: 0x7d3f2d, floors: 1 },
    { wall: '#c7d0d2', door: '#7a2e2a', roof: '#525a64', ridge: 0x3c434b, floors: 2 },
    { wall: '#d8b59c', door: '#2f4858', roof: '#6f4b3b', ridge: 0x54382c, floors: 1 },
    { wall: '#ebe8df', door: '#274b6d', roof: '#8c4833', ridge: 0x6b3626, floors: 2 }
  ].map((s) => {
    const t = houseTextures(s.wall, s.door, s.floors);
    const roofTex = roofTexture(s.roof);
    roofTex.repeat.set(5, 4);
    return { ...s, wallHex: new THREE.Color(s.wall).getHex(), front: vmat({ map: t.front }), side: vmat({ map: t.side }), roofMat: vmat({ map: roofTex, roughness: 0.8 }) };
  });
  const glass = (tone: [number, number, number], seed: number) =>
    vmat({ map: glassFacadeTexture(tone, seed), roughness: 0.16, metalness: 0.55, envMap: reflect, envMapIntensity: 0.85 });
  return {
    sky,
    plain: vmat(),
    metal: vmat({ roughness: 0.45, metalness: 0.2 }),
    bark: vmat({ map: barkTexture(), roughness: 1 }),
    foliage: vmat({ roughness: 0.9 }),
    leaves: cutout(leafTexture()),
    tuft: cutout(tuftTexture(), { roughness: 1 }),
    flower: cutout(flowerTexture(), { roughness: 1 }),
    road: vmat({ map: roadTexture(), roughness: 0.95 }),
    paving: vmat({ map: pavingTexture(), roughness: 0.95 }),
    brick: vmat({ map: brickTexture(), roughness: 0.95 }),
    shopFront: vmat({ map: shopFrontTexture() }),
    awning: vmat({ map: awn, roughness: 0.8, side: THREE.DoubleSide }),
    glow: vmat({ emissive: 0xfff0c0, emissiveIntensity: 1.2 }),
    facades: {
      blue: glass([96, 150, 190], 201),
      green: glass([110, 165, 160], 202),
      flatsWarm: vmat({ map: flatsFacadeTexture('#d6cdbd', 203), roughness: 0.9 }),
      flatsGrey: vmat({ map: flatsFacadeTexture('#bfc4c6', 204), roughness: 0.9 })
    },
    darkGlass: vmat({ roughness: 0.2, metalness: 0.5, envMap: reflect, envMapIntensity: 0.7 }),
    craneLattice: cutout(latticeTexture('#e0a612'), { roughness: 0.6 }),
    scaffold: cutout(latticeTexture('#8b9499'), { roughness: 0.6 }),
    blob: shade(true),
    patch: shade(false),
    styles
  };
}
type Kit = ReturnType<typeof makeKit>;
type Facade = keyof Kit['facades'];

/** A soft shadow on the grass under something w by d wide and h tall. */
function shadow(b: Batch, K: Kit, x: number, z: number, w: number, d: number, h: number, round = false) {
  const reach = Math.min(h, 14);
  b.add(flat(w + reach * 0.55 + 1, d + reach * 0.45 + 1), round ? K.blob : K.patch,
    at(x - reach * SUN_X * 0.5, 0.012, z - reach * SUN_Z * 0.5));
}

// ------------------------------------------------------------------ plants

/** A leafy crown: dark inner lumps, covered in small cards of leaves that give a broken, leafy outline. */
function makeCanopy(seed: number, R: number, cards: number) {
  const r = rng(seed);
  const blobs: { c: THREE.Vector3; rad: number }[] = [{ c: new THREE.Vector3(0, 0, 0), rad: R * 0.7 }];
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, y = -0.15 + r() * 0.8;
    blobs.push({ c: new THREE.Vector3(Math.cos(a) * R * 0.55, y * R * 0.6, Math.sin(a) * R * 0.55), rad: R * (0.42 + r() * 0.2) });
  }
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const lumps = blobs.map((bl, k) => {
    const g = new THREE.IcosahedronGeometry(bl.rad, 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); n.copy(v).normalize();
      v.multiplyScalar(1 + (noise2(n.x * 3 + k * 7, n.y * 3 + n.z * 3) - 0.5) * 0.3).add(bl.c);
      pos.setXYZ(i, v.x, v.y, v.z);
      const c = mix(0x24461f, 0x4f8a38, (0.5 + 0.5 * n.y) * 0.7 + (v.y / R * 0.5 + 0.5) * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const up = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1), heart = new THREE.Vector3(0, -R * 0.25, 0);
  const q = new THREE.Quaternion(), roll = new THREE.Quaternion(), dir = new THREE.Vector3();
  const quads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < cards; i++) {
    const bl = blobs[Math.floor(r() * blobs.length)];
    const a = r() * Math.PI * 2, y = -0.35 + r() * 1.35, hr = Math.sqrt(Math.max(0, 1 - Math.min(1, y) ** 2));
    dir.set(Math.cos(a) * hr, Math.min(1, y), Math.sin(a) * hr).normalize();
    const p = dir.clone().multiplyScalar(bl.rad * (0.9 + r() * 0.22)).add(bl.c);
    const size = R * (0.55 + r() * 0.35);
    const g = new THREE.PlaneGeometry(size, size);
    n.set(dir.x + (r() - 0.5) * 0.9, dir.y + (r() - 0.5) * 0.9, dir.z + (r() - 0.5) * 0.9).normalize();
    q.setFromUnitVectors(zAxis, n).multiply(roll.setFromAxisAngle(zAxis, r() * Math.PI * 2));
    g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    n.copy(p).sub(heart).normalize().lerp(up, 0.25).normalize();
    const nor = g.attributes.normal as THREE.BufferAttribute;
    for (let k = 0; k < nor.count; k++) nor.setXYZ(k, n.x, n.y, n.z);
    const light = (0.85 + r() * 0.45) * (0.8 + 0.4 * Math.max(0, Math.min(1, p.y / R * 0.5 + 0.5)));
    tint(g, new THREE.Color(light * (0.94 + r() * 0.12), light, light * (0.82 + r() * 0.14)));
    quads.push(g);
  }
  return { solid: mergeGeometries(lumps)!, leaves: mergeGeometries(quads)! };
}

function makeTrunk(): THREE.BufferGeometry {
  const H = 3.5;
  const stem = new THREE.CylinderGeometry(0.15, 0.3, H, 10, 7).translate(0, H / 2, 0);
  const pos = stem.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), flare = y < 0.45 ? 1 + (0.45 - y) * 1.3 : 1;
    pos.setXYZ(i, pos.getX(i) * flare + Math.sin((y / H) * Math.PI) * 0.1, y, pos.getZ(i) * flare);
  }
  stem.computeVertexNormals();
  const limbs = [0.3, 2.3, 4.4].map((a, i) =>
    new THREE.CylinderGeometry(0.05, 0.11, 1.7, 6).translate(0, 0.85, 0).rotateZ(0.75).rotateY(a).translate(0, 2.3 + i * 0.3, 0));
  return scaleUV(mergeGeometries([stem, ...limbs])!, 2, 2);
}

/** A conifer: tiers of drooping, jagged boughs, lighter at the tips. */
function makePine(seed: number) {
  const r = rng(seed), tiers = 6, parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < tiers; i++) {
    const rad = 1.8 * (1 - (i / tiers) * 0.8), h = 1.6;
    const g = new THREE.ConeGeometry(rad, h, 14, 2);
    const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      let x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const t = (y + h / 2) / h, edge = 1 - t; // 1 at the tips of the boughs
      const a = Math.atan2(z, x), jag = 1 + edge * 0.2 * Math.sin(a * 7 + i * 1.7 + r() * 0.3);
      x *= jag; z *= jag; y -= edge * edge * 0.25 * (1 + Math.sin(a * 7 + i));
      pos.setXYZ(k, x, y, z);
      const under = nor.getY(k) < -0.9;
      const c = under ? new THREE.Color(0x1a3020) : mix(0x2a4d30, 0x5a8a4c, i === tiers - 1 ? 0.45 + edge * 0.55 : Math.pow(edge, 1.2));
      col.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    parts.push(g.translate(0, 1.2 + i * 0.9 + h / 2, 0));
  }
  return {
    needles: mergeGeometries(parts)!,
    trunk: scaleUV(new THREE.CylinderGeometry(0.1, 0.2, 1.6, 8).translate(0, 0.8, 0), 1, 0.5)
  };
}

/** Two crossed cards standing on the ground, lit from above (grass tufts and flowers). */
function makeCross(w: number, h: number): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b])!;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  return g;
}

function makePlants(K: Kit) {
  const crowns = [makeCanopy(301, 2.3, 130), makeCanopy(302, 2.3, 130), makeCanopy(303, 2.1, 120)];
  const shrub = makeCanopy(304, 0.8, 44);
  const trunk = makeTrunk();
  const pines = [makePine(311), makePine(312)];
  const tuft = makeCross(0.8, 0.38), bloom = makeCross(0.7, 0.45);
  return {
    tree(b: Batch, x: number, z: number, s: number, ry: number, k: number) {
      b.add(trunk, K.bark, at(x, 0, z, ry, s));
      const c = crowns[k % crowns.length], m = at(x, 4.4 * s, z, ry * 1.7, [s, s * 0.92, s]);
      b.add(c.solid, K.foliage, m);
      b.add(c.leaves, K.leaves, m);
      shadow(b, K, x, z, 3.6 * s, 3.6 * s, 4.5 * s, true);
    },
    pine(b: Batch, x: number, z: number, s: number, ry: number, k: number) {
      const p = pines[k % pines.length], m = at(x, 0, z, ry, s);
      b.add(p.trunk, K.bark, m);
      b.add(p.needles, K.foliage, m);
      shadow(b, K, x, z, 2.6 * s, 2.6 * s, 5 * s, true);
    },
    bush(b: Batch, x: number, z: number, s: number, ry = 0) {
      const m = at(x, 0.55 * s, z, ry, [s * 1.25, s * 0.8, s * 1.1]);
      b.add(shrub.solid, K.foliage, m);
      b.add(shrub.leaves, K.leaves, m);
      shadow(b, K, x, z, 1.4 * s, 1.4 * s, 0.6, true);
    },
    tuft(b: Batch, x: number, z: number, s: number, ry: number) { b.add(tuft, K.tuft, at(x, 0, z, ry, s)); },
    bloom(b: Batch, x: number, z: number, s: number, ry: number) { b.add(bloom, K.flower, at(x, 0, z, ry, s)); }
  };
}
type Plants = ReturnType<typeof makePlants>;

// ------------------------------------------------------------------ always there: sky, grass, far woods, hills

function buildBackdrop(K: Kit): THREE.Group {
  const g = new THREE.Group(), r = rng(401);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(150, 40, 20),
    new THREE.MeshBasicMaterial({ map: K.sky, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.position.set(CX, 0, CZ);
  dome.renderOrder = -10;
  dome.name = 'dome';
  g.add(dome);

  // Grass, with large patches of lighter, darker and drier green so it never looks like one flat colour.
  const grass = scaleUV(new THREE.PlaneGeometry(320, 320, 72, 72).rotateX(-Math.PI / 2).translate(CX, 0, CZ), 90, 90);
  const pos = grass.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const k = 0.8 + (noise2(x * 0.06, z * 0.06) * 0.6 + noise2(x * 0.23, z * 0.23) * 0.4) * 0.36;
    const dry = Math.max(0, noise2(x * 0.035 + 40, z * 0.035) - 0.55) * 1.6;
    col.set([k * (1 + dry * 0.22), k * (1 + dry * 0.04), k * (1 - dry * 0.25)], i * 3);
  }
  grass.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lawn = new THREE.Mesh(grass, vmat({ map: grassTexture(), roughness: 1 }));
  lawn.position.y = -0.021;
  lawn.receiveShadow = true;
  g.add(lawn);

  const b = new Batch();
  const mound = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  // Hills are lumpy rather than smooth domes, with darker wooded patches on their slopes.
  const hills = [0, 1, 2, 3].map((k) => {
    const h = new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hp = h.attributes.position as THREE.BufferAttribute, hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      const lump = noise2(x * 2.2 + k * 9, z * 2.2) * 0.45 + noise2(x * 5 + k * 3, z * 5) * 0.16;
      hp.setXYZ(i, x * (1 + lump * 0.25), y * (0.6 + lump * 0.9), z * (1 + lump * 0.25));
      const wood = noise2(x * 6 + k * 5, z * 6 + y * 4) > 0.55 ? 0.72 : 1;
      const c = mix(0x4f7a40, 0x7a9a58, noise2(x * 3 + k, z * 3)).multiplyScalar(wood);
      hc.set([c.r, c.g, c.b], i * 3);
    }
    h.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    h.computeVertexNormals();
    return h;
  });
  // A belt of far-off woods, then hills fading into the haze.
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + r() * 0.1, dist = 74 + r() * 22, w = 7 + r() * 9;
    b.add(mound, K.foliage, at(CX + Math.cos(a) * dist, -0.5, CZ + Math.sin(a) * dist, r() * 3, [w, 5 + r() * 5, w * (0.7 + r() * 0.6)]),
      mix(0x274a26, 0x3d6a33, r()).getHex());
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.25, dist = 112 + r() * 22, w = 34 + r() * 26;
    b.add(hills[i % 4], K.plain, at(CX + Math.cos(a) * dist, -1, CZ + Math.sin(a) * dist, r() * 3, [w, 12 + r() * 16, w * (0.7 + r() * 0.5)]));
  }
  b.build(g);
  return g;
}

// ------------------------------------------------------------------ level 1: plants

function buildNature(K: Kit, P: Plants): THREE.Group {
  const g = new THREE.Group(), b = new Batch(), r = rng(501);
  const trees: [number, number][] = [
    [0, -24.5], [7.3, -25.6], [13.8, -24.2], [20.6, -25.9], [27.5, -24.6],   // behind the north houses
    [27.4, -8.6], [27.2, 0.2], [27.5, 7.6],                                   // east side
    [4.3, 13.1], [12.8, 13.3], [21.2, 13],                                    // south side
    [-8, -7], [-9.5, 2], [-8.5, 9.5], [-3, 12.5],                             // round the garage
    [36.5, 23], [-15, -17], [31, 19.5]
  ];
  trees.forEach(([x, z], i) => P.tree(b, x, z, (i >= 5 && i <= 10 ? 0.8 : 0.9) + r() * 0.3, r() * 6.3, i));
  const pines: [number, number][] = [[-10.5, -11.5], [-12.3, -4], [-11.2, 6.2], [-5.5, 14.8], [34, -15.5], [-13.5, -9], [3.5, -27.5], [24, -27.8]];
  pines.forEach(([x, z], i) => P.pine(b, x, z, 0.9 + r() * 0.45, r() * 6.3, i));
  const bushes: [number, number][] = [
    [27.3, -4.4], [27.4, 4], [27.2, 11], [8.4, 13], [17, 13.1], [24.8, 12.6],
    [-6, -3], [-6.2, 5], [-5.6, -7.2], [-7.5, 11.5], [1, 13.2]
  ];
  bushes.forEach(([x, z]) => P.bush(b, x, z, 0.8 + r() * 0.5, r() * 6.3));

  // Tufts of longer grass and patches of flowers, scattered over the open ground.
  const zones: [number, number, number, number, number, number][] = [
    // x0, x1, z0, z1, tufts, flowers
    [5, 23, -9.0, -7.8, 46, 16], [23.3, 25.2, -7, 8.4, 30, 10], [5, 23, 9.0, 10.6, 46, 16],
    [-13, -5, -12, 13, 70, 16], [-4, 5, 7.6, 13, 26, 8], [-4, 4.4, -9.5, -6.2, 20, 6],
    [-14, 36, -31, -22, 80, 10], [24, 38, 12, 26, 50, 10], [-14, 24, 21, 30, 60, 8]
  ];
  zones.forEach(([x0, x1, z0, z1, tufts, flowers]) => {
    for (let i = 0; i < tufts; i++) P.tuft(b, x0 + r() * (x1 - x0), z0 + r() * (z1 - z0), 0.7 + r() * 0.8, r() * 3.2);
    for (let i = 0; i < flowers; i++) P.bloom(b, x0 + r() * (x1 - x0), z0 + r() * (z1 - z0), 0.7 + r() * 0.6, r() * 3.2);
  });
  b.build(g);
  return g;
}

// ------------------------------------------------------------------ level 2: the town

function house(b: Batch, K: Kit, P: Plants, k: number, x: number, z: number, ry: number) {
  const st = K.styles[k], w = 5.6, d = 5, hw = st.floors * 2.8 + 0.1, rh = 1.75;
  const M = at(x, 0, z, ry);
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, local: THREE.Matrix4, colour?: number) =>
    b.add(geo, mat, M.clone().multiply(local), colour);
  put(new THREE.PlaneGeometry(w, hw), st.front, at(0, hw / 2, d / 2));
  put(new THREE.PlaneGeometry(w, hw), st.side, at(0, hw / 2, -d / 2, Math.PI));
  put(new THREE.PlaneGeometry(d, hw), st.side, at(w / 2, hw / 2, 0, Math.PI / 2));
  put(new THREE.PlaneGeometry(d, hw), st.side, at(-w / 2, hw / 2, 0, -Math.PI / 2));
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rh); tri.closePath();
  const gable = new THREE.ShapeGeometry(tri);
  const gableHex = mix(st.wallHex, 0x000000, 0.08).getHex();
  put(gable, K.plain, at(w / 2, hw, 0, Math.PI / 2), gableHex);
  put(gable, K.plain, at(-w / 2, hw, 0, -Math.PI / 2), gableHex);
  // Tiled roof: two slopes that overhang the walls, and a ridge.
  const run = d / 2 + 0.45, ang = Math.atan2(rh, d / 2), len = run / Math.cos(ang);
  const yMid = hw + rh - Math.tan(ang) * (run / 2) + 0.07;
  put(box(w + 0.9, 0.12, len), st.roofMat, at(0, yMid, run / 2, 0, 1, ang));
  put(box(w + 0.9, 0.12, len), st.roofMat, at(0, yMid, -run / 2, 0, 1, -ang));
  put(box(w + 0.95, 0.16, 0.34), K.plain, at(0, hw + rh + 0.1, 0), st.ridge);
  put(scaleUV(box(0.62, 1.5, 0.62), 0.4, 0.8), K.brick, at(w * 0.27, hw + rh * 0.55 + 0.35, -d * 0.2));
  put(box(0.76, 0.1, 0.76), K.plain, at(w * 0.27, hw + rh * 0.55 + 1.13, -d * 0.2), 0x77746e);
  put(box(1.6, 0.16, 0.7), K.plain, at(0, 0.08, d / 2 + 0.35), 0xa5a29a);          // door step
  put(box(1.9, 0.09, 1.0), K.plain, at(0, 2.5, d / 2 + 0.42, 0, 1, 0.2), st.ridge); // little roof over the door
  const world = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyMatrix4(M);
  shadow(b, K, x, z, Math.abs(Math.cos(ry)) > 0.5 ? w : d, Math.abs(Math.cos(ry)) > 0.5 ? d : w, hw + rh * 0.5);
  for (const lx of [-2.1, 2.1]) { const p = world(lx, d / 2 + 0.9); P.bush(b, p.x, p.z, 0.75, lx); }
}

function lamp(b: Batch, K: Kit, x: number, z: number, ry: number) {
  const M = at(x, 0, z, ry), put = (geo: THREE.BufferGeometry, mat: THREE.Material, local: THREE.Matrix4, colour?: number) =>
    b.add(geo, mat, M.clone().multiply(local), colour);
  put(new THREE.CylinderGeometry(0.055, 0.09, 4.6, 8), K.metal, at(0, 2.3, 0), 0x3b4246);
  put(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 8), K.metal, at(0, 0.25, 0), 0x33393d);
  put(box(1.15, 0.07, 0.07), K.metal, at(0.52, 4.56, 0, 0, 1, 0, 0.08), 0x3b4246);
  put(box(0.55, 0.1, 0.24), K.metal, at(1.05, 4.6, 0), 0x2f3538);
  put(box(0.42, 0.04, 0.17), K.glow, at(1.05, 4.535, 0), 0xfff4d6);
  lampSpots.push(new THREE.Vector3(1.05, 4.5, 0).applyMatrix4(M));
}

function buildTown(K: Kit, P: Plants): THREE.Group {
  const g = new THREE.Group(), b = new Batch();

  // The road along the north side: tarmac, kerbs, and a pavement in front of the houses.
  b.add(scaleUV(flat(68, 5), 17, 1), K.road, at(13, 0.02, -11.9));
  b.add(box(68, 0.16, 0.2), K.plain, at(13, 0.08, -9.3), 0xb7b4ac);
  b.add(box(68, 0.16, 0.2), K.plain, at(13, 0.08, -14.5), 0xb7b4ac);
  b.add(box(68, 0.14, 1.5), K.plain, at(13, 0.06, -15.35), 0x9c9992);
  b.add(scaleUV(flat(68, 1.5), 52, 1.15), K.paving, at(13, 0.135, -15.35));
  // Footpaths in front of the east and south houses.
  b.add(scaleUV(flat(1.3, 26), 1, 20), K.paving, at(28.4, 0.03, 2.3));
  b.add(scaleUV(flat(25.4, 1.3), 19.5, 1), K.paving, at(16.3, 0.03, 14.2));

  house(b, K, P, 0, 3.6, -18.8, 0);
  house(b, K, P, 1, 10.4, -18.8, 0);
  house(b, K, P, 2, 17.2, -18.8, 0);
  house(b, K, P, 3, 24, -18.8, 0);
  house(b, K, P, 1, 32.3, 4.3, -Math.PI / 2);
  house(b, K, P, 2, 32.3, 11.5, -Math.PI / 2);
  house(b, K, P, 3, 8.7, 17.6, Math.PI);
  house(b, K, P, 0, 16.9, 17.6, Math.PI);

  // The corner shop on the east side: brick sides, a glass front and a striped awning.
  const w = 6.6, d = 5.2, h = 3.6, M = at(32.4, 0, -3.8, -Math.PI / 2);
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, local: THREE.Matrix4, colour?: number) =>
    b.add(geo, mat, M.clone().multiply(local), colour);
  put(new THREE.PlaneGeometry(w, h), K.shopFront, at(0, h / 2, d / 2));
  put(scaleUV(new THREE.PlaneGeometry(w, h), w / 2.6, h / 2.6), K.brick, at(0, h / 2, -d / 2, Math.PI));
  put(scaleUV(new THREE.PlaneGeometry(d, h), d / 2.6, h / 2.6), K.brick, at(w / 2, h / 2, 0, Math.PI / 2));
  put(scaleUV(new THREE.PlaneGeometry(d, h), d / 2.6, h / 2.6), K.brick, at(-w / 2, h / 2, 0, -Math.PI / 2));
  put(box(w + 0.3, 0.3, d + 0.3), K.plain, at(0, h + 0.15, 0), 0x565b5f);
  put(box(w - 0.3, 0.07, 1.6), K.awning, at(0, 2.62, d / 2 + 0.72, 0, 1, 0.3));
  put(box(w + 0.6, 0.14, 1.2), K.plain, at(0, 0.07, d / 2 + 0.6), 0xa5a29a);
  shadow(b, K, 32.4, -3.8, d, w, h);

  // Street lamps, each reaching over the road or path beside it.
  for (const z of [-4.6, 4]) lamp(b, K, 27.5, z, 0);
  for (const x of [8.6, 17.2]) lamp(b, K, x, 13.2, -Math.PI / 2);
  for (const x of [-2, 10.2, 22.4, 34]) lamp(b, K, x, -15.9, -Math.PI / 2);

  b.build(g);
  return g;
}

// ------------------------------------------------------------------ level 3: the city

function tower(b: Batch, K: Kit, x: number, z: number, w: number, d: number, h: number, kind: Facade, setback: boolean, r: () => number) {
  const mat = K.facades[kind];
  const block = (bw: number, bd: number, y0: number, bh: number) => {
    const wall = (width: number) => scaleUV(new THREE.PlaneGeometry(width, bh), width / 6, bh / 12.8);
    b.add(wall(bw), mat, at(x, y0 + bh / 2, z + bd / 2));
    b.add(wall(bw), mat, at(x, y0 + bh / 2, z - bd / 2, Math.PI));
    b.add(wall(bd), mat, at(x + bw / 2, y0 + bh / 2, z, Math.PI / 2));
    b.add(wall(bd), mat, at(x - bw / 2, y0 + bh / 2, z, -Math.PI / 2));
    b.add(box(bw + 0.3, 0.5, bd + 0.3), K.plain, at(x, y0 + bh + 0.25, z), 0x676c71);
  };
  const lower = setback ? h * 0.62 : h;
  block(w, d, 0, lower);
  if (setback) block(w * 0.66, d * 0.66, lower + 0.5, h - lower);
  b.add(box(w + 0.5, 3.6, d + 0.5), K.darkGlass, at(x, 1.8, z), 0x3d464c);      // lobby
  b.add(box(w + 0.9, 0.2, d + 0.9), K.plain, at(x, 3.7, z), 0x7c8186);
  const top = h + (setback ? 1 : 0.5), s = setback ? 0.6 : 1;                     // plant on the roof
  b.add(box(w * 0.3 * s, 1.3, d * 0.28 * s), K.plain, at(x - w * 0.16 * s, top + 0.65, z + d * 0.12 * s), 0x8b9095);
  b.add(box(w * 0.2 * s, 0.9, d * 0.34 * s), K.plain, at(x + w * 0.2 * s, top + 0.45, z - d * 0.1 * s), 0x9aa0a4);
  if (h > 28) b.add(new THREE.CylinderGeometry(0.05, 0.08, 5 + r() * 3, 6), K.metal, at(x, top + 3, z), 0xc9cdd0);
  shadow(b, K, x, z, w, d, h);
}

function buildCity(K: Kit, P: Plants) {
  const group = new THREE.Group(), b = new Batch(), r = rng(601);
  const towers: [number, number, number, number, number, Facade, boolean][] = [
    [2, -38, 9, 8, 26, 'blue', false], [13, -41, 8, 8, 34, 'flatsWarm', true], [24, -38, 10, 8, 22, 'green', false], [-10, -33, 8, 8, 28, 'flatsGrey', false],
    [47, -12, 8, 9, 30, 'blue', false], [50, 3, 9, 8, 20, 'flatsWarm', false], [47, 18, 9, 8, 36, 'green', true],
    [26, 33, 8, 8, 24, 'flatsGrey', false], [8, 35, 10, 8, 18, 'blue', false], [-8, 32, 8, 8, 22, 'green', false]
  ];
  towers.forEach(([x, z, w, d, h, kind, setback]) => tower(b, K, x, z, w, d, h, kind, setback, r));

  // A block still being built: bare concrete floors and columns behind scaffolding and site boards.
  const sx = 38, sz = -27;
  for (let f = 0; f < 4; f++) {
    b.add(box(9, 0.3, 9), K.plain, at(sx, f * 3.2 + 0.15, sz), 0xb3b0a8);
    const colH = f < 3 ? 2.9 : 1.3;
    for (const cx of [-4, 0, 4]) for (const cz of [-4, 0, 4]) b.add(box(0.42, colH, 0.42), K.plain, at(sx + cx, f * 3.2 + 0.3 + colH / 2, sz + cz), 0xa7a49c);
  }
  b.add(scaleUV(new THREE.PlaneGeometry(9.6, 10.4), 6, 6.5), K.scaffold, at(sx, 5.2, sz + 4.8));
  b.add(scaleUV(new THREE.PlaneGeometry(9.6, 10.4), 6, 6.5), K.scaffold, at(sx - 4.8, 5.2, sz, -Math.PI / 2));
  for (let i = 0; i < 7; i++) {
    b.add(box(1.9, 1.9, 0.08), K.plain, at(sx - 6 + i * 2, 0.95, sz + 7), i % 2 ? 0xe9e6dc : 0x2d6a8a);
    b.add(box(0.08, 1.9, 1.9), K.plain, at(sx - 7, 0.95, sz - 5 + i * 2), i % 2 ? 0x2d6a8a : 0xe9e6dc);
  }
  b.add(new THREE.ConeGeometry(1.9, 1.2, 14), K.plain, at(sx - 9.2, 0.6, sz + 6), 0xc8b488); // heap of sand
  shadow(b, K, sx, sz, 9, 9, 11);

  // Tower crane: a lattice mast, and a top that slews round with its jib, cab and load.
  const cx = 30.5, cz = -27, mastH = 24;
  for (const [ox, oz, ry] of [[0, 0.65, 0], [0, -0.65, 0], [0.65, 0, Math.PI / 2], [-0.65, 0, Math.PI / 2]] as const) {
    b.add(scaleUV(new THREE.PlaneGeometry(1.3, mastH), 1, mastH / 1.3), K.craneLattice, at(cx + ox, mastH / 2, cz + oz, ry));
  }
  b.add(box(3.2, 0.5, 3.2), K.plain, at(cx, 0.25, cz), 0xa9a69e);
  shadow(b, K, cx, cz, 3, 3, 3);
  const jib = new THREE.Group();
  jib.position.set(cx, mastH, cz);
  const jb = new Batch(), yellow = 0xe0a612;
  jb.add(box(1.7, 0.5, 1.7), K.metal, at(0, 0.25, 0), 0x55595c);
  jb.add(box(1.3, 1.4, 1.5), K.plain, at(1.0, 1.2, 1.2), 0xf2efe6);                            // cab
  jb.add(box(1.32, 0.6, 1.52), K.darkGlass, at(1.0, 1.45, 1.2), 0x54707e);
  jb.add(scaleUV(new THREE.PlaneGeometry(1.2, 4.5), 1, 3.75), K.craneLattice, at(0, 2.75, 0)); // tower peak
  jb.add(scaleUV(new THREE.PlaneGeometry(1.2, 4.5), 1, 3.75), K.craneLattice, at(0, 2.75, 0, Math.PI / 2));
  for (const oz of [0.45, -0.45]) {
    jb.add(scaleUV(new THREE.PlaneGeometry(21, 1.1), 19, 1), K.craneLattice, at(11, 1.25, oz));
    jb.add(scaleUV(new THREE.PlaneGeometry(6.5, 1.1), 6, 1), K.craneLattice, at(-3.8, 1.25, oz));
  }
  jb.add(box(21, 0.12, 1.0), K.metal, at(11, 0.72, 0), yellow);
  jb.add(box(6.5, 0.12, 1.0), K.metal, at(-3.8, 0.72, 0), yellow);
  for (const ox of [-5.2, -6.4]) jb.add(box(1.0, 1.5, 1.3), K.plain, at(ox, 0.2, 0), 0x9c9992); // counterweights
  const rod = (x0: number, y0: number, x1: number, y1: number) =>
    jb.add(box(Math.hypot(x1 - x0, y1 - y0), 0.06, 0.06), K.metal, at((x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 1, 0, Math.atan2(y1 - y0, x1 - x0)), 0x40464a);
  rod(0, 5, 19.5, 1.9); rod(0, 5, -6.6, 1.9);
  jb.add(box(0.9, 0.3, 1.0), K.metal, at(14, 0.5, 0), 0x40464a);                               // trolley
  jb.add(box(0.05, 9, 0.05), K.metal, at(14, -4, 0), 0x2a2d2f);
  jb.add(box(0.5, 0.5, 0.5), K.metal, at(14, -8.6, 0), yellow);
  jb.add(box(2.6, 0.22, 1.3), K.plain, at(14, -9.3, 0), 0xb3b0a8);                             // a concrete panel on the hook
  jb.build(jib);
  group.add(jib);

  // The big wheel, turned to face the yard.
  const wx = -17, wz = 19, R = 7, hubY = 9;
  const root = new THREE.Group();
  root.position.set(wx, 0, wz);
  root.rotation.y = Math.atan2(CX - wx, CZ - wz);
  const fb = new Batch(), white = 0xf0f0ec;
  for (const side of [1.15, -1.15]) for (const dir of [1, -1]) {
    fb.add(box(0.32, Math.hypot(3.6, hubY), 0.32), K.metal, at(dir * 1.8, hubY / 2, side, 0, 1, 0, dir * Math.atan2(3.6, hubY)), 0xcfd3d6);
    fb.add(box(1.2, 0.3, 1.2), K.plain, at(dir * 3.6, 0.15, side), 0xa9a69e);
  }
  fb.build(root);
  const wheel = new THREE.Group();
  wheel.position.y = hubY;
  const wb = new Batch();
  for (const oz of [0.6, -0.6]) {
    wb.add(new THREE.TorusGeometry(R, 0.1, 8, 72), K.metal, at(0, 0, oz), white);
    wb.add(new THREE.TorusGeometry(R * 0.62, 0.05, 6, 56), K.metal, at(0, 0, oz), white);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      wb.add(box(R, 0.05, 0.05), K.metal, at(Math.cos(a) * R / 2, Math.sin(a) * R / 2, oz, 0, 1, 0, a), white);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wb.add(box(0.07, 0.07, 1.2), K.metal, at(Math.cos(a) * R, Math.sin(a) * R, 0), white);
  }
  wb.add(new THREE.CylinderGeometry(0.55, 0.55, 1.7, 18).rotateX(Math.PI / 2), K.metal, at(0, 0, 0), 0xc23a3a);
  wb.build(wheel);
  const cabinColours = [0xc23a3a, 0xe2b93b, 0x2d7fb8, 0x3b9a57, 0xe07b2d, 0x8a63c7];
  const cabins: THREE.Object3D[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, holder = new THREE.Group(), cb = new Batch();
    holder.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    cb.add(box(0.06, 0.4, 0.06), K.metal, at(0, -0.2, 0), 0x55595c);
    cb.add(box(1.3, 0.1, 1.05), K.plain, at(0, -0.4, 0), white);
    cb.add(box(1.2, 1.0, 0.95), K.plain, at(0, -0.92, 0), cabinColours[i % cabinColours.length]);
    cb.add(box(1.22, 0.4, 0.97), K.darkGlass, at(0, -0.72, 0), 0x9fc0d2);
    cb.build(holder);
    wheel.add(holder);
    cabins.push(holder);
  }
  root.add(wheel);
  group.add(root);
  shadow(b, K, wx, wz, 9, 9, 8, true);

  // A few street trees between the towers.
  [[-2, -30], [18, -32.5], [41, -3], [42, 11], [16, 29], [0, 28]].forEach(([x, z], i) => P.tree(b, x, z, 1 + r() * 0.3, r() * 6.3, i));

  b.build(group);
  return { group, jib, wheel, cabins };
}

// ------------------------------------------------------------------

export function buildScenery(scene: THREE.Scene): Scenery {
  const K = makeKit(), P = makePlants(K);
  lampSpots.length = 0;
  const backdrop = buildBackdrop(K);
  scene.add(backdrop);
  const dome = backdrop.getObjectByName('dome') as THREE.Mesh;
  const daySky = K.sky, nightSky = nightSkyTexture();
  const city = buildCity(K, P);
  const layers = [buildNature(K, P), buildTown(K, P), city.group];
  layers.forEach((l) => scene.add(l));
  let t = 0, tier = 1, night = false;

  // At night every street lamp gets a halo and a warm pool of light on the ground.
  const glowMap = glowTexture();
  const haloMat = new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
  });
  const poolGeo = new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2);
  const lights = new THREE.Group();
  lampSpots.forEach((p) => {
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(p); halo.scale.setScalar(2.6);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(p.x, 0.2, p.z);
    lights.add(halo, pool);
  });
  lights.visible = false;
  scene.add(lights);
  const showLights = () => { lights.visible = night && tier >= 2; };

  return {
    setLevel(n) {
      tier = n;
      layers.forEach((l, i) => { l.visible = i < n; });
      showLights();
    },
    setNight(on) {
      night = on;
      (dome.material as THREE.MeshBasicMaterial).map = on ? nightSky : daySky;
      (dome.material as THREE.MeshBasicMaterial).needsUpdate = true;
      K.glow.emissiveIntensity = on ? 3 : 1.2;
      showLights();
    },
    update(dt) {
      t += dt;
      if (!city.group.visible) return;
      city.wheel.rotation.z -= dt * 0.16;
      city.cabins.forEach((c) => { c.rotation.z = -city.wheel.rotation.z; }); // cabins stay upright
      city.jib.rotation.y = Math.sin(t * 0.22) * 0.9;
    }
  };
}
