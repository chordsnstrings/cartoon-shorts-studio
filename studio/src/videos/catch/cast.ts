// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, P2, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import {
  FPS, V3, SHOTS, W, smooth, clamp01, at, AXIS, MOUNT_Y, SHIP_R, ARM_Y, ARM_Z, HERO_AT, BUD_AT, FOOT, C1, SEA,
  shipPose, boostPose, liftY, shipCatchY,
} from "./story";
import { fxSparkle, fxGlow } from "./sat";
import { fxPow } from "./robot_fx";
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

// ================= the catch short's cast =================
const HERO: Outfit = { jacket: "#f08a2a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#3a2420", skin: "#c99067" };
const BUD: Outfit = { jacket: "#5b78c9", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#6a3b22", skin: "#f5c9a0" };
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const PHONES = "#2b2f3a";

/** a standing character (front card), y lift for jumps; returns the placement so props can find its canvas points */
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, p: V3, t: number, fo: FrontOpts, lift = 0, shadow = true) => {
  const pl = person(cam, who(i, o), p[0], lift, p[2], { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {});
  out.places.push(pl);
  if (shadow) blob(out, p[0], 0, p[2], 1, lift > 0 ? 0.6 : 0.9);
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
/** chopsticks held at the grip (card centre-left), tips up-right; closed pinches a dumpling */
const fxChop = (p: Pen, closed: boolean, dumpling: boolean) => {
  const g1: P2 = [40, 210], g2: P2 = [62, 236], t1: P2 = closed ? [196, 58] : [176, 30], t2: P2 = closed ? [214, 76] : [244, 108];
  p.stroke([g1, t1], 15, INK); p.stroke([g1, t1], 8, "#d0904c");
  p.stroke([g2, t2], 15, INK); p.stroke([g2, t2], 8, "#b5763a");
  if (dumpling) drawDumpling(p, closed ? 214 : 222, closed ? 50 : 60, 1.25);
};
const drawDumpling = (p: Pen, x: number, y: number, k: number) => {
  p.ell(x, y + 6 * k, 34 * k, 24 * k, "#f6ecd2", 6 * k);
  for (let i = -2; i <= 2; i++) p.stroke([[x + i * 9 * k, y - 14 * k], [x + i * 7 * k, y - 2 * k]], 3 * k, "#d8c79e");
};
const fxDump = (p: Pen) => drawDumpling(p, 64, 60, 1.5);
/** a fat cream smoke cloud (300 x 300) */
const fxPuffBig = (p: Pen, seed: number, col = "#f4efe6", col2 = "#e2dccf") => {
  for (let i = 0; i < 7; i++) {
    const a = seed + i * 0.9, r = 52 + 22 * Math.sin(i * 2.1 + seed);
    p.ell(150 + 70 * Math.cos(a), 160 + 40 * Math.sin(a), r, r * 0.85, i % 2 ? col : col2, 0);
  }
  p.ell(150, 150, 80, 70, col, 0);
};
/** fuel gauge (256 x 256): dial, a red low zone at the left, needle at u (1 full .. 0 empty), a drop icon; no letters */
const fxGauge = (p: Pen, u: number) => {
  p.ell(128, 140, 112, 112, "#fbfaf4", 9); p.ell(128, 140, 96, 96, "#2b2f3a", 0);
  const A = (k: number) => Math.PI * (1.15 + 0.7 * k); // sweep from lower-left (empty) to lower-right (full) over the top
  const red: P2[] = []; for (let i = 0; i <= 8; i++) { const a = A(0.22 * i / 8); red.push([128 + 80 * Math.cos(a), 140 + 80 * Math.sin(a)]); }
  p.stroke(red, 14, "#e8483c");
  for (let i = 0; i <= 8; i++) { const a = A(i / 8); p.stroke([[128 + 70 * Math.cos(a), 140 + 70 * Math.sin(a)], [128 + 88 * Math.cos(a), 140 + 88 * Math.sin(a)]], i % 4 ? 4 : 8, "#fbfaf4"); }
  p.poly([[128, 176], [116, 196], [118, 206], [128, 212], [138, 206], [140, 196]], "#8fd0ff", 3);
  const a = A(u); p.stroke([[128, 140], [128 + 74 * Math.cos(a), 140 + 74 * Math.sin(a)]], 9, "#ff5a3c"); p.dot(128, 140, 13, "#fbfaf4");
};
const CONF = ["#e8483c", "#f2c43a", "#3a64b8", "#4f9a6e", "#c95b8a", "#fbfaf4"];
const fxConf = (p: Pen, k: number) => p.poly([[4, 4], [60, 4], [60, 28], [4, 28]], CONF[k % CONF.length], 3);
/** a jagged cartoon boom (512 x 512): orange star, yellow core, dark puffs at the rim */
const fxBoom = (p: Pen, u: number) => {
  const k = u < 0.25 ? 0.5 + 2 * u : 1 + 0.15 * (u - 0.25);
  const star = (R: number, r: number, n: number, rot: number): P2[] => Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R * (0.82 + 0.18 * Math.sin(i * 5.3));
    return [256 + rr * Math.cos(a), 256 + rr * Math.sin(a)] as P2;
  });
  p.poly(star(240 * k, 150 * k, 11, 0.1), "#ff7a2a", 12);
  p.poly(star(170 * k, 100 * k, 11, 0.4), "#ffd23c", 0);
  p.ell(256, 256, 70 * k, 64 * k, "#fff8d8", 0);
};
/** grey-brown smoke (300 x 300), u 0..1 fades */
const fxSmoke = (p: Pen, u: number, k: number) => { const a = (0.92 * (1 - u) ** 0.7).toFixed(2); for (let i = 0; i < 5; i++) { const an = i * 1.25 + k, r = 54 + 12 * (i % 2); p.ell(150 + 52 * Math.cos(an), 150 + 40 * Math.sin(an), r, r * 0.85, `rgba(${92 + 14 * (i % 2)},${86 + 10 * (i % 2)},${84},${a})`, 0); } };
/** white splash column (256 x 384) */
const fxSplashCol = (p: Pen, u: number) => {
  const h = 340 * Math.sin(Math.min(1, u) * Math.PI * 0.9);
  for (let i = -4; i <= 4; i++) { const hh = h * (1 - Math.abs(i) * 0.2) * 0.6; p.stroke([[128 + i * 12, 380], [128 + i * 26, 380 - hh]], 14, "#e8f4ff"); p.dot(128 + i * 26, 380 - hh, 10, "#ffffff"); }
};

