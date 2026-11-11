// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { HALL, ST, LIVING, ROOM, SOFA, SEAT_H, SIDE, CONSOLE_H, DOCK, FRIDGE, SENSOR, STAGE, STAGE_Y, PEDESTAL } from "./story";

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


// ======================= the drone short's places =======================
const rugTex = () => ctex("rug", 512, 512, (g, r) => {
  g.fillStyle = "#3f8f8a"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#f2c43a"; g.lineWidth = 18; g.strokeRect(30, 30, 452, 452);
  g.strokeStyle = "#e9dcc0"; g.lineWidth = 8; g.strokeRect(62, 62, 388, 388);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
});
const sofaTex = () => ctex("sofaFab", 256, 256, (g, r) => {
  g.fillStyle = "#d9734e"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
});
const gardenTex = () => ctex("gardenWin", 1024, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#6aa0e0"); gr.addColorStop(1, "#d4e6f6"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#7fb85a"; g.fillRect(0, 360, 1024, 152);
  const cols = ["#4f8f3e", "#6aa84a", "#3f7a3a"];
  for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % 3]; g.beginPath(); g.ellipse(60 + i * 120, 330 - (i % 2) * 30, 90, 110, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "#f4efe4"; for (let x = 0; x <= 1024; x += 512) g.fillRect(x - 12, 0, 24, 512); g.fillRect(0, 0, 1024, 20); g.fillRect(0, 492, 1024, 20); g.fillRect(0, 246, 1024, 18);
});
const nightWin = () => ctex("nightWin", 1024, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#1a2350"); gr.addColorStop(1, "#33447e"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#f6f0d0"; g.beginPath(); g.arc(780, 120, 46, 0, 6.283); g.fill();
  g.fillStyle = "#26305e"; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(60 + i * 120, 330 - (i % 2) * 30, 90, 110, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "#f4efe4"; for (let x = 0; x <= 1024; x += 512) g.fillRect(x - 12, 0, 24, 512); g.fillRect(0, 0, 1024, 20); g.fillRect(0, 492, 1024, 20); g.fillRect(0, 246, 1024, 18);
});
/** the window glass: swapped by world.ts between day and night */
export const WINDOW_TEX = { day: gardenTex, night: nightWin };
export const livingWindow = { x0: LIVING - 2.25, x1: LIVING - 0.05, y0: 1.05, y1: 2.25, z: -ROOM.d / 2 + 0.012 };

/** the living room (x 0): sofa, coffee table, side table with the router, console with the dock, kitchen corner with
 *  the fridge, front door, wall clock, alarm sensor (its LED in world.ts) */
