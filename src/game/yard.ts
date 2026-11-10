// The small fenced driving yard out in front of the garage door:
// tarmac with painted lines, a zebra crossing, a low barrier all round, and the parking bays.
// The bays change from level to level: they start blue and turn green when a vehicle is parked in one.
import * as THREE from 'three';
import { canvasTexture, put } from './kit';
import { BAY, type Bay } from './levels';

export interface Yard {
  /** True if a circle of radius r at (x, z) touches the barrier. */
  hitsSolid(x: number, z: number, r: number): boolean;
  /** Replace the parking bays (all blue). */
  setBays(bays: Bay[]): void;
  /** Turn bay number i green, with a little burst. */
  markDone(i: number): void;
  /** Advance the bay animations. */
  update(dt: number): void;
}

const BLUE = 0x4da6ff;
const GREEN = 0x2fd35f;

// Yard edges. The garage door is on the west side (x = 4.6) and the yard opens straight onto it.
const X0 = 4.8, X1 = 22.8, Z0 = -7.4, Z1 = 8.6;
const W = X1 - X0, D = Z1 - Z0;
const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
const LANE = 0; // the car drives straight out along z = 0
const PX = 64;  // painted-texture pixels per metre

// The garage's front corner columns end here; the barrier stubs meet them.
const COLUMN_NEAR = -5.46, COLUMN_FAR = 6.66;

function paintTarmac(g: CanvasRenderingContext2D) {
  const X = (x: number) => (x - X0) * PX;
  const Z = (z: number) => (z - Z0) * PX;

  // Specks of gravel in the tarmac.
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
    g.fillRect(Math.random() * W * PX, Math.random() * D * PX, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }

  g.strokeStyle = '#f4f4ee';
  g.fillStyle = '#f4f4ee';

  // Edge line, just inside the barrier.
  g.lineWidth = 7;
  g.strokeRect(X(X0 + 0.55), Z(Z0 + 0.55), (W - 1.1) * PX, (D - 1.1) * PX);

  // Dashed centre lane from the door to the parking bays.
  g.lineWidth = 8;
  g.setLineDash([0.9 * PX, 0.7 * PX]);
  g.beginPath(); g.moveTo(X(9.0), Z(LANE)); g.lineTo(X(18.2), Z(LANE)); g.stroke();
  g.setLineDash([]);

  // Zebra crossing just outside the door.
  for (let i = 0; i < 10; i++) g.fillRect(X(6.1), Z(-3.6 + i * 0.95), 1.4 * PX, 0.5 * PX);

  // Stop line before the crossing.
  g.fillRect(X(7.9), Z(-3.8), 0.18 * PX, 9.4 * PX);
}

