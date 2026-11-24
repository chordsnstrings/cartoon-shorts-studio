// The places of the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { GARAGE, HOUSE_A, HOUSE_B, POLE1, POLE2 } from "./story";

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

// ======================= the suburban yard of the delivery-drone short =======================
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#5e5c69"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
});
const slabTex = () => ctex("slab", 512, 512, (g, r) => {
  g.fillStyle = "#d6d0c4"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,60,0.45)"; g.lineWidth = 4; g.strokeRect(0, 0, 512, 512);
});
const garageDoorTex = () => ctex("garageDoor", 1024, 512, (g, r) => {
  g.fillStyle = "#c9d6e2"; g.fillRect(0, 0, 1024, 512);
  // white trim frame, a big sectional door with panel grooves, a row of small windows
  g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#e9ecef"; g.fillRect(150, 110, 724, 402);
  g.strokeStyle = "rgba(70,70,90,0.55)"; g.lineWidth = 6;
  for (let y = 110; y < 512; y += 100) { g.beginPath(); g.moveTo(150, y); g.lineTo(874, y); g.stroke(); }
  for (let x = 150; x <= 874; x += 181) { g.beginPath(); g.moveTo(x, 110); g.lineTo(x, 512); g.stroke(); }
  g.fillStyle = "#4a5a78"; for (let i = 0; i < 4; i++) g.fillRect(180 + i * 181, 132, 120, 50);
  g.strokeStyle = "rgba(40,30,40,0.8)"; g.lineWidth = 8; g.strokeRect(150, 110, 724, 410);
  for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(0,0,0,0.03)"; g.beginPath(); g.ellipse(r() * 1024, r() * 512, 60, 30, 0, 0, 6.283); g.fill(); }
});
const sidingTex = (key: string, base: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(40,30,50,0.16)"; for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 512, 4);
  for (let i = 0; i < 30; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 60, 30, 0, 0, 6.283); g.fill(); }
});
/** neighbour house windows (x, y, w, h) on its facade; world.ts lays live glass over them */
export const B_WINDOWS: [number, number, number, number][] = [
  [HOUSE_B.x0 + 1.4, 1.5, 1.3, 1.25], [HOUSE_B.x0 + 5.3, 1.5, 1.3, 1.25], [HOUSE_B.x0 + 1.4, 3.9, 1.3, 1.1], [HOUSE_B.x0 + 3.5, 3.9, 1.3, 1.1], [HOUSE_B.x0 + 5.6, 3.9, 1.3, 1.1],
];
/** a gable-roofed box; the ridge runs along x; facade texture on +z, plain sides */
const house = (b: Batch, x0: number, x1: number, zf: number, zb: number, h: number, rise: number, front: THREE.Material, side: THREE.Material, roofM: THREE.Material, over = 0.35) => {
  b.add(B(x0, 0, zb, x1, h, zf - 0.01), side);
  b.add(quad(V(x0, 0, zf), V(x1, 0, zf), V(x1, h, zf), V(x0, h, zf)), front);
  const zm = (zf + zb) / 2;
  for (const [x, s] of [[x0 - 0.005, -1], [x1 + 0.005, 1]] as [number, number][]) {
    const gb = new THREE.BufferGeometry();
    const pts = s > 0 ? [x, h, zf, x, h, zb, x, h + rise, zm] : [x, h, zb, x, h, zf, x, h + rise, zm];
    gb.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); gb.computeVertexNormals(); b.add(gb, side);
  }
  b.add(quad(V(x0 - over, h - 0.12, zf + over), V(x1 + over, h - 0.12, zf + over), V(x1 + over, h + rise, zm), V(x0 - over, h + rise, zm), (x1 - x0) / 4, 1), roofM);
  b.add(quad(V(x1 + over, h - 0.12, zb - over), V(x0 - over, h - 0.12, zb - over), V(x0 - over, h + rise, zm), V(x1 + over, h + rise, zm), (x1 - x0) / 4, 1), roofM);
  b.add(B(x0 - over, h - 0.2, zf + over - 0.05, x1 + over, h - 0.08, zf + over + 0.02), lam("fascia", () => ({ color: "#f4f0e6" })));
};
const bush = (b: Batch, x: number, z: number, s: number, k = 0) => {
  const L = [lam("leafA", () => ({ color: "#4f8f3e" })), lam("leafB", () => ({ color: "#6aa84a" }))][k % 2];
  b.add(new THREE.SphereGeometry(0.6 * s, 14, 10), L, At(x, 0.45 * s, z));
  b.add(new THREE.SphereGeometry(0.45 * s, 12, 8), L, At(x + 0.5 * s, 0.35 * s, z + 0.1));
};
export const buildYard = (root: THREE.Object3D) => {
  const b = new Batch();
  const grassM = lam("yGrass", () => ({ map: rep(grassHD(), 30, 30) }));
  b.add(floorQ(-200, 200, -200, 7.5, 0, 400), grassM, undefined, false);
  b.add(floorQ(-200, 200, 16.2, 200, 0, 400), grassM, undefined, false);
  const slab = lam("ySlab", () => ({ map: rep(slabTex(), 1, 1) }));
  for (let x = -80; x < 80; x += 1.6) b.add(quad(V(x, 0.03, 9.0), V(x + 1.6, 0.03, 9.0), V(x + 1.6, 0.03, 7.5), V(x, 0.03, 7.5)), slab, undefined, false);
  for (let x = -80; x < 80; x += 1.6) b.add(quad(V(x, 0.03, 17.7), V(x + 1.6, 0.03, 17.7), V(x + 1.6, 0.03, 16.2), V(x, 0.03, 16.2)), slab, undefined, false);
  const curb = lam("yCurb", () => ({ color: "#d9d6cf" }));
  b.add(B(-200, 0, 9.0, 200, 0.12, 9.25), curb); b.add(B(-200, 0, 15.95, 200, 0.12, 16.2), curb);
  const road = lam("yRoad", () => ({ map: rep(asphaltTex(), 1, 1) }));
  for (let x = -200; x < 200; x += 6.7) b.add(quad(V(x, 0.0, 15.95), V(x + 6.7, 0.0, 15.95), V(x + 6.7, 0.0, 9.25), V(x, 0.0, 9.25)), road, undefined, false);
  // driveway to the garage + the walk to the buyer's door
  const conc = lam("yConc", () => ({ map: rep(slabTex(), 1, 1) }));
  const G = GARAGE;
  for (let z = G.zf; z < 7.5; z += 2) b.add(quad(V(G.x0 + 0.2, 0.035, Math.min(7.5, z + 2)), V(G.x1 - 0.2, 0.035, Math.min(7.5, z + 2)), V(G.x1 - 0.2, 0.035, z), V(G.x0 + 0.2, 0.035, z), 2.5, 1), conc, undefined, false);
  for (let z = HOUSE_A.zf; z < 7.5; z += 1.2) b.add(quad(V(-5.9, 0.035, z + 1.2), V(-4.7, 0.035, z + 1.2), V(-4.7, 0.035, z), V(-5.9, 0.035, z)), conc, undefined, false);
  // the buyer's house (two storeys, cream siding, blue shutters)
  const A = HOUSE_A;
  house(b, A.x0, A.x1, A.zf, A.zb, A.h, 2.2, lam("aFront", () => ({ map: facadeHD("houseA", A.x1 - A.x0, A.h, { wall: "#efe2c4", shutter: "#3a64b8", door: true }) })),
    lam("aSide", () => ({ map: rep(sidingTex("sidA", "#efe2c4"), 3, 2) })), lam("aRoof", () => ({ map: roofHD("#5a5a6a") })));
  b.add(B(-6.2, 0, A.zf, -4.4, 0.18, A.zf + 0.9), lam("step", () => ({ color: "#cfc8bb" })));
  // the neighbour's garage: white siding, sectional door, grey shingles
  const gw = G.x1 - G.x0;
  b.add(B(G.x0, 0, G.zb, G.x1, G.eave, G.zf - 0.01), lam("gSide", () => ({ map: rep(sidingTex("sidG", "#f1ede4"), 2, 1.5) })));
  b.add(quad(V(G.x0, 0, G.zf), V(G.x1, 0, G.zf), V(G.x1, G.eave, G.zf), V(G.x0, G.eave, G.zf)), lam("gFront", () => ({ map: garageDoorTex() })));
  const gside = lam("gSide2", () => ({ color: "#f1ede4" }));
  for (const [x, s] of [[G.x0 - 0.005, -1], [G.x1 + 0.005, 1]] as [number, number][]) {
    const gb = new THREE.BufferGeometry();
    const pts = s > 0 ? [x, G.eave, G.zf, x, G.eave, G.zb, x, G.ridge, G.zr] : [x, G.eave, G.zb, x, G.eave, G.zf, x, G.ridge, G.zr];
    gb.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); gb.computeVertexNormals(); b.add(gb, gside);
  }
  const gRoof = lam("gRoof", () => ({ map: roofHD("#6a6870") })), ov = 0.3, dy = (G.ridge - G.eave) * ov / (G.zf - G.zr);
  b.add(quad(V(G.x0 - ov, G.eave - dy, G.zf + ov), V(G.x1 + ov, G.eave - dy, G.zf + ov), V(G.x1 + ov, G.ridge, G.zr), V(G.x0 - ov, G.ridge, G.zr), gw / 3, 1), gRoof);
  b.add(quad(V(G.x1 + ov, G.eave - dy, G.zb - ov), V(G.x0 - ov, G.eave - dy, G.zb - ov), V(G.x0 - ov, G.ridge, G.zr), V(G.x1 + ov, G.ridge, G.zr), gw / 3, 1), gRoof);
  b.add(B(G.x0 - ov, G.eave - dy - 0.1, G.zf + ov - 0.04, G.x1 + ov, G.eave - dy, G.zf + ov + 0.02), lam("fascia", () => ({ color: "#f4f0e6" })));
  // the neighbour's house (sage siding; the windows are live glass in world.ts)
  const Hb = HOUSE_B;
  const bWall = sidingTex("sidB", "#b9cdb4");
  const bFront = ctex("bFront", 1024, 690, (g) => {
    g.drawImage(bWall.image as CanvasImageSource, 0, 0, 1024, 690);
    const sx = 1024 / (Hb.x1 - Hb.x0), sy = 690 / Hb.h;
    for (const [x, y, w, h] of B_WINDOWS) { g.fillStyle = "#f4f0e6"; g.fillRect((x - Hb.x0 - 0.12) * sx, (Hb.h - y - h - 0.12) * sy, (w + 0.24) * sx, (h + 0.24) * sy); }
    g.fillStyle = "#8a3a3a"; g.fillRect((3.4) * sx, (Hb.h - 2.2) * sy, 1.0 * sx, 2.2 * sy);
    g.fillStyle = "#f4f0e6"; g.fillRect((3.3) * sx, (Hb.h - 2.3) * sy, 0.1 * sx, 2.3 * sy); g.fillRect((4.4) * sx, (Hb.h - 2.3) * sy, 0.1 * sx, 2.3 * sy);
  });
  house(b, Hb.x0, Hb.x1, Hb.zf, Hb.zb, Hb.h, 2.0, lam("bFrontM", () => ({ map: bFront })), lam("bSide", () => ({ map: rep(sidingTex("sidB", "#b9cdb4"), 3, 2) })), lam("bRoof", () => ({ map: roofHD("#7a5a4a") })));
  // houses across the street (backs of the frame in reverse angles) + further down the street
  const walls = ["#e8d2a8", "#c9d6e0", "#f0c8b0", "#d8c8e0"];
  for (let i = 0; i < 6; i++) {
    const x0 = -34 + i * 13, w = 9, h = 4.6;
    house(b, x0, x0 + w, -26 + 0.01, -34, h, 2.0, lam("fFar" + i, () => ({ map: facadeHD("far" + i, w, h, { wall: walls[i % 4], shutter: "#3a64b8", door: true }) })),
      lam("fFarS" + i, () => ({ color: walls[i % 4] })), lam("fFarR" + i, () => ({ map: roofHD(["#b0533a", "#4a4a5a", "#8a5a3a"][i % 3]) })));
  }
  for (let i = 0; i < 6; i++) {
    const x0 = -36 + i * 13, w = 9, h = 4.6, zf = 24, zb = 32;
    // facade faces -z (toward the street): build with a mirrored front
    b.add(B(x0, 0, zf + 0.01, x0 + w, h, zb), lam("xS" + i, () => ({ color: walls[(i + 1) % 4] })));
    b.add(quad(V(x0 + w, 0, zf), V(x0, 0, zf), V(x0, h, zf), V(x0 + w, h, zf)), lam("xF" + i, () => ({ map: facadeHD("acr" + i, w, h, { wall: walls[(i + 1) % 4], shutter: "#2f7a5a", door: true }) })));
    const zm = (zf + zb) / 2, rm = lam("xR" + i, () => ({ map: roofHD(["#4a4a5a", "#8a5a3a", "#b0533a"][i % 3]) }));
    b.add(quad(V(x0 + w + 0.3, h - 0.1, zf - 0.3), V(x0 - 0.3, h - 0.1, zf - 0.3), V(x0 - 0.3, h + 2, zm), V(x0 + w + 0.3, h + 2, zm)), rm);
  }
  // poles + crossarms
  const wood = lam("pole", () => ({ color: "#8a6a4e" }));
  for (const [P, h] of [[POLE1, 7.0], [POLE2, 8.4]] as [[number, number, number], number][]) {
    b.add(cyl(0.15, 0.12, h, 12), wood, At(P[0], 0, P[2]));
    b.add(B(P[0] - 0.9, h - 0.55, P[2] - 0.08, P[0] + 0.9, h - 0.4, P[2] + 0.08), wood);
    for (const s of [-0.7, 0, 0.7]) b.add(cyl(0.05, 0.05, 0.14, 8), lam("insul", () => ({ color: "#6a8a6a" })), At(P[0] + s, h - 0.4, P[2]));
  }
  b.add(cyl(0.18, 0.18, 0.5, 12), lam("transformer", () => ({ color: "#7a808c" })), At(POLE2[0] + 0.25, 6.9, POLE2[2]));
  // trees, bushes, a mailbox
  tree(b, 1.2, -11, 1.7, 0); tree(b, -13, -3, 1.6, 1); tree(b, 19.5, -3, 1.5, 2); tree(b, 6.0, -12.5, 1.5, 1);
  for (let i = 0; i < 14; i++) tree(b, -40 + i * 6.5 + 2 * Math.sin(i * 2.1), -18 - 3 * ((i * 7) % 3), 1.5 + 0.3 * ((i * 5) % 3) / 2, i % 3);
  for (let i = 0; i < 8; i++) tree(b, -38 + i * 11, 21 + 1.5 * Math.sin(i), 1.3, (i + 1) % 3);
  for (const x of [-8.6, -7.2, -3.0, -2.0]) bush(b, x, A.zf + 0.7, 1, x > -5 ? 1 : 0);
  for (const x of [10.2, 12.0, 15.8]) bush(b, x, Hb.zf + 0.7, 1, 1);
  b.add(cyl(0.05, 0.05, 1.05, 8), wood, At(-7.4, 0, 7.15));
  b.add(B(-7.62, 1.05, 6.95, -7.18, 1.32, 7.4), lam("mailbox", () => ({ color: "#3a3f4c" })));
  b.build(root);
};
