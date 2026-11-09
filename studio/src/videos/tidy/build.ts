// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { HALL, STOOP, HQ, BATH, ST, SP, MON, MON_YAW, MON_W, MON_H, DESK_Z, DESK_H, PILOT, TOILET } from "./story";

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

// ======================= the robot-cleaner short's places =======================
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5a5866"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
});
const slabTex = () => ctex("slab", 512, 512, (g, r) => {
  g.fillStyle = "#cfc8bb"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,60,0.55)"; g.lineWidth = 4; g.strokeRect(0, 0, 512, 512);
});
const wallpaperTex = () => ctex("wallpaper", 512, 512, (g, r) => {
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(190,150,110,0.22)"; g.fillRect(x, 0, 22, 512); }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 50, 30, r() * 3, 0, 6.283); g.fill(); }
});
const runnerTex = () => ctex("runner", 256, 256, (g, r) => {
  g.fillStyle = "#9a3b3f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
  g.fillStyle = "#e0b45a"; g.fillRect(0, 0, 18, 256); g.fillRect(238, 0, 18, 256);
});
const artTex = (key: string, a: string, b: string, c: string) => ctex(key, 256, 320, (g) => {
  g.fillStyle = "#f6efe0"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = a; g.beginPath(); g.arc(90, 120, 60, 0, 6.283); g.fill();
  g.fillStyle = b; g.fillRect(120, 150, 100, 120);
  g.fillStyle = c; g.beginPath(); g.moveTo(30, 290); g.lineTo(140, 190); g.lineTo(220, 290); g.fill();
  g.strokeStyle = "#5a3b2a"; g.lineWidth = 22; g.strokeRect(0, 0, 256, 320);
});
const cityTex = () => ctex("cityWin", 1024, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#6aa0e0"); gr.addColorStop(1, "#cfe2f6"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  const cols = ["#9aa8c0", "#b4bdd0", "#8a96b0", "#c4ccdc"];
  for (let i = 0; i < 14; i++) { const x = i * 76 - 10, h = 120 + ((i * 97) % 220); g.fillStyle = cols[i % 4]; g.fillRect(x, 512 - h, 70, h); g.fillStyle = "rgba(255,255,255,0.35)"; for (let y = 512 - h + 14; y < 500; y += 28) for (let k = 0; k < 3; k++) g.fillRect(x + 8 + k * 20, y, 10, 14); }
  g.fillStyle = "#3a4256"; for (let x = 0; x <= 1024; x += 341) g.fillRect(x - 8, 0, 16, 512); g.fillRect(0, 0, 1024, 14); g.fillRect(0, 498, 1024, 14);
});
const bathTile = () => ctex("bathTile", 512, 512, (g, r) => {
  const n = 6, t = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = jit(r, "#cfe6e4", 0.04, 3, 0.08); g.fillRect(i * t, j * t, t, t); }
  g.strokeStyle = "rgba(90,110,120,0.6)"; g.lineWidth = 4;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(512, i * t); g.stroke(); }
});
const floorCheck = () => ctex("floorCheck", 512, 512, (g) => {
  const n = 4, t = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? "#f2eee4" : "#3f4a5c"; g.fillRect(i * t, j * t, t, t); }
});
const woodFloor = () => ctex("woodFloor", 512, 512, (g, r) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = jit(r, "#b98a5a", 0.06, 4, 0.1); g.fillRect(0, i * 64, 512, 64); g.fillStyle = "rgba(60,36,24,0.7)"; g.fillRect(0, i * 64, 512, 3); g.fillRect(((i * 211) % 512), i * 64, 3, 64); }
});

