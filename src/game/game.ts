// The running game: scene, lights, camera, driving and collisions.
// React talks to it only through the small API returned by createGame().
import * as THREE from 'three';
import { buildCar } from './car';
import { buildGarage } from './garage';
import { buildRickshaw } from './rickshaw';
import { buildYard } from './yard';
import type { Vehicle } from './kit';

export type InputKey = 'fwd' | 'back' | 'left' | 'right';

export interface GameHooks {
  /** Called when the whole-number speed in km/h changes. */
  onSpeed(kmh: number): void;
}

export interface Game {
  setInput(key: InputKey, down: boolean): void;
  /** Switch which vehicle is driven. Ids: 'car', 'auto'. */
  selectVehicle(id: string): void;
  /** Repaint the active vehicle with a CSS hex colour. */
  paint(hex: string): void;
  /** Put both vehicles and the cones back where they started. */
  reset(): void;
  dispose(): void;
}

const SKY = 0xbfe3f5;
const GROUND = 0x8fc98a;

export function createGame(canvas: HTMLCanvasElement, stage: HTMLElement, hooks: GameHooks): Game {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 30, 80);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7b0, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // ---------- ground ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- world ----------
  const garage = buildGarage(scene);
  const yard = buildYard(scene);
  const blocked = (x: number, z: number, r: number) => garage.hitsSolid(x, z, r) || yard.hitsSolid(x, z, r);
  const carV = buildCar();
  const rickV = buildRickshaw();
  const vehicles: Vehicle[] = [carV, rickV];
  vehicles.forEach((v) => scene.add(v.group));
  let active = carV;

  // Cones to weave between, in the yard out past the garage door.
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf26b1d, roughness: 0.6 });
  const cones: THREE.Group[] = [];
  for (const spot of yard.cones) {
    const cone = new THREE.Group();
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 18), coneMat);
    top.position.y = 0.33; top.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), coneMat);
    base.position.y = 0.025; base.castShadow = true;
    cone.add(top, base);
    cone.position.set(spot.x, 0, spot.z);
    scene.add(cone);
    cones.push(cone);
  }

  // ---------- camera orbit: drag to look around. The zoom is fixed, so pinching or scrolling never changes it ----------
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const orbit = { theta: 0.28, phi: 0.2, radius: 12 }; // radius never changes
  let touched = false;
  const pointers = new Map<number, { x: number; y: number }>();
  const onPointerDown = (e: PointerEvent) => {
    touched = true;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      orbit.theta += dx * 0.008;
      orbit.phi = Math.max(0.05, Math.min(1.35, orbit.phi + dy * 0.006));
    }
  };
  const onPointerEnd = (e: PointerEvent) => { pointers.delete(e.pointerId); };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);

  // ---------- driving ----------
  const input: Record<InputKey, number> = { fwd: 0, back: 0, left: 0, right: 0 };
  const NO_INPUT: Record<InputKey, number> = { fwd: 0, back: 0, left: 0, right: 0 };
  const camShift = new THREE.Vector3(); // eases the camera across when you switch vehicle

  function park(v: Vehicle) {
    v.x = v.home.x; v.z = v.home.z; v.heading = 0; v.speed = 0; v.steer = 0;
  }
  function reset() {
    vehicles.forEach(park);
    camShift.set(0, 0, 0);
    cones.forEach((cn) => { cn.rotation.set(0, 0, 0); cn.position.y = 0; cn.userData.down = false; });
  }
  reset();

  // Each vehicle is three circles along its length; two vehicles touch when any pair of circles overlaps.
  function touchesVehicle(v: Vehicle) {
    const c = Math.cos(v.heading), sn = Math.sin(v.heading);
    return vehicles.some((u) => {
      if (u === v) return false;
      const uc = Math.cos(u.heading), us = Math.sin(u.heading), reach = v.bumpR + u.bumpR;
      return v.bumpAt.some((a) => {
        const ax = v.x + c * a, az = v.z - sn * a;
        return u.bumpAt.some((b) => {
          const dx = ax - (u.x + uc * b), dz = az - (u.z - us * b);
          return dx * dx + dz * dz < reach * reach;
        });
      });
    });
  }

  function drive(v: Vehicle, inp: Record<InputKey, number>, dt: number) {
    const throttle = inp.fwd - inp.back;
    if (throttle > 0) v.speed += (v.speed < 0 ? 16 : v.accel) * dt;
    else if (throttle < 0) v.speed -= (v.speed > 0 ? 16 : 5) * dt;
    else v.speed -= v.speed * Math.min(1, 1.3 * dt);
    v.speed = Math.max(-v.maxRev, Math.min(v.maxFwd, v.speed));
    if (Math.abs(v.speed) < 0.02 && !throttle) v.speed = 0;

    const steerTarget = (inp.left - inp.right) * 0.5;
    v.steer += (steerTarget - v.steer) * Math.min(1, 8 * dt);
    const ox = v.x, oz = v.z, oh = v.heading;
    v.heading += (Math.tan(v.steer) * v.speed * dt) / v.wheelbase;
    const c = Math.cos(v.heading), sn = Math.sin(v.heading);
    v.x += c * v.speed * dt;
    v.z -= sn * v.speed * dt;
    // Stop dead at a wall, the workbench, the yard barrier or the other vehicle instead of driving through it.
    if (
      v.speed !== 0 &&
      (blocked(v.x + c * 1.25, v.z - sn * 1.25, 0.7) ||
        blocked(v.x - c * 1.25, v.z + sn * 1.25, 0.7) ||
        touchesVehicle(v))
    ) {
      v.x = ox; v.z = oz; v.heading = oh; v.speed = 0;
    }

    v.group.position.set(v.x, 0, v.z);
    v.group.rotation.y = v.heading;
    v.body.rotation.x = v.steer * v.speed * v.roll;
    if (v.steerGroup) v.steerGroup.rotation.y = v.steer;
    v.wheels.forEach((w) => {
      w.spin.rotation.z -= (w.dir * v.speed * dt) / v.wheelR;
      if (w.steers) w.pivot.rotation.y = v.steer;
    });
  }

  let shownSpeed = -1;
  function step(dt: number) {
    vehicles.forEach((v) => drive(v, v === active ? input : NO_INPUT, dt));
    camShift.multiplyScalar(Math.max(0, 1 - 6 * dt));
    cones.forEach((cn) => {
      if (cn.userData.down) return;
      const dx = cn.position.x - active.x, dz = cn.position.z - active.z;
      if (dx * dx + dz * dz < 1.1 && Math.abs(active.speed) > 0.5) {
        cn.userData.down = true;
        cn.rotation.z = Math.PI / 2;
        cn.rotation.y = active.heading;
        cn.position.y = 0.2;
      }
    });
    const kmh = Math.round(Math.abs(active.speed) * 3.6);
    if (kmh !== shownSpeed) { shownSpeed = kmh; hooks.onSpeed(kmh); }
  }

  let camDist = 0;
  function place(dt: number) {
    const tx = active.x + camShift.x, tz = active.z + camShift.z;
    // Keep the ground under the vehicle so the world never runs out.
    ground.position.set(tx, -0.021, tz);
    sun.position.set(tx + 4, 9, tz + 3);
    sun.target.position.set(tx, 0, tz);
    // Under the roof, flatten the viewing angle until the ceiling is no longer in the way,
    // so looking down from high up slides the camera along the ceiling instead of into the car.
    let phi = orbit.phi, dx = 0, dy = 0, dz = 0, room = { dist: orbit.radius, roof: false };
    do {
      const cp = Math.cos(phi);
      dx = cp * Math.cos(orbit.theta); dy = Math.sin(phi); dz = cp * Math.sin(orbit.theta);
      room = garage.clearDistance(tx, 0.8, tz, dx, dy, dz, orbit.radius);
      phi -= 0.03;
    } while (room.roof && phi > 0.05);
    // Pull in at once when a wall is in the way; ease back out when there is room again.
    camDist = room.dist < camDist ? room.dist : camDist + (room.dist - camDist) * Math.min(1, 4 * dt);
    camera.position.set(tx + dx * camDist, 0.8 + dy * camDist, tz + dz * camDist);
    camera.lookAt(tx, 0.8, tz);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 50; // wider on a portrait phone
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  let raf = 0, last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!touched && !reduceMotion) orbit.theta += dt * 0.15; // slow turntable until someone plays
    step(dt);
    place(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setInput(key, down) {
      input[key] = down ? 1 : 0;
      if (down) touched = true;
    },
    selectVehicle(id) {
      const v = vehicles.find((x) => x.id === id);
      if (!v || v === active) return;
      if (!reduceMotion) camShift.set(active.x + camShift.x - v.x, 0, active.z + camShift.z - v.z);
      active = v;
      touched = true;
      shownSpeed = -1;
    },
    paint(hex) {
      active.paint.color.set(hex);
    },
    reset,
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      renderer.dispose();
    }
  };
}
