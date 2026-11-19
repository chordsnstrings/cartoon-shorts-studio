// The downtown street of the trolley short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): the street, the trolley crossing with its gates and signal masts, towers, palms, lamps, the catenary.
// Vehicles (makeRobo / makeTrolley / makeCar) and the gate arms are groups posed per frame in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { ROAD, LANE_N, LANE_F, RAIL, GATE_N, GATE_F, ARM_L, ARM_Y } from "./story";

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

void water; void cloudHD; void mountain; void pine; void room; void wallX; void T; void concreteTex; void tiles; void paintWall; void LANE_F; void tree; void hill; void grassHD; void roofHD; void LANE_N;


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
/** signal mast at a gate post: white pole with black bands, crossbuck, two red lamps facing `face` (+-x), bell on top */
const mast = (b: Batch, x: number, z: number, face: number) => {
  const white = lam("mastWhite", () => ({ color: "#efece4" })), black = lam("mastBlack", () => ({ color: "#26262e" }));
  b.add(cyl(0.1, 0.1, 4.3, 12), white, At(x, 0, z));
  for (const y of [0.3, 1.5, 3.4]) b.add(cyl(0.105, 0.105, 0.18, 12), black, At(x, y, z));
  // crossbuck: two crossed white boards facing the traffic
  for (const s of [1, -1]) { const g = new THREE.BoxGeometry(0.05, 0.22, 1.5); b.add(g, white, new THREE.Matrix4().compose(V(x + face * 0.14, 3.85, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s * 0.75, 0, 0)), V(1, 1, 1))); }
  for (const s of [1, -1]) { const g = new THREE.BoxGeometry(0.03, 0.26, 1.54); b.add(g, black, new THREE.Matrix4().compose(V(x + face * 0.12, 3.85, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(s * 0.75, 0, 0)), V(1, 1, 1))); }
  // lamp bar with black back plate
  b.add(B(x - 0.04, 2.75, z - 0.75, x + 0.04, 2.85, z + 0.75), black);
  b.add(B(x + face * 0.02 - 0.03, 2.35, z - 0.78, x + face * 0.02 + 0.03, 3.25, z + 0.78), black);
  for (const dz of [-0.45, 0.45]) b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 16, 1, true).rotateZ(Math.PI / 2), black, At(x + face * 0.15, 2.8, z + dz));
  // bell dome on top + the gate mechanism box at the base
  b.add(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), black, At(x, 4.32, z));
  b.add(B(x - 0.25, 0, z - 0.25, x + 0.25, 1.2, z + 0.25), lam("gateBox", () => ({ color: "#d9d6cf" })));
};
/** positions of the red signal lamps (for the flashing glow discs in world.ts): [x, y, z, face, pair index] */
export const LAMPS: [number, number, number, number, number][] = [];
for (const [gx, gz, , face] of [[GATE_N[0], GATE_N[1] + 0.0, 0, -1], [GATE_F[0], GATE_F[1], 0, 1]] as const) for (const [i, dz] of [[0, -0.45], [1, 0.45]] as const) LAMPS.push([gx + face * 0.27, 2.8, gz + dz, face, i]);
export const MASTS: [number, number, number][] = [[GATE_N[0], GATE_N[1], -1], [GATE_F[0], GATE_F[1], 1]];