/** the apartment hall: carpeted staircase rising toward +z, landing at the top (x 0) */
export const buildHall = (root: THREE.Object3D) => {
  const b = new Batch();
  const { n, rise, run, z0, w } = ST, x0 = HALL - w / 2, x1 = HALL + w / 2, H = n * rise;
  const wood = lam("stairWood", () => ({ color: "#b98a5a" })), runner = lam("runnerM", () => ({ map: runnerTex() }));
  const wall = lam("hallWall", () => ({ map: rep(wallpaperTex(), 1, 1) })), trim = lam("trim", () => ({ color: "#f4efe4" }));
  for (let i = 1; i <= n; i++) {
    const za = z0 + (i - 1) * run, zb = za + run, y = i * rise;
    b.add(B(x0, 0, za, x1, y, zb), wood);
    b.add(quad(V(HALL - 0.48, y + 0.004, zb), V(HALL + 0.48, y + 0.004, zb), V(HALL + 0.48, y + 0.004, za), V(HALL - 0.48, y + 0.004, za)), runner, undefined, false);
    b.add(quad(V(HALL - 0.48, y - rise, za - 0.004), V(HALL + 0.48, y - rise, za - 0.004), V(HALL + 0.48, y, za - 0.004), V(HALL - 0.48, y, za - 0.004)), runner, undefined, false);
  }
  // landing at the top, floor at the bottom
  b.add(B(x0, 0, 0, x1 + 1.2, H, 2.6), wood);
  b.add(floorQ(x0, x1, z0 - 3, z0, 0.0, 1), lam("hallFloor", () => ({ map: rep(woodFloor(), 1, 1) })), undefined, false);
  // side walls (left full height; right wall beyond the banister), back wall with a door, ceiling
  b.add(wallX(z0 - 3, 2.6, 0, 5.4, x0, 2), wall, undefined, false);
  b.add(wallX(z0 - 3, 2.6, 0, 5.4, x1 + 1.2, 2, true), wall, undefined, false);
  b.add(wallZ(x0, x1 + 1.2, 0, 5.4, z0 - 3, 2), wall, undefined, false);
  b.add(B(HALL - 0.45, 0, z0 - 3, HALL + 0.45, 2.05, z0 - 2.96), lam("hallDoor", () => ({ color: "#6a4a3a" })));
  b.add(quad(V(x0, 5.4, z0 - 3), V(x1 + 1.2, 5.4, z0 - 3), V(x1 + 1.2, 5.4, 2.6), V(x0, 5.4, 2.6)), lam("hallCeil", () => ({ color: "#f2ede2" })), undefined, false);
  // skirting along the left wall following the stairs
  for (let i = 1; i <= n; i++) { const za = z0 + (i - 1) * run; b.add(B(x0, i * rise, za, x0 + 0.03, i * rise + 0.12, za + run), trim); }
  // banister on the right: newel posts, balusters, a sloped hand rail
  const rail = lam("rail", () => ({ color: "#6a4a3a" })), bal = lam("baluster", () => ({ color: "#f4efe4" }));
  for (let i = 1; i <= n; i++) { const zc = z0 + (i - 0.5) * run; b.add(B(x1 - 0.06, i * rise, zc - 0.02, x1 - 0.02, i * rise + 0.9, zc + 0.02), bal); }
  const rl = new THREE.BoxGeometry(0.07, 0.07, Math.hypot(n * run, H) + 0.2); rl.rotateX(-Math.atan2(H, n * run));
  b.add(rl, rail, At(x1 - 0.04, H / 2 + 0.95, z0 + (n * run) / 2));
  b.add(B(x1 - 0.09, 0, z0 - 0.15, x1 + 0.01, 1.15, z0 - 0.05), rail);
  // framed pictures climbing the left wall, a ceiling lamp, a little window high on the right
  const arts = [artTex("art1", "#f2c43a", "#9ac8e8", "#4f9a6e"), artTex("art2", "#4f9a6e", "#f2a03a", "#7b5ac9"), artTex("art3", "#2fa39a", "#e8a0b0", "#3a64b8")];
  arts.forEach((t, i) => { const zc = z0 + 0.9 + i * 1.1, y = 1.5 + (zc - z0) * (rise / run); b.add(quad(V(x0 + 0.02, y, zc + 0.24), V(x0 + 0.02, y, zc - 0.24), V(x0 + 0.02, y + 0.6, zc - 0.24), V(x0 + 0.02, y + 0.6, zc + 0.24)), lam("art" + i, () => ({ map: t }))); });
  b.add(cyl(0.2, 0.08, 0.18, 16), glow("hallLamp", "#fff2d0", 1.6), At(HALL, 5.18, -1.6), false);
  b.add(quad(V(x1 + 1.18, 3.0, -0.6), V(x1 + 1.18, 3.0, -2.2), V(x1 + 1.18, 4.4, -2.2), V(x1 + 1.18, 4.4, -0.6)), glow("hallWin", "#ffffff", 1.05, cityTex()), undefined, false);
  b.build(root);
};

