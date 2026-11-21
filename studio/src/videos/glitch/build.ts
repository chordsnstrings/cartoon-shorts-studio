// The downtown street of the trolley short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): the street, the trolley crossing with its gates and signal masts, towers, palms, lamps, the catenary.
// Vehicles (makeRobo / makeTrolley / makeCar) and the gate arms are groups posed per frame in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { ROAD, LANE_N, LANE_F, HX, WATER_Y, QUAY_Z, PIER, BOAT } from "./story";

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

void cloudHD; void mountain; void pine; void room; void wallX; void T; void concreteTex; void tiles; void paintWall; void LANE_F; void tree; void hill; void grassHD; void roofHD; void LANE_N;


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

// ---------------- the downtown street (x 0) ----------------
const cityRoadTex = () => ctex("cityRoad", 512, 512, (g, r) => {
  // one tile = 8 m along x (u) by 7 m across the street (v: z 0 at v 0 .. z -7 at v 1)
  g.fillStyle = "#56545f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.fillStyle = "#f2c94a"; g.fillRect(0, 248, 512, 7); g.fillRect(0, 262, 512, 7); // centre double yellow
  g.fillStyle = "#eeeae0"; g.fillRect(0, 14, 512, 7); g.fillRect(0, 491, 512, 7); // edge lines
});
const sidewalkTex = () => ctex("sidewalk", 512, 512, (g, r) => {
  g.fillStyle = "#cfc8bc"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(80,66,70,0.55)"; g.lineWidth = 4; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
});
const ballastTex = () => ctex("ballast", 512, 512, (g, r) => {
  g.fillStyle = "#8d857e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) { const v = Math.floor(100 + r() * 80); g.fillStyle = `rgb(${v},${v - 6},${v - 10})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 5, 2 + r() * 4, r() * 3, 0, 6.283); g.fill(); }
});
const panelTex = () => ctex("trackPanel", 512, 512, (g, r) => {
  g.fillStyle = "#a8a39d"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,56,0.6)"; g.lineWidth = 4; for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
});
/** red / white striped gate arm (1024 x 64 along the arm) */
const armTex = () => ctex("gateArm", 1024, 64, (g) => {
  g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 1024, 64);
  g.fillStyle = "#d8352c"; for (let x = 0; x < 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 64, 0); g.lineTo(x + 32, 64); g.lineTo(x - 32, 64); g.fill(); }
});
/** a downtown building block: facade toward the street (+z side if face > 0), flat roof with a parapet and a roof box */
const block = (b: Batch, x0: number, w: number, zFace: number, depth: number, h: number, wall: string, k: number, face: 1 | -1) => {
  const fac = lam(`cfac${k}`, () => ({ map: facadeHD(`city${k}`, w, h, { wall, shutter: ["#3a64b8", "#2f6a5a", "#7a3b2a", "#4a4a5a"][k % 4], door: true }) }));
  const zb = zFace - face * depth;
  if (face > 0) b.add(quad(V(x0, 0, zFace), V(x0 + w, 0, zFace), V(x0 + w, h, zFace), V(x0, h, zFace)), fac);
  else b.add(quad(V(x0 + w, 0, zFace), V(x0, 0, zFace), V(x0, h, zFace), V(x0 + w, h, zFace)), fac);
  const side = lam(`cside${k}`, () => ({ color: wall }));
  b.add(B(x0, 0, Math.min(zb, zFace) + 0.01 * face, x0 + w, h, Math.max(zb, zFace) - 0.01 * face), side);
  const top = lam("parapet", () => ({ color: "#8f8790" }));
  b.add(B(x0 - 0.05, h, zFace - 0.25 * face - 0.1, x0 + w + 0.05, h + 0.5, zFace - 0.25 * face + 0.1), top);
  if (k % 3 === 0) b.add(B(x0 + w * 0.3, h, zFace - face * depth * 0.6, x0 + w * 0.6, h + 2.0, zFace - face * depth * 0.3), lam("roofBox", () => ({ color: "#b8b2ab" })));
  // awning over the ground floor
  if (k % 2 === 0) b.add(B(x0 + 1.0, 2.9, zFace + face * 0.0, x0 + w - 1.0, 3.05, zFace + face * 1.1), lam(`awn${k % 4}`, () => ({ color: ["#2f8f7a", "#c8503c", "#3a64b8", "#d9a441"][k % 4] })));
};
/** a fan palm: tall thin trunk + a crown of drooping fronds */
const palm = (b: Batch, x: number, z: number, h: number, k = 0) => {
  const trunk = lam("palmTrunk", () => ({ color: "#9a7a5a" })), frond = [lam("frondA", () => ({ color: "#4f8f3e" })), lam("frondB", () => ({ color: "#3f7a3a" }))];
  b.add(cyl(0.2, 0.15, h, 10), trunk, At(x, 0, z));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + k, g = new THREE.BoxGeometry(2.3, 0.06, 0.55); g.translate(1.1, 0, 0);
    b.add(g, frond[i % 2], new THREE.Matrix4().compose(V(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, -0.45 - 0.15 * (i % 3), "YXZ")), V(1, 1, 1)));
  }
  b.add(new THREE.SphereGeometry(0.4, 10, 8), frond[1], At(x, h, z));
};
const lampPost = (b: Batch, x: number, z: number, dir: number) => {
  const pole = lam("lampPole", () => ({ color: "#3a3e4a" }));
  b.add(cyl(0.09, 0.07, 6.2, 10), pole, At(x, 0, z));
  b.add(B(x - 0.05, 6.1, Math.min(z, z + dir * 1.2), x + 0.05, 6.2, Math.max(z, z + dir * 1.2)), pole);
  b.add(B(x - 0.22, 5.95, z + dir * 1.2 - 0.3, x + 0.22, 6.12, z + dir * 1.2 + 0.3), glow("lampHead", "#ffe6b0", 2.2), undefined, false);
};
export const buildCity = (root: THREE.Object3D) => {
  const b = new Batch();
  const road = lam("cityRoad", () => ({ map: rep(cityRoadTex(), 1, 1) }));
  const walk = lam("sidewalk", () => ({ map: rep(sidewalkTex(), 1, 1) }));
  const curb = lam("curb", () => ({ color: "#d9d6cf" }));
  const ball = lam("ballast", () => ({ map: rep(ballastTex(), 1, 1) }));
  const panel = lam("trackPanel", () => ({ map: rep(panelTex(), 1, 1) }));
  const rail = lam("rail", () => ({ color: "#6a6670" })), sleeper = lam("sleeper", () => ({ color: "#6a5040" }));
  const white = lam("lineWhite", () => ({ color: "#f1efe6" }));
  void ball; void panel; void rail; void sleeper;
  // street (8 m tiles along x) + a cross street along z at x -7..7 (no markings in the junction)
  for (let x = ROAD - 160; x < ROAD + 160; x += 8) b.add(quad(V(x, 0, 0), V(x + 8, 0, 0), V(x + 8, 0, -7), V(x, 0, -7), 1, 1), road, undefined, false);
  const plain = lam("asphalt", () => ({ color: "#56545f" }));
  for (const [z0, z1] of [[0, 160], [-160, -7]] as const) b.add(floorQ(-6.5, 6.5, z0, z1, 0.004, 8), plain, undefined, false);
  for (const [z0, z1] of [[0.15, 4.5], [-11.5, -7.15]] as const) for (let x = ROAD - 160; x < ROAD + 160; x += 2) {
    if (x + 2 <= -6.5 || x >= 6.5) b.add(floorQ(x, x + 2, z0, z1, 0.15, 2), walk, undefined, false);
  }
  b.add(B(ROAD - 160, 0, 0, -6.5, 0.15, 0.15), curb); b.add(B(6.5, 0, 0, ROAD + 160, 0.15, 0.15), curb);
  b.add(B(ROAD - 160, 0, -7.15, -6.5, 0.15, -7), curb); b.add(B(6.5, 0, -7.15, ROAD + 160, 0.15, -7), curb);
  // zebra crossings either side of the junction
  for (const x0 of [-9.6, 7.6]) for (let z = -6.4; z < -0.4; z += 1.0) b.add(B(x0, 0.003, z, x0 + 2.0, 0.012, z + 0.5), white, undefined, false);
  // downtown blocks on both sides of the street (gap around the track), towers further along
  const walls = ["#e8d2a8", "#d9a07a", "#c9d6e0", "#f0e2c8", "#b8c4d8", "#e0b890", "#cfd8c8", "#d8c0d0"];
  let k = 0;
  for (const side of [1, -1] as const) {
    let x = ROAD - 150;
    while (x < ROAD + 150) {
      const w = 11 + ((k * 7) % 4) * 2.5;
      if (x + w > -7 && x < 7) { x = x < 0 ? 7 : x + 1; continue; }
      const near = Math.abs(x + w / 2) < 40;
      const h = near ? 9 + ((k * 5) % 4) * 3.5 : 16 + ((k * 11) % 5) * 7;
      if (side > 0) block(b, x, w, 4.5, 14, h, walls[k % walls.length], k, -1);
      else block(b, x, w, -11.5, 14, h, walls[k % walls.length], k, 1);
      x += w + 0.4; k++;
    }
  }
  // far skyline towers (blue glass and sand), well behind the blocks
  const tower = (x: number, z: number, w: number, h: number, c: string, kk: number) => {
    const m = lam(`tower${kk}`, () => ({ map: facadeHD(`tower${kk}`, w, h, { wall: c, shutter: "#3a4a6a" }) }));
    b.add(quad(V(x - w / 2, 0, z + w / 2), V(x + w / 2, 0, z + w / 2), V(x + w / 2, h, z + w / 2), V(x - w / 2, h, z + w / 2)), m);
    b.add(quad(V(x + w / 2, 0, z - w / 2), V(x - w / 2, 0, z - w / 2), V(x - w / 2, h, z - w / 2), V(x + w / 2, h, z - w / 2)), m);
    b.add(B(x - w / 2, 0, z - w / 2 + 0.02, x + w / 2, h, z + w / 2 - 0.02), lam(`towerS${kk}`, () => ({ color: c })));
  };
  [[-60, -60, 18, 70, "#9ab8d8"], [-25, -75, 16, 58, "#e0c8a0"], [20, -64, 20, 82, "#8aa8cc"], [55, -80, 16, 50, "#d8b890"], [-90, -50, 16, 44, "#b8c8d8"],
   [-40, 60, 18, 64, "#9ab8d8"], [30, 70, 18, 72, "#e0c8a0"], [70, 55, 16, 48, "#8aa8cc"], [-80, 66, 16, 54, "#d8b890"]].forEach(([x, z, w, h, c], i) => tower(x as number, z as number, w as number, h as number, c as string, i));
  // palms and street lamps along both sidewalks, clear of the crossing corners and camera spots
  for (let x = ROAD - 140; x < ROAD + 140; x += 11) {
    if (Math.abs(x) < 9) continue;
    palm(b, x, 3.3, 7.5 + 1.5 * Math.sin(x), Math.abs(x) % 3);
    palm(b, x + 5.5, -10.2, 7.0 + 1.5 * Math.cos(x), Math.abs(x) % 2);
  }
  for (let x = ROAD - 137; x < ROAD + 140; x += 22) { if (Math.abs(x) < 9) continue; lampPost(b, x, 0.6, -1); lampPost(b, x + 11, -7.6, 1); }
  b.build(root);
};


