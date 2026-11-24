// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, clamp01, at, BUYER, NEIGH, WORKER, INSPECT, CLIP, HIT, REST, HOOK_HIT, HOOK_LAND, HIT_T, LAND_T, dropT, droneAt, parcelAt, V3 } from "./story";
import { fxClock, fxSparkle, fxPow, fxShake } from "./robot";
import { fxBurst, fxPuff, fxStars } from "./toon";
import { fxApp, fxBottle, fxProp, fxBulb, fxGift, fxClip, fxLens, fxQ, fxCheck, fxZap } from "./dfx";
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

export type Stage = { places: Place[]; fx: FxPlace[]; drone?: import("./story").DroneState };

// ================= the delivery-drone short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const BUY: Outfit = { jacket: "#e8743a", pants: "#3b4a6a", boots: "#2b2630", hat: "hair", hair: "#3a2a22", skin: "#f5c9a0" };
const NB: Outfit = { jacket: "#5aa36a", pants: "#4a4e60", boots: "#5a3b2a", hat: "hair", hair: "#c4c4ce", moustache: "#c4c4ce", skin: "#c99067", build: "stout" };
const WRK: Outfit = { jacket: "#ff8a1e", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#f2c22a", skin: "#ecd0b6" };
const INSP: Outfit = { jacket: "#2a3d6a", pants: "#2b2f3a", boots: "#1e1a20", hat: "cap", cap: "#2a3d6a", skin: "#f5c9a0" };
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
export const onCard = (cam: { x: number; z: number }, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.x - x, dz = cam.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, t: number, shadow = true) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  if (shadow) blob(out, x, y, z, 1, 0.9);
};
/** horizontal look (-1 left .. 1 right on screen) from a card at (x, z) toward a world point */
const lookAt = (cam: CamInfo, x: number, z: number, p: [number, number, number]) => {
  const dx = p[0] - x, dz = p[2] - z, r = cam.right;
  return Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / 0.6));
};
/** a canvas hand point that reaches toward a world point (pointing), on the near side */
const pointTo = (cam: CamInfo, x: number, z: number, p: V3, y0 = 1.3): [number, number] => {
  const l = lookAt(cam, x, z, p), up = Math.max(-0.2, Math.min(1, (p[1] - y0) / 4));
  return [300 + 190 * l, 470 - 170 * up];
};
const bottle = (cam: CamInfo, out: Stage, x: number, y: number, z: number, hand: [number, number], s = 1) => {
  const [bx, by, bz] = onCard(cam.pos, x, y, z, hand[0], hand[1] - 55 * s, 1, 0.1);
  fx1(out, "bottle", 200, 320, fxBottle, bx, by, bz, 0.2 * s, 0.32 * s);
};
const buzz = (out: Stage, p: V3, t: number, s = 0.9) => {
  const k = Math.floor(t * 15) % 3;
  fx1(out, `buzz${k}`, 256, 256, fxShake, p[0], p[1] + 0.05, p[2], s, s, k * 0.5 - 0.5);
};
/** dizzy stars circling the wounded drone */
const dizzy = (out: Stage, p: V3, t: number, s = 1.2) => {
  const u = (t * 0.9) % 1;
  fx1(out, `dz${Math.floor(u * 24)}`, 420, 210, (pp) => fxStars(pp, u), p[0], p[1] + 0.75, p[2], s, s / 2);
};
const zap = (out: Stage, p: V3, t: number, t0: number, s = 1.1, dur = 0.45) => {
  const d = t - t0;
  if (d < 0 || d > dur) return;
  fx1(out, `zap${Math.floor(d * 20) % 4}`, 300, 300, (pp) => fxZap(pp, Math.floor(d * 20) % 4), p[0], p[1], p[2] + 0.1, s, s);
  if (d < 0.3) fx1(out, `zb${Math.floor(d * 30)}`, 500, 500, (pp) => fxBurst(pp, Math.min(1, d * 3.3), "#fff3b0", 10, 30, 190), p[0], p[1], p[2] + 0.05, s * 1.2, s * 1.2);
};
const pow = (out: Stage, p: V3, t: number, t0: number, s = 1.3) => {
  const d = t - t0;
  if (d > 0 && d < 0.3) fx1(out, `pw${Math.floor(d * 30)}`, 512, 512, (pp) => fxPow(pp, d / 0.3), p[0], p[1] + 0.1, p[2] + 0.3, s, s);
  if (d > 0.05 && d < 0.7) { const u = (d - 0.05) / 0.65; fx1(out, `pf${Math.floor(u * 16)}`, 300, 300, (pp) => fxPuff(pp, u), p[0], p[1] - 0.1, p[2] + 0.35, s * 1.1, s * 1.1); }
};
const sparkles = (out: Stage, p: V3, t: number, s = 0.16, spread = 0.3) => {
  for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i * 0.33) % 1, k = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(k * 10)}`, 256, 256, (pp) => fxSparkle(pp, k), p[0] - spread + spread * i, p[1] + 0.1 * (i % 2), p[2], s, s); }
};
const pop = (d: number, k = 1.1) => (d < 0 ? 0 : d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * k : 1);

// ---------------- 1: the hook ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = BUYER[1], d = droneAt(1, t)!, landed = t >= HOOK_LAND;
  const H: [[number, number], [number, number]] = landed ? [[120, 330], [480, 330]] : [[210, 560], [455, 450]];
  standP(cam, out, 1, BUY, x, y, z, { expr: landed ? "shock" : "nervous", look: lookAt(cam, x, z, d.p), tilt: landed ? -3 : 2 * Math.sin(t * 3), headTilt: landed ? 0 : -4, reach: H }, t);
  bottle(cam, out, x, y, z, H[1]);
  if (!landed) buzz(out, d.p, t, 1.2);
  dizzy(out, d.p, t, landed ? 1.6 : 1.2);
  zap(out, [d.p[0], HIT_Y1, d.p[2]], t, HOOK_HIT, 1.4);
  pow(out, REST, t, HOOK_LAND, 1.6);
};
const HIT_Y1 = HIT[1] + 0.25;

// ---------------- 2: the app ----------------
const app = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = BUYER[2];
  standP(cam, out, 1, BUY, x, y, z, { expr: at(t, W.arriving) ? "grin" : "smile", look: 0.5, headTilt: 6, prop: "phone" }, t);
  const d = t - (W.app - 0.1);
  if (d > 0) {
    const s = pop(d), [ax, ay, az] = onCard(cam.pos, x, y, z, 575, 330, 1, 0.15);
    const k = clamp01((t - W.arriving) / 1.3);
    fx1(out, `app${at(t, W.arriving) ? 1 : 0}_${Math.floor(k * 24)}`, 320, 560, (p) => fxApp(p, k, at(t, W.arriving)), ax, ay, az, 0.44 * s, 0.77 * s, 0.06);
  }
};

// ---------------- 3: it arrives ----------------
const arrive = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = BUYER[3], d = droneAt(3, t)!, did = at(t, W.did), got = t > dropT + 0.75;
  const H: [[number, number], [number, number]] = got ? [[150, 360], [450, 330]] : did ? [[140, 360], [460, 360]] : [[210, 560], [390, 560]];
  standP(cam, out, 1, BUY, x, y, z, { expr: got ? "laugh" : did ? "grin" : "smile", look: lookAt(cam, x, z, d.p), headTilt: got ? 4 : -3, reach: H, prop: did ? null : "phone" }, t);
  buzz(out, d.p, t, 1.0);
  const pp = parcelAt(t);
  if (pp && t - dropT > 0.5 && t - dropT < 0.8) pow(out, [pp[0], 0.1, pp[2]], t, dropT + 0.5, 0.7);
  if (got) { bottle(cam, out, x, y, z, H[1], pop(t - dropT - 0.75)); const [bx, by, bz] = onCard(cam.pos, x, y, z, H[1][0], H[1][1] - 60, 1, 0.12); sparkles(out, [bx, by + 0.1, bz], t, 0.14, 0.2); }
};

// ---------------- 4: the cable + the propeller ----------------
const clip = (cam: CamInfo, out: Stage, t: number) => {
  const d = droneAt(4, t)!, hit = at(t, W.cable);
  buzz(out, d.p, t, hit ? 1.2 : 0.9);
  zap(out, CLIP, t, W.cable, 1.2);
  const dl = t - W.propeller;
  if (dl > 0 && dl < 1.3) {
    // the propeller spins off, up and away, then tumbles down out of frame
    const px = d.p[0] - 0.7 - 1.6 * dl, py = d.p[1] + 0.5 + 1.6 * dl - 3.0 * dl * dl, pz = d.p[2] + 0.3;
    const a = dl * 40;
    fx1(out, `prop${Math.floor(a * 3) % 24}`, 256, 256, (p) => fxProp(p, a), px, py, pz, 1.15, 1.15);
    if (dl < 0.3) fx1(out, `pb${Math.floor(dl * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, dl * 3.3), "#fff3b0", 9, 30, 170), d.p[0] - 0.5, d.p[1] + 0.15, d.p[2] + 0.2, 1.0, 1.0);
  }
};