/** the street front: brick apartment building, 8-step stoop with railings, sidewalk, road (x + 400) */
export const buildStoop = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = STOOP, fz = SP.face;
  b.add(floorQ(X - 190, X + 190, 0, 3, 0.0, 1.5), lam("slabM", () => ({ map: rep(slabTex(), 1, 1) })), undefined, false);
  b.add(floorQ(X - 190, X + 190, fz, 0, 0.0, 1.5), lam("slabM", () => ({ map: rep(slabTex(), 1, 1) })), undefined, false);
  b.add(B(X - 190, 0, 3, X + 190, 0.14, 3.25), lam("curb", () => ({ color: "#d9d6cf" })));
  for (let x = X - 190; x < X + 190; x += 10) b.add(quad(V(x, -0.02, 10), V(x + 10, -0.02, 10), V(x + 10, -0.02, 3.25), V(x, -0.02, 3.25), 1, 1), lam("road", () => ({ map: rep(asphaltTex(), 1, 1) })), undefined, false);
  b.add(floorQ(X - 190, X + 190, 10, 40, 0.0, 1.5), lam("slabM", () => ({ map: rep(slabTex(), 1, 1) })), undefined, false);
  // the building: a brick facade with windows, the stoop's door, neighbours either side
  const fac = lam("stoopFac", () => ({ map: facadeHD("stoopFac", 9, 10, { wall: "#c9805a", shutter: "#3a4a5a", brick: true }) }));
  b.add(quad(V(X - 4.5, 0, fz), V(X + 4.5, 0, fz), V(X + 4.5, 10, fz), V(X - 4.5, 10, fz)), fac);
  b.add(B(X - 4.5, 10, fz - 6, X + 4.5, 10.4, fz + 0.25), lam("cornice", () => ({ color: "#efe6d4" })));
  const nb = [["#e8d2a8", "#3a64b8"], ["#b9c9a0", "#7a3a3a"]];
  nb.forEach(([wl, sh], i) => {
    const xa = i ? X + 4.5 : X - 13.5, f2 = lam("nbFac" + i, () => ({ map: facadeHD("nbFac" + i, 9, 9, { wall: wl, shutter: sh, door: true }) }));
    b.add(quad(V(xa, 0, fz - 0.3), V(xa + 9, 0, fz - 0.3), V(xa + 9, 9, fz - 0.3), V(xa, 9, fz - 0.3)), f2);
    b.add(B(xa, 9, fz - 6, xa + 9, 9.3, fz - 0.05), lam("cornice", () => ({ color: "#efe6d4" })));
  });
  // door frame + door at the top of the stoop
  const yl = SP.n * SP.rise;
  b.add(B(X - 0.75, yl, fz, X + 0.75, yl + 2.5, fz + 0.12), lam("doorFrame", () => ({ color: "#efe6d4" })));
  b.add(B(X - 0.55, yl, fz + 0.1, X + 0.55, yl + 2.25, fz + 0.16), lam("stoopDoor", () => ({ color: "#2f6a5a" })));
  b.add(B(X + 0.35, yl + 1.0, fz + 0.16, X + 0.42, yl + 1.12, fz + 0.2), lam("brass", () => ({ color: "#e0b45a" })));
  // the steps (stone), landing, railings
  const stone = lam("stepStone", () => ({ color: "#d8cfbf" })), iron = lam("iron", () => ({ color: "#2b2f3a" }));
  for (let i = 1; i <= SP.n; i++) b.add(B(X - SP.w / 2, 0, -i * SP.run, X + SP.w / 2, i * SP.rise, -(i - 1) * SP.run), stone);
  b.add(B(X - SP.w / 2, 0, fz, X + SP.w / 2, yl, -SP.n * SP.run), stone);
  for (const sd of [-1, 1]) {
    const x = X + sd * (SP.w / 2 - 0.06);
    for (let i = 1; i <= SP.n; i += 2) b.add(B(x - 0.02, i * SP.rise, -(i - 0.5) * SP.run - 0.02, x + 0.02, i * SP.rise + 0.9, -(i - 0.5) * SP.run + 0.02), iron);
    const L = Math.hypot(SP.n * SP.run, yl);
    const rl = new THREE.BoxGeometry(0.05, 0.05, L); rl.rotateX(Math.atan2(yl, SP.n * SP.run));
    b.add(rl, iron, At(x, yl / 2 + 0.92, -(SP.n * SP.run) / 2));
    b.add(B(x - 0.03, 0, -0.08, x + 0.03, 1.0, -0.02), iron);
  }
  // planters by the steps, sidewalk trees, a lamp post
  for (const sd of [-1, 1]) {
    b.add(B(X + sd * 1.6 - 0.3, 0, -0.9, X + sd * 1.6 + 0.3, 0.45, -0.3), lam("planter", () => ({ color: "#8a5a3a" })));
    for (let i = 0; i < 4; i++) b.add(new THREE.SphereGeometry(0.2, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(X + sd * 1.6 + 0.15 * Math.cos(i * 1.7), 0.55 + 0.05 * (i % 2), -0.6 + 0.15 * Math.sin(i * 1.7)));
  }
  for (const x of [-5.5, 5.5, -16, 16]) tree(b, X + x, 2.2, 0.9, (x + 20) % 3 | 0);
  b.add(cyl(0.07, 0.06, 4.2, 10), iron, At(X - 3.2, 0, 2.6));
  b.add(new THREE.SphereGeometry(0.22, 14, 10), glow("lampGlobe", "#fff6e0", 1.2), At(X - 3.2, 4.3, 2.6), false);
  // houses across the road (seen in reverse angles)
  for (let i = 0; i < 5; i++) {
    const xa = X - 22 + i * 9, f3 = lam("acrossFac" + (i % 3), () => ({ map: facadeHD("acrossFac" + (i % 3), 8, 8, { wall: ["#f0c8b0", "#c9d6e0", "#e8d2a8"][i % 3], shutter: "#3a64b8", door: true }) }));
    b.add(quad(V(xa + 8, 0, 14), V(xa, 0, 14), V(xa, 8, 14), V(xa + 8, 8, 14)), f3);
  }
  b.build(root);
};
/** our own cartoon minivan, front toward +x, sliding door open on the near (+z) side */
export const makeVan = () => {
  const g = new THREE.Group();
  const paint = lam("vanPaint", () => ({ color: "#3a7fd0" })), glass = lam("vanGlass", () => ({ color: "#2b3a5a" })), grey = lam("bumper", () => ({ color: "#9aa3ad" }));
  const dark = lam("vanInside", () => ({ color: "#2a2630" }));
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [boxGeo(V(-2.4, 0.38, -0.9), V(1.6, 1.85, 0.9)), paint],
    [boxGeo(V(1.6, 0.38, -0.9), V(2.45, 1.05, 0.9)), paint],
    [boxGeo(V(1.25, 1.05, -0.86), V(1.95, 1.7, 0.86)), glass], // windscreen block
    [boxGeo(V(-2.2, 1.15, -0.91), V(1.1, 1.65, 0.91)), glass], // side windows band
    [boxGeo(V(-0.6, 0.45, 0.88), V(0.7, 1.7, 0.93)), dark], // the open sliding door gap
    [boxGeo(V(2.45, 0.35, -0.85), V(2.6, 0.6, 0.85)), grey], [boxGeo(V(-2.55, 0.35, -0.85), V(-2.4, 0.6, 0.85)), grey],
    [boxGeo(V(-1.95, 0.45, 0.93), V(-0.7, 1.72, 0.98)), paint], // the slid-back door panel
  ];
  for (const [geo, m] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
  const tyre = lam("tyre", () => ({ color: "#2b2f3a" })), hub = lam("hub", () => ({ color: "#d9d6cf" }));
  for (const [x, z] of [[-1.5, 0.85], [-1.5, -0.85], [1.6, 0.85], [1.6, -0.85]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20).rotateX(Math.PI / 2), tyre); t.position.set(x, 0.36, z); t.castShadow = true; g.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 12).rotateX(Math.PI / 2), hub); h.position.set(x, 0.36, z); g.add(h);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.3), glow("headlight", "#fff6d0", 1.4));
  for (const z of [-0.6, 0.6]) { const m = hl.clone(); m.position.set(2.47, 0.85, z); g.add(m); }
  return g;
};

