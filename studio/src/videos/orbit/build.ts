// The places of the satellite short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): launch pad, radiation lab, clean room, mission control, Arctic ground station, park.
// Static geometry is merged per material; the Earth, rocket, beam and other moving parts are built in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep } from "./paint";
import { twoTone } from "./shade";
import { PAD, LAB, CLEAN, CTRL, STA, PARK, ROCKET, CHIP_AT } from "./story";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m as THREE.MeshLambertMaterial;
};
/** emissive / unlit surfaces (lantern glow, windows, screens): values > 1 bloom */
export const glow = (key: string, col: THREE.ColorRepresentation, k = 1, map?: THREE.Texture) => {
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), map: map ?? null }); mats.set(key, m); }
  return m;
};

const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
/** axis box; texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};
const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 0, bottom = false) => boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile, bottom);
const T = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(1, 1, 1));
/** quad facing +y at height y */
const floorQ = (x0: number, x1: number, z0: number, z1: number, y: number, tile: number) => quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), (x1 - x0) / tile, (z1 - z0) / tile);
/** wall quad facing +z (or -z with flip) */
const wallZ = (x0: number, x1: number, y0: number, y1: number, z: number, tile: number, flip = false) =>
  flip ? quad(V(x1, y0, z), V(x0, y0, z), V(x0, y1, z), V(x1, y1, z), (x1 - x0) / tile, (y1 - y0) / tile) : quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), (x1 - x0) / tile, (y1 - y0) / tile);
/** wall quad facing +x (or -x with flip) */
const wallX = (z0: number, z1: number, y0: number, y1: number, x: number, tile: number, flip = false) =>
  flip ? quad(V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0), (z1 - z0) / tile, (y1 - y0) / tile) : quad(V(x, y0, z1), V(x, y0, z0), V(x, y1, z0), V(x, y1, z1), (z1 - z0) / tile, (y1 - y0) / tile);

