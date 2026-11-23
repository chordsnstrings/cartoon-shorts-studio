// The places of the Mercury short (mission control) + painted planet maps; helpers from the satellite short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): launch pad, radiation lab, clean room, mission control, Arctic ground station, park.
// Static geometry is merged per material; the Earth, rocket, beam and other moving parts are built in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep } from "./paint";
import { twoTone } from "./shade";
import { CTRL } from "./story";

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

/** the wall screen, drawn live (no text): "burn" = the probe icon with its flame and a progress bar (an alarm dot blinks
 *  once the flame is out); "orbit" = Mercury with an old faded orbit + icon and the new orbit with the gold probe icon */
export type WallState = { kind: "burn" | "orbit"; flame: number; bar: number; alarm: boolean; t: number };
const probeIcon = (g: CanvasRenderingContext2D, x: number, y: number, s: number, faded = false) => {
  g.save(); g.translate(x, y); g.globalAlpha = faded ? 0.35 : 1;
  g.fillStyle = faded ? "#aab4c8" : "#2f56b8"; g.fillRect(-s * 1.6, -s * 0.35, s * 1.0, s * 0.7); g.fillRect(s * 0.6, -s * 0.35, s * 1.0, s * 0.7);
  g.fillStyle = faded ? "#c9d0dc" : "#e6b440"; g.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1);
  g.strokeStyle = "#0b1022"; g.lineWidth = s * 0.08; g.strokeRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1);
  g.fillStyle = faded ? "#9aa3b8" : "#8b8f9c"; g.beginPath(); g.moveTo(-s * 0.2, s * 0.55); g.lineTo(s * 0.2, s * 0.55); g.lineTo(s * 0.32, s * 0.85); g.lineTo(-s * 0.32, s * 0.85); g.fill();
  g.restore();
};
export const drawWall = (g: CanvasRenderingContext2D, W_: number, H: number, s: WallState) => {
  g.fillStyle = "#0b1a3a"; g.fillRect(0, 0, W_, H);
  g.strokeStyle = "rgba(120,180,255,0.16)"; g.lineWidth = 2;
  for (let x = 0; x < W_; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W_, y); g.stroke(); }
  if (s.kind === "burn") {
    // Mercury's limb low on the right, the probe icon above the middle, the flame pointing down
    const gr = g.createRadialGradient(W_ * 0.86, H * 1.25, 40, W_ * 0.86, H * 1.25, H * 0.75); gr.addColorStop(0, "#c9c1b4"); gr.addColorStop(1, "#7d776e");
    g.fillStyle = gr; g.beginPath(); g.arc(W_ * 0.86, H * 1.25, H * 0.7, 0, 6.283); g.fill();
    const cx = W_ * 0.5, cy = H * 0.34, sz = H * 0.11;
    if (s.flame > 0.02) {
      const L = H * 0.3 * s.flame;
      g.fillStyle = "#ff9a3a"; g.beginPath(); g.moveTo(cx - sz * 0.38, cy + sz * 0.85); g.quadraticCurveTo(cx, cy + sz * 0.85 + L * 1.3, cx + sz * 0.38, cy + sz * 0.85); g.fill();
      g.fillStyle = "#fff2c0"; g.beginPath(); g.moveTo(cx - sz * 0.2, cy + sz * 0.85); g.quadraticCurveTo(cx, cy + sz * 0.85 + L * 0.75, cx + sz * 0.2, cy + sz * 0.85); g.fill();
    }
    probeIcon(g, cx, cy, sz);
    // progress bar (rounded track + green fill)
    const bx = W_ * 0.18, by = H * 0.8, bw = W_ * 0.64, bh = H * 0.07;
    g.fillStyle = "#1c2a52"; g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fill();
    g.strokeStyle = "#7fa8ff"; g.lineWidth = 4; g.stroke();
    if (s.bar > 0.01) { g.fillStyle = s.alarm ? "#ff4a3a" : "#5fd35a"; g.beginPath(); g.roundRect(bx + 6, by + 6, (bw - 12) * s.bar, bh - 12, (bh - 12) / 2); g.fill(); }
    // the finish flag mark at the end of the track
    g.fillStyle = "#ffffff"; g.fillRect(bx + bw - 8, by - bh * 0.9, 6, bh * 1.9);
    if (s.alarm && Math.floor(s.t * 4) % 2 === 0) {
      g.strokeStyle = "#ff3b3b"; g.lineWidth = 16; g.strokeRect(8, 8, W_ - 16, H - 16);
      g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(W_ * 0.08, H * 0.12, H * 0.05, 0, 6.283); g.fill();
    }
  } else {
    const cx = W_ * 0.5, cy = H * 0.52, R = H * 0.24;
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 10, cx, cy, R); gr.addColorStop(0, "#d6cec2"); gr.addColorStop(1, "#80796f");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.fill();
    g.fillStyle = "rgba(70,64,60,0.35)"; for (const [x, y, r] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1], [0.35, -0.35, 0.08]]) { g.beginPath(); g.arc(cx + x * R, cy + y * R, r * R, 0, 6.283); g.fill(); }
    // the old orbit (faded, dashed) + its faded icon; the new orbit (gold) + the gold probe
    g.setLineDash([16, 14]); g.strokeStyle = "rgba(170,190,220,0.45)"; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, R * 1.55, R * 1.2, 0.5, 0, 6.283); g.stroke(); g.setLineDash([]);
    probeIcon(g, cx + R * 1.2, cy - R * 0.9, H * 0.05, true);
    g.strokeStyle = "#ffd24a"; g.lineWidth = 8; g.beginPath(); g.ellipse(cx, cy, R * 1.95, R * 1.45, -0.35, 0, 6.283); g.stroke();
    const a = s.t * 1.4, px = cx + R * 1.95 * Math.cos(a) * Math.cos(-0.35) - R * 1.45 * Math.sin(a) * Math.sin(-0.35), py = cy + R * 1.95 * Math.cos(a) * Math.sin(-0.35) + R * 1.45 * Math.sin(a) * Math.cos(-0.35);
    probeIcon(g, px, py, H * 0.07);
    // a gold star burst by the new icon
    g.fillStyle = "#fff3a0"; for (let i = 0; i < 2; i++) { const sx = px + H * (0.11 + 0.05 * i), sy = py - H * (0.08 + 0.04 * i), r = H * (0.035 - 0.012 * i); g.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4, rr = k % 2 ? r * 0.3 : r; g.lineTo(sx + rr * Math.cos(an), sy + rr * Math.sin(an)); } g.fill(); }
  }
  g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.3, 0); g.lineTo(0, H * 0.55); g.fill();
};

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
