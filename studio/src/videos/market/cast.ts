// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, clamp01, at, V3, VISITOR, TRADER, ORG, BUCKETS, HUTS, DREAM_X, dripAt, dropY, DRIP_FALL, HOOK_PLINK, HEAD_DRIP, SLAM, F } from "./story";
import { HUT, hutPt, BANNER } from "./build";
import { fxDrop, fxBubble, fxCount, fxPixel, fxChip, fxSplat } from "./mfx";
import { fxSparkle, fxPow } from "./robot";
import { fxBurst, fxPuff, fxSplash, fxRing } from "./toon";
import { fxQ } from "./dfx";
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

// ================= the AI-Christmas-market short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
/** the visitor (red coat), the trader (blue, stout), the organiser (purple), the dream crowd */
const VIS: Outfit = { jacket: "#d8453a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#4a2c20", skin: "#f5c9a0", dress: "#d8453a" };
const TRD: Outfit = { jacket: "#3f7fbf", pants: "#4a4e60", boots: "#5a3b2a", hat: "cap", cap: "#2f5f8f", skin: "#e0b088", build: "stout" };
const ORGN: Outfit = { jacket: "#7b5ac9", pants: "#2f3242", boots: "#1e1a20", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const CROWD: Outfit[] = [
  { jacket: "#2f8f7a", pants: "#2b2d42", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#8a5a3c", dress: "#2f8f7a" },
  { jacket: "#f08a2c", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#f2d080", skin: "#f5c9a0" },
  { jacket: "#c25a9a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#3a2418", skin: "#f5c9a0", dress: "#c25a9a" },
  { jacket: "#5aa36a", pants: "#3b4a6a", boots: "#2b2630", hat: "cap", cap: "#d8453a", skin: "#e0b088" },
  { jacket: "#f2c43a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#5a3b2a", skin: "#c99067", dress: "#f2c43a" },
  { jacket: "#3a6ad8", pants: "#2b2f3a", boots: "#1e1a20", hat: "hair", hair: "#1e1a20", skin: "#8a5a3c" },
];
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
export const onCard = (cam: { x: number; z: number }, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.x - x, dz = cam.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, t: number, shadow = true, scale = 1) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}, scale));
  if (shadow) blob(out, x, y, z, scale, 0.9);
};
/** horizontal look (-1 left .. 1 right on screen) from a card at (x, z) toward a world point */
const lookAt = (cam: CamInfo, x: number, z: number, p: [number, number, number]) => {
  const dx = p[0] - x, dz = p[2] - z, r = cam.right;
  return Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / 0.6));
};
const pow = (out: Stage, p: V3, t: number, t0: number, s = 1.3) => {
  const d = t - t0;
  if (d > 0 && d < 0.3) fx1(out, `pw${Math.floor(d * 30)}`, 512, 512, (pp) => fxPow(pp, d / 0.3), p[0], p[1] + 0.1, p[2], s, s);
  if (d > 0.05 && d < 0.7) { const u = (d - 0.05) / 0.65; fx1(out, `pf${Math.floor(u * 16)}`, 300, 300, (pp) => fxPuff(pp, u), p[0], p[1] - 0.1, p[2], s * 1.1, s * 1.1); }
};
const sparkles = (out: Stage, p: V3, t: number, s = 0.16, spread = 0.3) => {
  for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i * 0.33) % 1, k = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(k * 10)}`, 256, 256, (pp) => fxSparkle(pp, k), p[0] - spread + spread * i, p[1] + 0.1 * (i % 2), p[2], s, s); }
};
const pop = (d: number, k = 1.1) => (d < 0 ? 0 : d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * k : 1);

// ---------------- drips + splashes ----------------
const DROP_W = 0.11, DROP_H = 0.165;
/** one bucket's drip: the falling drop, a little crown splash + a ring in the water just after it lands */
const drip = (out: Stage, i: number, t: number, s = 1, only?: { y: number | null; since: number }) => {
  const b = BUCKETS[i], d = only ?? dripAt(i, t);
  if (d.y !== null && d.y > 0.25) fx1(out, "drop", 128, 192, fxDrop, b.x, d.y, b.z, DROP_W * s, DROP_H * s);
  if (d.since < 0.32) {
    const u = d.since / 0.32;
    const ss = Math.min(s, 1.3), tt2 = d.since;
    for (let k = 0; k < 3; k++) { const a = (k - 1) * 0.9, vy = 2.0 - 0.4 * Math.abs(k - 1); const yy = 0.24 + vy * tt2 - 6 * tt2 * tt2; if (yy > 0.2) fx1(out, "drop", 128, 192, fxDrop, b.x + Math.sin(a) * 0.5 * tt2 * 1.4, yy, b.z, 0.05 * ss, 0.075 * ss, -a * 0.6); }
    void u;
  }
  if (d.since < 0.7) { const u = d.since / 0.7; out.fx.push({ key: `ring${Math.floor(u * 16)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x: b.x, y: 0.225, z: b.z, w: 0.36, h: 0.36, flat: true, soft: true }); }
};
const allDrips = (out: Stage, t: number, s = 1) => { for (let i = 0; i < BUCKETS.length; i++) drip(out, i, t, s); };

