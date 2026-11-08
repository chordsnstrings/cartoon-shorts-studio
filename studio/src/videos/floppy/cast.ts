// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, YT, MATE, DESK, TERMS, MON, truckX, TRUCK_Z } from "./story";
import { fxGlow } from "./sat";
import { fxBurst, fxPuff, fxStars } from "./toon";
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

// ================= the floppy-disk short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const CTRL: Outfit = { jacket: "#3a64b8", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const MATEO: Outfit = { jacket: "#f2a03a", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#c98a3a", skin: "#ffe2c2" };
const MECH: Outfit = { jacket: "#e8483c", pants: "#3b5b9a", boots: "#2b2630", hat: "cap", cap: "#f2c43a", skin: "#f5c9a0" };
const MECH2: Outfit = { jacket: "#e8483c", pants: "#3b5b9a", boots: "#2b2630", hat: "cap", cap: "#3a64b8", skin: "#8a5a3c" };
const RIDERS: Outfit[] = [
  { jacket: "#2fa39a", pants: "#3b3f52", boots: "#efece4", hat: "hair", hair: "#5a3b2a", skin: "#ecd0b6" },
  { jacket: "#c95b8a", pants: "#4a3a30", boots: "#2b2630", hat: "hair", hair: "#e0c070", skin: "#ffe2c2" },
  { jacket: "#7b5ac9", pants: "#3b5b9a", boots: "#5a3b2a", hat: "cap", cap: "#4f9a6e", skin: "#c99067" },
];
const PHONES = "#2b2f3a";
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.06): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU, v = (975 - cy) * SU;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};

