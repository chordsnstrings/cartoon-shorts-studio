// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import {
  FPS, V3, SHOTS, W, smooth, clamp01, at, CTRL, FLY, SAT_S, ORBIT_S, probeAt, flameAt, faceAt, SEATS, LAPTOP_AT, PIP_T,
  P_EARTH, P_VENUS, P_MERC, ringPt, R_PLAN, R_REAL, orbitTh,
} from "./story";
import { drawSat, fxSparkle, fxGlow } from "./sat";
import { rrect, ellPts, P2 } from "./toon";
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

// ================= the Mercury short's cast =================
const ENG_A: Outfit = { jacket: "#5b78c9", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const ENG_B: Outfit = { jacket: "#e0a23a", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#6a3b22", skin: "#f5c9a0" };
const ENG_C: Outfit = { jacket: "#4f9a6e", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20", skin: "#e8b48c" };
const SET = "#2b2f3a"; // headsets
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const seated = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number, lift = 0) => {
  out.places.push(person(cam, who(i, o), x, 0.33 + lift, z, { side: false, mirror: false }, { mode: "sit", phones: SET, ...fo, blink: lidAt(t, i) }, {}));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number, shadow = true, lift = 0) => {
  const pl = person(cam, who(i, o), x, lift, z, { side: false, mirror: false }, { mode: "stand", phones: SET, ...fo, blink: lidAt(t, i) }, {});
  out.places.push(pl);
  if (shadow) blob(out, x, 0, z, 1, lift > 0 ? 0.6 : 0.9);
  return pl;
};
/** world point of a canvas point (cx, cy) on an upright camera-facing card standing at (x, y, z), pulled `fwd` m toward the lens */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.05, sc = 1): V3 => {
  const yaw = Math.atan2(cam.pos.x - x, cam.pos.z - z), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = (cx - 300) * SU * sc, fx = Math.sin(yaw) * fwd, fz = Math.cos(yaw) * fwd;
  return [x + rx * dx + fx, y + (975 - cy) * SU * sc, z + rz * dx + fz];
};
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });

// ---------------- effect cards (no text anywhere) ----------------
/** the engine flame (256 x 512): a fat cartoon teardrop hanging from the top centre */
const fxFlame = (p: Pen, k: number) => {
  const L = 500 * k, w = 92;
  const out: P2[] = [], inn: P2[] = [];
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI; out.push([128 - w * Math.cos(a), 6 + L * Math.sin(a / 2) ** 1.4 * (i === 10 ? 1 : 1)]); }
  const o2: P2[] = [[128 - w, 6], [128 - w * 0.9, 6 + L * 0.35], [128 - w * 0.45, 6 + L * 0.8], [128, 6 + L], [128 + w * 0.45, 6 + L * 0.8], [128 + w * 0.9, 6 + L * 0.35], [128 + w, 6]];
  void out;
  p.poly(o2, "#ff8a2a", 8);
  for (const s of [0.55]) inn.push([128 - w * s, 6], [128 - w * s * 0.8, 6 + L * 0.3], [128, 6 + L * 0.62], [128 + w * s * 0.8, 6 + L * 0.3], [128 + w * s, 6]);
  p.poly(inn, "#ffe27a", 0);
  p.poly([[128 - w * 0.25, 6], [128, 6 + L * 0.3], [128 + w * 0.25, 6]], "#fffbe8", 0);
};
/** a cream/grey cough puff (300 x 300) */
const fxPuffBig = (p: Pen, seed: number, col = "#f4efe6", col2 = "#d9d3c8") => {
  for (let i = 0; i < 6; i++) { const a = seed + i * 1.05, r = 50 + 20 * Math.sin(i * 2.1 + seed); p.ell(150 + 62 * Math.cos(a), 156 + 40 * Math.sin(a), r, r * 0.85, i % 2 ? col : col2, 0); }
  p.ell(150, 150, 74, 64, col, 0);
};
/** a speed streak (64 x 512) */
const fxStreak = (p: Pen) => { p.stroke([[32, 30], [32, 482]], 18, "rgba(255,248,228,0.95)"); };
/** energy bars (512 x 512): a bolt on top; left a short bar over a tiny Pluto, right a tall bar over Mercury that overflows */
const fxEnergy = (p: Pen, uM: number, uP: number, t: number) => {
  p.poly([[262, 18], [218, 92], [252, 92], [234, 150], [296, 70], [262, 70], [286, 18]], "#ffe14a", 8);
  const bar = (x: number, u: number, col: string) => {
    p.poly(rrect(x - 52, 170, x + 52, 420, 18), "#1c2a52", 9);
    if (u > 0.01) { const top = 412 - 234 * Math.min(1, u); p.poly(rrect(x - 40, top, x + 40, 412, 12), col, 0); }
  };
  bar(150, uP, "#9fd6ff"); bar(362, uM, "#ffb02a");
  if (uM >= 1) { // overflowing: sparks off the top
    for (let i = 0; i < 4; i++) { const a = -1.2 + i * 0.8 + 0.2 * Math.sin(t * 9 + i), r = 40 + 14 * ((t * 6 + i) % 1); const pts: P2[] = []; for (let k = 0; k < 8; k++) { const an = (k * Math.PI) / 4, rr = k % 2 ? 6 : 16; pts.push([362 + r * Math.cos(a) + rr * Math.cos(an), 172 + r * Math.sin(a) * 0.8 + rr * Math.sin(an)]); } p.poly(pts, "#fff3a0", 0); }
  }
  // planet icons under the bars
  p.ell(150, 468, 26, 26, "#d8bfa2", 7); p.ell(158, 474, 11, 9, "#f3e6d4", 0);
  p.ell(362, 470, 34, 34, "#a39b91", 7); p.ell(352, 460, 8, 7, "#7e776f", 0); p.ell(374, 480, 6, 5, "#7e776f", 0);
};
/** a flyby counter pip (128 x 128): coloured planet disc with a white tick */
const fxPip = (p: Pen, col: string) => {
  p.ell(64, 64, 52, 52, col, 9);
  p.stroke([[38, 66], [56, 84], [92, 44]], 12, "#ffffff");
};
const CONF = ["#e8483c", "#f2c43a", "#3a64b8", "#4f9a6e", "#c95b8a", "#fbfaf4"];
const fxConf = (p: Pen, k: number) => p.poly([[4, 4], [60, 4], [60, 28], [4, 28]], CONF[k % CONF.length], 3);
/** the laptop (512 x 384) with a green cartoon bug on its screen at u (0..1 across), wave = the bug waves a leg */
const fxLaptopBug = (p: Pen, t: number, bugU: number, wave: boolean) => {
  p.poly([[70, 30], [442, 30], [432, 200], [80, 200]], "#3a3f4c", 10); // lid back
  p.poly([[96, 52], [416, 52], [408, 182], [104, 182]], "#7fd8ff", 0);
  // code lines (bars, no text)
  for (let i = 0; i < 6; i++) { const y = 66 + i * 19; p.poly(rrect(116 + (i % 3) * 14, y, 116 + (i % 3) * 14 + 80 + ((i * 53) % 150), y + 9, 4), i === 3 ? "#ff6a5a" : "#2f6ba8", 0); }
  p.poly([[96, 52], [416, 52], [408, 182], [104, 182]], null, 6);
  p.poly([[40, 210], [472, 210], [500, 350], [12, 350]], "#c9ced8", 10); // base
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { const y = 228 + r * 26, x0 = 70 - r * 6 + k * 42; p.poly(rrect(x0, y, x0 + 32, y + 18, 4), "#9aa3b8", 3); }
  if (bugU < 0) return;
  const bx = 130 + 250 * bugU, by = 124 + 6 * Math.sin(bugU * 30), step = Math.sin(t * 24);
  for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) { // six legs
    const lw = wave && s === 1 && i === -1 ? Math.sin(t * 14) * 18 : step * 6 * (i % 2 ? 1 : -1) * s;
    p.stroke([[bx + i * 16, by], [bx + i * 20 + lw, by + s * 34]], 6, INK);
  }
  p.ell(bx, by, 40, 26, "#5fbf4a", 7); // shell
  p.stroke([[bx - 4, by - 24], [bx - 4, by + 24]], 4, INK);
  p.ell(bx + 42, by, 16, 15, "#3f8a3a", 6); // head
  p.stroke([[bx + 50, by - 10], [bx + 68, by - 30 + (wave ? 6 * Math.sin(t * 12) : 0)]], 4, INK); p.stroke([[bx + 50, by + 10], [bx + 70, by + 26]], 4, INK);
  p.dot(bx + 47, by - 5, 5, "#ffffff"); p.dot(bx + 48, by - 5, 2.5, INK);
};
/** an up arrow (128 x 256) */
const fxUp = (p: Pen) => { p.poly([[64, 10], [118, 90], [84, 90], [84, 246], [44, 246], [44, 90], [10, 90]], "#ffd24a", 9); };

