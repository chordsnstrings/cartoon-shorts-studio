// The trolley short: our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, LANE_N, V3, vehPoses, boatPose, HX, QUAY_Z, BOAT_Z, WATER_Y, HIT, PARK_X, HOOK_HERO, HOOK_PAL, END_HERO, END_PAL, HERO_SPOT, sinkY } from "./story";
import { fxBurst, fxPuff } from "./toon";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "indoor" | "space" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];

const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "indoor" | "space" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], indoor: [0.3, 0.26, 0.34], space: [0.3, 0.3, 0.4], night: [0.3, 0.3, 0.45] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day" || LNAME === "indoor") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

export type Stage = { places: Place[]; fx: FxPlace[] };

// ================= the glitch short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const HERO: Outfit = { jacket: "#e8417a", pants: "#2b3550", boots: "#2b2630", hat: "cap", cap: "#2fa39a", skin: "#c99067", buttons: "#f4f1ea" };
const PAL: Outfit = { jacket: "#f2c43a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#3a2418", skin: "#f5c9a0", dress: "#f2c43a" };
const CAPT: Outfit = { jacket: "#f4f1ea", pants: "#2b3550", boots: "#1e1a24", hat: "cap", cap: "#2b3550", skin: "#ecd0b6", buttons: "#d8b040", build: "stout" };
const CROWD: Outfit[] = [
  { jacket: "#3a64b8", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#d8483c", skin: "#f5c9a0" },
  { jacket: "#2f8f7a", pants: "#2b2d42", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#8a5a3c", dress: "#2f8f7a" },
  { jacket: "#d8483c", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#6a3a20", skin: "#ecd0b6" },
  { jacket: "#9a5ac8", pants: "#2b3550", boots: "#2b2630", hat: "cap", cap: "#f2c43a", skin: "#c99067" },
  { jacket: "#f08a2c", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#f2d080", skin: "#f5c9a0", dress: "#f08a2c" },
  { jacket: "#4fa8d8", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#1e1414", skin: "#a8724c", build: "stout" },
];
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.06): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU, v = (975 - cy) * SU;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
type P2 = [number, number];

// ---------------- effect cards (no text anywhere) ----------------
const CONF = ["#ff5a7a", "#ffd84a", "#4fd0e8", "#8ae05a", "#b07aff", "#ff9a3a"];
/** a confetti piece (64 x 64): a small coloured rectangle */
const fxConf = (p: Pen, k: number) => { p.rot = [(k * 0.7) % 3, 32, 32]; p.poly([[14, 22], [50, 22], [50, 42], [14, 42]], CONF[k % CONF.length], 3); p.rot = null; };
/** glitch pixels (256 x 256): a scatter of cyan / magenta / yellow squares, pattern k */
const fxPix = (p: Pen, k: number) => {
  for (let i = 0; i < 9; i++) {
    const a = Math.sin(k * 12.9 + i * 78.2) * 43758.5, r = a - Math.floor(a), b = Math.sin(k * 4.1 + i * 39.3) * 24634.6, r2 = b - Math.floor(b);
    const sz = 22 + 30 * ((i * 7 + k) % 3) / 2;
    p.poly([[r * 200, r2 * 200], [r * 200 + sz, r2 * 200], [r * 200 + sz, r2 * 200 + sz], [r * 200, r2 * 200 + sz]], ["#3ff0ff", "#ff3fd0", "#ffe63f", "#7a5aff"][(i + k) % 4], 4);
  }
};
/** a golden trophy cup (256 x 256) */
const fxTrophy = (p: Pen) => {
  p.ell(128, 70, 70, 20, "#ffd84a", 6);
  p.poly([[58, 70], [198, 70], [176, 140], [150, 160], [106, 160], [80, 140]], "#f2b830", 6);
  p.ell(58, 95, 22, 28, null, 10); p.ell(198, 95, 22, 28, null, 10);
  p.poly([[116, 160], [140, 160], [146, 200], [110, 200]], "#e0a020", 6);
  p.poly([[84, 200], [172, 200], [178, 232], [78, 232]], "#a0603a", 6);
  p.stroke([[92, 82], [104, 130]], 8, "#fff6c0");
};
/** a firework (500 x 500): rays + dots in one colour, u 0..1 */
const fxFirework = (p: Pen, u: number, col: string) => {
  fxBurst(p, u, col, 14, 30, 200);
  const cs = ["#ff5a7a", "#ffd84a", "#4fd0e8", "#8ae05a", "#ffffff"];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283 + 0.2, r = 50 + 180 * (1 - (1 - u) ** 3); p.ell(250 + r * Math.cos(a), 250 + r * Math.sin(a), 20 * (1 - 0.5 * u), 20 * (1 - 0.5 * u), i % 3 ? col : cs[i % 5], 5); }
};
/** a jagged dark crack ring on the ground (256 x 256), flat */
const fxCrack = (p: Pen) => {
  const pts: P2[] = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * 6.283, r = 92 + (i % 2 ? 22 : -6); pts.push([128 + r * Math.cos(a), 128 + r * Math.sin(a)]); }
  p.poly(pts, "rgba(36,23,38,0.92)", 6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.3; p.stroke([[128 + 110 * Math.cos(a), 128 + 110 * Math.sin(a)], [128 + 126 * Math.cos(a + 0.1), 128 + 126 * Math.sin(a + 0.1)]], 6, "#241726"); }
};
/** wobble lines (256 x 256) beside a shaking thing: three short vertical zigzags */
const fxShake = (p: Pen, k: number) => {
  for (let j = 0; j < 3; j++) { const pts: P2[] = []; for (let i = 0; i <= 6; i++) pts.push([60 + j * 60 + (i % 2 ? 14 : -14) * (k % 2 ? 1 : -1), 40 + i * 30]); p.stroke(pts, 10, "#ffffff"); }
};

// ---------------- helpers ----------------
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, t: number, fo: FrontOpts, y = 0.15, shadow = true) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {}));
  if (shadow) blob(out, x, Math.max(0, y), z, 1, 0.9);
};
const burstAt = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d > 0 && d < 0.4) fx1(out, `${key}${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.8), col, 10, 30, 180), x, y, z, s, s);
};
const firework = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col: string) => {
  const d = t - t0;
  if (d > 0 && d < 0.9) fx1(out, `${key}${Math.floor(d * 20)}`, 500, 500, (p) => fxFirework(p, Math.min(1, d * 1.6), col), x, y - 1.2 * d * d, z, s, s);
};
/** confetti shower falling around (cx, cz) from height y0 after t0 */
const confetti = (out: Stage, t: number, t0: number, cx: number, y0: number, cz: number, n = 26, spread = 2.4, size = 0.12) => {
  const d = t - t0;
  if (d <= 0 || d > 3.2) return;
  for (let i = 0; i < n; i++) {
    const a = ((i * 137.5) % 360) * Math.PI / 180, r = spread * (0.3 + 0.7 * ((i * 29) % 10) / 10);
    const ox = Math.cos(a) * r * Math.min(1, d * 3), oz = Math.sin(a) * r * Math.min(1, d * 3);
    const y = y0 + 2.2 * Math.min(d, 0.35) - 0.9 * Math.max(0, d - 0.35);
    if (y < 0.05) continue;
    fx1(out, `cf${i % 6}_${Math.floor((d * 8 + i) % 6)}`, 64, 64, (p) => fxConf(p, i + Math.floor(d * 8)), cx + ox + 0.15 * Math.sin(d * 4 + i), y, cz + oz, size, size);
  }
};
/** flickering glitch pixels around a point (changes pattern every 3 frames) */
const pixels = (out: Stage, t: number, x: number, y: number, z: number, s: number, seed = 0) => {
  const k = Math.floor(t * 10) + seed;
  fx1(out, `pix${k % 8}`, 256, 256, (p) => fxPix(p, k % 8), x + 0.1 * Math.sin(k * 3.1), y + 0.08 * Math.cos(k * 2.3), z, s, s);
};
/** walk from a to b between t0 and t1 with a little hop */
const walkTo = (t: number, t0: number, t1: number, a: [number, number], b: [number, number]) => {
  const u = smooth((t - t0) / (t1 - t0));
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, hop: u > 0 && u < 1 ? 0.12 * Math.abs(Math.sin(u * Math.PI * 4)) : 0, moving: u > 0 && u < 1 };
};
const ARMS_UP: [P2, P2] = [[120, 170], [480, 170]];
const HANDS_FACE: [P2, P2] = [[200, 330], [400, 330]];
const TPOSE: [P2, P2] = [[10, 420], [590, 420]];

// ---------------- shots ----------------
const shots = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    // hook: the two friends gasp as a truck tumbles through the sky, then a second one hops up off the road
    const two = at(t, W.trucks);
    standing(cam, out, 1, HERO, HOOK_HERO[0], HOOK_HERO[1], t, { expr: "shock", look: -0.5, headTilt: -6, reach: two ? ARMS_UP : HANDS_FACE });
    standing(cam, out, 2, PAL, HOOK_PAL[0], HOOK_PAL[1], t, { expr: two ? "laugh" : "shock", look: -0.6, headTilt: 5, reach: two ? [[160, 300], [440, 300]] : [[230, 400], [370, 400]] });
    burstAt(out, "hb", t, -0.2, -2.2, 1.0, -1.6, 1.6);
    const v = vehPoses(1, t);
    burstAt(out, "hb2", t, W.trucks - 0.1, -17, 0.8, -5.2, 2.2);
    if (v.A.vis) pixels(out, t, v.A.x + 1.5, v.A.y + 2.6, v.A.z + 1.4, 1.4, 1);
    if (at(t, W.trucks)) pixels(out, t, v.B.x - 1.0, v.B.y + 3.0, v.B.z + 1.4, 1.4, 3);
  }
  if (id === 2) {
    // launch day: fireworks over the rooftops, people cheering along the sidewalk
    const cols = ["#ff5a7a", "#ffd84a", "#4fd0e8", "#8ae05a"];
    [[4.65, 14, 17, -3], [5.15, 30, 21, -6], [5.7, 6, 22, 0], [6.3, 38, 18, -2], [6.9, 20, 24, -4], [7.4, 44, 20, -3]].forEach(([t0, x, y, z], i) => firework(out, `fw${i % 4}`, t, t0, x, y, z, 17, cols[i % 4]));
    standing(cam, out, 1, HERO, -8, 2.2, t, { expr: "laugh", look: 0.2, reach: ARMS_UP });
    standing(cam, out, 2, PAL, -6.8, 2.8, t, { expr: "grin", look: -0.2, reach: [[140, 220], [460, 220]] });
    for (let i = 0; i < 8; i++) standing(cam, out, 10 + i, CROWD[i % 6], -24 + i * 4.5 + (i % 2), i % 3 === 0 ? -9.5 : 2.6 + (i % 2) * 1.0, t, { expr: i % 2 ? "grin" : "laugh", look: 0.2, reach: i % 3 === 1 ? ARMS_UP : undefined });
  }
  if (id === 3) {
    // 17 million copies: the crowd pours into the street from both ends and cheers
    const mil = at(t, W.million);
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1, x0 = side * (26 + (i * 7) % 18), x1 = -14 + ((i * 11) % 20), z = -6.2 + ((i * 13) % 10);
      const t0 = 8.1 + (i % 9) * 0.12, w = walkTo(t, t0 - 0.6, t0 + 2.2, [x0, z], [x1, z]);
      const y = (z > 0.15 || z < -7.15) ? 0.15 : 0;
      standing(cam, out, 20 + i, CROWD[i % 6], w.x, z, t, { expr: mil ? (i % 3 ? "laugh" : "grin") : "smile", look: -side * 0.4, reach: mil && i % 2 ? ARMS_UP : undefined }, y + w.hop);
    }
    standing(cam, out, 1, HERO, 1.6, 3.4, t, { expr: mil ? "laugh" : "grin", look: -0.4, reach: mil ? ARMS_UP : undefined });
    standing(cam, out, 2, PAL, 3.0, 3.8, t, { expr: "grin", look: -0.4, reach: mil ? [[140, 220], [460, 220]] : undefined });
    if (mil) confetti(out, t, W.million, -3, 5.5, -2, 40, 7, 0.22);
  }
  if (id === 4) {
    // close on the hero: big grin, cheering ... "played" -> he snaps into a stiff T-pose, glitch pixels flicker around him
    const tp = at(t, W.played), jx = tp ? 0.025 * Math.sign(Math.sin(t * 90)) : 0;
    standing(cam, out, 1, HERO, 0.5 + jx, 2.0, t, tp ? { expr: "neutral", look: 0, headTilt: 0, reach: TPOSE, blink: 0 } : { expr: "laugh", look: 0.3, headTilt: 4, reach: ARMS_UP });
    if (tp) { pixels(out, t, 0.0, 1.9, 2.15, 0.45, 2); pixels(out, t, 1.05, 1.3, 2.15, 0.4, 5); pixels(out, t, 0.2, 0.6, 2.15, 0.35, 6); }
  }
  if (id === 5) {
    // watchers on the near sidewalk; the red truck rear-ends the parked car and is flung over the rooftops
    const up = at(t, HIT + 0.1);
    standing(cam, out, 1, HERO, -4.6, 2.6, t, { expr: up ? "shock" : "smile", look: 0.6, headTilt: up ? -8 : 0, reach: up ? HANDS_FACE : undefined });
    standing(cam, out, 2, PAL, -3.2, 3.4, t, { expr: up ? "shock" : "smile", look: 0.6, headTilt: up ? -6 : 0 });
    standing(cam, out, 31, CROWD[2], 0.8, 3.9, t, { expr: up ? "shock" : "neutral", look: 0.5 });
    const v = vehPoses(5, t);
    burstAt(out, "hit", t, HIT, PARK_X - 2.4, 1.1, LANE_N + 0.9, 1.8);
    if (up && v.C.vis) pixels(out, t, v.C.x - 1, v.C.y + 3.2, v.C.z + 1.2, 1.5, 4);
  }
  if (id === 6) {
    // the boat jammed between the sea wall and the pier, shaking; the captain is spooked; onlookers lean over the rail
    const b = boatPose(t), sh = at(t, W.shaking);
    out.places.push(person(cam, who(5, CAPT), b.x, b.y + 0.56, b.z + 1.55, { side: false, mirror: false },
      { mode: "stand", blink: lidAt(t, 5), expr: "shock", look: 0.5, reach: sh ? HANDS_FACE : [[150, 300], [450, 300]] }, {}, 1.05));
    standing(cam, out, 1, HERO, HX - 5.2, QUAY_Z + 1.0, t, { expr: at(t, W.ghost) ? "laugh" : "nervous", look: 0.6, headTilt: -5 });
    standing(cam, out, 2, PAL, HX - 6.6, QUAY_Z + 1.7, t, { expr: "shock", look: 0.6 });
    const k = Math.floor(t * 12);
    fx1(out, `shk${k % 2}`, 256, 256, (p) => fxShake(p, k), b.x - 1.4, b.y + 1.4, b.z + 1.2, 0.7, 0.7);
    fx1(out, `shkR${k % 2}`, 256, 256, (p) => fxShake(p, k + 1), b.x + 1.3, b.y + 1.4, b.z + 1.0, 0.7, 0.7);
    if (at(t, W.stuck)) pixels(out, t, b.x, b.y + 2.2, b.z + 1.2, 0.7, 7);
    if (at(t, W.stuck) && t < W.stuck + 0.4) burstAt(out, "bump", t, W.stuck, HX + 0.2, WATER_Y + 1.0, QUAY_Z - 0.3, 1.2);
    void BOAT_Z;
  }
  if (id === 7) {
    // the hero sinks through the sidewalk in glitchy steps; his friend stares
    const y = 0.15 + sinkY(7, t), gone = y < -2.2;
    const fl = Math.sin(t * 14) * 40;
    if (!gone) standing(cam, out, 1, HERO, HERO_SPOT[0], HERO_SPOT[1], t, { expr: at(t, W.sank) ? "shock" : "grin", look: 0.4, reach: at(t, W.sank) ? [[110, 160 + fl], [490, 160 - fl]] : undefined }, y, y > 0.1);
    if (at(t, W.sank)) out.fx.push({ key: "crack", cw: 256, ch: 256, draw: fxCrack, x: HERO_SPOT[0], y: 0.165, z: HERO_SPOT[1], w: 1.0, h: 0.75, flat: true });
    standing(cam, out, 2, PAL, -0.15, 2.55, t, { expr: at(t, W.sank) ? "shock" : "smile", look: 0.6, headTilt: at(t, W.through) ? 8 : 0, reach: at(t, W.road) ? HANDS_FACE : undefined });
    if (at(t, W.sank)) { pixels(out, t, HERO_SPOT[0] - 0.5, 0.35, HERO_SPOT[1] + 0.3, 0.45, 2); pixels(out, t, HERO_SPOT[0] + 0.55, 0.3, HERO_SPOT[1] + 0.2, 0.4, 5); }
  }
  if (id === 8) {
    // the score: he pops back up out of the sidewalk, trophy overhead; confetti; the crowd cheers
    const y = 0.15 + sinkY(8, t), up = y > -2.0, tr = at(t, W.tie);
    if (up) standing(cam, out, 1, HERO, HERO_SPOT[0], HERO_SPOT[1], t, { expr: tr ? "laugh" : "grin", look: 0.2, reach: tr ? [[220, 150], [380, 150]] : ARMS_UP }, Math.min(y, 0.15 + Math.max(0, y - 0.15)), y > 0.1);
    if (up && tr) { const [hx, hy, hz] = onCard(cam, HERO_SPOT[0], Math.max(0.15, y), HERO_SPOT[1], 300, 70, 0.1); fx1(out, "trophy", 256, 256, fxTrophy, hx, hy + 0.12, hz, 0.62, 0.62); }
    const ch = at(t, W.ninety);
    standing(cam, out, 2, PAL, 0.0, 1.5, t, { expr: ch ? "laugh" : "nervous", look: 0.5, reach: ch ? ARMS_UP : undefined });
    if (!at(t, W.ninety + 0.4)) out.fx.push({ key: "crack", cw: 256, ch: 256, draw: fxCrack, x: HERO_SPOT[0], y: 0.165, z: HERO_SPOT[1], w: 1.0, h: 0.75, flat: true });
    for (let i = 0; i < 4; i++) standing(cam, out, 40 + i, CROWD[(i + 1) % 6], -1.4 + i * 1.3, 0.9 + (i % 2) * 0.6, t, { expr: ch ? (i % 2 ? "laugh" : "grin") : "nervous", look: i < 2 ? 0.5 : -0.4, reach: ch && i % 2 === 0 ? ARMS_UP : undefined });
    if (ch) burstAt(out, "pop", t, W.ninety - 0.1, HERO_SPOT[0], 0.5, HERO_SPOT[1] + 0.3, 1.6);
    confetti(out, t, W.ninety, HERO_SPOT[0], 2.6, HERO_SPOT[1] - 0.4, 30, 2.2, 0.13);
    confetti(out, t, W.record, HERO_SPOT[0], 3.0, HERO_SPOT[1] - 0.4, 30, 2.6, 0.13);
  }
  if (id === 9) {
    // would you play it? the friends look at us; a truck drifts across the sky behind them
    const fl = at(t, W.flying2) && !at(t, W.send), snd = at(t, W.send);
    standing(cam, out, 1, HERO, END_HERO[0], END_HERO[1], t, { expr: snd ? "grin" : fl ? "nervous" : "smile", look: fl ? -0.5 : 0, headTilt: fl ? -9 : 0, reach: snd ? [[110, 380], [490, 380]] : undefined });
    standing(cam, out, 2, PAL, END_PAL[0], END_PAL[1], t, { expr: at(t, W.called) ? "laugh" : fl ? "shock" : "grin", look: fl ? -0.6 : -0.2, headTilt: fl ? -7 : 3, reach: at(t, W.called) ? [[200, 340], [400, 340]] : undefined });
    const v = vehPoses(9, t);
    if (Math.floor(t * 3) % 3 === 0) pixels(out, t, v.A.x + 2, v.A.y + 2.8, v.A.z + 1.2, 1.3, 6);
  }
};
void clamp01; void WATER_Y; void fxPuff; void END_PAL;

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  shots(cam, out, id, t);
  return out;
};
export { FPS };
