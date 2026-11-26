// The places of the AI-Christmas-market short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit,
// inked by the world ink pass): the bare warehouse HALL (5 lonely huts, buckets under a leaky roof, the AI banner) and
// the DREAM market of the ad (snowy plaza, glowing huts, fairy-light garlands, a giant tree) at x + DREAM_X.
// Static geometry is merged per material; moving parts (shutters, drips, lights, snow) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, rep, water, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { HALL, HUTS, BUCKETS, DREAM_X, DREAM_HUTS, TREE, Hut } from "./story";

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

void rep; void floorQ;

// ======================= textures =======================
const hallFloorTex = () => ctex("hallFloor", 1024, 1024, (g, r) => {
  g.fillStyle = "#9c9a96"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 60; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(40,36,40,0.06)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 60 + r() * 160, 30 + r() * 90, r() * 3, 0, 6.283); g.fill(); }
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 1024, r() * 1024, 3, 3); }
  // oil / damp stains
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(60,56,62,0.10)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 40 + r() * 70, 25 + r() * 40, r() * 3, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(50,44,52,0.55)"; g.lineWidth = 5; g.strokeRect(0, 0, 1024, 1024); // slab joints every 4 m
});
const blockTex = () => ctex("hallBlock", 512, 512, (g, r) => {
  const bw = 128, bh = 64;
  for (let y = 0; y < 512; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < 512; x += bw) { g.fillStyle = jit(r, "#a7a6a2", 0.05, 2, 0.1); g.fillRect(x, y, bw, bh); }
  g.strokeStyle = "rgba(55,50,58,0.5)"; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += bh) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  for (let y = 0; y < 512; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < 512; x += bw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
});
/** corrugated metal: vertical ribs (u along the wall) */
const corrugTex = (key: string, base: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(20,20,30,0.16)"); g.fillStyle = gr; g.fillRect(x, 0, 32, 512); }
  for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(90,70,50,0.07)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 50 + r() * 120, 0, 0, 6.283); g.fill(); } // rust / damp streaks
});
const woodTex = (key: string, base: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = jit(r, base, 0.07, 3, 0.1); g.fillRect(x, 0, 64, 512); }
  g.fillStyle = "rgba(45,25,20,0.55)"; for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 4, 512);
  for (let i = 0; i < 40; i++) { g.strokeStyle = "rgba(60,35,25,0.12)"; g.lineWidth = 2; const x = r() * 512; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, 170, x - 8, 340, x + 4, 512); g.stroke(); }
});
const snowTex = () => ctex("snow", 1024, 1024, (g, r) => {
  g.fillStyle = "#eef3fb"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 80; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.4)" : "rgba(150,170,215,0.10)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 60 + r() * 140, 30 + r() * 70, r() * 3, 0, 6.283); g.fill(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(r() * 1024, r() * 1024, 2, 2); }
});
/** the hut's opening seen from outside: dream = warm lit shelves of goods; bare = dim, almost empty shelves */
export const hutInsideTex = (dream: boolean) => ctex(dream ? "hutInDream" : "hutInBare", 512, 256, (g, r) => {
  if (dream) { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#ffe7a8"); gr.addColorStop(1, "#ffb860"); g.fillStyle = gr; }
  else g.fillStyle = "#5a4a44";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = dream ? "#b06a36" : "#3c302c"; g.fillRect(0, 96, 512, 10); g.fillRect(0, 186, 512, 10); // shelves
  const goods = dream ? ["#d83a3a", "#2f8f4a", "#f2c22a", "#3a6ad8", "#e8743a", "#c25a9a"] : ["#8a7a6a"];
  const n = dream ? 14 : 2;
  for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) {
    const x = dream ? 20 + i * 35 + r() * 6 : 120 + i * 230, y = s ? 186 : 96, h = 26 + r() * 30, w = 22 + r() * 8;
    g.fillStyle = goods[Math.floor(r() * goods.length)]; g.strokeStyle = "rgba(40,24,30,0.8)"; g.lineWidth = 3;
    if (r() > 0.5) { g.beginPath(); g.arc(x + w / 2, y - w / 2, w / 2, 0, 6.283); g.fill(); g.stroke(); } else { g.fillRect(x, y - h, w, h); g.strokeRect(x, y - h, w, h); }
  }
});
/** the roll-down shutter of a bare hut */
export const shutterTex = () => ctex("shutter", 256, 256, (g) => {
  g.fillStyle = "#4f5f86"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 22) { g.fillStyle = "rgba(20,20,40,0.45)"; g.fillRect(0, y, 256, 4); g.fillStyle = "rgba(200,215,255,0.35)"; g.fillRect(0, y + 5, 256, 4); }
  g.fillStyle = "#c9a23a"; g.fillRect(0, 236, 256, 20);
});