export const buildCity = (root: THREE.Object3D) => {
  const b = new Batch();
  const road = lam("cityRoad", () => ({ map: rep(cityRoadTex(), 1, 1) }));
  const walk = lam("sidewalk", () => ({ map: rep(sidewalkTex(), 1, 1) }));
  const curb = lam("curb", () => ({ color: "#d9d6cf" }));
  const ball = lam("ballast", () => ({ map: rep(ballastTex(), 1, 1) }));
  const panel = lam("trackPanel", () => ({ map: rep(panelTex(), 1, 1) }));
  const rail = lam("rail", () => ({ color: "#6a6670" })), sleeper = lam("sleeper", () => ({ color: "#6a5040" }));
  const white = lam("lineWhite", () => ({ color: "#f1efe6" }));
  // street (8 m tiles along x), skipping the crossing panel
  for (let x = ROAD - 160; x < ROAD + 160; x += 8) {
    const a = x, c = x + 8;
    if (c <= -1.6 || a >= 1.6) b.add(quad(V(a, 0, 0), V(c, 0, 0), V(c, 0, -7), V(a, 0, -7), 1, 1), road, undefined, false);
    else { b.add(quad(V(a, 0, 0), V(-1.6, 0, 0), V(-1.6, 0, -7), V(a, 0, -7), (-1.6 - a) / 8, 1), road, undefined, false); b.add(quad(V(1.6, 0, 0), V(c, 0, 0), V(c, 0, -7), V(1.6, 0, -7), (c - 1.6) / 8, 1), road, undefined, false); }
  }
  // stop lines before the crossing
  b.add(B(-6.4, 0.003, -3.4, -6.0, 0.012, -0.25), white, undefined, false);
  b.add(B(6.0, 0.003, -6.75, 6.4, 0.012, -3.6), white, undefined, false);
  // sidewalks + curbs (near z 0..4, far z -11..-7), the crossing panel continues through them
  for (const [z0, z1] of [[0.15, 4.5], [-11.5, -7.15]] as const) for (let x = ROAD - 160; x < ROAD + 160; x += 2) {
    if (x + 2 <= -1.6 || x >= 1.6) b.add(floorQ(x, x + 2, z0, z1, 0.15, 2), walk, undefined, false);
  }
  b.add(B(ROAD - 160, 0, 0, -1.6, 0.15, 0.15), curb); b.add(B(1.6, 0, 0, ROAD + 160, 0.15, 0.15), curb);
  b.add(B(ROAD - 160, 0, -7.15, -1.6, 0.15, -7), curb); b.add(B(1.6, 0, -7.15, ROAD + 160, 0.15, -7), curb);
  // track panel across street + sidewalks, embedded rails
  b.add(floorQ(-1.6, 1.6, -7, 0, 0.005, 3.2), panel, undefined, false);
  b.add(floorQ(-1.6, 1.6, 0.15, 4.5, 0.15, 3.2), panel, undefined, false); b.add(floorQ(-1.6, 1.6, -11.5, -7.15, 0.15, 3.2), panel, undefined, false);
  b.add(B(-1.6, 0, 0, 1.6, 0.15, 0.15), curb); b.add(B(-1.6, 0, -7.15, 1.6, 0.15, -7), curb);
  for (const s of [-1, 1]) { b.add(B(s * RAIL - 0.05, 0.0, -7, s * RAIL + 0.05, 0.03, 0), rail, undefined, false); b.add(B(s * RAIL - 0.05, 0.15, 0.15, s * RAIL + 0.05, 0.18, 4.5), rail, undefined, false); b.add(B(s * RAIL - 0.05, 0.15, -11.5, s * RAIL + 0.05, 0.18, -7.15), rail, undefined, false); }
  // the open track beyond: ballast bed, sleepers, raised rails (both directions)
  for (const [z0, z1] of [[4.5, 160], [-160, -11.5]] as const) {
    b.add(floorQ(-2.0, 2.0, z0, z1, 0.02, 4), ball, undefined, false);
    for (let z = z0 + 0.3; z < z1; z += 0.7) b.add(B(-1.25, 0.02, z, 1.25, 0.12, z + 0.24), sleeper, undefined, false);
    for (const s of [-1, 1]) b.add(B(s * RAIL - 0.05, 0.12, z0, s * RAIL + 0.05, 0.26, z1), rail);
  }
  // concrete strips flanking the track between the blocks
  b.add(floorQ(-7, -2.0, 4.5, 160, 0.01, 2), walk, undefined, false); b.add(floorQ(2.0, 7, 4.5, 160, 0.01, 2), walk, undefined, false);
  b.add(floorQ(-7, -2.0, -160, -11.5, 0.01, 2), walk, undefined, false); b.add(floorQ(2.0, 7, -160, -11.5, 0.01, 2), walk, undefined, false);
  // catenary: poles beside the track (clear of the street) + the contact wire
  const pole = lam("catPole", () => ({ color: "#5a5e6a" }));
  for (const z of [7, 34, 64, 96, -14, -40, -70, -100]) { b.add(cyl(0.12, 0.1, 6.4, 10), pole, At(2.4, 0, z)); b.add(B(-0.2, 6.0, z - 0.05, 2.45, 6.1, z + 0.05), pole); }
  b.add(cyl(0.02, 0.02, 320, 6).rotateX(Math.PI / 2).translate(0, 5.8, 0), lam("wire", () => ({ color: "#2b2b34" })));
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
    if (Math.abs(x - 14) < 3.5) continue; // the parked-car spot in the last shot
    palm(b, x, 3.3, 7.5 + 1.5 * Math.sin(x), Math.abs(x) % 3);
    palm(b, x + 5.5, -10.2, 7.0 + 1.5 * Math.cos(x), Math.abs(x) % 2);
  }
  for (let x = ROAD - 137; x < ROAD + 140; x += 22) { if (Math.abs(x) < 9) continue; lampPost(b, x, 0.6, -1); lampPost(b, x + 11, -7.6, 1); }
  for (const [x, z, face] of MASTS) mast(b, x, z, face);
  b.build(root);
};

