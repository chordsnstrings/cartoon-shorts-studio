// The movie-set town of the mirror short (was: the downtown street of the trolley short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): the street, the trolley crossing with its gates and signal masts, towers, palms, lamps, the catenary.
// Vehicles (makeRobo / makeTrolley / makeCar) and the gate arms are groups posed per frame in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep, facadeHD, roofHD, cloudHD, planks, beam } from "./paint";
import { twoTone } from "./shade";
import { ROAD, NORTH, SOUTH, FACE_N, FACE_S, Kind, SIGN } from "./story";

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

void cloudHD; void mountain; void pine; void room; void wallX; void T; void concreteTex; void tiles; void paintWall; void tree; void hill; void grassHD; void roofHD;


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


// ---------------- the movie-set town (x 0): a fake street of flat painted shop fronts on struts ----------------
const ICON_COL: Record<Kind, [string, string, string]> = { // wall, trim/awning, sign board
  shop: ["#f2d7a6", "#e8483c", "#fbf6ea"], pay: ["#cfe3d8", "#2f8f7a", "#fbf6ea"], social: ["#f6c9d2", "#d84a7a", "#fbf6ea"],
  recipe: ["#f6e2b8", "#e8913a", "#fbf6ea"], video: ["#d8d4f2", "#5a5ac8", "#fbf6ea"], mail: ["#cfe0f2", "#3a7fd0", "#fbf6ea"],
};
/** a pictogram (no text) centred at (x, y), size s px: cart, card, heart, chef hat, play button, envelope */
export const drawIcon = (g: CanvasRenderingContext2D, kind: Kind, x: number, y: number, s: number, col: string) => {
  const u = s / 100, ink = "#241726";
  g.save(); g.translate(x, y); g.scale(u, u); g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = 7;
  const fillStroke = (f: string) => { g.fillStyle = f; g.fill(); g.strokeStyle = ink; g.stroke(); };
  if (kind === "shop") {
    g.beginPath(); g.moveTo(-48, -34); g.lineTo(-34, -34); g.lineTo(-22, 22); g.lineTo(34, 22); g.lineTo(44, -20); g.lineTo(-30, -20); g.strokeStyle = ink; g.lineWidth = 9; g.stroke();
    g.beginPath(); g.moveTo(-27, -12); g.lineTo(40, -12); g.lineTo(32, 14); g.lineTo(-20, 14); g.closePath(); fillStroke(col);
    for (const cx of [-14, 26]) { g.beginPath(); g.arc(cx, 36, 8, 0, 6.283); fillStroke("#fbf6ea"); }
  } else if (kind === "pay") {
    g.beginPath(); g.roundRect(-46, -30, 92, 60, 10); fillStroke(col);
    g.fillStyle = ink; g.fillRect(-46, -16, 92, 12); g.fillStyle = "#f7d24a"; g.fillRect(-32, 6, 20, 14);
  } else if (kind === "social") {
    g.beginPath(); g.moveTo(0, 34); g.bezierCurveTo(-60, -6, -36, -52, 0, -22); g.bezierCurveTo(36, -52, 60, -6, 0, 34); fillStroke(col);
  } else if (kind === "recipe") {
    g.beginPath(); g.arc(-22, -10, 20, 0, 6.283); g.arc(0, -22, 24, 0, 6.283); g.arc(22, -10, 20, 0, 6.283); fillStroke("#fbf6ea");
    g.beginPath(); g.roundRect(-24, -6, 48, 34, 4); fillStroke("#fbf6ea"); g.beginPath(); g.moveTo(-24, 18); g.lineTo(24, 18); g.stroke();
  } else if (kind === "video") {
    g.beginPath(); g.roundRect(-46, -32, 92, 64, 18); fillStroke(col);
    g.beginPath(); g.moveTo(-12, -18); g.lineTo(18, 0); g.lineTo(-12, 18); g.closePath(); g.fillStyle = "#fbf6ea"; g.fill();
  } else {
    g.beginPath(); g.rect(-46, -30, 92, 60); fillStroke("#fbf6ea"); g.beginPath(); g.moveTo(-46, -30); g.lineTo(0, 6); g.lineTo(46, -30); g.strokeStyle = col; g.lineWidth = 9; g.stroke();
  }
  g.restore();
};
/** the painted face of a prop shop front: wall, door, two windows with the icon, a sign board with a big icon, a painted plinth */
const frontTex = (key: string, kind: Kind, wm: number, hm: number) => {
  const PX = 64, W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  const [wall, trim, board] = ICON_COL[kind];
  return ctex("front" + key, W, H, (g, r) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; g.beginPath(); g.ellipse(r() * W, r() * H, 30 + r() * 60, 15 + r() * 30, r() * 3, 0, 6.283); g.fill(); }
    // painted-on fake "depth": a cornice band and a plinth
    g.fillStyle = trim; g.fillRect(0, 0, W, m(0.35)); g.fillStyle = "rgba(36,23,38,0.25)"; g.fillRect(0, m(0.35), W, m(0.08));
    g.fillStyle = jit(r, "#b9a58e", 0.05); g.fillRect(0, H - m(0.45), W, m(0.45));
    // sign board (top) with a big icon
    const bw = Math.min(m(3.6), W - m(1.2)), bx = (W - bw) / 2, by = m(0.8), bh = m(1.4);
    g.fillStyle = board; g.strokeStyle = "#241726"; g.lineWidth = 6; g.beginPath(); g.roundRect(bx, by, bw, bh, m(0.18)); g.fill(); g.stroke();
    drawIcon(g, kind, W / 2, by + bh / 2, m(1.1), trim);
    // door (centre bottom) and two windows
    const dw = m(1.1), dh = m(2.2), dx = (W - dw) / 2, dy = H - m(0.45) - dh;
    g.fillStyle = trim; g.fillRect(dx - m(0.1), dy - m(0.1), dw + m(0.2), dh + m(0.1));
    g.fillStyle = "#6a4a3a"; g.fillRect(dx, dy, dw, dh); g.fillStyle = "#7a8ab8"; g.fillRect(dx + m(0.18), dy + m(0.2), dw - m(0.36), m(0.8));
    g.fillStyle = "#f7d24a"; g.beginPath(); g.arc(dx + dw - m(0.18), dy + m(1.25), m(0.06), 0, 6.283); g.fill();
    for (const s of [-1, 1]) {
      const ww = m(1.3), wh = m(1.5), wx = W / 2 + s * m(1.45) - ww / 2, wy = dy + m(0.15);
      if (wx < m(0.15) || wx + ww > W - m(0.15)) continue;
      g.fillStyle = "#fbf6ea"; g.fillRect(wx - m(0.1), wy - m(0.1), ww + m(0.2), wh + m(0.2));
      g.fillStyle = "#8a9ccc"; g.fillRect(wx, wy, ww, wh);
      g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = m(0.06); g.beginPath(); g.moveTo(wx + m(0.2), wy + wh - m(0.2)); g.lineTo(wx + m(0.6), wy + m(0.2)); g.stroke();
      drawIcon(g, kind, wx + ww / 2, wy + wh * 0.62, m(0.6), trim);
    }
    // upper floor painted windows (it's a flat board: these are just paint)
    if (hm > 6.5) for (const s of [-1, 0, 1]) { const ww = m(0.8), wx = W / 2 + s * m(1.4) - ww / 2; if (wx < m(0.1) || wx + ww > W - m(0.1)) continue; g.fillStyle = "#fbf6ea"; g.fillRect(wx - m(0.08), m(2.55), ww + m(0.16), m(1.0)); g.fillStyle = "#8a9ccc"; g.fillRect(wx, m(2.62), ww, m(0.86)); }
  });
};
const stripeTex = (col: string) => ctex("awnStripe" + col, 256, 64, (g) => { g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, 256, 64); g.fillStyle = col; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 64); });
const dirtTex = () => ctex("lotDirt", 512, 512, (g, r) => {
  g.fillStyle = "#d4bd92"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,250,235,0.10)" : "rgba(120,90,60,0.08)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 30 + r() * 70, 14 + r() * 30, r() * 3, 0, 6.283); g.fill(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,70,50,0.12)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
