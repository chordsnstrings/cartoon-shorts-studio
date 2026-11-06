// The places of the Finnish-music short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): library hall, IT office, Finnish lake, buffet.
// Static geometry is merged per material; moving parts (planes, camera head, ambulance, drives, scroll) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { LIB, DESK, FIN, BUF, MON, MON_YAW, MON_W, MON_H, YT, HALL, KIOSK, TABLES, DOORS, TRUCK, PORCH } from "./story";

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

// ---------------- library hall (x 0) ----------------
/** book spines on shelves: n shelves, painted spines with seams; one image per 2 m wide x 5 m tall unit */
const bookTex = (key: string, seed: number) => ctex(key, 512, 1280, (g, r) => {
  g.fillStyle = "#6a4128"; g.fillRect(0, 0, 512, 1280);
  const cols = ["#b8443a", "#3a5f9a", "#c9a23a", "#4f8a5e", "#8a4a6a", "#d8cfb8", "#7a5a3a", "#2f6a72", "#c97a3a"];
  const shelfH = 1280 / 6;
  for (let s = 0; s < 6; s++) {
    const y1 = (s + 1) * shelfH - 18;
    let x = 14;
    while (x < 498) {
      const w = 14 + r() * 26, h = shelfH * (0.62 + r() * 0.28);
      if (x + w > 498) break;
      const lean = r() < 0.06;
      g.fillStyle = jit(r, cols[Math.floor(r() * cols.length)], 0.08, 4, 0.1);
      if (lean) { g.save(); g.translate(x, y1); g.rotate(-0.25); g.fillRect(0, -h, w, h); g.restore(); x += w + 10; continue; }
      g.fillRect(x, y1 - h, w, h);
      g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x + 3, y1 - h + 12, w - 6, 5); g.fillRect(x + 3, y1 - 26, w - 6, 5);
      g.fillStyle = "rgba(30,18,24,0.55)"; g.fillRect(x + w - 2, y1 - h, 2, h);
      x += w + (r() < 0.1 ? 8 : 1);
    }
    g.fillStyle = "#8a5a34"; g.fillRect(0, y1, 512, 18); g.fillStyle = "rgba(38,24,30,0.85)"; g.fillRect(0, y1 + 16, 512, 3);
  }
  g.fillStyle = "#8a5a34"; g.fillRect(0, 0, 14, 1280); g.fillRect(498, 0, 14, 1280);
  void seed;
});
const hallFloorTex = () => ctex("hallFloor", 1024, 1024, (g, r) => {
  // herringbone-ish parquet in warm oak
  const S = 64;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { g.fillStyle = jit(r, (i + j) % 2 ? "#b98a5a" : "#a87a4e", 0.06, 3, 0.1); g.fillRect(i * S, j * S, S, S); }
  g.strokeStyle = "rgba(60,36,28,0.7)"; g.lineWidth = 3;
  for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * S); g.lineTo(1024, i * S); g.stroke(); }
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { g.beginPath(); if ((i + j) % 2) { g.moveTo(i * S + S / 2, j * S); g.lineTo(i * S + S / 2, j * S + S); } else { g.moveTo(i * S, j * S + S / 2); g.lineTo(i * S + S, j * S + S / 2); } g.stroke(); }
});
const hallWallTex = () => ctex("hallWall", 512, 512, (g, r) => {
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 40 + r() * 80, 20 + r() * 40, r() * 3, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(150,120,90,0.45)"; g.lineWidth = 4; g.strokeRect(40, 40, 432, 432);
});
const archWin = () => ctex("archWin", 256, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#6aa0e0"); gr.addColorStop(1, "#cfe2f6");
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, 256, 512);
  g.fillStyle = gr; g.beginPath(); g.moveTo(16, 512); g.lineTo(16, 128); g.arc(128, 128, 112, Math.PI, 0); g.lineTo(240, 512); g.closePath(); g.fill();
  g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.ellipse(90, 230, 46, 16, 0, 0, 6.283); g.fill();
  g.strokeStyle = "#f4efe6"; g.lineWidth = 12; g.beginPath(); g.moveTo(128, 16); g.lineTo(128, 512); g.moveTo(16, 300); g.lineTo(240, 300); g.stroke();
  g.lineWidth = 18; g.beginPath(); g.moveTo(16, 512); g.lineTo(16, 128); g.arc(128, 128, 112, Math.PI, 0); g.lineTo(240, 512); g.stroke();
});
const doorwayTex = () => ctex("doorway", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#9cc8f0"); gr.addColorStop(0.62, "#d8ecfa"); gr.addColorStop(0.63, "#b8d89a"); gr.addColorStop(1, "#9cc87a");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#6aa84a"; for (const x of [60, 180, 400]) { g.beginPath(); g.ellipse(x, 300, 60, 70, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "#d9d0bc"; g.beginPath(); g.moveTo(200, 512); g.lineTo(240, 325); g.lineTo(272, 325); g.lineTo(312, 512); g.fill();
});
/** a shelf unit: frame box + painted spine face toward +n (n = +1 or -1 along x or z) */
const shelf = (b: Batch, x: number, z: number, along: "x" | "z", len: number, h: number, n: 1 | -1, k: number) => {
  const wood = lam("shelfWood", () => ({ color: "#7a4a2c" })), d = 0.45;
  const books = lam("books" + (k % 3), () => ({ map: bookTex("bookT" + (k % 3), k % 3) }));
  if (along === "z") {
    b.add(B(x - d / 2, 0, z - len / 2, x + d / 2, h, z + len / 2), wood);
    const xf = x + n * (d / 2 + 0.003);
    for (let i = 0; i < Math.round(len / 2); i++) { const z0 = z - len / 2 + i * 2, z1 = z0 + 2; b.add(n > 0 ? quad(V(xf, 0.1, z1), V(xf, 0.1, z0), V(xf, h - 0.1, z0), V(xf, h - 0.1, z1)) : quad(V(xf, 0.1, z0), V(xf, 0.1, z1), V(xf, h - 0.1, z1), V(xf, h - 0.1, z0)), books); }
    b.add(B(x - d / 2 - 0.05, h, z - len / 2 - 0.05, x + d / 2 + 0.05, h + 0.14, z + len / 2 + 0.05), wood);
  } else {
    b.add(B(x - len / 2, 0, z - d / 2, x + len / 2, h, z + d / 2), wood);
    const zf = z + n * (d / 2 + 0.003);
    for (let i = 0; i < Math.round(len / 2); i++) { const x0 = x - len / 2 + i * 2, x1 = x0 + 2; b.add(n > 0 ? quad(V(x0, 0.1, zf), V(x1, 0.1, zf), V(x1, h - 0.1, zf), V(x0, h - 0.1, zf)) : quad(V(x1, 0.1, zf), V(x0, 0.1, zf), V(x0, h - 0.1, zf), V(x1, h - 0.1, zf)), books); }
    b.add(B(x - len / 2 - 0.05, h, z - d / 2 - 0.05, x + len / 2 + 0.05, h + 0.14, z + d / 2 + 0.05), wood);
  }
};
export const LAMPS: [number, number, number][] = [];
export const buildLibrary = (root: THREE.Object3D) => {
  const b = new Batch();
  const { w, d, h } = HALL;
  const floor = lam("hallFloorM", () => ({ map: rep(hallFloorTex(), 1, 1) }));
  const wall = lam("hallWallM", () => ({ map: hallWallTex() }));
  room(b, LIB, w, d, h, floor, wall, lam("hallCeil", () => ({ color: "#efe4cc" })), 4);
  const x0 = LIB - w / 2, x1 = LIB + w / 2, z0 = -d / 2;
  // ceiling beams + a cornice
  const beamM = lam("hallBeam", () => ({ color: "#8a5a34" }));
  for (let z = -15; z <= 15; z += 6) b.add(B(x0, h - 0.5, z - 0.25, x1, h, z + 0.25), beamM, undefined, false);
  // wall shelves along both side walls (5 m tall) and the back wall either side of the entrance
  for (const side of [-1, 1] as const) for (let i = 0; i < 8; i++) shelf(b, LIB + side * (w / 2 - 0.3), -14 + i * 4, "z", 4, 5, side > 0 ? -1 : 1, i + (side > 0 ? 3 : 0));
  for (const side of [-1, 1] as const) shelf(b, LIB + side * 6.6, z0 + 0.3, "x", 8, 5, 1, side > 0 ? 1 : 2);
  // freestanding stacks in the back corners (double sided)
  for (const side of [-1, 1] as const) for (const [z, k] of [[-12.5, 4], [-8.5, 5]] as const) {
    shelf(b, LIB + side * 7.6, z, "z", 4, 3.6, -1, k); shelf(b, LIB + side * 7.6, z, "z", 4, 3.6, 1, k + 1);
    shelf(b, LIB + side * 9.8, z, "z", 4, 3.6, -1, k + 2);
  }
  // arched windows above the wall shelves
  const win = glow("archWinM", "#ffffff", 1.0, archWin());
  for (const side of [-1, 1] as const) for (let i = 0; i < 5; i++) {
    const z = -12 + i * 6, x = LIB + side * (w / 2 - 0.02);
    b.add(side > 0 ? quad(V(x, 5.6, z + 1.1), V(x, 5.6, z - 1.1), V(x, 8.3, z - 1.1), V(x, 8.3, z + 1.1)) : quad(V(x, 5.6, z - 1.1), V(x, 5.6, z + 1.1), V(x, 8.3, z + 1.1), V(x, 8.3, z - 1.1)), win, undefined, false);
  }
  // the entrance: a bright doorway in the back wall, stone frame, both doors swung open
  b.add(quad(V(LIB - 1.7, 0, z0 + 0.02), V(LIB + 1.7, 0, z0 + 0.02), V(LIB + 1.7, 4.0, z0 + 0.02), V(LIB - 1.7, 4.0, z0 + 0.02)), glow("doorwayM", "#ffffff", 1.05, doorwayTex()), undefined, false);
  const stoneM = lam("doorStone", () => ({ color: "#cfc4ae" }));
  b.add(B(LIB - 2.2, 0, z0, LIB - 1.7, 4.4, z0 + 0.3), stoneM); b.add(B(LIB + 1.7, 0, z0, LIB + 2.2, 4.4, z0 + 0.3), stoneM); b.add(B(LIB - 2.2, 4.0, z0, LIB + 2.2, 4.5, z0 + 0.3), stoneM);
  const doorM = lam("hallDoor", () => ({ color: "#7a4a2c" }));
  b.add(B(LIB - 1.7, 0, z0 + 0.3, LIB - 1.62, 3.9, z0 + 1.9), doorM); b.add(B(LIB + 1.62, 0, z0 + 0.3, LIB + 1.7, 3.9, z0 + 1.9), doorM);
  // red runner down the middle aisle
  b.add(floorQ(LIB - 1.1, LIB + 1.1, z0 + 0.4, 17.5, 0.006, 2.2), lam("runner", () => ({ map: ctex("runnerT", 256, 256, (g) => { g.fillStyle = "#a8423a"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#d8a24a"; g.fillRect(14, 0, 12, 256); g.fillRect(230, 0, 12, 256); }) })), undefined, false);
  // the catalogue kiosk: a slanted wooden podium; the screen picture itself is dynamic (world.ts)
  const [kx, , kz] = KIOSK, wd = lam("kioskWood", () => ({ color: "#9a6438" })), dark = lam("deskDark", () => ({ color: "#2b2f3a" }));
  b.add(B(kx - 0.42, 0, kz - 0.3, kx + 0.42, 1.05, kz + 0.12), wd);
  b.add(B(kx - 0.5, 0, kz - 0.36, kx + 0.5, 0.08, kz + 0.2), wd);
  const tilt = new THREE.Matrix4().compose(V(kx, 1.32, kz + 0.05), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.32), V(1, 1, 1));
  b.add(B(-0.36, -0.2, -0.06, 0.36, 0.2, 0.06), dark, tilt);
  b.add(B(kx - 0.05, 1.02, kz - 0.1, kx + 0.05, 1.2, kz + 0.02), dark);
  // reading tables with green lamps and chairs
  const top = lam("tableTop", () => ({ color: "#8a5634" })), chairM = lam("hallChair", () => ({ color: "#6a3a24" }));
  const lampBase = lam("lampBrass", () => ({ color: "#c9a24a" }));
  for (const [tx, tz0, tz1] of TABLES) {
    const X = LIB + tx;
    b.add(B(X - 0.7, 0.72, tz0, X + 0.7, 0.78, tz1), top);
    for (const [dx, zz] of [[-0.62, tz0 + 0.1], [0.62, tz0 + 0.1], [-0.62, tz1 - 0.1], [0.62, tz1 - 0.1]]) b.add(B(X + dx - 0.05, 0, zz - 0.05, X + dx + 0.05, 0.72, zz + 0.05), top);
    for (let z = tz0 + 1.25; z < tz1; z += 2.5) {
      b.add(cyl(0.09, 0.07, 0.04, 14), lampBase, At(X, 0.78, z)); b.add(cyl(0.014, 0.014, 0.36, 8), lampBase, At(X, 0.78, z));
      LAMPS.push([X, 1.17, z]);
    }
    for (const side of [-1, 1]) for (let z = tz0 + 0.75; z < tz1; z += 1.5) {
      const cx = X + side * 1.0;
      b.add(B(cx - 0.22, 0.44, z - 0.22, cx + 0.22, 0.49, z + 0.22), chairM);
      b.add(B(cx + side * 0.2 - 0.03, 0.49, z - 0.22, cx + side * 0.2 + 0.03, 1.0, z + 0.22), chairM);
      for (const [a, c] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) b.add(B(cx + a - 0.025, 0, z + c - 0.025, cx + a + 0.025, 0.44, z + c + 0.025), chairM);
    }
    // book piles on the tables
    const bookCols = ["#e8483c", "#3a64b8", "#f2c43a", "#4f9a6e", "#c95b8a", "#efece4"];
    for (let i = 0; i < 12; i++) {
      const z = tz0 + 0.5 + i, xo = (i % 2 ? 0.35 : -0.35), n = 1 + (i * 7) % 4;
      for (let k = 0; k < n; k++) b.add(B(X + xo - 0.13, 0.78 + k * 0.05, z - 0.18, X + xo + 0.13, 0.83 + k * 0.05, z + 0.18), lam("book" + ((i + k) % 6), () => ({ color: bookCols[(i + k) % 6] })), At(0, 0, 0));
    }
  }
  // a globe and a ladder for the stacks
  b.add(new THREE.SphereGeometry(0.32, 20, 14), lam("globe", () => ({ color: "#4a8ac8" })), At(LIB - 3.0, 1.25, 12.5)); b.add(cyl(0.2, 0.05, 0.95, 12), wd, At(LIB - 3.0, 0, 12.5));
  b.build(root);
};

// ---------------- the IT office (x - 1000): the template's desk room ----------------
// ---------------- the YouTuber's room (x - 1000) ----------------
const posterTex = (key: string, bg: string, a: string, c: string) => ctex(key, 256, 360, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 256, 360);
  g.fillStyle = a; g.beginPath(); g.arc(128, 150, 70, 0, 6.283); g.fill();
  g.fillStyle = c; g.beginPath(); g.moveTo(30, 320); g.lineTo(128, 190); g.lineTo(226, 320); g.fill();
  g.strokeStyle = "#f4efe6"; g.lineWidth = 14; g.strokeRect(0, 0, 256, 360);
});
const windowTex = () => ctex("roomWindow", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#5e93d9"); gr.addColorStop(1, "#bcd6f2");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#ffffff"; for (const [x, y, s] of [[120, 140, 1], [360, 220, 0.8]]) { g.beginPath(); g.ellipse(x, y, 70 * s, 26 * s, 0, 0, 6.283); g.ellipse(x + 40 * s, y - 18 * s, 44 * s, 30 * s, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "#6aa84a"; g.beginPath(); g.ellipse(256, 520, 330, 120, 0, 0, 6.283); g.fill();
  g.fillStyle = "#eef0f4"; g.fillRect(246, 0, 20, 512); g.fillRect(0, 246, 512, 20);
  g.strokeStyle = "#eef0f4"; g.lineWidth = 36; g.strokeRect(0, 0, 512, 512);
});
const rugTex = () => ctex("rug", 512, 512, (g) => {
  g.fillStyle = "#c95b5b"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#f2c43a"; g.lineWidth = 18; g.strokeRect(40, 40, 432, 432);
  g.strokeStyle = "#f4efe6"; g.lineWidth = 8; g.strokeRect(80, 80, 352, 352);
});
const floorBoards = () => ctex("roomBoards", 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = jit(r, "#b98a5a", 0.07, 3, 0.1); g.fillRect(0, i * 64, 512, 64); }
  g.strokeStyle = "rgba(60,36,28,0.7)"; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); const x = (i * 197) % 512; g.beginPath(); g.moveTo(x, i * 64); g.lineTo(x, i * 64 + 64); g.stroke(); }
});
export const PRINTER: [number, number, number] = [DESK - 0.78, 0.75, -1.05];
export const buildDesk = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("roomFloor", () => ({ map: floorBoards() }));
  const wall = lam("roomWall", () => ({ map: paintWall("roomWallT", "#e8d9b8", "#c9a978") }));
  room(b, DESK, 7, 6, 2.8, floor, wall, lam("roomCeil", () => ({ color: "#f2ead8" })), 1.2);
  // window on the back wall (unlit sky picture), posters, a shelf of books, a plant, a lamp
  b.add(quad(V(DESK - 2.6, 1.2, -2.98), V(DESK - 1.3, 1.2, -2.98), V(DESK - 1.3, 2.35, -2.98), V(DESK - 1.6 - 1.0, 2.35, -2.98)), glow("roomWin", "#ffffff", 1.0, windowTex()));
  b.add(B(DESK - 2.7, 1.12, -3.0, DESK - 1.2, 1.2, -2.86), lam("sill", () => ({ color: "#f4efe6" })));
  b.add(B(DESK + 0.9, 1.4, -2.99, DESK + 1.45, 2.17, -2.97), lam("poster1", () => ({ map: posterTex("pst1", "#3a64b8", "#f2c43a", "#e8483c") })));
  b.add(B(DESK - 0.9, 1.6, -2.99, DESK - 0.45, 2.2, -2.97), lam("poster2", () => ({ map: posterTex("pst2", "#2fa39a", "#f4efe6", "#3a3440") })));
  const shelf = lam("shelf", () => ({ color: "#8a5a34" }));
  b.add(B(DESK + 1.7, 1.55, -2.98, DESK + 3.0, 1.6, -2.7), shelf); b.add(B(DESK + 1.7, 0.95, -2.98, DESK + 3.0, 1.0, -2.7), shelf);
  const bookCols = ["#e8483c", "#3a64b8", "#f2c43a", "#4f9a6e", "#c95b8a", "#efece4"];
  for (let i = 0; i < 14; i++) { const x = DESK + 1.75 + i * 0.085, h = 0.22 + 0.08 * Math.sin(i * 2.3), y = i < 7 ? 1.6 : 1.0, xx = i < 7 ? x : x - 7 * 0.085;
    b.add(B(xx, y, -2.95, xx + 0.07, y + h, -2.75), lam("book" + (i % 6), () => ({ color: bookCols[i % 6] }))); }
  b.add(cyl(0.18, 0.14, 0.34, 14), lam("pot", () => ({ color: "#c96a3a" })), At(DESK + 2.6, 0, -2.4));
  for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.22, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(DESK + 2.6 + 0.15 * Math.cos(i * 1.3), 0.5 + 0.12 * i, -2.4 + 0.15 * Math.sin(i * 1.3)));
  b.add(floorQ(DESK - 1.6, DESK + 1.4, -1.0, 1.0, 0.004, 3), lam("rugM", () => ({ map: rugTex() })), undefined, false);
  // the desk: top, legs, drawer block
  const wood = lam("deskWood", () => ({ color: "#d9a86a" })), dark = lam("deskDark", () => ({ color: "#2b2f3a" }));
  b.add(B(DESK - 1.05, 0.71, -1.42, DESK + 1.05, 0.75, -0.72), wood);
  for (const [x, z] of [[-1.0, -1.37], [1.0, -1.37], [-1.0, -0.77], [1.0, -0.77]]) b.add(B(DESK + x - 0.03, 0, z - 0.03, DESK + x + 0.03, 0.71, z + 0.03), wood);
  b.add(B(DESK + 0.55, 0.3, -1.4, DESK + 1.0, 0.71, -0.78), wood);
  // the monitor: bezel box turned to the YouTuber, stand; the screen picture itself is a dynamic mesh (world.ts)
  const mm = new THREE.Matrix4().compose(V(MON[0], MON[1], MON[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), MON_YAW), V(1, 1, 1));
  b.add(B(-MON_W / 2 - 0.03, -MON_H / 2 - 0.03, -0.05, MON_W / 2 + 0.03, MON_H / 2 + 0.03, -0.005), dark, mm);
  b.add(B(-0.03, -MON_H / 2 - 0.3, -0.06, 0.03, -MON_H / 2, -0.03), dark, mm);
  b.add(B(-0.14, -MON_H / 2 - 0.33, -0.16, 0.14, -MON_H / 2 - 0.3, 0.06), dark, mm);
  // keyboard, mouse, mug, the printer
  b.add(B(DESK - 0.2, 0.75, -1.0, DESK + 0.25, 0.78, -0.85), lam("kbd", () => ({ color: "#e9e4d8" })), T(0, 0, 0, 0));
  b.add(new THREE.SphereGeometry(0.035, 10, 8).scale(1, 0.6, 1.4), lam("kbd", () => ({ color: "#e9e4d8" })), At(DESK + 0.36, 0.77, -0.92));
  b.add(cyl(0.045, 0.045, 0.1, 14), lam("mug", () => ({ color: "#e8483c" })), At(DESK - 0.5, 0.75, -0.88));
  const [prx, pry, prz] = PRINTER;
  b.add(B(prx - 0.2, pry, prz - 0.18, prx + 0.2, pry + 0.18, prz + 0.14), lam("printer", () => ({ color: "#f2f2f4" })));
  b.add(B(prx - 0.16, pry + 0.18, prz - 0.16, prx + 0.16, pry + 0.2, prz + 0.05), dark);
  b.add(B(prx - 0.17, pry + 0.05, prz + 0.14, prx + 0.17, pry + 0.08, prz + 0.2), lam("printerSlot", () => ({ color: "#9aa3ad" })));
  // the chair behind the YouTuber
  const chair = lam("chairM", () => ({ color: "#3a3440" }));
  b.add(B(YT[0] - 0.3, 0.42, YT[2] - 0.55, YT[0] + 0.3, 0.5, YT[2] - 0.05), chair);
  b.add(B(YT[0] - 0.3, 0.5, YT[2] - 0.62, YT[0] + 0.3, 1.45, YT[2] - 0.54), chair);
  b.add(cyl(0.04, 0.04, 0.42, 8), chair, At(YT[0], 0, YT[2] - 0.3));
  // desk lamp (bulb glow in world.ts) and a door on the side wall
  b.add(cyl(0.08, 0.08, 0.02, 14), dark, At(DESK - 0.95, 0.75, -1.3)); b.add(cyl(0.012, 0.012, 0.45, 8), dark, At(DESK - 0.95, 0.75, -1.3, 0.3, 0, 0));
  b.add(B(DESK + 3.48, 0, -0.5, DESK + 3.5, 2.1, 0.5), lam("door", () => ({ color: "#b5794a" })));
  b.build(root);
};
export const LAMP_AT: [number, number, number] = [DESK - 0.95, 1.2, -1.18];


