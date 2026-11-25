// The places of the Mercury short (mission control) + painted planet maps; helpers from the satellite short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): launch pad, radiation lab, clean room, mission control, Arctic ground station, park.
// Static geometry is merged per material; the Earth, rocket, beam and other moving parts are built in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep } from "./paint";
import { twoTone } from "./shade";
import { CTRL, HILL, SCOPE, SCOPE_ALT, SCOPE_AZ } from "./story";

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
const snowTex = () => ctex("snow", 1024, 1024, (g, r) => {
  g.fillStyle = "#eef2fa"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() > 0.5 ? "rgba(200,212,240,0.35)" : "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 60 + r() * 160, 14 + r() * 30, r() * 0.4, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(170,186,225,0.45)"; g.lineWidth = 3;
  for (let i = 0; i < 90; i++) { const x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 6, x + 70 + r() * 40, y); g.stroke(); }
});
const rockSnowTex = () => ctex("rockSnow", 1024, 512, (g, r) => {
  g.fillStyle = "#6f6a7a"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 26; i++) { // snow streaks down from the top
    const x = r() * 1024, w = 30 + r() * 90, h = 160 + r() * 300;
    g.fillStyle = "#f2f5fb"; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 0.2, h); g.lineTo(x - w * 0.3, h * 0.8); g.fill();
  }
  g.fillStyle = "#f2f5fb"; g.fillRect(0, 0, 1024, 70);
  g.fillStyle = "#e8edf8"; g.fillRect(0, 430, 1024, 82);
});
const sandTex = () => ctex("scrub", 1024, 1024, (g, r) => {
  g.fillStyle = "#c9b37e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 220; i++) { g.fillStyle = r() > 0.4 ? "rgba(110,140,70,0.55)" : "rgba(220,200,150,0.5)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 10 + r() * 40, 6 + r() * 18, 0, 0, 6.283); g.fill(); }
});
const concreteTex = () => ctex("concrete", 512, 512, (g, r) => {
  g.fillStyle = "#c7c4bd"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 4, 4); }
  g.strokeStyle = "rgba(60,50,60,0.5)"; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
});
const panelTex = () => ctex("solarPanel", 512, 512, (g) => {
  g.fillStyle = "#2f56b8"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#7d9cf0"; g.lineWidth = 5;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * 512 / 6, 0); g.lineTo(i * 512 / 6, 512); g.stroke(); }
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(240, 0); g.lineTo(0, 300); g.fill();
  g.strokeStyle = "#d7dbe3"; g.lineWidth = 18; g.strokeRect(0, 0, 512, 512);
});
const consoleTex = () => ctex("console", 512, 256, (g, r) => {
  g.fillStyle = "#2c3346"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 30; i++) { g.fillStyle = ["#7ff6ff", "#9dff8a", "#ffd24a", "#ff7a6a"][Math.floor(r() * 4)]; g.beginPath(); g.arc(30 + (i % 10) * 48, 60 + Math.floor(i / 10) * 60, 9, 0, 6.283); g.fill(); }
  g.fillStyle = "#4a5574"; g.fillRect(40, 200, 430, 26);
});
/** monitor screen: orbit lines and a little satellite glyph (no text) */
const screenTex = (key: string, hue: string) => ctex(key, 512, 320, (g, r) => {
  g.fillStyle = "#0f2244"; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = hue; g.lineWidth = 4;
  g.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = 160 + 70 * Math.sin(x / 512 * 6.283 + r()); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.globalAlpha = 0.4; for (let i = 0; i < 6; i++) { g.fillRect(20, 20 + i * 14, 60 + r() * 120, 6); } g.globalAlpha = 1;
  g.fillStyle = hue; g.fillRect(380, 40, 40, 26); g.fillRect(352, 48, 24, 10); g.fillRect(424, 48, 24, 10);
});
/** the big wall screen: Earth disc + orbit ellipse (the moving dot is a separate glow mesh) */
export const wallScreenTex = () => ctex("wallScreen", 1024, 576, (g) => {
  g.fillStyle = "#0b1a3a"; g.fillRect(0, 0, 1024, 576);
  g.strokeStyle = "rgba(120,180,255,0.18)"; g.lineWidth = 2;
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 576); g.stroke(); }
  for (let y = 0; y < 576; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  const gr = g.createRadialGradient(470, 260, 20, 512, 288, 150); gr.addColorStop(0, "#5fc0ff"); gr.addColorStop(1, "#1f5fb8");
  g.fillStyle = gr; g.beginPath(); g.arc(512, 288, 150, 0, 6.283); g.fill();
  g.fillStyle = "#6fcf6a"; for (const [x, y, a, b] of [[470, 240, 50, 34], [560, 320, 40, 50], [520, 190, 30, 14]]) { g.beginPath(); g.ellipse(x, y, a, b, 0.4, 0, 6.283); g.fill(); }
  g.strokeStyle = "#ffd24a"; g.lineWidth = 6; g.setLineDash([18, 14]); g.beginPath(); g.ellipse(512, 288, 330, 200, -0.15, 0, 6.283); g.stroke(); g.setLineDash([]);
  g.strokeStyle = "#2a3c66"; g.lineWidth = 22; g.strokeRect(0, 0, 1024, 576);
});
const hazardTex = () => ctex("hazard", 512, 64, (g) => {
  g.fillStyle = "#f2c43a"; g.fillRect(0, 0, 512, 64);
  g.fillStyle = "#26222a"; for (let x = -64; x < 576; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.fill(); }
});
const starsTexImpl = () => ctex("stars", 2048, 1024, (g, r) => {
  g.clearRect(0, 0, 2048, 1024);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 2048, y = r() * 1024, s = r() < 0.08 ? 2.6 : r() < 0.3 ? 1.6 : 1.0;
    g.fillStyle = r() < 0.15 ? "#ffe8c8" : r() < 0.3 ? "#cfe0ff" : "#ffffff"; g.globalAlpha = 0.5 + 0.5 * r();
    g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 18; i++) { // a few twinkle crosses
    const x = r() * 2048, y = r() * 1024, l = 7 + r() * 6;
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); g.stroke();
  }
});
export const starsTex = starsTexImpl;

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