const streetTex = () => ctex("setStreet", 512, 512, (g, r) => {
  // one tile = 8 m along x by 5 m across (z +2.5 at v 0 .. -2.5 at v 1)
  g.fillStyle = "#5c5a66"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 5, 5); }
  g.fillStyle = "#f1efe6"; for (let x = 0; x < 512; x += 128) g.fillRect(x + 16, 250, 64, 12); // dashed centre line
});
/** the weird web address on the signpost: a strip of jumbled glyph shapes (spirals, zigzags, keyholes, dots) - no letters */
export const addrTex = () => ctex("addrSign", 1024, 256, (g) => {
  g.fillStyle = "#2f8f5a"; g.fillRect(0, 0, 1024, 256); g.strokeStyle = "#fbf6ea"; g.lineWidth = 12; g.strokeRect(14, 14, 996, 228);
  const cols = ["#fbf6ea", "#ffd84a", "#ff8fb0", "#7ff6ff"];
  for (let i = 0; i < 11; i++) {
    const x = 70 + i * 88, y = 128, c = cols[i % 4]; g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 11; g.lineCap = "round";
    const k = (i * 7) % 6;
    g.beginPath();
    if (k === 0) { for (let a = 0; a < 12; a += 0.3) { const rr = 4 + a * 2.6; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.stroke(); }
    else if (k === 1) { for (let j = 0; j < 10; j++) { const rr = j % 2 ? 14 : 34, a = -Math.PI / 2 + (j * Math.PI) / 5; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); g.fill(); }
    else if (k === 2) { g.moveTo(x, y + 30); g.bezierCurveTo(x - 46, y - 2, x - 26, y - 38, x, y - 14); g.bezierCurveTo(x + 26, y - 38, x + 46, y - 2, x, y + 30); g.fill(); }
    else if (k === 3) { for (const [dx, dy] of [[-18, -22], [14, -8], [-6, 18], [20, 28]]) { g.beginPath(); g.arc(x + dx, y + dy, 9, 0, 6.283); g.fill(); } }
    else if (k === 4) { g.arc(x, y, 26, 0, 6.283); g.stroke(); g.beginPath(); g.arc(x, y, 8, 0, 6.283); g.fill(); }
    else { g.moveTo(x, y - 32); g.lineTo(x + 30, y + 26); g.lineTo(x - 30, y + 26); g.closePath(); g.fill(); g.beginPath(); g.fillStyle = "#2f8f5a"; g.arc(x, y + 8, 9, 0, 6.283); g.fill(); }
  }
});
/** one prop shop front: a flat board facing the street (face +1 = faces +z), plywood back, two struts + sandbags behind */
const front = (b: Batch, x0: number, w: number, h: number, kind: Kind, zFace: number, face: 1 | -1, k: number) => {
  const fm = lam(`front${k}`, () => ({ map: frontTex(`${k}`, kind, w, h) }));
  const back = lam("plyBack", () => ({ map: rep(planks(), 1, 1) }));
  const edge = lam("plyEdge", () => ({ color: "#b98a5a" }));
  const T2 = 0.14, zb = zFace - face * T2;
  if (face > 0) { b.add(quad(V(x0, 0, zFace), V(x0 + w, 0, zFace), V(x0 + w, h, zFace), V(x0, h, zFace)), fm); b.add(quad(V(x0 + w, 0, zb), V(x0, 0, zb), V(x0, h, zb), V(x0 + w, h, zb), w / 3, h / 3), back); }
  else { b.add(quad(V(x0 + w, 0, zFace), V(x0, 0, zFace), V(x0, h, zFace), V(x0 + w, h, zFace)), fm); b.add(quad(V(x0, 0, zb), V(x0 + w, 0, zb), V(x0 + w, h, zb), V(x0, h, zb), w / 3, h / 3), back); }
  b.add(quad(V(x0, 0, zb), V(x0, 0, zFace), V(x0, h, zFace), V(x0, h, zb)).scale(1, 1, 1), edge);
  b.add(B(x0 + w - 0.001, 0, Math.min(zb, zFace), x0 + w, h, Math.max(zb, zFace)), edge);
  b.add(B(x0, h - 0.001, Math.min(zb, zFace), x0 + w, h, Math.max(zb, zFace)), edge);
  // awning: a sloped striped board over the door
  const [, trim] = ICON_COL[kind];
  const aw = lam("awn" + trim, () => ({ map: rep(stripeTex(trim), Math.max(1, Math.round(w / 1.5)), 1) }));
  const ag = new THREE.BoxGeometry(Math.min(w - 0.6, 3.4), 0.06, 1.0); ag.rotateX(face * 0.38);
  b.add(ag, aw, At(x0 + w / 2, 2.95, zFace + face * 0.45));
  // struts: two diagonal beams from 3/4 height down to the lot behind, a cross brace, sandbags at the feet
  const bm = lam("strut", () => ({ map: rep(beam(), 1, 3) }));
  const bag = lam("sandbag", () => ({ color: "#c9b48a" }));
  for (const fx of [0.22, 0.78]) {
    const x = x0 + w * fx, top = V(x, h * 0.72, zb - face * 0.08), foot = V(x, 0.05, zb - face * 2.8);
    const L = top.distanceTo(foot), g = new THREE.BoxGeometry(0.16, L, 0.16);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize());
    b.add(g, bm, new THREE.Matrix4().compose(top.clone().add(foot).multiplyScalar(0.5), q, V(1, 1, 1)));
    const sg = new THREE.SphereGeometry(0.42, 14, 10); sg.scale(1, 0.45, 0.7);
    b.add(sg, bag, At(x, 0.16, foot.z - face * 0.1, 0, 0.3)); b.add(sg, bag, At(x + 0.25, 0.42, foot.z - face * 0.05, 0, -0.4));
  }
  b.add(B(x0 + w * 0.2, h * 0.36 - 0.07, zb - face * 0.12 - 0.07, x0 + w * 0.8, h * 0.36 + 0.07, zb - face * 0.12 + 0.07), bm);
};
/** a film light on a tripod (set dressing at the street ends), pointing at (tx, tz) */
const filmLight = (b: Batch, x: number, z: number, ry: number) => {
  const pole = lam("lampPole", () => ({ color: "#3a3e4a" }));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, g = new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6); g.translate(0, 1.0, 0); b.add(g, pole, new THREE.Matrix4().compose(V(x + 0.45 * Math.cos(a), 0, z + 0.45 * Math.sin(a)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22 * Math.sin(a), 0, 0.22 * Math.cos(a))), V(1, 1, 1))); }
  b.add(cyl(0.05, 0.05, 3.2, 8), pole, At(x, 0, z));
  b.add(new THREE.BoxGeometry(0.9, 0.7, 0.6), lam("lightBox", () => ({ color: "#2b2f3a" })), At(x, 3.5, z, 0.2, ry));
};
export const buildSet = (root: THREE.Object3D) => {
  const b = new Batch();
  const street = lam("setStreet", () => ({ map: rep(streetTex(), 1, 1) }));
  const kerb = lam("sidewalk", () => ({ color: "#d6cfc2" }));
  const dirt = lam("lotDirt", () => ({ map: rep(dirtTex(), 1, 1) }));
  const grassM = lam("lotGrass", () => ({ map: rep(grassHD(), 1, 1) }));
  for (let x = ROAD - 48; x < ROAD + 48; x += 8) b.add(quad(V(x, 0.01, 2.5), V(x + 8, 0.01, 2.5), V(x + 8, 0.01, -2.5), V(x, 0.01, -2.5), 1, 1), street, undefined, false);
  for (const [z0, z1] of [[2.5, 4.0], [-4.0, -2.5]] as const) b.add(floorQ(ROAD - 48, ROAD + 48, z0, z1, 0.06, 2), kerb, undefined, false);
  // the empty lot around the set (dirt), grass beyond it
  for (let x = -120; x < 120; x += 12) for (let z = -60; z < 60; z += 12) b.add(floorQ(x, x + 12, z, z + 12, 0, 12), dirt, undefined, false);
  for (let x = -500; x < 500; x += 40) for (let z = -500; z < 500; z += 40) { if (x >= -120 && x < 120 && z >= -60 && z < 60) continue; b.add(floorQ(x, x + 40, z, z + 40, -0.02, 20), grassM, undefined, false); }
  let k = 0;
  for (const [x0, w, h, kind] of NORTH) front(b, x0, w, h, kind, FACE_N, 1, k++);
  for (const [x0, w, h, kind] of SOUTH) front(b, x0, w, h, kind, FACE_S, -1, k++);
  // set dressing: film lights at both street ends, a few trees and hills round the lot
  filmLight(b, -38, -6, 0.6); filmLight(b, -38, 6, -0.6); filmLight(b, 31, 6.5, 2.4); filmLight(b, 31, -6.5, -2.4);
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, R = 70 + (i % 3) * 14; tree(b, R * Math.cos(a) * 1.5, R * Math.sin(a), 1.6 + (i % 3) * 0.4, i); }
  const hm = lam("hillGreen", () => ({ color: "#7fae5a" })), hm2 = lam("hillBlue", () => ({ color: "#8fa8c8" }));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2; hill(b, 260 * Math.cos(a), 220 * Math.sin(a), 70 + (i % 3) * 25, 30 + (i % 4) * 12, i % 2 ? hm : hm2); }
  // the address signpost (shot 6)
  b.add(cyl(0.07, 0.06, 2.6, 10), lam("lampPole", () => ({ color: "#3a3e4a" })), At(SIGN[0], 0, SIGN[1]));
  b.add(quad(V(SIGN[0] - 0.95, 2.05, SIGN[1] + 0.03), V(SIGN[0] + 0.95, 2.05, SIGN[1] + 0.03), V(SIGN[0] + 0.95, 2.52, SIGN[1] + 0.03), V(SIGN[0] - 0.95, 2.52, SIGN[1] + 0.03)), glow("addrSign", "#ffffff", 0.95, addrTex()));
  b.add(B(SIGN[0] - 0.97, 2.03, SIGN[1] - 0.02, SIGN[0] + 0.97, 2.54, SIGN[1] + 0.025), lam("signBack", () => ({ color: "#2f8f5a" })));
  b.build(root);
};

