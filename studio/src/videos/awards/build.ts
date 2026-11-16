// The places of the AI-music-awards short (theatre + red-carpet lobby); helpers from the floppy-disk short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): airport, control room, US flight map, highway.
// Static geometry is merged per material; moving parts (planes, truck, screens, the floppy) live in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, water, facadeHD, roofHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { THEATRE, LOBBY, STAGE_Y, STAGE_FRONT, SCREEN, PODIUM, MIC, POD, TOWER } from "./story";

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

void tiles; void concreteTex; void hill; void tree; void T;

// ======================= the AI-music-awards short's places =======================
const carpetTex = () => ctex("carpetRed", 256, 256, (g, r) => {
  g.fillStyle = "#b8303a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 320; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
});
const marbleTex = () => ctex("marble", 512, 512, (g, r) => {
  const n = 4, t = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? jit(r, "#efe8da", 0.03, 2, 0.05) : jit(r, "#d9cdb8", 0.03, 2, 0.05); g.fillRect(i * t, j * t, t, t); }
  g.strokeStyle = "rgba(60,44,50,0.55)"; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(512, i * t); g.stroke(); }
});
/** step-and-repeat backdrop: stars and music notes, no letters */
const backdropTex = () => ctex("backdrop", 512, 512, (g) => {
  g.fillStyle = "#22305e"; g.fillRect(0, 0, 512, 512);
  const star = (cx: number, cy: number, R: number, col: string) => {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    g.closePath(); g.fill();
  };
  const note = (cx: number, cy: number, col: string) => {
    g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, 22, 16, -0.35, 0, 6.283); g.fill();
    g.fillRect(cx + 16, cy - 70, 9, 70); g.beginPath(); g.moveTo(cx + 25, cy - 70); g.lineTo(cx + 55, cy - 52); g.lineTo(cx + 55, cy - 38); g.lineTo(cx + 25, cy - 54); g.fill();
  };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = 64 + i * 128 + (j % 2) * 64, cy = 64 + j * 128;
    if ((i + j) % 2) star(cx % 512, cy, 34, "#f2c43a"); else note((cx % 512) - 18, cy + 30, "#e9edf6");
  }
});
const seatTex = () => ctex("seatFab", 128, 128, (g, r) => {
  g.fillStyle = "#8a2a3a"; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 120; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 128, r() * 128, 3, 3); }
});

/** the awards theatre (x 0): stage with a big screen (picture in world.ts), red curtains, podium, mic, speaker stacks,
 *  the announcer pod (glow ring in world.ts), a lighting truss and rows of red seats */