// ---------------- helpers ----------------
const puff = (out: Stage, key: string, i: number, x: number, y: number, z: number, s: number, u: number, col?: string, col2?: string) =>
  fx1(out, `${key}${i % 3}|${Math.floor(u * 16)}`, 300, 300, (p) => fxPuffBig(p, i, col, col2), x, y, z, s, s * 0.85, 0, true);
const pow = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number) => {
  const d = t - t0;
  if (d >= -1 / FPS && d < 0.3) fx1(out, `${key}${Math.floor(d * 30)}`, 512, 512, (p) => fxPow(p, Math.max(0, d) / 0.3), x, y, z, s, s);
};
/** the hero's and friend's reactions at the fence */
const friends = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    const c = at(t, W.caught);
    standing(cam, out, 1, HERO, HERO_AT, t, { expr: c ? "laugh" : "shock", facing: 1, look: 0.7, headTilt: -10, phones: PHONES, wave: c ? 0.6 + 0.4 * Math.sin(t * 9) : undefined }, c ? Math.max(0, 0.12 * Math.sin((t - W.caught) * 9)) : 0);
    standing(cam, out, 2, BUD, BUD_AT, t, { expr: c ? "grin" : "shock", facing: 1, look: 0.5, headTilt: -8, reach: c ? undefined : [[230, 600], [370, 600]] }, 0);
  }
  if (id === 2) { // CU: the friend snaps his chopsticks shut on a dumpling, grinning at the tower behind the lens
    const closed = at(t, W.chopsticks - 0.05);
    const pl = standing(cam, out, 2, BUD, BUD_AT, t, { expr: closed ? "grin" : "smile", facing: -1, look: -0.4, reach: [null, [430, 575]] }, 0, false);
    const [x, y, z] = onCard(cam, pl.x, 0, pl.z, 470, 520, 0.08);
    fx1(out, `chop|${closed}`, 256, 256, (p) => fxChop(p, closed, true), x, y, z, 0.38, 0.38);
    if (closed && t < W.chopsticks + 0.4) for (let i = 0; i < 3; i++) fx1(out, `cspk${i}|${Math.floor(t * 10) % 5}`, 128, 128, (p) => fxSparkle(p, Math.floor(t * 10) + i), x + 0.12 + 0.05 * i, y + 0.14 - 0.04 * i, z, 0.07, 0.07);
  }
  if (id === 4 && t >= 8.45) {
    standing(cam, out, 1, HERO, HERO_AT, t, { expr: at(t, W.forty) ? "shock" : "grin", facing: 1, look: 0.8, headTilt: -14, phones: PHONES, reach: [[200, 400], null] }, 0);
  }
  if (id === 10) { // Caught! they jump and cheer, confetti
    const j = (k: number) => Math.max(0, 0.22 * Math.sin((t - 21.7) * 7 + k));
    standing(cam, out, 1, HERO, HERO_AT, t, { expr: at(t, W.first) ? "laugh" : "grin", facing: 1, look: 0.3, phones: PHONES, wave: 0.6 + 0.4 * Math.sin(t * 10) }, j(0));
    standing(cam, out, 2, BUD, BUD_AT, t, { expr: "laugh", facing: 1, look: 0.2, wave: 0.6 + 0.4 * Math.sin(t * 10 + 2) }, j(1.6));
    for (let i = 0; i < 16; i++) {
      const u = ((t - 21.7) * 0.45 + i / 16) % 1, x = HERO_AT[0] - 1.4 + 3.4 * ((i * 0.37) % 1), z = HERO_AT[2] - 0.8 + 1.6 * ((i * 0.61) % 1);
      fx1(out, `conf${i % 6}`, 64, 32, (p) => fxConf(p, i), x + 0.15 * Math.sin(t * 3 + i), 3.0 - 3.2 * u, z, 0.09, 0.045, t * 4 + i);
    }
  }
  if (id === 12) {
    const c = t > 29.4;
    const ex: Expr = at(t, W.drops) ? "laugh" : at(t, W.send) ? "grin" : c ? "smile" : "neutral";
    standing(cam, out, 1, HERO, FOOT, t, { expr: ex, facing: c && t < 31.4 ? 1 : 0, look: c && t < 31.4 ? 0.6 : 0, headTilt: c && t < 31.4 ? -12 : 0, phones: PHONES, reach: at(t, W.would) && t < 31.4 ? [[150, 130], null] : undefined }, 0);
    if (t >= 31.4) { // the friend with his dumpling: drops it on "drops"
      const b: V3 = [FOOT[0] + 0.75, 0, FOOT[2] + 0.59];
      const dropped = at(t, W.drops);
      const pl = standing(cam, out, 2, BUD, b, t, { expr: dropped ? "shock" : "smile", facing: 1, look: 0.3, reach: [null, [430, 575]] }, 0);
      const [x, y, z] = onCard(cam, pl.x, 0, pl.z, 470, 520, 0.08);
      fx1(out, `chop|${dropped}`, 256, 256, (p) => fxChop(p, !dropped, !dropped), x, y, z, 0.38, 0.38);
      if (dropped) {
        const d0 = t - (W.drops - 2 / FPS), d = Math.min(d0, Math.sqrt((y + 0.06) / 4.9)), yy = Math.max(0.06, y + 0.12 - 4.9 * d * d); // stays put once it lands
        fx1(out, "dump", 128, 128, fxDump, x + 0.12 + 0.2 * d, yy, z, 0.2, 0.2, d * 6);
        if (yy > 0.07) fx1(out, "dline", 64, 128, (p) => { p.stroke([[20, 10], [20, 110]], 6, INK); p.stroke([[44, 30], [44, 118]], 6, INK); }, x + 0.12 + 0.2 * d, yy + 0.2, z, 0.06, 0.14);
      }
    }
  }
};