/** merged static meshes per material; cast = shadow casters (walls and ceilings never cast: the key would black out the room) */
export class Batch {
  private g = new Map<THREE.Material, { list: THREE.BufferGeometry[]; cast: boolean }>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4, cast = true) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const e = this.g.get(mat);
    if (e) { e.list.push(x); e.cast = e.cast || cast; } else this.g.set(mat, { list: [x], cast });
  }
  build(parent: THREE.Object3D) {
    for (const [mat, e] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(e.list, false), mat);
      mesh.castShadow = e.cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- painted textures ----------------

// ---------------- painted textures ----------------
const seam = "rgba(38,24,30,0.85)";
const tiles = (key: string, base: string, n = 4, line = seam) => ctex(key, 512, 512, (g, r) => {
  const t = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = jit(r, base, 0.05, 3, 0.1); g.fillRect(i * t, j * t, t, t); }
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(512, i * t); g.stroke(); }
});
const paintWall = (key: string, base: string, stripe?: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 40 + r() * 80, 20 + r() * 40, r() * 3, 0, 6.283); g.fill(); }
  if (stripe) { g.fillStyle = stripe; g.fillRect(0, 440, 512, 30); }
});
const snowTex = () => ctex("snow", 1024, 1024, (g, r) => {
  g.fillStyle = "#eef2fa"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() > 0.5 ? "rgba(200,212,240,0.35)" : "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 60 + r() * 160, 14 + r() * 30, r() * 0.4, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(170,186,225,0.45)"; g.lineWidth = 3;
  for (let i = 0; i < 90; i++) { const x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 6, x + 70 + r() * 40, y); g.stroke(); }
});
const rockSnowTex = () => ctex("rockSnow", 1024, 512, (g, r) => {
  g.fillStyle = "#6f6a7a"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 26; i++) { // snow streaks down from the top
    const x = r() * 1024, w = 30 + r() * 90, h = 160 + r() * 300;
    g.fillStyle = "#f2f5fb"; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 0.2, h); g.lineTo(x - w * 0.3, h * 0.8); g.fill();
  }
  g.fillStyle = "#f2f5fb"; g.fillRect(0, 0, 1024, 70);
  g.fillStyle = "#e8edf8"; g.fillRect(0, 430, 1024, 82);
});
const sandTex = () => ctex("scrub", 1024, 1024, (g, r) => {
  g.fillStyle = "#c9b37e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 220; i++) { g.fillStyle = r() > 0.4 ? "rgba(110,140,70,0.55)" : "rgba(220,200,150,0.5)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 10 + r() * 40, 6 + r() * 18, 0, 0, 6.283); g.fill(); }
});
const concreteTex = () => ctex("concrete", 512, 512, (g, r) => {
  g.fillStyle = "#c7c4bd"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,60,0.5)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
});
const panelTex = () => ctex("solarPanel", 512, 512, (g) => {
  g.fillStyle = "#2f56b8"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#7d9cf0"; g.lineWidth = 5;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * 512 / 6, 0); g.lineTo(i * 512 / 6, 512); g.stroke(); }
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(240, 0); g.lineTo(0, 300); g.fill();
  g.strokeStyle = "#d7dbe3"; g.lineWidth = 18; g.strokeRect(0, 0, 512, 512);
});
const consoleTex = () => ctex("console", 512, 256, (g, r) => {
  g.fillStyle = "#2c3346"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 30; i++) { g.fillStyle = ["#7ff6ff", "#9dff8a", "#ffd24a", "#ff7a6a"][Math.floor(r() * 4)]; g.beginPath(); g.arc(30 + (i % 10) * 48, 60 + Math.floor(i / 10) * 60, 9, 0, 6.283); g.fill(); }
  g.fillStyle = "#4a5574"; g.fillRect(40, 200, 430, 26);
});
/** monitor screen: orbit lines and a little satellite glyph (no text) */
const screenTex = (key: string, hue: string) => ctex(key, 512, 320, (g, r) => {
  g.fillStyle = "#0f2244"; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = hue; g.lineWidth = 4;
  g.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = 160 + 70 * Math.sin(x / 512 * 6.283 + r()); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.globalAlpha = 0.4; for (let i = 0; i < 6; i++) { g.fillRect(20, 20 + i * 14, 60 + r() * 120, 6); } g.globalAlpha = 1;
  g.fillStyle = hue; g.fillRect(380, 40, 40, 26); g.fillRect(352, 48, 24, 10); g.fillRect(424, 48, 24, 10);
});
/** the big wall screen: Earth disc + orbit ellipse (the moving dot is a separate glow mesh) */
export const wallScreenTex = () => ctex("wallScreen", 1024, 576, (g) => {
  g.fillStyle = "#0b1a3a"; g.fillRect(0, 0, 1024, 576);
  g.strokeStyle = "rgba(120,180,255,0.18)"; g.lineWidth = 2;
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 576); g.stroke(); }
  for (let y = 0; y < 576; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  const gr = g.createRadialGradient(470, 260, 20, 512, 288, 150); gr.addColorStop(0, "#5fc0ff"); gr.addColorStop(1, "#1f5fb8");
  g.fillStyle = gr; g.beginPath(); g.arc(512, 288, 150, 0, 6.283); g.fill();
  g.fillStyle = "#6fcf6a"; for (const [x, y, a, b] of [[470, 240, 50, 34], [560, 320, 40, 50], [520, 190, 30, 14]]) { g.beginPath(); g.ellipse(x, y, a, b, 0.4, 0, 6.283); g.fill(); }
  g.strokeStyle = "#ffd24a"; g.lineWidth = 6; g.setLineDash([18, 14]); g.beginPath(); g.ellipse(512, 288, 330, 200, -0.15, 0, 6.283); g.stroke(); g.setLineDash([]);
  g.strokeStyle = "#2a3c66"; g.lineWidth = 22; g.strokeRect(0, 0, 1024, 576);
});
const hazardTex = () => ctex("hazard", 512, 64, (g) => {
  g.fillStyle = "#f2c43a"; g.fillRect(0, 0, 512, 64);
  g.fillStyle = "#26222a"; for (let x = -64; x < 576; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.fill(); }
});
const starsTexImpl = () => ctex("stars", 2048, 1024, (g, r) => {
  g.clearRect(0, 0, 2048, 1024);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 2048, y = r() * 1024, s = r() < 0.08 ? 2.6 : r() < 0.3 ? 1.6 : 1.0;
    g.fillStyle = r() < 0.15 ? "#ffe8c8" : r() < 0.3 ? "#cfe0ff" : "#ffffff"; g.globalAlpha = 0.5 + 0.5 * r();
    g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 18; i++) { // a few twinkle crosses
    const x = r() * 2048, y = r() * 1024, l = 7 + r() * 6;
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); g.stroke();
  }
});
export const starsTex = starsTexImpl;