void mountain; void T; void snowTex; void rockSnowTex; void sandTex; void concreteTex; void panelTex; void hazardTex; void grassHD; void rep; void wallScreenTex;

// ---------------- mission control (x - 1100) ----------------
export const SCREEN_W = 4.6, SCREEN_H = 2.3, SCREEN_Y = 2.35, SCREEN_Z = -3.89;
export const buildCtrl = (root: THREE.Object3D) => {
  const b = new Batch();
  const floor = lam("ctrlFloor", () => ({ map: tiles("ctrlCarpet", "#38456e", 2, "rgba(20,24,40,0.4)") }));
  const wall = lam("ctrlWall", () => ({ map: paintWall("ctrlWallT", "#4a5784", "#2e3860") }));
  room(b, CTRL, 10, 8, 3.7, floor, wall, lam("ctrlCeil", () => ({ color: "#5a6690" })), 1);
  const desk = lam("ctrlDesk", () => ({ color: "#d9dce4" })), cons = lam("ctrlConsole", () => ({ map: consoleTex() }));
  const mon = lam("monBack", () => ({ color: "#2a2f3c" }));
  // one long desk across the room; engineers sit behind it facing the lens
  b.add(B(CTRL - 2.6, 0, -0.85, CTRL + 2.6, 0.74, -0.45), desk);
  b.add(quad(V(CTRL - 2.55, 0.74, -0.45), V(CTRL + 2.55, 0.74, -0.45), V(CTRL + 2.55, 0.8, -0.85), V(CTRL - 2.55, 0.8, -0.85)), cons);
  // small monitors facing the engineers (backs to us), between the seats so faces stay clear
  for (const x of [-1.85, -0.53, 0.53, 1.85]) {
    b.add(B(-0.24, 0, -0.03, 0.24, 0.3, 0.03), mon, At(CTRL + x, 0.84, -0.62, 0, x * 0.12));
    b.add(B(-0.03, 0, -0.03, 0.03, 0.1, 0.03), mon, At(CTRL + x, 0.76, -0.62));
  }
  // chairs behind
  const chair = lam("chair", () => ({ color: "#2c3348" }));
  for (const x of [-1.05, 0, 1.05]) { b.add(B(CTRL + x - 0.3, 0.42, -1.65, CTRL + x + 0.3, 0.5, -1.15), chair); b.add(B(CTRL + x - 0.3, 0.5, -1.72, CTRL + x + 0.3, 1.25, -1.64), chair); }
  // a second, lower desk row in the foreground edge (seen in the wides)
  b.add(B(CTRL - 4.6, 0, 1.9, CTRL - 2.2, 0.74, 2.3), desk); b.add(B(CTRL + 2.2, 0, 1.9, CTRL + 4.6, 0.74, 2.3), desk);
  // the big wall screen's frame (the screen itself is a live canvas mesh in world.ts) + two side screens
  b.add(B(CTRL - SCREEN_W / 2 - 0.12, SCREEN_Y - SCREEN_H / 2 - 0.12, -3.98, CTRL + SCREEN_W / 2 + 0.12, SCREEN_Y + SCREEN_H / 2 + 0.12, -3.9), lam("screenFrame", () => ({ color: "#1c2236" })));
  b.add(B(CTRL - 4.9, 1.5, -3.98, CTRL - 3.0, 2.6, -3.94), lam("sideScreen1", () => ({ map: screenTex("ctrlS1", "#ffd24a") })));
  b.add(B(CTRL + 3.0, 1.5, -3.98, CTRL + 4.9, 2.6, -3.94), lam("sideScreen2", () => ({ map: screenTex("ctrlS2", "#9dff8a") })));
  // ceiling light panels
  for (const x of [-2.5, 0, 2.5]) b.add(B(CTRL + x - 0.7, 3.68, -0.6, CTRL + x + 0.7, 3.695, 0.6), glow("panelLight", "#fff6e0", 1.1), undefined, false);
  b.build(root);
};