// ---------------- the harbour (x HX): quay, sea wall, a bridge on round piers over the water, the far shore ----------------
const waterTex = () => rep(water(), 6, 6);
export const buildHarbour = (root: THREE.Object3D) => {
  const b = new Batch();
  const walk = lam("sidewalk", () => ({ map: rep(sidewalkTex(), 1, 1) }));
  const conc = lam("quayWall", () => ({ map: rep(concreteTex(), 1, 1) }));
  const cap = lam("curb", () => ({ color: "#d9d6cf" }));
  const rail = lam("lampPole", () => ({ color: "#3a3e4a" }));
  // quay deck z QUAY_Z .. 40, wall face at QUAY_Z down to below the water
  for (let x = HX - 120; x < HX + 120; x += 2) b.add(floorQ(x, x + 2, QUAY_Z, 40, 0.15, 2), walk, undefined, false);
  b.add(wallZ(HX - 120, HX + 120, WATER_Y - 2, 0.15, QUAY_Z, 3, true), conc);
  b.add(B(HX - 120, 0.15, QUAY_Z, HX + 120, 0.32, QUAY_Z + 0.35), cap);
  // railing posts + top rail along the quay edge (gap at the bridge)
  for (let x = HX - 60; x < HX + 60; x += 2.4) { if (Math.abs(x - HX) < 4.5) continue; b.add(cyl(0.05, 0.05, 1.0, 8), rail, At(x, 0.32, QUAY_Z + 0.25)); }
  b.add(B(HX - 60, 1.25, QUAY_Z + 0.2, HX - 4.5, 1.32, QUAY_Z + 0.3), rail); b.add(B(HX + 4.5, 1.25, QUAY_Z + 0.2, HX + 60, 1.32, QUAY_Z + 0.3), rail);
  // bridge: deck along z from the quay out across the water, round piers
  const deck = lam("bridgeDeck", () => ({ color: "#e0d6c4" })), side = lam("bridgeSide", () => ({ color: "#d27a52" }));
  b.add(B(HX - 3.4, 4.3, -60, HX + 3.4, 4.9, QUAY_Z + 4), deck);
  b.add(B(HX - 3.6, 4.9, -60, HX - 3.3, 5.8, QUAY_Z + 4), side); b.add(B(HX + 3.3, 4.9, -60, HX + 3.6, 5.8, QUAY_Z + 4), side);
  b.add(B(HX - 3.4, 0.15, QUAY_Z + 3.0, HX + 3.4, 4.3, QUAY_Z + 4), conc); // abutment on the quay
  for (const z of PIER.zs) b.add(cyl(PIER.r, PIER.r, 4.3 - WATER_Y + 1.5, 24), lam("pier", () => ({ color: "#cbbfae" })), At(HX, WATER_Y - 1.5, z));
  // the water
  const wm = lam("harbourWater", () => ({ map: waterTex() }));
  b.add(floorQ(HX - 400, HX + 400, -400, QUAY_Z, WATER_Y, 40), wm, undefined, false);
  // far shore: a low bank with houses and palms
  b.add(B(HX - 200, WATER_Y - 1, -110, HX + 200, 0.6, -70), lam("bank", () => ({ color: "#d8c9a4" })));
  const walls = ["#e8d2a8", "#d9a07a", "#c9d6e0", "#f0e2c8", "#b8c4d8", "#e0b890"];
  for (let i = 0; i < 14; i++) { const x = HX - 130 + i * 19; block(b, x, 13, -74, 10, 8 + (i % 4) * 4, walls[i % walls.length], i + 20, 1); }
  for (let x = HX - 120; x < HX + 120; x += 13) palm(b, x, -72, 7.5 + 1.5 * Math.sin(x), Math.abs(x) % 3);
  // our side: a few buildings behind the quay + palms
  for (let i = 0; i < 10; i++) { const x = HX - 90 + i * 18; if (Math.abs(x + 6.5 - HX) < 12) continue; block(b, x, 13, 22, 10, 9 + (i % 3) * 3, walls[(i + 2) % walls.length], i + 40, -1); }
  for (let x = HX - 80; x < HX + 80; x += 12) { if (Math.abs(x - HX) < 6) continue; palm(b, x, 2.5, 7.0 + Math.cos(x), Math.abs(x) % 2); }
  b.build(root);
};

