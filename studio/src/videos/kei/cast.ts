// The kei-truck short: our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, keiPt, keiPose, bigPose, trafficAt, PARK_X, LANE_N, LANE_F, SEAT_D, BALES, SHOW, sheetK, BIG_S } from "./story";
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

// ================= the kei-truck short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const DRIVER: Outfit = { jacket: "#4f9a6e", pants: "#3b5b9a", boots: "#5a3b2a", hat: "cap", cap: "#e8483c", skin: "#f5c9a0" };
const BIGGUY: Outfit = { jacket: "#3a64b8", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#5a3b2a", skin: "#c99067", build: "stout" };
const EXEC: Outfit = { jacket: "#2b3550", pants: "#2b3550", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#ecd0b6", buttons: "#e8c45a" };
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.06): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU, v = (975 - cy) * SU;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
void onCard; void keiPose; void BIG_S;

// ---------------- effect cards (no text anywhere) ----------------
/** a round speedometer: arc of ticks, red stop pin, needle at angle u (0 .. 1 of the sweep); no numbers */
const fxDial = (p: Pen, u: number) => {
  p.ell(128, 140, 112, 112, "#fbfaf4", 9); p.ell(128, 140, 96, 96, "#2b2f3a", 0);
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.8 + 1.4 * i / 10); p.stroke([[128 + 74 * Math.cos(a), 140 + 74 * Math.sin(a)], [128 + 88 * Math.cos(a), 140 + 88 * Math.sin(a)]], i % 5 ? 4 : 8, "#fbfaf4"); }
  const pts: P2[] = []; for (let i = 0; i <= 16; i++) { const aa = Math.PI * (0.8 + 1.4 * (0.385 + 0.615 * i / 16)); pts.push([128 + 82 * Math.cos(aa), 140 + 82 * Math.sin(aa)]); }
  p.stroke(pts, 10, "rgba(232,72,60,0.55)");
  const ar = Math.PI * (0.8 + 1.4 * 0.38); p.ell(128 + 78 * Math.cos(ar), 140 + 78 * Math.sin(ar), 15, 15, "#ff3a2a", 5);
  const a = Math.PI * (0.8 + 1.4 * u);
  p.stroke([[128, 140], [128 + 76 * Math.cos(a), 140 + 76 * Math.sin(a)]], 9, "#ff5a3c"); p.dot(128, 140, 13, "#fbfaf4");
};
/** a tape measure strip (512 x 48): yellow with black ticks, no numbers */
const fxTape = (p: Pen) => {
  p.poly([[4, 8], [508, 8], [508, 40], [4, 40]], "#f2c43a", 4);
  for (let i = 0; i < 34; i++) p.stroke([[16 + i * 14.6, 10], [16 + i * 14.6, i % 4 ? 20 : 30]], 3, "#2b2f3a");
};
/** a round turtle sticker (256 x 256) */
const fxTurtle = (p: Pen) => {
  p.ell(128, 128, 118, 118, "#fbfaf4", 8); p.ell(128, 128, 104, 104, "#f2a03a", 0);
  p.ell(72, 150, 26, 20, "#7ac25a", 6); // head
  p.dot(64, 145, 5, INK);
  for (const [x, y] of [[96, 182], [164, 182], [100, 104], [160, 104]] as const) p.ell(x, y, 16, 12, "#7ac25a", 6);
  p.ell(132, 142, 58, 44, "#3f7a3a", 7);
  p.stroke([[110, 120], [132, 142], [154, 120]], 5, "#2f6a34"); p.stroke([[132, 142], [132, 178]], 5, "#2f6a34");
  p.stroke([[188, 150], [206, 158]], 9, "#7ac25a");
};
/** white speed streak (256 x 32) */
const fxStreak = (p: Pen) => p.stroke([[10, 16], [246, 16]], 10, "rgba(255,255,255,0.8)");
/** brown mud splat (128 x 128) */
const fxMud = (p: Pen, k: number) => { p.ell(64, 64, 34 + 6 * (k % 3), 26, "#6a4630", 5); p.dot(28 + 8 * (k % 2), 30, 10, "#6a4630"); p.dot(100, 96 - 6 * (k % 3), 8, "#6a4630"); };
/** cool air swirl (256 x 128) */
const fxCool = (p: Pen, k: number) => {
  const pts: P2[] = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([16 + 220 * u, 64 + 30 * Math.sin(u * 6.3 + k)]); }
  p.stroke(pts, 10, "rgba(170,225,255,0.95)");
  for (let i = 0; i < 3; i++) { const x = 40 + i * 80, y = 30 + 70 * ((i + k) % 2); p.stroke([[x - 9, y], [x + 9, y]], 4, "#e8f6ff"); p.stroke([[x, y - 9], [x, y + 9]], 4, "#e8f6ff"); }
};
/** a cobweb corner (256 x 256) */
const fxWeb = (p: Pen) => {
  for (let i = 0; i < 6; i++) { const a = (i / 5) * Math.PI / 2; p.stroke([[0, 0], [250 * Math.cos(a), 250 * Math.sin(a)]], 3, "rgba(240,240,240,0.9)"); }
  for (let r = 50; r < 250; r += 50) { const pts: P2[] = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; const rr = r - 10 * Math.sin(i * Math.PI / 2); pts.push([rr * Math.cos(a), rr * Math.sin(a)]); } p.stroke(pts, 3, "rgba(240,240,240,0.9)"); }
};
/** a grey-brown dust cloud (300 x 300), u 0..1 */
const fxDust = (p: Pen, u: number, k: number) => { const a = (0.85 * (1 - u) ** 0.8).toFixed(2); for (let i = 0; i < 5; i++) { const an = i * 1.25 + k, r = 52 + 12 * (i % 2); p.ell(150 + 52 * Math.cos(an), 150 + 40 * Math.sin(an), r, r * 0.85, `rgba(${150 + 10 * (i % 2)},${138 + 8 * (i % 2)},${122},${a})`, 0); } };
/** a confetti piece (64 x 32) */
const CONF = ["#e8483c", "#f2c43a", "#3a64b8", "#4f9a6e", "#c95b8a", "#fbfaf4"];
const fxConf = (p: Pen, k: number) => p.poly([[4, 4], [60, 4], [60, 28], [4, 28]], CONF[k % CONF.length], 3);
/** a straw wisp (128 x 64) */
const fxStraw = (p: Pen, k: number) => { for (let i = 0; i < 5; i++) p.stroke([[10 + i * 20, 50 - (i * 7 + k * 5) % 30], [40 + i * 18, 14 + (i * 11) % 20]], 4, "#e2b552"); };