// ---------------- effect cards (no text anywhere) ----------------
/** thick dark smoke puff (256 x 256), t 0..1 */
const fxSmoke = (p: Pen, t: number) => { for (let i = 0; i < 4; i++) { const a = i * 1.6, r = 46 + 14 * (i % 2); p.ell(128 + 38 * Math.cos(a), 128 + 30 * Math.sin(a), r, r * 0.85, `rgba(${70 + 40 * t | 0},${70 + 40 * t | 0},${80 + 40 * t | 0},${(0.95 - 0.7 * t).toFixed(2)})`, 0); } };
/** a 3.5-inch floppy, front view (256 x 256) */
const fxFloppy = (p: Pen, dusty = false) => {
  p.poly([[16, 16], [222, 16], [240, 34], [240, 240], [16, 240]], dusty ? "#4a5272" : "#24305a", 9);
  p.poly(rrect(70, 16, 186, 104, 4), "#c9ced8", 6); p.poly(rrect(146, 30, 172, 90, 3), "#2b2f3a", 0); p.poly(rrect(80, 22, 100, 98, 3), "#e9ecf2", 0);
  p.poly(rrect(44, 128, 212, 240, 6), "#fbfaf4", 6); p.poly([[44, 128], [212, 128], [212, 144], [44, 144]], "#e8483c", 0);
  for (let i = 0; i < 3; i++) p.stroke([[62, 168 + i * 20], [170 - i * 18, 168 + i * 20]], 6, "#c9ced8");
  p.poly(rrect(24, 214, 38, 228, 2), "#11162a", 0);
  if (dusty) for (let i = 0; i < 9; i++) p.dot(40 + ((i * 53) % 180), 40 + ((i * 71) % 180), 5, "rgba(230,220,200,0.8)");
};
/** a paper flight strip (256 x 64) */
const fxStrip = (p: Pen, k: number) => {
  p.poly([[6, 8], [250, 8], [250, 56], [6, 56]], ["#fbf3d0", "#d8ecd0", "#f8d8c8"][k % 3], 5);
  p.poly([[6, 8], [24, 8], [24, 56], [6, 56]], ["#e8483c", "#3a64b8", "#4f9a6e"][k % 3], 0);
  for (let i = 0; i < 3; i++) p.stroke([[40 + i * 70, 26], [80 + i * 70 + ((k * 13 + i * 7) % 20), 26]], 5, "#7a8aa8");
  p.stroke([[40, 42], [150 + ((k * 31) % 60), 42]], 4, "#b9c4d6");
};
/** a cardboard parcel, three-quarter view (256 x 224) */
const fxParcel = (p: Pen) => {
  p.poly([[28, 70], [150, 92], [150, 210], [28, 188]], "#c98a4a", 8);
  p.poly([[150, 92], [232, 64], [232, 182], [150, 210]], "#a86e38", 8);
  p.poly([[28, 70], [110, 42], [232, 64], [150, 92]], "#e0a866", 8);
  p.poly([[64, 58], [86, 50], [208, 72], [186, 80]], "#f2e6c8", 0);
  p.poly([[86, 76], [108, 80], [108, 198], [86, 194]], "#f2e6c8", 0);
  p.poly([[44, 150], [80, 157], [80, 176], [44, 169]], "#fbfaf4", 4);
};
/** a selfie photo (224 x 288) */
const fxPhoto = (p: Pen) => {
  p.poly(rrect(8, 8, 216, 280, 12), "#ffffff", 8);
  p.poly([[24, 24], [200, 24], [200, 230], [24, 230]], "#7fb0e8", 0);
  p.poly([[24, 170], [200, 150], [200, 230], [24, 230]], "#f2c48a", 0);
  p.ell(112, 120, 52, 58, "#c99067", 7); p.ell(112, 82, 56, 26, "#2a2020", 0, 180, 360);
  p.dot(94, 120, 7, INK); p.dot(130, 120, 7, INK); p.stroke([[92, 142], [112, 154], [132, 142]], 6, INK);
  p.poly([[60, 230], [164, 230], [150, 182], [74, 182]], "#3a64b8", 6);
  p.line([[170, 170], [176, 126]], "#c99067", 12); p.line([[184, 172], [194, 130]], "#c99067", 12);
};
/** a tyre with its hub (256 x 256) */
const fxTyre = (p: Pen) => { p.ell(128, 128, 112, 112, "#2b2f3a", 9); p.ell(128, 128, 52, 52, "#d9d6cf", 7); for (let i = 0; i < 5; i++) { const a = i * 1.2566; p.dot(128 + 30 * Math.cos(a), 128 + 30 * Math.sin(a), 7, "#5a5866"); } };
/** an empty open floppy box (256 x 176) */
const fxEmptyBox = (p: Pen) => {
  p.poly([[20, 60], [236, 60], [216, 168], [40, 168]], "#3a64b8", 8);
  p.poly([[34, 66], [222, 66], [206, 140], [50, 140]], "#1e2a52", 0);
  p.poly([[20, 60], [44, 14], [212, 14], [236, 60]], "#5a86d8", 8);
};

