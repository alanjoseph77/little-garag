// Building blocks for the scenery: a seeded random source, a batcher that merges many
// pieces into a few meshes (so phones draw them quickly), and all the painted textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from './kit';

/** Seeded random numbers, so the world looks the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 2D noise in 0..1. */
export function noise2(x: number, y: number): number {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
/** A transform: position, turn about the vertical axis, scale (one number or [x, y, z]), then tilt. */
export function at(x: number, y: number, z: number, ry = 0, scale: number | [number, number, number] = 1, rx = 0, rz = 0): THREE.Matrix4 {
  _p.set(x, y, z);
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  if (typeof scale === 'number') _s.setScalar(scale); else _s.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** A material that takes its tint from vertex colours, as every batched piece does. */
export const vmat = (o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true, ...o });

/** Paint every vertex of a geometry one colour (or multiply the colours it already has). */
export function tint(g: THREE.BufferGeometry, hex: number | THREE.Color): THREE.BufferGeometry {
  const c = hex instanceof THREE.Color ? hex : new THREE.Color(hex);
  const n = g.attributes.position.count;
  const old = g.attributes.color as THREE.BufferAttribute | undefined;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r * (old ? old.getX(i) : 1);
    arr[i * 3 + 1] = c.g * (old ? old.getY(i) : 1);
    arr[i * 3 + 2] = c.b * (old ? old.getZ(i) : 1);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Collects pieces per material and turns each pile into a single mesh. */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4, colour?: number): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    }
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (colour !== undefined || !g.attributes.color) tint(g, colour ?? 0xffffff);
    g.clearGroups();
    const list = this.parts.get(mat);
    if (list) list.push(g); else this.parts.set(mat, [g]);
  }

  /** Create the merged meshes inside `parent`. */
  build(parent: THREE.Object3D): void {
    this.parts.forEach((list, mat) => {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mat);
      if ((mat as THREE.Material).transparent) mesh.renderOrder = 1;
      parent.add(mesh);
    });
    this.parts.clear();
  }
}

// ---------------------------------------------------------------- textures

const speckle = (c: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, r: () => number) => {
  for (let i = 0; i < n; i++) {
    c.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    c.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5);
  }
};

export const HORIZON = '#d9e8f0';
export const NIGHT_HORIZON = '#1d2c58';

/** Sky from deep blue overhead to pale haze at the horizon, with soft clouds. Wraps round the world. */
export function skyTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024, r = rng(11);
  return canvasTexture(W, H, (c) => {
    const g = c.createLinearGradient(0, 0, 0, H / 2);
    g.addColorStop(0, '#3f7fd0');
    g.addColorStop(0.45, '#6aa5e3');
    g.addColorStop(0.8, '#a9cdee');
    g.addColorStop(1, HORIZON);
    c.fillStyle = g; c.fillRect(0, 0, W, H / 2);
    c.fillStyle = HORIZON; c.fillRect(0, H / 2, W, H / 2);
    const puff = (x: number, y: number, rad: number, a: number) => {
      const p = c.createRadialGradient(x, y, 0, x, y, rad);
      p.addColorStop(0, `rgba(255,255,255,${a})`);
      p.addColorStop(0.6, `rgba(255,255,255,${a * 0.55})`);
      p.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = p; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    };
    for (let k = 0; k < 46; k++) {
      // Most clouds sit low, where the camera sees the sky; they get smaller towards the horizon.
      const low = k < 30, cy = H * (low ? 0.385 + r() * 0.085 : 0.2 + r() * 0.17);
      const cx = r() * W, size = (low ? 10 + (0.48 - cy / H) * 260 : 30 + r() * 40) * (0.7 + r() * 0.6), n = 7 + Math.floor(r() * 7);
      for (const off of [-W, 0, W]) { // draw across the seam too
        const rr = rng(100 + k);
        for (let i = 0; i < n; i++) {
          const px = cx + off + (rr() - 0.5) * size * 5, py = cy - rr() * size * 0.55;
          puff(px, py, size * (0.55 + rr() * 0.6), 0.8);
        }
        // flat, slightly grey base
        c.fillStyle = 'rgba(190,205,220,0.10)';
        c.beginPath(); c.ellipse(cx + off, cy + size * 0.15, size * 2.6, size * 0.35, 0, 0, Math.PI * 2); c.fill();
      }
    }
    // thin haze band low in the sky
    const hz = c.createLinearGradient(0, H * 0.4, 0, H / 2);
    hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(255,255,255,0.35)');
    c.fillStyle = hz; c.fillRect(0, H * 0.4, W, H * 0.1);
  });
}

