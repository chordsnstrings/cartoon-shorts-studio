// The places of the sky-clue short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): river bank with the camera pole, the YouTuber's desk room, the flight map, the street.
// Static geometry is merged per material; moving parts (planes, camera head, ambulance, drives, scroll) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { RIV, DESK, MAP, ST, POLE, MON, MON_YAW, MON_W, MON_H, YT } from "./story";

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

// ---------------- river bank with the camera pole (x 0) ----------------
/** where far-bank trees stand (used by world/cast for the camera view) */
export const buildRiver = (root: THREE.Object3D) => {
  const b = new Batch();
  const grass = lam("rivGrass", () => ({ map: rep(grassHD(), 14, 14) }));
  const bank = lam("rivBank", () => ({ color: "#b59a6a" }));
  const wat = lam("rivWater", () => ({ map: rep(water(), 12, 2) }));
  const hillM = lam("rivHill", () => ({ color: "#86b85a" })), hillF = lam("rivHillFar", () => ({ color: "#9cc3a0" }));
  // near bank z -14 .. 140, the river -14 .. -27 (water 0.35 below), far bank beyond
  b.add(floorQ(RIV - 195, RIV + 195, -14, 140, 0, 1), grass, undefined, false);
  b.add(floorQ(RIV - 195, RIV + 195, -27.5, -13.5, -0.35, 1), wat, undefined, false);
  b.add(quad(V(RIV - 195, -0.4, -14), V(RIV + 195, -0.4, -14), V(RIV + 195, 0, -13.2), V(RIV - 195, 0, -13.2)), bank, undefined, false);
  b.add(quad(V(RIV + 195, -0.4, -27.4), V(RIV - 195, -0.4, -27.4), V(RIV - 195, 0.15, -28.2), V(RIV + 195, 0.15, -28.2)), bank, undefined, false);
  b.add(floorQ(RIV - 195, RIV + 195, -400, -28.2, 0.15, 1), grass, undefined, false);
  // reeds / stones along the near edge
  const stoneM = lam("rivStone", () => ({ color: "#a8a3a0" }));
  for (let i = 0; i < 26; i++) { const x = RIV - 30 + i * 2.4 + 0.8 * Math.sin(i * 3.3); b.add(new THREE.SphereGeometry(0.25 + 0.15 * Math.sin(i * 1.7), 8, 6), stoneM, At(x, -0.05, -13.6 + 0.3 * Math.cos(i))); }
  // far-bank trees: a dense line (the camera's whole view), pines mixed in
  for (let i = 0; i < 34; i++) {
    const x = RIV - 50 + i * 3.1 + 1.2 * Math.sin(i * 2.1), z = -31 - 4 * Math.abs(Math.sin(i * 1.37)) - (i % 3) * 2.5;
    if (i % 5 === 2) pine(b, x, z, 1.5 + 0.3 * Math.sin(i)); else tree(b, x, z, 1.25 + 0.35 * Math.sin(i * 0.9), i);
  }
  for (let i = 0; i < 18; i++) tree(b, RIV - 80 + i * 9.5, -50 - 6 * Math.sin(i * 1.9), 1.6, i + 1);
  // near-bank trees framing left and right (keep the pole's sight lines clear)
  for (const [x, z, s, k] of [[-7.5, -6, 1.3, 0], [-12, -10, 1.5, 1], [9, -8, 1.4, 2], [14, -4, 1.6, 0], [-16, 2, 1.7, 2], [18, 6, 1.5, 1], [-24, -8, 1.6, 1]] as const) tree(b, RIV + x, z, s, k);
  for (let i = 0; i < 7; i++) hill(b, RIV - 170 + i * 58, -170 - 30 * Math.sin(i * 1.7), 50, 22 + 10 * Math.sin(i * 2.3), i % 2 ? hillM : hillF);
  // the utility pole: wooden post, cross arm, insulators, wires running off left and right, the camera bracket
  const wood = lam("poleWood", () => ({ color: "#8a6a4a" })), ins = lam("insul", () => ({ color: "#d9dde4" })), wire = lam("wire", () => ({ color: "#2a2630" }));
  const [px, , pz] = POLE;
  b.add(cyl(0.15, 0.12, 6.4, 14), wood, At(px, 0, pz));
  b.add(B(px - 1.1, 5.7, pz - 0.07, px + 1.1, 5.86, pz + 0.07), wood);
  for (const dx of [-0.9, -0.3, 0.9]) b.add(cyl(0.05, 0.04, 0.18, 8), ins, At(px + dx, 5.86, pz));
  for (const dx of [-0.9, -0.3, 0.9]) { const g = new THREE.CylinderGeometry(0.012, 0.012, 120, 5); g.rotateZ(Math.PI / 2); b.add(g, wire, At(px + dx, 5.98 - 0.2 * Math.abs(dx), pz)); }
  // a second pole down the bank for the wires
  b.add(cyl(0.15, 0.12, 6.4, 14), wood, At(px - 38, 0, pz)); b.add(B(px - 39.1, 5.7, pz - 0.07, px - 36.9, 5.86, pz + 0.07), wood);
  b.add(cyl(0.15, 0.12, 6.4, 14), wood, At(px + 42, 0, pz)); b.add(B(px + 40.9, 5.7, pz - 0.07, px + 43.1, 5.86, pz + 0.07), wood);
  // the camera bracket (the head itself turns: world.ts)
  const metal = lam("bracket", () => ({ color: "#c9ced8" }));
  b.add(B(px + 0.1, 4.05, pz - 0.06, px + 0.36, 4.17, pz + 0.06), metal);
  b.add(B(px + 0.08, 3.95, pz - 0.1, px + 0.16, 4.25, pz + 0.1), metal);
  // a junction box on the post
  b.add(B(px - 0.14, 2.4, pz + 0.12, px + 0.14, 2.8, pz + 0.24), lam("jbox", () => ({ color: "#9aa3ad" })));
  b.build(root);
};

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
/** map canvas: 240 x 120 m at 4096 x 2048 (17 px per m) */
const MW = 240, MH = 120, PX = 4096 / MW;
const mapTex = () => ctex("usMap", 4096, 2048, (g, r) => {
  const P = (x: number, z: number): [number, number] => [(x + MW / 2) * PX, (z + MH / 2) * PX];
  // ocean
  g.fillStyle = "#4a9ad8"; g.fillRect(0, 0, 4096, 2048);
  g.strokeStyle = "rgba(160,215,245,0.45)"; g.lineWidth = 5; g.lineCap = "round";
  for (let i = 0; i < 260; i++) { const x = r() * 4096, y = r() * 2048, l = 40 + r() * 60; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 10, x + l, y); g.stroke(); }
  // neighbours (pale land) north and south so the coasts read
  g.fillStyle = "#cfd9b8";
  const north: [number, number][] = [[-130, 49], [-130, 60], [-60, 60], [-60, 46], [-67.0, 44.8], [-67.8, 47.1], [-69.0, 47.4], [-70.0, 46.7], [-71.5, 45.0], [-75.0, 45.0], [-76.5, 44.2], [-79.0, 43.3], [-82.4, 43.0], [-82.5, 45.3], [-84.5, 46.5], [-89.5, 48.0], [-91.5, 48.1], [-94.6, 48.7], [-95.2, 49.0], [-122.8, 49.0], [-124.7, 48.4]];
  const south: [number, number][] = [[-117.1, 32.5], [-114.8, 32.5], [-111.1, 31.3], [-108.2, 31.8], [-106.5, 31.8], [-104.5, 29.6], [-103.1, 29.0], [-102.4, 29.8], [-101.4, 29.8], [-100.6, 28.4], [-99.1, 26.4], [-97.4, 26.0], [-97.6, 22], [-96, 19], [-90, 21], [-87, 21.5], [-88, 15], [-105, 18], [-112, 24], [-109.5, 23], [-112, 28.5], [-114.8, 30.8], [-116.5, 31.5]];
  for (const poly of [north, south]) { g.beginPath(); poly.forEach(([lo, la], i) => { const [x, y] = P(...mapXZ(lo, la)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); }
  // the US: painted regions (east green, plains gold, west ochre), mountains, rivers, lakes
  g.save();
  g.beginPath(); US_XZ.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
  g.clip();
  const gr = g.createLinearGradient(P(-100, 0)[0], 0, P(100, 0)[0], 0);
  gr.addColorStop(0, "#d6b878"); gr.addColorStop(0.3, "#cdb46a"); gr.addColorStop(0.5, "#b8c46a"); gr.addColorStop(0.68, "#8cbf5a"); gr.addColorStop(1, "#6aae50");
  g.fillStyle = gr; g.fillRect(0, 0, 4096, 2048);
  for (let i = 0; i < 160; i++) { const x = r() * 4096, y = r() * 2048, rad = 60 + r() * 160; g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(60,90,30,0.07)"; g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, 6.283); g.fill(); }
  // Rockies + Appalachians: darker painted bands with snow ticks
  const band = (pts: [number, number][], w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = "round"; g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = P(...mapXZ(lo, la)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  band([[-114, 49], [-111, 45], [-109, 42], [-106, 39], [-106, 35], [-107, 32]], 150, "rgba(150,110,70,0.55)");
  band([[-121.5, 49], [-121.8, 44], [-121, 40], [-119, 37], [-118, 35.5]], 90, "rgba(130,110,80,0.5)");
  band([[-84, 34.5], [-81, 37], [-78.5, 39.5], [-76, 41.5], [-73.5, 43.5]], 70, "rgba(70,110,50,0.45)");
  // rivers
  g.strokeStyle = "#4a9ad8"; g.lineWidth = 9; g.lineCap = "round";
  band([[-95.2, 47.2], [-93, 44.5], [-91, 41.5], [-90.2, 38.6], [-89.4, 35], [-91, 32], [-90.5, 29.5]], 10, "#4a9ad8");
  band([[-111, 47.5], [-104, 47.8], [-100, 46.5], [-96.5, 41.5], [-94.5, 39.2], [-90.2, 38.6]], 8, "#4a9ad8");
  band([[-80, 40.4], [-84.5, 39.1], [-88, 37.5], [-89.2, 37.0]], 8, "#4a9ad8");
  g.restore();
  // lakes
  g.fillStyle = "#4a9ad8"; for (const [lo, la, a, b2] of LAKES) { const [x, y] = P(...mapXZ(lo, la)); g.beginPath(); g.ellipse(x, y, a * KM * PX * 0.5, b2 * KM * 1.25 * PX * 0.5, -0.2, 0, 6.283); g.fill(); }
  // coast: white surf line, then ink outline
  g.beginPath(); US_XZ.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
  g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 26; g.stroke();
  g.strokeStyle = "#2a2232"; g.lineWidth = 9; g.stroke();
  // state-ish dotted grid (no labels): faint dashed lines inside
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
  b.add(floorQ(MAP - 195, MAP + 195, -400, -MH / 2, -0.05, 1), lam("ocean", () => ({ color: "#4a9ad8" })), undefined, false);
  b.add(floorQ(MAP - 195, MAP + 195, MH / 2, 400, -0.05, 1), lam("ocean", () => ({ color: "#4a9ad8" })), undefined, false);
  b.add(floorQ(MAP - 195, MAP - MW / 2, -MH / 2, MH / 2, -0.05, 1), lam("ocean", () => ({ color: "#4a9ad8" })), undefined, false);
  b.add(floorQ(MAP + MW / 2, MAP + 195, -MH / 2, MH / 2, -0.05, 1), lam("ocean", () => ({ color: "#4a9ad8" })), undefined, false);
  // relief: little cone mountains on the Rockies and the Sierra, inked by the world pass
  const rock = lam("mapRock", () => ({ color: "#9a7a5a" })), snow = lam("mapSnow", () => ({ color: "#f4f5f8" }));
  const peaks: [number, number][] = [[-113.5, 48], [-112, 46], [-110.5, 44.5], [-109.8, 43], [-108, 41], [-106.8, 39.6], [-105.6, 38.5], [-106.2, 37], [-121.6, 47], [-121.8, 44.5], [-120.5, 39], [-119, 37.2], [-118.5, 36]];
  peaks.forEach(([lo, la], i) => {
    const [x, z] = mapXZ(lo, la), h = 3.2 + 1.4 * Math.sin(i * 2.1), rr = 3.6 + 0.8 * Math.cos(i);
    const g = new THREE.ConeGeometry(rr, h, 7, 2); g.translate(0, h / 2, 0); b.add(g, rock, At(MAP + x, 0, z, 0, i));
    const c = new THREE.ConeGeometry(rr * 0.36, h * 0.36, 7); c.translate(0, h * 0.82, 0); b.add(c, snow, At(MAP + x, 0, z, 0, i));
  });
  b.build(root);
};
/** dots: deterministic points inside the US outline (map-local x, z), the first is the hero spot */
export const mapDots = (n: number, spot: [number, number]) => {
  const out: [number, number, number][] = [[spot[0], spot[1], 0]];
  let s = 12345;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  while (out.length < n) {
    const x = (rnd() - 0.5) * MW * 0.9, z = (rnd() - 0.5) * MH * 0.9;
    if (inUS(x, z)) out.push([x, z, rnd()]);
  }
  return out;
};

// ---------------- the street of the siren (x + 2000) ----------------
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5a5866"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.fillStyle = "#f2e6b0"; for (let x = 0; x < 512; x += 128) g.fillRect(x, 250, 70, 12);
});
export const buildStreet = (root: THREE.Object3D) => {
  const b = new Batch();
  const road = lam("road", () => ({ map: rep(asphaltTex(), 1, 1) }));
  const walk = lam("walk", () => ({ map: rep(concreteTex(), 1, 1) }));
  const curb = lam("curb", () => ({ color: "#d9d6cf" }));
  const grass = lam("stGrass", () => ({ map: rep(grassHD(), 14, 14) }));
  // road z -6 .. 0 tiled along x (4 m tiles), kerb, pavement z 0 .. 2.6, lawns
  for (let x = ST - 192; x < ST + 192; x += 8) b.add(quad(V(x, 0, 0), V(x + 8, 0, 0), V(x + 8, 0, -6), V(x, 0, -6), 1, 1), road, undefined, false);
  b.add(B(ST - 195, 0, 0, ST + 195, 0.15, 0.25), curb);
  b.add(floorQ(ST - 195, ST + 195, 0.25, 2.6, 0.15, 2), walk, undefined, false);
  b.add(floorQ(ST - 195, ST + 195, 2.6, 120, 0.12, 1), grass, undefined, false);
  b.add(B(ST - 195, 0, -6.25, ST + 195, 0.15, -6), curb);
  b.add(floorQ(ST - 195, ST + 195, -8.6, -6.25, 0.15, 2), walk, undefined, false);
  b.add(floorQ(ST - 195, ST + 195, -400, -8.6, 0.12, 1), grass, undefined, false);
  // houses across the road
  const walls = ["#e8d2a8", "#c9d6e0", "#f0c8b0", "#d8e4c4", "#efe2c8"], shut = ["#3a64b8", "#4f9a6e", "#c0353a", "#8a5a34", "#3a3440"];
  for (let i = 0; i < 9; i++) {
    const x0 = ST - 34 + i * 8.4, w = 7, h = 6 + (i % 3) * 1.4, z0 = -18, z1 = -12;
    const fac = lam("fac" + i, () => ({ map: facadeHD("stFac" + i, w, h, { wall: walls[i % 5], shutter: shut[i % 5], door: true }) }));
    b.add(quad(V(x0, 0, z1), V(x0 + w, 0, z1), V(x0 + w, h, z1), V(x0, h, z1)), fac);
    b.add(B(x0, 0, z0, x0 + w, h, z1 - 0.01), lam("facSide" + (i % 5), () => ({ color: walls[i % 5] })));
    const rf = lam("roofSt" + (i % 3), () => ({ map: roofHD(["#b0533a", "#4a4a5a", "#8a5a3a"][i % 3]) }));
    b.add(quad(V(x0 - 0.3, h, z1 + 0.4), V(x0 + w + 0.3, h, z1 + 0.4), V(x0 + w + 0.3, h + 2.4, (z0 + z1) / 2), V(x0 - 0.3, h + 2.4, (z0 + z1) / 2)), rf);
    b.add(quad(V(x0 + w + 0.3, h, z0 - 0.4), V(x0 - 0.3, h, z0 - 0.4), V(x0 - 0.3, h + 2.4, (z0 + z1) / 2), V(x0 + w + 0.3, h + 2.4, (z0 + z1) / 2)), rf);
    // gable ends
    for (const xg of [x0, x0 + w]) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([xg, h, z1, xg, h, z0, xg, h + 2.4, (z0 + z1) / 2], 3)); g.computeVertexNormals(); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); b.add(g, lam("facSide" + (i % 5), () => ({ color: walls[i % 5] }))); }
  }
  for (const [x, z, s, k] of [[-14, -10, 1.3, 0], [6, -10, 1.2, 1], [22, -10, 1.4, 2], [-8, 6, 1.5, 1], [12, 7, 1.6, 0], [-30, 5, 1.5, 2]] as const) tree(b, ST + x, z, s, k);
  for (let i = 0; i < 6; i++) hill(b, ST - 150 + i * 60, -150 - 30 * Math.sin(i * 1.9), 45, 18, lam("rivHill", () => ({ color: "#86b85a" })));
  // a street lamp and a fire hydrant on the pavement
  const iron = lam("iron", () => ({ color: "#3a3440" }));
  b.add(cyl(0.07, 0.06, 4.2, 10), iron, At(ST - 4.5, 0.15, 0.9)); b.add(B(ST - 4.5, 4.2, 0.75, ST - 3.6, 4.32, 1.05), iron);
  b.add(cyl(0.13, 0.13, 0.55, 12), lam("hydrant", () => ({ color: "#d8443a" })), At(ST + 3.2, 0.15, 1.1));
  b.build(root);
};
