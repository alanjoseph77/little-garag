// The world around the yard. It grows as the levels are finished:
//   level 1  trees, bushes and flowers
//   level 2  a road, houses, a shop and street lamps
//   level 3  tall towers, a building site with a crane, and a big wheel
// Everything stands outside the yard barrier, so none of it needs collision.
import * as THREE from 'three';
import { canvasTexture } from './kit';

export interface Scenery {
  /** Show the scenery for levels 1..n. */
  setLevel(n: number): void;
  /** Turn the big wheel and swing the crane. */
  update(dt: number): void;
}

const std = (color: number, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

// ---------- level 1: trees, bushes, flowers ----------
function buildNature(): THREE.Group {
  const g = new THREE.Group();
  const trunk = std(0x7a5230), pine = std(0x2f8f4e), leaf = std(0x4fae55), leaf2 = std(0x6cc04a);
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 8);
  const pineGeo = new THREE.ConeGeometry(1.25, 2.4, 9);
  const roundGeo = new THREE.IcosahedronGeometry(1.35, 1);
  const bushGeo = new THREE.IcosahedronGeometry(0.7, 1);

  // x, z, size
  const trees: [number, number, number][] = [
    [2, -11, 1], [8.5, -12.5, 1.2], [15, -11.5, 0.9], [21, -12.8, 1.1], [27, -11, 1.3],
    [28.5, -3, 1], [29, 4, 1.2], [28, 11, 0.9],
    [3, 12, 1.1], [10, 13.5, 1], [17, 12, 1.3], [24, 13.5, 1],
    [-8, -7, 1.2], [-9, 2, 1], [-8.5, 9, 1.1], [-3, 12.5, 0.9]
  ];
  trees.forEach(([x, z, s], i) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    mesh(trunkGeo, trunk, 0, 0.7, 0, t);
    if (i % 2) {
      mesh(pineGeo, pine, 0, 2.6, 0, t);
      mesh(new THREE.ConeGeometry(0.95, 1.8, 9), pine, 0, 3.7, 0, t);
    } else {
      mesh(roundGeo, i % 4 ? leaf : leaf2, 0, 2.5, 0, t);
    }
    g.add(t);
  });

  // Bushes and flowers just outside the barrier.
  const bushes: [number, number][] = [[6, -8.4], [11, -8.5], [17.5, -8.4], [23.5, -8.5], [24.2, 2], [24.3, -3], [24.2, 6.5], [7, 9.6], [13, 9.7], [20, 9.6]];
  bushes.forEach(([x, z], i) => mesh(bushGeo, i % 2 ? leaf : leaf2, x, 0.5, z, g).scale.set(1.2, 0.8, 1.2));
  const petals = [0xff5d8f, 0xffd23f, 0xffffff, 0xb36bff].map((c) => std(c, 0.6));
  const dot = new THREE.SphereGeometry(0.14, 8, 6);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399; // spread them without a pattern
    mesh(dot, petals[i % 4], 5 + ((i * 7.3) % 19), 0.16, i % 2 ? -8.2 - (a % 0.9) : 9.4 + (a % 0.9), g);
  }
  return g;
}

// ---------- level 2: road, houses, shop, lamps ----------
function wallTexture(wall: string): THREE.CanvasTexture {
  return canvasTexture(128, 128, (c) => {
    c.fillStyle = wall; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#9fd4f0';
    [[22, 24], [76, 24], [22, 78], [76, 78]].forEach(([x, y]) => {
      c.fillRect(x, y, 32, 36);
      c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(x, y, 32, 36);
      c.beginPath(); c.moveTo(x + 16, y); c.lineTo(x + 16, y + 36); c.stroke();
    });
  });
}

