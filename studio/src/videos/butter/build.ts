// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { BENCH, CHIPX, CHIPZ, PCB_H, CHIP_H } from "./story";

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

// ======================= the butter short's lab =======================
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


void asphaltTex; void wallpaperTex; void runnerTex; void artTex; void bathTile; void floorCheck; void woodFloor; void tree; void hill; void concreteTex; void tiles; void T; void floorQ;

/** a green circuit board texture (traces + pads), 512 x 384 */
const pcbTex = () => ctex("pcb", 512, 384, (g, r) => {
  g.fillStyle = "#3f8a52"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#7cc48a"; g.lineWidth = 6; g.lineCap = "round";
  for (let i = 0; i < 26; i++) { const x = r() * 512, y = r() * 384, l = 40 + r() * 120; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() > 0.5 ? l : 0), y + (r() > 0.5 ? 0 : l)); g.stroke(); }
  g.fillStyle = "#e8c45a"; for (let i = 0; i < 40; i++) g.fillRect(r() * 500, r() * 372, 10, 10);
  g.strokeStyle = "rgba(20,40,26,0.9)"; g.lineWidth = 10; g.strokeRect(5, 5, 502, 374);
});
const chipTex = () => ctex("chipTop", 256, 256, (g) => {
  g.fillStyle = "#2a2d36"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#3a3e4a"; g.fillRect(30, 30, 196, 196);
  g.fillStyle = "#c9ced8"; g.beginPath(); g.arc(56, 56, 12, 0, 6.283); g.fill();
});
const pegTex = () => ctex("pegboard", 512, 512, (g) => {
  g.fillStyle = "#c9a57a"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(60,40,30,0.55)"; for (let x = 16; x < 512; x += 32) for (let y = 16; y < 512; y += 32) { g.beginPath(); g.arc(x, y, 4, 0, 6.283); g.fill(); }
});
const butterBoxTex = () => ctex("butterBox", 256, 128, (g) => {
  g.fillStyle = "#f6e9b0"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#3a64b8"; g.fillRect(0, 0, 256, 26); g.fillRect(0, 102, 256, 26);
  g.fillStyle = "#f2c43a"; g.beginPath(); g.ellipse(128, 64, 52, 26, 0, 0, 6.283); g.fill();
});