/** The night sky: deep blue, a haze of town glow at the horizon, a big moon and plenty of stars. */
export function nightSkyTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024, r = rng(77);
  return canvasTexture(W, H, (c) => {
    const g = c.createLinearGradient(0, 0, 0, H / 2);
    g.addColorStop(0, '#050a1c');
    g.addColorStop(0.5, '#10204a');
    g.addColorStop(0.85, '#22366b');
    g.addColorStop(1, NIGHT_HORIZON);
    c.fillStyle = g; c.fillRect(0, 0, W, H / 2);
    c.fillStyle = NIGHT_HORIZON; c.fillRect(0, H / 2, W, H / 2);
    // Stars: most in the band the camera can see.
    for (let i = 0; i < 700; i++) {
      const y = H * (0.08 + r() * 0.4), big = r() < 0.08;
      c.fillStyle = `rgba(255,255,${230 + Math.floor(r() * 25)},${0.35 + r() * 0.6})`;
      c.beginPath(); c.arc(r() * W, y, big ? 2.6 : 0.8 + r() * 1.2, 0, Math.PI * 2); c.fill();
    }
    // The moon, with a soft glow.
    const mx = W * 0.3, my = H * 0.33;
    const glow = c.createRadialGradient(mx, my, 10, mx, my, 150);
    glow.addColorStop(0, 'rgba(210,225,255,0.55)'); glow.addColorStop(1, 'rgba(210,225,255,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(mx, my, 150, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f1e2'; c.beginPath(); c.arc(mx, my, 44, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(190,190,170,0.35)';
    for (const [dx, dy, rad] of [[-12, -8, 9], [14, 6, 12], [-6, 18, 6], [10, -18, 5]]) {
      c.beginPath(); c.arc(mx + dx, my + dy, rad, 0, Math.PI * 2); c.fill();
    }
    // A few thin clouds catching the moonlight.
    for (let k = 0; k < 14; k++) {
      const cx = r() * W, cy = H * (0.36 + r() * 0.1), w = 120 + r() * 220;
      const p = c.createRadialGradient(cx, cy, 0, cx, cy, w);
      p.addColorStop(0, 'rgba(120,140,190,0.22)'); p.addColorStop(1, 'rgba(120,140,190,0)');
      c.fillStyle = p; c.beginPath(); c.ellipse(cx, cy, w, w * 0.18, 0, 0, Math.PI * 2); c.fill();
    }
  });
}

/** A soft warm blob of light, used for lamp halos and the pools on the ground. */
export function glowTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,236,180,1)');
    g.addColorStop(0.35, 'rgba(255,210,120,0.45)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
}