function buildTown(): THREE.Group {
  const g = new THREE.Group();

  // Road along the north side with a dashed centre line, and a pavement next to the yard.
  const roadTex = canvasTexture(256, 64, (c) => {
    c.fillStyle = '#474c52'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#f2c400'; c.fillRect(0, 29, 128, 6);
  });
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.repeat.set(11, 1);
  const road = mesh(new THREE.PlaneGeometry(44, 3.4), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1 }), 10, 0.01, -10.6, g);
  road.rotation.x = -Math.PI / 2;
  mesh(box(44, 0.08, 1.0), std(0xb9bdc2, 1), 10, 0.03, -8.4, g);

  // Houses.
  const walls: [string, number][] = [['#f4d58d', 0xc0452f], ['#a9d6e5', 0x7a3b69], ['#f7b5a7', 0x3d5a80], ['#cdeac0', 0xb5533c]];
  const wallMats = walls.map(([w]) => new THREE.MeshStandardMaterial({ map: wallTexture(w), roughness: 0.9 }));
  const roofMats = walls.map(([, r]) => std(r, 0.8));
  const roofGeo = new THREE.ConeGeometry(3.3, 1.9, 4);
  const houseGeo = box(4, 3, 3.6);
  const doorMat = std(0x7a4a2b, 0.8);
  // x, z, which way the front faces (the door), colour
  const houses: [number, number, number, number][] = [
    [4, -16, Math.PI / 2, 0], [10.5, -16, Math.PI / 2, 1], [17, -16, Math.PI / 2, 2], [23.5, -16, Math.PI / 2, 3],
    [30, 3.5, Math.PI, 1], [30, 10.5, Math.PI, 2],
    [9, 15, -Math.PI / 2, 3], [16.5, 15, -Math.PI / 2, 0]
  ];
  houses.forEach(([x, z, face, k]) => {
    const h = new THREE.Group();
    h.position.set(x, 0, z);
    h.rotation.y = face - Math.PI / 2; // door on local +z side after this turn
    mesh(houseGeo, wallMats[k], 0, 1.5, 0, h);
    const roof = mesh(roofGeo, roofMats[k], 0, 3.95, 0, h);
    roof.rotation.y = Math.PI / 4;
    mesh(box(0.9, 1.7, 0.06), doorMat, 0, 0.85, 1.83, h);
    g.add(h);
  });

  // A shop with a striped awning, facing the yard on the east side.
  const shop = new THREE.Group();
  shop.position.set(30, 0, -3.5);
  mesh(box(4.4, 3.4, 5.2), std(0xfff1c9), 0, 1.7, 0, shop);
  mesh(box(4.6, 0.3, 5.4), std(0x1f6f78), 0, 3.55, 0, shop);
  const awnTex = canvasTexture(128, 32, (c) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d7263d'; c.fillRect(i * 16, 0, 16, 32); }
  });
  const awning = mesh(box(1.4, 0.12, 5.0), new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.8 }), -2.7, 2.45, 0, shop);
  awning.rotation.z = -0.22;
  mesh(box(0.06, 1.9, 1.5), std(0x9fd4f0, 0.2), -2.22, 1.0, 0, shop);   // shop window
  mesh(box(0.06, 0.7, 3.2), std(0xffffff), -2.24, 3.0, 0, shop);        // sign board
  g.add(shop);

  // Street lamps along the yard.
  const pole = std(0x3a4148, 0.6), bulb = std(0xfff3c4, 0.4, { emissive: 0xffe9a0, emissiveIntensity: 1 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8), bulbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  [[7, -9.2], [13.5, -9.2], [20, -9.2], [25.2, -5], [25.2, 3], [25.2, 9.4], [8, 10.2], [16, 10.2]].forEach(([x, z]) => {
    mesh(poleGeo, pole, x, 1.6, z, g);
    mesh(bulbGeo, bulb, x, 3.3, z, g);
  });
  return g;
}

// ---------- level 3: towers, building site with a crane, big wheel ----------
function towerTexture(cols: number, rows: number, hue: string): THREE.CanvasTexture {
  const t = canvasTexture(cols * 16, rows * 16, (c) => {
    c.fillStyle = hue; c.fillRect(0, 0, cols * 16, rows * 16);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      c.fillStyle = Math.random() < 0.3 ? '#ffe9a6' : '#a9d6ef';
      c.fillRect(x * 16 + 3, y * 16 + 3, 10, 10);
    }
  });
  return t;
}