/** the wall screen, drawn live (no text): "approve" = Earth wrapped in a swarm of satellite dots + a big green tick that
 *  pops in; "deny" = a dead satellite icon (x eyes) with an arrow toward a Sun icon, crossed by a big red no-sign */
export type WallState = { kind: "approve" | "deny"; pop: number; t: number };
const satIcon = (g: CanvasRenderingContext2D, x: number, y: number, s: number, dead = false) => {
  g.save(); g.translate(x, y); g.rotate(dead ? 0.35 : 0);
  g.fillStyle = "#2f56b8"; g.fillRect(-s * 1.7, -s * 0.4, s * 1.05, s * 0.8); g.fillRect(s * 0.65, -s * 0.4, s * 1.05, s * 0.8);
  g.strokeStyle = "#0b1022"; g.lineWidth = s * 0.08; g.strokeRect(-s * 1.7, -s * 0.4, s * 1.05, s * 0.8); g.strokeRect(s * 0.65, -s * 0.4, s * 1.05, s * 0.8);
  g.fillStyle = dead ? "#b8b0a0" : "#e6b440"; g.fillRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2); g.strokeRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
  if (dead) { g.strokeStyle = "#0b1022"; g.lineWidth = s * 0.1; for (const ex of [-0.25, 0.25]) { g.beginPath(); g.moveTo(s * (ex - 0.12), -s * 0.22); g.lineTo(s * (ex + 0.12), s * 0.02); g.moveTo(s * (ex + 0.12), -s * 0.22); g.lineTo(s * (ex - 0.12), s * 0.02); g.stroke(); } }
  g.restore();
};
export const drawWall = (g: CanvasRenderingContext2D, W_: number, H: number, s: WallState) => {
  g.fillStyle = "#0b1a3a"; g.fillRect(0, 0, W_, H);
  g.strokeStyle = "rgba(120,180,255,0.16)"; g.lineWidth = 2;
  for (let x = 0; x < W_; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W_, y); g.stroke(); }
  const pop = s.pop, k = pop <= 0 ? 0 : pop < 1 ? 0.4 + 0.75 * pop - 0.15 * Math.sin(pop * Math.PI) : 1 + 0.06 * Math.exp(-(pop - 1) * 6) * Math.sin((pop - 1) * 20);
  if (s.kind === "approve") {
    const cx = W_ * 0.5, cy = H * 0.56, R = H * 0.22;
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 10, cx, cy, R); gr.addColorStop(0, "#6fc8ff"); gr.addColorStop(1, "#1f5fb8");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.fill();
    g.fillStyle = "#6fcf6a"; for (const [x, y, a, b] of [[-0.3, -0.2, 0.32, 0.22], [0.28, 0.2, 0.24, 0.3], [0.1, -0.45, 0.2, 0.1]]) { g.beginPath(); g.ellipse(cx + x * R, cy + y * R, a * R, b * R, 0.4, 0, 6.283); g.fill(); }
    // the swarm: hundreds of dots on tilted rings, drifting
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 520; i++) {
      const ring = Math.floor(rnd() * 9), inc = -0.9 + ring * 0.22, rr = R * (1.18 + 0.5 * rnd()), a = rnd() * 6.283 + s.t * (0.25 + 0.05 * ring);
      const x = rr * Math.cos(a), y = rr * 0.42 * Math.sin(a);
      const px = cx + x * Math.cos(inc) - y * Math.sin(inc), py = cy + x * Math.sin(inc) + y * Math.cos(inc);
      if (Math.sin(a) < 0 && Math.hypot(px - cx, py - cy) < R) continue; // behind the planet
      g.fillStyle = i % 5 ? "#e8f4ff" : "#ffd24a"; g.beginPath(); g.arc(px, py, 3.2, 0, 6.283); g.fill();
    }
    if (k > 0) { // the green tick in a disc, top right
      const tx = W_ * 0.62, ty = H * 0.25, r = H * 0.13 * k;
      g.fillStyle = "#2fb14a"; g.beginPath(); g.arc(tx, ty, r, 0, 6.283); g.fill();
      g.strokeStyle = "#ffffff"; g.lineWidth = r * 0.24; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(tx - r * 0.45, ty + r * 0.02); g.lineTo(tx - r * 0.1, ty + r * 0.38); g.lineTo(tx + r * 0.5, ty - r * 0.36); g.stroke(); g.lineCap = "butt";
    }
  } else {
    // dead satellite (left) -> dashed arrow -> the Sun (right)
    const y = H * 0.5;
    satIcon(g, W_ * 0.335, y, H * 0.06, true);
    const sx = W_ * 0.665, sr = H * 0.09;
    const gr = g.createRadialGradient(sx, y, 10, sx, y, sr * 1.4); gr.addColorStop(0, "#fff3b0"); gr.addColorStop(0.6, "#ffc23a"); gr.addColorStop(1, "rgba(255,150,40,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(sx, y, sr * 1.4, 0, 6.283); g.fill();
    g.fillStyle = "#ffd24a"; g.beginPath(); g.arc(sx, y, sr, 0, 6.283); g.fill();
    g.strokeStyle = "#e8f0ff"; g.lineWidth = 10; g.setLineDash([26, 18]); g.beginPath(); g.moveTo(W_ * 0.42, y); g.lineTo(W_ * 0.56, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#e8f0ff"; g.beginPath(); g.moveTo(W_ * 0.59, y); g.lineTo(W_ * 0.56, y - 22); g.lineTo(W_ * 0.56, y + 22); g.fill();
    if (k > 0) { // big red no-sign over the arrow
      const nx = W_ * 0.5, r = H * 0.2 * k;
      g.strokeStyle = "#ff3b3b"; g.lineWidth = r * 0.2; g.beginPath(); g.arc(nx, y, r, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(nx - r * 0.7, y - r * 0.7); g.lineTo(nx + r * 0.7, y + r * 0.7); g.stroke();
      if (Math.floor(s.t * 4) % 2 === 0) { g.strokeStyle = "#ff3b3b"; g.lineWidth = 16; g.strokeRect(8, 8, W_ - 16, H - 16); }
    }
  }
  g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.3, 0); g.lineTo(0, H * 0.55); g.fill();
};

// ---------------- the hill at night (x + 3000) ----------------
export const HILL_R = 50;
/** ground height on the hill at (x, z) */
export const hillY = (x: number, z: number) => { const r2 = (x - HILL) ** 2 + z ** 2; return r2 < HILL_R * HILL_R ? -HILL_R + Math.sqrt(HILL_R * HILL_R - r2) : -HILL_R; };
const nightGrass = () => ctex("nightGrass", 512, 512, (g, r) => {
  g.fillStyle = "#4f8a52"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(60,110,62,0.55)" : "rgba(110,160,96,0.4)"; const x = r() * 512, y = r() * 512; g.fillRect(x, y, 2 + r() * 3, 6 + r() * 8); }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(70,120,70,0.35)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, 6.283); g.fill(); }
});
export const buildHill = (root: THREE.Object3D) => {
  const b = new Batch();
  const gt = nightGrass(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(14, 14);
  const hillM = lam("hillGrass", () => ({ map: gt }));
  const hill = new THREE.SphereGeometry(HILL_R, 128, 64, 0, Math.PI * 2, 0, Math.PI * 0.42);
  b.add(hill, hillM, At(HILL, -HILL_R, 0), false);
  // rolling hills further out (darker), a ring of them, mostly behind (-z)
  const far = lam("farHill", () => ({ color: "#3d6e4a" })), far2 = lam("farHill2", () => ({ color: "#35604a" }));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9, d = 95 + 30 * ((i * 0.37) % 1), r = 45 + 25 * ((i * 0.61) % 1);
    const g = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(1, 0.35, 1);
    b.add(g, i % 2 ? far : far2, At(HILL + d * Math.cos(a), -HILL_R * 0.5, d * Math.sin(a)), false);
  }
  // a few pines round the hilltop (behind and to the sides: the cameras sit at +z)
  const pine = lam("pine", () => ({ color: "#2f6a4a" })), trunk = lam("trunk", () => ({ color: "#6a4a34" }));
  const PINES: [number, number, number][] = [[-7.5, -6, 1.1], [-10, -2.5, 1.3], [6.5, -8.5, 1.2], [9.5, -4, 1.0], [-4, -12, 1.4], [3, -14, 1.3], [12.5, 1.5, 1.2], [-13, 2.5, 1.1]];
  for (const [x, z, s] of PINES) {
    const y = hillY(HILL + x, z) - 0.1;
    b.add(cyl(0.12 * s, 0.1 * s, 0.9 * s, 8), trunk, At(HILL + x, y, z));
    for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry((1.25 - 0.3 * k) * s, (1.6 - 0.2 * k) * s, 9); g.translate(0, (1.6 - 0.2 * k) * s / 2, 0); b.add(g, pine, At(HILL + x, y + (0.7 + 0.75 * k) * s, z)); }
  }
  // the telescope: a tripod + a white tube with a dark eyepiece end and a dew cap
  const legM = lam("tripod", () => ({ color: "#3a3f4c" })), tubeM = lam("tube", () => ({ color: "#f2f0ea" })), capM = lam("tubeCap", () => ({ color: "#2a2f3a" }));
  const apex = V(SCOPE[0], 1.32, SCOPE[2]);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4, foot = V(SCOPE[0] + 0.42 * Math.cos(a), 0, SCOPE[2] + 0.42 * Math.sin(a));
    const len = apex.distanceTo(foot), g = cyl(0.025, 0.025, len, 8);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), apex.clone().sub(foot).normalize());
    b.add(g, legM, new THREE.Matrix4().compose(foot, q, V(1, 1, 1)));
  }
  const dir = V(Math.sin(SCOPE_AZ) * Math.cos(SCOPE_ALT), Math.sin(SCOPE_ALT), -Math.cos(SCOPE_AZ) * Math.cos(SCOPE_ALT)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const back = apex.clone().addScaledVector(dir, -0.42);
  b.add(cyl(0.1, 0.1, 1.25, 24), tubeM, new THREE.Matrix4().compose(back, q, V(1, 1, 1)));
  b.add(cyl(0.115, 0.115, 0.26, 24), capM, new THREE.Matrix4().compose(back.clone().addScaledVector(dir, 1.08), q, V(1, 1, 1)));
  b.add(cyl(0.035, 0.035, 0.16, 12), capM, new THREE.Matrix4().compose(back.clone().addScaledVector(dir, -0.13), q, V(1, 1, 1)));
  b.add(B(apex.x - 0.07, apex.y - 0.1, apex.z - 0.07, apex.x + 0.07, apex.y + 0.02, apex.z + 0.07), legM);
  b.build(root);
};
/** the eyepiece end of the telescope (world point) */
export const EYEPIECE = (() => {
  const dir = new THREE.Vector3(Math.sin(SCOPE_AZ) * Math.cos(SCOPE_ALT), Math.sin(SCOPE_ALT), -Math.cos(SCOPE_AZ) * Math.cos(SCOPE_ALT)).normalize();
  const p = new THREE.Vector3(SCOPE[0], 1.32, SCOPE[2]).addScaledVector(dir, -0.55);
  return [p.x, p.y, p.z] as [number, number, number];
})();