// ---------------- the control room ----------------
const ctrl = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => {
  out.places.push(person(cam, who(1, CTRL), YT[0], 0.33, YT[2], { side: false, mirror: false }, { mode: "sit", look: 0.4, phones: PHONES, ...fo, blink: lidAt(t, 1) }, {}));
};
const mate = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => {
  out.places.push(person(cam, who(2, MATEO), MATE[0], 0, MATE[2], { side: false, mirror: false }, { mode: "stand", look: -0.5, ...fo, blink: lidAt(t, 2) }, {}));
  blob(out, MATE[0], 0, MATE[2], 1, 0.9);
};
/** the controller holding a floppy up by his face (right hand), returns nothing; disk drawn as a card at the hand */
const holdDisk = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts, k = 1, dusty = false, hand: [number, number] = [405, 580]) => {
  const hx = 360 + (hand[0] - 360) * k, hy = 700 + (hand[1] - 700) * k;
  ctrl(cam, out, t, { ...fo, reach: [fo.reach?.[0] ?? null, [hx, hy]] });
  const [x, y, z] = onCard(cam, YT[0], 0.33, YT[2], hx + 10, hy - 60, 0.1);
  fx1(out, dusty ? "flopD" : "flop", 256, 256, (p) => fxFloppy(p, dusty), x, y, z, 0.22, 0.22, 0.08 * Math.sin(t * 2));
};
const desk = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 3) {
    // deadpan: "Yes." holds it up; "Those floppy disks." a little waggle toward us
    const up = smooth((t - (W.yes - 0.25)) / 0.3), wag = at(t, W.floppy2) ? Math.sin((t - W.floppy2) * 14) * Math.max(0, 1 - (t - W.floppy2) * 1.5) : 0;
    holdDisk(cam, out, t, { expr: "smile_closed", look: 0, headTilt: 3 + 4 * wag }, up);
  }
  if (id === 5) {
    ctrl(cam, out, t, { expr: at(t, W.duty) ? "smile" : "neutral", look: at(t, W.duty) ? 0 : 0.4 });
    mate(cam, out, t, { expr: "neutral", look: -0.3 });
    // the side terminals pop on with a little burst each on "four"
    TERMS.forEach(([x], i) => { const d = t - (W.four + 0.12 * i); if (d > 0 && d < 0.3) fx1(out, `tp${Math.floor(d * 26)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), "#c8ffd0", 8, 30, 160), x, 1.06, MON[2] + 0.12, 0.6, 0.6); });
  }
  if (id === 6) {
    // the left terminal breaks: smoke + stars; then the parcel drops onto the desk with a bounce and a puff
    ctrl(cam, out, t, { expr: at(t, W.ebay) ? "grin" : at(t, W.breaks) ? "shock" : "neutral", look: at(t, W.spare) ? -0.2 : -0.6 });
    const [tx] = TERMS[0];
    if (at(t, W.breaks)) {
      const d = t - W.breaks;
      for (let i = 0; i < 4; i++) { const u = ((d * 0.7 + i / 4) % 1); fx1(out, `smk${Math.floor(u * 12)}`, 256, 256, (p) => fxSmoke(p, u), tx - 0.1 + 0.07 * i, 1.32 + u * 0.7, MON[2] - 0.1, 0.32 + u * 0.4, 0.32 + u * 0.4, u * 2); }
    }
    const dropT = W.ebay - 0.35, u = clamp01((t - dropT) / 0.32);
    if (t > dropT) {
      const bounce = u < 1 ? 1.4 * (1 - u * u) : 0.06 * Math.max(0, Math.sin((t - dropT - 0.32) * 18)) * Math.exp(-(t - dropT - 0.32) * 5);
      fx1(out, "parcel", 256, 224, fxParcel, DESK - 0.85, 0.75 + 0.16 + bounce, -0.95, 0.38, 0.33);
      const d = t - (dropT + 0.32);
      if (d > 0 && d < 0.5) fx1(out, `pf${Math.floor(d * 24)}`, 300, 300, (p) => fxPuff(p, d * 2), DESK - 0.85, 0.82, -0.85, 0.7, 0.7, 0, true);
    }
  }
  if (id === 7) {
    // the controller hands strips across the desk to the colleague, one per flight; they pile up in her hands
    ctrl(cam, out, t, { expr: "smile", look: 0.6, reach: [null, [470, 640]] });
    mate(cam, out, t, { expr: at(t, W.every) ? "nervous" : "smile", look: -0.6, reach: [[150, 650], [200, 660]] });
    const t0 = W.hand - 0.2;
    for (let i = 0; i < 9; i++) {
      const s0 = t0 + i * 0.36, u = clamp01((t - s0) / 0.5);
      if (t < s0) continue;
      const a = onCard(cam, YT[0], 0.33, YT[2], 480, 620, 0.15), b = onCard(cam, MATE[0], 0, MATE[2], 170, 640 - i * 14, 0.12);
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u + 0.25 * Math.sin(u * Math.PI), z = a[2] + (b[2] - a[2]) * u;
      fx1(out, `strip${i % 3}`, 256, 64, (p) => fxStrip(p, i), x, y, z, 0.3, 0.075, (1 - u) * 0.6 * Math.sin(i * 2.1) + 0.05 * Math.sin(i));
    }
  }
  if (id === 9) {
    // phone up for a selfie, the disk in the other hand; on "selfie" the photo pops out, far bigger than the disk - burst
    const sf = at(t, W.selfie);
    ctrl(cam, out, t, { expr: sf ? "shock" : "grin", look: sf ? -0.3 : 0.3, reach: [[205, 640], [400, 600]], headTilt: sf ? -5 : 4 });
    const [lx, ly, lz] = onCard(cam, YT[0], 0.33, YT[2], 195, 580, 0.12);
    const shake = sf ? 0.03 * Math.sin((t - W.selfie) * 40) * Math.max(0, 1 - (t - W.selfie) * 2) : 0;
    fx1(out, "flop", 256, 256, (p) => fxFloppy(p), lx + shake, ly, lz, 0.17, 0.17, 0.1);
    const [rx, ry, rz] = onCard(cam, YT[0], 0.33, YT[2], 410, 540, 0.12);
    fx1(out, "phoneC", 128, 224, (p) => { p.poly(rrect(10, 10, 118, 214, 16), "#2b2f3a", 7); p.poly(rrect(20, 26, 108, 190, 6), "#5ab0f0", 0); }, rx, ry, rz, 0.08, 0.14);
    if (at(t, W.single)) {
      const k = smooth((t - (W.single - 0.05)) / 0.35);
      fx1(out, "photo", 224, 288, fxPhoto, rx + 0.04 * k, ry + 0.1 + 0.12 * k, rz + 0.02, 0.08 + 0.17 * k, (0.08 + 0.17 * k) * 1.28, -0.1 * k);
    }
    if (sf) { const d = t - W.selfie; if (d < 0.45) fx1(out, `sfb${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.6), "#fff3b0", 10, 30, 180), lx, ly, lz + 0.02, 0.5, 0.5); }
  }
  if (id === 10) {
    // a proud pat on the old terminal: "still work" (the terminal hums: green glow pulses)
    const pat = at(t, W.machines) ? Math.abs(Math.sin((t - W.machines) * 7)) : 0;
    ctrl(cam, out, t, { expr: at(t, W.work) ? "smile_closed" : "smile", look: 0.7, reach: [null, [560, 560 + 40 * pat]] });
  }
  if (id === 11) {
    // the last disk, dusty, out of an empty box; a sad little dust puff
    const lift = smooth((t - (W.unluckily - 0.1)) / 0.5);
    holdDisk(cam, out, t, { expr: at(t, W.nobody) ? "nervous" : "neutral", look: 0.1, headTilt: at(t, W.anymore) ? -6 : 0 }, lift, true, [420, 580]);
    fx1(out, "ebox", 256, 176, fxEmptyBox, DESK - 0.12, 0.84, -0.85, 0.3, 0.2);
    for (let i = 0; i < 6; i++) { const [x, y, z] = onCard(cam, YT[0], 0.33, YT[2], 380 + 60 * Math.sin(i * 2.3), 560 - ((t * 60 + i * 40) % 200), 0.12); fx1(out, "dust", 64, 64, (p) => p.dot(32, 32, 14, "rgba(225,215,195,0.9)"), x, y, z, 0.02, 0.02); }
    const d = t - (W.anymore - 0.05);
    if (d > 0 && d < 0.6) { const [x, y, z] = onCard(cam, YT[0], 0.33, YT[2], 440, 520, 0.14); fx1(out, `dp${Math.floor(d * 20)}`, 300, 300, (p) => fxPuff(p, d / 0.6), x, y, z, 0.35, 0.35, 0, true); }
  }
  if (id === 15) {
    // "in": the disk goes over his shoulder; big laugh
    const toss = at(t, W.inn - 0.1) ? clamp01((t - (W.inn - 0.1)) / 0.45) : 0;
    ctrl(cam, out, t, { expr: toss > 0 ? "laugh" : "grin", look: 0.1, reach: [null, toss > 0 ? [380 - 120 * toss, 420 - 60 * toss] : [440, 640]] });
    const [x, y, z] = onCard(cam, YT[0], 0.33, YT[2], 450 - 380 * toss, 600 - 400 * Math.sin(toss * Math.PI) + 250 * toss, 0.1 - 0.4 * toss);
    if (toss < 0.98) fx1(out, "flop", 256, 256, (p) => fxFloppy(p), x, y, z, 0.18, 0.18, toss * 9);
  }
  if (id === 20 && t >= 67.95 - 0.05) ctrl(cam, out, t, { expr: "smile_closed", look: 0.5, headTilt: 5 * smooth((t - 68.1) / 0.4) });
};