/** the pilot's HQ office: desk with the monitor and the overheating gear box, shelves of spare robot heads (x - 400) */
export const buildHQ = (root: THREE.Object3D) => {
  const b = new Batch();
  room(b, HQ, 6, 5.2, 3, lam("hqFloor", () => ({ map: rep(slabTex(), 1, 1) })), lam("hqWall", () => ({ map: paintWall("hqWallT", "#d7dde6", "#9aa8bc") })), lam("hqCeil", () => ({ color: "#eef0f3" })), 1.2);
  const zb = -2.58;
  b.add(quad(V(HQ - 2.2, 1.0, zb), V(HQ + 0.6, 1.0, zb), V(HQ + 0.6, 2.5, zb), V(HQ - 2.2, 2.5, zb)), glow("hqWin", "#ffffff", 1.0, cityTex()));
  // desk
  const top = lam("deskTop", () => ({ color: "#e9e2d2" })), leg = lam("deskLeg", () => ({ color: "#3a3440" }));
  b.add(B(HQ - 1.2, DESK_H - 0.04, DESK_Z - 0.42, HQ + 1.3, DESK_H, DESK_Z), top);
  for (const x of [-1.15, 1.25]) b.add(B(HQ + x - 0.03, 0, DESK_Z - 0.4, HQ + x + 0.03, DESK_H - 0.04, DESK_Z - 0.02), leg);
  b.add(B(HQ - 1.15, 0.25, DESK_Z - 0.05, HQ + 1.25, DESK_H - 0.04, DESK_Z - 0.02), lam("deskModesty", () => ({ color: "#c9c0ae" })));
  // monitor: bezel + stand (screen picture in world.ts)
  const black = lam("monBlack", () => ({ color: "#22252e" }));
  const m = new THREE.Matrix4().compose(V(MON[0], MON[1], MON[2]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), MON_YAW), V(1, 1, 1));
  b.add(B(-MON_W / 2 - 0.025, -MON_H / 2 - 0.025, -0.04, MON_W / 2 + 0.025, MON_H / 2 + 0.025, -0.002), black, m);
  b.add(B(-0.03, -MON_H / 2 - 0.27, -0.06, 0.03, -MON_H / 2, -0.03), black, m);
  b.add(B(-0.13, -MON_H / 2 - 0.29, -0.14, 0.13, -MON_H / 2 - 0.27, 0.04), black, m);
  // the gear box next to it (vents; LEDs + smoke in world/cast)
  b.add(B(HQ + 0.78, DESK_H, DESK_Z - 0.38, HQ + 1.02, DESK_H + 0.36, DESK_Z - 0.1), lam("gearBox", () => ({ color: "#3a3f4c" })));
  for (let i = 0; i < 5; i++) b.add(B(HQ + 0.81, DESK_H + 0.08 + i * 0.05, DESK_Z - 0.099, HQ + 0.98, DESK_H + 0.1 + i * 0.05, DESK_Z - 0.095), black);
  // two hand controllers on the desk, a mug
  b.add(cyl(0.04, 0.04, 0.09, 12), lam("mug", () => ({ color: "#f2c43a" })), At(HQ - 0.8, DESK_H, DESK_Z - 0.2));
  // chair behind the desk
  const chair = lam("chairM", () => ({ color: "#3a3440" }));
  b.add(B(PILOT[0] - 0.28, 0.42, PILOT[2] - 0.5, PILOT[0] + 0.28, 0.5, PILOT[2] + 0.02), chair);
  b.add(B(PILOT[0] - 0.28, 0.5, PILOT[2] - 0.58, PILOT[0] + 0.28, 1.35, PILOT[2] - 0.5), chair);
  // shelves on the back wall with spare 3D-printed robot heads + antennae
  const shelf = lam("shelf", () => ({ color: "#b98a5a" })), shell = lam("rShell", () => ({ color: "#f4f1ea" })), scr = lam("rScreen", () => ({ color: "#1d2432" }));
  for (const y of [1.2, 1.75]) {
    b.add(B(HQ + 1.0, y, zb, HQ + 2.7, y + 0.04, zb + 0.32), shelf);
    for (let i = 0; i < 3; i++) {
      const x = HQ + 1.25 + i * 0.55;
      b.add(B(x - 0.16, y + 0.04, zb + 0.06, x + 0.16, y + 0.3, zb + 0.28), shell);
      b.add(B(x - 0.12, y + 0.08, zb + 0.281, x + 0.12, y + 0.26, zb + 0.29), scr);
      for (const s of [-1, 1]) b.add(cyl(0.008, 0.008, 0.14, 6), leg, At(x + s * 0.1, y + 0.3, zb + 0.16));
    }
  }
  // a whiteboard (blank, a few coloured marks) and a plant
  b.add(B(HQ - 2.95, 1.0, -1.2, HQ - 2.93, 2.1, 0.6), lam("wb", () => ({ map: ctex("wbT", 512, 256, (g) => { g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, 512, 256); g.strokeStyle = "#3a64b8"; g.lineWidth = 8; g.strokeRect(60, 60, 120, 80); g.strokeStyle = "#e8483c"; g.beginPath(); g.moveTo(200, 100); g.lineTo(320, 100); g.lineTo(300, 85); g.stroke(); g.strokeStyle = "#4f9a6e"; g.beginPath(); g.arc(400, 110, 50, 0, 6.283); g.stroke(); g.strokeStyle = "#7a8494"; g.lineWidth = 14; g.strokeRect(4, 4, 504, 248); }) })));
  b.add(cyl(0.2, 0.16, 0.38, 14), lam("pot", () => ({ color: "#c96a3a" })), At(HQ - 2.5, 0, -2.2));
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.26, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(HQ - 2.5 + 0.18 * Math.cos(i * 1.3), 0.6 + 0.15 * i, -2.2 + 0.18 * Math.sin(i * 1.3)));
  for (const x of [-1.6, 0.4, 2.0]) b.add(B(HQ + x - 0.6, 2.98, -1.4, HQ + x + 0.6, 2.995, -0.6), glow("panelLight", "#fff6e0", 1.15), undefined, false);
  b.build(root);
};

