// The places of the kei-truck short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): the country road with its side road and mud mound, and the showroom. Vehicles are groups
// (makeKei / makeTruck / makeCar) posed per frame in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { ROAD, SHOW, CROSS, MOUND, MOUND_R, MOUND_H, LANE_N, LANE_F } from "./story";

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

void water; void cloudHD; void mountain; void pine; void room; void wallX; void T; void concreteTex; void tiles; void paintWall; void LANE_F;


// ---------------- the country road (x 0) ----------------
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5a5866"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.fillStyle = "#f2d65a"; for (let x = 0; x < 512; x += 128) g.fillRect(x, 250, 70, 12);
  g.fillStyle = "#eeeae0"; g.fillRect(0, 20, 512, 7); g.fillRect(0, 485, 512, 7);
});
const asphaltPlain = () => ctex("asphaltPlain", 512, 512, (g, r) => {
  g.fillStyle = "#5e5c69"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
});
const mudTex = () => ctex("mud", 512, 512, (g, r) => {
  g.fillStyle = "#8a6444"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,230,190,0.08)" : "rgba(40,20,10,0.12)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(60,36,22,0.5)"; g.lineWidth = 6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 60 + i * 80); g.bezierCurveTo(170, 40 + i * 80, 340, 90 + i * 80, 512, 60 + i * 80); g.stroke(); }
});
const strawTex = () => ctex("straw", 256, 256, (g, r) => {
  g.fillStyle = "#e2b552"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { g.strokeStyle = r() > 0.5 ? "rgba(255,240,170,0.6)" : "rgba(150,100,30,0.45)"; g.lineWidth = 2; const x = r() * 256, y = r() * 256, a = (r() - 0.5) * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26 * Math.cos(a), y + 26 * Math.sin(a)); g.stroke(); }
  g.fillStyle = "#7a4a2a"; g.fillRect(70, 0, 8, 256); g.fillRect(178, 0, 8, 256);
});
const barnTex = () => ctex("barn", 512, 512, (g) => {
  g.fillStyle = "#b8473a"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(60,20,20,0.35)"; g.lineWidth = 4; for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.fillStyle = "#f1ece0"; g.fillRect(176, 250, 160, 262); g.fillStyle = "#b8473a"; g.fillRect(192, 266, 128, 246);
  g.strokeStyle = "#f1ece0"; g.lineWidth = 14; g.beginPath(); g.moveTo(192, 266); g.lineTo(320, 512); g.moveTo(320, 266); g.lineTo(192, 512); g.stroke();
});
export const buildStreet = (root: THREE.Object3D) => {
  const b = new Batch();
  const road = lam("road", () => ({ map: rep(asphaltTex(), 1, 1) }));
  const plain = lam("roadPlain", () => ({ map: rep(asphaltPlain(), 1, 1) }));
  const curb = lam("curb", () => ({ color: "#d9d6cf" }));
  const grass = lam("stGrass", () => ({ map: rep(grassHD(), 14, 14) }));
  const white = lam("lineWhite", () => ({ color: "#f1efe6" }));
  for (let x = ROAD - 192; x < ROAD + 192; x += 8) b.add(quad(V(x, 0, 0), V(x + 8, 0, 0), V(x + 8, 0, -6), V(x, 0, -6), 1, 1), road, undefined, false);
  // near curb with a gap for the side road
  b.add(B(ROAD - 195, 0, 0, CROSS - 2.9, 0.12, 0.25), curb);
  b.add(B(CROSS + 2.9, 0, 0, ROAD + 195, 0.12, 0.25), curb);
  b.add(floorQ(ROAD - 195, ROAD + 195, 0.25, 120, 0.0, 1), grass, undefined, false);
  b.add(B(ROAD - 195, 0, -6.25, ROAD + 195, 0.12, -6), curb);
  b.add(floorQ(ROAD - 195, ROAD + 195, -400, -6.25, 0.0, 1), grass, undefined, false);
  // the side road toward +z at CROSS, with a white stop line
  for (let z = 0; z < 60; z += 6) b.add(quad(V(CROSS - 2.8, 0.012, z + 6), V(CROSS + 2.8, 0.012, z + 6), V(CROSS + 2.8, 0.012, z), V(CROSS - 2.8, 0.012, z), 1, 1), plain, undefined, false);
  b.add(B(CROSS - 0.1, 0.012, 1.1, CROSS + 2.6, 0.03, 1.45), white, undefined, false);
  // the mud mound on the field
  const mud = lam("mud", () => ({ map: rep(mudTex(), 3, 3) }));
  const mg = new THREE.PlaneGeometry(MOUND_R * 2.6, MOUND_R * 3.4, 36, 40); mg.rotateX(-Math.PI / 2);
  const mp = mg.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), z = mp.getZ(i), d = Math.hypot(x / MOUND_R, z / (MOUND_R * 1.4));
    mp.setY(i, d < 1 ? MOUND_H * 0.5 * (1 + Math.cos(Math.PI * d)) + 0.01 : 0.01 - 0.004 * Math.max(0, 1.25 - d));
  }
  mg.computeVertexNormals();
  b.add(mg, mud, At(MOUND[0], 0, MOUND[2]), false);
  // a dirt track leading over it
  b.add(quad(V(MOUND[0] - 40, 0.006, MOUND[2] + 1.0), V(MOUND[0] + 40, 0.006, MOUND[2] + 1.0), V(MOUND[0] + 40, 0.006, MOUND[2] - 1.0), V(MOUND[0] - 40, 0.006, MOUND[2] - 1.0), 26, 1), mud, undefined, false);
  // roadside trees (far side), a few near-side ones away from the camera paths, fields, distant hills, farm houses, a barn
  for (let i = 0; i < 26; i++) tree(b, ROAD - 180 + i * 14 + 5 * Math.sin(i * 3.1), -12 - 6 * ((i * 7) % 3), 1.2 + 0.3 * ((i * 5) % 3) / 2, i % 3);
  for (const x of [-190, -176, -100, -88, 70, 84, 98, 142, 156, 170, 184]) tree(b, x, 10 + 3 * Math.sin(x), 1.25, Math.abs(x) % 3);
  for (let i = 0; i < 8; i++) hill(b, ROAD - 170 + i * 48, -140 - 30 * Math.sin(i * 1.9), 45, 16, lam("rivHill", () => ({ color: "#86b85a" })));
  for (let i = 0; i < 6; i++) hill(b, ROAD - 160 + i * 64, 150 + 20 * Math.sin(i * 2.3), 50, 14, lam("rivHill", () => ({ color: "#86b85a" })));
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
  // red barn + silo behind the mound field (seen across the road from the mound)
  const bx = MOUND[0] - 6, bz = -34, bw = 12, bh = 6.5, bd = 9;
  b.add(quad(V(bx, 0, bz), V(bx + bw, 0, bz), V(bx + bw, bh, bz), V(bx, bh, bz)), lam("barnFront", () => ({ map: barnTex() })));
  b.add(B(bx, 0, bz - bd, bx + bw, bh, bz - 0.01), lam("barnSide", () => ({ color: "#b8473a" })));
  const br = lam("barnRoof", () => ({ map: roofHD("#5a5a66") }));
  b.add(quad(V(bx - 0.4, bh, bz + 0.4), V(bx + bw / 2, bh + 3.4, bz + 0.4), V(bx + bw / 2, bh + 3.4, bz - bd - 0.4), V(bx - 0.4, bh, bz - bd - 0.4)), br);
  b.add(quad(V(bx + bw / 2, bh + 3.4, bz + 0.4), V(bx + bw + 0.4, bh, bz + 0.4), V(bx + bw + 0.4, bh, bz - bd - 0.4), V(bx + bw / 2, bh + 3.4, bz - bd - 0.4)), br);
  const gable = new THREE.BufferGeometry(); gable.setAttribute("position", new THREE.Float32BufferAttribute([bx, bh, bz + 0.02, bx + bw, bh, bz + 0.02, bx + bw / 2, bh + 3.4, bz + 0.02], 3)); gable.computeVertexNormals();
  b.add(gable, lam("barnSide", () => ({ color: "#b8473a" })));
  b.add(cyl(2.2, 2.2, 11, 24), lam("silo", () => ({ color: "#c9ced8" })), At(bx + bw + 4, 0, bz - 3));
  b.add(new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam("siloTop", () => ({ color: "#8a9aac" })), At(bx + bw + 4, 11, bz - 3));
  // wooden fence along the near field
  const wood = lam("fence", () => ({ color: "#a07850" }));
  for (let x = -195; x < 195; x += 3) if (Math.abs(x - CROSS) > 5 && Math.abs(x - MOUND[0]) > 8) { b.add(B(x - 0.06, 0, 6.9, x + 0.06, 1.0, 7.02), wood); b.add(B(x - 1.5, 0.75, 6.92, x + 1.5, 0.85, 7.0), wood); b.add(B(x - 1.5, 0.4, 6.92, x + 1.5, 0.5, 7.0), wood); }
  b.build(root);
};