// ---------------- the highway ----------------
const road = (cam: CamInfo, out: Stage, t: number) => {
  const tx = truckX(t), z = TRUCK_Z;
  // three passengers riding in the bed (seated), waving on "full of passengers"
  RIDERS.forEach((o, i) => {
    const wave = at(t, W.full) ? Math.sin(t * 9 + i) : 0;
    out.places.push(person(cam, who(40 + i, o), tx - 1.6 + i * 0.55, 0.62 + 0.012 * Math.sin(t * 9 + i), z + 0.25 - 0.2 * i, { side: false, mirror: false },
      { mode: "sit", expr: at(t, W.full) ? "laugh" : at(t, W.changing) ? "nervous" : "smile", look: 0.3 * (i - 1), blink: lidAt(t, 40 + i), reach: at(t, W.full) ? [null, [470, 380 + 40 * wave]] : undefined }, {}, 0.95));
  });
  // two mechanics jogging alongside on the near side; one carries the new tyre, one yanks the old one off
  const near = z + 1.25;
  for (let i = 0; i < 2; i++) {
    const x = tx - 1.25 + (i ? -0.95 : 1.55), ph = t * 2.6 + i * 0.5;
    out.places.push(person(cam, who(50 + i, i ? MECH2 : MECH), x, 0, near + 0.15 * i, { side: true, mirror: false }, {}, { mode: "march", phase: ph, stride: 1.4, expr: at(t, W.tyres) ? "grin" : "nervous", blink: lidAt(t, 50 + i) }));
    blob(out, x, 0, near + 0.15 * i, 1, 0.9);
  }
  // the old tyre pops off and bounces away behind; the new one rides in the hands of the rear mechanic then snaps on
  const off = t - (W.changing + 0.15);
  if (off > 0 && off < 1.6) fx1(out, "tyreOld", 256, 256, fxTyre, tx - 1.25 - off * 5.5, 0.4 + Math.abs(Math.sin(off * 6)) * 0.5 * Math.exp(-off), near + 0.6 + off * 0.8, 0.8, 0.8, -off * 8);
  const on = t < W.driving - 0.3, sk = smooth((t - (W.driving - 0.75)) / 0.45);
  if (on) fx1(out, "tyreNew", 256, 256, fxTyre, tx - 1.25 - 0.75 + 0.75 * sk, 0.7 - 0.3 * sk, near + 0.3 - 0.45 * sk, 0.78, 0.78, -t * 3);
  // speed lines behind the truck
  for (let i = 0; i < 4; i++) fx1(out, "spd", 256, 32, (p) => p.stroke([[10, 16], [246, 16]], 10, "rgba(255,255,255,0.75)"), tx - 3.2 - 0.6 * i - ((t * 6 + i * 0.7) % 1.2), 0.5 + 0.35 * i, z + 0.9, 1.0, 0.05);
  if (t > W.driving - 0.35 && t < W.driving + 0.05) { const d = t - (W.driving - 0.35); fx1(out, `tb${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.6), "#fff3b0", 8, 30, 160), tx - 1.25, 0.5, z + 1.1, 1.0, 1.0); }
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "desk") desk(cam, out, id, t);
  else if (s.place === "road") road(cam, out, t);
  return out;
};
export { FPS };