// ---------------- the probe ----------------
const SAT_DY = (975 - 640) * SU;
const NOZ = (826 - 640) * SU; // nozzle exit below the card centre (per unit scale)
const probe = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const pa = probeAt(id, t);
  if (!pa) return;
  const { c, s, tilt } = pa, face = faceAt(id, t);
  const d = cam.pos.distanceTo(tmp.set(c[0], c[1], c[2])) / s, [w, h, k] = tier(d);
  const light = light2D(cam, false), blinkable = face === "dots" || face === "happy" || face === "curious" || face === "think" || face === "worried";
  const pose = { face, wings: 1, chips: -1, nozzle: true, blink: blinkable ? lidAt(t, 90) : 0, light, tilt: q(tilt, 30) };
  out.places.push({ key: "sat|" + fkey(pose), x: c[0], y: c[1] - SAT_DY * s, z: c[2], scale: s, size: [w, h, k], draw: (p) => drawSat(p, pose as never) });
  // the engine flame + coughing puffs (below the nozzle, a hair toward the lens so the card does not hide it)
  const fl = flameAt(id, t);
  const tw = (tmp.set(cam.pos.x - c[0], cam.pos.y - c[1], cam.pos.z - c[2]).normalize());
  const nx = c[0] + tw.x * 0.04 * s, nz = c[2] + tw.z * 0.04 * s, ny = c[1] - NOZ * s;
  if (fl.k > 0.03) {
    const fh = 0.9 * s * fl.k * (0.9 + 0.12 * Math.sin(t * 41)), fw = 0.2 * s;
    fx1(out, `flame${Math.round(fl.k * 10)}|${Math.floor(t * 15) % 3}`, 256, 512, (p) => fxFlame(p, 0.92 + 0.08 * ((Math.floor(t * 15) % 3) - 1)), nx, ny - fh / 2 + 0.02 * s, nz, fw, fh);
    fx1(out, "fglow", 256, 256, (p) => fxGlow(p, "rgba(255,190,90,0.85)"), nx, ny - fh * 0.25, nz - tw.z * 0.01, fw * 2.2, fh * 0.9, 0, true);
  }
  if (fl.sputter) for (let i = 0; i < 4; i++) {
    const u = ((t * 1.6 + i / 4) % 1), side = i % 2 ? 1 : -1;
    fx1(out, `cough${i % 3}|${Math.floor(u * 10)}`, 300, 300, (p) => fxPuffBig(p, i, `rgba(240,234,224,${(0.95 * (1 - u)).toFixed(1)})`, `rgba(214,208,198,${(0.95 * (1 - u)).toFixed(1)})`), nx + side * (0.12 + 0.45 * u) * s, ny - (0.08 + 0.12 * u) * s + 0.25 * u * s, nz, (0.1 + 0.22 * u) * s, (0.1 + 0.22 * u) * s, 0, true);
  }
  return { c, s };
};