/** One bay's white lines and big P, open at the entrance (west) and closed at the far end (east). */
function paintBay(g: CanvasRenderingContext2D) {
  const w = BAY.len * PX, h = BAY.wid * PX, m = 8;
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(0, m); g.lineTo(w - m, m); g.lineTo(w - m, h - m); g.lineTo(0, h - m);
  g.stroke();
  g.font = `800 ${1.5 * PX}px Arial, Helvetica, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(Math.PI / 2); // the top of the P points to the closed end
  g.fillText('P', 0, 0);
  g.restore();
}

interface BayView {
  group: THREE.Group;
  fill: THREE.MeshBasicMaterial;
  lines: THREE.MeshBasicMaterial;
  pulse: number; // seconds left of the pulse; 0 when idle
}
interface Ring { mesh: THREE.Mesh; age: number }

export function buildYard(scene: THREE.Scene): Yard {
  const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x4b5056, roughness: 1 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, D), tarmacMat);
  slab.position.set(CX, 0, CZ);
  slab.receiveShadow = true;
  scene.add(slab);

  // Painted markings lie on top as a see-through decal.
  const map = canvasTexture(W * PX, D * PX, paintTarmac);
  map.anisotropy = 8;
  const marks = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({
      map, transparent: true, roughness: 0.95, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })
  );
  marks.rotation.x = -Math.PI / 2;
  marks.position.set(CX, 0.0365, CZ);
  marks.receiveShadow = true;
  scene.add(marks);

  // Low red-and-white barrier on posts. Every run is split into pieces of about 1.5 m.
  const redRail = new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.6 });
  const whiteRail = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.6 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5 });
  const postGeo = new THREE.BoxGeometry(0.16, 0.8, 0.16);
  const rails = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.5));
    const dx = (bx - ax) / n, dz = (bz - az) / n, piece = len / n;
    for (let i = 0; i < n; i++) {
      const mx = ax + dx * (i + 0.5), mz = az + dz * (i + 0.5);
      const mat = i % 2 ? whiteRail : redRail;
      const along = Math.abs(dx) > Math.abs(dz);
      const geo = new THREE.BoxGeometry(along ? piece : 0.1, 0.14, along ? 0.1 : piece);
      put(geo, mat, mx, 0.55, mz, scene);
      put(geo, mat, mx, 0.33, mz, scene);
      put(postGeo, postMat, ax + dx * i, 0.4, az + dz * i, scene);
    }
    put(postGeo, postMat, bx, 0.4, bz, scene);
  };
  rails(X0, Z0, X1, Z0);               // north side
  rails(X0, Z1, X1, Z1);               // south side
  rails(X1, Z0, X1, Z1);               // far (east) end
  rails(X0 + 0.1, Z0, X0 + 0.1, COLUMN_NEAR);   // short pieces beside the garage front
  rails(X0 + 0.1, COLUMN_FAR, X0 + 0.1, Z1);

  const solids = [
    [X0 - 0.1, X1 + 0.1, Z0 - 0.1, Z0 + 0.1],
    [X0 - 0.1, X1 + 0.1, Z1 - 0.1, Z1 + 0.1],
    [X1 - 0.1, X1 + 0.1, Z0, Z1],
    [X0, X0 + 0.2, Z0, COLUMN_NEAR],
    [X0, X0 + 0.2, COLUMN_FAR, Z1]
  ];
  function hitsSolid(x: number, z: number, r: number) {
    return solids.some((b) => x > b[0] - r && x < b[1] + r && z > b[2] - r && z < b[3] + r);
  }

  // ---------- parking bays ----------
  const bayTexture = canvasTexture(BAY.len * PX, BAY.wid * PX, paintBay);
  bayTexture.anisotropy = 8;
  const bayGeo = new THREE.PlaneGeometry(BAY.len, BAY.wid);
  const ringGeo = new THREE.RingGeometry(0.25, 0.4, 48);
  const bayRoot = new THREE.Group();
  scene.add(bayRoot);
  let views: BayView[] = [];
  const rings: Ring[] = [];

  const flat = (mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(bayGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 2;
    return m;
  };
  const decal = (extra: THREE.MeshBasicMaterialParameters) =>
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, ...extra
    });

  function clearBays() {
    views.forEach((v) => { v.fill.dispose(); v.lines.dispose(); });
    rings.forEach((r) => { (r.mesh.material as THREE.Material).dispose(); });
    rings.length = 0;
    bayRoot.clear();
    views = [];
  }

  function setBays(bays: Bay[]) {
    clearBays();
    views = bays.map((b) => {
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);
      group.rotation.y = b.angle;
      const fill = decal({ color: BLUE, opacity: 0.3 });
      const lines = decal({ color: BLUE, map: bayTexture });
      group.add(flat(fill, 0.0375), flat(lines, 0.038));
      bayRoot.add(group);
      return { group, fill, lines, pulse: 0 };
    });
  }

  function markDone(i: number) {
    const v = views[i];
    if (!v) return;
    v.fill.color.setHex(GREEN);
    v.fill.opacity = 0.5;
    v.lines.color.setHex(GREEN);
    v.pulse = 0.55;
    const ring = new THREE.Mesh(ringGeo, decal({ color: GREEN, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(v.group.position.x, 0.045, v.group.position.z);
    ring.renderOrder = 3;
    scene.add(ring);
    rings.push({ mesh: ring, age: 0 });
  }

  function update(dt: number) {
    views.forEach((v) => {
      if (v.pulse > 0) {
        v.pulse = Math.max(0, v.pulse - dt);
        const k = Math.sin((1 - v.pulse / 0.55) * Math.PI); // 0 > 1 > 0
        v.group.scale.setScalar(1 + 0.1 * k);
      }
    });
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dt;
      const t = r.age / 0.9;
      if (t >= 1) {
        scene.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        rings.splice(i, 1);
      } else {
        r.mesh.scale.setScalar(1 + t * 7);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      }
    }
  }

  return { hitsSolid, setBays, markDone, update };
}
