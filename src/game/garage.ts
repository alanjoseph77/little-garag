// The garage building and everything standing in it, plus the two questions the game asks of it:
// "is this spot solid?" and "how far back can the camera go before it hits a wall?".
import * as THREE from 'three';
import { canvasTexture, chromeMat, darkMat, put, tyreGeo, tyreMat } from './kit';

export interface Garage {
  /** True if a circle of radius r at (x, z) touches a wall or a piece of equipment. */
  hitsSolid(x: number, z: number, r: number): boolean;
  /**
   * How far the camera can pull back from (tx, ty, tz) along a direction before it would pass
   * through a wall, the roof or the beam over the door. `roof` says the roof was the limit.
   */
  clearDistance(tx: number, ty: number, tz: number, dx: number, dy: number, dz: number, want: number): { dist: number; roof: boolean };
}

export function buildGarage(scene: THREE.Scene): Garage {
  var G = { x0: -4.2, x1: 4.6, z0: -5.2, z1: 6.4, h: 3.3 };
  var gcx = (G.x0 + G.x1) / 2, gcz = (G.z0 + G.z1) / 2, gw = G.x1 - G.x0, gd = G.z1 - G.z0;
  var wallMat = new THREE.MeshStandardMaterial({ color: 0xdcd7ca, roughness: 0.95 });
  var bandMat = new THREE.MeshStandardMaterial({ color: 0x1f6f78, roughness: 0.8 });
  var slabMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.95 });
  var jointMat = new THREE.MeshStandardMaterial({ color: 0x7d8389, roughness: 1 });
  var woodMat = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.8 });
  var steelMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.6 });
  var redMat = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 });
  var blueMat = new THREE.MeshStandardMaterial({ color: 0x2b5fb3, roughness: 0.5 });
  var lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 });
  var skyGlassMat = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, emissive: 0x9fd0ee, emissiveIntensity: 0.6, roughness: 0.2 });
  var tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
  function g(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) { return put(geo, mat, x, y, z, scene); }
  function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {            // a piece of the building: takes shadow, casts none
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w: number, h: number, d: number) { return new THREE.BoxGeometry(w, h, d); }
  function signMaterial(text: string) {
    var map = canvasTexture(1024, 200, function (x) {
      x.fillStyle = '#1f6f78'; x.fillRect(0, 0, 1024, 200);
      x.fillStyle = '#f4f4ee'; x.font = 'bold 120px Arial, Helvetica, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, 512, 106);
    });
    return new THREE.MeshStandardMaterial({ map: map, roughness: 0.8 });
  }
  var signMat = signMaterial('LITTLE GARAGE');

  // Floor: concrete slab with joints, bay lines, a drain and a hazard strip at the door.
  var slab = part(scene, box(gw + 2.8, 0.04, gd + 0.8), slabMat, gcx + 1.2, 0, gcz);
  [-2.0, 0.9, 3.4].forEach(function (x) { part(scene, box(0.03, 0.006, gd), jointMat, x, 0.022, gcz); });
  [-2.6, 2.4].forEach(function (z) { part(scene, box(gw, 0.006, 0.03), jointMat, gcx, 0.022, z); });
  [1.15, -1.4, -4.0].forEach(function (z) { part(scene, box(4.4, 0.012, 0.07), lineMat, 0.1, 0.022, z); });
  part(scene, box(0.25, 0.012, 1.4), steelMat, 2.6, 0.022, -1.4);                      // drain grate
  var hazard = canvasTexture(64, 64, function (x) {
    x.fillStyle = '#f2c400'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#1c1d20';
    x.beginPath(); x.moveTo(0, 64); x.lineTo(32, 0); x.lineTo(64, 0); x.lineTo(32, 64); x.fill();
  });
  hazard.wrapS = hazard.wrapT = THREE.RepeatWrapping;
  hazard.repeat.set(1, 40);
  part(scene, box(0.3, 0.012, gd), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.8 }), G.x1 - 0.1, 0.022, gcz);

  // Back wall, with the sign, a pegboard of tools, a clock and a fire extinguisher.
  var wallBack = new THREE.Group();
  scene.add(wallBack);
  part(wallBack, box(0.2, G.h, gd + 0.4), wallMat, G.x0 - 0.1, G.h / 2, gcz);
  part(wallBack, box(0.02, 0.9, gd), bandMat, G.x0 + 0.01, 0.47, gcz);
  part(wallBack, box(0.02, 0.74, 3.8), signMat, G.x0 + 0.02, 2.6, -1.4);
  part(wallBack, box(0.03, 1.0, 2.4), woodMat, G.x0 + 0.03, 1.8, 1.95);
  [[1.2, 0.3, 0.42], [1.55, -0.5, 0.34], [1.9, 0.9, 0.3], [2.3, -0.2, 0.44], [2.65, 0.6, 0.26]].forEach(function (t) {
    part(wallBack, box(0.02, t[2], 0.05), chromeMat, G.x0 + 0.06, 1.8, t[0]).rotation.x = t[1];
  });
  var clockGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 28);
  clockGeo.rotateZ(Math.PI / 2);
  part(wallBack, clockGeo, lineMat, G.x0 + 0.03, 2.55, 4.5);
  part(wallBack, box(0.02, 0.17, 0.02), darkMat, G.x0 + 0.06, 2.62, 4.5);
  part(wallBack, box(0.02, 0.02, 0.13), darkMat, G.x0 + 0.06, 2.55, 4.44);
  part(wallBack, new THREE.CylinderGeometry(0.075, 0.075, 0.4, 16), redMat, G.x0 + 0.11, 1.2, -1.75);
  part(wallBack, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), darkMat, G.x0 + 0.11, 1.45, -1.75);

  // Side walls, each with daylight windows; one carries a tyre rack.
  function sideWall(z: number, inward: number) {
    var w = new THREE.Group();
    scene.add(w);
    part(w, box(gw + 0.2, G.h, 0.2), wallMat, gcx, G.h / 2, z - inward * 0.1);
    part(w, box(gw, 0.9, 0.02), bandMat, gcx, 0.47, z + inward * 0.01);
    return w;
  }
  function wallWindow(w: THREE.Object3D, x: number, z: number, inward: number) {
    part(w, box(1.8, 1.0, 0.05), steelMat, x, 2.25, z + inward * 0.02);
    part(w, box(1.6, 0.8, 0.07), skyGlassMat, x, 2.25, z + inward * 0.02);
    part(w, box(0.05, 0.8, 0.09), steelMat, x, 2.25, z + inward * 0.02);
  }
  var wallNear = sideWall(G.z1, -1);
  var wallFar = sideWall(G.z0, 1);
  [-2.2, 0.4, 3.0].forEach(function (x) { wallWindow(wallNear, x, G.z1, -1); });
  wallWindow(wallFar, -2.2, G.z0, 1);
  part(wallFar, box(3.0, 0.05, 0.3), steelMat, 2.1, 1.72, G.z0 + 0.16);                // tyre rack
  part(wallFar, box(3.0, 0.05, 0.05), steelMat, 2.1, 2.5, G.z0 + 0.05);
  for (var tr = 0; tr < 4; tr++) part(wallFar, tyreGeo, tyreMat, 0.95 + tr * 0.76, 2.09, G.z0 + 0.16);

  // Roof: slab on steel rafters, with strip lights.
  var roofGroup = new THREE.Group();
  scene.add(roofGroup);
  part(roofGroup, box(gw + 0.4, 0.14, gd + 0.4), wallMat, gcx, G.h + 0.07, gcz);
  [-2.6, -0.4, 1.8, 3.9].forEach(function (x) { part(roofGroup, box(0.12, 0.22, gd), steelMat, x, G.h - 0.11, gcz); });
  [[0, -2.8], [0, 0], [0, 3.7], [-2.9, 1.9]].forEach(function (l) {
    part(roofGroup, box(1.7, 0.05, 0.2), steelMat, l[0], G.h - 0.3, l[1]);
    part(roofGroup, box(1.6, 0.04, 0.12), tubeMat, l[0], G.h - 0.34, l[1]);
  });

  // Front: corner columns, a beam with the outside sign, and the rolled-up shutter.
  var frontGroup = new THREE.Group();
  scene.add(frontGroup);
  part(frontGroup, box(0.36, G.h, 0.36), bandMat, G.x1, G.h / 2, G.z1 + 0.08);
  part(frontGroup, box(0.36, G.h, 0.36), bandMat, G.x1, G.h / 2, G.z0 - 0.08);
  part(frontGroup, box(0.36, 0.62, gd + 0.5), bandMat, G.x1, G.h - 0.31, gcz);
  part(frontGroup, box(0.02, 0.5, 5.2), signMat, G.x1 + 0.19, G.h - 0.31, gcz);
  var shutterGeo = new THREE.CylinderGeometry(0.17, 0.17, gd - 0.2, 20);
  shutterGeo.rotateX(Math.PI / 2);
  part(frontGroup, shutterGeo, steelMat, G.x1 - 0.38, G.h - 0.42, gcz);
  // Equipment standing on the floor.
  g(box(0.7, 0.06, 2.4), woodMat, -3.83, 0.9, 1.95);                                   // workbench
  g(box(0.6, 0.86, 2.3), steelMat, -3.85, 0.45, 1.95);
  g(box(0.2, 0.14, 0.16), chromeMat, -3.7, 1.0, 2.8);                                  // vice
  g(box(0.55, 0.95, 0.8), redMat, -3.88, 0.5, 0.1);                                    // tool chest
  [0.2, 0.42, 0.64, 0.86].forEach(function (y) { g(box(0.02, 0.02, 0.5), chromeMat, -3.595, y, 0.1); });
  g(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), blueMat, -3.75, 0.47, -3.0);        // oil drum
  [[-4.35, 3], [-3.62, 2]].forEach(function (st) {
    for (var i = 0; i < st[1]; i++) g(tyreGeo, tyreMat, -3.72, 0.135 + i * 0.23, st[0]).rotation.x = Math.PI / 2;
  });
  // Shelving rack with boxes and oil cans.
  [3.6, 5.6].forEach(function (z) {
    [-4.1, -3.65].forEach(function (x) { g(box(0.04, 1.9, 0.04), steelMat, x, 0.95, z); });
  });
  [0.3, 0.82, 1.34, 1.86].forEach(function (y, row) {
    g(box(0.5, 0.03, 2.04), steelMat, -3.875, y, 4.6);
    [3.85, 4.35, 4.85, 5.35].forEach(function (z, i) {
      if ((row + i) % 3 === 0) g(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14), i % 2 ? redMat : blueMat, -3.88, y + 0.145, z);
      else if (row < 3) g(box(0.36, 0.26, 0.38), (row + i) % 2 ? woodMat : capBoxMat(), -3.88, y + 0.145, z);
    });
  });
  function capBoxMat() { return bandMat; }
  // Air compressor.
  var tank = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 18);
  tank.rotateZ(Math.PI / 2);
  g(tank, redMat, -2.9, 0.38, 5.9);
  g(box(0.3, 0.22, 0.26), steelMat, -2.95, 0.68, 5.9);
  g(box(0.03, 0.5, 0.03), darkMat, -2.42, 0.55, 5.9);
  [-3.2, -2.6].forEach(function (x) {
    var wh = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12);
    wh.rotateX(Math.PI / 2);
    g(wh, darkMat, x, 0.09, 5.9);
  });
  // Two-post car lift in the service bay, set back so it does not stand between you and the parked car.
  var LX = -1.5;
  [2.35, 5.05].forEach(function (z, i) {
    var inward = i ? -1 : 1;
    g(box(0.28, 2.7, 0.3), blueMat, LX, 1.35, z);
    g(box(0.6, 0.03, 0.5), steelMat, LX, 0.035, z);
    g(box(0.34, 0.3, 0.2), steelMat, LX, 0.28, z + inward * 0.2);
    [-1, 1].forEach(function (side) {
      // Swing arm from the post toward the middle of the bay, with a lifting pad on its tip.
      var dx = side * 0.644, dz = inward * 0.765, pz = z + inward * 0.18;
      var arm = g(box(1.0, 0.07, 0.1), darkMat, LX + dx * 0.5, 0.17, pz + dz * 0.5);
      arm.rotation.y = Math.atan2(-dz, dx);
      g(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14), steelMat, LX + dx * 0.97, 0.225, pz + dz * 0.97);
    });
  });
  g(box(0.2, 0.34, 0.16), steelMat, LX, 1.5, 2.12);                                    // lift power unit

  // Solid things you cannot drive through: walls, bench and chest, drum and tyres, rack, lift posts, compressor.
  var solids = [
    [G.x0 - 0.2, G.x0, G.z0 - 0.2, G.z1 + 0.2],
    [G.x0 - 0.2, G.x1, G.z1, G.z1 + 0.2],
    [G.x0 - 0.2, G.x1, G.z0 - 0.2, G.z0],
    [G.x0, -3.48, -0.4, 3.2],
    [G.x0, -3.3, -4.8, -2.6],
    [G.x0, -3.6, 3.5, 5.7],
    [LX - 0.15, LX + 0.15, 2.2, 2.5],
    [LX - 0.15, LX + 0.15, 4.9, 5.2],
    [-3.4, -2.4, 5.65, 6.2]
  ];
  function hitsSolid(x: number, z: number, r: number) {
    for (var i = 0; i < solids.length; i++) {
      var b = solids[i];
      if (x > b[0] - r && x < b[1] + r && z > b[2] - r && z < b[3] + r) return true;
    }
    return false;
  }

  // Nothing in the building ever hides. Instead the camera stays on the same side of every
  // wall as the vehicle.
  function clearDistance(tx: number, ty: number, tz: number, dx: number, dy: number, dz: number, want: number) {
    var t = want, roof = false;
    function cross(tt: number, a: number, a0: number, a1: number, b: number, b0: number, b1: number, isRoof = false) {
      if (tt > 0 && tt < t && a > a0 && a < a1 && b > b0 && b < b1) { t = tt; roof = isRoof; }
    }
    var tt;
    if (dx) {
      tt = (G.x0 - tx) / dx; cross(tt, tz + dz * tt, G.z0 - 0.2, G.z1 + 0.2, ty + dy * tt, -1, G.h);      // back wall
      tt = (G.x1 - tx) / dx; cross(tt, tz + dz * tt, G.z0 - 0.2, G.z1 + 0.2, ty + dy * tt, 2.6, G.h);     // door beam
    }
    if (dz) {
      tt = (G.z1 - tz) / dz; cross(tt, tx + dx * tt, G.x0 - 0.2, G.x1 + 0.2, ty + dy * tt, -1, G.h);      // side walls
      tt = (G.z0 - tz) / dz; cross(tt, tx + dx * tt, G.x0 - 0.2, G.x1 + 0.2, ty + dy * tt, -1, G.h);
    }
    if (dy) {
      tt = (G.h - ty) / dy; cross(tt, tx + dx * tt, G.x0 - 0.2, G.x1 + 0.2, tz + dz * tt, G.z0 - 0.2, G.z1 + 0.2, true);  // roof
    }
    return { dist: t < want ? Math.max(1.6, t - 0.45) : want, roof: roof };
  }

  return { hitsSolid: hitsSolid, clearDistance: clearDistance };
}