/** the pad: launch smoke and glow, the catch impacts */
const pad = (cam: CamInfo, out: Stage, id: number, t: number) => {
  friends(cam, out, id, t);
  if (id === 3) { // venting puffs off the stack
    for (let i = 0; i < 4; i++) { const u = ((t * 0.5 + i / 4) % 1); puff(out, "vent", i, AXIS[0] + (i % 2 ? 6 : -6) + (i % 2 ? 4 : -4) * u, MOUNT_Y + 50 + i * 6 + 3 * u, AXIS[2] + 5, 3 + 4 * u, u); }
  }
  if (id === 4) {
    const d = t - W.blasted;
    if (d > -0.05) {
      for (let i = 0; i < 12; i++) { // billowing smoke spreading out sideways from the mount
        const u = clamp01((d + 0.05) / (1.4 + 0.12 * i)), side = i % 2 ? 1 : -1, sp = (4 + i * 3.2) * u;
        puff(out, "smoke", i, AXIS[0] + side * sp, 4 + 6 * u + 2 * (i % 3), AXIS[2] + 8 + (i % 4) * 2, 12 + 16 * u, u);
      }
      const y = MOUNT_Y + liftY(t);
      fx1(out, "fglow", 256, 256, (p) => fxGlow(p, "rgba(255,190,90,0.9)"), AXIS[0], y - 12, AXIS[2] + 6, 22, 30, 0, true);
    }
  }
  if (id === 1 || id === 9) { // landing-flame glow under the ship, clamp impact at the pins
    const sp = shipPose(id, t).p, tc = id === 1 ? W.caught : W.shut;
    if (t < tc + 0.15) fx1(out, "sglow", 256, 256, (p) => fxGlow(p, "rgba(255,190,90,0.85)"), sp[0], sp[1] - 7, sp[2] + 5, 9, 14, 0, true);
    // a soft "clink" sparkle off to the outside of each arm tip (no impact star: it read as a hit)
    if (t >= tc - 1 / FPS && t < tc + 0.5) for (const sz of [-1, 1]) for (let i = 0; i < 2; i++)
      fx1(out, `clk${sz}${i}|${Math.floor(t * 10) % 5}`, 128, 128, (p) => fxSparkle(p, Math.floor(t * 10) + i), AXIS[0] - 12 - 3 * i, ARM_Y + 2.5 + 2 * i, AXIS[2] + sz * (ARM_Z + 4 + 2 * i), 2.6, 2.6);
    // a few smoke wisps blown off the mount by the landing engines
    if (t < tc + 1.2) for (let i = 0; i < 4; i++) { const u = clamp01((t - tc + 1.0) / 2.0 + i * 0.1); puff(out, "lsm", i, AXIS[0] + (i - 1.5) * 9 * u, MOUNT_Y + 2 + 3 * u, AXIS[2] + 6, 8 + 10 * u, u); }
  }
  if (id === 10 || id === 12) void shipCatchY;
};