export const buildLiving = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = LIVING, { w, d, h } = ROOM, zb = -d / 2;
  room(b, X, w, d, h, lam("lvFloor", () => ({ map: rep(woodFloor(), 1, 1) })), lam("lvWall", () => ({ map: paintWall("lvWallT", "#efe0bf") })), lam("lvCeil", () => ({ color: "#f6f1e6" })), 0.9);
  const trim = lam("trim", () => ({ color: "#f4efe4" }));
  // skirting
  b.add(B(X - w / 2, 0, zb, X + w / 2, 0.1, zb + 0.02), trim);
  b.add(B(X + w / 2 - 0.02, 0, zb, X + w / 2, 0.1, d / 2), trim);
  b.add(B(X - w / 2, 0, zb, X - w / 2 + 0.02, 0.1, d / 2), trim);
  // window frame (glass quad in world.ts)
  const { x0, x1, y0, y1 } = livingWindow;
  b.add(B(x0 - 0.08, y0 - 0.1, zb, x1 + 0.08, y0, zb + 0.12), trim);
  b.add(B(x0 - 0.08, y1, zb, x1 + 0.08, y1 + 0.08, zb + 0.06), trim);
  b.add(B(x0 - 0.08, y0, zb, x0, y1, zb + 0.06), trim); b.add(B(x1, y0, zb, x1 + 0.08, y1, zb + 0.06), trim);
  // curtains
  const cur = lam("curtain", () => ({ color: "#5a7ac9" }));
  for (const cx of [x0 - 0.3, x1 + 0.3]) for (let i = 0; i < 3; i++) b.add(cyl(0.07, 0.07, 2.35, 10), cur, At(cx - 0.1 + i * 0.1, 0.05, zb + 0.12 + (i % 2) * 0.03));
  b.add(cyl(0.02, 0.02, x1 - x0 + 1.0, 8), lam("rod", () => ({ color: "#3a3440" })), At(x0 - 0.5, 2.42, zb + 0.13, 0, 0, -Math.PI / 2));
  // sofa: base, seat cushions, back, arms
  const fab = lam("sofaFabM", () => ({ map: sofaTex() })), fab2 = lam("sofaCush", () => ({ color: "#e88a62" }));
  const [sx, , sz] = SOFA, sw = 2.1;
  b.add(B(sx - sw / 2, 0.08, sz - 0.42, sx + sw / 2, 0.3, sz + 0.42), fab);
  for (let i = 0; i < 2; i++) b.add(B(sx - sw / 2 + 0.18 + i * 0.88, 0.3, sz - 0.25, sx - sw / 2 + 0.18 + (i + 1) * 0.88 - 0.03, SEAT_H, sz + 0.42), fab2);
  b.add(B(sx - sw / 2, 0.3, sz - 0.42, sx + sw / 2, 0.95, sz - 0.2), fab);
  for (const s of [-1, 1]) b.add(B(sx + s * sw / 2 - (s > 0 ? 0.18 : 0), 0.08, sz - 0.42, sx + s * sw / 2 + (s < 0 ? 0.18 : 0), 0.66, sz + 0.42), fab);
  for (const [dx, dz] of [[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]]) b.add(cyl(0.03, 0.025, 0.08, 8), lam("monBlack", () => ({ color: "#22252e" })), At(sx + dx, 0, sz + dz));
  // two throw pillows
  b.add(B(sx - 0.82, 0.42, sz - 0.2, sx - 0.42, 0.78, sz - 0.08), lam("pillowY", () => ({ color: "#f2c43a" })), At(0, 0, 0, 0, 0, 0));
  b.add(B(sx + 0.45, 0.42, sz - 0.2, sx + 0.82, 0.76, sz - 0.08), lam("pillowB", () => ({ color: "#3a64b8" })));
  // rug + coffee table with a mug and a book
  b.add(B(sx - 1.4, 0, sz + 0.45, sx + 1.4, 0.01, sz + 2.6), lam("rugM", () => ({ map: rugTex() })), undefined, false);
  const wood = lam("tableWood", () => ({ color: "#b98a5a" })), dark = lam("monBlack", () => ({ color: "#22252e" }));
  const tz = sz + 1.3;
  b.add(B(sx - 0.55, 0.38, tz - 0.3, sx + 0.55, 0.42, tz + 0.3), wood);
  for (const [dx, dz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) b.add(B(sx + dx - 0.025, 0, tz + dz - 0.025, sx + dx + 0.025, 0.38, tz + dz + 0.025), wood);
  b.add(cyl(0.04, 0.04, 0.09, 12), lam("mug", () => ({ color: "#f2c43a" })), At(sx + 0.25, 0.42, tz - 0.05));
  b.add(B(sx - 0.35, 0.42, tz - 0.1, sx - 0.05, 0.46, tz + 0.12), lam("book", () => ({ color: "#4f9a6e" })));
  // side table (router on it: world.ts) + lamp
  const [tx, , tz2] = SIDE;
  b.add(B(tx - 0.25, 0.56, tz2 - 0.25, tx + 0.25, 0.6, tz2 + 0.25), wood);
  b.add(B(tx - 0.22, 0, tz2 - 0.22, tx + 0.22, 0.56, tz2 + 0.22), lam("sideBody", () => ({ color: "#a37748" })));
  b.add(cyl(0.12, 0.17, 0.25, 16), lam("shade", () => ({ color: "#f6e7c4" })), At(tx + 0.12, 1.05, tz2 - 0.1));
  b.add(cyl(0.015, 0.015, 0.45, 8), dark, At(tx + 0.12, 0.6, tz2 - 0.1));
  // router body (antennas)
  b.add(B(tx - 0.16, 0.6, tz2 - 0.06, tx + 0.04, 0.65, tz2 + 0.08), lam("router", () => ({ color: "#f4f1ea" })));
  for (const ax of [-0.13, 0.01]) b.add(cyl(0.008, 0.008, 0.16, 6), dark, At(tx + ax, 0.65, tz2 - 0.04));
  // console with the dock + a plant + framed art; the wall clock above it
  const [dx0, , dz0] = DOCK;
  b.add(B(dx0 - 0.75, CONSOLE_H - 0.04, dz0 - 0.22, dx0 + 0.75, CONSOLE_H, dz0 + 0.22), wood);
  for (const ex of [-0.7, 0.7]) b.add(B(dx0 + ex - 0.03, 0, dz0 - 0.2, dx0 + ex + 0.03, CONSOLE_H - 0.04, dz0 + 0.2), dark);
  b.add(B(dx0 - 0.72, 0.25, dz0 - 0.2, dx0 + 0.72, 0.28, dz0 + 0.2), wood);
  // the dock: a round pad on a little base
  b.add(cyl(0.27, 0.27, 0.02, 32), lam("dockBase", () => ({ color: "#2b2f3a" })), At(dx0, CONSOLE_H, dz0));
  b.add(cyl(0.23, 0.23, 0.015, 32), lam("dockPad", () => ({ color: "#e9edf2" })), At(dx0, CONSOLE_H + 0.02, dz0));
  b.add(cyl(0.11, 0.09, 0.2, 12), lam("pot", () => ({ color: "#c96a3a" })), At(dx0 + 0.6, CONSOLE_H, dz0));
  for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.11, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(dx0 + 0.6 + 0.07 * Math.cos(i * 1.4), CONSOLE_H + 0.27 + 0.06 * i, dz0 + 0.07 * Math.sin(i * 1.4)));
  const art = artTex("lvArt", "#f2c43a", "#9ac8e8", "#4f9a6e");
  b.add(quad(V(dx0 - 0.55, 1.35, zb + 0.015), V(dx0 - 0.05, 1.35, zb + 0.015), V(dx0 - 0.05, 1.98, zb + 0.015), V(dx0 - 0.55, 1.98, zb + 0.015)), lam("lvArtM", () => ({ map: art })));
  const clockT = ctex("clockFace", 256, 256, (g) => {
    g.fillStyle = "#fbfaf4"; g.beginPath(); g.arc(128, 128, 120, 0, 6.283); g.fill();
    g.strokeStyle = "#241726"; g.lineWidth = 14; g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = 8; g.beginPath(); g.moveTo(128 + 88 * Math.cos(a), 128 + 88 * Math.sin(a)); g.lineTo(128 + 104 * Math.cos(a), 128 + 104 * Math.sin(a)); g.stroke(); }
  });
  b.add(new THREE.CircleGeometry(0.2, 32), lam("clockM", () => ({ map: clockT })), At(dx0 + 0.3, 1.75, zb + 0.02), false);
  // kitchen corner: counter + fridge (door + interior glow in world.ts)
  const [fx, , fz] = FRIDGE;
  b.add(B(fx - 0.38, 0, fz - 0.4, fx + 0.38, 1.85, fz + 0.32), lam("fridge", () => ({ color: "#dfe6ec" })));
  b.add(B(fx + 0.38, 0, zb + 0.02, fx + 1.55, 0.9, zb + 0.62), lam("counter", () => ({ color: "#7b8aa8" })));
  b.add(B(fx + 0.36, 0.9, zb + 0.0, fx + 1.58, 0.94, zb + 0.66), lam("counterTop", () => ({ color: "#efe9dc" })));
  // front door on the right wall, the alarm sensor beside it (LED in world.ts)
  const xr = X + w / 2 - 0.01;
  b.add(B(xr - 0.04, 0, -0.6, xr, 2.1, 0.45), lam("frontDoor", () => ({ color: "#3a64b8" })));
  b.add(B(xr - 0.08, 2.1, -0.68, xr, 2.18, 0.53), trim); b.add(B(xr - 0.08, 0, -0.68, xr, 2.18, -0.6), trim); b.add(B(xr - 0.08, 0, 0.45, xr, 2.18, 0.53), trim);
  b.add(cyl(0.035, 0.035, 0.06, 12), lam("chrome", () => ({ color: "#c9ced8" })), At(xr - 0.07, 1.0, 0.3, 0, 0, Math.PI / 2));
  b.add(B(SENSOR[0] - 0.06, SENSOR[1] - 0.08, SENSOR[2] - 0.03, SENSOR[0] + 0.06, SENSOR[1] + 0.08, SENSOR[2] + 0.04), lam("sensor", () => ({ color: "#f4f1ea" })));
  // floor lamp in the left corner, ceiling lamp
  b.add(cyl(0.16, 0.16, 0.03, 16), dark, At(X - 3.1, 0, -0.6)); b.add(cyl(0.02, 0.02, 1.5, 8), dark, At(X - 3.1, 0, -0.6));
  b.add(cyl(0.16, 0.24, 0.3, 16), lam("shade", () => ({ color: "#f6e7c4" })), At(X - 3.1, 1.45, -0.6));
  b.add(cyl(0.25, 0.1, 0.16, 16), glow("lvLamp", "#fff2d0", 1.5), At(X, h - 0.18, -0.6), false);
  b.build(root);
};