// ---------------- gate arms ----------------
/** a gate arm group: pivot at the origin, arm along local +x, tip lamp; inner `hinge` rotates about local z (up/down);
 *  the broken-off piece is a separate group (world.ts flies it after the snap) */
export const makeGateArm = () => {
  const g = new THREE.Group(), hinge = new THREE.Group(); g.add(hinge);
  const m = lam("gateArm", () => ({ map: armTex() }));
  const stub = new THREE.Mesh(boxGeo(V(0, -0.06, -0.05), V(0.9, 0.06, 0.05), 0, true), m); stub.castShadow = true;
  const rest = new THREE.Mesh(boxGeo(V(0.9, -0.06, -0.05), V(ARM_L, 0.06, 0.05), 0, true), m); rest.castShadow = true;
  // UVs: stretch the stripe texture along the arm
  for (const mesh of [stub, rest]) { const uv = mesh.geometry.attributes.uv, pos = mesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / ARM_L * 4, uv.getY(i)); }
  const cw = new THREE.Mesh(boxGeo(V(-0.7, -0.14, -0.12), V(-0.1, 0.14, 0.12), 0, true), lam("mastBlack", () => ({ color: "#26262e" }))); // counterweight
  hinge.add(stub, rest, cw);
  const lampsA: THREE.Mesh[] = [];
  for (const x of [1.4, 2.5, ARM_L - 0.1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glow("armLamp", "#ff4a3a", 1.0)); l.position.set(x, 0.1, 0); hinge.add(l); lampsA.push(l); }
  void ARM_Y;
  return { g, hinge, rest, lamps: lampsA };
};
/** the broken arm piece that flies off (same look as the arm's outer part), centred on its middle */
export const makeArmPiece = () => {
  const m = lam("gateArm", () => ({ map: armTex() }));
  const L = ARM_L - 0.9, mesh = new THREE.Mesh(boxGeo(V(-L / 2, -0.06, -0.05), V(L / 2, 0.06, 0.05), 0, true), m);
  const uv = mesh.geometry.attributes.uv, pos = mesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + L / 2) / ARM_L * 4, uv.getY(i));
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh); return g;
};

// ---------------- vehicles ----------------
const glassTex = (broken: boolean) => ctex(broken ? "glassBroken" : "glassOk", 256, 256, (g, r) => {
  g.fillStyle = "#5a7fb8"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.moveTo(30, 256); g.lineTo(90, 0); g.lineTo(120, 0); g.lineTo(60, 256); g.fill();
  if (!broken) return;
  // a smashed pane: a dark hole, white crazing radiating from it
  g.fillStyle = "#1e2232"; g.beginPath(); for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283, rr = 46 + r() * 30; g.lineTo(128 + rr * Math.cos(a) * 1.3, 120 + rr * Math.sin(a)); } g.fill();
  g.strokeStyle = "#f4f6ff"; g.lineWidth = 5;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283 + r() * 0.2; g.beginPath(); let x = 128 + 60 * Math.cos(a) * 1.3, y = 120 + 60 * Math.sin(a); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += 40 * Math.cos(a + (r() - 0.5) * 0.6) * 1.3; y += 40 * Math.sin(a + (r() - 0.5) * 0.6); g.lineTo(x, y); } g.stroke(); }
  for (const rr of [80, 115]) { g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * 6.283; g.lineTo(128 + (rr + (r() - 0.5) * 14) * Math.cos(a) * 1.3, 120 + (rr + (r() - 0.5) * 14) * Math.sin(a)); } g.stroke(); }
});
/** the white robotaxi SUV: 4.7 m, front toward +x, origin on the ground at the centre. Open window frames (no side glass,
 *  open windscreen) so the seated cards read; a glass rear window that can be swapped for a smashed one; a spinning roof
 *  sensor; reverse lights toggled in world.ts. Driver seat on local -z (left-hand drive) - empty. */