// ---------------- vehicles ----------------
const addParts = (g: THREE.Group, parts: [THREE.BufferGeometry, THREE.Material][]) => {
  for (const [geo, m] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
};
const wheelSet = (g: THREE.Group, pts: [number, number][], r: number, w: number, hubCol = "#d9d6cf") => {
  const tyre = lam("tyre", () => ({ color: "#2b2f3a" })), hub = lam("hub" + hubCol, () => ({ color: hubCol }));
  const wheels: THREE.Group[] = [];
  for (const [x, z] of pts) {
    const wg = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20).rotateX(Math.PI / 2), tyre); t.castShadow = true;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.48, r * 0.48, w + 0.02, 12).rotateX(Math.PI / 2), hub);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.75, r * 0.12, w + 0.03), lam("spoke", () => ({ color: "#8a8f99" })));
    wg.add(t, h, sp); wg.position.set(x, r, z); g.add(wg); wheels.push(wg);
  }
  return wheels;
};
/** the tiny kei pickup: 3.4 m long, cab-over, right-hand drive. Front toward +x, origin on the ground at the centre.
 *  Open window frames (no glass) so the driver card reads; the left door (local -z) is a hinged group. */
export const makeKei = () => {
  const g = new THREE.Group();
  const body = lam("keiBody", () => ({ color: "#9fd8c4" })), dark = lam("keiDark", () => ({ color: "#3a3c48" })), grey = lam("keiGrey", () => ({ color: "#b9bec8" }));
  const seat = lam("keiSeat", () => ({ color: "#4a4e60" })), black = lam("keiBlack", () => ({ color: "#26262e" }));
  const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boxGeo(V(x0, y0, z0), V(x1, y1, z1), 0, true);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [bx(-1.62, 0.3, -0.6, 1.62, 0.46, 0.6), dark], // frame
    [bx(-1.7, 0.46, -0.74, 0.72, 0.6, 0.74), body], // bed floor
    [bx(-1.7, 0.6, -0.74, 0.72, 0.95, -0.69), body], [bx(-1.7, 0.6, 0.69, 0.72, 0.95, 0.74), body], // bed sides
    [bx(-1.74, 0.46, -0.74, -1.69, 0.95, 0.74), body], // tailgate
    [bx(-1.76, 0.38, -0.7, -1.7, 0.5, 0.7), grey], // rear bumper
    [bx(0.68, 0.6, -0.74, 0.74, 1.12, 0.74), body], // headboard
    [bx(0.7, 1.12, -0.7, 0.72, 1.3, -0.66), grey], [bx(0.7, 1.12, 0.66, 0.72, 1.3, 0.7), grey], [bx(0.7, 1.26, -0.7, 0.72, 1.3, 0.7), grey], // low guard rail (keeps the driver's face clear)
    [bx(0.75, 0.42, -0.74, 1.72, 1.1, 0.74), body], // cab lower
    [bx(1.62, 1.1, -0.74, 1.71, 1.78, -0.64), body], [bx(1.62, 1.1, 0.64, 1.71, 1.78, 0.74), body], // A pillars
    [bx(0.75, 1.1, -0.74, 0.85, 1.78, -0.62), body], [bx(0.75, 1.1, 0.62, 0.85, 1.78, 0.74), body], // B pillars
    [bx(0.75, 1.1, -0.74, 0.8, 1.2, 0.74), body], // rear window sill
    [bx(0.73, 1.76, -0.76, 1.74, 1.88, 0.76), body], // roof
    [bx(1.72, 0.5, -0.5, 1.75, 0.66, 0.5), black], // grille
    [bx(1.72, 0.38, -0.74, 1.8, 0.5, 0.74), grey], // front bumper
    [bx(0.95, 0.62, -0.62, 1.3, 0.72, 0.62), seat], [bx(0.88, 0.72, -0.62, 0.96, 1.25, 0.62), seat], // bench seat
    [bx(1.4, 0.9, -0.66, 1.62, 1.12, 0.66), dark], // dashboard
  ];
  addParts(g, parts);
  for (const z of [-0.56, 0.56]) { const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16).rotateZ(Math.PI / 2), glow("keiLamp", "#fff6d0", 1.4)); hl.position.set(1.74, 0.78, z); g.add(hl); }
  for (const z of [-0.8, 0.8]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.1), dark); m.position.set(1.7, 1.25, z); g.add(m); }
  // steering wheel on the RIGHT (local +z), facing the driver
  const sw = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.032, 8, 28), black); ring.castShadow = true;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8).rotateX(Math.PI / 2).translate(0, 0, -0.1), black);
  sw.add(ring, col); sw.position.set(1.36, 1.2, 0.2); sw.rotation.set(0, Math.PI / 2, 0); sw.rotateX(-0.45); g.add(sw);
  // left door (local -z): hinged at its front edge x 1.62
  const door = new THREE.Group(); door.position.set(1.62, 0, -0.75);
  addParts(door, [[bx(-0.77, 0.44, -0.03, 0, 1.1, 0.0), body], [bx(-0.77, 1.1, -0.03, -0.7, 1.74, 0.0), body], [bx(-0.77, 1.7, -0.03, 0, 1.76, 0.0), body], [bx(-0.5, 0.86, -0.06, -0.38, 0.9, -0.03), dark]]);
  g.add(door);
  const wheels = wheelSet(g, [[-1.05, 0.62], [-1.05, -0.62], [1.12, 0.62], [1.12, -0.62]], 0.29, 0.18);
  return { g, wheels, door };
};
/** the full-size pickup (floppy truck, recoloured): front toward +x, origin under the bed/cab joint */
export const makeTruck = (col = "#d8483c", key = "bigPaint") => {
  const g = new THREE.Group();
  const paint = lam(key, () => ({ color: col })), glass = lam("truckGlass", () => ({ color: "#4a6aa8" })), grey = lam("bumper", () => ({ color: "#9aa3ad" }));
  addParts(g, [
    [boxGeo(V(-1.9, 0.45, -0.85), V(0.0, 0.75, 0.85)), paint],
    [boxGeo(V(-1.9, 0.75, -0.85), V(0.0, 1.15, -0.75)), paint], [boxGeo(V(-1.9, 0.75, 0.75), V(0.0, 1.15, 0.85)), paint],
    [boxGeo(V(-2.0, 0.45, -0.85), V(-1.9, 1.15, 0.85)), paint],
    [boxGeo(V(0.0, 0.45, -0.85), V(1.4, 1.85, 0.85)), paint],
    [boxGeo(V(1.4, 0.45, -0.85), V(2.4, 1.15, 0.85)), paint],
    [boxGeo(V(0.06, 1.2, -0.86), V(1.0, 1.72, 0.86)), glass], [boxGeo(V(1.36, 1.2, -0.78), V(1.42, 1.72, 0.78)), glass],
    [boxGeo(V(2.4, 0.4, -0.8), V(2.55, 0.66, 0.8)), grey], [boxGeo(V(-2.1, 0.4, -0.8), V(-2.0, 0.6, 0.8)), grey],
    [boxGeo(V(2.38, 0.7, -0.6), V(2.42, 1.05, 0.6)), lam("chrome", () => ({ color: "#c9ced8" }))],
  ]);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.24), glow("headlight", "#fff6d0", 1.6));
  for (const z of [-0.6, 0.6]) { const m = hl.clone(); m.position.set(2.43, 0.9, z); g.add(m); }
  const wheels = wheelSet(g, [[-1.25, 0.86], [-1.25, -0.86], [1.75, 0.86], [1.75, -0.86]], 0.44, 0.32, "#c9ced8");
  return { g, wheels };
};
/** a plain sedan for traffic, front toward +x */
export const makeCar = (col: string, key: string) => {
  const g = new THREE.Group();
  const paint = lam(key, () => ({ color: col })), glass = lam("truckGlass", () => ({ color: "#4a6aa8" }));
  addParts(g, [
    [boxGeo(V(-2.2, 0.35, -0.85), V(2.2, 0.95, 0.85)), paint],
    [boxGeo(V(-1.2, 0.95, -0.8), V(0.9, 1.45, 0.8)), paint],
    [boxGeo(V(-1.12, 1.0, -0.81), V(0.82, 1.38, 0.81)), glass],
  ]);
  const wheels = wheelSet(g, [[-1.4, 0.8], [-1.4, -0.8], [1.4, 0.8], [1.4, -0.8]], 0.34, 0.22);
  return { g, wheels };
};
/** a hay bale (0.9 x 0.45 x 0.45), centre at origin */
export const makeBale = () => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.46), lam("straw", () => ({ map: strawTex() })));
  m.castShadow = true; m.receiveShadow = true; return m;
};