// ---------------- 5: the sick bird ----------------
const bird = (cam: CamInfo, out: Stage, t: number) => {
  const d = droneAt(5, t)!, [bx, by, bz] = BUYER[5], [nx, ny, nz] = NEIGH[5], said = at(t, W.neighbor), hit = t >= HIT_T;
  const bH: [[number, number], [number, number]] = hit ? [[140, 340], [460, 340]] : [[200, 560], [430, 450]];
  standP(cam, out, 1, BUY, bx, by, bz, { expr: hit ? "shock" : "nervous", look: lookAt(cam, bx, bz, d.p), headTilt: -4, reach: bH }, t);
  bottle(cam, out, bx, by, bz, bH[1]);
  const nH: [[number, number] | null, [number, number] | null] = said && !hit ? [[200, 560], pointTo(cam, nx, nz, d.p)] : hit ? [[150, 340], [450, 340]] : [null, null];
  standP(cam, out, 2, NB, nx, ny, nz, { expr: hit ? "shock" : said ? "laugh" : "neutral", look: lookAt(cam, nx, nz, d.p), headTilt: said ? 5 : 0, reach: nH }, t);
  if (!hit) { buzz(out, d.p, t, 1.2); dizzy(out, d.p, t, 1.3); }
  zap(out, HIT, t, HIT_T, 1.5);
  pow(out, REST, t, LAND_T, 1.7);
};