// ---------------- props ----------------
export const cyl = (r0: number, r1: number, h: number, seg = 32) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(0, h / 2, 0); return g; };
const At = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));
/** an indoor room box (floor, 4 walls, ceiling), all faces pointing in */
const room = (b: Batch, cx: number, w: number, d: number, h: number, floor: THREE.Material, wall: THREE.Material, ceil: THREE.Material, tile = 1) => {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = -d / 2, z1 = d / 2;
  b.add(floorQ(x0, x1, z0, z1, 0, tile), floor, undefined, false);
  b.add(quad(V(x0, h, z0), V(x1, h, z0), V(x1, h, z1), V(x0, h, z1), w / 2, d / 2), ceil, undefined, false);
  b.add(wallZ(x0, x1, 0, h, z0, 2), wall, undefined, false);
  b.add(wallZ(x0, x1, 0, h, z1, 2, true), wall, undefined, false);
  b.add(wallX(z0, z1, 0, h, x0, 2), wall, undefined, false);
  b.add(wallX(z0, z1, 0, h, x1, 2, true), wall, undefined, false);
};
const mountain = (b: Batch, x: number, z: number, r: number, h: number, m: THREE.Material, seg = 7) => {
  const g = new THREE.ConeGeometry(r, h, seg, 3); g.translate(0, h / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > 0.05 && y < h - 0.05) { pos.setX(i, pos.getX(i) * (0.85 + 0.3 * Math.sin(i * 2.7))); pos.setZ(i, pos.getZ(i) * (0.85 + 0.3 * Math.cos(i * 1.9))); } }
  g.computeVertexNormals();
  b.add(g, m, At(x, -1, z, 0, x * 0.13));
};

// ---------------- launch pad (x + 1000) ----------------
export const buildPad = (root: THREE.Object3D) => {
  const b = new Batch();
  const ground = lam("padGround", () => ({ map: rep(sandTex(), 30, 30) }));
  const conc = lam("padConc", () => ({ map: rep(concreteTex(), 8, 8) }));
  const sea = lam("padSea", () => ({ color: "#2f8fd0" }));
  const steel = lam("tower", () => ({ color: "#c44a3a" })), grey = lam("towerGrey", () => ({ color: "#8e939e" }));
  const white = lam("hangar", () => ({ color: "#efece4" })), blue = lam("hangarStripe", () => ({ color: "#3a64b8" }));
  b.add(floorQ(PAD - 195, PAD + 195, -260, 400, 0, 1), ground, undefined, false);
  b.add(floorQ(PAD - 195, PAD + 195, -1200, -260, 0.02, 1), sea, undefined, false);
  b.add(floorQ(ROCKET[0] - 24, ROCKET[0] + 24, ROCKET[2] - 24, ROCKET[2] + 24, 0.03, 1), conc, undefined, false);
  // tower: four red legs, grey rings, two swing arms
  const tx = ROCKET[0] + 7.5, tz = ROCKET[2];
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) b.add(B(tx + dx - 0.25, 0, tz + dz - 0.25, tx + dx + 0.25, 44, tz + dz + 0.25), steel);
  for (let y = 4; y <= 44; y += 4) {
    b.add(B(tx - 1.9, y, tz - 1.9, tx + 1.9, y + 0.35, tz - 1.5), grey); b.add(B(tx - 1.9, y, tz + 1.5, tx + 1.9, y + 0.35, tz + 1.9), grey);
    b.add(B(tx - 1.9, y, tz - 1.9, tx - 1.5, y + 0.35, tz + 1.9), grey); b.add(B(tx + 1.5, y, tz - 1.9, tx + 1.9, y + 0.35, tz + 1.9), grey);
  }
  for (const y of [18, 30]) b.add(B(ROCKET[0] + 2.0, y, tz - 0.4, tx - 1.6, y + 0.8, tz + 0.4), grey);
  b.add(B(tx - 2.2, 44, tz - 2.2, tx + 2.2, 45, tz + 2.2), steel);
  // hangars and a water tower on the horizon
  b.add(B(PAD - 120, 0, -150, PAD - 70, 22, -110), white); b.add(B(PAD - 120.1, 14, -110.1, PAD - 69.9, 17, -109.9), blue);
  b.add(B(PAD + 60, 0, -190, PAD + 120, 30, -150), white); b.add(B(PAD + 59.9, 20, -150.1, PAD + 120.1, 23, -149.9), blue);
  b.add(cyl(2.5, 2.5, 24, 16), grey, At(PAD + 40, 0, -120)); b.add(new THREE.SphereGeometry(6, 18, 12), white, At(PAD + 40, 28, -120));
  // a low fence + bushes near the camera
  const bush = lam("bush", () => ({ color: "#5d9a46" }));
  for (let i = 0; i < 14; i++) { const x = PAD - 40 + i * 6.3, z = 8 + 6 * Math.sin(i * 1.7); b.add(new THREE.SphereGeometry(1.2 + 0.5 * Math.sin(i * 3.1), 12, 8), bush, At(x, 0.6, z)); }
  b.build(root);
};