export const buildTheatre = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = THEATRE;
  room(b, X, 18, 18, 8, lam("audFloor", () => ({ color: "#3a2c4a" })), lam("audWall", () => ({ color: "#3a2650" })), lam("audCeil", () => ({ color: "#1e1630" })), 2);
  const deck = lam("stageDeck", () => ({ map: rep(ctex("deckWood", 512, 512, (g, r) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = jit(r, "#6a4a3a", 0.05, 3, 0.08); g.fillRect(0, i * 64, 512, 64); g.fillStyle = "rgba(20,10,14,0.75)"; g.fillRect(0, i * 64, 512, 3); }
  }), 1, 1) }));
  const edge = lam("stageEdge", () => ({ color: "#26203a" }));
  b.add(B(X - 5.6, 0, -4.6, X + 5.6, STAGE_Y, STAGE_FRONT, 1.2), deck);
  b.add(B(X - 5.6, STAGE_Y - 0.07, STAGE_FRONT - 0.02, X + 5.6, STAGE_Y, STAGE_FRONT + 0.04), glow("stageLip", "#ff7ad9", 1.6));
  b.add(B(X - 5.6, 0, STAGE_FRONT, X + 5.6, STAGE_Y - 0.07, STAGE_FRONT + 0.02), edge);
  // back wall panel behind the screen + the screen frame
  const s = SCREEN;
  b.add(B(X - 5.6, STAGE_Y, -4.6, X + 5.6, 7.6, -4.4), lam("backWall", () => ({ color: "#241a3a" })), undefined, false);
  b.add(B(s.x - s.w / 2 - 0.12, s.y - s.h / 2 - 0.12, s.z - 0.1, s.x + s.w / 2 + 0.12, s.y + s.h / 2 + 0.12, s.z - 0.01), lam("monBlack", () => ({ color: "#22252e" })));
  // red curtains: folds as cylinders on both sides + a scalloped valance
  const cur = [lam("curtA", () => ({ color: "#b8283a" })), lam("curtB", () => ({ color: "#9a1f30" }))];
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = X + side * (3.75 + i * 0.22), z = -3.9 + 0.08 * (i % 2);
    b.add(cyl(0.16, 0.13, 7.0, 10), cur[i % 2], At(x, STAGE_Y, z));
  }
  for (let i = 0; i < 26; i++) b.add(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, -1.1, 0.5), cur[i % 2], At(X - 5.5 + i * 0.44, 6.0, -3.75));
  b.add(B(X - 5.7, 6.0, -3.95, X + 5.7, 7.6, -3.6), cur[0]);
  b.add(B(X - 5.7, 5.95, -3.6, X + 5.7, 6.05, -3.55), lam("gold", () => ({ color: "#e0b040" })));
  // podium: wooden body, gold trim, a star on the front, slanted top + a gooseneck mic
  const [px, py, pz] = PODIUM, wood = lam("podWood", () => ({ color: "#5a3a2e" })), gold = lam("gold", () => ({ color: "#e0b040" }));
  b.add(B(px - 0.42, py, pz - 0.28, px + 0.42, py + 1.08, pz + 0.28), wood);
  b.add(B(px - 0.46, py + 1.08, pz - 0.32, px + 0.46, py + 1.14, pz + 0.34), gold);
  b.add(B(px - 0.44, py + 0.06, pz + 0.28, px + 0.44, py + 0.12, pz + 0.3), gold);
  const starT = ctex("podStar", 256, 256, (g) => {
    g.fillStyle = "#5a3a2e"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#f2c43a"; g.strokeStyle = "#241726"; g.lineWidth = 10; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 44 : 100; g.lineTo(128 + rr * Math.cos(a), 128 + rr * Math.sin(a)); }
    g.closePath(); g.fill(); g.stroke();
  });
  b.add(quad(V(px - 0.3, py + 0.35, pz + 0.282), V(px + 0.3, py + 0.35, pz + 0.282), V(px + 0.3, py + 0.95, pz + 0.282), V(px - 0.3, py + 0.95, pz + 0.282)), lam("podStarM", () => ({ map: starT })));
  const black = lam("monBlack", () => ({ color: "#22252e" })), chrome = lam("chrome", () => ({ color: "#c9ced8" }));
  b.add(cyl(0.012, 0.012, 0.32, 8), black, At(px - 0.15, py + 1.14, pz + 0.1, 0.5, 0, 0));
  b.add(new THREE.SphereGeometry(0.035, 12, 10), black, At(px - 0.15, py + 1.42, pz + 0.26));
  const [mx, , mz] = MIC;
  // speaker stacks at both front corners of the stage
  const spk = lam("spkBox", () => ({ color: "#2a2a34" })), cone = lam("spkCone", () => ({ color: "#4a4a5a" }));
  for (const sx of [-4.7, 4.7]) for (let k = 0; k < 2; k++) {
    const y0 = STAGE_Y + k * 0.82;
    b.add(B(X + sx - 0.42, y0, -0.2, X + sx + 0.42, y0 + 0.8, 0.45), spk);
    b.add(cyl(0.26, 0.26, 0.03, 24), cone, At(X + sx, y0 + 0.4, 0.45, Math.PI / 2, 0, 0));
    b.add(cyl(0.1, 0.1, 0.04, 16), black, At(X + sx, y0 + 0.4, 0.47, Math.PI / 2, 0, 0));
  }
  // the AI announcer: a black speaker pod on two cables (its glowing ring + grille animate in world.ts)
  const [ax, ay, az] = POD;
  b.add(new THREE.SphereGeometry(0.42, 24, 16).scale(1, 0.8, 1), lam("podBody", () => ({ color: "#2a2836" })), At(ax, ay, az));
  for (const cx of [-0.25, 0.25]) b.add(cyl(0.008, 0.008, 8 - ay, 6), black, At(ax + cx, ay + 0.2, az));
  // truss + cans, spot pools
  b.add(B(X - 6, 6.6, -1.2, X + 6, 6.75, -1.05), edge);
  for (let i = -4; i <= 4; i++) b.add(cyl(0.13, 0.1, 0.28, 12), edge, At(X + i * 1.3, 6.3, -1.12));
  b.add(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), glow("spotPool", "#ffe9c8", 0.34), At(mx, STAGE_Y + 0.005, mz + 0.1), false);
  b.add(new THREE.CircleGeometry(1.2, 40).rotateX(-Math.PI / 2), glow("spotPool2", "#ffe9c8", 0.32), At(px, STAGE_Y + 0.005, pz + 0.45), false);
  // seat rows (heads are cards in cast.ts)
  const seat = lam("seatM", () => ({ map: seatTex() }));
  for (let r = 0; r < 5; r++) for (let i = -7; i <= 7; i++) {
    const x = X + i * 0.62 + (r % 2) * 0.31, z = 2.2 + r * 1.0;
    if (Math.abs(x - X) < 0.5) continue; // centre aisle
    b.add(B(x - 0.27, 0, z - 0.05, x + 0.27, 0.95, z + 0.07), seat);
    b.add(B(x - 0.27, 0.35, z - 0.45, x + 0.27, 0.45, z), seat);
  }
  b.build(root);
};