export const makeRobo = () => {
  const g = new THREE.Group();
  const body = lam("roboBody", () => ({ color: "#f3f1ea" })), dark = lam("roboDark", () => ({ color: "#2b2d36" })), grey = lam("roboGrey", () => ({ color: "#b9bec8" }));
  const seat = lam("roboSeat", () => ({ color: "#3a3c4a" }));
  const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boxGeo(V(x0, y0, z0), V(x1, y1, z1), 0, true);
  addParts(g, [
    [bx(-2.3, 0.32, -0.95, 2.3, 0.98, 0.95), body], // lower body
    [bx(-2.36, 0.3, -0.9, -2.28, 0.55, 0.9), grey], [bx(2.28, 0.3, -0.9, 2.38, 0.55, 0.9), grey], // bumpers
    [bx(1.1, 0.98, -0.92, 2.25, 1.06, 0.92), body], // bonnet
    [bx(2.3, 0.55, -0.55, 2.33, 0.78, 0.55), dark], // grille
    [bx(1.02, 0.98, -0.93, 1.12, 1.55, -0.83), body], [bx(1.02, 0.98, 0.83, 1.12, 1.55, 0.93), body], // A pillars
    [bx(-0.08, 0.98, -0.95, 0.04, 1.55, -0.85), body], [bx(-0.08, 0.98, 0.85, 0.04, 1.55, 0.95), body], // B pillars
    [bx(-1.95, 0.98, -0.95, -1.7, 1.55, -0.85), body], [bx(-1.95, 0.98, 0.85, -1.7, 1.55, 0.95), body], // C pillars
    [bx(-2.0, 1.52, -0.92, 1.12, 1.62, 0.92), body], // roof
    [bx(-2.3, 0.98, -0.92, -1.95, 1.06, 0.92), body], // rear deck under the hatch glass
    [bx(-2.32, 0.98, -0.93, -2.02, 1.52, -0.84), body], [bx(-2.32, 0.98, 0.84, -2.02, 1.52, 0.93), body], // hatch sides
    // seats: rear bench, two front seats (driver side empty, steering wheel)
    [bx(-0.95, 0.45, -0.8, -0.2, 0.62, 0.8), seat], [bx(-1.05, 0.62, -0.8, -0.9, 1.2, 0.8), seat],
    [bx(0.25, 0.45, -0.75, 0.8, 0.6, -0.12), seat], [bx(0.18, 0.6, -0.75, 0.32, 1.02, -0.12), seat],
    [bx(0.25, 0.45, 0.12, 0.8, 0.6, 0.75), seat], [bx(0.18, 0.6, 0.12, 0.32, 1.02, 0.75), seat],
    [bx(0.95, 0.75, -0.88, 1.15, 1.0, 0.88), dark], // dashboard
    // side camera pods + mirrors
    [bx(1.9, 1.0, -1.02, 2.1, 1.12, -0.93), dark], [bx(1.9, 1.0, 0.93, 2.1, 1.12, 1.02), dark],
    [bx(0.95, 1.08, -1.08, 1.08, 1.2, -0.93), dark], [bx(0.95, 1.08, 0.93, 1.08, 1.2, 1.08), dark],
  ]);
  // steering wheel at the empty driver seat
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 28), dark); ring.position.set(0.88, 1.0, -0.42); ring.rotation.set(0, Math.PI / 2, 0); ring.rotateX(-0.4); g.add(ring);
  // rear window glass (slanted), swappable map
  const gm = new THREE.MeshLambertMaterial({ map: glassTex(false) });
  const rg = new THREE.Mesh(quad(V(-2.2, 1.02, -0.84), V(-2.2, 1.02, 0.84), V(-1.98, 1.5, 0.84), V(-1.98, 1.5, -0.84)), twoTone(gm)); gm.side = THREE.DoubleSide;
  rg.castShadow = true; g.add(rg);
  // windscreen frame top + a faint glass sheen is skipped (open, so the empty driver seat reads)
  // lights
  for (const z of [-0.68, 0.68]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.32), glow("roboHead", "#fff6d0", 1.8)); hl.position.set(2.31, 0.86, z); g.add(hl); }
  for (const z of [-0.74, 0.74]) { const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), glow("roboTail", "#ff3a2a", 1.6)); tl.position.set(-2.31, 0.86, z); g.add(tl); }
  const rev: THREE.Mesh[] = [];
  for (const z of [-0.42, 0.42]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.3, 0.3) })); rl.position.set(-2.33, 0.68, z); g.add(rl); rev.push(rl); }
  // roof sensor: pedestal + spinning drum with a light band and a marker
  addParts(g, [[cyl(0.2, 0.24, 0.12, 20).translate(0.2, 1.62, 0), dark]]);
  const dome = new THREE.Group(); dome.position.set(0.2, 1.74, 0); g.add(dome);
  addParts(dome, [[cyl(0.21, 0.21, 0.2, 24), dark], [cyl(0.215, 0.215, 0.05, 24).translate(0, 0.07, 0), grey], [new THREE.BoxGeometry(0.06, 0.12, 0.08).translate(0.2, 0.1, 0), lam("domeMark", () => ({ color: "#5ac8e8" }))]]);
  addParts(dome, [[new THREE.SphereGeometry(0.21, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.2, 0), dark]]);
  for (const s of [-1, 1]) addParts(g, [[cyl(0.07, 0.07, 0.14, 12).translate(1.0, 1.62, s * 0.78), dark]]); // roof corner sensors
  const wheels = wheelSet(g, [[-1.45, 0.86], [-1.45, -0.86], [1.45, 0.86], [1.45, -0.86]], 0.36, 0.26, "#b9bec8");
  return { g, wheels, rear: rg, glassOk: glassTex(false), glassBroken: glassTex(true), gm, rev, dome };
};
/** the red city trolley: two 13 m cars, front toward local +x, origin at the front on the ground */
export const makeTrolley = () => {
  const g = new THREE.Group();
  const red = lam("trolRed", () => ({ color: "#c8302c" })), glass = lam("trolGlass", () => ({ color: "#2e3e62" })), white = lam("trolWhite", () => ({ color: "#efece4" })), dark = lam("trolDark", () => ({ color: "#2b2d36" }));
  const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boxGeo(V(x0, y0, z0), V(x1, y1, z1), 0, true);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [];
  for (const x0 of [-13.2, -27.0]) {
    parts.push([bx(x0, 0.35, -1.33, x0 + 13.2, 3.4, 1.33), red]);
    parts.push([bx(x0 + 0.6, 1.55, -1.35, x0 + 12.6, 2.6, 1.35), glass]);
    parts.push([bx(x0, 1.25, -1.345, x0 + 13.2, 1.38, 1.345), white]);
    parts.push([bx(x0 + 0.5, 3.4, -1.1, x0 + 12.7, 3.6, 1.1), lam("trolRoof", () => ({ color: "#d8d2c8" }))]);
    for (const dx of [3.0, 9.0]) parts.push([bx(x0 + dx, 0.36, -1.36, x0 + dx + 1.3, 2.6, -1.33), dark], [bx(x0 + dx, 0.36, 1.33, x0 + dx + 1.3, 2.6, 1.36), dark]); // doors
  }
  parts.push([bx(-13.8, 0.6, -1.15, -13.2, 3.2, 1.15), dark]); // articulation
  parts.push([bx(0, 1.55, -1.2, 0.08, 2.9, 1.2), glass]); // windscreen
  parts.push([bx(-6.5, 3.6, -0.05, -6.3, 5.75, 0.05), dark], [bx(-7.4, 5.7, -0.6, -5.4, 5.78, 0.6), dark]); // pantograph
  addParts(g, parts);
  for (const z of [-0.85, 0.85]) { const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16).rotateZ(Math.PI / 2), glow("trolHead", "#fff3c8", 2.6)); hl.position.set(0.04, 0.95, z); g.add(hl); }
  return { g };
};
