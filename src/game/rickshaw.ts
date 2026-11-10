// The auto rickshaw: three wheels, open sides, a soft-top canopy. Front points along +X.
import * as THREE from 'three';
import {
  addWheel, amberMat, atRest, chromeMat, darkMat, extrude, lampMat, lengthwiseDisc, mirrorMat,
  plateMaterial, put, tailHousingMat, tailMat, type Vehicle
} from './kit';

export function buildRickshaw(): Vehicle {
  var rick = new THREE.Group();
  var rBody = new THREE.Group();
  rick.add(rBody);
  var rickPaint = new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.45, metalness: 0.1 });
  var rickGlassMat = new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 });
  var canopyMat = new THREE.MeshStandardMaterial({ color: 0xf4c20d, roughness: 0.78, side: THREE.DoubleSide });
  var seatMat = new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: 0.8 });
  function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
    return put(geo, mat, x, y, z, parent);
  }
  function rk(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) { return put(geo, mat, x, y, z, rBody); }
  function disc(r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
    return put(lengthwiseDisc(r, len), mat, x, y, z, parent);
  }
  var steerGroup = new THREE.Group();
  var rickV: Vehicle = {
    ...atRest,
    id: 'auto', name: 'Auto', group: rick, body: rBody, wheels: [], steerGroup: steerGroup, paint: rickPaint,
    halfLen: 1.35, halfWid: 0.68, bumpAt: [-0.7, 0, 0.7], bumpR: 0.68,
    home: { x: 0, z: -2.8 }, wheelbase: 1.89, wheelR: 0.221, maxFwd: 9.5, maxRev: 3, accel: 4.5, roll: 0.02
  };

  // Rear body: engine bay and bench base, with arches for the two back wheels.
  var rRear = new THREE.Shape();
  rRear.moveTo(-1.25, 0.42);
  rRear.lineTo(-1.2, 0.34);
  rRear.lineTo(-1.07, 0.34);
  rRear.absarc(-0.77, 0.34, 0.3, Math.PI, 0, true);
  rRear.lineTo(-0.2, 0.34);
  rRear.lineTo(-0.2, 0.58);
  rRear.lineTo(-0.66, 0.58);
  rRear.lineTo(-0.72, 1.08);
  rRear.lineTo(-1.12, 1.08);
  rRear.quadraticCurveTo(-1.3, 1.06, -1.3, 0.86);
  rRear.closePath();
  rk(extrude(rRear, 1.25, 0.06), rickPaint);
  // Front cowl: the rounded shield ahead of the driver.
  var rCowl = new THREE.Shape();
  rCowl.moveTo(0.7, 0.34);
  rCowl.lineTo(0.8, 0.34);
  rCowl.quadraticCurveTo(0.98, 0.5, 0.96, 0.75);
  rCowl.quadraticCurveTo(0.95, 0.95, 0.86, 1.02);
  rCowl.lineTo(0.7, 1.02);
  rCowl.closePath();
  rk(extrude(rCowl, 1.12, 0.06), rickPaint);
  rk(new THREE.BoxGeometry(1.5, 0.06, 1.2), darkMat, 0.05, 0.35, 0);                 // floor
  [-1, 1].forEach(function (s) {
    rk(new THREE.BoxGeometry(0.82, 0.14, 0.04), rickPaint, 0.2, 0.44, s * 0.6);      // low side sill
  });

  // Seats: driver up front, passenger bench behind a partition.
  rk(new THREE.BoxGeometry(0.2, 0.36, 0.5), rickPaint, 0.13, 0.54, 0);
  rk(new THREE.BoxGeometry(0.36, 0.08, 0.56), seatMat, 0.17, 0.75, 0);
  rk(new THREE.BoxGeometry(0.05, 0.75, 1.16), rickPaint, 0.03, 0.72, 0);
  rk(new THREE.BoxGeometry(0.05, 0.36, 0.56), seatMat, 0.065, 1.0, 0);
  rk(new THREE.BoxGeometry(0.44, 0.09, 1.05), seatMat, -0.43, 0.625, 0);
  var rBack = rk(new THREE.BoxGeometry(0.08, 0.44, 1.05), seatMat, -0.66, 0.86, 0);
  rBack.rotation.z = 0.1;

  // Windscreen: a solid body-colour panel from cowl to roof, glazed on both faces,
  // with deep side pillars so it reads as a frame from every angle.
  var rScreen = new THREE.Group();
  rScreen.position.set(0.87, 1.33, 0);
  rScreen.rotation.z = 0.1;
  rBody.add(rScreen);
  // A real opening: top and bottom bars and two side strips around one pane of glass.
  mesh(new THREE.BoxGeometry(0.05, 0.1, 1.22), rickPaint, 0, -0.29, 0, rScreen);
  mesh(new THREE.BoxGeometry(0.05, 0.08, 1.22), rickPaint, 0, 0.3, 0, rScreen);
  [-1, 1].forEach(function (s) {
    mesh(new THREE.BoxGeometry(0.05, 0.68, 0.1), rickPaint, 0, 0, s * 0.56, rScreen);
  });
  mesh(new THREE.BoxGeometry(0.02, 0.52, 1.04), rickGlassMat, 0, 0.01, 0, rScreen);
  var rWiper = mesh(new THREE.BoxGeometry(0.014, 0.3, 0.014), darkMat, 0.022, -0.09, 0.08, rScreen);
  rWiper.rotation.x = 0.7;
  [-1, 1].forEach(function (s) {
    mesh(new THREE.BoxGeometry(0.14, 0.68, 0.045), rickPaint, -0.06, 0, s * 0.59, rScreen);   // side pillar
    // Hoop behind the driver: runs from the sill to the roof.
    rk(new THREE.BoxGeometry(0.05, 1.36, 0.05), darkMat, 0.03, 1.06, s * 0.6);
    // Round mirror on a stalk.
    rk(new THREE.BoxGeometry(0.02, 0.02, 0.16), chromeMat, 0.85, 1.32, s * 0.68);
    disc(0.065, 0.03, darkMat, 0.85, 1.32, s * 0.78, rBody);
    disc(0.055, 0.008, mirrorMat, 0.832, 1.32, s * 0.78, rBody);
  });
  rk(new THREE.BoxGeometry(0.05, 0.05, 1.22), darkMat, 0.03, 1.72, 0);                // hoop top bar

  // Handlebar on a short steering head, with grips and a fare meter beside it.
  var rHead = rk(new THREE.BoxGeometry(0.05, 0.2, 0.05), darkMat, 0.7, 1.1, 0);
  rHead.rotation.z = 0.45;
  rk(new THREE.BoxGeometry(0.025, 0.025, 0.5), chromeMat, 0.655, 1.19, 0);
  [-1, 1].forEach(function (s) {
    var grip = new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12);
    grip.rotateX(Math.PI / 2);
    rk(grip, darkMat, 0.655, 1.19, s * 0.29);
  });
  rk(new THREE.BoxGeometry(0.1, 0.07, 0.16), darkMat, 0.74, 1.1, 0);                  // speedo pod
  rk(new THREE.BoxGeometry(0.07, 0.11, 0.08), tailHousingMat, 0.76, 1.12, -0.36);     // fare meter

  // Canopy: a soft top that runs from the windscreen over the bench and down the back.
  var rTop = new THREE.Shape();
  rTop.moveTo(0.92, 1.62);
  rTop.quadraticCurveTo(0.2, 1.82, -0.8, 1.74);
  rTop.quadraticCurveTo(-1.28, 1.68, -1.32, 1.3);
  rTop.lineTo(-1.32, 1.02);
  rTop.lineTo(-1.26, 1.02);
  rTop.lineTo(-1.26, 1.3);
  rTop.quadraticCurveTo(-1.22, 1.62, -0.8, 1.68);
  rTop.quadraticCurveTo(0.2, 1.76, 0.9, 1.57);
  rTop.closePath();
  rk(extrude(rTop, 1.3, 0.02), canopyMat);
  var rQuarter = new THREE.Shape();
  rQuarter.moveTo(-1.28, 1.04);
  rQuarter.lineTo(-0.75, 1.04);
  rQuarter.lineTo(-0.55, 1.7);
  rQuarter.lineTo(-0.8, 1.71);
  rQuarter.lineTo(-1.2, 1.62);
  rQuarter.lineTo(-1.28, 1.3);
  rQuarter.closePath();
  [-1, 1].forEach(function (s) {
    mesh(extrude(rQuarter, 0.04, 0.008), canopyMat, 0, 0, s * 0.625, rBody);         // closed rear corners
  });
  rk(new THREE.BoxGeometry(0.02, 0.2, 0.6), rickGlassMat, -1.335, 1.34, 0);              // rear window flap
  // Canopy side rails: the soft top drapes a little down each side.
  var rRail = new THREE.Shape();
  rRail.moveTo(0.92, 1.62);
  rRail.quadraticCurveTo(0.2, 1.82, -0.8, 1.74);
  rRail.lineTo(-0.8, 1.6);
  rRail.quadraticCurveTo(0.2, 1.69, 0.9, 1.5);
  rRail.closePath();
  [-1, 1].forEach(function (s) {
    mesh(extrude(rRail, 0.04, 0.008), canopyMat, 0, 0, s * 0.64, rBody);
  });

  // Front: single headlight, indicators, plate.
  disc(0.085, 0.08, lampMat, 0.995, 0.8, 0, rBody);
  var rRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 28), chromeMat);
  rRing.rotation.y = Math.PI / 2;
  rRing.position.set(1.03, 0.8, 0);
  rBody.add(rRing);
  var autoPlate = plateMaterial('AUTO 108');
  rk(new THREE.BoxGeometry(0.02, 0.09, 0.3), autoPlate, 1.003, 0.665, 0);
  // Back: lamps, plate, bumper.
  rk(new THREE.BoxGeometry(0.02, 0.1, 0.34), autoPlate, -1.335, 0.66, 0);
  rk(new THREE.BoxGeometry(0.06, 0.06, 1.2), darkMat, -1.31, 0.42, 0);
  [-1, 1].forEach(function (s) {
    disc(0.035, 0.05, amberMat, 0.985, 0.8, s * 0.36, rBody);
    rk(new THREE.BoxGeometry(0.03, 0.1, 0.12), tailMat, -1.35, 0.9, s * 0.5);
    rk(new THREE.BoxGeometry(0.03, 0.05, 0.12), amberMat, -1.345, 0.81, s * 0.5);
  });

  // Front wheel with its fork and mudguard, all turning together when steering.
  steerGroup.position.set(1.12, 0, 0);
  rick.add(steerGroup);
  var guard = mesh(new THREE.TorusGeometry(0.255, 0.04, 8, 24, Math.PI), rickPaint, 0, 0.221, 0, steerGroup);
  guard.scale.z = 2.3;
  [-1, 1].forEach(function (s) {
    var fork = mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), chromeMat, -0.059, 0.41, s * 0.1, steerGroup);
    fork.rotation.z = 0.3;
  });
  addWheel(rickV, 1.12, 0, true, 0.65);
  addWheel(rickV, -0.77, 0.56, false, 0.65); addWheel(rickV, -0.77, -0.56, false, 0.65);
  return rickV;
}
