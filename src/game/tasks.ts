// The jobs that come before parking in some levels: gold stars to collect, or a parcel to
// pick up and drop off. Driving through one counts it. Once every job is done the bays open.
import * as THREE from 'three';
import type { LevelDef } from './levels';

export type TaskKind = 'star' | 'pickup' | 'drop';

export interface Tasks {
  /** Set up the stars or the parcel for a level (or nothing). */
  setLevel(def: LevelDef): void;
  /** Number of jobs in this level, and how many are done. */
  readonly total: number;
  readonly done: number;
  /** Stars collected so far, and how many there are. */
  readonly stars: { got: number; of: number };
  /** True when there is nothing left to do (also true for levels with no jobs). */
  readonly complete: boolean;
  update(dt: number, x: number, z: number): void;
}

const REACH = 1.7;   // how close the vehicle's middle must get
const POP = 0.45;    // seconds for the collect animation
const MAX_STARS = 8;

function starShape() {
  const s = new THREE.Shape(), n = 5, outer = 0.6, inner = 0.27;
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner : outer;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

const disc = (inner: number, outer: number, color: number, opacity: number) =>
  new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    })
  );

function parcelBox(): THREE.Group {
  const g = new THREE.Group();
  const kraft = new THREE.MeshStandardMaterial({ color: 0xc89455, roughness: 0.8, transparent: true });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.6, transparent: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), kraft);
  const bandA = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.74, 0.16), ribbon);
  const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.74, 0.94), ribbon);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), ribbon);
  bow.position.y = 0.4;
  g.add(body, bandA, bandB, bow);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

function fade(g: THREE.Object3D, opacity: number) {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) { m.transparent = true; m.opacity = opacity; }
  });
}

interface StarView { group: THREE.Group; star: THREE.Mesh; ring: THREE.Mesh; mat: THREE.MeshStandardMaterial; taken: number; spot: { x: number; z: number } }