// ---------------- 1: the hook ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = VISITOR[1], real = at(t, W.real);
  const dart = Math.sin(t * 2.6) * (real ? 0.25 : 0.7);
  const H: [[number, number], [number, number]] = real ? [[140, 330], [460, 330]] : [[150, 360 + 15 * Math.sin(t * 5)], [450, 360 - 15 * Math.sin(t * 5)]];
  standP(cam, out, 1, VIS, x, y, z, { expr: "shock", look: dart, tilt: real ? -3 : 3 * Math.sin(t * 2), headTilt: real ? 0 : -4, reach: H }, t);
  // the hook bucket: drips on a fixed rhythm, then the punch-in drip lands exactly on "Buckets"
  if (t < W.buckets - 0.1) { drip(out, 0, t, 1.6); drip(out, 1, t, 1.4); drip(out, 2, t, 1.4); drip(out, 3, t, 1.4); }
  else {
    const dt = HOOK_PLINK - t;
    drip(out, 0, t, 1.4, dt > 0 ? { y: dt < DRIP_FALL ? 0.25 + dropY(dt) : null, since: 9 } : { y: null, since: -dt });
  }
};

// ---------------- 2: the ad (dream market) ----------------
const DREAM_PEOPLE: [number, number, number, number][] = [ // x offset, z, outfit, scale
  [-1.6, 3.2, 0, 1], [1.5, 2.4, 1, 1], [0.3, 0.6, 2, 1], [-2.4, -1.0, 3, 1], [2.3, -1.8, 4, 1], [-0.8, -3.2, 5, 1],
  [1.0, -5.0, 1, 0.78], [-1.9, -6.2, 2, 1], [2.6, -7.4, 0, 1], [0.0, -8.6, 3, 1], [-2.6, -10.2, 4, 1], [1.8, -11.4, 5, 1],
  [-0.9, -12.8, 0, 1], [2.9, -14.0, 2, 1], [-2.2, -15.2, 1, 1], [0.6, -16.4, 4, 0.8],
];
const ad = (cam: CamInfo, out: Stage, t: number) => {
  const cheer = at(t, W.crowds);
  DREAM_PEOPLE.forEach(([dx, z, o, s], i) => {
    const x = DREAM_X + dx, bobv = 0.03 * Math.abs(Math.sin(t * 3.2 + i));
    const wave = cheer && i % 2 === 0 ? 0.5 + 0.5 * Math.sin(t * 9 + i) : 0;
    const H: [[number, number] | null, [number, number] | null] = cheer && i % 3 === 0 ? [[150, 300], [450, 300]] : cheer ? [null, [470, 330 + 40 * wave]] : [null, null];
    standP(cam, out, 10 + i, CROWD[o], x, bobv, z, { expr: cheer ? (i % 2 ? "laugh" : "grin") : i % 3 ? "smile" : "grin", look: Math.sin(i * 1.7) * 0.6, tilt: 3 * Math.sin(t * 2 + i), headTilt: 4 * Math.sin(i), reach: H }, t, true, s);
  });
  // glossy sparkles in the air on "fairy lights"
  if (at(t, W.fairy)) for (let k = 0; k < 6; k++) { const u = (t * 0.8 + k / 6) % 1, kk = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(kk * 10)}`, 256, 256, (pp) => fxSparkle(pp, kk), DREAM_X - 3 + k * 1.2, 2.6 + 1.6 * ((k * 37) % 5) / 5, -4 - k * 2.2, 0.5, 0.5); }
};

// ---------------- 3: the trader's dream ----------------
const trader = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = TRADER[3], tw = at(t, W.twenty);
  standP(cam, out, 2, TRD, x, y, z, { expr: at(t, W.fifty) ? (tw ? "laugh" : "grin") : "smile", look: 0.45, headTilt: 8, tilt: -2, reach: [[230, 600], [370, 600]] }, t);
  const d = t - (W.traders + 0.15);
  if (d > 0) {
    const s = pop(d), [bx, by, bz] = onCard(cam.pos, x, y, z, 560, -40, 1, 0.2);
    const k0 = clamp01((t - (W.promised + 0.2)) / (W.stalls2 - W.promised - 0.2)), k1 = clamp01((t - W.twenty) / (W.day - W.twenty));
    const kind = tw ? 1 : 0, k = tw ? k1 : k0, step = tw ? Math.floor(k * 90) : Math.floor(k * 50);
    fx1(out, `bub${kind}_${step}`, 640, 520, (p) => fxBubble(p, kind, k), bx, by, bz, 1.12 * s, 0.91 * s);
    if (at(t, W.fifty) && t < W.fifty + 0.6) sparkles(out, [bx, by + 0.35, bz + 0.02], t, 0.16, 0.4);
  }
};

// ---------------- 4: the wide count ----------------
const COUNT_ORDER = [0, 3, 1, 4, 2];
const count = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = VISITOR[4];
  const n = COUNT_ORDER.filter((_, k) => t >= W.counted + 0.1 + k * 0.32).length;
  const hand: [number, number] = [470, 300 + (n % 2) * 25];
  standP(cam, out, 1, VIS, x, y, z, { expr: at(t, W.five) ? "nervous" : "neutral", look: n % 2 ? 0.7 : -0.7, headTilt: 6, reach: [[200, 600], hand] }, t);
  COUNT_ORDER.forEach((h, k) => {
    const t0 = W.counted + 0.1 + k * 0.32;
    if (t < t0) return;
    const p = hutPt(HUTS[h], 0, HUT.ridge + 0.75, 0), s = pop(t - t0, 1.25), b = 0.08 * Math.abs(Math.sin((t - t0) * 6)) * Math.exp(-(t - t0) * 2);
    fx1(out, "count", 256, 256, fxCount, p[0], p[1] + b, p[2], 1.45 * s, 1.45 * s);
  });
  allDrips(out, t, 1.6);
};

// ---------------- 5: the buckets ----------------
const buckets = (_cam: CamInfo, out: Stage, t: number) => { allDrips(out, t, 1.6); };

// ---------------- 6: made by AI ----------------
const glitch = (_cam: CamInfo, out: Stage, t: number) => {
  const zb = -24 + 0.25, cy = BANNER.y0 + BANNER.h / 2;
  // glossy sparkles on the banner from "made"
  if (at(t, W.made)) for (let k = 0; k < 5; k++) { const u = (t * 1.1 + k / 5) % 1, kk = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(kk * 10)}`, 256, 256, (pp) => fxSparkle(pp, kk), -2.6 + k * 1.3, cy - 1.2 + ((k * 3) % 5) * 0.55, zb, 0.6, 0.6); }
  const d = t - (W.ai - 0.08);
  if (d > 0) {
    // glitch pixels flicker over the image for ~0.7 s, then a few stay
    const fr = Math.floor(t * 15);
    const n = d < 0.7 ? 26 : 7;
    for (let i = 0; i < n; i++) {
      const h1 = Math.sin((i + 1) * 12.9898 + fr * (d < 0.7 ? 78.233 : 0)) * 43758.5453, r1 = h1 - Math.floor(h1);
      const h2 = Math.sin((i + 1) * 4.1414 + fr * (d < 0.7 ? 19.19 : 0)) * 24634.6345, r2 = h2 - Math.floor(h2);
      const sz = 0.25 + 0.35 * ((i * 7) % 5) / 5;
      fx1(out, `px${i % 6}`, 128, 128, (pp) => fxPixel(pp, i % 6), -3.3 + 6.6 * r1, BANNER.y0 + 0.3 + (BANNER.h - 0.6) * r2, zb + 0.01 * (i % 3), sz, sz);
    }
    const s = pop(d - 0.1, 1.2);
    if (s > 0) fx1(out, "chip", 300, 300, fxChip, 0.1, cy + 0.15, zb + 0.08, 1.15 * s, 1.15 * s, 0.05 * Math.sin(t * 5));
  }
};