// ======================= the hut (both places) =======================
/** a little wooden market chalet at (x, z), opening on its local +z, rotated ry. Dream: snow on the roof, a lit inside,
 *  garland edges (world.ts adds the bulbs). Bare: plain pale wood, a dim inside, a few jars. */
const hut = (b: Batch, h: Hut, dream: boolean) => {
  const W2 = HUT.w / 2, D2 = HUT.d / 2, H = HUT.h, R = HUT.ridge;
  const M = T(h.x, 0, h.z, h.ry);
  const wall = lam(dream ? "hutWallD" : "hutWallB", () => ({ map: woodTex(dream ? "woodD" : "woodB", dream ? "#b5733f" : "#c9a87e") }));
  const trim = lam(dream ? "hutTrimD" : "hutTrimB", () => ({ color: dream ? "#7a3f22" : "#9a8064" }));
  const roofM = lam(dream ? "hutRoofD" : "hutRoofB", () => ({ map: roofHD(dream ? "#7a4a36" : "#8a7a70") }));
  // body: back + sides full height; front: low counter wall + header above the opening
  b.add(B(-W2, 0, -D2, W2, H, -D2 + 0.08), wall, M);
  b.add(B(-W2, 0, -D2, -W2 + 0.08, H, D2), wall, M);
  b.add(B(W2 - 0.08, 0, -D2, W2, H, D2), wall, M);
  b.add(B(-W2, 0, D2 - 0.08, W2, HUT.sill, D2), wall, M);
  b.add(B(-W2, HUT.top, D2 - 0.08, W2, H, D2), wall, M);
  b.add(B(-W2, 0.02, -D2, W2, 0.06, D2), trim, M, false);
  // counter board + posts
  b.add(B(-W2 - 0.05, HUT.sill, D2 - 0.1, W2 + 0.05, HUT.sill + 0.06, D2 + 0.32), trim, M);
  b.add(B(-W2, HUT.sill, D2 - 0.12, -W2 + 0.1, HUT.top, D2), trim, M);
  b.add(B(W2 - 0.1, HUT.sill, D2 - 0.12, W2, HUT.top, D2), trim, M);
  // the inside seen through the opening (a panel set back 0.6 m)
  const inside = dream ? glow("hutInD", "#ffffff", 1.35, hutInsideTex(true)) : lam("hutInB", () => ({ map: hutInsideTex(false) }));
  b.add(quad(V(-W2 + 0.08, HUT.sill, -D2 + 0.6), V(W2 - 0.08, HUT.sill, -D2 + 0.6), V(W2 - 0.08, HUT.top, -D2 + 0.6), V(-W2 + 0.08, HUT.top, -D2 + 0.6)), inside, M, false);
  const dark = lam("hutDark", () => ({ color: dream ? "#4a2a1a" : "#3a2e2a" }));
  b.add(quad(V(-W2 + 0.08, HUT.sill, D2 - 0.08), V(W2 - 0.08, HUT.sill, D2 - 0.08), V(W2 - 0.08, HUT.sill, -D2 + 0.6), V(-W2 + 0.08, HUT.sill, -D2 + 0.6)), dark, M, false);
  // gables + roof (ridge along local z, overhang at the front)
  const gab = (z: number, flip: boolean) => {
    const gb = new THREE.BufferGeometry();
    const pts = flip ? [W2, H, z, -W2, H, z, 0, R, z] : [-W2, H, z, W2, H, z, 0, R, z];
    gb.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); gb.computeVertexNormals();
    gb.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.4], 2));
    return gb;
  };
  b.add(gab(D2, false), wall, M); b.add(gab(-D2, true), wall, M);
  const o = 0.28, of = 0.45;
  b.add(quad(V(-W2 - o, H - 0.15, D2 + of), V(0, R, D2 + of), V(0, R, -D2 - o), V(-W2 - o, H - 0.15, -D2 - o), 1, 1), roofM, M);
  b.add(quad(V(0, R, D2 + of), V(W2 + o, H - 0.15, D2 + of), V(W2 + o, H - 0.15, -D2 - o), V(0, R, -D2 - o), 1, 1), roofM, M);
  // roof thickness at the front edge
  b.add(B(-0.05, R - 0.08, -D2 - o, 0.05, R + 0.04, D2 + of), trim, M);
  if (dream) {
    const snow = lam("snowM", () => ({ map: snowTex() }));
    const sl = Math.atan2(R - H + 0.15, W2 + o);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(Math.hypot(W2 + o, R - H + 0.15) + 0.05, 0.14, HUT.d + o + of + 0.08);
      b.add(g, snow, M.clone().multiply(At(s * (W2 + o) / 2, (H - 0.15 + R) / 2 + 0.1, (of - o) / 2, 0, 0, -s * sl)));
    }
  } else {
    // a couple of sad jars on the counter
    const jar = lam("jar", () => ({ color: "#d8c9a0" })), lid = lam("jarLid", () => ({ color: "#c0453a" }));
    for (const jx of [-0.5, 0.55]) { b.add(cyl(0.07, 0.07, 0.16, 12), jar, M.clone().multiply(At(jx, HUT.sill + 0.06, D2 + 0.12))); b.add(cyl(0.075, 0.075, 0.04, 12), lid, M.clone().multiply(At(jx, HUT.sill + 0.22, D2 + 0.12))); }
  }
};
export const HUT = { w: 2.5, d: 1.9, h: 2.35, ridge: 3.25, sill: 0.95, top: 2.05 };
/** world point of a hut-local point */
export const hutPt = (h: Hut, lx: number, ly: number, lz: number): [number, number, number] =>
  [h.x + lx * Math.cos(h.ry) + lz * Math.sin(h.ry), ly, h.z - lx * Math.sin(h.ry) + lz * Math.cos(h.ry)];