// ---------------- the Finnish lake at sunset (x + 1000) ----------------
const snowTex = () => ctex("snow", 512, 512, (g, r) => {
  g.fillStyle = "#f6f8fc"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.5)" : "rgba(150,160,200,0.10)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 30 + r() * 60, 10 + r() * 18, 0, 0, 6.283); g.fill(); }
});
const iceTex = () => ctex("ice", 512, 512, (g, r) => {
  g.fillStyle = "#a9c8e6"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 60 + r() * 90, 8 + r() * 10, 0, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(90,120,170,0.35)"; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
});
const cabinTex = () => ctex("cabinRed", 512, 512, (g, r) => {
  // falu-red horizontal logs with dark seams
  for (let i = 0; i < 10; i++) { g.fillStyle = jit(r, "#8e3a34", 0.06, 3, 0.08); g.fillRect(0, i * 51.2, 512, 51.2); g.fillStyle = "rgba(38,18,22,0.75)"; g.fillRect(0, i * 51.2 + 47, 512, 4); }
});
const snowPine = (b: Batch, x: number, z: number, s: number) => {
  const trunk = lam("trunk", () => ({ color: "#7a5a40" })), dark = lam("pineDeep", () => ({ color: "#2a5a42" })), snow = lam("snowCap", () => ({ color: "#f2f5fa" }));
  b.add(cyl(0.16 * s, 0.12 * s, 1.0 * s, 8), trunk, At(x, 0, z));
  for (let i = 0; i < 4; i++) {
    const r = (1.45 - i * 0.3) * s, y = (0.8 + i * 1.0) * s;
    const g = new THREE.ConeGeometry(r, 1.9 * s, 10); g.translate(0, 0.95 * s, 0); b.add(g, dark, At(x, y, z, 0, i));
    const c = new THREE.ConeGeometry(r * 0.62, 0.8 * s, 10); c.translate(0, 1.5 * s, 0); b.add(c, snow, At(x, y + 0.05 * s, z, 0, i));
  }
};
export const buildFinland = (root: THREE.Object3D) => {
  const b = new Batch();
  const snow = lam("snowM", () => ({ map: rep(snowTex(), 12, 12) })), ice = lam("iceM", () => ({ map: rep(iceTex(), 10, 10) }));
  b.add(floorQ(FIN - 195, FIN + 195, -6, 160, 0, 1), snow, undefined, false);
  b.add(floorQ(FIN - 195, FIN + 195, -150, -6, -0.12, 1), ice, undefined, false);
  b.add(quad(V(FIN - 195, -0.12, -6), V(FIN + 195, -0.12, -6), V(FIN + 195, 0, -5.6), V(FIN - 195, 0, -5.6)), snow, undefined, false);
  b.add(floorQ(FIN - 195, FIN + 195, -400, -150, 0.1, 1), snow, undefined, false);
  // far shore: pines and snowy hills
  for (let i = 0; i < 40; i++) snowPine(b, FIN - 150 + i * 7.6 + 2 * Math.sin(i * 3.1), -152 - 6 * Math.abs(Math.sin(i * 1.7)), 2.6 + 0.8 * Math.sin(i));
  for (let i = 0; i < 7; i++) hill(b, FIN - 170 + i * 58, -200 - 30 * Math.sin(i * 1.7), 50, 22 + 10 * Math.sin(i * 2.3), lam("snowHill", () => ({ color: "#e6eaf4" })));
  // near pines framing the cabin
  for (const [x, z, s] of [[-12, -3, 1.4], [-15, 2, 1.7], [6.5, -5, 1.5], [9, -2, 1.8], [12, 3, 1.5], [-19, -4.5, 1.6], [16, -4.5, 1.4], [-10, 9, 1.6], [11, 10, 1.7]] as const) snowPine(b, FIN + x, z, s);
  // the cabin: red log walls, white trim, snowy roof, a porch deck in front with steps, a warm window
  const [px, py] = PORCH;
  const cx0 = px - 2.5, cx1 = px + 3.0, cz0 = -6.4, cz1 = -2.6, ch = 2.7;
  const red = lam("cabinM", () => ({ map: cabinTex() })), trim = lam("cabinTrim", () => ({ color: "#f4efe6" })), roofM = lam("cabinRoof", () => ({ color: "#f2f5fa" }));
  b.add(quad(V(cx0, py, cz1), V(cx1, py, cz1), V(cx1, ch + py, cz1), V(cx0, ch + py, cz1), 2, 1), red);
  b.add(B(cx0, 0, cz0, cx1, ch + py, cz1 - 0.01), red);
  const rz = (cz0 + cz1) / 2, rh = 1.5;
  b.add(quad(V(cx0 - 0.3, ch + py, cz1 + 1.6), V(cx1 + 0.3, ch + py, cz1 + 1.6), V(cx1 + 0.3, ch + py + rh, rz), V(cx0 - 0.3, ch + py + rh, rz)), roofM);
  b.add(quad(V(cx1 + 0.3, ch + py, cz0 - 0.4), V(cx0 - 0.3, ch + py, cz0 - 0.4), V(cx0 - 0.3, ch + py + rh, rz), V(cx1 + 0.3, ch + py + rh, rz)), roofM);
  for (const xg of [cx0, cx1]) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([xg, ch + py, cz1, xg, ch + py, cz0, xg, ch + py + rh, rz], 3)); g.computeVertexNormals(); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); b.add(g, red); }
  b.add(B(cx0 - 0.08, 0, cz1 - 0.08, cx0 + 0.08, ch + py, cz1 + 0.08), trim); b.add(B(cx1 - 0.08, 0, cz1 - 0.08, cx1 + 0.08, ch + py, cz1 + 0.08), trim);
  // door + window with warm light
  b.add(B(px - 1.9, py, cz1, px - 1.0, py + 2.0, cz1 + 0.05), lam("cabinDoor", () => ({ color: "#3a5f9a" })));
  b.add(B(px - 2.0, py + 2.0, cz1, px - 0.9, py + 2.1, cz1 + 0.07), trim);
  b.add(quad(V(px + 0.9, py + 1.0, cz1 + 0.03), V(px + 2.2, py + 1.0, cz1 + 0.03), V(px + 2.2, py + 2.0, cz1 + 0.03), V(px + 0.9, py + 2.0, cz1 + 0.03)), glow("cabinWin", "#ffc878", 1.3));
  b.add(B(px + 0.82, py + 0.92, cz1, px + 2.28, py + 1.0, cz1 + 0.09), trim); b.add(B(px + 0.82, py + 2.0, cz1, px + 2.28, py + 2.08, cz1 + 0.09), trim);
  b.add(B(px + 1.52, py + 1.0, cz1, px + 1.58, py + 2.0, cz1 + 0.06), trim);
  // porch deck, posts, roof overhang shadow line, steps, a bench
  const deck = lam("deckWood", () => ({ color: "#b58a5a" }));
  b.add(B(cx0, 0, cz1, cx1, py, -0.4), deck);
  for (const x of [cx0 + 0.1, cx1 - 0.1]) b.add(B(x - 0.07, py, -0.55, x + 0.07, ch + py, -0.41), trim);
  b.add(B(px - 0.5, 0, -0.4, px + 0.5, py * 0.5, 0.0), deck);
  b.add(B(px - 1.2, py + 0.42, -1.75, px + 0.1, py + 0.48, -1.25), deck); for (const x of [px - 1.1, px]) b.add(B(x - 0.05, py, -1.7, x + 0.05, py + 0.42, -1.3), deck);
  // snow lump on the bench end + a woodpile
  b.add(new THREE.SphereGeometry(0.3, 12, 8).scale(1.4, 0.5, 1), lam("snowCap", () => ({ color: "#f2f5fa" })), At(cx1 + 0.6, 0.05, -1.0));
  for (let i = 0; i < 9; i++) { const g = cyl(0.12, 0.12, 0.9, 10); g.rotateX(Math.PI / 2); b.add(g, lam("logEnd", () => ({ color: "#c49a6a" })), At(cx1 + 0.55 + (i % 3) * 0.25, 0.12 + Math.floor(i / 3) * 0.23, -4.0)); }
  // the jetty out onto the ice
  const jx = FIN - 7.5;
  b.add(B(jx - 0.7, 0.2, -12.5, jx + 0.7, 0.3, -4.5), deck);
  for (let z = -12.2; z < -4.5; z += 1.6) for (const s of [-1, 1]) b.add(cyl(0.08, 0.08, 0.6, 8), lam("trunk", () => ({ color: "#7a5a40" })), At(jx + s * 0.62, -0.3, z));
  b.build(root);
};

