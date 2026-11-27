// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { TOWER, STATION, TRUCK, SX, STAIR, stairY } from "./story";

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

void water; void cloudHD; void mountain; void pine; void room; void hill; void tiles; void paintWall; void concreteTex; void wallX; void T;

// ======================= the robot-cleaner short's places =======================

// ======================= the fire-station training yard + the burn tower stairwell =======================
const slabTex = () => ctex("slab", 512, 512, (g, r) => {
  g.fillStyle = "#d3cdc1"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(90,80,90,0.06)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 60 + r() * 60, 30 + r() * 30, r() * 3, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(60,50,60,0.45)"; g.lineWidth = 4; g.strokeRect(0, 0, 512, 512);
});
/** board-formed concrete with soot: dark smudges climbing from the openings (towerFace) or random (plain) */
const sootTex = (key: string, base: string, soot: number) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.strokeStyle = "rgba(60,50,60,0.3)"; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  for (let i = 0; i < soot; i++) { const x = r() * 512, y = r() * 512; const gr = g.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, "rgba(40,34,42,0.35)"); gr.addColorStop(1, "rgba(40,34,42,0)"); g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 180); }
});
/** the tower front: concrete, a doorway and four window openings (dark, warm-lit inside), soot plumes above each opening */
const towerFront = () => ctex("towerFront", 1024, 2000, (g, r) => {
  const T = TOWER, w = T.x1 - T.x0, sx = 1024 / w, sy = 2000 / T.h;
  g.fillStyle = "#bdb6aa"; g.fillRect(0, 0, 1024, 2000);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 1024, r() * 2000, 6, 6); }
  g.strokeStyle = "rgba(60,50,60,0.3)"; g.lineWidth = 4;
  for (let y = 0; y <= 2000; y += 160) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  const open = (cx: number, y0: number, ow: number, oh: number) => {
    const X = (cx - T.x0 - ow / 2) * sx, Y = (T.h - y0 - oh) * sy, Wd = ow * sx, H = oh * sy;
    const pl = g.createLinearGradient(0, Y - 500, 0, Y);
    pl.addColorStop(0, "rgba(38,30,40,0)"); pl.addColorStop(1, "rgba(38,30,40,0.55)");
    g.fillStyle = pl; g.beginPath(); g.moveTo(X - 10, Y); g.lineTo(X + Wd + 10, Y); g.lineTo(X + Wd + 90, Y - 500); g.lineTo(X - 90, Y - 500); g.fill();
    const gr = g.createLinearGradient(0, Y, 0, Y + H); gr.addColorStop(0, "#5a2a1e"); gr.addColorStop(1, "#b5541c");
    g.fillStyle = gr; g.fillRect(X, Y, Wd, H);
    g.strokeStyle = "#2a2028"; g.lineWidth = 10; g.strokeRect(X, Y, Wd, H);
  };
  open(0, 0, T.doorW, T.doorH);
  for (const [x, y] of [[-1.8, 4.3], [1.8, 4.3], [-1.8, 7.5], [1.8, 7.5]] as [number, number][]) open(x, y, 1.3, 1.5);
});
/** fire-station front: red brick with three tall bays (roller doors, white frames), a white band */
const stationFront = () => ctex("stationFront", 2048, 1024, (g, r) => {
  const w = STATION.x1 - STATION.x0, h = STATION.h, sx = 2048 / w, sy = 1024 / h;
  g.fillStyle = "#b5543e"; g.fillRect(0, 0, 2048, 1024);
  g.fillStyle = "rgba(60,30,30,0.35)";
  for (let y = 0; y < 1024; y += 22) { g.fillRect(0, y, 2048, 3); for (let x = (y / 22) % 2 ? 0 : 30; x < 2048; x += 60) g.fillRect(x, y, 3, 22); }
  for (let i = 0; i < 200; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; g.fillRect(r() * 2048, r() * 1024, 30, 12); }
  g.fillStyle = "#f2ece0"; g.fillRect(0, 1024 - 6.6 * sy, 2048, 0.45 * sy);
  for (let i = 0; i < 3; i++) {
    const X = (1.2 + i * 4.6) * sx, Wd = 3.6 * sx, H = 4.6 * sy, Y = 1024 - H;
    g.fillStyle = "#f2ece0"; g.fillRect(X - 0.25 * sx, Y - 0.25 * sy, Wd + 0.5 * sx, H + 0.25 * sy);
    g.fillStyle = "#c8312a"; g.fillRect(X, Y, Wd, H);
    g.strokeStyle = "rgba(80,20,20,0.6)"; g.lineWidth = 6;
    for (let y = Y + 40; y < 1024; y += 40) { g.beginPath(); g.moveTo(X, y); g.lineTo(X + Wd, y); g.stroke(); }
    g.fillStyle = "#3a4560"; for (let k = 0; k < 4; k++) g.fillRect(X + 20 + k * (Wd - 40) / 4, Y + 70, (Wd - 40) / 4 - 16, 50);
    g.strokeStyle = "#2a2028"; g.lineWidth = 8; g.strokeRect(X, Y, Wd, H);
  }
});
const yellowLine = () => ctex("yLine", 64, 64, (g) => { g.fillStyle = "#f2c22a"; g.fillRect(0, 0, 64, 64); });

