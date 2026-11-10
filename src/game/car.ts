// The hatchback. Its body is drawn as side profiles and extruded across the width.
// Front of the car points along +X; right-hand drive.
import * as THREE from 'three';
import {
  addWheel, amberMat, atRest, chromeMat, darkMat, extrude, lampMat, lengthwiseDisc, mirrorMat,
  plateMaterial, put, roundedRect, tailHousingMat, tailMat, whiteLampMat, type Vehicle
} from './kit';

export function buildCar(): Vehicle {
  var paintMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.38, metalness: 0.1 });
  var glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.12, metalness: 0.3 }); // dark tinted glass
  var trimMat = new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.85 });
  var plateTextMat = plateMaterial('PKT 2026');

  var car = new THREE.Group();
  var body = new THREE.Group();
  car.add(body);
  // Parts go on the body unless another parent is given.
  function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = body) {
    return put(geo, mat, x, y, z, parent);
  }
  function disc(r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) {
    return put(lengthwiseDisc(r, len), mat, x, y, z, parent);
  }

  // Lower body, drawn as a side profile. Front of the car points along +X.
  var lower = new THREE.Shape();
  lower.moveTo(-1.42, 0.32);
  // Wheel arches cut into the sill, so the tyres sit inside the body.
  lower.lineTo(-1.36, 0.32);
  lower.absarc(-0.9, 0.32, 0.46, Math.PI, 0, true);
  lower.lineTo(0.44, 0.32);
  lower.absarc(0.9, 0.32, 0.46, Math.PI, 0, true);
  lower.lineTo(1.4, 0.32);
  lower.quadraticCurveTo(1.52, 0.33, 1.53, 0.5);
  lower.lineTo(1.49, 0.72);
  lower.quadraticCurveTo(1.44, 0.82, 1.1, 0.85);
  lower.lineTo(0.72, 0.89);
  lower.lineTo(-1.3, 0.89);
  lower.quadraticCurveTo(-1.5, 0.87, -1.5, 0.62);
  lower.lineTo(-1.48, 0.4);
  lower.quadraticCurveTo(-1.47, 0.32, -1.42, 0.32);
  mesh(extrude(lower, 1.5, 0.08), paintMat);

  // Cabin glass.
  var cabin = new THREE.Shape();
  cabin.moveTo(0.82, 0.86);
  cabin.lineTo(0.36, 1.31);
  cabin.quadraticCurveTo(0.3, 1.37, 0.16, 1.37);
  cabin.lineTo(-0.95, 1.37);
  cabin.quadraticCurveTo(-1.14, 1.35, -1.2, 1.2);
  cabin.lineTo(-1.34, 0.86);
  cabin.closePath();
  mesh(extrude(cabin, 1.34, 0.06), glassMat);

  // Roof and pillars in body colour.
  var roof = new THREE.Shape();
  roof.moveTo(0.3, 1.36);
  roof.quadraticCurveTo(0.22, 1.43, 0.05, 1.43);
  roof.lineTo(-0.9, 1.43);
  roof.quadraticCurveTo(-1.1, 1.42, -1.14, 1.36);
  roof.closePath();
  mesh(extrude(roof, 1.38, 0.05), paintMat);
  // One-piece side frame per side: it follows the cabin outline from body to roof,
  // with openings for the two side windows, so every pillar meets the roof cleanly.
  var sideFrame = new THREE.Shape();
  sideFrame.moveTo(0.9, 0.86);
  sideFrame.lineTo(0.4, 1.36);
  sideFrame.quadraticCurveTo(0.33, 1.43, 0.16, 1.43);
  sideFrame.lineTo(-0.95, 1.43);
  sideFrame.quadraticCurveTo(-1.18, 1.41, -1.26, 1.22);
  sideFrame.lineTo(-1.42, 0.86);
  sideFrame.closePath();
  var frontWindow = new THREE.Path();
  frontWindow.moveTo(0.68, 0.93);
  frontWindow.lineTo(0.34, 1.27);
  frontWindow.lineTo(-0.2, 1.27);
  frontWindow.lineTo(-0.2, 0.93);
  frontWindow.closePath();
  var rearWindow = new THREE.Path();
  rearWindow.moveTo(-0.36, 0.93);
  rearWindow.lineTo(-0.36, 1.27);
  rearWindow.lineTo(-0.98, 1.27);
  rearWindow.lineTo(-1.1, 1.18);
  rearWindow.lineTo(-1.21, 0.93);
  rearWindow.closePath();
  sideFrame.holes.push(frontWindow, rearWindow);
  [-1, 1].forEach(function (s) {
    mesh(extrude(sideFrame, 0.07, 0.012), paintMat, 0, 0, s * 0.665);
  });

  // ---------- car interior, seen through the glass ----------
  mesh(new THREE.BoxGeometry(0.3, 0.12, 1.2), trimMat, 0.6, 0.94, 0);                 // dashboard
  [-1, 1].forEach(function (s) {
    var seatBack = mesh(new THREE.BoxGeometry(0.09, 0.42, 0.38), trimMat, -0.2, 1.08, s * 0.32);
    seatBack.rotation.z = 0.12;
    mesh(new THREE.BoxGeometry(0.07, 0.09, 0.2), trimMat, -0.25, 1.31, s * 0.32);
  });
  mesh(new THREE.BoxGeometry(0.09, 0.4, 1.15), trimMat, -0.95, 1.06, 0);              // rear bench back
  var steerGeo = new THREE.TorusGeometry(0.09, 0.014, 8, 24);
  steerGeo.rotateY(Math.PI / 2);
  var steerWheel = mesh(steerGeo, darkMat, 0.38, 1.03, 0.32);                         // right-hand drive
  steerWheel.rotation.z = -0.4;
  var steerCol = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), darkMat, 0.45, 1.0, 0.32);
  steerCol.rotation.z = -0.4;

  // ---------- front: sits on the nose, tilted to match its slope ----------
  var nose = new THREE.Group();
  nose.position.set(1.572, 0.6, 0);
  nose.rotation.z = 0.18;
  body.add(nose);
  mesh(new THREE.BoxGeometry(0.03, 0.11, 0.6), darkMat, 0, 0.07, 0, nose);            // grille opening
  [0.04, 0.07, 0.1].forEach(function (y) {
    mesh(new THREE.BoxGeometry(0.04, 0.012, 0.56), chromeMat, 0, y, 0, nose);         // grille slats
  });
  disc(0.042, 0.05, chromeMat, 0.01, 0.07, 0, nose);                                  // badge
  mesh(new THREE.BoxGeometry(0.02, 0.11, 0.38), plateTextMat, 0.006, -0.07, 0, nose); // number plate
  mesh(new THREE.BoxGeometry(0.04, 0.09, 0.8), darkMat, -0.005, -0.175, 0, nose);     // lower air intake
  [-0.19, -0.16].forEach(function (y) {
    mesh(new THREE.BoxGeometry(0.045, 0.008, 0.76), chromeMat, -0.005, y, 0, nose);
  });
  mesh(new THREE.BoxGeometry(0.2, 0.06, 1.42), darkMat, 1.5, 0.33, 0);                // front splitter
  // Wipers resting at the base of the windscreen.
  var wiperL = mesh(new THREE.BoxGeometry(0.018, 0.018, 0.5), darkMat, 0.8, 0.957, 0.3);
  wiperL.rotation.y = 0.05;
  var wiperR = mesh(new THREE.BoxGeometry(0.018, 0.018, 0.5), darkMat, 0.8, 0.957, -0.24);
  wiperR.rotation.y = 0.05;

  // ---------- rear: sits on the tailgate ----------
  var tail = new THREE.Group();
  tail.position.set(-1.556, 0.52, 0);
  tail.rotation.z = 0.09;
  body.add(tail);
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.5), chromeMat, 0, 0.1, 0, tail);           // tailgate handle bar
  mesh(new THREE.BoxGeometry(0.02, 0.11, 0.38), plateTextMat, -0.006, -0.01, 0, tail);
  mesh(new THREE.BoxGeometry(0.2, 0.1, 1.42), darkMat, -1.48, 0.36, 0);               // rear bumper skirt
  disc(0.036, 0.12, chromeMat, -1.55, 0.31, -0.42);                                   // exhaust tip
  disc(0.026, 0.125, darkMat, -1.55, 0.31, -0.42);
  // Roof spoiler: a wedge that grows out of the roof line, with no gap underneath.
  var spoilerShape = new THREE.Shape();
  spoilerShape.moveTo(-0.9, 1.44);
  spoilerShape.lineTo(-1.36, 1.455);
  spoilerShape.quadraticCurveTo(-1.4, 1.455, -1.4, 1.435);
  spoilerShape.lineTo(-1.37, 1.415);
  spoilerShape.lineTo(-1.12, 1.36);
  spoilerShape.lineTo(-0.9, 1.38);
  spoilerShape.closePath();
  mesh(extrude(spoilerShape, 1.36, 0.02), paintMat);
  mesh(new THREE.BoxGeometry(0.02, 0.016, 0.4), tailMat, -1.41, 1.437, 0);            // high brake light
  var rearWiper = mesh(new THREE.BoxGeometry(0.018, 0.018, 0.36), darkMat, -1.35, 0.99, 0.04);
  // Shark-fin aerial, sunk slightly into the roof.
  var finShape = new THREE.Shape();
  finShape.moveTo(-0.66, 1.455);
  finShape.quadraticCurveTo(-0.8, 1.48, -0.88, 1.56);
  finShape.quadraticCurveTo(-0.91, 1.575, -0.92, 1.55);
  finShape.lineTo(-0.93, 1.455);
  finShape.closePath();
  mesh(extrude(finShape, 0.06, 0.02), darkMat);

  var mirrorShellGeo = new THREE.ExtrudeGeometry(roundedRect(0.15, 0.085, 0.03), {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016, bevelSegments: 4, curveSegments: 10
  });
  mirrorShellGeo.translate(0, 0, -0.025);
  mirrorShellGeo.rotateY(Math.PI / 2);
  var mirrorBezelGeo = new THREE.ShapeGeometry(roundedRect(0.165, 0.1, 0.03), 10);
  mirrorBezelGeo.rotateY(-Math.PI / 2);
  var mirrorGlassGeo = new THREE.ShapeGeometry(roundedRect(0.145, 0.08, 0.022), 10);
  mirrorGlassGeo.rotateY(-Math.PI / 2);

  [-1, 1].forEach(function (s) {
    // Headlight unit: dark housing, two round lenses with chrome rings, indicator, daytime strip.
    mesh(new THREE.BoxGeometry(0.04, 0.15, 0.34), darkMat, 0, 0.07, s * 0.48, nose);
    [[0.058, 0.53], [0.044, 0.405]].forEach(function (l) {
      disc(l[0], 0.05, lampMat, 0.006, 0.075, s * l[1], nose);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(l[0] + 0.004, 0.007, 8, 28), chromeMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0.03, 0.075, s * l[1]);
      nose.add(ring);
    });
    mesh(new THREE.BoxGeometry(0.046, 0.1, 0.04), amberMat, 0, 0.075, s * 0.625, nose);
    mesh(new THREE.BoxGeometry(0.046, 0.014, 0.3), whiteLampMat, 0, 0.006, s * 0.46, nose);
    // Fog lamp in a dark surround.
    mesh(new THREE.BoxGeometry(0.035, 0.1, 0.17), darkMat, -0.005, -0.175, s * 0.56, nose);
    disc(0.036, 0.045, lampMat, 0, -0.175, s * 0.56, nose);

    // Tail light cluster: brake, indicator and reversing lamps in one housing.
    mesh(new THREE.BoxGeometry(0.04, 0.17, 0.36), tailHousingMat, 0, 0.06, s * 0.49, tail);
    mesh(new THREE.BoxGeometry(0.05, 0.13, 0.2), tailMat, -0.004, 0.06, s * 0.555, tail);
    mesh(new THREE.BoxGeometry(0.05, 0.055, 0.1), amberMat, -0.004, 0.097, s * 0.385, tail);
    mesh(new THREE.BoxGeometry(0.05, 0.055, 0.1), whiteLampMat, -0.004, 0.027, s * 0.385, tail);
    mesh(new THREE.BoxGeometry(0.02, 0.03, 0.16), tailMat, -1.585, 0.38, s * 0.52);   // bumper reflector

    // Door mirror: a rounded housing on a short foot, with the glass set in its back face.
    mesh(new THREE.BoxGeometry(0.07, 0.035, 0.1), darkMat, 0.665, 0.945, s * 0.765);
    mesh(mirrorShellGeo, paintMat, 0.66, 0.98, s * 0.87);
    var bezel = new THREE.Mesh(mirrorBezelGeo, darkMat);
    bezel.position.set(0.618, 0.98, s * 0.87);
    body.add(bezel);
    var glass = new THREE.Mesh(mirrorGlassGeo, mirrorMat);
    glass.position.set(0.615, 0.98, s * 0.87);
    body.add(glass);
    mesh(new THREE.BoxGeometry(0.012, 0.012, 0.11), amberMat, 0.698, 0.965, s * 0.875);

    // Dark liner inside each arch so you cannot see through under the car.
    mesh(new THREE.BoxGeometry(0.8, 0.4, 1.1), darkMat, s * 0.9, 0.52, 0);
  });

  var carV: Vehicle = {
    ...atRest,
    id: 'car', name: 'Car', group: car, body: body, wheels: [], steerGroup: null, paint: paintMat,
    halfLen: 1.6, halfWid: 0.78, bumpAt: [-0.85, 0, 0.85], bumpR: 0.78,
    home: { x: 0, z: 0 }, wheelbase: 1.8, wheelR: 0.34, maxFwd: 14, maxRev: 4, accel: 7, roll: 0.012
  };
  addWheel(carV, 0.9, 0.67, true); addWheel(carV, 0.9, -0.67, true);
  addWheel(carV, -0.9, 0.67, false); addWheel(carV, -0.9, -0.67, false);
  return carV;
}
