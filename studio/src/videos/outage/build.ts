// The places of the outage short (phone store + back office); helpers from the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { STORE, OFFICE, T1, T2, TABLE_Y, SCREEN, COUNTER, READER, REGISTER, ROUTER, MONITOR, DESK_Y } from "./story";

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

void tiles; void concreteTex; void hill; void tree; void T;

// ======================= the outage short's places =======================
const plankTex = () => ctex("storePlank", 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = jit(r, "#d9b98e", 0.04, 3, 0.06); g.fillRect(0, i * 64, 512, 64); g.fillStyle = "rgba(60,36,30,0.55)"; g.fillRect(0, i * 64, 512, 3);
    const off = (i * 197) % 512; g.fillRect(off, i * 64, 3, 64); }
});
const woodTop = () => ctex("tableWood", 512, 256, (g, r) => {
  for (let i = 0; i < 6; i++) { g.fillStyle = jit(r, "#e2c597", 0.03, 2, 0.05); g.fillRect(0, i * 43, 512, 43); g.fillStyle = "rgba(90,60,40,0.35)"; g.fillRect(0, i * 43, 512, 2); }
});

/** a light-wood display table (3.2 x 1.1 m) on two slab legs */
const table = (b: Batch, c: [number, number, number]) => {
  const [x, y, z] = c, top = lam("tableTop", () => ({ map: woodTop() })), leg = lam("tableLeg", () => ({ color: "#c9a77a" }));
  b.add(B(x - 1.6, y - 0.06, z - 0.55, x + 1.6, y, z + 0.55), top);
  for (const sx of [-1.25, 1.25]) b.add(B(x + sx - 0.05, 0, z - 0.45, x + sx + 0.05, y - 0.06, z + 0.45), leg);
};
/** little phones on angled stands along a table (screens are separate meshes in world.ts) */
export const PHONE_SPOTS = (c: [number, number, number], n = 5) => Array.from({ length: n }, (_, i) => [c[0] - 1.25 + (2.5 * i) / (n - 1), c[1], c[2] + 0.2] as [number, number, number]);

/** the phone store (x 0): pale plank floor, white walls, ceiling light strips, the wall screen (picture in world.ts),
 *  two display tables, the checkout counter with a card reader + register, shelves of accessory boxes, plants */
export const buildStore = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = STORE;
  room(b, X, 16, 12, 4.2, lam("stFloor", () => ({ map: rep(plankTex(), 1, 1) })), lam("stWall", () => ({ map: paintWall("stWallT", "#f1ede6") })), lam("stCeil", () => ({ color: "#f4f2ee" })), 1.6);
  // back wall: a warm wood feature panel behind the screen + the screen bezel
  const s = SCREEN;
  b.add(B(X - 4.2, 0, -5.98, X + 4.2, 4.2, -5.95), lam("featWood", () => ({ map: rep(woodTop(), 1, 1) })), undefined, false);
  b.add(B(s.x - s.w / 2 - 0.1, s.y - s.h / 2 - 0.1, s.z - 0.05, s.x + s.w / 2 + 0.1, s.y + s.h / 2 + 0.1, s.z - 0.005), lam("monBlack", () => ({ color: "#22252e" })));
  // ceiling light strips (emissive)
  for (const z of [-4, -1.5, 1, 3.5]) b.add(B(X - 6, 4.14, z - 0.12, X + 6, 4.2, z + 0.12), glow("lightStrip", "#fff6e6", 1.5), undefined, false);
  table(b, T1); table(b, T2);
  // phone stands on the tables
  const stand = lam("stand", () => ({ color: "#cfd3da" })), body = lam("phoneBody", () => ({ color: "#2b2f3a" }));
  for (const t of [T1, T2]) for (const [px, py, pz] of PHONE_SPOTS(t)) {
    b.add(B(px - 0.06, py, pz - 0.05, px + 0.06, py + 0.02, pz + 0.05), stand);
    b.add(new THREE.BoxGeometry(0.1, 0.19, 0.012), body, At(px, py + 0.1, pz, -0.45, 0, 0));
  }
  // checkout counter: white body with a wood top, card reader + register on top
  const c = COUNTER, white = lam("ctrWhite", () => ({ color: "#f4f2ee" })), top = lam("tableTop", () => ({ map: woodTop() }));
  b.add(B(c.x0, 0, c.z0, c.x1, c.y - 0.05, c.z1), white);
  b.add(B(c.x0 - 0.04, c.y - 0.05, c.z0 - 0.04, c.x1 + 0.04, c.y, c.z1 + 0.04), top);
  const dark = lam("monBlack", () => ({ color: "#22252e" }));
  b.add(B(READER[0] - 0.08, c.y, READER[2] - 0.11, READER[0] + 0.08, c.y + 0.04, READER[2] + 0.11), dark);
  b.add(B(REGISTER[0] - 0.03, c.y, REGISTER[2] - 0.03, REGISTER[0] + 0.03, c.y + 0.28, REGISTER[2] + 0.03), stand);
  b.add(new THREE.BoxGeometry(0.46, 0.32, 0.03), dark, At(REGISTER[0], c.y + 0.42, REGISTER[2], -0.2, -0.35, 0));
  // wall shelves with accessory boxes (pastel, no print) on both side walls
  const shelf = lam("shelf", () => ({ color: "#e2c597" }));
  const boxCols = ["#9ad8ff", "#ffd1e8", "#fff1b8", "#c8f0d0", "#ffffff"].map((col, i) => lam("accBox" + i, () => ({ color: col })));
  for (const side of [-1, 1]) for (let r = 0; r < 3; r++) {
    const wx = X + side * 7.75, y = 1.0 + r * 0.6;
    b.add(B(wx - (side > 0 ? 0.45 : 0), y, -5.2, wx + (side > 0 ? 0 : 0.45), y + 0.04, 3.2).applyMatrix4(new THREE.Matrix4()), shelf);
    for (let i = 0; i < 14; i++) { const z = -5.0 + i * 0.58, h = 0.22 + ((i + r) % 3) * 0.08, xi = side > 0 ? wx - 0.36 : wx + 0.06;
      b.add(B(xi, y + 0.04, z, xi + 0.3, y + 0.04 + h, z + 0.42), boxCols[(i + r * 2) % 5]); }
  }
  // the wifi router on table 2: a white box with two antennas
  const [rx, ry, rz] = ROUTER;
  b.add(B(rx - 0.2, ry, rz - 0.12, rx + 0.2, ry + 0.08, rz + 0.12), white);
  for (const sx of [-0.15, 0.15]) b.add(cyl(0.016, 0.012, 0.28, 8), white, At(rx + sx, ry + 0.07, rz - 0.08, 0, 0, sx > 0 ? -0.2 : 0.2));
  for (let i = 0; i < 3; i++) b.add(new THREE.SphereGeometry(0.012, 8, 6), glow("routerLed", "#5aff7a", 2.0), At(rx - 0.08 + i * 0.05, ry + 0.05, rz + 0.121), false);
  // potted plants in the corners
  for (const [x, z] of [[-6.8, -5.0], [6.8, -5.0], [-6.8, 3.0]]) {
    b.add(cyl(0.28, 0.22, 0.6, 14), lam("pot2", () => ({ color: "#f4f2ee" })), At(X + x, 0, z));
    for (let i = 0; i < 7; i++) b.add(new THREE.SphereGeometry(0.26, 10, 8), lam(i % 2 ? "leafA" : "leafB", () => ({ color: i % 2 ? "#4f8f3e" : "#6aa84a" })), At(X + x + 0.15 * Math.cos(i * 1.2), 0.75 + 0.14 * i, z + 0.15 * Math.sin(i * 1.2)));
  }
  b.build(root);
};
export const READER_FACE = (): [number, number, number] => [READER[0], COUNTER.y + 0.042, READER[2]];