/** a simple fire engine: red body, white stripe, cab with dark windows, chrome ladder on top, six wheels; nose +x at yaw 0 */
const truck = (b: Batch, x: number, z: number, yaw: number) => {
  const red = lam("trRed", () => ({ color: "#d4322a" })), white = lam("trWhite", () => ({ color: "#f4f0e6" })), glass = lam("trGlass", () => ({ color: "#2c3446" }));
  const tyre = lam("trTyre", () => ({ color: "#22232a" })), chrome = lam("trChrome", () => ({ color: "#c9ccd4" })), hub = lam("trHub", () => ({ color: "#9aa0ac" }));
  const M = (lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().compose(V(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1))).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
  b.add(B(-3.6, 0.55, -1.15, 2.0, 2.9, 1.15), red, M(0, 0, 0));
  b.add(B(-3.62, 1.35, -1.17, 2.02, 1.55, 1.17), white, M(0, 0, 0));
  b.add(B(2.0, 0.55, -1.15, 3.6, 2.6, 1.15), red, M(0, 0, 0));
  b.add(B(2.6, 1.7, -1.17, 3.62, 2.45, 1.17), glass, M(0, 0, 0));
  b.add(B(3.6, 0.6, -1.0, 3.75, 1.1, 1.0), chrome, M(0, 0, 0));
  for (const lx of [-3.4, 0.6]) { b.add(B(-0.06, -0.06, -1.5, 0.06, 0.06, 1.5), chrome, M(lx * 0 + 0, 3.15, 0, 0, Math.PI / 2, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0))); void lx; }
  for (const lz of [-0.55, 0.55]) b.add(B(-3.4, 3.05, lz - 0.05, 1.8, 3.15, lz + 0.05), chrome, M(0, 0, 0));
  for (let k = 0; k < 12; k++) b.add(B(-3.3 + k * 0.42, 3.05, -0.55, -3.25 + k * 0.42, 3.12, 0.55), chrome, M(0, 0, 0));
  for (const lx of [-2.6, -1.5, 2.6]) for (const lz of [-1.1, 1.1]) {
    b.add(cyl(0.52, 0.52, 0.36, 20), tyre, M(lx, 0.52, lz + (lz > 0 ? -0.18 : 0.18), Math.PI / 2 * (lz > 0 ? -1 : 1)));
    b.add(cyl(0.26, 0.26, 0.38, 14), hub, M(lx, 0.52, lz + (lz > 0 ? -0.18 : 0.18), Math.PI / 2 * (lz > 0 ? -1 : 1)));
  }
  b.add(B(2.8, 2.6, -0.7, 3.2, 2.75, 0.7), lam("trLight", () => ({ color: "#3a6ad8" })), M(0, 0, 0));
};