// ---------------- radiation lab (x - 1000) ----------------
export const buildLab = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("labFloor", () => ({ map: tiles("labTiles", "#b9c3c6", 4) }));
  const wall = lam("labWall", () => ({ map: paintWall("labWallT", "#cfd8d2", "#7f9aa3") }));
  const ceil = lam("labCeil", () => ({ color: "#e8ebe8" }));
  room(b, LAB, 10, 8, 3.2, floor, wall, ceil, 1);
  const pipe = lam("beamPipe", () => ({ color: "#a9adb6" })), band = lam("beamBand", () => ({ color: "#e87a2c" }));
  const mag = lam("magnet", () => ({ color: "#3a64b8" })), desk = lam("labDesk", () => ({ color: "#e9e4d8" }));
  const cons = lam("labConsole", () => ({ map: consoleTex() })), haz = lam("hazardM", () => ({ map: hazardTex() }));
  // the accelerator beam line along x, ending just short of the chip
  const pg = new THREE.CylinderGeometry(0.11, 0.11, 4.2, 24); pg.rotateZ(Math.PI / 2);
  b.add(pg, pipe, At(LAB - 2.75, CHIP_AT[1], CHIP_AT[2]));
  for (let i = 0; i < 4; i++) { const x = LAB - 4.2 + i * 0.9; b.add(B(x - 0.25, CHIP_AT[1] - 0.32, CHIP_AT[2] - 0.32, x + 0.25, CHIP_AT[1] + 0.32, CHIP_AT[2] + 0.32), mag); }
  for (let i = 0; i < 5; i++) { const g = new THREE.CylinderGeometry(0.135, 0.135, 0.06, 24); g.rotateZ(Math.PI / 2); b.add(g, band, At(LAB - 0.75 - i * 0.85, CHIP_AT[1], CHIP_AT[2])); }
  const nz = new THREE.CylinderGeometry(0.05, 0.11, 0.2, 20); nz.rotateZ(Math.PI / 2); b.add(nz, pipe, At(LAB - 0.55, CHIP_AT[1], CHIP_AT[2]));
  // legs under the beam line
  for (const x of [-4, -2.6, -1.2]) b.add(B(LAB + x - 0.06, 0, CHIP_AT[2] - 0.06, LAB + x + 0.06, CHIP_AT[1] - 0.32, CHIP_AT[2] + 0.06), pipe);
  // the chip's little test stand
  b.add(B(LAB - 0.22, 0, CHIP_AT[2] - 0.22, LAB + 0.22, 0.7, CHIP_AT[2] + 0.22), desk);
  b.add(B(LAB - 0.28, 0.7, CHIP_AT[2] - 0.28, LAB + 0.28, 0.74, CHIP_AT[2] + 0.28), pipe);
  b.add(floorQ(LAB - 0.9, LAB + 0.9, CHIP_AT[2] + 0.5, CHIP_AT[2] + 0.62, 0.005, 1), haz, undefined, false);
  // the scientist's control desk (she stands behind it, safely to the side)
  b.add(B(LAB + 0.8, 0, -2.25, LAB + 2.3, 0.9, -1.85), desk);
  b.add(quad(V(LAB + 0.85, 0.9, -1.85), V(LAB + 2.25, 0.9, -1.85), V(LAB + 2.25, 1.02, -2.25), V(LAB + 0.85, 1.02, -2.25)), cons);
  // shelves + cabinets on the back wall
  const cab = lam("labCab", () => ({ color: "#9fb0b5" }));
  b.add(B(LAB - 4.8, 0, -3.95, LAB - 2.6, 1.9, -3.4), cab); b.add(B(LAB + 2.8, 0, -3.95, LAB + 4.8, 1.2, -3.4), cab);
  b.add(B(LAB - 1.5, 1.6, -3.98, LAB + 1.6, 2.5, -3.94), lam("labBoard", () => ({ map: screenTex("labScreen", "#9dff8a") })));
  b.build(root);
};