// ---------------- the giant mousetrap (the "trap"), ~1.5 m: base along local x, snap bar pivots about the z axis at x 0 ----------------
export const makeTrap = (k: number) => {
  const g = new THREE.Group();
  const wood = lam("trapWood", () => ({ color: "#e3b36e" })), wire = lam("trapWire", () => ({ color: "#9aa3ad" })), plate = lam("trapPlate", () => ({ color: "#d9a441" }));
  const base = new THREE.Mesh(boxGeo(V(-0.75, 0, -0.4), V(0.75, 0.1, 0.4)), wood); base.castShadow = base.receiveShadow = true; g.add(base);
  const pl = new THREE.Mesh(boxGeo(V(-0.6, 0.1, -0.16), V(-0.3, 0.13, 0.16)), plate); g.add(pl);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), wire); coil.position.set(0, 0.12, 0.3); coil.rotation.y = Math.PI / 2; g.add(coil);
  const coil2 = coil.clone(); coil2.position.z = -0.3; g.add(coil2);
  const bar = new THREE.Group(); bar.position.set(0, 0.12, 0);
  const rod = (a: THREE.Vector3, c: THREE.Vector3) => { const L = a.distanceTo(c), m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 8), wire); m.position.copy(a.clone().add(c).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()); m.castShadow = true; bar.add(m); };
  rod(V(0, 0, -0.34), V(0.66, 0, -0.34)); rod(V(0, 0, 0.34), V(0.66, 0, 0.34)); rod(V(0.66, 0, -0.34), V(0.66, 0, 0.34)); rod(V(0, 0, -0.34), V(0, 0, 0.34));
  g.add(bar);
  // bait: a little gift box with a ribbon on the plate
  const bait = new THREE.Group(); bait.position.set(-0.45, 0.13, 0);
  const bx = new THREE.Mesh(boxGeo(V(-0.13, 0, -0.13), V(0.13, 0.24, 0.13)), lam("bait" + (k % 2), () => ({ color: k % 2 ? "#3a7fd0" : "#d84a7a" }))); bx.castShadow = true; bait.add(bx);
  const rb = lam("ribbon", () => ({ color: "#ffd84a" }));
  bait.add(new THREE.Mesh(boxGeo(V(-0.135, 0, -0.035), V(0.135, 0.245, 0.035)), rb), new THREE.Mesh(boxGeo(V(-0.035, 0, -0.135), V(0.035, 0.245, 0.135)), rb));
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), rb); bow.position.set(0, 0.28, 0); bait.add(bow);
  g.add(bait);
  return { g, bar, bait };
};