export const buildFireYard = (root: THREE.Object3D) => {
  const b = new Batch();
  // ground: grass far, a big concrete yard around the tower
  const grassM = lam("yGrass", () => ({ map: rep(grassHD(), 30, 30) }));
  b.add(floorQ(-190, 190, -190, 190, -0.02, 380), grassM, undefined, false);
  const slab = lam("ySlab", () => ({ map: rep(slabTex(), 1, 1) }));
  for (let x = -30; x < 30; x += 3) for (let z = -24; z < 14; z += 3) b.add(quad(V(x, 0.0, z + 3), V(x + 3, 0.0, z + 3), V(x + 3, 0.0, z), V(x, 0.0, z)), slab, undefined, false);
  // painted yellow bay lines in front of the station
  const yl = lam("yLineM", () => ({ map: yellowLine() }));
  for (let i = 0; i < 4; i++) { const x = STATION.x0 + 1.0 + i * 4.6; b.add(quad(V(x, 0.012, -2), V(x + 0.12, 0.012, -2), V(x + 0.12, 0.012, STATION.z1), V(x, 0.012, STATION.z1)), yl, undefined, false); }
  // the burn tower: concrete box, painted front with openings, flat roof with a parapet
  const T = TOWER;
  const side = lam("twSide", () => ({ map: rep(sootTex("twSoot", "#bdb6aa", 10), 2, 4) }));
  const dw = T.doorW / 2, dh = T.doorH, zi = T.z1 - 3.5, tw = T.x1 - T.x0;
  b.add(B(T.x0, 0, T.z0, T.x1, T.h, zi), side); // the solid core behind a vestibule
  b.add(B(T.x0, 0, zi, -dw, T.h, T.z1 - 0.01), side); b.add(B(dw, 0, zi, T.x1, T.h, T.z1 - 0.01), side);
  b.add(B(-dw, dh, zi, dw, T.h, T.z1 - 0.01, 0, true), side);
  // painted front in three pieces around the doorway (UVs cut from the one front texture)
  const fr = lam("twFront", () => ({ map: towerFront() })), ud0 = (-dw - T.x0) / tw, ud1 = (dw - T.x0) / tw, vd = dh / T.h;
  b.add(quad(V(T.x0, 0, T.z1), V(-dw, 0, T.z1), V(-dw, T.h, T.z1), V(T.x0, T.h, T.z1), ud0, 1, 0, 0), fr);
  b.add(quad(V(dw, 0, T.z1), V(T.x1, 0, T.z1), V(T.x1, T.h, T.z1), V(dw, T.h, T.z1), 1, 1, ud1, 0), fr);
  b.add(quad(V(-dw, dh, T.z1), V(dw, dh, T.z1), V(dw, T.h, T.z1), V(-dw, T.h, T.z1), ud1, 1, ud0, vd), fr);
  b.add(floorQ(-dw, dw, zi, T.z1, 0.01, 2), lam("twInFloor", () => ({ color: "#5a4a44" })), undefined, false);
  const cap = lam("twCap", () => ({ color: "#a9a297" }));
  b.add(B(T.x0 - 0.15, T.h, T.z1 - 0.3, T.x1 + 0.15, T.h + 0.6, T.z1 + 0.15), cap);
  b.add(B(T.x0 - 0.15, T.h, T.z0 - 0.15, T.x1 + 0.15, T.h + 0.6, T.z0 + 0.3), cap);
  b.add(B(T.x0 - 0.15, T.h, T.z0, T.x0 + 0.3, T.h + 0.6, T.z1), cap); b.add(B(T.x1 - 0.3, T.h, T.z0, T.x1 + 0.15, T.h + 0.6, T.z1), cap);
  b.add(quad(V(-dw, 0, zi + 0.02), V(dw, 0, zi + 0.02), V(dw, dh, zi + 0.02), V(-dw, dh, zi + 0.02)), glow("twInGlow", "#c85a22", 0.9), undefined, false);
  // side stair tower (training ladder cage) for silhouette
  b.add(B(T.x1, 0, T.z0 + 1, T.x1 + 1.6, T.h - 2.5, T.z0 + 3.4), lam("twSide2", () => ({ map: rep(sootTex("twSoot2", "#c8c1b5", 4), 1, 3) })));
  // the fire station
  const S = STATION;
  b.add(B(S.x0, 0, S.z0, S.x1, S.h, S.z1 - 0.01), lam("stSide", () => ({ color: "#b5543e" })));
  b.add(quad(V(S.x0, 0, S.z1), V(S.x1, 0, S.z1), V(S.x1, S.h, S.z1), V(S.x0, S.h, S.z1)), lam("stFront", () => ({ map: stationFront() })));
  b.add(B(S.x0 - 0.2, S.h, S.z0 - 0.2, S.x1 + 0.2, S.h + 0.4, S.z1 + 0.2), lam("stCap", () => ({ color: "#f2ece0" })));
  b.add(B(S.x1 - 3.5, S.h, S.z0 + 2, S.x1 - 1.5, S.h + 5.5, S.z0 + 4), lam("stSide", () => ({ color: "#b5543e" }))); // hose-drying tower
  truck(b, TRUCK.x, TRUCK.z, TRUCK.yaw);
  // a few training props: cones, a pallet stack, hose reel
  const cone = lam("cone", () => ({ color: "#ff7a1e" })), cw = lam("coneW", () => ({ color: "#f4f0e6" }));
  for (const [x, z] of [[-4.8, -6.2], [4.6, -5.6], [-5.6, -1.5], [5.4, -1.0]] as [number, number][]) {
    const g1 = new THREE.ConeGeometry(0.22, 0.6, 16); g1.translate(0, 0.3, 0); b.add(g1, cone, At(x, 0, z));
    b.add(cyl(0.16, 0.13, 0.08, 16), cw, At(x, 0.27, z));
    b.add(B(x - 0.25, 0, z - 0.25, x + 0.25, 0.04, z + 0.25), cone);
  }
  const pal = lam("pallet", () => ({ color: "#b98a56" }));
  for (let k = 0; k < 5; k++) b.add(B(-6.5, k * 0.16, -9.5, -5.3, k * 0.16 + 0.12, -8.3), pal);
  b.add(cyl(0.45, 0.45, 0.3, 20), lam("reel", () => ({ color: "#c8312a" })), At(5.6, 0.45, -8.6, Math.PI / 2));
  // perimeter: trees + a low fence line far away
  for (let i = 0; i < 16; i++) tree(b, -60 + i * 8 + 2 * Math.sin(i * 2.1), -36 - 3 * ((i * 7) % 3), 1.6 + 0.3 * ((i * 5) % 3) / 2, i % 3);
  for (let i = 0; i < 10; i++) tree(b, 34 + 3 * Math.sin(i), -30 + i * 7, 1.5, (i + 1) % 3);
  for (let i = 0; i < 10; i++) tree(b, -42 + 3 * Math.cos(i), -24 + i * 7, 1.5, (i + 2) % 3);
  for (let i = 0; i < 12; i++) tree(b, -40 + i * 7, 26 + 2 * Math.sin(i), 1.4, i % 3);
  b.build(root);
};