// ---------------- painted planet maps (equirectangular, no text) ----------------
const craters = (g: CanvasRenderingContext2D, r: () => number, n: number, W_: number, H: number, rim: string, pit: string, rmin: number, rmax: number) => {
  for (let i = 0; i < n; i++) {
    const x = r() * W_, y = H * 0.08 + r() * H * 0.84, rr = rmin + (rmax - rmin) * r() ** 2.2, sx = 1 / Math.max(0.35, Math.cos(((y / H) - 0.5) * Math.PI));
    g.fillStyle = pit; g.beginPath(); g.ellipse(x, y, rr * sx, rr, 0, 0, 6.283); g.fill();
    g.strokeStyle = rim; g.lineWidth = Math.max(2, rr * 0.18); g.beginPath(); g.ellipse(x - rr * 0.08 * sx, y - rr * 0.1, rr * sx * 0.92, rr * 0.92, 0, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  }
};
export const mercuryTex = () => ctex("mercuryMap", 2048, 1024, (g, r) => {
  g.fillStyle = "#a59a8a"; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() > 0.5 ? "rgba(120,112,104,0.35)" : "rgba(186,178,166,0.3)"; g.beginPath(); g.ellipse(r() * 2048, r() * 1024, 90 + r() * 240, 50 + r() * 120, r() * 3, 0, 6.283); g.fill(); }
  craters(g, r, 160, 2048, 1024, "rgba(214,206,194,0.75)", "rgba(96,90,84,0.55)", 6, 26);
  craters(g, r, 26, 2048, 1024, "rgba(222,214,202,0.8)", "rgba(92,86,80,0.6)", 30, 90);
  // a few bright ray craters
  for (let i = 0; i < 0; i++) { const x = r() * 2048, y = 200 + r() * 600; g.strokeStyle = "rgba(235,230,220,0.35)"; g.lineWidth = 5; for (let k = 0; k < 10; k++) { const a = k * 0.63 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (60 + r() * 120), y + Math.sin(a) * (40 + r() * 80)); g.stroke(); } g.fillStyle = "#e8e2d6"; g.beginPath(); g.arc(x, y, 12, 0, 6.283); g.fill(); }
});
export const venusTex = () => ctex("venusMap", 1024, 512, (g, r) => {
  g.fillStyle = "#e9c98a"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 46; i++) { g.strokeStyle = r() > 0.5 ? "rgba(255,240,205,0.35)" : "rgba(230,200,140,0.3)"; g.lineWidth = 18 + r() * 30; g.beginPath(); const y = r() * 512; g.moveTo(0, y); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + 24 * Math.sin(x / 120 + i)); g.stroke(); }
});
export const earthTex = () => ctex("earthMap", 1024, 512, (g, r) => {
  g.fillStyle = "#2f7fd0"; g.fillRect(0, 0, 1024, 512);
  const land = [[180, 170, 120, 80], [260, 330, 70, 110], [520, 160, 90, 70], [560, 300, 80, 110], [760, 180, 150, 80], [860, 360, 70, 45]];
  for (const [x, y, a, b] of land) { g.fillStyle = "#5fae4e"; g.beginPath(); for (let k = 0; k < 14; k++) { const an = k * 0.449, rr = 0.75 + 0.35 * Math.sin(k * 2.7 + x); g.lineTo(x + a * rr * Math.cos(an), y + b * rr * Math.sin(an)); } g.fill(); }
  g.fillStyle = "#f4f6fa"; g.fillRect(0, 0, 1024, 30); g.fillRect(0, 482, 1024, 30);
  for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.ellipse(r() * 1024, 50 + r() * 412, 30 + r() * 70, 8 + r() * 14, 0, 0, 6.283); g.fill(); }
});
export const plutoTex = () => ctex("plutoMap", 512, 256, (g) => {
  g.fillStyle = "#c9a98a"; g.fillRect(0, 0, 512, 256); g.fillStyle = "#f3e6d4"; g.beginPath(); g.ellipse(300, 150, 70, 60, 0, 0, 6.283); g.fill();
});