// ---------------- 6: the lights go out ----------------
const lights = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = NEIGH[6], off = at(t, W.off);
  standP(cam, out, 2, NB, x, y, z, { expr: off ? "dazed" : "nervous", look: 0.7, headTilt: off ? 8 : 0, reach: off ? [[230, 560], [370, 560]] : undefined }, t);
  const dd = t - W.off;
  fx1(out, off ? "bulbOff" : "bulbOn", 256, 320, (p) => fxBulb(p, !off), 13.4, 8.4 - (off ? 0.15 * clamp01(dd * 4) : 0), -5.6, 2.1, 2.6, off ? 0.15 : 0);
  dizzy(out, [REST[0], REST[1] - 0.3, REST[2]], t, 1.1);
};

// ---------------- 7: nobody hurt ----------------
const relief = (cam: CamInfo, out: Stage, t: number) => {
  const [bx, by, bz] = BUYER[7], [nx, ny, nz] = NEIGH[7];
  const bH: [[number, number], [number, number]] = [[200, 560], [440, 440]];
  standP(cam, out, 1, BUY, bx, by, bz, { expr: at(t, W.hurt) ? "relief_open" : "relief", look: -0.4, reach: bH }, t);
  bottle(cam, out, bx, by, bz, bH[1]);
  standP(cam, out, 2, NB, nx, ny, nz, { expr: "relief", look: 0.5, tilt: -2 }, t);
  const d = t - W.nobody;
  if (d > 0) { const s = pop(d); fx1(out, "check", 256, 256, fxCheck, (bx + nx) / 2, 2.35, (bz + nz) / 2 + 0.1, 0.36 * s, 0.36 * s); }
};

