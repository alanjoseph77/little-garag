// Shared building blocks for every vehicle and for the garage:
// materials, small geometry helpers, and the wheel that all vehicles use.
import * as THREE from 'three';

export interface Wheel {
  pivot: THREE.Group;
  spin: THREE.Group;
  steers: boolean;
  dir: number;
}

export interface Vehicle {
  id: string;
  name: string;
  group: THREE.Group;
  body: THREE.Group;
  wheels: Wheel[];
  /** Extra parts that turn with the steering (the rickshaw's fork and mudguard). */
  steerGroup: THREE.Group | null;
  paint: THREE.MeshStandardMaterial;
  halfLen: number;
  halfWid: number;
  /** Collision circles: offsets along the length, and their radius. */
  bumpAt: number[];
  bumpR: number;
  home: { x: number; z: number };
  wheelbase: number;
  wheelR: number;
  maxFwd: number;
  maxRev: number;
  accel: number;
  roll: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

export const darkMat = std({ color: 0x1c1d20, roughness: 0.85 });
export const lampMat = std({ color: 0xfff6d8, emissive: 0xfff0b0, emissiveIntensity: 0.9 });
export const tailMat = std({ color: 0xd4202a, emissive: 0xa80f18, emissiveIntensity: 0.7 });
export const chromeMat = std({ color: 0xe8ebee, roughness: 0.2, metalness: 0.35 });
export const amberMat = std({ color: 0xff9a1f, emissive: 0xb85a00, emissiveIntensity: 0.55 });
export const whiteLampMat = std({ color: 0xf4f6f8, emissive: 0xffffff, emissiveIntensity: 0.35 });
export const tailHousingMat = std({ color: 0x5c0d13, roughness: 0.3 });
export const mirrorMat = std({ color: 0xc4d6e2, roughness: 0.08, metalness: 0.25 });
export const rimMat = std({ color: 0xdfe3e7, roughness: 0.28, metalness: 0.3, side: THREE.DoubleSide });
export const discMat = std({ color: 0x8b9096, roughness: 0.45, metalness: 0.3 });
export const caliperMat = std({ color: 0xc8202b, roughness: 0.5 });

/** A texture drawn on a canvas. `color` textures are tagged sRGB so they match the materials. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
  color = true
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const treadTexture = canvasTexture(
  1024,
  256,
  (g) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = '#000000';
    g.lineWidth = 6;
    for (let i = 0; i < 44; i++) {
      const x = (i * 1024) / 44;
      g.beginPath(); g.moveTo(x, 62); g.lineTo(x + 12, 112); g.stroke();
      g.beginPath(); g.moveTo(x + 11, 194); g.lineTo(x + 23, 144); g.stroke();
    }
  },
  false
);
treadTexture.wrapS = THREE.RepeatWrapping;

export const tyreMat = std({
  color: 0x18191b, roughness: 0.92, bumpMap: treadTexture, bumpScale: 2, side: THREE.DoubleSide
});

/** Add a mesh that casts a shadow. */
export function put(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Extrude a side profile across the vehicle's width, with rounded edges, centred on z = 0. */
export function extrude(shape: THREE.Shape, width: number, bevel: number): THREE.ExtrudeGeometry {
  const depth = width - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8,
    bevelSegments: 4, curveSegments: 14
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A cylinder lying along the vehicle's length. */
export function lengthwiseDisc(r: number, len: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, 24);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const sh = new THREE.Shape(), x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}

export function plateMaterial(text: string): THREE.MeshStandardMaterial {
  const map = canvasTexture(256, 76, (g) => {
    g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 256, 76);
    g.strokeStyle = '#17212a'; g.lineWidth = 5; g.strokeRect(4, 4, 248, 68);
    g.fillStyle = '#17212a'; g.font = 'bold 40px Arial, Helvetica, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 40);
  });
  return std({ map, roughness: 0.6 });
}

const v2 = (p: number[]) => new THREE.Vector2(p[0], p[1]);

// Tyre cross-section (radius, width): bead, bulging sidewall, rounded shoulder,
// flat tread with two grooves running round it.
export const tyreGeo = new THREE.LatheGeometry(
  [
    [0.205, -0.095], [0.24, -0.112], [0.295, -0.115], [0.328, -0.098], [0.34, -0.08],
    [0.34, -0.05], [0.326, -0.046], [0.326, -0.03], [0.34, -0.026],
    [0.34, 0.026], [0.326, 0.03], [0.326, 0.046], [0.34, 0.05],
    [0.34, 0.08], [0.328, 0.098], [0.295, 0.115], [0.24, 0.112], [0.205, 0.095]
  ].map(v2),
  56
);
tyreGeo.rotateX(Math.PI / 2);

// Rim barrel with a rolled lip on the outer face (+Z).
const rimGeo = new THREE.LatheGeometry(
  [
    [0.2, -0.095], [0.205, -0.08], [0.19, -0.06], [0.185, 0.05], [0.2, 0.085],
    [0.212, 0.095], [0.216, 0.105], [0.205, 0.11], [0.19, 0.1]
  ].map(v2),
  48
);
rimGeo.rotateX(Math.PI / 2);

/** Fields every vehicle starts with before it is parked. */
export const atRest = { x: 0, z: 0, heading: 0, speed: 0, steer: 0 };

/**
 * A wheel: steering pivot > side flip > spinning wheel (tyre, alloy rim, spokes).
 * `scale` shrinks the whole wheel (the rickshaw uses small ones).
 */
export function addWheel(v: Vehicle, x: number, z: number, steers: boolean, scale = 1): void {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.34 * scale, z);
  pivot.scale.setScalar(scale);
  const side = new THREE.Group(); // turns the wheel's outer face outward
  if (z < 0) side.rotation.y = Math.PI;
  pivot.add(side);
  const spin = new THREE.Group();
  side.add(spin);

  put(tyreGeo, tyreMat, 0, 0, 0, spin);
  put(rimGeo, rimMat, 0, 0, 0, spin);
  // Five spokes, centre cap and wheel nuts.
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const spoke = put(new THREE.BoxGeometry(0.17, 0.05, 0.03), rimMat, Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0.07, spin);
    spoke.rotation.z = a;
    const nut = new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8);
    nut.rotateX(Math.PI / 2);
    put(nut, discMat, Math.cos(a + 0.63) * 0.062, Math.sin(a + 0.63) * 0.062, 0.085, spin);
  }
  const cap = new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20);
  cap.rotateX(Math.PI / 2);
  put(cap, rimMat, 0, 0, 0.075, spin);
  // Brake disc turns with the wheel; the caliper stays put.
  const brake = new THREE.CylinderGeometry(0.155, 0.155, 0.02, 32);
  brake.rotateX(Math.PI / 2);
  put(brake, discMat, 0, 0, 0.02, spin);
  const back = new THREE.CylinderGeometry(0.19, 0.19, 0.02, 24);
  back.rotateX(Math.PI / 2);
  put(back, darkMat, 0, 0, -0.04, spin);
  put(new THREE.BoxGeometry(0.07, 0.12, 0.05), caliperMat, 0.125, 0.04, 0.03, side);

  v.group.add(pivot);
  v.wheels.push({ pivot, spin, steers, dir: z < 0 ? -1 : 1 });
}
