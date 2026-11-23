// The trolley short: our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, carPt, carPose, LANE_N, SEAT_DRV, SCREEN, CAM_X, CAM_Z, PH_X, PH_Z, PH_TIME, PASSES, PARK_X, EASEL, V3 } from "./story";
import { fxBurst, fxPuff, fxRing } from "./toon";
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

// ================= the reality short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const DRV: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#3a2a22", skin: "#ecd0b6" };
const PED1: Outfit = { jacket: "#e8883a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067", dress: "#e8883a" };
const PED2: Outfit = { jacket: "#3a64b8", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#f2c43a", skin: "#f5c9a0" };
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
/** a magnifying glass (256 x 256) */
const fxLoupe = (p: Pen) => { p.stroke([[160, 160], [236, 236]], 22, "#7a5a40"); p.ell(110, 110, 82, 82, "rgba(200,235,255,0.35)", 12); p.stroke([[70, 80], [100, 60]], 8, "#ffffff"); };
/** a question mark (256 x 256), white with ink outline */
const fxQuestion = (p: Pen, col = "#ffd84a") => {
  const pts: P2[] = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (1.05 - 1.45 * i / 16); pts.push([128 + 62 * Math.cos(a), 88 - 58 * Math.sin(a)]); }
  pts.push([128, 150], [128, 170]);
  p.stroke(pts, 46, INK); p.stroke(pts, 28, col); p.dot(128, 218, 26, INK); p.dot(128, 218, 17, col);
};
/** the update cloud (512 x 384): a puffy cloud with a big download arrow */
const fxUpdate = (p: Pen) => {
  for (const [x, y, r] of [[160, 220, 95], [260, 170, 120], [360, 215, 100], [250, 260, 110]] as const) p.ell(x, y, r, r * 0.85, "#ffffff", 10);
  p.ell(256, 250, 180, 70, "#ffffff", 0);
  p.poly([[226, 120], [286, 120], [286, 220], [330, 220], [256, 300], [182, 220], [226, 220]], "#3aa0ff", 10);
};
/** a twinkle star (256 x 256) */
const fxTwinkle = (p: Pen, col = "#fff3b0") => p.poly([[128, 10], [150, 106], [246, 128], [150, 150], [128, 246], [106, 150], [10, 128], [106, 106]], col, 8);
/** a "missing texture" gap tile (256 x 256): grey/white checker with an ink frame */
const fxGap = (p: Pen) => {
  p.poly(rrect(20, 20, 236, 236, 10), "#e9ecf3", 0);
  for (let i = 0; i < 12; i++) { const a = i / 12, b = (i + 0.55) / 12; const seg = (u: number): P2 => { const k = u * 4, s = Math.floor(k), f = k - s; return [[20 + 216 * f, 20], [236, 20 + 216 * f], [236 - 216 * f, 236], [20, 236 - 216 * f]][s % 4] as P2; }; p.stroke([seg(a), seg(Math.min(b, Math.floor(a * 4 + 1) / 4 - 0.001))], 10, "#5a6278"); }
};
/** speed lines (512 x 128): horizontal streaks trailing to the left */
const fxStreaks = (p: Pen) => { for (let i = 0; i < 5; i++) { const y = 18 + i * 23, x0 = 20 + (i % 2) * 70, pts: P2[] = [[x0, y], [x0 + 300 - (i % 3) * 60, y]]; p.stroke(pts, 15, INK); p.stroke(pts, 9, "#ffffff"); } };
/** the speed camera's face (300 x 200): two eyes + mouth, drawn to sit on the yellow box */
type CamFace = "calm" | "smile" | "cross" | "shock";
const fxCamFace = (p: Pen, e: CamFace, blink: boolean) => {
  for (const x of [95, 205]) {
    if (blink) { p.stroke([[x - 30, 80], [x + 30, 80]], 10); continue; }
    const ry = e === "shock" ? 44 : 34;
    p.ell(x, 80, 30, ry, "#ffffff", 9);
    p.dot(x + (e === "cross" ? 0 : 6), e === "shock" ? 80 : 86, e === "shock" ? 9 : 13);
  }
  if (e === "cross") { p.stroke([[60, 30], [125, 48]], 12); p.stroke([[240, 30], [175, 48]], 12); }
  if (e === "shock") { p.stroke([[62, 22], [122, 26]], 10); p.stroke([[178, 26], [238, 22]], 10); }
  p.ell(150, 128, 20, 20, "#2b2d36", 7); p.dot(144, 122, 6, "#9fd8ff");
  if (e === "smile") p.arc(150, 140, 62, 40, 15, 165, 12);
  else if (e === "cross") p.arc(150, 172, 46, 26, 200, 340, 11);
  else if (e === "shock") p.ell(150, 160, 22, 28, "#5a2030", 9);
  else p.stroke([[118, 150], [182, 150]], 10);
};

