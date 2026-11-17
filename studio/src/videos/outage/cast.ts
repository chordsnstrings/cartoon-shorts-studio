// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, SCREEN, T1, T2, TABLE_Y, READER, REGISTER, COUNTER, ROUTER, MONITOR, OFFICE, C1, S1, C2, C3, S2, C4, UP_A, UP_B, QUEUE, S1W, ENG, C1W } from "./story";
import { fxSparkle, fxShake, fxZzz } from "./robot";
import { fxPhone, PhoneMode, fxCloudSad, fxErr, fxHacker, fxCross, fxBoxOpen, fxWifi, fxSpark, fxSweat, fxPoof } from "./outage_fx";
import { fxBurst } from "./toon";
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

// ================= the outage short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const CUST1: Outfit = { jacket: "#f08a2c", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#f5c9a0", dress: "#f08a2c" };
const STAFF: Outfit = { jacket: "#3a64b8", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#5a3b2a", skin: "#ecd0b6", buttons: "#f4f1ea" };
const STAFF2: Outfit = { jacket: "#3a64b8", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#e0b040", skin: "#ffe2c2", dress: "#3a64b8" };
const CUST2: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#e8483c", skin: "#c99067" };
const CUST3: Outfit = { jacket: "#7b5ac9", pants: "#2b2d42", boots: "#2b2630", hat: "hair", hair: "#3a2a2a", skin: "#f5c9a0", moustache: "#3a2a2a" };
const CUST4: Outfit = { jacket: "#f2c43a", pants: "#3b5b9a", boots: "#2b2630", hat: "hair", hair: "#7a3b2a", skin: "#ffe2c2", dress: "#f2c43a" };
const ENGR: Outfit = { jacket: "#5a6276", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const QO: Outfit[] = [CUST3, CUST2, { ...CUST1, jacket: "#e8483c", dress: "#e8483c", hair: "#e0b040" }, { ...CUST4, jacket: "#4f9a6e", dress: undefined, hair: "#2a2020", skin: "#c99067" }];
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
export const onCard = (cam: { x: number; z: number }, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.x - x, dz = cam.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, p: [number, number, number], fo: FrontOpts, t: number, shadow = true, swaps: number[] = []) => {
  out.places.push(person(cam, who(i, o), p[0], p[1], p[2], { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i, swaps) }, {}));
  if (shadow) blob(out, p[0], p[1], p[2], 1, 0.9);
};
const pop = (d: number, k = 1.15) => (d < 0 ? 0 : d < 0.22 ? Math.sin((d / 0.22) * Math.PI * 0.5) * k : 1);
/** a phone held at the hand (canvas point h) of the card at p */
const phoneAt = (cam: CamInfo, out: Stage, p: [number, number, number], h: [number, number], mode: PhoneMode, k = 0, s = 1, rot = 0) => {
  const [x, y, z] = onCard(cam.pos, p[0], p[1], p[2], h[0], h[1] - 50, 1, 0.12);
  const key = mode === "spin" ? `ph|spin|${Math.floor(k * 8) % 8}` : `ph|${mode}`;
  fx1(out, key, 256, 448, (q) => fxPhone(q, mode, k), x, y, z, 0.13 * s, 0.2275 * s, rot);
  return [x, y, z] as [number, number, number];
};
const sweat = (out: Stage, t: number, x: number, y: number, z: number, t0 = 0, s = 1) => {
  const u = ((t - t0) * 1.3) % 1;
  fx1(out, "sweat", 128, 160, fxSweat, x, y - 0.25 * u, z, 0.09 * s, 0.11 * s);
};
const shake = (out: Stage, t: number, x: number, y: number, z: number, s = 0.8) => {
  const k = Math.floor(t * 15) % 3;
  fx1(out, `sh${k}`, 256, 256, fxShake, x, y, z, s, s, k * 0.4 - 0.4);
};
/** red error bubbles popping over the display phones of a table, staggered */
const tableErrors = (out: Stage, t: number, tb: [number, number, number], t0: number, n = 5, size = 0.3) => {
  for (let i = 0; i < n; i++) {
    const d = t - (t0 + ((i * 3) % n) * 0.22);
    if (d < 0) continue;
    const k = pop(d, 1.2) * (1 + 0.05 * Math.sin(t * 9 + i));
    const x = tb[0] - 1.25 + (2.5 * i) / (n - 1);
    fx1(out, "err", 256, 256, fxErr, x, tb[1] + 0.42 + 0.03 * Math.sin(t * 3 + i), tb[2] + 0.25, size * k, size * k);
  }
};

// ---------------- 1: hook: the whole store goes down ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const off = at(t, W.offline);
  const h: [number, number] = [440, 560];
  standP(cam, out, 1, CUST1, C1, { expr: off ? "shock" : Math.floor(t * 4) % 2 ? "shock" : "nervous", look: off ? 0 : 0.4, headTilt: off ? -4 : 6, tilt: off ? -3 : 2 * Math.sin(t * 9),
    reach: off ? [[150, 300], [450, 300]] : [[200, 560], h] }, t, false, [W.offline]);
  if (!off) phoneAt(cam, out, C1, h, "err", 0, 1.05, -0.15);
  standP(cam, out, 2, STAFF, S1, { expr: off ? "shock" : "nervous", look: off ? 0 : -0.6, headTilt: off ? 4 : -6,
    reach: off ? [[150, 300], [450, 300]] : [[180, 560], [420, 520]] }, t, false, [W.knocked, W.offline]);
  if (!off) phoneAt(cam, out, S1, [420, 520], "x", 0, 1.25, 0.1);
  tableErrors(out, t, T1, 0.0, 5, 0.28);
  const [hx, hy, hz] = onCard(cam.pos, C1[0], 0, C1[2], 300, 230, 1, 0.1);
  sweat(out, t, hx + 0.22, hy + 0.05, hz, 0.0);
  shake(out, t, hx, hy + 0.32, hz, 0.75);
  if (off) {
    const d = t - (W.offline - 0.04);
    if (d < 0.45) fx1(out, `spk${Math.floor(d * 30)}`, 512, 512, (p) => fxSpark(p, d / 0.45), SCREEN.x - 1.2, SCREEN.y + 0.6, SCREEN.z + 0.3, 1.9, 1.9);
    if (d < 0.45) fx1(out, `spk2${Math.floor(d * 30)}`, 512, 512, (p) => fxSpark(p, d / 0.45), SCREEN.x - 2.3, SCREEN.y + 1.0, SCREEN.z + 0.3, 1.3, 1.3, 0.6);
    const [sx, sy, sz] = onCard(cam.pos, S1[0], 0, S1[2], 300, 230, 1, 0.1);
    sweat(out, t, sx - 0.22, sy + 0.05, sz, W.offline);
  }
};

// ---------------- 2: the cloud leaves the phone ----------------
const cloud = (cam: CamInfo, out: Stage, t: number) => {
  const sg = at(t, W.signed), o = at(t, W.out);
  const h: [number, number] = [420, 560];
  standP(cam, out, 3, CUST2, C2, { expr: o ? "dazed" : sg ? "shock" : "smile", look: o ? 0.1 : 0.45, headTilt: o ? 8 : 4, reach: [[200, 560], h] }, t, false, [W.signed, W.out]);
  const [px, py, pz] = phoneAt(cam, out, C2, h, sg ? "out" : "on", 0, 1.1, -0.1);
  if (sg) {
    const u = clamp01((t - W.signed) / 1.1), e = smooth(u);
    fx1(out, "cloudSad", 384, 256, fxCloudSad, px + 0.08 + 0.12 * e, py + 0.24 + 0.5 * e + 0.04 * Math.sin(t * 6), pz + 0.05, 0.4 * (1 - 0.2 * e), 0.27 * (1 - 0.2 * e), 0.1 * Math.sin(t * 5));
  } else fx1(out, "cloudSad", 384, 256, fxCloudSad, px + 0.16, py + 0.22, pz + 0.05, 0.34, 0.23);
  if (o) { const [hx, hy, hz] = onCard(cam.pos, C2[0], 0, C2[2], 300, 230, 1, 0.1); sweat(out, t, hx + 0.2, hy + 0.05, hz, W.out); }
};

// ---------------- 3: pay: the reader refuses ----------------
const pay = (cam: CamInfo, out: Stage, t: number) => {
  const no = at(t, W.stopped);
  const h: [number, number] = no ? [470, 520] : [540, 600];
  standP(cam, out, 4, CUST3, C3, { expr: no ? (t < W.stopped + 0.5 ? "shock" : "pained") : "smile", look: 0.7, headTilt: no ? -5 : 3, reach: [[200, 560], h] }, t, true, [W.stopped]);
  const [qx, qy, qz] = phoneAt(cam, out, C3, h, "on", 0, 1.0, -0.3);
  standP(cam, out, 5, STAFF2, S2, { expr: no ? "nervous" : "smile", look: -0.5, headTilt: no ? -6 : 0, reach: no ? [[120, 560], [480, 560]] : undefined }, t, false, [W.stopped]);
  if (no) {
    const d = t - (W.stopped - 0.03), k = pop(d, 1.2);
    fx1(out, "cross", 384, 384, (p) => fxCross(p, 1), qx, qy + 0.02, qz + 0.04, 0.24 * k, 0.24 * k);
    shake(out, t, qx, qy + 0.05, qz + 0.03, 0.42);
    const [hx, hy, hz] = onCard(cam.pos, C3[0], 0, C3[2], 300, 230, 1, 0.1); sweat(out, t, hx - 0.2, hy + 0.05, hz, W.stopped);
  }
};

// ---------------- 4: the wall screen spins forever ----------------
const spinner = (cam: CamInfo, out: Stage, t: number) => {
  const ld = at(t, W.load);
  standP(cam, out, 1, CUST1, UP_A, { expr: ld ? "dazed" : "neutral", look: 0.2, headTilt: ld ? 10 : 4, reach: [[200, 560], [420, 560]] }, t, true, [W.load]);
  phoneAt(cam, out, UP_A, [420, 560], "spin", (t * 1.5) % 1, 1.0, 0);
  standP(cam, out, 3, CUST2, UP_B, { expr: ld ? "nervous" : "neutral", look: -0.2, headTilt: -4, tilt: ld ? -3 : 0 }, t, true, [W.load]);
  if (ld) { const u = ((t - W.load) * 0.8) % 1; const [x, y, z] = onCard(cam.pos, UP_B[0], 0, UP_B[2], 380, 120, 1, 0.1); fx1(out, `zz${Math.floor(u * 16)}`, 256, 256, (p) => fxZzz(p, u), x, y, z, 0.32, 0.32); }
};

// ---------------- 5: brand-new phone: locked ----------------
const unbox = (cam: CamInfo, out: Stage, t: number) => {
  const ua = at(t, W.unable), said = at(t, W.said);
  const h: [number, number] = ua ? [430, 500] : [450, 470 + 8 * Math.sin(t * 6)];
  standP(cam, out, 6, CUST4, C4, { expr: ua ? "neutral" : said ? "nervous" : Math.floor(t * 3) % 2 ? "laugh" : "grin", look: ua ? 0 : 0.35, headTilt: ua ? 0 : 6 * Math.sin(t * 3),
    reach: [[190, 560], h] }, t, false, [W.said, W.unable]);
  phoneAt(cam, out, C4, h, ua ? "lock" : said ? "spin" : "new", (t * 1.5) % 1, 1.05, ua ? 0 : -0.15);
  fx1(out, "boxOpen", 384, 320, fxBoxOpen, T1[0] - 0.4, TABLE_Y + 0.2, T1[2] + 0.35, 0.56, 0.47);
  if (!said) for (let j = 0; j < 3; j++) {
    const u = (t * 1.2 + j / 3) % 1, kk = Math.sin(u * Math.PI);
    const [x, y, z] = onCard(cam.pos, C4[0], 0, C4[2], 470 + 90 * Math.cos(j * 2.1), 420 + 80 * Math.sin(j * 2.1), 1, 0.15);
    fx1(out, `sp${Math.floor(kk * 10)}`, 256, 256, (p) => fxSparkle(p, kk), x, y, z, 0.14, 0.14);
  }
};

// ---------------- 6: the queue: nothing sells ----------------
const queue = (cam: CamInfo, out: Stage, t: number) => {
  const cn = at(t, W.couldnt), sl = at(t, W.sell);
  QUEUE.forEach((p, i) => {
    const h: [number, number] = [430, 600];
    standP(cam, out, 10 + i, QO[i], p, { expr: sl ? (i % 2 ? "laugh" : "dazed") : cn ? "nervous" : "neutral", look: 0.6, headTilt: sl ? (i % 2 ? 6 : -6) : 0, reach: [[180, 600], h] }, t, true, [W.couldnt, W.sell]);
    const [x, y, z] = onCard(cam.pos, p[0], 0, p[2], h[0] + 10, h[1] - 40, 1, 0.12);
    fx1(out, "boxShut", 384, 320, fxBoxOpen, x, y, z, 0.3, 0.25);
  });
  standP(cam, out, 5, STAFF2, S2, { expr: cn ? "nervous" : "smile", look: -0.4, headTilt: cn ? -8 : 0, reach: cn ? [[110, 540], [490, 540]] : undefined }, t, false, [W.couldnt]);
  if (cn) {
    const k = pop(t - W.couldnt, 1.2);
    fx1(out, "cross", 384, 384, (p) => fxCross(p, 1), REGISTER[0] - 0.2, COUNTER.y + 0.95, REGISTER[2] + 0.3, 0.75 * k, 0.75 * k);
    const [hx, hy, hz] = onCard(cam.pos, S2[0], 0, S2[2], 300, 230, 1, 0.1); sweat(out, t, hx + 0.22, hy + 0.05, hz, W.couldnt);
  }
};

// ---------------- 7: status page: all green ----------------
const status = (cam: CamInfo, out: Stage, t: number) => {
  const st = at(t, W.still);
  standP(cam, out, 2, STAFF, S1W, { expr: st ? "neutral" : "smile_closed", look: -0.5, headTilt: st ? 0 : 5, reach: [[110, 330], [420, 580]] }, t, true, [W.still]);
  tableErrors(out, t, T1, 15.95 + 0.1, 5, 0.34);
  if (at(t, W.green)) for (let j = 0; j < 3; j++) {
    const u = (t * 1.3 + j / 3) % 1, kk = Math.sin(u * Math.PI);
    fx1(out, `gs${Math.floor(kk * 10)}`, 256, 256, (p) => fxSparkle(p, kk), SCREEN.x - 2.4 + 2.2 * j, SCREEN.y + 1.2 - 0.6 * (j % 2), SCREEN.z + 0.3, 0.45, 0.45);
  }
};

// ---------------- 8: not hackers ----------------
const hackers = (cam: CamInfo, out: Stage, t: number) => {
  const sy = at(t, W.says), hk = at(t, W.hackers);
  standP(cam, out, 5, STAFF2, S2, { expr: hk ? "stern" : "neutral", look: hk ? 0.5 * Math.sign(Math.sin(t * 14)) : 0, headTilt: hk ? 6 * Math.sin(t * 14) : 0 }, t, false, [W.hackers]);
  const hx = S2[0] - 0.62, hy = 1.95, hz = S2[2] + 0.35;
  if (sy) { const k = pop(t - W.says, 1.15); fx1(out, "hacker", 384, 384, fxHacker, hx, hy, hz, 0.6 * k, 0.6 * k); }
  if (hk) { const d = t - (W.hackers - 0.03), k = d < 0.12 ? 1.6 - 5 * d : 1; fx1(out, "cross", 384, 384, (p) => fxCross(p, 1), hx + 0.1, hy - 0.08, hz + 0.05, 0.42 * k, 0.42 * k); }
};

// ---------------- 9: their own update ----------------
const office = (cam: CamInfo, out: Stage, t: number) => {
  const up = at(t, W.update2);
  standP(cam, out, 7, ENGR, ENG, { expr: up ? "shock" : at(t, W.internal) ? "grin" : "smile", look: up ? 0 : -0.7, headTilt: up ? -4 : 5, phones: "#e8483c",
    reach: up ? [[225, 310], [375, 310]] : [[200, 600], [380, 600]] }, t, true, [W.internal, W.update2]);
  if (up) {
    const d = t - (W.update2 - 0.04);
    for (const [x, s, r] of [[-1.5, 1.2, 0], [0.3, 1.0, 0.7]] as const) if (d < 0.45) fx1(out, `spk${x}${Math.floor(d * 30)}`, 512, 512, (p) => fxSpark(p, d / 0.45), OFFICE + x, 1.9, -2.85, s, s, r);
    // (no poof cloud over the racks: the final audit read it as smoke / a hardware fire)
    const [hx, hy, hz] = onCard(cam.pos, ENG[0], 0, ENG[2], 300, 230, 1, 0.1); sweat(out, t, hx + 0.24, hy + 0.08, hz, W.update2);
    shake(out, t, MONITOR.x, MONITOR.y + 0.45, MONITOR.z + 0.1, 0.7);
  }
};

// ---------------- 10: blame the wifi ----------------
const wifi = (cam: CamInfo, out: Stage, t: number) => {
  const sd = at(t, W.send), bl = at(t, W.blamed);
  standP(cam, out, 1, CUST1, C1W, { expr: sd ? "laugh" : at(t, W.weird) ? "stern" : "nervous", look: sd ? 0 : 0.6, headTilt: sd ? 0 : 6,
    reach: sd ? [[200, 560], [440, 300 + 18 * Math.sin((t - W.send) * 8)]] : [[200, 560], [520, 620]] }, t, false, [W.weird, W.send]);
  if (!sd) phoneAt(cam, out, C1W, [200, 560], "err", 0, 1.0, 0.15);
  const u = (t * 1.6) % 1;
  fx1(out, `wifi${Math.floor(u * 4)}`, 256, 256, (p) => fxWifi(p, u), ROUTER[0], ROUTER[1] + 0.42 + 0.02 * Math.sin(t * 4), ROUTER[2] + 0.05, 0.32, 0.32);
  if (bl) { const k = pop(t - W.blamed, 1.2); fx1(out, "sparkW", 256, 256, (p) => fxSparkle(p, 0.8), ROUTER[0] + 0.25, ROUTER[1] + 0.62, ROUTER[2] + 0.05, 0.2 * k, 0.2 * k); }
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  [hook, cloud, pay, spinner, unbox, queue, status, hackers, office, wifi][id - 1](cam, out, t);
  return out;
};
export { FPS, smooth };
void fxBurst; void T2; void fxPoof;