// ---------------- clean room (x - 1050) ----------------
export const buildClean = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("cleanFloor", () => ({ map: tiles("cleanTiles", "#e3e6ec", 4, "rgba(120,130,150,0.6)") }));
  const wall = lam("cleanWall", () => ({ map: paintWall("cleanWallT", "#eef0f4", "#9fb8de") }));
  room(b, CLEAN, 9, 8, 3.4, floor, wall, lam("cleanCeil", () => ({ color: "#f4f5f7" })), 1);
  const ped = lam("pedestal", () => ({ color: "#c9ced8" })), ring = lam("pedRing", () => ({ color: "#3a64b8" }));
  b.add(cyl(0.34, 0.26, 0.5, 32), ped, At(CLEAN, 0, 0)); b.add(cyl(0.38, 0.38, 0.06, 32), ring, At(CLEAN, 0.5, 0));
  // tool carts and a hanging lamp
  const cart = lam("cart", () => ({ color: "#b8bec9" }));
  b.add(B(CLEAN + 1.3, 0, -1.2, CLEAN + 2.1, 0.85, -0.7), cart); b.add(B(CLEAN - 2.4, 0, -2.4, CLEAN - 1.4, 1.1, -1.8), cart);
  b.add(B(CLEAN - 3.0, 1.4, -3.98, CLEAN + 3.0, 2.6, -3.94), lam("cleanBoard", () => ({ map: screenTex("cleanScreen", "#7ff6ff") })));
  b.build(root);
};