/** the 2020 keynote stage (x + 400): platform, big backdrop screen (picture in world.ts), pedestal, spotlights */
export const STAGE_SCREEN = { x: STAGE, y: 2.35, z: -2.95, w: 6.0, h: 3.0 };
export const buildStage = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = STAGE;
  room(b, X, 14, 14, 6, lam("audFloor", () => ({ color: "#3a3550" })), lam("audWall", () => ({ color: "#2a2742" })), lam("audCeil", () => ({ color: "#1e1c30" })), 2);
  const deck = lam("stageDeck", () => ({ color: "#4a4466" })), edge = lam("stageEdge", () => ({ color: "#26233a" }));
  b.add(B(X - 4.5, 0, -3, X + 4.5, STAGE_Y, 0.6), deck);
  b.add(B(X - 4.5, STAGE_Y - 0.06, 0.58, X + 4.5, STAGE_Y, 0.64), lam("stageLip", () => ({ color: "#7ff6ff" })));
  b.add(B(X - 4.5, 0, 0.6, X + 4.5, STAGE_Y - 0.06, 0.62), edge);
  // screen frame
  const s = STAGE_SCREEN;
  b.add(B(s.x - s.w / 2 - 0.08, s.y - s.h / 2 - 0.08, s.z - 0.06, s.x + s.w / 2 + 0.08, s.y + s.h / 2 + 0.08, s.z - 0.01), lam("monBlack", () => ({ color: "#22252e" })));
  // pedestal under the hovering drone
  const [px, py, pz] = PEDESTAL;
  b.add(cyl(0.32, 0.26, 0.85, 24), lam("pedestal", () => ({ color: "#f4f1ea" })), At(px, py, pz));
  b.add(cyl(0.36, 0.36, 0.05, 24), lam("pedTop", () => ({ color: "#7ff6ff" })), At(px, py + 0.85, pz));
  // lighting truss + cans
  b.add(B(X - 5, 4.6, -1.0, X + 5, 4.72, -0.88), edge);
  for (let i = -3; i <= 3; i++) b.add(cyl(0.12, 0.09, 0.25, 12), edge, At(X + i * 1.3, 4.35, -0.94));
  b.add(new THREE.CircleGeometry(1.1, 40).rotateX(-Math.PI / 2), glow("spotPool", "#fff3d6", 0.55), At(px - 0.2, STAGE_Y + 0.005, pz + 0.35), false);
  b.add(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), glow("spotPool2", "#fff3d6", 0.5), At(X - 0.62, STAGE_Y + 0.005, -0.75), false);
  b.build(root);
};