// ---------------- the buffet (x + 2000) ----------------
const tileTex = () => ctex("bufTiles", 512, 512, (g, r) => {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = jit(r, (i + j) % 2 ? "#e9e1cf" : "#c9bba0", 0.04, 3, 0.08); g.fillRect(i * 128, j * 128, 128, 128); }
  g.strokeStyle = "rgba(38,24,30,0.6)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
});
export const buildBuffet = (root: THREE.Object3D) => {
  const b = new Batch();
  room(b, BUF, 16, 12, 4, lam("bufFloor", () => ({ map: rep(tileTex(), 1, 1) })), lam("bufWall", () => ({ map: paintWall("bufWallT", "#f0d9a8", "#c98a5a") })), lam("bufCeil", () => ({ color: "#f6ecd8" })), 1.4);
  // four doors in the back wall (dark doorways with frames) - the guest pops back in through a new one each time
  const frame = lam("doorFrame", () => ({ color: "#f4efe6" })), dark = glow("doorDark", "#2a2232", 1.0);
  for (const dx of DOORS) {
    const x = BUF + dx;
    b.add(quad(V(x - 0.55, 0, -5.97), V(x + 0.55, 0, -5.97), V(x + 0.55, 2.2, -5.97), V(x - 0.55, 2.2, -5.97)), dark, undefined, false);
    b.add(B(x - 0.68, 0, -6, x - 0.55, 2.3, -5.86), frame); b.add(B(x + 0.55, 0, -6, x + 0.68, 2.3, -5.86), frame); b.add(B(x - 0.68, 2.2, -6, x + 0.68, 2.33, -5.86), frame);
    b.add(B(x + 0.55, 0, -5.9, x + 0.62, 2.18, -5.0), lam("bufDoor", () => ({ color: "#4f9a6e" })));
  }
  // the buffet table: white cloth, silver domes, bowls, a cake, fruit
  const cloth = lam("cloth", () => ({ color: "#fbfaf4" })), silver = lam("silver", () => ({ color: "#c9ced8" }));
  b.add(B(BUF - 6.0, 0, -3.6, BUF - 5.0, 0.9, 2.6), cloth);
  for (let i = 0; i < 5; i++) {
    const z = -3.1 + i * 1.3;
    b.add(new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), silver, At(BUF - 5.5, 0.9, z));
    b.add(cyl(0.04, 0.04, 0.06, 8), silver, At(BUF - 5.5, 1.16, z));
  }
  for (const [z, c] of [[-2.45, "#e8483c"], [-1.15, "#f2a03a"], [0.15, "#7fbf5a"], [1.45, "#c97a3a"]] as const) {
    b.add(cyl(0.16, 0.2, 0.1, 16), lam("bowl", () => ({ color: "#f4efe6" })), At(BUF - 5.2, 0.9, z));
    for (let k = 0; k < 3; k++) b.add(new THREE.SphereGeometry(0.06, 10, 8), lam("food" + c, () => ({ color: c })), At(BUF - 5.2 + 0.06 * Math.cos(k * 2.1), 1.02, z + 0.06 * Math.sin(k * 2.1)));
  }
  b.add(cyl(0.22, 0.22, 0.24, 20), lam("cake", () => ({ color: "#f4c8d8" })), At(BUF - 5.5, 0.9, 2.2)); b.add(cyl(0.22, 0.22, 0.04, 20), lam("cakeTop", () => ({ color: "#e8483c" })), At(BUF - 5.5, 1.14, 2.2));
  // the truck (our own cartoon pickup), facing -x, open bed toward the table
  const [tx, , tz] = TRUCK, paint = lam("truckPaint", () => ({ color: "#f2c43a" })), tyre = lam("tyre", () => ({ color: "#2b2f3a" })), glass = lam("truckGlass", () => ({ color: "#4a6aa8" }));
  b.add(B(tx - 1.7, 0.45, tz - 0.85, tx + 0.2, 0.75, tz + 0.85), paint); // bed floor
  b.add(B(tx - 1.7, 0.75, tz - 0.85, tx + 0.2, 1.2, tz - 0.75), paint); b.add(B(tx - 1.7, 0.75, tz + 0.75, tx + 0.2, 1.2, tz + 0.85), paint);
  b.add(B(tx - 1.8, 0.45, tz - 0.85, tx - 1.7, 1.2, tz + 0.85), paint); // tailgate side (toward the table)
  b.add(B(tx + 0.2, 0.45, tz - 0.85, tx + 1.6, 1.9, tz + 0.85), paint); // cab
  b.add(B(tx + 0.26, 1.25, tz - 0.86, tx + 1.2, 1.78, tz + 0.86), glass);
  b.add(B(tx + 1.6, 0.45, tz - 0.8, tx + 1.75, 0.65, tz + 0.8), lam("bumper", () => ({ color: "#9aa3ad" })));
  for (const [x, z] of [[-1.2, -0.85], [-1.2, 0.85], [1.1, -0.85], [1.1, 0.85]]) { const g = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18); g.rotateX(Math.PI / 2); b.add(g, tyre, At(tx + x, 0.4, tz + z)); }
  // pendant lamps, a potted plant, a framed picture
  b.add(cyl(0.2, 0.16, 0.35, 14), lam("pot", () => ({ color: "#c96a3a" })), At(BUF - 7.2, 0, -5.2));
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.3, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(BUF - 7.2 + 0.2 * Math.cos(i * 1.3), 0.6 + 0.16 * i, -5.2 + 0.2 * Math.sin(i * 1.3)));
  b.build(root);
};
