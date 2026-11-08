// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { AIR, DESK, MAP, ROAD, MON, MON_YAW, MON_W, MON_H, YT, TERMS, DRIVE, RWY_Z, TOWER, ROOM } from "./story";

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
const concreteTex = () => ctex("concrete", 512, 512, (g, r) => {
  g.fillStyle = "#c7c4bd"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,60,0.5)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
});
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

const tree = (b: Batch, x: number, z: number, s: number, k = 0) => {
  const trunk = lam("trunk", () => ({ color: "#7a5a40" }));
  const leaves = [lam("leafA", () => ({ color: "#4f8f3e" })), lam("leafB", () => ({ color: "#6aa84a" })), lam("leafC", () => ({ color: "#3f7a3a" }))];
  b.add(cyl(0.2 * s, 0.14 * s, 2.4 * s, 10), trunk, At(x, 0, z));
  const L = leaves[k % 3], L2 = leaves[(k + 1) % 3];
  b.add(new THREE.SphereGeometry(1.35 * s, 16, 12), L, At(x, 2.9 * s, z));
  b.add(new THREE.SphereGeometry(1.0 * s, 14, 10), L2, At(x + 0.85 * s, 2.45 * s, z + 0.3 * s));
  b.add(new THREE.SphereGeometry(0.95 * s, 14, 10), L, At(x - 0.8 * s, 2.55 * s, z - 0.2 * s));
  b.add(new THREE.SphereGeometry(0.85 * s, 12, 10), L2, At(x + 0.1 * s, 3.85 * s, z - 0.1 * s));
};
const pine = (b: Batch, x: number, z: number, s: number) => {
  const trunk = lam("trunk", () => ({ color: "#7a5a40" })), dark = lam("pine", () => ({ color: "#2f6a44" }));
  b.add(cyl(0.16 * s, 0.12 * s, 1.2 * s, 8), trunk, At(x, 0, z));
  for (let i = 0; i < 3; i++) { const g = new THREE.ConeGeometry((1.5 - i * 0.35) * s, 2.0 * s, 10); g.translate(0, 1.0 * s, 0); b.add(g, dark, At(x, (1.0 + i * 1.1) * s, z)); }
};
const hill = (b: Batch, x: number, z: number, r: number, h: number, m: THREE.Material) => {
  const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.3, h / r, 1); b.add(g, m, At(x, -1, z));
};

void water; void cloudHD; void mountain; void pine;