/** Earth at the size of the hero planet (2048 x 1024): ocean, cartoon continents with darker coasts, ice caps, cloud swirls */
export const earthHD = () => ctex("earthHD", 2048, 1024, (g, r) => {
  g.fillStyle = "#2f7fd0"; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 30; i++) { g.fillStyle = r() > 0.5 ? "rgba(40,110,200,0.5)" : "rgba(70,150,225,0.35)"; g.beginPath(); g.ellipse(r() * 2048, r() * 1024, 80 + r() * 200, 40 + r() * 90, r() * 3, 0, 6.283); g.fill(); }
  const land = [[360, 330, 230, 150], [520, 650, 140, 210], [1040, 320, 170, 130], [1110, 610, 160, 200], [1520, 350, 300, 150], [1720, 720, 140, 90], [200, 760, 60, 40]];
  for (const [x, y, a, b] of land) {
    const pts: [number, number][] = []; for (let k = 0; k < 22; k++) { const an = k * 0.2856, rr = 0.82 + 0.16 * Math.sin(k * 0.9 + x) + 0.1 * Math.sin(k * 1.9 + y) + 0.04 * Math.sin(k * 4.3 + x); pts.push([x + a * rr * Math.cos(an), y + b * rr * Math.sin(an)]); }
    g.fillStyle = "#3f8a46"; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
    g.fillStyle = "#62b257"; g.beginPath(); pts.forEach(([px, py], i) => { const qx = x + (px - x) * 0.86, qy = y + (py - y) * 0.86; i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); }); g.closePath(); g.fill();
    g.fillStyle = "rgba(214,190,120,0.55)"; g.beginPath(); g.ellipse(x + a * 0.15, y + b * 0.1, a * 0.3, b * 0.22, 0.3, 0, 6.283); g.fill();
  }
  g.fillStyle = "#f4f6fa"; g.fillRect(0, 0, 2048, 60); g.fillRect(0, 964, 2048, 60);
  for (let i = 0; i < 46; i++) { g.fillStyle = "rgba(255,255,255,0.55)"; const cx = r() * 2048, cy = 100 + r() * 824, w = 40 + r() * 80; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx + (k - 1) * w * 0.6, cy + (k % 2) * 6, w * 0.5, 9 + r() * 10, 0, 0, 6.283); g.fill(); } }
});