function buildCity(): { group: THREE.Group; crane: THREE.Object3D; wheel: THREE.Object3D; cabins: THREE.Object3D[] } {
  const group = new THREE.Group();
  const roofMat = std(0x5b6670, 0.9);

  // x, z, width, depth, height, wall colour
  const towers: [number, number, number, number, number, string][] = [
    [6, -26, 5, 5, 16, '#5d7b93'], [14, -28, 5, 5, 22, '#7a8fa3'], [22, -27, 6, 5, 14, '#6a8a8a'], [-6, -22, 5, 5, 18, '#8a7ea3'],
    [38, -10, 5, 6, 20, '#5d7b93'], [40, 4, 5, 5, 15, '#7a8fa3'], [38, 16, 6, 5, 24, '#6a8a8a'],
    [22, 26, 5, 5, 17, '#8a7ea3'], [4, 27, 6, 5, 12, '#5d7b93']
  ];
  towers.forEach(([x, z, w, d, h, hue]) => {
    const cols = Math.round(w * 1.2), rows = Math.round(h * 0.9);
    const tex = towerTexture(cols, rows, hue);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    mesh(box(w, h, d), mat, x, h / 2, z, group);
    mesh(box(w + 0.3, 0.3, d + 0.3), roofMat, x, h + 0.15, z, group);
  });

  // A half-built block with safety fencing, and a crane beside it.
  const steel = std(0x8a949c, 0.5), floorMat = std(0xb8bcc0, 0.9), orange = std(0xff8a1f, 0.6);
  const site = new THREE.Group();
  site.position.set(32, 0, -20);
  [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([x, z]) => mesh(box(0.28, 8, 0.28), steel, x, 4, z, site));
  [3, 6].forEach((y) => mesh(box(4.6, 0.25, 4.6), floorMat, 0, y, 0, site));
  mesh(box(4.6, 0.25, 4.6), floorMat, 0, 0.1, 0, site);
  for (let i = 0; i < 6; i++) mesh(box(1.1, 0.9, 0.08), orange, -3 + i * 1.2, 0.5, 4.4, site);
  group.add(site);

  const yellow = std(0xf2b705, 0.55);
  const crane = new THREE.Group();
  crane.position.set(26, 0, -20);
  mesh(box(0.6, 16, 0.6), yellow, 0, 8, 0, crane);
  mesh(box(1.1, 1.0, 1.1), steel, 0, 16.3, 0, crane);
  const jib = new THREE.Group();
  jib.position.y = 16.9;
  mesh(box(13, 0.45, 0.55), yellow, 4.5, 0, 0, jib);
  mesh(box(3, 0.9, 0.9), steel, -4.5, -0.1, 0, jib);          // counterweight
  mesh(box(0.05, 4, 0.05), std(0x222222), 8, -2.2, 0, jib);  // rope
  mesh(box(0.7, 0.5, 0.7), orange, 8, -4.4, 0, jib);          // load
  crane.add(jib);
  group.add(crane);

  // Big wheel.
  const wheelRoot = new THREE.Group();
  wheelRoot.position.set(-12, 0, 16);
  wheelRoot.rotation.y = Math.PI / 2 - 0.5;
  const legMat = std(0xd7263d, 0.5);
  [-1, 1].forEach((s) => {
    mesh(box(0.35, 8, 0.35), legMat, 0, 3.7, s * 1.0, wheelRoot);
    mesh(box(0.35, 8.4, 0.35), legMat, s * 1.7, 3.8, s * 1.0, wheelRoot).rotation.z = s * -0.38;
  });
  const wheel = new THREE.Group();
  wheel.position.y = 7.2;
  const rim = new THREE.TorusGeometry(5.2, 0.12, 8, 48);
  mesh(rim, std(0xffffff, 0.5), 0, 0, 0.5, wheel);
  mesh(rim, std(0xffffff, 0.5), 0, 0, -0.5, wheel);
  const spokeMat = std(0xe9ecef, 0.5);
  for (let i = 0; i < 8; i++) {
    const s = mesh(box(10.4, 0.08, 0.08), spokeMat, 0, 0, 0, wheel);
    s.rotation.z = (i * Math.PI) / 8;
  }
  const colours = [0xd7263d, 0xffd23f, 0x1b7fbd, 0x2fa84f, 0xff8a1f, 0xb36bff, 0xff5d8f, 0x4dd0e1];
  const cabins: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0);
    mesh(box(1.0, 0.8, 0.9), std(colours[i], 0.5), 0, -0.6, 0, holder);
    mesh(box(1.1, 0.12, 1.0), std(0xffffff, 0.5), 0, -0.15, 0, holder);
    wheel.add(holder);
    cabins.push(holder);
  }
  wheelRoot.add(wheel);
  group.add(wheelRoot);

  return { group, crane: jib, wheel, cabins };
}

export function buildScenery(scene: THREE.Scene): Scenery {
  const nature = buildNature();
  const town = buildTown();
  const city = buildCity();
  const layers = [nature, town, city.group];
  layers.forEach((l) => scene.add(l));
  let t = 0;

  return {
    setLevel(n) {
      layers.forEach((l, i) => { l.visible = i < n; });
    },
    update(dt) {
      t += dt;
      if (!city.group.visible) return;
      city.wheel.rotation.z -= dt * 0.18;
      city.cabins.forEach((c) => { c.rotation.z = -city.wheel.rotation.z; }); // cabins stay upright
      city.crane.rotation.y = Math.sin(t * 0.25) * 0.9;
    }
  };
}