// ---------------- mission control (x - 1100) ----------------
export const buildCtrl = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("ctrlFloor", () => ({ map: tiles("ctrlCarpet", "#38456e", 2, "rgba(20,24,40,0.4)") }));
  const wall = lam("ctrlWall", () => ({ map: paintWall("ctrlWallT", "#4a5784", "#2e3860") }));
  room(b, CTRL, 10, 8, 3.4, floor, wall, lam("ctrlCeil", () => ({ color: "#5a6690" })), 1);
  const desk = lam("ctrlDesk", () => ({ color: "#d9dce4" })), cons = lam("ctrlConsole", () => ({ map: consoleTex() }));
  const mon = lam("monBack", () => ({ color: "#2a2f3c" }));
  // one long desk across the room; engineers sit behind it facing the lens
  b.add(B(CTRL - 2.6, 0, -0.85, CTRL + 2.6, 0.74, -0.45), desk);
  b.add(quad(V(CTRL - 2.55, 0.74, -0.45), V(CTRL + 2.55, 0.74, -0.45), V(CTRL + 2.55, 0.8, -0.85), V(CTRL - 2.55, 0.8, -0.85)), cons);
  // small monitors facing the engineers (backs to us), slightly angled
  for (const x of [-1.9, -0.7, 0.7, 1.9]) {
    b.add(B(-0.28, 0, -0.03, 0.28, 0.36, 0.03), mon, At(CTRL + x, 0.84, -0.62, 0, x * 0.12));
    b.add(B(-0.03, 0, -0.03, 0.03, 0.12, 0.03), mon, At(CTRL + x, 0.76, -0.62));
  }
  // microphone on a stalk at the left seat
  b.add(cyl(0.06, 0.06, 0.03, 16), mon, At(CTRL - 0.95, 0.8, -0.55)); b.add(cyl(0.012, 0.012, 0.28, 8), mon, At(CTRL - 0.95, 0.8, -0.55, 0.35, 0, 0));
  b.add(new THREE.SphereGeometry(0.04, 12, 8), lam("micHead", () => ({ color: "#5a6070" })), At(CTRL - 0.95, 1.06, -0.46));
  // chairs behind
  const chair = lam("chair", () => ({ color: "#2c3348" }));
  for (const x of [-1.3, 0, 1.3]) { b.add(B(CTRL + x - 0.3, 0.42, -1.65, CTRL + x + 0.3, 0.5, -1.15), chair); b.add(B(CTRL + x - 0.3, 0.5, -1.72, CTRL + x + 0.3, 1.25, -1.64), chair); }
  // the big wall screen's frame (the screen itself is an unlit mesh in world.ts)
  b.add(B(CTRL - 2.3, 1.0, -3.98, CTRL + 2.3, 3.0, -3.9), lam("screenFrame", () => ({ color: "#1c2236" })));
  b.add(B(CTRL - 4.9, 1.2, -3.98, CTRL - 3.2, 2.2, -3.94), lam("sideScreen1", () => ({ map: screenTex("ctrlS1", "#ffd24a") })));
  b.add(B(CTRL + 3.2, 1.2, -3.98, CTRL + 4.9, 2.2, -3.94), lam("sideScreen2", () => ({ map: screenTex("ctrlS2", "#9dff8a") })));
  b.build(root);
};

// ---------------- Arctic ground station (x + 1400) ----------------
export const DISH_AT: [number, number, number] = [STA + 1.5, 0, -10];
export const buildStation = (root: THREE.Object3D) => {
  const b = new Batch();
  const snow = lam("snowM", () => ({ map: rep(snowTex(), 20, 20) }));
  const rock = lam("rockSnowM", () => ({ map: rockSnowTex() }));
  const white = lam("radome", () => ({ color: "#f4f5f8" })), base = lam("radomeBase", () => ({ color: "#c9ced8" }));
  const hut = lam("hutRed", () => ({ color: "#b8382e" })), roofM = lam("hutRoof", () => ({ color: "#3a3440" }));
  b.add(floorQ(STA - 195, STA + 195, -600, 200, 0, 1), snow, undefined, false);
  for (let i = 0; i < 6; i++) mountain(b, STA - 150 + i * 60, -260 - 40 * Math.sin(i * 2.3), 45 + 15 * Math.sin(i * 1.3), 70 + 35 * Math.cos(i * 1.7), rock);
  for (let i = 0; i < 4; i++) mountain(b, STA - 130 + i * 85, -150 - 20 * Math.sin(i * 1.1), 40, 30 + 10 * Math.sin(i), rock, 6);
  // radomes on low drums
  for (const [x, z, r] of [[-12, -22, 4.2], [14, -30, 5.2], [26, -14, 3.4], [-26, -40, 4.8], [4, -48, 3.8]] as const) {
    b.add(cyl(r * 0.9, r * 0.9, 1.6, 24), base, At(STA + x, 0, z));
    b.add(new THREE.SphereGeometry(r, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), white, At(STA + x, 1.6 + r * 0.38, z));
  }
  // two little red huts
  for (const [x, z] of [[-9, -26], [8, -38]] as const) { b.add(B(STA + x - 2, 0, z - 1.5, STA + x + 2, 2.4, z + 1.5), hut); b.add(B(STA + x - 2.2, 2.4, z - 1.7, STA + x + 2.2, 2.7, z + 1.7), roofM); }
  // the dish pedestal (the dish itself turns: world.ts)
  b.add(cyl(1.2, 0.9, 3.2, 20), base, At(DISH_AT[0], 0, DISH_AT[2]));
  b.build(root);
};