/** the Gulf sky: belly-flop plasma, flip, engines; the booster's last moments */
const sea = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 7 || (id === 8 && t < W.flipped + 0.5)) { // re-entry glow along the belly (local -x, which points down)
    const sp = shipPose(id, t);
    for (let i = 0; i < 8; i++) {
      const along = 3 + i * 5, k = id === 8 ? 1 - clamp01((t - W.flipped) / 0.5) : 1;
      // belly-down ship: local y runs along -x when r.z = pi/2; bottom side is -y
      const ang = sp.r[2], x = sp.p[0] - Math.sin(ang) * along, y = sp.p[1] + Math.cos(ang) * along - 4.6 * Math.sin(ang);
      fx1(out, `plasma${i % 3}|${Math.floor(t * 12) % 4}`, 256, 256, (p) => fxGlow(p, "rgba(255,160,80,0.8)"), x, y - 0.6, sp.p[2] + 2, 13 * k + 0.01, 7 * k + 0.01, 0, true);
    }
  }
  if (id === 8) { // a pop of light as each engine lights
    const sp = shipPose(8, t).p;
    [W.lit, W.three, W.engines].forEach((w, i) => {
      const d = t - (w - 2 / FPS);
      if (d >= 0 && d < 0.25) fx1(out, `epop${i}|${Math.floor(d * 30)}`, 256, 256, (p) => fxGlow(p, "rgba(255,240,190,0.95)"), sp[0] + [0, -1.6, 1.6][i], sp[1] - 3, sp[2] + 2, 7 * (1 - d * 2), 7 * (1 - d * 2), 0, true);
    });
  }
  if (id === 11) {
    const bp = boostPose(11, Math.min(t, W.blew - 0.1)).p;
    // fuel gauge pops up beside the booster on "low on fuel": needle sinks into the red
    if (at(t, W.low - 0.2) && t < W.blew - 0.05) {
      const d = t - (W.low - 0.2), pop = d < 0.2 ? 0.6 + 2 * d : 1;
      const u = Math.max(0.03, 0.55 - 0.6 * clamp01(d / 0.8)) + 0.03 * Math.sin(t * 30) * clamp01(d / 0.8);
      fx1(out, `gauge${Math.round(u * 100)}`, 256, 256, (p) => fxGauge(p, u), bp[0] + 11, bp[1] + 40, bp[2] + 6, 12 * pop, 12 * pop);
    }
    // the boom over the water + smoke, then a splash
    const d = t - (W.blew - 2 / FPS);
    if (d >= 0) {
      const by = bp[1] + 6;
      if (d < 0.7) fx1(out, `boom${Math.floor(d * 30)}`, 512, 512, (p) => fxBoom(p, d / 0.7), bp[0], by + 14, bp[2] + 6, 30 * (0.7 + 0.5 * d), 30 * (0.7 + 0.5 * d));
      if (d > 0.05 && d < 1.2) for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3, u = (d - 0.05) / 1.15; fx1(out, `bst${i}|${Math.floor(t * 10) % 5}`, 128, 128, (p) => fxSparkle(p, Math.floor(t * 10) + i), bp[0] + Math.cos(a) * 26 * u, by + 14 + Math.sin(a) * 20 * u, bp[2] + 8, 4, 4); }
      for (let i = 0; i < 7; i++) {
        const u = clamp01((d - 0.1) / 1.4), a = i * 0.9;
        if (d > 0.3) puff(out, "bsm", i, bp[0] + Math.cos(a) * 16 * u, by + 14 + Math.sin(a) * 10 * u + 5 * u, bp[2] + 4, 14 + 16 * u, u);
      }
      if (d > 0.2) fx1(out, `spl${Math.floor((d - 0.2) * 20)}`, 256, 384, (p) => fxSplashCol(p, (d - 0.2) / 0.8), bp[0] + 2, 9, bp[2] + 8, 24, 20, 0, true);
    }
    void SEA;
  }
};

const space = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 5) { // a puff of separation gas between the stages
    const d = t - (W.top + 0.15);
    if (d > 0 && d < 1.2) for (let i = 0; i < 5; i++) {
      const sp = shipPose(5, t).p, a = i * 1.26;
      fx1(out, `sep${i % 3}|${Math.floor(d * 14)}`, 300, 300, (p) => fxPuffBig(p, i, `rgba(240,244,255,${(0.9 * (1 - d / 1.2)).toFixed(2)})`, `rgba(220,226,240,${(0.9 * (1 - d / 1.2)).toFixed(2)})`), sp[0] - 3 - 4 * d, sp[1] + Math.sin(a) * 8 * d, sp[2] + Math.cos(a) * 8 * d + 3, 6 + 10 * d, 6 + 10 * d, 0, true);
    }
  }
  void SHIP_R;
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "space") space(cam, out, id, t);
  else if (s.place === "pad") pad(cam, out, id, t);
  else sea(cam, out, id, t);
  void smooth; void C1;
  return out;
};
export { FPS };