// ---------------- the showroom (x + 400) ----------------
const showFloorTex = () => ctex("showFloor", 512, 512, (g, r) => {
  g.fillStyle = "#4a4858"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.strokeStyle = "rgba(20,16,26,0.6)"; g.lineWidth = 4; g.strokeRect(0, 0, 512, 512);
});
const curtainTex = () => ctex("curtain", 512, 512, (g) => {
  for (let x = 0; x < 512; x += 2) { const k = 0.5 + 0.5 * Math.cos((x / 512) * Math.PI * 12); g.fillStyle = `rgb(${Math.round(58 + 40 * k)},${Math.round(36 + 16 * k)},${Math.round(80 + 40 * k)})`; g.fillRect(x, 0, 2, 512); }
});
export const buildShowroom = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("showFloor", () => ({ map: rep(showFloorTex(), 1, 1) }));
  b.add(floorQ(SHOW - 14, SHOW + 14, -8, 14, 0, 2), floor, undefined, false);
  b.add(quad(V(SHOW - 14, 0, -7), V(SHOW + 14, 0, -7), V(SHOW + 14, 9, -7), V(SHOW - 14, 9, -7), 3, 1), lam("curtain", () => ({ map: rep(curtainTex(), 3, 1) })), undefined, false);
  b.add(wallX(-7, 14, 0, 9, SHOW - 8, 3), lam("curtain", () => ({ map: rep(curtainTex(), 3, 1) })), undefined, false);
  b.add(wallX(-7, 14, 0, 9, SHOW + 8, 3, true), lam("curtain", () => ({ map: rep(curtainTex(), 3, 1) })), undefined, false);
  // truss bar with light cans
  const truss = lam("truss", () => ({ color: "#2b2b34" }));
  b.add(B(SHOW - 6, 5.6, 1.9, SHOW + 6, 5.75, 2.05), truss);
  for (const x of [-6, 6]) b.add(B(SHOW + x - 0.08, 0, 1.9, SHOW + x + 0.08, 5.75, 2.05), truss);
  // old storage clutter in the corners: crates
  const crate = lam("crate", () => ({ color: "#a07850" }));
  for (const [x, z, s] of [[-5.5, -5.2, 1.0], [-4.4, -5.6, 0.8], [-5.2, -4.0, 0.6], [5.0, -5.3, 1.1], [6.0, -4.2, 0.7]] as const) b.add(B(SHOW + x - s / 2, 0, z - s / 2, SHOW + x + s / 2, s, z + s / 2), crate);
  b.build(root);
};
/** the turntable disc (rotates in world.ts) */
export const makeTurntable = () => {
  const m = new THREE.Mesh(cyl(2.6, 2.6, 0.1, 48), lam("turn", () => ({ color: "#6a6878" }))); m.receiveShadow = true; return m;
};
/** the lumpy dust sheet over the truck (local like the truck: x along its length) */
export const makeSheet = () => {
  const geo = new THREE.SphereGeometry(1, 48, 28);
  const p = geo.attributes.position;
  const sp = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
    const X = sp(x0, 0.35) * 1.92, Z = sp(z0, 0.4) * 0.84;
    const top = X > 0.68 ? 1.98 : X > 0.55 ? 1.0 + 0.98 * (X - 0.55) / 0.13 : 1.02;
    let Y = y0 > 0 ? sp(y0, 0.3) * top : 0;
    const wob = 0.03 * Math.sin(X * 7 + Z * 5) + 0.025 * Math.sin(X * 13 - Y * 9);
    Y = Math.max(0, Y + wob);
    p.setXYZ(i, X + wob, Y, Z * (1 + 0.06 * (1 - Y / 2)) + wob);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, lam("sheet", () => ({ color: "#d9d2c2" }))); m.castShadow = true; m.receiveShadow = true;
  return m;
};
void LANE_N;