// ======================= the warehouse hall =======================
export const BANNER = { x: 0, y0: 2.9, w: 7.2, h: 4.05 }; // on the back wall (z = HALL.z0 + 0.06)
export const buildHall = (root: THREE.Object3D) => {
  const b = new Batch();
  const { x0, x1, z0, z1, eave, ridge } = HALL;
  const floor = lam("hallFloorM", () => ({ map: hallFloorTex() }));
  b.add(quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(x0, 0, z0), (x1 - x0) / 4, (z1 - z0) / 4), floor, undefined, false);
  const block = lam("hallBlockM", () => ({ map: blockTex() }));
  const metal = lam("hallMetal", () => ({ map: corrugTex("corrWall", "#9aa49e") }));
  const roofIn = lam("hallRoofIn", () => ({ map: corrugTex("corrRoof", "#8c8f96"), side: THREE.DoubleSide }));
  const steel = lam("hallSteel", () => ({ color: "#4a5262" }));
  // walls: 1.6 m block plinth + corrugated metal above (all faces point in)
  const pl = 1.6;
  b.add(wallZ(x0, x1, 0, pl, z0, 2), block, undefined, false); b.add(wallZ(x0, x1, pl, eave, z0, 3), metal, undefined, false);
  b.add(wallZ(x0, x1, 0, pl, z1, 2, true), block, undefined, false); b.add(wallZ(x0, x1, pl, eave, z1, 3, true), metal, undefined, false);
  b.add(wallX(z0, z1, 0, pl, x0, 2), block, undefined, false); b.add(wallX(z0, z1, pl, eave, x0, 3), metal, undefined, false);
  b.add(wallX(z0, z1, 0, pl, x1, 2, true), block, undefined, false); b.add(wallX(z0, z1, pl, eave, x1, 3, true), metal, undefined, false);
  // gable triangles front/back
  for (const [z, flip] of [[z0, false], [z1, true]] as [number, boolean][]) {
    const gb = new THREE.BufferGeometry();
    const pts = flip ? [x1, eave, z, x0, eave, z, 0, ridge, z] : [x0, eave, z, x1, eave, z, 0, ridge, z];
    gb.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); gb.computeVertexNormals();
    gb.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, (x1 - x0) / 3, 0, (x1 - x0) / 6, (ridge - eave) / 3], 2));
    b.add(gb, metal, undefined, false);
  }
  // roof underside (two slopes)
  b.add(quad(V(x0, eave, z1), V(0, ridge, z1), V(0, ridge, z0), V(x0, eave, z0), 5, (z1 - z0) / 3), roofIn, undefined, false);
  b.add(quad(V(0, ridge, z1), V(x1, eave, z1), V(x1, eave, z0), V(0, ridge, z0), 5, (z1 - z0) / 3), roofIn, undefined, false);
  // steel portal frames every 5 m: columns at the walls, a tie beam at eave height, rafters to the ridge
  for (let z = z0 + 2.5; z < z1; z += 5) {
    for (const x of [x0 + 0.15, x1 - 0.15]) b.add(B(x - 0.15, 0, z - 0.12, x + 0.15, eave, z + 0.12), steel);
    b.add(B(x0, eave - 0.3, z - 0.08, x1, eave - 0.1, z + 0.08), steel);
    for (const s of [-1, 1]) {
      const L = Math.hypot(HALL.x1, ridge - eave), a = Math.atan2(ridge - eave, HALL.x1);
      b.add(new THREE.BoxGeometry(L, 0.26, 0.16), steel, At((s * HALL.x1) / 2, (eave + ridge) / 2 - 0.2, z, 0, 0, -s * a));
    }
    b.add(B(-0.06, eave - 0.1, z - 0.05, 0.06, ridge - 0.2, z + 0.05), steel); // king post
  }
  // fluorescent tube fittings hanging below the tie beams (glow tubes in world.ts)
  const fit = lam("fitting", () => ({ color: "#d8dce2" }));
  for (const t of TUBES) b.add(B(t[0] - 0.75, t[1] + 0.05, t[2] - 0.09, t[0] + 0.75, t[1] + 0.14, t[2] + 0.09), fit);
  // high strip windows on the side walls (dull overcast daylight)
  const win = glow("hallWin", "#c8d4e0", 1.05);
  for (let z = z0 + 3; z < z1 - 2; z += 5) {
    b.add(quad(V(x0 + 0.03, 4.3, z + 1.6), V(x0 + 0.03, 4.3, z - 1.6), V(x0 + 0.03, 5.2, z - 1.6), V(x0 + 0.03, 5.2, z + 1.6)), win, undefined, false);
    b.add(quad(V(x1 - 0.03, 4.3, z - 1.6), V(x1 - 0.03, 4.3, z + 1.6), V(x1 - 0.03, 5.2, z + 1.6), V(x1 - 0.03, 5.2, z - 1.6)), win, undefined, false);
  }
  // a big roller door on the right wall + a fire door on the left
  const roller = lam("roller", () => ({ map: corrugTex("rollerT", "#c7b47a") }));
  b.add(quad(V(x1 - 0.04, 0, -4), V(x1 - 0.04, 0, 1), V(x1 - 0.04, 4, 1), V(x1 - 0.04, 4, -4), 2, 1), roller, undefined, false);
  b.add(quad(V(x0 + 0.04, 0, -12), V(x0 + 0.04, 0, -13.2), V(x0 + 0.04, 2.2, -13.2), V(x0 + 0.04, 2.2, -12)), lam("fireDoor", () => ({ color: "#3f7a5a" })), undefined, false);
  // banner frame (the image itself is a world.ts mesh)
  const bx0 = BANNER.x - BANNER.w / 2 - 0.12, bx1 = BANNER.x + BANNER.w / 2 + 0.12;
  b.add(B(bx0, BANNER.y0 - 0.12, z0, bx1, BANNER.y0 + BANNER.h + 0.12, z0 + 0.05), lam("bannerBack", () => ({ color: "#2a2630" })), undefined, false);
  // pallets, a stack of plastic chairs, a folded table: warehouse clutter by the walls
  const pal = lam("pallet", () => ({ color: "#b8955e" }));
  for (const [px, pz, n] of [[-12.4, -19.5, 3], [12.2, -20.2, 2], [-12.6, -2.5, 1]] as [number, number, number][])
    for (let i = 0; i < n; i++) { b.add(B(px - 0.6, i * 0.15, pz - 0.5, px + 0.6, i * 0.15 + 0.12, pz + 0.5), pal); }
  const chair = lam("chairs", () => ({ color: "#d7d2c8" }));
  b.add(B(11.6, 0, -9.4, 12.1, 1.5, -8.9), chair);
  // the five lonely huts
  for (const h of HUTS) hut(b, h, false);
  // the buckets (water discs + drips are world.ts)
  for (const bk of BUCKETS) {
    const col = lam("bucket" + bk.col, () => ({ color: bk.col }));
    const g = new THREE.CylinderGeometry(0.2, 0.15, 0.34, 20, 1, true); g.translate(0, 0.17, 0);
    b.add(g, lam("bucketIn" + bk.col, () => ({ color: bk.col, side: THREE.DoubleSide })), At(bk.x, 0, bk.z));
    b.add(new THREE.TorusGeometry(0.2, 0.015, 6, 24), col, At(bk.x, 0.34, bk.z, Math.PI / 2));
    b.add(new THREE.CircleGeometry(0.15, 20), col, At(bk.x, 0.005, bk.z, -Math.PI / 2));
    // a shallow puddle round some buckets
    if (bk.puddle) b.add(new THREE.CircleGeometry(bk.puddle, 28), lam("puddle", () => ({ color: "#6f7686" })), At(bk.x + 0.15, 0.004, bk.z + 0.1, -Math.PI / 2), false);
  }
  b.build(root);
};
/** fluorescent tubes: centre [x, y, z] (along x) */
export const TUBES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let z = HALL.z0 + 5; z < HALL.z1; z += 5) for (const x of [-5.5, 5.5]) out.push([x, HALL.eave - 0.75, z]);
  return out;
})();