/** the reporter's bathroom: toilet, sink with a dripping tap, mirror, tiles (x - 800) */
export const buildBath = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = BATH, w = 2.8, d = 2.6, h = 2.5;
  room(b, X, w, d, h, lam("bathFloor", () => ({ map: rep(floorCheck(), 1, 1) })), lam("bathPaint", () => ({ map: paintWall("bathPaintT", "#f2e7cf") })), lam("bathCeil", () => ({ color: "#fbf8f0" })), 0.8);
  const tile = lam("bathTileM", () => ({ map: rep(bathTile(), 1, 1) }));
  const zb = -d / 2 + 0.01;
  b.add(wallZ(X - w / 2, X + w / 2, 0, 1.25, zb, 0.9), tile, undefined, false);
  b.add(wallX(-d / 2, d / 2, 0, 1.25, X - w / 2 + 0.01, 0.9), tile, undefined, false);
  b.add(wallX(-d / 2, d / 2, 0, 1.25, X + w / 2 - 0.01, 0.9, true), tile, undefined, false);
  b.add(B(X - w / 2, 1.25, zb, X + w / 2, 1.29, zb + 0.04), lam("trim", () => ({ color: "#f4efe4" })));
  // toilet: bowl, seat ring, raised lid, tank, water
  const china = lam("china", () => ({ color: "#f7f4ee" })), [tx, , tz] = TOILET;
  b.add(cyl(0.15, 0.2, 0.38, 24), china, At(tx, 0, tz));
  const ring = new THREE.TorusGeometry(0.17, 0.035, 10, 28); ring.rotateX(Math.PI / 2); b.add(ring, lam("seat", () => ({ color: "#fbfaf6" })), At(tx, 0.41, tz));
  b.add(new THREE.CircleGeometry(0.14, 24).rotateX(-Math.PI / 2), lam("bowlWater", () => ({ color: "#7fb8d8" })), At(tx, 0.36, tz), false);
  b.add(B(tx - 0.2, 0.42, -d / 2 + 0.2, tx + 0.2, 0.8, -d / 2 + 0.24), lam("seat", () => ({ color: "#fbfaf6" }))); // raised lid
  b.add(B(tx - 0.22, 0.4, -d / 2 + 0.02, tx + 0.22, 0.82, -d / 2 + 0.2), china);
  b.add(B(tx - 0.24, 0.82, -d / 2 + 0.01, tx + 0.24, 0.85, -d / 2 + 0.21), china);
  b.add(B(tx + 0.12, 0.74, -d / 2 + 0.2, tx + 0.18, 0.77, -d / 2 + 0.23), lam("chrome", () => ({ color: "#c9ced8" })));
  // sink on a pedestal, tap, mirror
  const sx = X - 0.75;
  b.add(cyl(0.08, 0.1, 0.78, 16), china, At(sx, 0, -d / 2 + 0.3));
  b.add(B(sx - 0.3, 0.78, -d / 2 + 0.02, sx + 0.3, 0.9, -d / 2 + 0.48), china);
  b.add(B(sx - 0.22, 0.86, -d / 2 + 0.1, sx + 0.22, 0.905, -d / 2 + 0.42), lam("basin", () => ({ color: "#d9e6ec" })));
  b.add(cyl(0.02, 0.02, 0.14, 10), lam("chrome", () => ({ color: "#c9ced8" })), At(sx, 0.9, -d / 2 + 0.08));
  b.add(B(sx - 0.015, 1.02, -d / 2 + 0.06, sx + 0.015, 1.04, -d / 2 + 0.18), lam("chrome", () => ({ color: "#c9ced8" })));
  b.add(quad(V(sx - 0.32, 1.35, zb + 0.02), V(sx + 0.32, 1.35, zb + 0.02), V(sx + 0.32, 2.0, zb + 0.02), V(sx - 0.32, 2.0, zb + 0.02)), glow("mirror", "#cfe2f0", 0.95));
  b.add(B(sx - 0.36, 1.31, zb, sx + 0.36, 1.35, zb + 0.06), lam("trim", () => ({ color: "#f4efe4" })));
  // towel bar + towel on the right wall, bath mat, a shelf with bottles, a plant
  const rx = X + w / 2 - 0.02;
  b.add(B(rx - 0.04, 1.0, -0.3, rx, 1.03, 0.5), lam("chrome", () => ({ color: "#c9ced8" })));
  b.add(B(rx - 0.07, 0.55, -0.22, rx - 0.03, 1.03, 0.42), lam("towel", () => ({ color: "#f2a0a8" })));
  b.add(B(X - 0.3, 0.0, -0.35, X + 0.3, 0.012, 0.15), lam("mat", () => ({ color: "#7fb8a8" })), undefined, false);
  b.add(B(X + w / 2 - 0.25, 1.45, -0.9, X + w / 2, 1.48, -0.1), lam("shelf", () => ({ color: "#b98a5a" })));
  for (let i = 0; i < 4; i++) b.add(cyl(0.035, 0.035, 0.14 + 0.04 * (i % 2), 10), lam("bottle" + (i % 3), () => ({ color: ["#3a64b8", "#f2c43a", "#4f9a6e"][i % 3] })), At(X + w / 2 - 0.12, 1.48, -0.8 + i * 0.18));
  b.add(cyl(0.11, 0.09, 0.2, 12), lam("pot", () => ({ color: "#c96a3a" })), At(X - w / 2 + 0.25, 0, -d / 2 + 0.25));
  for (let i = 0; i < 4; i++) b.add(new THREE.SphereGeometry(0.13, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(X - w / 2 + 0.25 + 0.08 * Math.cos(i * 1.6), 0.3 + 0.08 * i, -d / 2 + 0.25 + 0.08 * Math.sin(i * 1.6)));
  // the door frame on the left wall (open doorway lit from the hall)
  b.add(B(X - w / 2 + 0.005, 0, 0.0, X - w / 2 + 0.02, 2.05, 0.95), glow("doorway", "#f6e6c8", 0.9), undefined, false);
  b.add(B(X - w / 2, 2.05, -0.05, X - w / 2 + 0.06, 2.12, 1.0), lam("trim", () => ({ color: "#f4efe4" })));
  b.build(root);
};