// ---------------- helpers ----------------
/** the driver in the car (seated at the wheel) */
const driver = (cam: CamInfo, out: Stage, id: number, t: number, fo: FrontOpts, sc = 0.95) => {
  const [x, y, z] = carPt(id, t, SEAT_DRV[0], SEAT_DRV[1], SEAT_DRV[2]);
  out.places.push(person(cam, who(1, DRV), x, y, z, { side: false, mirror: false }, { mode: "sit", blink: lidAt(t, 1), ...fo }, {}, sc));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, t: number, fo: FrontOpts, y = 0.15) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {}));
  blob(out, x, y, z, 1, 0.9);
};
const burstAt = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d > 0 && d < 0.4) fx1(out, `${key}${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.8), col, 10, 30, 180), x, y, z, s, s);
};
/** twinkles popping around a point from t0 for dur */
const twinkles = (out: Stage, key: string, t: number, t0: number, dur: number, x: number, y: number, z: number, r: number, s: number, n = 6, col = "#fff3b0") => {
  for (let i = 0; i < n; i++) {
    const ti = t0 + (dur * i) / n, d = t - ti;
    if (d < 0 || d > 0.5) continue;
    const a = i * 2.4, k = Math.sin((d / 0.5) * Math.PI);
    fx1(out, `${key}tw`, 256, 256, (p) => fxTwinkle(p, col), x + r * Math.cos(a), y + r * 0.7 * Math.sin(a * 1.3), z + r * 0.5 * Math.sin(a), s * k, s * k, d * 3);
  }
};
/** the speed camera face card, nudged off the box toward the camera */
const camFace = (cam: CamInfo, out: Stage, t: number, e: CamFace) => {
  const bx = CAM_X - 0.05, by = 3.84, bz = CAM_Z - 1.15;
  const dx = cam.pos.x - bx, dy = cam.pos.y - by, dz = cam.pos.z - bz, n = Math.hypot(dx, dy, dz);
  const k = 0.5 / n, blink = lidAt(t, 7) > 0.6;
  fx1(out, `camface|${e}|${blink}`, 300, 200, (p) => fxCamFace(p, e, blink), bx + dx * k, by + dy * k - 0.02, bz + dz * k, 1.1, 0.73);
};

// ---------------- shots ----------------
const shots = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    // hook: the driver gasps at the game-view screen, then laughs, hands up (it's driving itself)
    const v = at(t, W.video);
    driver(cam, out, 1, t, { expr: v ? "laugh" : "shock", look: 0.7, headTilt: v ? 6 : -3,
      reach: undefined }, 1.0);
    const [sx, sy, sz] = carPt(1, t, SCREEN[0] - 0.05, SCREEN[1] + 0.05, SCREEN[2] + 0.05);
    twinkles(out, "h1", t, 0.0, 3.6, sx, sy, sz, 0.32, 0.12, 9);
    twinkles(out, "h2", t, W.game - 0.1, 0.4, sx, sy, sz, 0.28, 0.16, 5, "#ffffff");
  }
  if (id === 2) {
    // the update cloud drops onto the car; sparkles on "version fifteen"
    for (const [i, x, z, o] of [[11, -66, 2.6, PED2], [12, -60, -9.0, PED1], [13, -52, 3.0, PED1]] as const) standing(cam, out, i, o, x, z, t, { expr: "smile", look: -0.4 });
    const [cx, cy, cz] = carPt(2, t, 0, 1.6, 0);
    const u = clamp01((t - 5.7) / 0.9);
    if (t > 5.4 && t < 6.75) fx1(out, "upd", 512, 384, fxUpdate, cx, cy + 0.5 + 6 * (1 - smooth(u)), cz, 4.4 * (1 - 0.6 * clamp01((t - 6.45) / 0.3)), 3.3 * (1 - 0.6 * clamp01((t - 6.45) / 0.3)));
    burstAt(out, "ub", t, 6.65, cx, cy, cz, 2.6, "#bfe8ff");
    twinkles(out, "u15", t, W.fifteen - 0.1, 0.6, cx, cy + 1.1, cz, 1.8, 0.7, 8);
    driver(cam, out, 2, t, { expr: at(t, 6.7) ? "grin" : "smile", look: 0 });
  }
  if (id === 3) {
    const [sx, sy, sz] = carPt(3, t, SCREEN[0] - 0.03, SCREEN[1], SCREEN[2]);
    twinkles(out, "s3", t, W.screen - 0.1, 1.6, sx, sy, sz, 0.22, 0.06, 6);
  }
  if (id === 4) {
    driver(cam, out, 4, t, { expr: "grin", look: 0.4 });
    // the gaps: grey checker tiles on the facades ahead dissolve one by one from "AI"
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, x0 = -40 + i * 4.4, y = 2.4 + ((i * 3) % 4) * 1.6, z = side > 0 ? 4.35 : -11.35;
      const td = W.ai + 0.05 + i * 0.12;
      if (t < td) fx1(out, "gap", 256, 256, fxGap, x0, y, z, 2.3, 2.3);
      burstAt(out, `gb${i}`, t, td, x0, y, z, 2.6);
    }
  }
  if (id === 5) {
    // the pothole: a scan ring on it when spotted, the car eases around it
    const d = t - (W.potholes - 0.15);
    if (d > 0 && d < 0.9) fx1(out, `ring${Math.floor(d * 20)}`, 600, 600, (p) => fxRing(p, Math.min(1, d / 0.9)), PH_X, 0.05, PH_Z, 2.2, 2.2);
    if (d > 0 && d < 0.9) out.fx[out.fx.length - 1].flat = true;
    driver(cam, out, 5, t, { expr: at(t, PH_TIME + 0.1) ? "relief" : "nervous", look: 0.3 });
  }
  if (id === 6) {
    // the speed camera smiles as the car slows politely
    const sl = at(t, W.slows);
    camFace(cam, out, t, sl ? "smile" : "calm");
    if (sl) twinkles(out, "c6", t, W.slows + 0.2, 1.4, CAM_X - 0.05, 4.2, CAM_Z - 1.15, 0.6, 0.25, 5);
    driver(cam, out, 6, t, { expr: "smile", look: 0.2 });
  }
  if (id === 7) {
    // the driver's sly grin
    driver(cam, out, 7, t, { expr: at(t, W.override) ? "grin" : "smile", look: at(t, W.override) ? -0.8 : 0, headTilt: at(t, W.override) ? -10 : 0 }, 1.0);
  }
  if (id === 8) {
    // whoosh, whoosh: the camera frowns ... the third time the car just cruises by: the camera's jaw drops
    const p3 = PASSES[2].tc;
    const face: CamFace = t >= p3 - 0.15 ? "shock" : t >= PASSES[0].tc - 0.1 ? "cross" : "smile";
    camFace(cam, out, t, face);
    for (const [k, ps] of PASSES.entries()) {
      const d = t - ps.tc;
      if (d > -0.6 && d < 0.6 && k < 2) { const [x, y, z] = carPt(8, t, -3.3, 0.9, 0); fx1(out, "streak", 512, 128, fxStreaks, x, y, z, 2.4, 0.6); }
    }
    if (Math.abs(carPose(8, t).x - CAM_X) < 30) driver(cam, out, 8, t, { expr: t > p3 - 1.2 ? "whistle" : "grin", look: 0.3 });
    for (const ps of PASSES.slice(0, 2)) { const d = t - ps.tc - 0.1; if (d > 0 && d < 1.0) for (let i = 0; i < 3; i++) fx1(out, `puff${Math.floor(d * 12)}`, 300, 300, (p) => fxPuff(p, d), CAM_X + 2.5 + i * 1.6 + d * 1.5, 0.45 + 0.15 * i, -1.75 + 0.5 * (i - 1), 1.6, 1.6); }
    if (t > p3) twinkles(out, "sw", t, p3 + 0.1, 1.0, CAM_X + 0.5, 4.3, CAM_Z - 1.0, 0.7, 0.18, 3, "#bfe8ff");
  }
  if (id === 9) {
    // the chart pops up on "twenty-five" ... then the driver squints at it: not a single number
    const tw = at(t, W.twentyfive), bu = at(t, W.but);
    const x = EASEL[0] + 0.25, z = EASEL[2] - 0.85;
    standing(cam, out, 1, DRV, x, z, t, {
      expr: bu ? (at(t, W.numbers) ? "nervous" : "stern") : tw ? "laugh" : "smile", look: bu ? 0.8 : 0.4, headTilt: bu ? 8 : tw ? -5 : 0,
      reach: bu ? [null, [450, 470]] : tw ? [[170, 330], [510, 400]] : undefined,
    });
    burstAt(out, "cb", t, W.twentyfive - 0.05, EASEL[0] + 0.05, 1.5, EASEL[2] + 0.1, 1.9);
    if (tw && !bu) twinkles(out, "c9", t, W.twentyfive, 1.6, EASEL[0], 1.6, EASEL[2], 0.85, 0.25, 7);
    void fxLoupe;
    const dq = t - (W.numbers - 0.05);
    if (dq > 0) for (let i = 0; i < 3; i++) { const di = dq - i * 0.12; if (di <= 0) continue; const k = Math.min(1, di * 5); const [qx, qy, qz] = onCard(cam, x, 0.15, z, 210 + i * 110, 70 - (i % 2) * 50, 0.2); fx1(out, "q", 256, 256, (p) => fxQuestion(p), qx, qy + 0.05 * Math.sin(t * 6 + i), qz, 0.3 * k, 0.3 * k, (i - 1) * 0.25); }
  }
  if (id === 10) {
    // would you trust it? ... send this to the friend who drives like it's a game (wave)
    const sd = at(t, W.send), fr = at(t, W.friend);
    driver(cam, out, 10, t, {
      expr: fr ? "laugh" : sd ? "grin" : at(t, W.trust) ? "smile" : "grin", look: 0, headTilt: at(t, W.trust) && !sd ? -6 : fr ? 5 : 0,
    }, 1.0);
    const dq = t - (W.trust - 0.05);
    if (dq > 0 && t < W.send) { const [hx, hy, hz] = carPt(10, t, SEAT_DRV[0], SEAT_DRV[1] + 1.38, SEAT_DRV[2] - 0.1); const k = Math.min(1, dq * 5); fx1(out, "q10", 256, 256, (p) => fxQuestion(p), hx, hy + 0.03 * Math.sin(t * 6), hz - 0.05, 0.28 * k, 0.28 * k, 0.2); }
  }
};
void clamp01; void carPose; void fxPuff; void LANE_N; void PARK_X;

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  shots(cam, out, id, t);
  return out;
};
export { FPS };