// ---------------- 8: three hours on a ladder ----------------
const ladder = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = WORKER, tug = Math.sin(t * 7) > 0;
  standP(cam, out, 3, WRK, x, y, z, { expr: at(t, W.three) ? "dazed" : "stern", look: 0.6, headTilt: -4, reach: [[300 + 170, 210 + (tug ? 0 : 25)], [300 + 120, 250 + (tug ? 25 : 0)]] }, t, false);
  const a = (t - 23.0) * 11;
  fx1(out, `clk${Math.floor(a * 6) % 48}`, 256, 256, (p) => fxClock(p, a), 5.15, 3.55, -1.0, 0.6, 0.6);
};

// ---------------- 9: the gift card ----------------
const gift = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = NEIGH[9], got = at(t, W.got);
  standP(cam, out, 2, NB, x, y, z, { expr: at(t, W.card) ? "laugh" : got ? "grin" : "smile", look: 0, reach: got ? [[215, 600], [385, 600]] : undefined }, t);
  if (got) {
    const s = pop(t - (W.got - 0.07)), [gx, gy, gz] = onCard(cam.pos, x, y, z, 300, 640, 1, 0.16);
    fx1(out, "gift", 420, 280, fxGift, gx, gy, gz, 0.6 * s, 0.4 * s, -0.08);
    sparkles(out, [gx, gy + 0.32, gz], t, 0.14, 0.28);
  }
};

// ---------------- 10: investigating ----------------
const inspect = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = INSPECT, inv = at(t, W.investigating);
  const lens: [number, number] = inv ? [540, 600 + 25 * Math.sin((t - W.investigating) * 4)] : [500, 560];
  standP(cam, out, 4, INSP, x, y, z, { expr: inv ? "stern" : "neutral", look: 0.8, headTilt: 6, tilt: 3, reach: [[160, 560], lens] }, t);
  const [cx, cy, cz] = onCard(cam.pos, x, y, z, 150, 520, 1, 0.12);
  fx1(out, "clip", 220, 300, fxClip, cx, cy, cz, 0.24, 0.33, 0.1);
  const [lx, ly, lz] = onCard(cam.pos, x, y, z, lens[0] + 30, lens[1] + 25, 1, 0.14);
  fx1(out, "lens", 300, 300, fxLens, lx, ly, lz, 0.32, 0.32, 3.14);
  const d = t - W.officials;
  if (d > 0) { const s = pop(d); fx1(out, "q", 200, 300, fxQ, 5.6, 1.25, 0.75, 0.24 * s, 0.36 * s); }
};

// ---------------- 11: would you let a drone deliver? ----------------
const ending = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = BUYER[11], send = at(t, W.send);
  const bH: [number, number] = send ? [460, 330 + 20 * Math.sin((t - W.send) * 8)] : [450, 360];
  standP(cam, out, 1, BUY, x, y, z, { expr: send ? "laugh" : at(t, W.deliver) ? "grin" : "smile", look: send ? 0 : 0.3, headTilt: send ? 0 : 5, reach: [[200, 560], bH] }, t);
  bottle(cam, out, x, y, z, bH, 1.1);
  const d = t - W.would;
  if (d > 0 && !send) { const s = pop(d); const [qx, qy, qz] = onCard(cam.pos, x, y, z, 150, 150, 1, 0.1); fx1(out, "q", 200, 300, fxQ, qx, qy, qz, 0.2 * s, 0.3 * s, -0.15); }
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  [hook, app, arrive, clip, bird, lights, relief, ladder, gift, inspect, ending][id - 1](cam, out, t);
  return out;
};
export { FPS };