/** the red-carpet lobby (x + 400): marble floor, step-and-repeat backdrop, carpet, brass rope posts, plants
 *  (the AI reporter's stone tower is a moving group in world.ts) */
export const buildLobby = (root: THREE.Object3D) => {
  const b = new Batch();
  const X = LOBBY;
  room(b, X, 12, 10, 4.6, lam("lobFloor", () => ({ map: rep(marbleTex(), 1, 1) })), lam("lobWall", () => ({ map: paintWall("lobWallT", "#e6d6c2", "#b89a7a") })), lam("lobCeil", () => ({ color: "#f2ece0" })), 1.6);
  b.add(wallZ(X - 6, X + 6, 0, 3.6, -2.2, 1.8), lam("backdropM", () => ({ map: rep(backdropTex(), 1, 1) })), undefined, false);
  b.add(B(X - 6, 3.6, -2.25, X + 6, 3.72, -2.15), lam("gold", () => ({ color: "#e0b040" })));
  b.add(B(X - 6, 0, -0.75, X + 6, 0.012, 0.75), lam("carpetM", () => ({ map: rep(carpetTex(), 1, 1) })), undefined, false);
  // rope posts behind the carpet (brass) + velvet rope segments sagging between them
  const brass = lam("brass", () => ({ color: "#d9a640" })), rope = lam("rope", () => ({ color: "#8a1f2c" }));
  const posts = [-4.6, -3.0, -1.4, 0.2];
  for (const x of posts) { b.add(cyl(0.16, 0.16, 0.04, 16), brass, At(X + x, 0, -1.0)); b.add(cyl(0.025, 0.025, 0.95, 8), brass, At(X + x, 0, -1.0)); b.add(new THREE.SphereGeometry(0.05, 10, 8), brass, At(X + x, 0.97, -1.0)); }
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i], c = posts[i + 1], n = 8;
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, y0 = 0.88 - 0.22 * Math.sin(Math.PI * u0), y1 = 0.88 - 0.22 * Math.sin(Math.PI * u1);
      const x0 = a + (c - a) * u0, x1 = a + (c - a) * u1, L = Math.hypot(x1 - x0, y1 - y0);
      const g = new THREE.CylinderGeometry(0.022, 0.022, L, 6); g.rotateZ(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
      b.add(g, rope, At(X + (x0 + x1) / 2, (y0 + y1) / 2, -1.0));
    }
  }
  // potted plants either side of the tower
  for (const [x, z] of [[2.1, -1.5], [-5.2, -1.5]]) {
    b.add(cyl(0.22, 0.18, 0.5, 14), lam("pot2", () => ({ color: "#2a2a34" })), At(X + x, 0, z));
    for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.2, 10, 8), lam(i % 2 ? "leafA" : "leafB", () => ({ color: i % 2 ? "#4f8f3e" : "#6aa84a" })), At(X + x + 0.12 * Math.cos(i * 1.2), 0.62 + 0.12 * i, z + 0.12 * Math.sin(i * 1.2)));
  }
  // ceiling chandelier glow + wall sconces
  b.add(cyl(0.45, 0.2, 0.3, 20), glow("chand", "#fff2d0", 1.6), At(X + 0.3, 4.2, 0.5), false);
  for (const x of [-3.8, 4.4]) b.add(cyl(0.12, 0.06, 0.2, 12), glow("sconce", "#fff0c8", 1.5), At(X + x, 2.6, -2.15), false);
  b.build(root);
};
export { TOWER };