// ---------------- 7: every booking cancelled ----------------
const cancel = (cam: CamInfo, out: Stage, t: number) => {
  void cam; // the slams carry this beat alone: a reacting trader always lined up with one of the pows (read as a hit)
  for (const k of [0, 1, 2]) {
    const p = hutPt(HUTS[k], 0, 0.75, HUT.d / 2 + 0.5);
    pow(out, p, t, SLAM[k], [1.7, 2.1, 2.6][k]);
  }
};

// ---------------- 8: a lesson learned ----------------
const lesson = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = ORG, shrug = at(t, W.called) && t < W.learned - 0.05, hit = t >= HEAD_DRIP;
  const H: [[number, number], [number, number]] = shrug ? [[95, 600], [505, 600]] : hit ? [[200, 560], [400, 560]] : [[230, 600], [370, 600]];
  standP(cam, out, 3, ORGN, x, y, z, { expr: hit ? "neutral" : shrug ? "neutral" : "nervous", look: hit ? 0 : -0.3, headTilt: shrug ? 7 : hit ? -3 : 3, tilt: shrug ? 3 : 0, reach: H }, t);
  // the drop that lands on his head on "learned"
  const top = onCard(cam.pos, x, y, z, 300, 168, 1, 0.1);
  const dt = HEAD_DRIP - t;
  if (dt > 0 && dt < 1.1) fx1(out, "drop", 128, 192, fxDrop, top[0], top[1] + dropY(dt), top[2], 0.13, 0.195);
  if (dt <= 0 && -dt < 0.3) { const u = -dt / 0.3; fx1(out, "splat", 256, 128, fxSplat, top[0], top[1] - 0.03 - 0.05 * u, top[2] + 0.04, 0.4 * (1 + 0.6 * u), 0.2 * (1 - 0.6 * u)); }
  if (dt <= 0 && -dt < 0.4) { const u = -dt / 0.4;
    for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.6, dd = 0.15 + 0.6 * u; fx1(out, "drop", 128, 192, fxDrop, top[0] + Math.sin(a) * dd * 0.9, top[1] + 0.12 + Math.cos(a) * dd * 0.5 - 1.2 * u * u, top[2] + 0.03, 0.08, 0.12, -a); } }
};