// ---------------- vehicles ----------------
/** a delivery box truck, ~6.6 m: front toward +x, origin at ground centre */
export const makeBoxTruck = (cab = "#e8743a", box = "#f3ead8", key = "boxTruck") => {
  const g = new THREE.Group();
  const paint = lam(key + "Cab", () => ({ color: cab })), bx = lam(key + "Box", () => ({ color: box })), stripe = lam(key + "Stripe", () => ({ color: cab }));
  const glass = lam("truckGlass", () => ({ color: "#4a6aa8" })), grey = lam("bumper", () => ({ color: "#9aa3ad" })), dark = lam("chassis", () => ({ color: "#2b2f3a" }));
  addParts(g, [
    [boxGeo(V(-3.3, 0.55, -1.05), V(3.3, 0.8, 1.05)), dark],
    [boxGeo(V(-3.3, 0.8, -1.2), V(0.9, 3.4, 1.2)), bx],
    [boxGeo(V(-3.31, 1.5, -1.21), V(0.91, 1.8, 1.21)), stripe],
    [boxGeo(V(1.0, 0.7, -1.1), V(3.2, 2.0, 1.1)), paint],
    [boxGeo(V(1.0, 2.0, -1.1), V(2.5, 2.9, 1.1)), paint],
    [boxGeo(V(2.45, 2.0, -1.0), V(2.62, 2.75, 1.0)), glass], [boxGeo(V(1.25, 2.05, -1.11), V(2.35, 2.72, 1.11)), glass],
    [boxGeo(V(3.2, 0.55, -1.05), V(3.4, 0.9, 1.05)), grey], [boxGeo(V(-3.42, 0.55, -1.05), V(-3.3, 0.85, 1.05)), grey],
  ]);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.3), glow("headlight", "#fff6d0", 1.6));
  for (const z of [-0.75, 0.75]) { const m = hl.clone(); m.position.set(3.22, 1.4, z); g.add(m); }
  const wheels = wheelSet(g, [[-2.2, 1.0], [-2.2, -1.0], [2.2, 1.0], [2.2, -1.0]], 0.5, 0.36, "#c9ced8");
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
/** a small motor boat, BOAT.len long along local +x (bow at +x), origin at the waterline centre */
export const makeBoat = () => {
  const g = new THREE.Group(), L = BOAT.len / 2, Wd = BOAT.w / 2;
  const hull = lam("boatHull", () => ({ color: "#d8483c" })), stripe = lam("boatStripe", () => ({ color: "#f4f1ea" })), deckM = lam("boatDeck", () => ({ color: "#b8875a" }));
  const cabin = lam("boatCabin", () => ({ color: "#e8e2d4" })), glass = lam("truckGlass", () => ({ color: "#4a6aa8" })), red = lam("boatRed", () => ({ color: "#2f7fc8" }));
  // hull: a box with a pointed bow (extruded shape)
  const sh = new THREE.Shape(); sh.moveTo(-L, -Wd); sh.lineTo(L - 1.2, -Wd); sh.lineTo(L, 0); sh.lineTo(L - 1.2, Wd); sh.lineTo(-L, Wd); sh.lineTo(-L, -Wd);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -0.45, 0);
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); sg.rotateX(-Math.PI / 2); sg.scale(1.01, 1, 1.01); sg.translate(0, 0.15, 0);
  const dg = new THREE.ShapeGeometry(sh); dg.rotateX(-Math.PI / 2); dg.translate(0, 0.56, 0);
  addParts(g, [[hg, hull], [sg, stripe], [dg, deckM],
    [boxGeo(V(-1.0, 0.55, -0.75), V(0.5, 1.65, 0.75)), cabin], [boxGeo(V(0.48, 1.0, -0.65), V(0.53, 1.5, 0.65)), glass],
    [boxGeo(V(-1.05, 1.65, -0.85), V(0.6, 1.75, 0.85)), red], [boxGeo(V(-L - 0.3, -0.2, -0.2), V(-L, 0.5, 0.2)), lam("chassis", () => ({ color: "#2b2f3a" }))],
    [cyl(0.05, 0.04, 2.2, 8).translate(-0.2, 1.75, 0), lam("lampPole", () => ({ color: "#3a3e4a" }))],
    [boxGeo(V(-0.18, 3.35, 0.0), V(0.45, 3.75, 0.03)), lam("boatFlag", () => ({ color: "#ffd84a" }))],
    [boxGeo(V(L - 1.5, 0.56, -0.5), V(L - 0.6, 0.85, 0.5)), lam("boatBow", () => ({ color: "#f4f1ea" }))]]);
  return { g };
};