export function buildTasks(scene: THREE.Scene, onStep: (kind: TaskKind) => void): Tasks {
  const root = new THREE.Group();
  scene.add(root);
  let t = 0;

  // ---------- stars ----------
  const starGeo = new THREE.ExtrudeGeometry(starShape(), {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2
  }).center();
  const stars: StarView[] = [];
  for (let i = 0; i < MAX_STARS; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc928, emissive: 0xffa000, emissiveIntensity: 0.65, roughness: 0.35, metalness: 0.2, transparent: true
    });
    const star = new THREE.Mesh(starGeo, mat);
    star.castShadow = true;
    const ring = disc(0.7, 0.95, 0xffd23f, 0.7);
    ring.position.y = 0.045;
    const group = new THREE.Group();
    group.add(star, ring);
    group.visible = false;
    root.add(group);
    stars.push({ group, star, ring, mat, taken: -1, spot: { x: 0, z: 0 } });
  }

  // ---------- parcel ----------
  const pallet = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9b7a52, roughness: 0.9 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.9), wood);
  slab.position.y = 0.06; slab.receiveShadow = true;
  const onPallet = parcelBox();
  onPallet.position.y = 0.5;
  const pickRing = disc(1.35, 1.65, 0xff9a1f, 0.85);
  pickRing.position.y = 0.05;
  pallet.add(slab, onPallet, pickRing);
  pallet.visible = false;
  root.add(pallet);

  const carried = parcelBox();
  carried.visible = false;
  root.add(carried);

  const drop = new THREE.Group();
  const dropRing = disc(1.35, 1.65, 0x2fd35f, 0.9);
  dropRing.position.y = 0.05;
  const dropFill = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x2fd35f, transparent: true, opacity: 0.28, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
    })
  );
  dropFill.position.y = 0.045;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.9, 20).rotateX(Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x2fd35f, emissive: 0x16a244, emissiveIntensity: 0.7, roughness: 0.4 })
  );
  drop.add(dropRing, dropFill, arrow);
  drop.visible = false;
  root.add(drop);

  // ---------- state ----------
  let mode: 'none' | 'stars' | 'delivery' = 'none';
  let total = 0, done = 0, starCount = 0;
  let step: 'pickup' | 'drop' | 'finished' = 'pickup';
  let pickAt = { x: 0, z: 0 }, dropAt = { x: 0, z: 0 };
  let carriedPop = -1; // seconds into the pop-away animation of the parcel; -1 = not popping

  function setLevel(def: LevelDef) {
    stars.forEach((s) => { s.group.visible = false; s.taken = -1; });
    pallet.visible = false; carried.visible = false; drop.visible = false; carriedPop = -1;
    fade(carried, 1);
    carried.scale.setScalar(1);
    done = 0; starCount = 0; step = 'pickup';
    if (def.stars) {
      mode = 'stars';
      total = def.stars.length;
      starCount = def.stars.length;
      def.stars.forEach((p, i) => {
        const s = stars[i];
        s.spot = p;
        s.group.position.set(p.x, 0, p.z);
        s.group.visible = true;
        s.group.scale.setScalar(1);
        s.mat.opacity = 1;
      });
    } else if (def.delivery) {
      mode = 'delivery';
      total = 2;
      pickAt = def.delivery.pickup;
      dropAt = def.delivery.dropoff;
      pallet.position.set(pickAt.x, 0, pickAt.z);
      pallet.visible = true;
      drop.position.set(dropAt.x, 0, dropAt.z);
    } else {
      mode = 'none';
      total = 0;
    }
  }

  const near = (x: number, z: number, p: { x: number; z: number }) => (x - p.x) ** 2 + (z - p.z) ** 2 < REACH * REACH;

  function update(dt: number, x: number, z: number) {
    t += dt;
    if (mode === 'stars') {
      stars.forEach((s, i) => {
        if (!s.group.visible) return;
        if (s.taken >= 0) {
          s.taken += dt;
          const k = s.taken / POP;
          if (k >= 1) { s.group.visible = false; return; }
          s.group.scale.setScalar(1 + k * 1.2);
          s.group.position.y = k * 1.4;
          s.mat.opacity = 1 - k;
          (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
          s.star.rotation.y += dt * 14;
          return;
        }
        s.star.rotation.y = t * 1.8 + i;
        s.star.position.y = 1.3 + Math.sin(t * 2.4 + i * 1.7) * 0.14;
        s.ring.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.08);
        if (near(x, z, s.spot)) {
          s.taken = 0;
          done++;
          onStep('star');
        }
      });
    } else if (mode === 'delivery') {
      onPallet.rotation.y = t * 0.8;
      onPallet.position.y = 0.5 + Math.sin(t * 2.2) * 0.06;
      pickRing.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      dropRing.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      arrow.position.y = 2.1 + Math.sin(t * 3) * 0.2;
      arrow.rotation.y = t * 1.5;
      if (step === 'pickup' && near(x, z, pickAt)) {
        step = 'drop';
        done++;
        pallet.visible = false;
        carried.visible = true;
        drop.visible = true;
        onStep('pickup');
      } else if (step === 'drop' && near(x, z, dropAt)) {
        step = 'finished';
        done++;
        drop.visible = false;
        carriedPop = 0;
        onStep('drop');
      }
      if (carried.visible) {
        if (carriedPop >= 0) {
          carriedPop += dt;
          const k = carriedPop / POP;
          if (k >= 1) { carried.visible = false; carriedPop = -1; }
          else {
            carried.scale.setScalar(1 + k * 1.2);
            fade(carried, 1 - k);
            carried.position.set(x, 2.2 + k * 1.2, z);
          }
        } else {
          carried.position.set(x, 2.2 + Math.sin(t * 3) * 0.08, z);
          carried.rotation.y += dt * 1.2;
        }
      }
    }
  }

  return {
    setLevel,
    get total() { return total; },
    get done() { return done; },
    get stars() { return { got: starCount - stars.filter((s) => s.group.visible && s.taken < 0).length, of: starCount }; },
    get complete() { return done >= total; },
    update
  };
}
