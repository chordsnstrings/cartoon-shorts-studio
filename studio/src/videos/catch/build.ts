// The places of the catch short (pad + sea); helpers from the satellite short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): launch pad, radiation lab, clean room, mission control, Arctic ground station, park.
// Static geometry is merged per material; the Earth, rocket, beam and other moving parts are built in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit, grassHD, rep } from "./paint";
import { twoTone } from "./shade";
import { PAD, SEA, AXIS, MOUNT_Y, TOWER_X, TOWER_H, ARM_Y } from "./story";

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

// ---------------- launch pad (x + 1000) ----------------
/** tower + launch mount + fence + far buildings; the catch arms and the vehicles move, so they live in world.ts */
export const buildPad = (root: THREE.Object3D) => {
  const b = new Batch();
  const ground = lam("padGround", () => ({ map: rep(sandTex(), 30, 30) }));
  const conc = lam("padConc", () => ({ map: rep(concreteTex(), 8, 8) }));
  const sea = lam("padSea", () => ({ color: "#2f8fd0" }));
  const steel = lam("towerSteel", () => ({ color: "#6c707c" })), dark = lam("towerDark", () => ({ color: "#3a3c46" }));
  const white = lam("hangar", () => ({ color: "#efece4" })), blue = lam("hangarStripe", () => ({ color: "#3a64b8" }));
  const [ax, , az] = AXIS;
  b.add(floorQ(PAD - 195, PAD + 195, -300, 400, 0, 1), ground, undefined, false);
  b.add(floorQ(PAD - 195, PAD + 195, -1400, -300, 0.02, 1), sea, undefined, false);
  b.add(floorQ(ax - 40, ax + 40, az - 40, az + 40, 0.03, 1), conc, undefined, false);
  // launch mount: a thick ring table on six legs (booster base at MOUNT_Y)
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; b.add(B(ax + 7 * Math.cos(a) - 1, 0, az + 7 * Math.sin(a) - 1, ax + 7 * Math.cos(a) + 1, MOUNT_Y - 2, az + 7 * Math.sin(a) + 1), steel); }
  const ring = new THREE.CylinderGeometry(8.2, 8.2, 2.2, 40, 1, true); ring.translate(0, MOUNT_Y - 1.1, 0); b.add(ring, dark, At(ax, 0, az));
  const ringIn = new THREE.RingGeometry(5.2, 8.2, 40); ringIn.rotateX(-Math.PI / 2); ringIn.translate(0, MOUNT_Y, 0); b.add(ringIn, steel, At(ax, 0, az));
  // tower: four corner columns + horizontal girders + X braces on the visible faces, a crown on top
  const tx = TOWER_X, tz = az, hw = 4;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(B(tx + dx * hw - 0.6, 0, tz + dz * hw - 0.6, tx + dx * hw + 0.6, TOWER_H, tz + dz * hw + 0.6), steel);
  for (let y = 6; y < TOWER_H; y += 6) {
    b.add(B(tx - hw, y, tz - hw - 0.3, tx + hw, y + 0.6, tz - hw + 0.3), steel); b.add(B(tx - hw, y, tz + hw - 0.3, tx + hw, y + 0.6, tz + hw + 0.3), steel);
    b.add(B(tx - hw - 0.3, y, tz - hw, tx - hw + 0.3, y + 0.6, tz + hw), steel); b.add(B(tx + hw - 0.3, y, tz - hw, tx + hw + 0.3, y + 0.6, tz + hw), steel);
  }
  // X braces (thin boxes rotated) on the -x face (toward the rocket) and the +z / -z faces
  const brace = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const a = V(x0, y0, z0), c = V(x1, y1, z1), L = a.distanceTo(c), g = new THREE.BoxGeometry(0.35, L, 0.35);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
    b.add(g, steel, new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, V(1, 1, 1)));
  };
  for (let y = 0; y < TOWER_H - 6; y += 6) {
    brace(tx - hw, y, tz - hw, tx - hw, y + 6, tz + hw); brace(tx - hw, y, tz + hw, tx - hw, y + 6, tz - hw);
    for (const sz of [-1, 1]) { brace(tx - hw, y, tz + sz * hw, tx + hw, y + 6, tz + sz * hw); brace(tx + hw, y, tz + sz * hw, tx - hw, y + 6, tz + sz * hw); }
  }
  // arm carriage (the arms hang off it, world.ts) + crown + lightning mast
  b.add(B(tx - hw - 1.6, ARM_Y - 4, tz - hw - 1, tx - hw + 0.4, ARM_Y + 2.5, tz + hw + 1), dark);
  b.add(B(tx - hw - 0.8, TOWER_H, tz - hw - 0.8, tx + hw + 0.8, TOWER_H + 3, tz + hw + 0.8), dark);
  b.add(cyl(0.35, 0.2, 18, 8), steel, At(tx, TOWER_H + 3, tz));
  // the propellant farm, hangars and a water tower on the horizon (round tanks read as "rocket base")
  for (let i = 0; i < 6; i++) b.add(cyl(3.2, 3.2, 26, 20), white, At(PAD + 60 + i * 8, 0, -150 - (i % 2) * 8));
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, At(PAD + 60 + i * 8, 26, -150 - (i % 2) * 8));
  b.add(B(PAD - 140, 0, -190, PAD - 80, 38, -140), white); b.add(B(PAD - 140.1, 28, -140.1, PAD - 79.9, 31, -139.9), blue);
  b.add(B(PAD + 110, 0, -230, PAD + 170, 30, -190), white); b.add(B(PAD + 109.9, 20, -190.1, PAD + 170.1, 23, -189.9), blue);
  // the viewing area: a low fence along z = 10.5 and a few bushes
  const post = lam("fencePost", () => ({ color: "#b9b2a6" })), rail = lam("fenceRail", () => ({ color: "#d8d1c2" }));
  for (let x = PAD - 60; x <= PAD + 10; x += 3) b.add(B(x - 0.06, 0, 10.44, x + 0.06, 1.05, 10.56), post);
  for (const y of [0.55, 0.95]) b.add(B(PAD - 60, y, 10.47, PAD + 10, y + 0.06, 10.53), rail);
  const bush = lam("bush", () => ({ color: "#6d9a46" }));
  for (let i = 0; i < 18; i++) { const x = PAD - 70 + i * 5.1, z = 6 - 3 * Math.abs(Math.sin(i * 1.7)); if (Math.abs(x - (PAD - 24)) < 10) continue; b.add(new THREE.SphereGeometry(0.9 + 0.4 * Math.sin(i * 3.1), 12, 8), bush, At(x, 0.4, z)); }
  b.build(root);
};

// ---------------- open Gulf for the return and the booster (x + 1400) ----------------
export const buildSea = (root: THREE.Object3D) => {
  const b = new Batch();
  const sea = lam("gulf", () => ({ map: rep(waveTex(), 40, 40) }));
  b.add(floorQ(SEA - 195, SEA + 195, -1600, 400, 0, 1), sea, undefined, false);
  // a strip of far coast so the horizon has a shape
  const coast = lam("coast", () => ({ color: "#c9b37e" })), green = lam("coastG", () => ({ color: "#7a9a52" }));
  b.add(B(SEA - 195, 0, -1500, SEA + 195, 3, -1420), coast);
  for (let i = 0; i < 9; i++) mountain(b, SEA - 180 + i * 45, -1480, 40 + 10 * (i % 3), 14 + 6 * (i % 2), green, 6);
  b.build(root);
};
const waveTex = () => ctex("gulfWaves", 512, 512, (g, r) => {
  g.fillStyle = "#2f86c8"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { const x = r() * 512, y = r() * 512, w = 20 + r() * 50; g.strokeStyle = r() > 0.5 ? "rgba(255,255,255,0.28)" : "rgba(20,60,120,0.25)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); }
});