// ---------------- park of the phone analogy (x + 1800) ----------------
export const PANEL_AT: [number, number, number] = [PARK + 1.15, 0, -0.35];
export const buildPark = (root: THREE.Object3D) => {
  const b = new Batch();
  const grass = lam("parkGrass", () => ({ map: rep(grassHD(), 10, 10) }));
  const path = lam("parkPath", () => ({ color: "#d8c49a" }));
  const wood = lam("benchWood", () => ({ color: "#b5794a" })), iron = lam("benchIron", () => ({ color: "#3a3440" }));
  const trunk = lam("trunk", () => ({ color: "#7a5a40" })), leaf = lam("leaf", () => ({ color: "#5d9a46" })), leaf2 = lam("leaf2", () => ({ color: "#78b04e" }));
  const hill = lam("hill", () => ({ color: "#8cbf5a" }));
  b.add(floorQ(PARK - 195, PARK + 195, -400, 120, 0, 1), grass, undefined, false);
  b.add(floorQ(PARK - 30, PARK + 30, 0.6, 1.8, 0.01, 1), path, undefined, false);
  // bench (behind the person, left)
  b.add(B(PARK - 1.4, 0.44, -0.55, PARK - 0.1, 0.5, -0.15), wood); b.add(B(PARK - 1.4, 0.55, -0.6, PARK - 0.1, 0.9, -0.54), wood);
  for (const x of [-1.3, -0.2]) b.add(B(PARK + x - 0.04, 0, -0.55, PARK + x + 0.04, 0.9, -0.15), iron);
  // the solar panel on a frame, tilted to the sun, with a junction box
  const pm = lam("solarM", () => ({ map: panelTex() }));
  const [px, , pz] = PANEL_AT;
  b.add(B(-0.55, -0.02, -0.4, 0.55, 0.02, 0.4), pm, At(px, 0.85, pz, 0.75, -0.35, 0));
  for (const [dx, h] of [[-0.45, 0.62], [0.45, 0.78]] as const) b.add(B(px + dx - 0.03, 0, pz - 0.03, px + dx + 0.03, h, pz + 0.03), iron);
  b.add(B(px - 0.12, 0.3, pz - 0.05, px + 0.12, 0.48, pz + 0.05), lam("jbox", () => ({ color: "#e9e4d8" })));
  // trees and hills
  for (const [x, z, s] of [[-5, -6, 1.2], [4.5, -9, 1.5], [-9, -14, 1.7], [9, -18, 1.3], [-2, -24, 1.6], [14, -12, 1.1]] as const) {
    b.add(cyl(0.18 * s, 0.14 * s, 2.2 * s, 10), trunk, At(PARK + x, 0, z));
    b.add(new THREE.SphereGeometry(1.3 * s, 14, 10), x > 0 ? leaf : leaf2, At(PARK + x, 2.6 * s, z));
    b.add(new THREE.SphereGeometry(0.9 * s, 12, 8), leaf2, At(PARK + x + 0.7 * s, 2.2 * s, z + 0.4));
  }
  for (let i = 0; i < 6; i++) { const g = new THREE.SphereGeometry(45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.3, 0.4, 1); b.add(g, hill, At(PARK - 150 + i * 60, -2, -170 - 30 * Math.sin(i * 1.9))); }
  // a street lamp (its bulb glows at night: world.ts)
  b.add(cyl(0.06, 0.05, 3.2, 10), iron, At(PARK - 2.4, 0, -1.2));
  b.build(root);
};
export const LAMP_AT: [number, number, number] = [PARK - 2.4, 3.25, -1.2];