// ---------------- the control room (x - 1000) ----------------
const ctrlWindowTex = () => ctex("ctrlWindow", 1024, 384, (g) => {
  // the view out of the control-room window: sky, a runway with a parked airliner shape, distant hangars, grass
  const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, "#5e93d9"); gr.addColorStop(0.62, "#bcd6f2"); gr.addColorStop(0.62, "#86b85a"); gr.addColorStop(1, "#6aa84a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 384);
  g.fillStyle = "#ffffff"; for (const [x, y, s] of [[160, 70, 1], [620, 110, 0.8], [880, 60, 0.7]]) { g.beginPath(); g.ellipse(x, y, 80 * s, 26 * s, 0, 0, 6.283); g.ellipse(x + 46 * s, y - 18 * s, 50 * s, 30 * s, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "#c9d2dc"; for (const x of [80, 260, 760]) { g.beginPath(); g.ellipse(x + 70, 238, 70, 26, 0, Math.PI, 0); g.fill(); }
  g.fillStyle = "#5a5866"; g.fillRect(0, 262, 1024, 46);
  g.fillStyle = "#f2efe6"; for (let x = 10; x < 1024; x += 90) g.fillRect(x, 283, 50, 5);
  // a parked airliner in profile (white body, blue tail)
  g.fillStyle = "#f4f4f2"; g.beginPath(); g.ellipse(560, 252, 120, 13, 0, 0, 6.283); g.fill();
  g.fillStyle = "#3a64b8"; g.beginPath(); g.moveTo(450, 250); g.lineTo(430, 206); g.lineTo(455, 206); g.lineTo(490, 248); g.fill();
  g.fillStyle = "#9aa3ad"; g.fillRect(540, 256, 60, 6);
  // window mullions
  g.fillStyle = "#3a4256"; for (let x = 0; x <= 1024; x += 256) g.fillRect(x - 8, 0, 16, 384); g.fillRect(0, 0, 1024, 14); g.fillRect(0, 370, 1024, 14);
});
const carpetTex = () => ctex("ctrlCarpet", 512, 512, (g, r) => {
  g.fillStyle = "#4a5470"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(30,26,40,0.45)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
});
const stripBoardTex = () => ctex("stripBoard", 512, 384, (g, r) => {
  // the flight-strip bay on the wall: rows of coloured paper strips in holders, no text
  g.fillStyle = "#3a3440"; g.fillRect(0, 0, 512, 384);
  for (let row = 0; row < 8; row++) for (let c = 0; c < 2; c++) {
    if (r() < 0.2) continue;
    const x = 18 + c * 248, y = 14 + row * 46;
    g.fillStyle = ["#fbf3d0", "#d8ecd0", "#f8d8c8", "#fbf3d0"][Math.floor(r() * 4)]; g.fillRect(x, y, 228, 34);
    g.fillStyle = "#9aa3b8"; for (let k = 0; k < 3; k++) g.fillRect(x + 12 + k * 70, y + 10, 40 + r() * 16, 5);
    g.fillStyle = ["#e8483c", "#3a64b8", "#4f9a6e"][Math.floor(r() * 3)]; g.fillRect(x, y, 10, 34);
  }
});
export const BEIGE = "#d9cfb2";
/** a chunky 1980s CRT terminal at (x, z) with yaw; screen centre at (x, 1.06, z) */
const crt = (b: Batch, x: number, z: number, yaw: number, w = MON_W, h = MON_H) => {
  const beige = lam("beige", () => ({ color: BEIGE })), beigeD = lam("beigeD", () => ({ color: "#bdb196" })), dark = lam("crtDark", () => ({ color: "#2b2f3a" }));
  const m = new THREE.Matrix4().compose(V(x, 1.06, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  b.add(B(-w / 2 - 0.07, -h / 2 - 0.07, -0.05, w / 2 + 0.07, h / 2 + 0.08, -0.004), beige, m); // front bezel
  b.add(B(-w / 2 - 0.02, -h / 2 - 0.02, -0.012, w / 2 + 0.02, h / 2 + 0.02, -0.006), dark, m); // dark glass surround
  b.add(B(-w / 2 + 0.02, -h / 2 + 0.0, -0.42, w / 2 - 0.02, h / 2 + 0.03, -0.05), beigeD, m); // the deep tube housing
  b.add(B(-0.16, -h / 2 - 0.27, -0.36, 0.16, -h / 2 - 0.07, -0.05), beige, m); // pedestal / case
  b.add(B(-w / 2 - 0.05, -h / 2 - 0.31, -0.42, w / 2 + 0.05, -h / 2 - 0.27, 0.02), beigeD, m); // base plate on the desk
  for (let i = 0; i < 4; i++) b.add(B(w / 2 - 0.02 - i * 0.04, -h / 2 - 0.055, -0.02, w / 2 - 0.0 - i * 0.04, -h / 2 - 0.035, 0.0), dark, m); // little buttons
  // the keyboard in front
  const k = new THREE.Matrix4().compose(V(x + Math.sin(yaw) * 0.28, 0.75, z + Math.cos(yaw) * 0.28), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  b.add(B(-0.24, 0, -0.08, 0.24, 0.035, 0.08), beige, k);
  b.add(B(-0.21, 0.035, -0.06, 0.21, 0.045, 0.05), beigeD, k);
};
export const buildDesk = (root: THREE.Object3D) => {
  const b = new Batch();
  const W_ = ROOM.w, D_ = ROOM.d, H_ = ROOM.h;
  const floor = lam("ctrlFloor", () => ({ map: rep(carpetTex(), 1, 1) }));
  const wall = lam("ctrlWall", () => ({ map: paintWall("ctrlWallT", "#b9c4cf", "#7f8ea0") }));
  room(b, DESK, W_, D_, H_, floor, wall, lam("ctrlCeil", () => ({ color: "#e4e6ea" })), 1.5);
  const zb = -D_ / 2 + 0.02;
  // the long window on the back wall (unlit picture of the airfield) with a sill
  b.add(quad(V(DESK - 3.6, 1.15, zb), V(DESK + 3.6, 1.15, zb), V(DESK + 3.6, 2.65, zb), V(DESK - 3.6, 2.65, zb)), glow("ctrlWin", "#ffffff", 1.0, ctrlWindowTex()));
  b.add(B(DESK - 3.7, 1.05, zb - 0.02, DESK + 3.7, 1.15, zb + 0.18), lam("sill", () => ({ color: "#e9e6de" })));
  // the flight-strip board on the left wall, a wall clock (no numerals), a fire-door on the right wall
  b.add(quad(V(DESK - W_ / 2 + 0.02, 1.0, -1.2), V(DESK - W_ / 2 + 0.02, 1.0, 0.6), V(DESK - W_ / 2 + 0.02, 2.2, 0.6), V(DESK - W_ / 2 + 0.02, 2.2, -1.2)), lam("stripB", () => ({ map: stripBoardTex() })));
  b.add(B(DESK + W_ / 2 - 0.03, 0, 0.4, DESK + W_ / 2, 2.1, 1.4), lam("door", () => ({ color: "#6a7a8a" })));
  // the console desk: long top, kick panel, drawer pedestals
  const top = lam("consoleTop", () => ({ color: "#7a8494" })), body = lam("consoleBody", () => ({ color: "#4a5262" }));
  b.add(B(DESK - 2.2, 0.71, -1.45, DESK + 3.2, 0.75, -0.7), top);
  b.add(B(DESK - 2.18, 0.0, -1.43, DESK + 3.18, 0.71, -1.35), body);
  for (const x of [-2.15, 0.9, 3.15]) b.add(B(DESK + x - 0.03, 0, -1.4, DESK + x + 0.03, 0.71, -0.75), body);
  b.add(B(DESK + 2.2, 0.05, -1.4, DESK + 3.1, 0.71, -0.78), body);
  // the four 1980s terminals
  crt(b, MON[0], MON[2], MON_YAW);
  for (const [x, yaw] of TERMS) crt(b, x, MON[2], yaw);
  // the floppy drive box: beige case, dark slot, eject button (LED in world.ts)
  const beige = lam("beige", () => ({ color: BEIGE })), dark = lam("crtDark", () => ({ color: "#2b2f3a" }));
  const [dx, dy, dz] = DRIVE;
  b.add(B(dx - 0.17, 0.75, dz - 0.36, dx + 0.17, 0.89, dz), beige);
  b.add(B(dx - 0.055, dy - 0.006, dz - 0.002, dx + 0.055, dy + 0.006, dz + 0.002), dark);
  b.add(B(dx + 0.11, dy - 0.03, dz - 0.002, dx + 0.15, dy - 0.012, dz + 0.004), lam("beigeD", () => ({ color: "#bdb196" })));
  // a stack of floppy-disk boxes, a mug, a desk phone, the paper-strip printer
  b.add(B(DESK + 1.95, 0.75, -1.3, DESK + 2.2, 0.83, -1.1), lam("fdBox", () => ({ color: "#3a64b8" })));
  b.add(B(DESK + 1.97, 0.83, -1.29, DESK + 2.18, 0.89, -1.12), lam("fdBox2", () => ({ color: "#e8483c" })));
  b.add(cyl(0.045, 0.045, 0.1, 14), lam("mug", () => ({ color: "#f2c43a" })), At(DESK - 0.62, 0.75, -0.85));
  b.add(B(DESK + 2.3, 0.75, -1.2, DESK + 2.62, 0.84, -0.95), lam("phone", () => ({ color: "#3a3440" })));
  b.add(B(DESK + 2.3, 0.84, -1.18, DESK + 2.62, 0.9, -1.12), lam("phone", () => ({ color: "#3a3440" })));
  // the controller's chair
  const chair = lam("chairM", () => ({ color: "#3a3440" }));
  b.add(B(YT[0] - 0.3, 0.42, YT[2] - 0.55, YT[0] + 0.3, 0.5, YT[2] - 0.05), chair);
  b.add(B(YT[0] - 0.3, 0.5, YT[2] - 0.62, YT[0] + 0.3, 1.45, YT[2] - 0.54), chair);
  b.add(cyl(0.04, 0.04, 0.42, 8), chair, At(YT[0], 0, YT[2] - 0.3));
  // a second console row behind the camera side (seen in the wide), ceiling light panels
  b.add(B(DESK - 3.2, 0.71, 2.3, DESK + 3.2, 0.75, 2.9), top); b.add(B(DESK - 3.18, 0, 2.82, DESK + 3.18, 0.71, 2.88), body);
  for (const x of [-2.4, 0, 2.4]) b.add(B(DESK + x - 0.6, H_ - 0.02, -1.6, DESK + x + 0.6, H_ - 0.005, -0.8), glow("panelLight", "#fff6e0", 1.15), undefined, false);
  // a potted plant in the corner
  b.add(cyl(0.2, 0.16, 0.38, 14), lam("pot", () => ({ color: "#c96a3a" })), At(DESK - 3.9, 0, -2.9));
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.26, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(DESK - 3.9 + 0.18 * Math.cos(i * 1.3), 0.6 + 0.15 * i, -2.9 + 0.18 * Math.sin(i * 1.3)));
  b.build(root);
};

// ---------------- the flight map (x + 1000) ----------------
/** contiguous US outline (lon, lat) and the map projection: 3.45 m per degree, centred on (-96, 38) */
const US: [number, number][] = [
  [-124.7, 48.4], [-122.8, 49.0], [-95.2, 49.0], [-94.6, 48.7], [-91.5, 48.1], [-89.5, 48.0], [-84.5, 46.5], [-82.5, 45.3], [-82.4, 43.0], [-79.0, 43.3],
  [-76.5, 44.2], [-75.0, 45.0], [-71.5, 45.0], [-70.0, 46.7], [-69.0, 47.4], [-67.8, 47.1], [-67.0, 44.8], [-70.0, 43.7], [-70.6, 42.0], [-70.0, 41.7],
  [-71.9, 41.3], [-74.0, 40.6], [-74.0, 39.5], [-75.5, 38.8], [-75.9, 37.0], [-75.5, 35.6], [-76.5, 34.7], [-78.5, 33.8], [-80.0, 32.6], [-81.4, 31.0],
  [-80.4, 28.5], [-80.0, 26.7], [-80.4, 25.2], [-81.2, 25.2], [-82.0, 26.5], [-82.8, 27.9], [-82.7, 29.0], [-84.0, 30.0], [-85.4, 29.7], [-86.5, 30.4],
  [-88.5, 30.4], [-89.6, 30.2], [-89.4, 29.0], [-90.5, 29.1], [-92.0, 29.6], [-93.8, 29.7], [-94.8, 29.3], [-97.2, 27.7], [-97.4, 26.0], [-99.1, 26.4],
  [-100.6, 28.4], [-101.4, 29.8], [-102.4, 29.8], [-103.1, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5],
  [-117.3, 33.2], [-118.5, 34.0], [-120.6, 34.5], [-121.9, 36.3], [-122.5, 37.5], [-123.0, 38.0], [-123.7, 39.0], [-124.3, 40.3], [-124.2, 42.0], [-124.5, 43.4], [-124.0, 46.2],
];
const KM = 3.45;
export const mapXZ = (lon: number, lat: number): [number, number] => [(lon + 96) * KM, -(lat - 38) * KM * 1.25];
export const US_XZ = US.map(([lo, la]) => mapXZ(lo, la));
export const inUS = (x: number, z: number) => {
  let c = false;
  for (let i = 0, j = US_XZ.length - 1; i < US_XZ.length; j = i++) {
    const [xi, zi] = US_XZ[i], [xj, zj] = US_XZ[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const LAKES: [number, number, number, number][] = [[-87.6, 47.6, 4.2, 0.9], [-87.1, 44.0, 0.8, 2.4], [-82.4, 44.8, 1.2, 1.3], [-81.2, 42.2, 1.9, 0.4], [-77.8, 43.6, 1.3, 0.35]];
const MW = 240, MH = 120, PX = 4096 / MW;
const mapTex = () => ctex("usMap", 4096, 2048, (g, r) => {
  const P = (x: number, z: number): [number, number] => [(x + MW / 2) * PX, (z + MH / 2) * PX];
  g.fillStyle = "#4a9ad8"; g.fillRect(0, 0, 4096, 2048);
  g.strokeStyle = "rgba(160,215,245,0.45)"; g.lineWidth = 5; g.lineCap = "round";
  for (let i = 0; i < 260; i++) { const x = r() * 4096, y = r() * 2048, l = 40 + r() * 60; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 10, x + l, y); g.stroke(); }
  g.fillStyle = "#cfd9b8";
  const north: [number, number][] = [[-130, 49], [-130, 60], [-60, 60], [-60, 46], [-67.0, 44.8], [-67.8, 47.1], [-69.0, 47.4], [-70.0, 46.7], [-71.5, 45.0], [-75.0, 45.0], [-76.5, 44.2], [-79.0, 43.3], [-82.4, 43.0], [-82.5, 45.3], [-84.5, 46.5], [-89.5, 48.0], [-91.5, 48.1], [-94.6, 48.7], [-95.2, 49.0], [-122.8, 49.0], [-124.7, 48.4]];
  const south: [number, number][] = [[-117.1, 32.5], [-114.8, 32.5], [-111.1, 31.3], [-108.2, 31.8], [-106.5, 31.8], [-104.5, 29.6], [-103.1, 29.0], [-102.4, 29.8], [-101.4, 29.8], [-100.6, 28.4], [-99.1, 26.4], [-97.4, 26.0], [-97.6, 22], [-96, 19], [-90, 21], [-87, 21.5], [-88, 15], [-105, 18], [-112, 24], [-109.5, 23], [-112, 28.5], [-114.8, 30.8], [-116.5, 31.5]];
  for (const poly of [north, south]) { g.beginPath(); poly.forEach(([lo, la], i) => { const [x, y] = P(...mapXZ(lo, la)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); }
  g.save();
  g.beginPath(); US_XZ.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
  g.clip();
  const gr = g.createLinearGradient(P(-100, 0)[0], 0, P(100, 0)[0], 0);
  gr.addColorStop(0, "#d6b878"); gr.addColorStop(0.3, "#cdb46a"); gr.addColorStop(0.5, "#b8c46a"); gr.addColorStop(0.68, "#8cbf5a"); gr.addColorStop(1, "#6aae50");
  g.fillStyle = gr; g.fillRect(0, 0, 4096, 2048);
  for (let i = 0; i < 160; i++) { const x = r() * 4096, y = r() * 2048, rad = 60 + r() * 160; g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(60,90,30,0.07)"; g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, 6.283); g.fill(); }
  const band = (pts: [number, number][], w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = "round"; g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = P(...mapXZ(lo, la)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  band([[-114, 49], [-111, 45], [-109, 42], [-106, 39], [-106, 35], [-107, 32]], 150, "rgba(150,110,70,0.55)");
  band([[-121.5, 49], [-121.8, 44], [-121, 40], [-119, 37], [-118, 35.5]], 90, "rgba(130,110,80,0.5)");
  band([[-84, 34.5], [-81, 37], [-78.5, 39.5], [-76, 41.5], [-73.5, 43.5]], 70, "rgba(70,110,50,0.45)");
  g.lineCap = "round";
  band([[-95.2, 47.2], [-93, 44.5], [-91, 41.5], [-90.2, 38.6], [-89.4, 35], [-91, 32], [-90.5, 29.5]], 10, "#4a9ad8");
  band([[-111, 47.5], [-104, 47.8], [-100, 46.5], [-96.5, 41.5], [-94.5, 39.2], [-90.2, 38.6]], 8, "#4a9ad8");
  band([[-80, 40.4], [-84.5, 39.1], [-88, 37.5], [-89.2, 37.0]], 8, "#4a9ad8");
  g.restore();
  g.fillStyle = "#4a9ad8"; for (const [lo, la, a, b2] of LAKES) { const [x, y] = P(...mapXZ(lo, la)); g.beginPath(); g.ellipse(x, y, a * KM * PX * 0.5, b2 * KM * 1.25 * PX * 0.5, -0.2, 0, 6.283); g.fill(); }
  g.beginPath(); US_XZ.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
  g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 26; g.stroke();
  g.strokeStyle = "#2a2232"; g.lineWidth = 9; g.stroke();
  g.save(); g.clip(); g.strokeStyle = "rgba(60,50,40,0.22)"; g.lineWidth = 4; g.setLineDash([22, 18]);
  for (let lo = -120; lo <= -70; lo += 6) { const [x] = P(...mapXZ(lo, 38)); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 2048); g.stroke(); }
  for (let la = 30; la <= 48; la += 5) { const [, y] = P(...mapXZ(-96, la)); g.beginPath(); g.moveTo(0, y); g.lineTo(4096, y); g.stroke(); }
  g.restore();
});
export const buildMap = (root: THREE.Object3D) => {
  const b = new Batch();
  const m = lam("mapM", () => ({ map: mapTex() }));
  (m.map as THREE.Texture).wrapS = (m.map as THREE.Texture).wrapT = THREE.ClampToEdgeWrapping;
  b.add(quad(V(MAP - MW / 2, 0, MH / 2), V(MAP + MW / 2, 0, MH / 2), V(MAP + MW / 2, 0, -MH / 2), V(MAP - MW / 2, 0, -MH / 2), 1, 1), m, undefined, false);
  const ocean = lam("ocean", () => ({ color: "#4a9ad8" }));
  b.add(floorQ(MAP - 195, MAP + 195, -400, -MH / 2, -0.05, 1), ocean, undefined, false);
  b.add(floorQ(MAP - 195, MAP + 195, MH / 2, 400, -0.05, 1), ocean, undefined, false);
  b.add(floorQ(MAP - 195, MAP - MW / 2, -MH / 2, MH / 2, -0.05, 1), ocean, undefined, false);
  b.add(floorQ(MAP + MW / 2, MAP + 195, -MH / 2, MH / 2, -0.05, 1), ocean, undefined, false);
  const rock = lam("mapRock", () => ({ color: "#9a7a5a" })), snow = lam("mapSnow", () => ({ color: "#f4f5f8" }));
  const peaks: [number, number][] = [[-113.5, 48], [-112, 46], [-110.5, 44.5], [-109.8, 43], [-108, 41], [-106.8, 39.6], [-105.6, 38.5], [-106.2, 37], [-121.6, 47], [-121.8, 44.5], [-120.5, 39], [-119, 37.2], [-118.5, 36]];
  peaks.forEach(([lo, la], i) => {
    const [x, z] = mapXZ(lo, la), h = 3.2 + 1.4 * Math.sin(i * 2.1), rr = 3.6 + 0.8 * Math.cos(i);
    const g = new THREE.ConeGeometry(rr, h, 7, 2); g.translate(0, h / 2, 0); b.add(g, rock, At(MAP + x, 0, z, 0, i));
    const c = new THREE.ConeGeometry(rr * 0.36, h * 0.36, 7); c.translate(0, h * 0.82, 0); b.add(c, snow, At(MAP + x, 0, z, 0, i));
  });
  b.build(root);
};
/** 435 deterministic site dots inside the outline (map-local x, z, random 0..1) */
export const mapDots = (n: number) => {
  const out: [number, number, number][] = [];
  let s = 4242;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  while (out.length < n) {
    const x = (rnd() - 0.5) * MW * 0.9, z = (rnd() - 0.5) * MH * 0.9;
    if (inUS(x, z)) out.push([x, z, rnd()]);
  }
  return out;
};

// ---------------- the highway (x + 2000) ----------------
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5a5866"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.fillStyle = "#f2e6b0"; for (let x = 0; x < 512; x += 128) g.fillRect(x, 250, 70, 12);
});
export const buildStreet = (root: THREE.Object3D) => {
  const b = new Batch();
  const road = lam("road", () => ({ map: rep(asphaltTex(), 1, 1) }));
  const curb = lam("curb", () => ({ color: "#d9d6cf" }));
  const grass = lam("stGrass", () => ({ map: rep(grassHD(), 14, 14) }));
  for (let x = ROAD - 192; x < ROAD + 192; x += 8) b.add(quad(V(x, 0, 0), V(x + 8, 0, 0), V(x + 8, 0, -6), V(x, 0, -6), 1, 1), road, undefined, false);
  b.add(B(ROAD - 195, 0, 0, ROAD + 195, 0.15, 0.25), curb);
  b.add(floorQ(ROAD - 195, ROAD + 195, 0.25, 120, 0.12, 1), grass, undefined, false);
  b.add(B(ROAD - 195, 0, -6.25, ROAD + 195, 0.15, -6), curb);
  b.add(floorQ(ROAD - 195, ROAD + 195, -400, -6.25, 0.12, 1), grass, undefined, false);
  // a guard rail on the near side, roadside trees and fields, distant hills, a few farm houses
  for (let i = 0; i < 26; i++) tree(b, ROAD - 180 + i * 14 + 5 * Math.sin(i * 3.1), -12 - 6 * ((i * 7) % 3), 1.2 + 0.3 * ((i * 5) % 3) / 2, i % 3);
  for (let i = 0; i < 8; i++) hill(b, ROAD - 170 + i * 48, -140 - 30 * Math.sin(i * 1.9), 45, 16, lam("rivHill", () => ({ color: "#86b85a" })));
  const walls = ["#e8d2a8", "#c9d6e0", "#f0c8b0"];
  for (let i = 0; i < 3; i++) {
    const x0 = ROAD - 60 + i * 55, w = 8, h = 5, z1 = -34, z0 = -40;
    const fac = lam("fac" + i, () => ({ map: facadeHD("stFac" + i, w, h, { wall: walls[i], shutter: "#3a64b8", door: true }) }));
    b.add(quad(V(x0, 0, z1), V(x0 + w, 0, z1), V(x0 + w, h, z1), V(x0, h, z1)), fac);
    b.add(B(x0, 0, z0, x0 + w, h, z1 - 0.01), lam("facSide" + i, () => ({ color: walls[i] })));
    const rf = lam("roofSt" + i, () => ({ map: roofHD(["#b0533a", "#4a4a5a", "#8a5a3a"][i]) }));
    b.add(quad(V(x0 - 0.3, h, z1 + 0.4), V(x0 + w + 0.3, h, z1 + 0.4), V(x0 + w + 0.3, h + 2.4, (z0 + z1) / 2), V(x0 - 0.3, h + 2.4, (z0 + z1) / 2)), rf);
    b.add(quad(V(x0 + w + 0.3, h, z0 - 0.4), V(x0 - 0.3, h, z0 - 0.4), V(x0 - 0.3, h + 2.4, (z0 + z1) / 2), V(x0 + w + 0.3, h + 2.4, (z0 + z1) / 2)), rf);
  }
  b.build(root);
};
/** our own cartoon pickup truck, front toward +x, origin on the road under the bed/cab joint; wheels returned separately */
export const makeTruck = () => {
  const g = new THREE.Group();
  const paint = lam("truckPaint", () => ({ color: "#f2c43a" })), glass = lam("truckGlass", () => ({ color: "#4a6aa8" })), grey = lam("bumper", () => ({ color: "#9aa3ad" }));
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [boxGeo(V(-1.9, 0.45, -0.85), V(0.0, 0.75, 0.85)), paint], // bed floor
    [boxGeo(V(-1.9, 0.75, -0.85), V(0.0, 1.15, -0.75)), paint], [boxGeo(V(-1.9, 0.75, 0.75), V(0.0, 1.15, 0.85)), paint],
    [boxGeo(V(-2.0, 0.45, -0.85), V(-1.9, 1.15, 0.85)), paint], // tailgate
    [boxGeo(V(0.0, 0.45, -0.85), V(1.4, 1.85, 0.85)), paint], // cab
    [boxGeo(V(1.4, 0.45, -0.85), V(2.4, 1.05, 0.85)), paint], // bonnet
    [boxGeo(V(0.06, 1.2, -0.86), V(1.0, 1.72, 0.86)), glass], [boxGeo(V(1.36, 1.15, -0.78), V(1.42, 1.72, 0.78)), glass],
    [boxGeo(V(2.4, 0.4, -0.8), V(2.55, 0.62, 0.8)), grey], [boxGeo(V(-2.1, 0.4, -0.8), V(-2.0, 0.6, 0.8)), grey],
  ];
  for (const [geo, m] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.24), glow("headlight", "#fff6d0", 1.6));
  for (const z of [-0.55, 0.55]) { const m = hl.clone(); m.position.set(2.43, 0.86, z); g.add(m); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14).rotateX(Math.PI / 2), lam("axleM", () => ({ color: "#5a5866" }))); axle.position.set(-1.25, 0.42, 0.78); g.add(axle);
  const wheels: THREE.Mesh[] = [];
  const tyre = lam("tyre", () => ({ color: "#2b2f3a" })), hub = lam("hub", () => ({ color: "#d9d6cf" }));
  for (const [x, z] of [[-1.25, 0.85], [-1.25, -0.85], [1.75, 0.85], [1.75, -0.85]]) {
    const w = new THREE.Group() as unknown as THREE.Mesh;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 20).rotateX(Math.PI / 2), tyre); t.castShadow = true;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12).rotateX(Math.PI / 2), hub);
    (w as unknown as THREE.Group).add(t, h); w.position.set(x, 0.4, z); g.add(w); wheels.push(w);
  }
  return { g, wheels };
};

// ---------------- the airport (x 0) ----------------
const runwayTex = () => ctex("runway", 1024, 512, (g, r) => {
  g.fillStyle = "#55535f"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 1024, r() * 512, 5, 5); }
  g.fillStyle = "#f4f2ea"; for (let x = 20; x < 1024; x += 256) g.fillRect(x, 248, 140, 16); // centre-line dashes
  g.fillRect(0, 30, 1024, 8); g.fillRect(0, 474, 1024, 8); // edge lines
  g.fillStyle = "rgba(30,26,36,0.18)"; for (let x = 0; x < 1024; x += 64) g.fillRect(x, 200 + ((x * 7) % 40), 50, 110); // tyre smudges
});
const thresholdTex = () => ctex("threshold", 512, 512, (g) => {
  g.fillStyle = "#55535f"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f4f2ea"; for (let i = 0; i < 8; i++) if (i !== 3 && i !== 4) g.fillRect(70 + i * 48, 40, 26, 432) ;
});
const terminalTex = () => ctex("terminal", 1024, 256, (g) => {
  g.fillStyle = "#e9e4d8"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#4a6aa8"; g.fillRect(0, 70, 1024, 110); // the long glass band
  g.fillStyle = "rgba(255,255,255,0.25)"; for (let x = 0; x < 1024; x += 96) { g.beginPath(); g.moveTo(x, 180); g.lineTo(x + 40, 70); g.lineTo(x + 60, 70); g.lineTo(x + 20, 180); g.fill(); }
  g.fillStyle = "#3a4256"; for (let x = 0; x < 1024; x += 64) g.fillRect(x, 70, 6, 110);
  g.fillStyle = "#c9c2b0"; g.fillRect(0, 230, 1024, 26);
});
const towerCabTex = () => ctex("towerCab", 1024, 256, (g) => {
  g.fillStyle = "#3a5a8a"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "rgba(255,255,255,0.22)"; for (let x = 0; x < 1024; x += 128) { g.beginPath(); g.moveTo(x + 10, 256); g.lineTo(x + 60, 0); g.lineTo(x + 90, 0); g.lineTo(x + 40, 256); g.fill(); }
  g.fillStyle = "#e9e6de"; for (let x = 0; x < 1024; x += 128) g.fillRect(x, 0, 10, 256);
});
export const buildAirport = (root: THREE.Object3D) => {
  const b = new Batch();
  const grass = lam("airGrass", () => ({ map: rep(grassHD(), 30, 30) }));
  b.add(floorQ(AIR - 195, AIR + 195, -400, 200, 0, 1), grass, undefined, false);
  // runway (60 m wide, along x) with threshold piano keys at both ends, a taxiway and the apron
  const rw = lam("runwayM", () => ({ map: rep(runwayTex(), 1, 1) }));
  for (let x = AIR - 180; x < AIR + 180; x += 40) b.add(quad(V(x, 0.03, RWY_Z + 25), V(x + 40, 0.03, RWY_Z + 25), V(x + 40, 0.03, RWY_Z - 25), V(x, 0.03, RWY_Z - 25), 1, 1), rw, undefined, false);
  const th = lam("thresholdM", () => ({ map: thresholdTex() }));
  b.add(quad(V(AIR - 195, 0.03, RWY_Z + 25), V(AIR - 180, 0.03, RWY_Z + 25), V(AIR - 180, 0.03, RWY_Z - 25), V(AIR - 195, 0.03, RWY_Z - 25), 1, 1), th, undefined, false);
  const taxi = lam("taxiM", () => ({ color: "#605e6a" })), yellow = lam("taxiLine", () => ({ color: "#f2c43a" }));
  b.add(floorQ(AIR - 160, AIR + 160, RWY_Z - 45, RWY_Z - 30, 0.02, 1), taxi, undefined, false);
  b.add(floorQ(AIR - 160, AIR + 160, RWY_Z - 37.8, RWY_Z - 37.2, 0.035, 1), yellow, undefined, false);
  b.add(floorQ(AIR - 120, AIR + 120, RWY_Z - 95, RWY_Z - 45, 0.02, 1), lam("apronM", () => ({ color: "#8f8c96" })), undefined, false);
  // runway edge lights (little posts)
  const lightP = lam("edgeLight", () => ({ color: "#f4f2ea" }));
  for (let x = AIR - 175; x < AIR + 175; x += 12) for (const z of [RWY_Z + 26, RWY_Z - 26]) b.add(B(x - 0.15, 0, z - 0.15, x + 0.15, 0.5, z + 0.15), lightP);
  // the control tower: tapered shaft, gallery, glass cab, roof, mast
  const [tx, , tz] = TOWER, conc = lam("towerConc", () => ({ color: "#e9e4d8" })), dark = lam("towerDark", () => ({ color: "#3a3440" }));
  b.add(cyl(3.0, 2.2, 26, 24), conc, At(tx, 0, tz));
  b.add(cyl(4.6, 4.6, 1.2, 24), conc, At(tx, 26, tz));
  const cab = new THREE.CylinderGeometry(5.0, 4.4, 5, 12, 1, true); cab.translate(0, 2.5, 0);
  b.add(cab, lam("towerGlass", () => ({ map: towerCabTex(), side: THREE.DoubleSide })), At(tx, 27.2, tz));
  b.add(cyl(5.4, 5.2, 0.9, 24), dark, At(tx, 32.2, tz));
  b.add(cyl(0.2, 0.15, 4, 8), dark, At(tx, 33.1, tz));
  b.add(cyl(5.6, 3.2, 1.6, 24), conc, At(tx, 0, tz));
  // the terminal: long low building with a glass band, jet bridges
  const term = lam("termM", () => ({ map: terminalTex() }));
  const x0 = AIR - 90, x1 = AIR + 0, z0 = RWY_Z - 120, z1 = RWY_Z - 100, h = 12;
  b.add(quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, h, z1), V(x0, h, z1), 3, 1), term);
  b.add(B(x0, 0, z0, x1, h, z1 - 0.02), lam("termSide", () => ({ color: "#e9e4d8" })));
  b.add(B(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 1), lam("termRoof", () => ({ color: "#9aa3ad" })));
  for (const x of [AIR - 70, AIR - 40, AIR - 12]) { b.add(B(x - 1.6, 4, z1, x + 1.6, 7, z1 + 14), lam("bridge", () => ({ color: "#c9ced8" }))); b.add(B(x - 0.4, 0, z1 + 12, x + 0.4, 4, z1 + 13), dark); }
  // hangars (half cylinders) on the right, a windsock, trees and hills on the horizon
  const hang = lam("hangar", () => ({ color: "#c9d2dc" }));
  for (const x of [AIR + 60, AIR + 110]) { const g = new THREE.CylinderGeometry(16, 16, 40, 24, 1, false, -Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); b.add(g, hang, At(x, 0, RWY_Z - 120)); }
  b.add(cyl(0.12, 0.1, 6, 8), dark, At(AIR + 60, 0, RWY_Z + 40));
  const sock = new THREE.ConeGeometry(0.7, 3, 12, 1, true); sock.rotateZ(Math.PI / 2); b.add(sock, lam("sock", () => ({ color: "#f08a2c", side: THREE.DoubleSide })), At(AIR + 61.6, 5.8, RWY_Z + 40));
  for (let i = 0; i < 24; i++) tree(b, AIR - 190 + i * 16 + 4 * Math.sin(i * 2.7), -185 - 8 * ((i * 5) % 3), 2.2, i % 3);
  for (let i = 0; i < 8; i++) hill(b, AIR - 180 + i * 52, -260 - 40 * Math.sin(i * 1.7), 60, 26, lam("airHill", () => ({ color: "#86b85a" })));
  for (let i = 0; i < 10; i++) tree(b, AIR - 150 + i * 30, 60 + 10 * Math.sin(i), 2.0, i % 3);
  b.build(root);
};