/** the back office (x + 400): grey carpet, three server racks (LED faces in world.ts), a desk with the monitor */
export const buildOffice = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = OFFICE;
  room(b, X, 8, 8, 3.4, lam("ofFloor", () => ({ color: "#7a8296" })), lam("ofWall", () => ({ map: paintWall("ofWallT", "#dfe4ec", "#b8c2d4") })), lam("ofCeil", () => ({ color: "#eef0f4" })), 1.6);
  const rack = lam("rackBody", () => ({ color: "#2a2d36" }));
  for (const x of [-1.5, -0.6, 0.3, 1.2]) b.add(B(X + x - 0.38, 0, -3.9, X + x + 0.38, 2.1, -3.0), rack);
  for (const z of [-2.5, 0.5]) b.add(B(X - 3, 3.34, z - 0.12, X + 3, 3.4, z + 0.12), glow("lightStrip", "#fff6e6", 1.5), undefined, false);
  // desk + monitor (picture in world.ts) + keyboard + mug
  const desk = lam("deskTop", () => ({ color: "#d8c4a4" })), leg = lam("deskLeg", () => ({ color: "#5a5e6a" })), dark = lam("monBlack", () => ({ color: "#22252e" }));
  b.add(B(X - 1.1, DESK_Y - 0.05, -2.0, X + 0.9, DESK_Y, -1.1), desk);
  for (const [lx, lz] of [[-1.0, -1.9], [0.8, -1.9], [-1.0, -1.2], [0.8, -1.2]]) b.add(B(X + lx - 0.03, 0, lz - 0.03, X + lx + 0.03, DESK_Y - 0.05, lz + 0.03), leg);
  const m = MONITOR;
  b.add(B(m.x - m.w / 2 - 0.04, m.y - m.h / 2 - 0.04, m.z - 0.05, m.x + m.w / 2 + 0.04, m.y + m.h / 2 + 0.04, m.z - 0.005), dark);
  b.add(B(m.x - 0.03, DESK_Y, m.z - 0.06, m.x + 0.03, m.y - m.h / 2, m.z - 0.02), dark);
  b.add(B(m.x - 0.18, DESK_Y, m.z - 0.16, m.x + 0.18, DESK_Y + 0.015, m.z + 0.04), dark);
  b.add(B(X - 0.55, DESK_Y, -1.35, X + 0.05, DESK_Y + 0.02, -1.18), lam("kbd", () => ({ color: "#cfd3da" })));
  b.add(cyl(0.045, 0.045, 0.1, 14), lam("mug", () => ({ color: "#e8483c" })), At(X + 0.55, DESK_Y, -1.4));
  b.build(root);
};