/** the stairwell: a big room (camera inside on the open side), a straight concrete flight against the back wall up to a
 *  landing slab, a window opening glowing on the landing wall, burning pallets on the landing */
export const buildStairwell = (root: THREE.Object3D) => {
  const b = new Batch();
  const x0 = SX - 1.2, x1 = SX + 6, z0 = -8.6, z1 = 4.5, h = 7.2;
  const wall = lam("swWall", () => ({ map: rep(sootTex("swSoot", "#b9b1a5", 16), 1, 1) }));
  const floor = lam("swFloor", () => ({ map: rep(slabTex(), 1, 1) }));
  const ceil = lam("swCeil", () => ({ map: rep(sootTex("swCeilT", "#8a8078", 20), 1, 1) }));
  b.add(floorQ(x0, x1, z0, z1, 0, 2.5), floor, undefined, false);
  b.add(quad(V(x0, h, z0), V(x1, h, z0), V(x1, h, z1), V(x0, h, z1), 3, 5), ceil, undefined, false);
  b.add(wallZ(x0, x1, 0, h, z0, 2.5), wall, undefined, false);
  b.add(wallZ(x0, x1, 0, h, z1, 2.5, true), wall, undefined, false);
  b.add(wallX(z0, z1, 0, h, x0, 2.5), wall, undefined, false);
  b.add(wallX(z0, z1, 0, h, x1, 2.5, true), wall, undefined, false);
  // the flight: N solid steps from z0 down to z1, x from STAIR.x0 to STAIR.x1
  const st = lam("swStep", () => ({ color: "#c9c2b6" })), nose = lam("swNose", () => ({ color: "#f2c22a" }));
  const N = 18, run = (STAIR.z0 - STAIR.z1) / N, rise = STAIR.y1 / N;
  for (let i = 0; i < N; i++) {
    const za = STAIR.z0 - i * run, zb = za - run, y = (i + 1) * rise;
    b.add(B(STAIR.x0, 0, zb, STAIR.x1, y, za), st);
    b.add(B(STAIR.x0, y - 0.025, za - 0.06, STAIR.x1, y + 0.005, za), nose); // yellow safety nosing
  }
  // landing slab and its front face
  b.add(B(STAIR.x0, 0, STAIR.landZ - 1.2, STAIR.x1 + 1.2, STAIR.y1, STAIR.z1), st);
  // a stub of the next flight going up beyond the landing (reads as a tower)
  b.add(B(STAIR.x1 + 0.2, STAIR.y1, STAIR.landZ - 1.2, STAIR.x1 + 1.2, STAIR.y1 + 1.4, STAIR.landZ + 0.5), st);
  // glowing window opening on the landing back wall
  b.add(quad(V(x0 + 0.01, STAIR.y1 + 0.8, STAIR.landZ + 1.6), V(x0 + 0.01, STAIR.y1 + 0.8, STAIR.landZ + 0.2), V(x0 + 0.01, STAIR.y1 + 2.3, STAIR.landZ + 0.2), V(x0 + 0.01, STAIR.y1 + 2.3, STAIR.landZ + 1.6)), glow("swWin", "#ff9a3a", 1.25), undefined, false);
  // burning pallets on the landing corner
  const pal = lam("pallet", () => ({ color: "#b98a56" })), ch = lam("char", () => ({ color: "#3a2a28" }));
  for (let k = 0; k < 4; k++) b.add(B(SX - 0.95, STAIR.y1 + k * 0.16, STAIR.landZ - 0.5, SX + 0.2, STAIR.y1 + k * 0.16 + 0.12, STAIR.landZ + 0.65), k % 2 ? ch : pal);
  b.build(root);
};