export function grassTexture(): THREE.CanvasTexture {
  const S = 512, r = rng(21);
  const t = canvasTexture(S, S, (c) => {
    c.fillStyle = '#6a9440'; c.fillRect(0, 0, S, S);
    const shades = ['#5b8a36', '#789f47', '#4f7d31', '#88ab52', '#6f9a3d', '#93a857', '#567f38'];
    for (let i = 0; i < 16000; i++) {
      const x = r() * S, y = r() * S, len = 4 + r() * 8, a = -Math.PI / 2 + (r() - 0.5) * 1.3;
      c.strokeStyle = shades[Math.floor(r() * shades.length)];
      c.globalAlpha = 0.35 + r() * 0.45;
      c.lineWidth = 1 + r();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    }
    c.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function barkTexture(): THREE.CanvasTexture {
  const r = rng(31);
  const t = canvasTexture(128, 256, (c) => {
    c.fillStyle = '#6b5a48'; c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) {
      const x = r() * 128, y = r() * 256, len = 20 + r() * 60;
      c.strokeStyle = r() < 0.55 ? 'rgba(40,30,22,0.45)' : 'rgba(150,132,110,0.35)';
      c.lineWidth = 1 + r() * 2.5;
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + (r() - 0.5) * 8, y + len * 0.3, x + (r() - 0.5) * 8, y + len * 0.6, x + (r() - 0.5) * 6, y + len); c.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A see-through cluster of leaves, used on many small cards to make a tree's leafy outline. */
export function leafTexture(): THREE.CanvasTexture {
  const S = 256, r = rng(41);
  return canvasTexture(S, S, (c) => {
    const greens = ['#5e9a3c', '#4d8a33', '#70ad47', '#437d2e', '#7fba50', '#568f38'];
    for (let i = 0; i < 46; i++) {
      const d = Math.sqrt(r()) * 96, a = r() * Math.PI * 2;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const len = 30 + r() * 22, wid = 11 + r() * 7, rot = a + (r() - 0.5) * 1.6;
      c.save(); c.translate(x, y); c.rotate(rot);
      c.fillStyle = greens[Math.floor(r() * greens.length)];
      c.beginPath(); c.moveTo(-len / 2, 0);
      c.quadraticCurveTo(0, -wid, len / 2, 0); c.quadraticCurveTo(0, wid, -len / 2, 0); c.fill();
      c.strokeStyle = 'rgba(30,60,25,0.5)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-len / 2, 0); c.lineTo(len / 2, 0); c.stroke();
      c.restore();
    }
  });
}

/** Blades of grass on a see-through card. */
export function tuftTexture(): THREE.CanvasTexture {
  const r = rng(51);
  return canvasTexture(128, 128, (c) => {
    const greens = ['#5b8a36', '#789f47', '#4f7d31', '#8cae55', '#6f9a3d'];
    for (let i = 0; i < 38; i++) {
      const x = 14 + r() * 100, h = 50 + r() * 70, lean = (r() - 0.5) * 46;
      c.strokeStyle = greens[Math.floor(r() * greens.length)];
      c.lineWidth = 3 + r() * 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, 128); c.quadraticCurveTo(x + lean * 0.2, 128 - h * 0.6, x + lean, 128 - h); c.stroke();
    }
  });
}

/** Flowers on stems on a see-through card. */
export function flowerTexture(): THREE.CanvasTexture {
  const r = rng(61);
  return canvasTexture(128, 128, (c) => {
    const petals = ['#f4f1e6', '#f2c230', '#e8607a', '#b98ae0', '#f39a3c'];
    for (let i = 0; i < 14; i++) {
      const x = 14 + r() * 100, h = 44 + r() * 66, lean = (r() - 0.5) * 30;
      c.strokeStyle = '#4f7d31'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, 128); c.quadraticCurveTo(x + lean * 0.2, 128 - h * 0.6, x + lean, 128 - h); c.stroke();
      const px = x + lean, py = 128 - h, col = petals[Math.floor(r() * petals.length)], rad = 6 + r() * 4;
      c.fillStyle = col;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.beginPath(); c.arc(px + Math.cos(a) * rad * 0.7, py + Math.sin(a) * rad * 0.7, rad * 0.6, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#e0a020'; c.beginPath(); c.arc(px, py, rad * 0.42, 0, Math.PI * 2); c.fill();
    }
  });
}

export function roofTexture(base: string): THREE.CanvasTexture {
  const r = rng(71);
  const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = base; c.fillRect(0, 0, 256, 256);
    const rows = 8, rh = 256 / rows, tw = 32;
    for (let y = 0; y < rows; y++) for (let x = -1; x < 9; x++) {
      const ox = x * tw + (y % 2 ? tw / 2 : 0), v = (r() - 0.5) * 0.22;
      c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      c.fillRect(ox, y * rh, tw, rh);
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(ox, y * rh, 1.5, rh);
    }
    for (let y = 0; y < rows; y++) {
      const g = c.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
      g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      c.fillStyle = g; c.fillRect(0, y * rh, 256, rh);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function brickTexture(base = '#9b5a42'): THREE.CanvasTexture {
  const r = rng(81);
  const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#b9b0a2'; c.fillRect(0, 0, 256, 256);
    const bh = 16, bw = 40;
    for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) {
      c.fillStyle = base; c.fillRect(x * bw + (y % 2 ? bw / 2 : 0) + 1.5, y * bh + 1.5, bw - 3, bh - 3);
      const v = (r() - 0.5) * 0.3;
      c.fillStyle = v > 0 ? `rgba(255,220,190,${v})` : `rgba(30,10,0,${-v})`;
      c.fillRect(x * bw + (y % 2 ? bw / 2 : 0) + 1.5, y * bh + 1.5, bw - 3, bh - 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** One window with a white frame, a pane that reflects the sky, curtains and a sill. */
function paintWindow(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x - 7, y + h + 6, w + 14, 9);       // shadow under the sill
  c.fillStyle = '#f3f1ea'; c.fillRect(x - 6, y - 6, w + 12, h + 12);                // frame
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2f4658'); g.addColorStop(1, '#6f93ad');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(245,238,225,0.55)';                                            // curtains
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.3, y); c.quadraticCurveTo(x + w * 0.18, y + h * 0.5, x, y + h * 0.8); c.fill();
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w * 0.7, y); c.quadraticCurveTo(x + w * 0.82, y + h * 0.5, x + w, y + h * 0.8); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.16)';                                            // glint
  c.beginPath(); c.moveTo(x + w * 0.45, y); c.lineTo(x + w * 0.75, y); c.lineTo(x + w * 0.4, y + h); c.lineTo(x + w * 0.1, y + h); c.fill();
  c.fillStyle = '#f3f1ea'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h * 0.42, w, 4);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y, w, 4);                          // shade under the lintel
  c.fillStyle = '#e4e0d6'; c.fillRect(x - 10, y + h + 3, w + 20, 6);                // sill
}

function paintWall(c: CanvasRenderingContext2D, W: number, H: number, base: string, r: () => number) {
  c.fillStyle = base; c.fillRect(0, 0, W, H);
  speckle(c, W, H, 2600, 0.035, r);
  const top = c.createLinearGradient(0, 0, 0, 34);
  top.addColorStop(0, 'rgba(0,0,0,0.42)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = top; c.fillRect(0, 0, W, 34);                                        // shade under the eaves
  const dirt = c.createLinearGradient(0, H - 70, 0, H);
  dirt.addColorStop(0, 'rgba(60,50,40,0)'); dirt.addColorStop(1, 'rgba(60,50,40,0.22)');
  c.fillStyle = dirt; c.fillRect(0, H - 70, W, 70);
  c.fillStyle = '#8f8c86'; c.fillRect(0, H - 20, W, 20);                             // plinth
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0, H - 22, W, 3);
}

/** Front and side walls of a house. `floors` is 1 or 2; each floor is 256 px tall. */
export function houseTextures(base: string, door: string, floors: number): { front: THREE.CanvasTexture; side: THREE.CanvasTexture } {
  const W = 512, H = 256 * floors, r = rng(91 + floors);
  const front = canvasTexture(W, H, (c) => {
    paintWall(c, W, H, base, r);
    const gy = H - 256; // top of the ground floor
    for (const x of [58, 352]) paintWindow(c, x, gy + 62, 102, 108);
    // door with panels, a small window and a step
    const dx = 212, dw = 88, dy = gy + 56, dh = 180;
    c.fillStyle = '#f3f1ea'; c.fillRect(dx - 7, dy - 7, dw + 14, dh + 7);
    c.fillStyle = door; c.fillRect(dx, dy, dw, dh);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(dx + 10, dy + 62, dw - 20, 46); c.fillRect(dx + 10, dy + 118, dw - 20, 52);
    c.fillStyle = '#7d9db3'; c.fillRect(dx + 14, dy + 12, dw - 28, 38);
    c.fillStyle = '#d9c27a'; c.beginPath(); c.arc(dx + dw - 14, dy + 100, 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(dx - 7, dy - 7, dw + 14, 5);
    if (floors === 2) for (const x of [58, 205, 352]) paintWindow(c, x, 62, 102, 108);
  });
  const side = canvasTexture(W, H, (c) => {
    paintWall(c, W, H, base, r);
    for (let f = 0; f < floors; f++) for (const x of [96, 314]) paintWindow(c, x, f * 256 + 62, 102, 108);
  });
  front.anisotropy = side.anisotropy = 4;
  return { front, side };
}

/** The shop front: a fascia with its name, big windows and a glass door. */
export function shopFrontTexture(): THREE.CanvasTexture {
  const W = 512, H = 256, r = rng(101);
  return canvasTexture(W, H, (c) => {
    paintWall(c, W, H, '#e9e2d0', r);
    c.fillStyle = '#1f5560'; c.fillRect(0, 26, W, 50);
    c.fillStyle = '#f6f1e2'; c.font = '800 34px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('CORNER SHOP', W / 2, 52);
    const glass = (x: number, w: number, y: number, h: number) => {
      c.fillStyle = '#2b2f33'; c.fillRect(x - 5, y - 5, w + 10, h + 10);
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#34506a'); g.addColorStop(1, '#86a9c2');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.beginPath(); c.moveTo(x + w * 0.5, y); c.lineTo(x + w * 0.8, y); c.lineTo(x + w * 0.4, y + h); c.lineTo(x + w * 0.1, y + h); c.fill();
    };
    glass(30, 170, 96, 116); glass(312, 170, 96, 116); glass(222, 68, 92, 144);
    c.fillStyle = '#c9a34a'; c.fillRect(226, 160, 6, 22);
  });
}

/** A strip of road: tarmac, white edge lines and a dashed centre line. One tile is 4 m long. */
export function roadTexture(): THREE.CanvasTexture {
  const r = rng(111);
  const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#3f4347'; c.fillRect(0, 0, 256, 256);
    speckle(c, 256, 256, 4200, 0.07, r);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 60, 256, 34); c.fillRect(0, 162, 256, 34); // tyre wear
    c.fillStyle = '#e9e7e0'; c.fillRect(0, 10, 256, 6); c.fillRect(0, 240, 256, 6);
    c.fillRect(0, 125, 128, 6);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Paving slabs. */
export function pavingTexture(): THREE.CanvasTexture {
  const r = rng(121);
  const t = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#b4b1aa'; c.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const v = (r() - 0.5) * 0.12;
      c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      c.fillRect(x * 64, y * 64, 64, 64);
    }
    speckle(c, 128, 128, 700, 0.05, r);
    c.strokeStyle = 'rgba(70,66,60,0.55)'; c.lineWidth = 2;
    c.strokeRect(0, 0, 64, 64); c.strokeRect(64, 0, 64, 64); c.strokeRect(0, 64, 64, 64); c.strokeRect(64, 64, 64, 64);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Office-tower glass: 4 bays by 4 floors per tile, each pane a slightly different sky tone. */
export function glassFacadeTexture(tone: [number, number, number], seed: number): THREE.CanvasTexture {
  const r = rng(seed), W = 256, H = 512;
  const t = canvasTexture(W, H, (c) => {
    c.fillStyle = '#2a3238'; c.fillRect(0, 0, W, H);
    const bw = W / 4, fh = H / 4;
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const k = 0.78 + r() * 0.4, x = b * bw + 3, y = f * fh + 3, w = bw - 6, h = fh * 0.72;
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgb(${tone[0] * k * 0.7},${tone[1] * k * 0.7},${tone[2] * k * 0.7})`);
      g.addColorStop(1, `rgb(${Math.min(255, tone[0] * k * 1.25)},${Math.min(255, tone[1] * k * 1.25)},${Math.min(255, tone[2] * k * 1.25)})`);
      c.fillStyle = g; c.fillRect(x, y, w, h);
      if (r() < 0.22) { c.fillStyle = 'rgba(255,236,190,0.35)'; c.fillRect(x, y, w, h); } // a lit room
      c.fillStyle = 'rgba(255,255,255,0.10)';
      c.beginPath(); c.moveTo(x + w * 0.5, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h * 0.3); c.fill();
      c.fillStyle = `rgb(${tone[0] * 0.45},${tone[1] * 0.45},${tone[2] * 0.45})`;
      c.fillRect(x, y + h + 2, w, fh - h - 8); // the panel between floors
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A block of flats: plastered wall, windows and little balconies. Same 4 by 4 tile. */
export function flatsFacadeTexture(wall: string, seed: number): THREE.CanvasTexture {
  const r = rng(seed), W = 256, H = 512;
  const t = canvasTexture(W, H, (c) => {
    c.fillStyle = wall; c.fillRect(0, 0, W, H);
    speckle(c, W, H, 1800, 0.03, r);
    const bw = W / 4, fh = H / 4;
    for (let f = 0; f < 4; f++) {
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, f * fh, W, 3);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, f * fh + 3, W, 3);
      for (let b = 0; b < 4; b++) {
        const x = b * bw + 13, y = f * fh + 26, w = bw - 26, h = 58;
        c.fillStyle = '#e9e6de'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
        const lit = r() < 0.25;
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, lit ? '#b89a5a' : '#2c4254'); g.addColorStop(1, lit ? '#e6cf93' : '#6689a3');
        c.fillStyle = g; c.fillRect(x, y, w, h);
        c.fillStyle = '#e9e6de'; c.fillRect(x + w / 2 - 1.5, y, 3, h);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y, w, 3);
        if (b % 2 === 0) { // balcony
          c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 8, y + h + 14, w + 16, 6);
          c.fillStyle = '#d8d4cb'; c.fillRect(x - 8, y + h - 12, w + 16, 26);
          c.fillStyle = 'rgba(0,0,0,0.12)';
          for (let k = 0; k < 6; k++) c.fillRect(x - 6 + k * ((w + 12) / 6), y + h - 9, 2, 20);
        }
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Criss-cross steelwork with gaps you can see through (crane mast, scaffolding). */
export function latticeTexture(colour: string): THREE.CanvasTexture {
  const t = canvasTexture(64, 64, (c) => {
    c.strokeStyle = colour; c.lineWidth = 7; c.lineCap = 'square';
    c.strokeRect(3.5, 3.5, 57, 57);
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(4, 4); c.lineTo(60, 60); c.moveTo(60, 4); c.lineTo(4, 60); c.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A soft dark patch laid on the grass under things, to seat them on the ground. */
export function shadowTexture(round: boolean): THREE.CanvasTexture {
  return canvasTexture(128, 128, (c) => {
    if (round) {
      const g = c.createRadialGradient(64, 64, 6, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    } else {
      c.filter = 'blur(9px)';
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(20, 20, 88, 88);
    }
  }, false);
}