// ======================= the dream market of the ad =======================
export const buildDream = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = DREAM_X;
  const snow = lam("snowM", () => ({ map: snowTex() }));
  b.add(quad(V(X - 60, 0, 40), V(X + 60, 0, 40), V(X + 60, 0, -80), V(X - 60, 0, -80), 15, 15), snow, undefined, false);
  for (const h of DREAM_HUTS) hut(b, h, true);
  // the giant tree: stacked cones + trunk + star (ornaments/lights in world.ts)
  const fir = lam("fir", () => ({ color: "#2f7a46" })), fir2 = lam("fir2", () => ({ color: "#3a8f52" })), trunk = lam("trunk", () => ({ color: "#7a5a40" }));
  b.add(cyl(0.35, 0.3, 1.2, 12), trunk, At(TREE[0], 0, TREE[2]));
  for (let i = 0; i < 5; i++) { const r = 3.4 - i * 0.62, hgt = 3.0; const g = new THREE.ConeGeometry(r, hgt, 18); g.translate(0, hgt / 2, 0); b.add(g, i % 2 ? fir2 : fir, At(TREE[0], 1.0 + i * 1.55, TREE[2], 0, i * 0.4)); }
  // snowy houses round the square (dark facades, warm windows), pines beyond
  const fac = [lam("dHouseA", () => ({ color: "#6a4a6e" })), lam("dHouseB", () => ({ color: "#4a5a8a" })), lam("dHouseC", () => ({ color: "#8a5a4a" }))];
  const winM = glow("dWin", "#ffc870", 2.0);
  for (let i = 0; i < 9; i++) {
    const x = X - 22 + i * 5.5, z = -38 - (i % 2) * 2, h = 7 + (i % 3) * 1.6;
    b.add(B(x - 2.5, 0, z - 4, x + 2.5, h, z), fac[i % 3]);
    b.add(B(x - 2.7, h, z - 4.2, x + 2.7, h + 0.35, z + 0.2), snow);
    for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 2; wx++) b.add(quad(V(x - 1.6 + wx * 2.1, 2 + wy * 2.4, z + 0.02), V(x - 0.6 + wx * 2.1, 2 + wy * 2.4, z + 0.02), V(x - 0.6 + wx * 2.1, 3.3 + wy * 2.4, z + 0.02), V(x - 1.6 + wx * 2.1, 3.3 + wy * 2.4, z + 0.02)), winM, undefined, false);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const x = X + side * (13 + (i % 2) * 3), z = 4 - i * 6;
    const dark = lam("pineD", () => ({ color: "#245a3c" }));
    for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry(1.8 - k * 0.45, 2.4, 10); g.translate(0, 1.2, 0); b.add(g, dark, At(x, 0.6 + k * 1.3, z)); }
    const cap = new THREE.ConeGeometry(0.55, 0.8, 10); cap.translate(0, 0.4, 0); b.add(cap, snow, At(x, 3.4, z));
  }
  b.build(root);
};
