// The three places of the short, built from boxes, cylinders and painted Canvas2D textures (two-tone lit, inked by
// the world ink pass): the hot pot restaurant (origin), the Cupertino street front (x + 200), the kitchen counter
// (x - 200). Static geometry is merged per material; the flying tableware is built separately in world.ts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, jit } from "./paint";
import { twoTone } from "./shade";
import { STREET, KITCHEN, T1, T2, TW, TD, TABLE_H, COUNTER_H, EDGE_X } from "./story";

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
const seam = "rgba(38,24,30,0.9)";
export const planksTex = (key: string, base: string, w = 1024) => ctex(key, w, w, (g, r) => {
  const n = 8, h = w / n;
  for (let i = 0; i < n; i++) {
    let x = -r() * 300;
    while (x < w) {
      const len = 260 + r() * 380;
      g.fillStyle = jit(r, base, 0.09, 4, 0.12); g.fillRect(x, i * h, len, h);
      g.strokeStyle = "rgba(60,35,25,0.16)"; g.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const y = i * h + 12 + r() * (h - 24); g.beginPath(); g.moveTo(x + 10, y); g.bezierCurveTo(x + len * 0.3, y + 6 * (r() - 0.5), x + len * 0.6, y + 6 * (r() - 0.5), x + len - 10, y); g.stroke(); }
      g.fillStyle = seam; g.fillRect(x + len - 3, i * h, 6, h);
      x += len;
    }
    g.fillStyle = seam; g.fillRect(0, i * h - 3, w, 6);
  }
});
const tilesTex = (key: string, a: string, b: string, n: number, grout: string, checker = false) => ctex(key, 1024, 1024, (g, r) => {
  const s = 1024 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = jit(r, checker && (i + j) % 2 ? b : a, 0.04, 2, 0.08); g.fillRect(i * s, j * s, s, s); }
  g.fillStyle = grout;
  for (let i = 0; i <= n; i++) { g.fillRect(i * s - 3, 0, 6, 1024); g.fillRect(0, i * s - 3, 1024, 6); }
});
const subwayTex = () => ctex("subway", 1024, 1024, (g, r) => {
  const rows = 12, h = 1024 / rows, w = h * 2;
  for (let i = 0; i < rows; i++) for (let x = (i % 2) * -w / 2; x < 1024; x += w) {
    g.fillStyle = jit(r, "#cfe0e4", 0.05, 3, 0.1); g.fillRect(x, i * h, w, h);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 8, i * h + 8, w * 0.5, 6);
    g.fillStyle = "#4a4a58"; g.fillRect(x - 3, i * h, 6, h);
  }
  g.fillStyle = "#4a4a58"; for (let i = 0; i <= rows; i++) g.fillRect(0, i * h - 3, 1024, 6);
});
const plasterTex = (key: string, base: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "90,60,50"},${0.03 + 0.03 * r()})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, 6.28); g.fill(); }
});
/** the back wall: dark wood slats with a lattice band and painted cloud swirls (our own pattern) */
const muralTex = () => ctex("mural", 2048, 1024, (g, r) => {
  g.fillStyle = "#8c3b2c"; g.fillRect(0, 0, 2048, 1024);
  for (let x = 0; x < 2048; x += 64) { g.fillStyle = jit(r, "#7a3226", 0.08, 3, 0.1); g.fillRect(x, 0, 60, 1024); g.fillStyle = "rgba(30,10,10,0.6)"; g.fillRect(x + 60, 0, 4, 1024); }
  // cream band with a gold wave-scale pattern (rows of overlapping arcs)
  g.fillStyle = "#efdcb6"; g.fillRect(0, 300, 2048, 360);
  g.save(); g.beginPath(); g.rect(0, 300, 2048, 360); g.clip();
  for (let row = 0; row < 7; row++) for (let i = -1; i < 26; i++) {
    const cx = i * 84 + (row % 2) * 42, cy = 330 + row * 52;
    for (const [rr, c] of [[42, "#c8913e"], [30, "#efdcb6"], [20, "#c8913e"], [10, "#efdcb6"]] as const) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, rr, Math.PI, 0); g.fill(); }
  }
  g.restore();
  g.fillStyle = "#2b1414"; g.fillRect(0, 292, 2048, 10); g.fillRect(0, 658, 2048, 10);
});
const tableTex = () => ctex("tabletop", 1024, 1024, (g, r) => {
  g.fillStyle = "#5c3624"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${r() > 0.5 ? "120,70,45" : "40,22,15"},0.35)`; g.lineWidth = 2 + r() * 4; const y = r() * 1024; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(300, y + 20 * (r() - 0.5), 700, y + 20 * (r() - 0.5), 1024, y); g.stroke(); }
});
const brothTex = () => ctex("broth", 512, 512, (g) => {
  // a two-flavour pot split by a curved divider: spicy red and pale herbal
  g.fillStyle = "#c93a22"; g.beginPath(); g.arc(256, 256, 256, 0, 6.283); g.fill();
  g.fillStyle = "#e8cf98"; g.beginPath(); g.arc(256, 256, 256, -Math.PI / 2, Math.PI / 2); g.arc(256, 384, 128, Math.PI / 2, -Math.PI / 2, false); g.arc(256, 128, 128, Math.PI / 2, -Math.PI / 2, true); g.fill();
  g.strokeStyle = "#5b5f66"; g.lineWidth = 16; g.beginPath(); g.arc(256, 128, 128, -Math.PI / 2, Math.PI / 2); g.arc(256, 384, 128, -Math.PI / 2, Math.PI / 2, true); g.stroke();
  for (const [x, y, rr, c] of [[150, 300, 22, "#f3d36a"], [190, 200, 16, "#7cb34a"], [330, 150, 18, "#f6efe0"], [360, 330, 20, "#7cb34a"], [120, 230, 12, "#ff7a3c"], [300, 420, 14, "#f6efe0"]] as const) {
    g.fillStyle = c; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
  }
  g.fillStyle = "#ffffff"; g.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(256 + 200 * Math.cos(i * 2.4) * Math.sqrt((i + 1) / 27), 256 + 200 * Math.sin(i * 2.4) * Math.sqrt((i + 1) / 27), 5 + (i % 4) * 2, 0, 6.283); g.fill(); }
  g.globalAlpha = 1;
});
export const plateTex = () => ctex("plateTop", 256, 256, (g) => {
  g.fillStyle = "#f7f4ee"; g.beginPath(); g.arc(128, 128, 128, 0, 6.283); g.fill();
  g.strokeStyle = "#3f6fb5"; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 112, 0, 6.283); g.stroke();
  g.fillStyle = "#eae3d6"; g.beginPath(); g.arc(128, 128, 76, 0, 6.283); g.fill();
  for (const [x, y, c] of [[110, 120, "#d76a5a"], [150, 140, "#e9a58b"], [130, 100, "#d76a5a"], [100, 150, "#7cb34a"]] as const) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 22, 12, x / 30, 0, 6.283); g.fill(); }
});
export const sauceTex = () => ctex("sauceTop", 128, 128, (g) => {
  g.fillStyle = "#3b2a25"; g.beginPath(); g.arc(64, 64, 64, 0, 6.283); g.fill();
  g.fillStyle = "#9b2a1a"; g.beginPath(); g.arc(64, 64, 46, 0, 6.283); g.fill();
  g.fillStyle = "#d14a2a"; g.beginPath(); g.arc(54, 56, 16, 0, 6.283); g.fill();
});
const awningTex = () => ctex("awning", 512, 256, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f6eedd" : "#c8362f"; g.fillRect(i * 64, 0, 64, 256); }
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 200, 512, 56);
});
/** restaurant front window, glowing from inside, with warm lanterns and diners as silhouettes */
const shopWindowTex = () => ctex("shopWin", 1024, 640, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, "#ffd58f"); gr.addColorStop(1, "#f29a5a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#b2452f"; g.fillRect(0, 380, 1024, 260);
  for (let i = 0; i < 5; i++) { g.fillStyle = "#e0402e"; g.beginPath(); g.ellipse(110 + i * 200, 110, 38, 48, 0, 0, 6.283); g.fill(); g.fillStyle = "#ffe08a"; g.fillRect(104 + i * 200, 40, 12, 22); }
  g.fillStyle = "#5a2a22"; for (const x of [240, 690]) { g.fillRect(x - 160, 430, 320, 30); g.fillRect(x - 140, 460, 18, 120); g.fillRect(x + 122, 460, 18, 120); }
  g.fillStyle = "#c93a22"; for (const x of [240, 690]) { g.beginPath(); g.ellipse(x, 426, 60, 16, 0, 0, 6.283); g.fill(); }
  g.fillStyle = "rgba(255,250,240,0.5)"; for (const x of [240, 690]) for (const dx of [-20, 10, 30]) { g.beginPath(); g.ellipse(x + dx, 380 - Math.abs(dx), 22, 30, 0, 0, 6.283); g.fill(); }
  g.strokeStyle = "#3a2420"; g.lineWidth = 18; g.strokeRect(0, 0, 1024, 640); g.beginPath(); g.moveTo(512, 0); g.lineTo(512, 640); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(80, 0); g.lineTo(260, 0); g.lineTo(60, 640); g.lineTo(-120, 640); g.fill();
});
/** the sign: a steaming pot pictogram on red (no lettering) */
const signTex = () => ctex("shopSign", 1024, 320, (g) => {
  g.fillStyle = "#b8302b"; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = "#f3c757"; g.lineWidth = 14; g.strokeRect(14, 14, 996, 292);
  g.fillStyle = "#f3c757";
  g.beginPath(); g.ellipse(512, 190, 150, 70, 0, 0, Math.PI); g.fill(); g.fillRect(352, 170, 320, 24);
  g.fillRect(320, 168, 40, 14); g.fillRect(664, 168, 40, 14);
  g.strokeStyle = "#f6eedd"; g.lineWidth = 16; g.lineCap = "round";
  for (const x of [440, 512, 584]) { g.beginPath(); g.moveTo(x, 150); g.bezierCurveTo(x - 30, 120, x + 30, 90, x, 50); g.stroke(); }
  for (const x of [150, 874]) { g.fillStyle = "#f3c757"; g.beginPath(); g.arc(x, 160, 60, 0, 6.283); g.fill(); g.fillStyle = "#b8302b"; g.beginPath(); g.arc(x, 160, 34, 0, 6.283); g.fill(); }
});
const plainWinTex = () => ctex("plainWin", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#9cc6e8"); gr.addColorStop(1, "#d9ecf6");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(60, 0); g.lineTo(200, 0); g.lineTo(40, 512); g.lineTo(-100, 512); g.fill();
  g.strokeStyle = "#e9e4d8"; g.lineWidth = 26; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
});
const frondTex = () => ctex("frond", 512, 128, (g) => {
  g.clearRect(0, 0, 512, 128);
  g.strokeStyle = "#3f7a34"; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 64); g.quadraticCurveTo(256, 50, 512, 64); g.stroke();
  for (let i = 0; i < 40; i++) {
    const x = 20 + i * 12, l = 54 * Math.sin(Math.PI * (x / 512)) + 8;
    g.fillStyle = i % 2 ? "#5da447" : "#4e9440";
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x + 18, 60 + s * l); g.lineTo(x + 8, 60); g.fill(); }
  }
});
const trunkTex = () => ctex("palmTrunk", 128, 512, (g, r) => {
  g.fillStyle = "#9a7350"; g.fillRect(0, 0, 128, 512);
  for (let y = 0; y < 512; y += 22) { g.fillStyle = jit(r, "#7c5a3e", 0.1); g.fillRect(0, y, 128, 8); }
});
const asphaltTex = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#6a6872"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});

// ---------------- props ----------------
const cyl = (r0: number, r1: number, h: number, seg = 32) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(0, h / 2, 0); return g; };
const discTop = (r: number, y: number, seg = 40) => { const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };

/** a hot pot table: dark top with a sunken two-flavour pot, legs, a bench behind it */
const potTable = (b: Batch, cx: number, cz: number, M: Record<string, THREE.Material>, bench = true) => {
  const x0 = cx - TW / 2, x1 = cx + TW / 2, z0 = cz - TD / 2, z1 = cz + TD / 2;
  b.add(B(x0, TABLE_H - 0.05, z0, x1, TABLE_H, z1), M.tableTop);
  b.add(B(x0 + 0.06, 0, z0 + 0.06, x1 - 0.06, TABLE_H - 0.05, z0 + 0.12), M.tableSide);
  for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.14, z0 + 0.08], [x0 + 0.08, z1 - 0.14], [x1 - 0.14, z1 - 0.14]]) b.add(B(x, 0, z, x + 0.06, TABLE_H - 0.05, z + 0.06), M.tableSide);
  // pot rim + broth
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 40, 1, true); rim.translate(0, 0.025, 0);
  b.add(rim, M.steel, T(cx, TABLE_H - 0.02, cz));
  const lip = new THREE.TorusGeometry(0.2, 0.012, 8, 40); lip.rotateX(Math.PI / 2);
  b.add(lip, M.steel, T(cx, TABLE_H + 0.03, cz));
  b.add(discTop(0.195, TABLE_H + 0.018), M.broth, T(cx, 0, cz));
  if (bench) {
    b.add(B(x0 + 0.05, 0.42, z0 - 0.55, x1 - 0.05, 0.48, z0 - 0.15), M.bench);
    b.add(B(x0 + 0.05, 0.48, z0 - 0.58, x1 - 0.05, 1.0, z0 - 0.5), M.bench);
    b.add(B(x0 + 0.1, 0, z0 - 0.5, x1 - 0.1, 0.42, z0 - 0.2), M.benchSide);
  }
};

export const buildRestaurant = (root: THREE.Object3D) => {
  const b = new Batch(), M: Record<string, THREE.Material> = {};
  M.floor = lam("restFloor", () => ({ map: planksTex("restFloorT", "#b5794a") }));
  (M.floor as THREE.MeshLambertMaterial).map!.repeat.set(1, 1);
  M.wall = lam("restWall", () => ({ map: plasterTex("restWallT", "#efd9b4") }));
  M.mural = lam("mural", () => ({ map: muralTex() }));
  M.wain = lam("wainscot", () => ({ map: planksTex("wainT", "#6e3b26", 512) }));
  M.ceil = lam("ceil", () => ({ color: "#c9a47a" }));
  M.beam = lam("ceilBeam", () => ({ color: "#5e3423" }));
  M.tableTop = lam("tableTop", () => ({ map: tableTex() }));
  M.tableSide = lam("tableSide", () => ({ color: "#4a2a1c" }));
  M.bench = lam("bench", () => ({ color: "#a33a2c" }));
  M.benchSide = lam("benchSide", () => ({ color: "#5a2e20" }));
  M.steel = twoTone(new THREE.MeshPhongMaterial({ color: "#9aa0a8", specular: "#d0d0d0", shininess: 50 }), 0.2);
  M.broth = lam("broth", () => ({ map: brothTex() }));
  M.trim = lam("trim", () => ({ color: "#3e2016" }));
  M.plant = lam("plant", () => ({ color: "#5aa04a" }));
  M.pot = lam("plantPot", () => ({ color: "#d9cbb3" }));
  const winG = glow("restWin", "#fff1d6", 1.05, ctex("restWinT", 256, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#cfe6ff"); gr.addColorStop(1, "#fff4dc"); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    g.fillStyle = "#6e3b26"; g.fillRect(0, 0, 256, 18); g.fillRect(0, 494, 256, 18); g.fillRect(0, 0, 18, 512); g.fillRect(238, 0, 18, 512); g.fillRect(119, 0, 18, 512); g.fillRect(0, 247, 256, 18);
  }));
  const XL = -6, XR = 6, ZB = -2.0, ZF = 7, H = 3.3;
  b.add(floorQ(XL, XR, ZB, ZF, 0, 1.3), M.floor, undefined, false);
  b.add(wallZ(XL, XR, 0, H, ZB, 4.1), M.mural, undefined, false);
  b.add(B(XL, 0, ZB, XR, 0.95, ZB + 0.04), M.wain, undefined, false);
  b.add(wallX(ZB, ZF, 0, H, XL, 2), M.wall, undefined, false);
  b.add(wallX(ZB, ZF, 0, H, XR, 2, true), M.wall, undefined, false);
  b.add(wallZ(XL, XR, 0, H, ZF, 2, true), M.wall, undefined, false);
  for (const [z0, z1, x, s] of [[ZB, ZF, XL + 0.02, 1], [ZB, ZF, XR - 0.04, -1]] as const) b.add(B(Math.min(x, x + s * 0.02), 0, z0, Math.max(x, x + s * 0.02) + 0.02, 0.95, z1), M.wain, undefined, false);
  const ceil = quad(V(XL, H, ZB), V(XR, H, ZB), V(XR, H, ZF), V(XL, H, ZF), 1, 1);
  b.add(ceil, M.ceil, undefined, false);
  for (let x = XL + 1; x < XR; x += 2) b.add(B(x - 0.08, H - 0.18, ZB, x + 0.08, H, ZF), M.beam, undefined, false);
  // windows on the left wall (bright, unlit)
  for (const z of [0.6, 3.4]) b.add(wallX(z - 0.7, z + 0.7, 1.0, 2.7, XL + 0.05, 1), winG, undefined, false);
  // tables: the guest's, the one next door, and the rest of the room
  potTable(b, T1[0], T1[2], M); potTable(b, T2[0], T2[2], M);
  for (const [x, z] of [[-3.1, 0], [3.2, 0], [-2.6, 4.3], [-4.9, 2.2], [4.9, 2.2]]) potTable(b, x, z, M);
  // planter by the right wall
  b.add(cyl(0.22, 0.28, 0.5), M.pot, T(5.3, 0, -1.3)); const lf = new THREE.SphereGeometry(0.45, 16, 12); lf.scale(1, 1.3, 1); b.add(lf, M.plant, T(5.3, 1.0, -1.3));
  b.build(root);
  // pendant lanterns (glowing, bloom)
  const lanG = glow("lantern", "#ffffff", 1.25, ctex("lanternT", 256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "#d8402c"); gr.addColorStop(0.5, "#ff9a5a"); gr.addColorStop(1, "#d8402c");
    for (let i = 0; i < 4; i++) { g.fillStyle = gr; g.fillRect(i * 64, 0, 64, 256); g.fillStyle = "#7a1e16"; g.fillRect(i * 64 + 60, 0, 4, 256); }
    g.fillStyle = "#e8b64a"; g.fillRect(0, 0, 256, 26); g.fillRect(0, 230, 256, 26);
  })), capG = lam("lanCap", () => ({ color: "#3a2018" }));
  for (const [x, z] of [[T1[0], T1[2]], [T2[0], T2[2]], [-3.1, 0], [3.2, 0]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), lanG); l.scale.set(1, 1.25, 1); l.position.set(x, 2.35, z); root.add(l);
    const c = new THREE.Mesh(cyl(0.09, 0.09, 0.06), capG); c.position.set(x, 2.58, z); root.add(c);
    const cord = new THREE.Mesh(cyl(0.008, 0.008, H - 2.62, 6), capG); cord.position.set(x, 2.62, z); root.add(cord);
  }
};

export const buildStreet = (root: THREE.Object3D) => {
  const b = new Batch(), X = STREET;
  const asphalt = lam("asphalt", () => ({ map: asphaltTex() }));
  const walk = lam("sidewalk", () => ({ map: tilesTex("walkT", "#d9d2c4", "#d9d2c4", 4, "#a49b8c") }));
  const curb = lam("curb", () => ({ color: "#cfc8ba" }));
  const stucco = lam("stucco", () => ({ map: plasterTex("stuccoT", "#ecd8b8") }));
  const stucco2 = lam("stucco2", () => ({ map: plasterTex("stucco2T", "#d9c7e0") }));
  const stucco3 = lam("stucco3", () => ({ map: plasterTex("stucco3T", "#cfe0c8") }));
  const roofM = lam("flatRoof", () => ({ color: "#a65a3e" }));
  const trim = lam("streetTrim", () => ({ color: "#6e3b26" }));
  const awn = lam("awning", () => ({ map: awningTex(), side: THREE.DoubleSide }));
  const trunk = lam("trunk", () => ({ map: trunkTex() }));
  const frond = lam("frond", () => ({ map: frondTex(), side: THREE.DoubleSide, alphaTest: 0.5 }));
  const grass = lam("lawn", () => ({ color: "#5c9a47" }));
  const line = lam("roadLine", () => ({ color: "#f2e6c4" }));
  b.add(floorQ(X - 80, X + 80, -6, 40, 0, 4), asphalt, undefined, false);
  b.add(floorQ(X - 80, X + 80, -10.5, -6.15, 0.15, 1.2), walk, undefined, false);
  b.add(B(X - 80, 0, -6.2, X + 80, 0.15, -6.0), curb, undefined, false);
  for (let x = X - 78; x < X + 80; x += 6) b.add(floorQ(x, x + 3, 1.0, 1.15, 0.01, 1), line, undefined, false);
  b.add(floorQ(X - 80, X + 80, 8.15, 12, 0.15, 1.2), walk, undefined, false);
  b.add(B(X - 80, 0, 8.0, X + 80, 0.15, 8.2), curb, undefined, false);
  b.add(floorQ(X - 80, X + 80, 12, 60, 0.02, 4), grass, undefined, false);
  // buildings: the restaurant in the middle, neighbours either side (one storey strip, flat roofs with a parapet)
  const blocks: [number, number, number, THREE.Material][] = [[-26, -9, 5.2, stucco2], [-9, 9, 6.0, stucco], [9, 24, 5.0, stucco3], [24, 40, 5.6, stucco2], [-42, -26, 5.0, stucco3]];
  for (const [x0, x1, h, m] of blocks) {
    b.add(B(X + x0, 0, -26, X + x1, h, -10.5, 2), m, undefined, true);
    b.add(B(X + x0 - 0.1, h, -10.7, X + x1 + 0.1, h + 0.35, -10.3), roofM);
  }
  // restaurant front: two big glowing windows, a door, a sign board, the striped awning
  const win = glow("shopWinM", "#ffffff", 1.15, shopWindowTex()), sign = glow("shopSignM", "#ffffff", 1.0, signTex());
  for (const [x0, x1] of [[-7.6, -1.6], [1.6, 7.6]]) { b.add(wallZ(X + x0, X + x1, 0.6, 3.4, -10.48, x1 - x0), win, undefined, false); b.add(B(X + x0 - 0.12, 0.45, -10.45, X + x1 + 0.12, 0.6, -10.2), trim); }
  b.add(B(X - 1.3, 0.15, -10.49, X + 1.3, 3.2, -10.47), lam("door", () => ({ color: "#6e3b26" })), undefined, false);
  b.add(wallZ(X - 1.1, X + 1.1, 0.25, 3.0, -10.45, 1), glow("doorGlass", "#ffd08a", 1.05), undefined, false);
  b.add(wallZ(X - 4.5, X + 4.5, 4.15, 5.75, -10.4, 9), sign, undefined, false);
  const aw = quad(V(X - 8.2, 3.7, -9.0), V(X + 8.2, 3.7, -9.0), V(X + 8.2, 4.05, -10.45), V(X - 8.2, 4.05, -10.45), 4, 1);
  b.add(aw, awn);
  b.add(quad(V(X - 8.2, 3.35, -9.0), V(X + 8.2, 3.35, -9.0), V(X + 8.2, 3.7, -9.0), V(X - 8.2, 3.7, -9.0), 4, 0.2), awn);
  // neighbours' windows (sky reflections)
  const pw = glow("plainWinM", "#ffffff", 0.95, plainWinTex());
  for (const x of [-23, -16, 12, 18, 27, 34, -38, -31]) b.add(wallZ(X + x, X + x + 3.6, 0.9, 3.4, -10.48, 3.6), pw, undefined, false);
  b.build(root);
  // palm trees along the sidewalk
  for (const [x, z, h] of [[-8.7, -7.2, 9.5], [8.7, -7.2, 10.3], [-27, -7.4, 9], [27, -7.4, 9.8], [-45, -7.4, 10], [44, -7.4, 9.4]] as const) {
    const t = new THREE.Mesh(cyl(0.22, 0.16, h, 12), trunk); t.position.set(X + x, 0, z); t.castShadow = true; t.receiveShadow = true; root.add(t);
    for (let k = 0; k < 9; k++) {
      const g = new THREE.PlaneGeometry(3.4, 0.9, 6, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 1.7) / 3.4; p.setX(i, u * 3.2); p.setY(i, p.getY(i) - 1.4 * u * u); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, frond); m.position.set(X + x, h, z); m.rotation.set(0, (k / 9) * Math.PI * 2 + x, 0.35 + 0.15 * (k % 3));
      m.castShadow = true; m.receiveShadow = true; root.add(m);
    }
  }
};

export const buildKitchen = (root: THREE.Object3D) => {
  const b = new Batch(), X = KITCHEN;
  const top = lam("butcher", () => ({ map: planksTex("butcherT", "#d8a466", 512) }));
  const cab = lam("cabinet", () => ({ color: "#4f9a90" }));
  const cabD = lam("cabinetD", () => ({ color: "#3f8279" }));
  const knob = lam("knob", () => ({ color: "#e8d6a8" }));
  const tiles = lam("subway", () => ({ map: subwayTex() }));
  const wall = lam("kitWall", () => ({ map: plasterTex("kitWallT", "#e2b86e") }));
  const floor = lam("kitFloor", () => ({ map: tilesTex("kitFloorT", "#efe7d6", "#c9c1b0", 8, "#9a9284", true) }));
  const jar = lam("jar", () => ({ color: "#e9a24a" })), lid = lam("jarLid", () => ({ color: "#c8423a" })), kettle = lam("kettle", () => ({ color: "#5aa0d8" }));
  const leaf = lam("kitLeaf", () => ({ color: "#5aa04a" })), terra = lam("terra", () => ({ color: "#c96a44" }));
  const ZW = -0.62, H = 2.8;
  b.add(floorQ(X - 4, X + 4, -0.7, 4, 0, 0.6), floor, undefined, false);
  b.add(wallZ(X - 4, X + 4, 0, H, ZW - 0.01, 2), wall, undefined, false);
  b.add(wallX(ZW, 4, 0, H, X - 4, 2), wall, undefined, false);
  b.add(wallX(ZW, 4, 0, H, X + 4, 2, true), wall, undefined, false);
  b.add(wallZ(X - 4, X + 4, 0, H, 4, 2, true), wall, undefined, false);
  b.add(quad(V(X - 4, H, ZW), V(X + 4, H, ZW), V(X + 4, H, 4), V(X - 4, H, 4), 1, 1), lam("kitCeil", () => ({ color: "#f3ead6" })), undefined, false);
  b.add(wallZ(X - 2.2, EDGE_X, COUNTER_H, COUNTER_H + 0.6, ZW, 0.6), tiles, undefined, false);
  // the counter: butcher-block top with a slight overhang, cabinet doors below, ending at the edge (x = EDGE_X)
  b.add(B(X - 2.2, COUNTER_H - 0.05, ZW, EDGE_X, COUNTER_H, 0.0, 0.5), top);
  b.add(B(X - 2.2, 0, ZW, EDGE_X - 0.03, COUNTER_H - 0.05, -0.04), cab);
  for (let x = X - 2.15; x < EDGE_X - 0.3; x += 0.52) {
    b.add(B(x, 0.1, -0.04, x + 0.48, COUNTER_H - 0.12, -0.02), cabD);
    b.add(B(x + 0.38, 0.55, -0.02, x + 0.42, 0.68, 0.0), knob);
  }
  b.add(B(X - 2.2, 0, -0.03, EDGE_X - 0.03, 0.08, 0.0), lam("kick", () => ({ color: "#3d4a52" })));
  // window over the counter
  const kw = glow("kitWin", "#ffffff", 1.05, plainWinTex());
  b.add(wallZ(X - 1.6, X - 0.4, COUNTER_H + 0.75, COUNTER_H + 1.7, ZW, 1.2), kw, undefined, false);
  // jar, kettle, plant at the far end (out of the toy's path)
  b.add(cyl(0.07, 0.07, 0.2), jar, T(X - 1.9, COUNTER_H, -0.42)); b.add(cyl(0.075, 0.075, 0.03), lid, T(X - 1.9, COUNTER_H + 0.2, -0.42));
  b.add(cyl(0.1, 0.08, 0.16), kettle, T(X - 1.55, COUNTER_H, -0.45)); const kt = new THREE.SphereGeometry(0.1, 20, 12, 0, 6.3, 0, Math.PI / 2); b.add(kt, kettle, T(X - 1.55, COUNTER_H + 0.16, -0.45));
  b.add(cyl(0.07, 0.09, 0.14), terra, T(X - 2.05, COUNTER_H, -0.2)); const pl = new THREE.SphereGeometry(0.12, 16, 12); b.add(pl, leaf, T(X - 2.05, COUNTER_H + 0.24, -0.2));
  b.build(root);
};