/** the chip lab (x 0): long workbench with four AI chip boards, pegboard wall, shelves, window, a fridge */
export const buildLab = (root: THREE.Object3D) => {
  const b = new Batch();
  const W_ = 7, D = 6, H = 3;
  room(b, 0, W_, D, H, lam("labFloor", () => ({ map: rep(slabTex(), 1, 1) })), lam("labWall", () => ({ map: paintWall("labWallT", "#dfe6e2", "#8fb0a4") })), lam("labCeil", () => ({ color: "#eef0f3" })), 1.2);
  const zb = -D / 2 + 0.01;
  // bench: top, thick skirt in front (hides the legs of the people behind), legs
  const top = lam("benchTop", () => ({ color: "#e9e2d2" })), skirt = lam("benchSkirt", () => ({ color: "#5b6f8f" })), dark = lam("benchDark", () => ({ color: "#2f3440" }));
  b.add(B(BENCH.x0, BENCH.h - 0.05, BENCH.z0, BENCH.x1, BENCH.h, BENCH.z1), top);
  b.add(B(BENCH.x0, 0.0, BENCH.z1 - 0.06, BENCH.x1, BENCH.h - 0.05, BENCH.z1 - 0.02), skirt);
  b.add(B(BENCH.x0, 0.0, BENCH.z0 + 0.02, BENCH.x1, BENCH.h - 0.05, BENCH.z0 + 0.06), skirt);
  for (const x of [BENCH.x0, BENCH.x1 - 0.04]) b.add(B(x, 0, BENCH.z0 + 0.02, x + 0.04, BENCH.h - 0.05, BENCH.z1 - 0.02), skirt);
  for (let i = 0; i < 4; i++) b.add(B(-1.6 + i * 0.95, 0.35, BENCH.z1 - 0.021, -1.0 + i * 0.95, 0.52, BENCH.z1 - 0.015), lam("drawer", () => ({ color: "#7088aa" })));
  // chip boards: green PCB, black chip, two rows of pins, a corner LED (lit in world.ts)
  const pcb = lam("pcbM", () => ({ map: pcbTex() })), chip = lam("chipM", () => ({ map: chipTex() })), pin = lam("pinM", () => ({ color: "#c9ced8" }));
  for (const x of CHIPX) {
    b.add(B(x - 0.19, BENCH.h, CHIPZ - 0.14, x + 0.19, BENCH.h + PCB_H, CHIPZ + 0.14), pcb);
    b.add(B(x - 0.075, BENCH.h + PCB_H, CHIPZ - 0.075, x + 0.075, BENCH.h + PCB_H + CHIP_H, CHIPZ + 0.075), chip);
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) b.add(B(x - 0.06 + k * 0.024, BENCH.h + PCB_H, CHIPZ + s * 0.075 - 0.006, x - 0.05 + k * 0.024, BENCH.h + PCB_H + 0.01, CHIPZ + s * 0.075 + 0.006), pin);
    // a little cable to the back of the bench
    b.add(B(x - 0.012, BENCH.h, CHIPZ - 0.34, x + 0.012, BENCH.h + 0.012, CHIPZ - 0.14), dark);
  }
  // the butter box + a plate with a knife at the left end of the bench, a big start button at the right end
  b.add(B(-1.62, BENCH.h, -0.78, -1.36, BENCH.h + 0.08, -0.62), lam("butterBoxM", () => ({ map: butterBoxTex() })));
  b.add(cyl(0.11, 0.12, 0.012, 24), lam("plate", () => ({ color: "#fbfaf6" })), At(-1.42, BENCH.h, -0.47));
  b.add(B(1.38, BENCH.h, -0.62, 1.6, BENCH.h + 0.05, -0.44), dark);
  b.add(cyl(0.06, 0.065, 0.035, 20), lam("redBtn", () => ({ color: "#e8483c" })), At(1.49, BENCH.h + 0.05, -0.53));
  // back wall: pegboard with tools, two shelves with parts bins, a window with the city
  b.add(quad(V(-2.9, 1.15, zb + 0.01), V(-0.6, 1.15, zb + 0.01), V(-0.6, 2.4, zb + 0.01), V(-2.9, 2.4, zb + 0.01)), lam("pegM", () => ({ map: pegTex() })));
  const tool = [lam("tA", () => ({ color: "#e8483c" })), lam("tB", () => ({ color: "#3a64b8" })), lam("tC", () => ({ color: "#f2c43a" }))];
  for (let i = 0; i < 6; i++) b.add(B(-2.7 + i * 0.36, 1.45 + 0.25 * (i % 2), zb + 0.02, -2.62 + i * 0.36, 1.9 + 0.25 * (i % 2), zb + 0.05), tool[i % 3]);
  b.add(quad(V(0.2, 1.1, zb + 0.01), V(2.8, 1.1, zb + 0.01), V(2.8, 2.5, zb + 0.01), V(0.2, 2.5, zb + 0.01)), glow("labWin", "#ffffff", 1.0, cityTex()));
  const shelf = lam("shelf", () => ({ color: "#b98a5a" })), bin = [lam("binA", () => ({ color: "#4f9a6e" })), lam("binB", () => ({ color: "#f2a03a" })), lam("binC", () => ({ color: "#7b5ac9" }))];
  for (const y of [1.05, 1.6]) {
    b.add(B(W_ / 2 - 0.4, y, -2.2, W_ / 2 - 0.01, y + 0.04, 0.6), shelf);
    for (let i = 0; i < 4; i++) b.add(B(W_ / 2 - 0.36, y + 0.04, -2.0 + i * 0.66, W_ / 2 - 0.06, y + 0.26, -1.55 + i * 0.66), bin[(i + (y > 1.2 ? 1 : 0)) % 3]);
  }
  // a fridge in the left corner (where the butter lives), a plant, ceiling panels
  b.add(B(-W_ / 2 + 0.02, 0, -2.9, -W_ / 2 + 0.75, 1.85, -2.2), lam("fridge", () => ({ color: "#f4f1ea" })));
  b.add(B(-W_ / 2 + 0.7, 0.95, -2.25, -W_ / 2 + 0.74, 1.45, -2.19), dark);
  b.add(cyl(0.2, 0.16, 0.38, 14), lam("pot", () => ({ color: "#c96a3a" })), At(2.9, 0, -2.6));
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.26, 10, 8), lam("leafB", () => ({ color: "#6aa84a" })), At(2.9 + 0.18 * Math.cos(i * 1.3), 0.6 + 0.15 * i, -2.6 + 0.18 * Math.sin(i * 1.3)));
  for (const x of [-2.0, 0, 2.0]) b.add(B(x - 0.6, 2.98, -1.4, x + 0.6, 2.995, -0.6), glow("panelLight", "#fff6e0", 1.15), undefined, false);
  b.build(root);
};
