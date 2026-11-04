// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import {
  FPS, V3, SHOTS, W, HITS, TABLE_H, T1, T2, ROBOT_S, KITCHEN, COUNTER_H, TOY_Z, smooth, clamp01, robotPose, robotFace, robotPos, toyX, toyPhase, toyStopped, LAST_DROP,
} from "./story";
import { drawRobot, drawToy, fxConfetti, fxSteam, fxPlanArc, fxSplat, fxMusic, fxShake, fxPow } from "./robot";
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
let LNAME: "day" | "golden" | "indoor" = "day";
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
const CONTACT: Record<"day" | "golden" | "indoor", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], indoor: [0.3, 0.26, 0.34] };
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

// ================= the hot pot short's cast =================
const GUEST: Outfit = { jacket: "#4f9a6e", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20" };
const FRIEND: Outfit = { jacket: "#e0a23a", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#6a3b22", skin: "#f5c9a0" };
const DINER_A: Outfit = { jacket: "#5b78c9", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#2a2020", skin: "#ecd0b6" };
const DINER_B: Outfit = { jacket: "#c95b8a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#4a2a1a", skin: "#c99067" };
const BG1: Outfit = { jacket: "#8a6fc0", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#5a3b2a" };
const BG2: Outfit = { jacket: "#d8c25a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#2a2020", skin: "#f5c9a0" };
const WAITER = (hair: string, skin?: string, dress = false): Outfit =>
  ({ jacket: "#62656e", pants: "#2a2b31", boots: "#1d1d22", hat: "hair", hair, buttons: "#f4efe4", belt: null, sash: "#c8362f", ...(skin ? { skin } : {}), ...(dress ? { dress: "#62656e" } : {}) });
const WA = WAITER("#2a1d1a"), WB = WAITER("#1d1414", "#f5c9a0", true), WC = WAITER("#6a3b22", "#c99067");
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const LEADS = 2 / FPS;
const after = (t: number, w: number) => t >= w - LEADS;

/** a seated diner behind a table (bench seat 0.48 m), facing the lens */
const seated = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts) => {
  const view = { side: false, mirror: false };
  out.places.push(person(cam, who(i, o), x, 0.33, z, view, { mode: "sit", ...fo, blink: lidAt(fo.phase ?? 0, i) }, {}));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number) => {
  out.places.push(person(cam, who(i, o), x, 0, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  blob(out, x, 0, z, 1, 0.9);
};

const robotPlace = (cam: CamInfo, out: Stage, tau: number) => {
  const [x, , z] = robotPos(tau), P = robotPose(tau), face = robotFace(tau);
  const d = cam.pos.distanceTo(tmp.set(x, 0.9, z)) / ROBOT_S, [w, h, k] = tier(d);
  const light = light2D(cam, false), blink = face === "dots" ? lidAt(tau, 77) : 0;
  const pose = { ...P, face, sauce: tau >= HITS[2] + 0.05, blink, light };
  out.places.push({ key: "robot|" + fkey(pose), x, y: 0, z, scale: ROBOT_S, size: [w, h, k], draw: (p) => drawRobot(p, pose) });
  blob(out, x, 0, z, 1.0, 1);
  return { x, z, P };
};

/** waiters: run in on "Three waiters", hold on (sway with the robot); the one with the phone steps back on "One of them" */
const waiters = (cam: CamInfo, out: Stage, tau: number, rx: number, rz: number, sway: number) => {
  if (tau < W.three - 0.35) return;
  const run = smooth((tau - (W.three - 0.35)) / 0.45), tilt = 0.6 * sway;
  const frozen = tau >= W.does;
  const exA: Expr = frozen ? "relief" : tau < W.kept ? "shock" : "pained";
  const exC: Expr = frozen ? "relief_open" : tau < W.kept ? "nervous" : "pained";
  // A: left of the robot, both hands on its left arm
  standing(cam, out, 31, WA, rx - 0.56 - 1.2 * (1 - run), rz - 0.06, { expr: exA, tilt, reach: run > 0.9 ? [[455, 690], [460, 630]] : undefined, headTilt: -tilt }, tau);
  // C: right of the robot
  const cOn = tau < W.phone || (tau >= W.restaurant - 0.1 && tau < W.andThats);
  if (cOn) standing(cam, out, 33, WC, rx + 0.6 + 1.2 * (1 - run), rz - 0.04, { expr: exC, tilt, reach: run > 0.9 ? [[140, 630], [145, 690]] : undefined, headTilt: -tilt }, tau);
  // B: behind it, hands on its shoulders, until she steps away to her phone
  if (tau < 29.38) standing(cam, out, 32, WB, rx + 0.34, rz - 0.3 - 1.0 * (1 - run), { expr: "shock", tilt: tilt * 0.5, reach: run > 0.9 ? [[215, 640], null] : undefined }, tau);
  else if (tau < W.luckily) {
    const k = smooth((tau - 29.38) / 0.02);
    const ex: Expr = frozen ? "relief" : "nervous";
    standing(cam, out, 32, WB, rx - 0.06 + (1.25 - rx + 0.06) * k, rz - 0.36 + (1.55 - rz + 0.36) * k, { expr: ex, prop: "phone", look: 0.6 }, tau);
  }
};

/** diners: smiling, the guest beckons, everyone gasps at the slam, dazed after */
const diners = (cam: CamInfo, out: Stage, tau: number) => {
  const slam = HITS[0] - LEADS;
  const react = (calm: Expr): Expr => (tau < slam ? calm : tau < W.three ? "shock" : tau < W.does ? "nervous" : "relief");
  const beck = tau >= W.guest - 0.1 && tau < W.soItDid + 0.4;
  seated(cam, out, 1, GUEST, T1[0] - 0.28, -0.76, { expr: tau < W.guest ? "smile" : beck ? "grin" : react("grin"), wave: beck ? Math.sin((tau - W.guest) * 9) * 0.5 + 0.5 : undefined, phase: tau });
  seated(cam, out, 2, FRIEND, T1[0] + 0.3, -0.76, { expr: react("smile_closed"), phase: tau });
  seated(cam, out, 3, DINER_A, T2[0] - 0.3, -0.76, { expr: react("smile"), phase: tau });
  seated(cam, out, 4, DINER_B, T2[0] + 0.28, -0.76, { expr: react("lick"), phase: tau });
  seated(cam, out, 5, BG1, -3.1 - 0.25, -0.76, { expr: tau < slam ? "smile" : "shock", phase: tau });
  seated(cam, out, 6, BG2, 3.2 + 0.25, -0.76, { expr: tau < slam ? "grin" : "shock", phase: tau });
};

const restFx = (cam: CamInfo, out: Stage, tau: number, rx: number, rz: number, t: number) => {
  // steam over the pots
  for (const [x, z, s] of [[T1[0], T1[2], 0], [T2[0], T2[2], 1], [-3.1, 0, 2], [3.2, 0, 3]] as const)
    for (let k = 0; k < 2; k++) {
      const u = (t * 0.35 + k * 0.5 + s * 0.17) % 1;
      out.fx.push({ key: "steam", cw: 256, ch: 256, draw: fxSteam, x: x + 0.05 * Math.sin(t + k + s), y: TABLE_H + 0.1 + 0.45 * u, z: z - 0.05, w: 0.2 + 0.22 * u, h: 0.2 + 0.22 * u, soft: true });
    }
  // celebration confetti
  const ct = tau - W.celebration;
  if (ct > -0.05 && ct < 1.6) for (let i = 0; i < 4; i++) {
    const u = Math.max(0, ct), y = 1.1 + 2.2 * u - 1.4 * u * u;
    out.fx.push({ key: `confetti${i}`, cw: 512, ch: 512, draw: (p) => fxConfetti(p, i), x: rx + (i - 1.5) * 0.28 * (0.4 + u), y: y + (i % 2) * 0.15, z: rz + 0.05, w: 0.55, h: 0.55, rot: u * (i % 2 ? 1.5 : -1.5) });
  }
  // music notes while it dances
  if (tau >= W.music && tau < W.does) for (let k = 0; k < 2; k++) {
    const u = ((tau - W.music) * 0.55 + k * 0.5) % 1;
    out.fx.push({ key: `note${k}`, cw: 256, ch: 256, draw: (p) => fxMusic(p, k), x: rx + (k ? 0.45 : -0.42) + 0.08 * Math.sin(u * 6), y: 1.35 + 0.6 * u, z: rz - 0.05, w: 0.2 * (1 - 0.3 * u), h: 0.2 * (1 - 0.3 * u), rot: 0.3 * Math.sin(u * 5) });
  }
  // impact bursts on the table next door
  for (const h of [...HITS, LAST_DROP + 0.33]) {
    const d = tau - h;
    if (d >= 0 && d < 0.25) {
      const at = h === LAST_DROP + 0.33 ? [T2[0] + 0.42, 0.06, 0.55] : [rx + 0.5, TABLE_H + 0.06, 0.32];
      out.fx.push({ key: `burst${Math.floor(d * 30)}`, cw: 512, ch: 512, draw: (p) => fxPow(p, d / 0.25), x: at[0], y: at[1], z: at[2], w: 0.62, h: 0.62 });
    }
  }
  // sauce splats left on the table and the floor
  if (tau > HITS[2] + 0.05) for (const [x, y, z, s] of [[T2[0] - 0.25, TABLE_H + 0.004, 0.15, 1], [T2[0] + 0.1, TABLE_H + 0.004, -0.1, 2]] as const)
    out.fx.push({ key: `splat${s}`, cw: 256, ch: 256, draw: (p) => fxSplat(p, s), x, y, z, w: 0.2, h: 0.14, flat: true, rot: s });
  // the plan: a dotted arc ahead of the right hand, drawn dot by dot, sweeping down onto the table
  if (tau >= W.plan - LEADS && tau < W.like) {
    const n = Math.min(14, 2 + Math.floor((tau - W.plan) * 9));
    out.fx.push({ key: `plan${n}`, cw: 512, ch: 512, draw: (p) => fxPlanArc(p, -75, 75, n), x: rx + 0.2, y: 0.82, z: rz + 0.02, w: 1.15, h: 1.15 });
  }
  if (tau >= W.kept && tau < W.kept + 0.9) out.fx.push({ key: "shake", cw: 256, ch: 256, draw: fxShake, x: rx, y: 1.5, z: rz, w: 0.5, h: 0.5 });
};

const kitchen = (cam: CamInfo, out: Stage, t: number) => {
  const x = toyX(t), ph = toyPhase(t), stop = toyStopped(t);
  const key = t * (stop ? 0 : 5) + (stop ? W.stops * 5 : 0);
  const mirror = cam.right.x < 0;
  const draw = (p: Pen) => { p.g.translate(0, 415); drawToy(p, ph % 1, key, stop, light2D(cam, mirror)); };
  const d = cam.pos.distanceTo(tmp.set(x, COUNTER_H + 0.07, TOY_Z)) / 0.17, [w, h, k] = tier(d);
  out.places.push({ key: `toy|${q(ph % 1, 60)}|${q(key % 6.283, 30)}|${stop}`, x, y: COUNTER_H + 0.004, z: TOY_Z, scale: 0.17, mirror, size: [w, h, k], draw });
  blob(out, x, COUNTER_H, TOY_Z, 0.24, 1.25);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], tau = s.tau(t);
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "kitchen") { kitchen(cam, out, t); return out; }
  if (s.place === "street") return out;
  const { x, z, P } = robotPlace(cam, out, tau);
  diners(cam, out, tau);
  if (id !== 1) waiters(cam, out, tau, x, z, P.sway);
  restFx(cam, out, tau, x, z, t);
  return out;
};
export { FPS };