// ---------------- 9: would you trust an AI poster? ----------------
const ending = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = VISITOR[9], send = at(t, W.send), would = at(t, W.would);
  const thumb: [number, number] = [470, 330 + (send ? 20 * Math.sin((t - W.send) * 8) : 0)];
  standP(cam, out, 1, VIS, x, y, z, { expr: send ? "laugh" : would ? "stern" : "nervous", look: send ? 0 : would ? 0.15 : -0.5, headTilt: send ? 0 : 6, reach: would ? [[230, 600], thumb] : [[230, 600], [370, 600]] }, t);
  const d = t - W.would;
  if (d > 0 && !send) { const s = pop(d); const [qx, qy, qz] = onCard(cam.pos, x, y, z, 120, 110, 1, 0.1); fx1(out, "q", 200, 300, fxQ, qx, qy, qz, 0.24 * s, 0.36 * s, -0.15); }
  drip(out, 5, t, 1.2);
  if (at(t, W.poster)) sparkles(out, [0.4, BANNER.y0 + BANNER.h - 0.6, -23.7], t, 0.5, 1.6);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  [hook, ad, trader, count, buckets, glitch, cancel, lesson, ending][id - 1](cam, out, t);
  return out;
};
export { FPS };
void F; void INK; void rrect; void bodySide; void LIGHTS;