type P2 = [number, number];
const dazeKey = (t: number) => Math.floor(t * 12);

// ---------------- helpers ----------------
/** the driver sitting at the wheel of the kei (right seat) */
const driverIn = (cam: CamInfo, out: Stage, id: number, t: number, fo: FrontOpts, sc = 0.95) => {
  const [x, y, z] = keiPt(id, t, SEAT_D[0], SEAT_D[1], SEAT_D[2]);
  out.places.push(person(cam, who(1, DRIVER), x, y, z, { side: false, mirror: false }, { mode: "sit", blink: lidAt(t, 1), ...fo }, {}, sc));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, t: number, fo: FrontOpts, y = 0) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {}));
  blob(out, x, y, z, 1, 0.9);
};
/** streaks behind a moving vehicle (pose from story), n lines */
const streaks = (out: Stage, x: number, z: number, yaw: number, t: number, n: number, len: number, back: number, h0 = 0.4, dh = 0.35) => {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const d = back + 0.6 * i + ((t * 6 + i * 0.7) % 1.2);
    fx1(out, "streak", 256, 32, fxStreak, x - fx * d, h0 + dh * i, z - fz * d + 0.3 * (i % 2), len, 0.05);
  }
};
const puffAt = (out: Stage, key: string, t: number, t0: number, dur: number, x: number, y: number, z: number, s: number) => {
  const d = t - t0;
  if (d > 0 && d < dur) fx1(out, `${key}${Math.floor((d / dur) * 12)}`, 300, 300, (p) => fxPuff(p, d / dur), x, y + 0.3 * d, z, s * (0.8 + 0.6 * d / dur), s * (0.8 + 0.6 * d / dur), 0, true);
};
const burstAt = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d > 0 && d < 0.4) fx1(out, `${key}${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.8), col, 10, 30, 180), x, y, z, s, s);
};

// ---------------- shots ----------------
const shots = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    // the big pickup roars past; the driver jolts, then beams with pride
    driverIn(cam, out, 1, t, { expr: t < 1.2 ? "shock" : at(t, W.tops) ? "nervous" : "grin", look: t < 1.2 ? -0.6 : 0.3, headTilt: t < 1.2 ? -6 : 3 });
    const bp = bigPose(1, t);
    if (bp.vis) streaks(out, bp.x - 3.5, bp.z + 0.6, 0, t, 6, 2.0, 0.2, 0.45, 0.3);
    const kp = keiPose(1, t);
    streaks(out, kp.x - 1.9, kp.z + 0.2, 0, t, 2, 0.6, 0.2, 0.55, 0.4);
    for (let i = 0; i < 3; i++) { const u = (t * 1.5 + i / 3) % 1; fx1(out, `ex${Math.floor(u * 12)}`, 300, 300, (p) => fxPuff(p, u), kp.x - 1.9 - u * 1.2, 0.35 + u * 0.3, kp.z + 0.4, 0.25 + 0.3 * u, 0.25 + 0.3 * u, 0, true); }
  }
  if (id === 2) {
    driverIn(cam, out, 2, t, { expr: at(t, W.tf) ? "nervous" : "grin", look: at(t, W.tf) ? 0.1 : 0.2, headTilt: at(t, W.tf) ? -5 : 2, reach: [[230, 640], [370, 640]] });
    // the dial pops on "twenty-five": the needle sweeps up and slams into the red stop pin, wobbling
    if (at(t, W.tf - 0.25)) {
      const d = t - (W.tf - 0.25), pop = d < 0.2 ? 0.6 + 2 * d : 1 + 0.06 * Math.exp(-(d - 0.2) * 6) * Math.sin((d - 0.2) * 30);
      const sweep = Math.min(1, d / 0.3), u = 0.35 * sweep - (sweep >= 1 ? 0.05 * Math.abs(Math.sin((d - 0.3) * 18)) * Math.exp(-(d - 0.3) * 2.5) : 0);
      const [x, y, z] = keiPt(2, t, 2.35, 0.9, 1.15);
      fx1(out, `dial${Math.round(u * 200)}`, 256, 256, (p) => fxDial(p, u), x, y, z, 0.52 * pop, 0.52 * pop);
    }
    const kp = keiPose(2, t);
    for (let i = 0; i < 2; i++) { const u = (t * 1.5 + i / 2) % 1; fx1(out, `ex${Math.floor(u * 12)}`, 300, 300, (p) => fxPuff(p, u), kp.x - 1.9 - u * 1.2, 0.35 + u * 0.3, kp.z - 0.4, 0.25 + 0.3 * u, 0.25 + 0.3 * u, 0, true); }
  }
  if (id === 3) {
    // the driver at the nose with the tape; the tape runs back to the tailgate; the big pickup's owner smirks at its nose
    const ext = smooth((t - (W.eleven - 0.3)) / 0.8);
    standing(cam, out, 1, DRIVER, PARK_X + 2.25, LANE_N + 1.05, t, { expr: at(t, W.half) ? "nervous" : at(t, W.tiny) ? "grin" : "smile", look: at(t, W.half) ? -0.6 : 0.4, reach: [null, [430, 640]] });
    if (ext > 0) { const L = 3.45 * ext, x1 = PARK_X + 1.85; fx1(out, "tape", 512, 48, fxTape, x1 - L / 2, 0.42, LANE_N + 1.0, L, 0.1); }
    standing(cam, out, 2, BIGGUY, PARK_X + 4.3, LANE_F + 2.15, t, { expr: at(t, W.full) ? "grin" : "smile", look: -0.7, reach: [[170, 600], null] });
  }
  if (id === 4) {
    // the friend opens the left door: no wheel there; the driver waves from the right seat
    const shock = at(t, W.wheel);
    standing(cam, out, 2, BIGGUY, PARK_X + 1.05, LANE_N - 1.15, t, { expr: shock ? "shock" : "smile", look: 0.8, headTilt: shock ? -6 : 0, reach: [null, [470, 600]] });
    const wave = at(t, W.right) ? Math.sin((t - W.right) * 14) : 0;
    driverIn(cam, out, 4, t, { expr: at(t, W.right) ? "grin" : "smile", look: -0.4, reach: at(t, W.right) ? [[250, 600], [500, 430 + 30 * wave]] : [[240, 600], [360, 600]] });
  }
  if (id === 5) {
    // why so slow? a big shrug; "twenty-five" - a sheepish grin
    const shrug = at(t, W.slow) ? smooth((t - (W.slow - 0.1)) / 0.25) : 0, g25 = at(t, W.tf2);
    driverIn(cam, out, 5, t, { expr: g25 ? "grin" : "nervous", look: g25 ? 0 : -0.3, headTilt: g25 ? 4 : -6 * shrug,
      reach: g25 ? [[250, 640], [350, 640]] : [[230 - 90 * shrug, 640 - 120 * shrug], [370 + 90 * shrug, 640 - 120 * shrug]] }, 1.0);
  }
  if (id === 6) {
    // a turtle sticker slaps onto the tailgate
    const t0 = W.low - 0.08, d = t - t0;
    if (d > 0) {
      const k = d < 0.12 ? 1.6 - 5 * d : 1 + 0.08 * Math.exp(-(d - 0.12) * 7) * Math.sin((d - 0.12) * 28);
      burstAt(out, "tb", t, t0 + 0.08, PARK_X - 1.765, 0.74, LANE_N, 1.0);
      fx1(out, "turtle", 256, 256, fxTurtle, PARK_X - 1.83, 0.74, LANE_N, 0.44 * k, 0.44 * k);
    }
  }
  if (id === 7) {
    // waiting at the busy road; cars and the big pickup flash past; the driver slumps
    driverIn(cam, out, 7, t, { expr: at(t, W.stuck) ? "dazed" : "nervous", look: at(t, W.stuck) ? 0.2 : -0.7, headTilt: at(t, W.stuck) ? -8 : 0, reach: [[260, 640], [350, 640]] });
    const bp = bigPose(7, t);
    if (bp.vis) streaks(out, bp.x + 3.8, bp.z, Math.PI, t, 4, 1.4, 0.3, 0.5, 0.35);
    for (const c of trafficAt(7, t)) streaks(out, c.x - Math.cos(c.yaw) * 2.4, c.z, c.yaw, t, 3, 1.2, 0.3, 0.4, 0.3);
  }
  if (id === 8) {
    // bales thump into the bed one by one: straw puffs; the driver beams
    standing(cam, out, 1, DRIVER, PARK_X + 0.2, LANE_N + 1.45, t, { expr: at(t, W.pounds) ? "laugh" : "grin", look: -0.5, reach: at(t, W.pounds) ? [null, [480, 420]] : undefined });
    BALES.forEach((b, i) => {
      const d = t - b;
      if (d > 0 && d < 0.5) for (let k = 0; k < 3; k++) fx1(out, `straw${k}`, 128, 64, (p) => fxStraw(p, k), PARK_X - 0.8 + 0.5 * k - 0.3 * i, 1.1 + d * 1.5 + 0.1 * k, LANE_N + 0.2, 0.4, 0.2, (k - 1) * 0.8 + d * 3);
      puffAt(out, `bp${i}`, t, b, 0.45, PARK_X - 0.7, 1.0, LANE_N + 0.4, 0.9);
    });
  }
  if (id === 9) {
    // four-wheel drive over the mound: mud flies off the wheels
    driverIn(cam, out, 9, t, { expr: "laugh", look: 0.2, headTilt: 5 * Math.sin(t * 9), reach: [[250, 620], [350, 620]] });
    const kp = keiPose(9, t);
    for (let i = 0; i < 7; i++) {
      const u = (t * 2.2 + i / 7) % 1, wx = i % 2 ? -1.05 : 1.12;
      fx1(out, `mud${i % 3}`, 128, 128, (p) => fxMud(p, i), kp.x + wx - 1.6 * u, kp.y + 0.3 + 1.4 * u - 1.8 * u * u, kp.z + 0.75 + 0.25 * (i % 3) - 0.2, 0.22, 0.2, u * 5);
    }
    burstAt(out, "mb", t, W.four, kp.x + 1.6, 0.8, kp.z + 0.8, 1.0, "#ffe2a0");
  }
  if (id === 10) {
    // cool air from the dash: bliss
    driverIn(cam, out, 10, t, { expr: at(t, W.cond) ? "relief" : "smile", look: 0, headTilt: 6 * smooth((t - W.air) / 0.4) }, 1.0);
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.9 + i / 3) % 1;
      const [x, y, z] = keiPt(10, t, 1.52 - 0.25 * u, 0.98 + 0.04 * i, 0.33 + 0.5 + 0.05 * i);
      fx1(out, `cool${i}`, 256, 128, (p) => fxCool(p, i), x, y, z, 0.26, 0.13, 0.1 - 0.08 * i, true);
    }
  }
  if (id === 11) {
    // the presenter yanks the dusty sheet; a dust cloud; spotlights and confetti on "Scion"
    const sk = sheetK(t), scion = at(t, W.scion);
    const reach: [P2 | null, P2 | null] = scion ? [[150, 300 + 30 * Math.sin(t * 12)], [450, 300 + 30 * Math.sin(t * 12 + 1)]] : sk > 0 ? [null, [520 - 60 * sk, 380 - 120 * sk]] : [null, [140, 620]];
    standing(cam, out, 3, EXEC, SHOW + 1.8, 2.25, t, { expr: scion ? "laugh" : sk > 0 ? "grin" : "smile", look: scion ? 0 : -0.6, reach });
    if (sk <= 0) {
      fx1(out, "web", 256, 256, fxWeb, SHOW + 1.7, 1.9, 0.6, 0.7, 0.7, 0);
      fx1(out, "web", 256, 256, fxWeb, SHOW - 1.5, 1.2, 0.9, 0.55, 0.55, Math.PI / 2);
    }
    // dust: a few big soft puffs over the truck for ~1.6 s
    for (let i = 0; i < 6; i++) { const t0 = W.revived + 0.05 * i; const d = t - t0; if (d > 0 && d < 1.7) { const u = d / 1.7; fx1(out, `dust${Math.floor(u * 14)}`, 300, 300, (p) => fxDust(p, u, i), SHOW - 1.6 + 0.65 * i, 0.8 + 0.4 * (i % 2) + 0.5 * u, 0.6, 1.4 + 0.9 * u, 1.4 + 0.9 * u, i, true); } }
    if (scion) {
      burstAt(out, "sb", t, W.scion, SHOW - 0.6, 2.6, -0.6, 1.6);
      for (let i = 0; i < 40; i++) {
        const d = t - W.scion - 0.02 * (i % 7), x0 = SHOW - 3.2 + ((i * 37) % 64) / 10, z0 = -0.5 + ((i * 53) % 30) / 10;
        if (d <= 0) continue;
        const y = 4.6 - 0.9 * d - ((i * 17) % 10) / 10 * 0.6;
        if (y < 0.05) continue;
        fx1(out, `cf${i % 6}`, 64, 32, (p) => fxConf(p, i), x0 + 0.15 * Math.sin(d * 3 + i), y, z0, 0.1, 0.05, d * 4 + i);
      }
    }
  }
  if (id === 12) {
    // sunset: the driver waves to us; the red pickup flies past
    const wave = at(t, W.would) ? Math.sin((t - W.would) * 12) : 0;
    driverIn(cam, out, 12, t, { expr: at(t, W.fast) ? "laugh" : "grin", look: 0, headTilt: 3, reach: at(t, W.would) && !at(t, W.friend) ? [[250, 600], [510, 430 + 30 * wave]] : [[250, 620], [350, 620]] });
    const bp = bigPose(12, t);
    if (bp.vis) streaks(out, bp.x - 3.6, bp.z, 0, t, 5, 1.6, 0.5, 0.5, 0.3);
    const kp = keiPose(12, t);
    for (let i = 0; i < 2; i++) { const u = (t * 1.5 + i / 2) % 1; fx1(out, `ex${Math.floor(u * 12)}`, 300, 300, (p) => fxPuff(p, u), kp.x + 1.9 + u * 1.2, 0.35 + u * 0.3, kp.z + 0.4, 0.25 + 0.3 * u, 0.25 + 0.3 * u, 0, true); }
  }
};
void dazeKey; void clamp01;

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  shots(cam, out, id, t);
  return out;
};
export { FPS };