// ---------------- places ----------------
const space = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const pr = probe(cam, out, id, t);
  if (!pr) return;
  const { c, s } = pr;
  if (id === 3) { // speed streaks rushing up past the falling probe
    for (let i = 0; i < 12; i++) {
      const u = (t * 1.9 + i * 0.37) % 1, ang = i * 2.399, r = 0.55 + 0.45 * ((i * 0.61) % 1);
      fx1(out, "streak", 64, 512, fxStreak, c[0] + r * Math.cos(ang) * 1.3, c[1] - 2.4 + 5.2 * u, c[2] + r * Math.sin(ang) * 0.8 - 0.3, 0.035, 0.55 + 0.25 * (i % 3));
    }
  }
  if (id === 5) { // energy bars beside the probe
    const uM = smooth((t - (W.energy - 0.15)) / 0.9) * 1.0, uP = smooth((t - (W.pluto - 0.1)) / 0.4) * 0.28;
    fx1(out, `en${Math.round(uM * 30)}|${Math.round(uP * 30)}|${uM >= 1 ? Math.floor(t * 12) % 6 : 0}`, 512, 512, (p) => fxEnergy(p, uM, uP, t), c[0] + 0.92, c[1] + 0.06, c[2] + 0.1, 1.1, 1.1);
  }
  if (id === 7 && at(t, W.stopped)) { // a little smoke ring drifts off the dead nozzle
    const u = clamp01((t - W.stopped) / 1.4), ny = c[1] - NOZ * s;
    for (let i = 0; i < 3; i++) fx1(out, `ring${i}|${Math.floor(u * 10)}`, 300, 300, (p) => fxPuffBig(p, i + 4, `rgba(200,196,190,${(0.9 * (1 - u)).toFixed(1)})`, `rgba(170,166,160,${(0.9 * (1 - u)).toFixed(1)})`), c[0] + (i - 1) * 0.12 * (1 + u), ny - 0.1 - 0.35 * u, c[2] + 0.05, 0.16 + 0.22 * u, 0.12 + 0.16 * u, 0, true);
  }
  if (id === 9 && at(t, W.caught)) { // sparkles round the probe as the orbit closes
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + t * 2, r = 0.9 * s * (0.8 + 0.2 * Math.sin(t * 5 + i)); fx1(out, `spk${i}|${Math.floor(t * 10) % 5}`, 128, 128, (p) => fxSparkle(p, Math.floor(t * 10) + i), c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2] + 2, 0.32 * s, 0.32 * s); }
  }
  if (id === 11 && at(t, W.higher)) { // the up arrow from the planned ring to the real one
    const th = orbitTh(11, t), a = ringPt(th, R_PLAN), b = ringPt(th, R_REAL), u = smooth((t - (W.higher - 0.07)) / 0.3);
    fx1(out, "up", 128, 256, fxUp, (a[0] + b[0]) / 2 + 14, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 10, 26 * u + 0.01, 52 * u + 0.01, 0);
  }
  void ORBIT_S; void SAT_S;
};
const fly = (cam: CamInfo, out: Stage, id: number, t: number) => {
  probe(cam, out, id, t);
  // the nine pips pop beside the planets they belong to
  const spots: [V3, string][] = [
    [[FLY + 15, P_EARTH[1], 1], "#3f8fe0"],
    [[FLY + 15, P_VENUS[1] + 2.4, 1], "#f2c45a"], [[FLY + 15, P_VENUS[1] - 2.4, 1], "#f2c45a"],
    ...[0, 1, 2, 3, 4, 5].map((i) => [[FLY + 12.5 + 4.4 * (i % 2), P_MERC[1] + 4.4 - 4.4 * Math.floor(i / 2), 1] as V3, "#a39b91"] as [V3, string]),
  ];
  PIP_T.forEach((tp, i) => {
    const dd = t - (tp - 2 / FPS);
    if (dd < 0) return;
    const pop = dd < 0.12 ? 0.6 + 4.5 * dd : 1 + 0.1 * Math.exp(-dd * 8) * Math.sin(dd * 30);
    const [p, col] = spots[i];
    fx1(out, `pip${col}`, 128, 128, (pp) => fxPip(pp, col), p[0], p[1], p[2], 3.6 * pop, 3.6 * pop);
  });
};
const ctrl = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const os = [ENG_A, ENG_B, ENG_C];
  if (id === 10) { // they jump up and cheer
    const e: Expr[] = ["laugh", "grin", "laugh"];
    SEATS.forEach((x, i) => standing(cam, out, 50 + i, os[i], CTRL + x, -1.3, { expr: at(t, W.second) && i === 1 ? "laugh" : e[i], wave: 0.5 + 0.5 * Math.sin(t * 9 + i * 2) }, t, false, Math.max(0, 0.16 * Math.sin((t - 21.8) * 7 + i * 1.7))));
    for (let i = 0; i < 18; i++) {
      const u = ((t - 21.8) * 0.4 + i / 18) % 1, x = CTRL - 2.2 + 4.4 * ((i * 0.37) % 1), z = -1.6 + 2.6 * ((i * 0.61) % 1);
      fx1(out, `conf${i % 6}`, 64, 32, (p) => fxConf(p, i), x + 0.15 * Math.sin(t * 3 + i), 3.2 - 3.4 * u, z, 0.09, 0.045, t * 4 + i);
    }
    return;
  }
  if (id === 8 || id === 12) { // the laptop engineer standing in front of the desk; the other two seated behind
    SEATS.forEach((x, i) => { if (i !== 1) seated(cam, out, 50 + i, os[i], CTRL + x, -1.3, { expr: id === 12 ? "smile" : "nervous", look: 0, phase: t }, t); });
    const L = LAPTOP_AT;
    const ex: Expr = id === 8 ? (at(t, W.issue) ? "stern" : "neutral") : (at(t, W.trust) ? "grin" : "smile");
    const look = id === 8 ? (at(t, W.issue) ? 0 : -0.3) : 0;
    standing(cam, out, 51, ENG_B, L[0], L[2], { expr: ex, look, headTilt: id === 8 && !at(t, W.issue) ? 8 : 0, reach: [[205, 500], [395, 500]] }, t);
    const [lx, ly, lz] = onCard(cam, L[0], 0, L[2], 300, 455, 0.12);
    const bugU = id === 8 ? clamp01((t - 18.0) / 1.8) : 0.55;
    fx1(out, `lap${id}|${Math.round(bugU * 40)}|${Math.floor(t * 12) % 4}`, 512, 384, (p) => fxLaptopBug(p, t, bugU, id === 12), lx, ly, lz, 0.48, 0.36);
    return;
  }
  // 2 + 6: seated, watching their own monitors; shock when the flame on the wall goes out
  const stop = id === 2 ? at(t, W.cut) : at(t, W.engines);
  SEATS.forEach((x, i) => {
    const d = id === 2 ? t - W.cut : t - W.engines;
    const ex: Expr = stop ? (i === 1 ? "shock" : i === 0 ? "dazed" : "shock") : (id === 6 && at(t, W.final) ? "nervous" : i === 1 ? "nervous" : "neutral");
    const lift = stop && d < 0.6 ? Math.max(0, 0.12 * Math.sin(d * 10)) : 0;
    seated(cam, out, 50 + i, os[i], CTRL + x, -1.3, { expr: ex, look: stop ? 0 : -0.15 * (i - 1), phase: t, headTilt: stop ? -6 : 6 }, t, lift);
  });
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "space") space(cam, out, id, t);
  else if (s.place === "fly") fly(cam, out, id, t);
  else ctrl(cam, out, id, t);
  void fxBurst; void viewOf; void vOf; void hh; void LIGHTS; void NOINK; void ellPts; void bodySide; void FPS; void R_REAL;
  return out;
};
export { FPS };
