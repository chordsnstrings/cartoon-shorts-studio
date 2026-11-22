// The trolley short: our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, V3, robotAt, HOOK_SNAP, TRAPS, SIGN, DIG, SNEAK, ENG_DOOR, NORTH } from "./story";
import { drawRobot, RobotPose } from "./robot";
import { drawIcon } from "./build";
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

// ================= the mirror short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
/** engineer A: white lab coat, teal cap; engineer B: mustard jacket, dark curly hair */
const ENGA: Outfit = { jacket: "#f4f1ea", pants: "#2b3550", boots: "#2b2630", hat: "cap", cap: "#2fa39a", skin: "#c99067", buttons: "#2fa39a" };
const ENGB: Outfit = { jacket: "#f2b33a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a1a14", skin: "#f5c9a0", dress: "#f2b33a" };
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.06, scale = 1): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * scale, v = (975 - cy) * SU * scale;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
type P2 = [number, number];
const ROBOT_S = 1.15;
/** the robot shopper card (design 600 x 1000, ~1.3 m x ROBOT_S) */
const robot = (cam: CamInfo, out: Stage, x: number, z: number, y: number, P: RobotPose, t: number, shadow = true) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.8, z)) / ROBOT_S, [w, h, k] = tier(d);
  const pose: RobotPose = { apron: false, light: light2D(cam, false), blink: lidAt(t, 77) > 0.6 ? 1 : 0, ...P };
  out.places.push({ key: "robot|" + fkey(pose), x, y, z, scale: ROBOT_S, size: [w, h, k], draw: (p) => drawRobot(p, pose) });
  if (shadow) blob(out, x, Math.max(0, y), z, 0.9, 0.9);
};
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

/** a yellow sticky note with scribbled lines (256 x 256): "secret orders in the text" - no letters */
const fxNote = (p: Pen) => {
  p.poly([[30, 34], [222, 26], [228, 214], [36, 226]], "#ffe66b", 7);
  for (let i = 0; i < 4; i++) { const y = 74 + i * 36, pts: P2[] = []; for (let j = 0; j <= 10; j++) pts.push([58 + j * 14, y + (j % 2 ? -6 : 6)]); p.stroke(pts, 7, "#d8483c"); }
};
/** a framed picture (256 x 256) whose painting is a tiny mousetrap with a gift on it */
const fxFrame = (p: Pen) => {
  p.poly([[16, 20], [240, 20], [240, 236], [16, 236]], "#c48a3a", 8);
  p.poly([[44, 48], [212, 48], [212, 208], [44, 208]], "#bfe0f4", 6);
  p.poly([[70, 170], [190, 170], [190, 186], [70, 186]], "#e3b36e", 5);
  p.stroke([[130, 170], [130, 120], [186, 120]], 6, "#5a6270");
  p.poly([[82, 140], [112, 140], [112, 170], [82, 170]], "#d84a7a", 5); p.stroke([[97, 140], [97, 170]], 5, "#ffd84a");
};
/** the invisible label: a faint dashed tag shape with a ghostly sparkle (256 x 256, drawn see-through) */
const fxTag = (p: Pen, a: number) => {
  const g = p.g; g.save(); g.globalAlpha = a; g.setLineDash([16, 12]); g.lineWidth = 9; g.strokeStyle = "#ffffff";
  g.beginPath(); g.moveTo(40, 80); g.lineTo(170, 80); g.lineTo(220, 128); g.lineTo(170, 176); g.lineTo(40, 176); g.closePath(); g.stroke();
  g.setLineDash([]); g.beginPath(); g.arc(178, 128, 12, 0, 6.283); g.stroke();
  g.globalAlpha = a * 0.25; g.fillStyle = "#e8f8ff"; g.fill(); g.restore();
};
/** an icon bubble (256 x 256) popping over a shop front: white disc + the shop's pictogram */
const fxIcon = (p: Pen, kind: "shop" | "pay" | "social", col: string) => {
  p.ell(128, 120, 100, 100, "#fbf6ea", 9); p.poly([[100, 210], [128, 250], [150, 212]], "#fbf6ea", 0);
  p.stroke([[100, 214], [128, 248], [152, 214]], 9, INK);
  drawIcon(p.g, kind, 128, 122, 120, col);
};
/** a butterfly net (256 x 512): handle from the bottom, a mesh hoop on top */
const fxNet = (p: Pen) => {
  p.stroke([[128, 500], [128, 210]], 22, INK); p.stroke([[128, 500], [128, 210]], 12, "#c48a3a");
  p.ell(128, 130, 92, 82, "rgba(255,255,255,0.35)", 0); p.ell(128, 130, 92, 82, null, 11);
  for (let i = -2; i <= 2; i++) { p.stroke([[128 + i * 34, 56], [128 + i * 34, 206]], 3, "rgba(255,255,255,0.8)"); p.stroke([[40, 130 + i * 28], [216, 130 + i * 28]], 3, "rgba(255,255,255,0.8)"); }
};
/** a garden spade (256 x 512): handle top, blade at the bottom */
const fxSpade = (p: Pen) => {
  p.stroke([[128, 30], [128, 360]], 22, INK); p.stroke([[128, 30], [128, 360]], 12, "#c48a3a");
  p.poly([[92, 22], [164, 22], [164, 48], [92, 48]], "#c48a3a", 7);
  p.poly([[84, 350], [172, 350], [168, 440], [128, 492], [88, 440]], "#aab3bd", 8);
};
/** a dark round hole in the ground (256 x 256, flat) with a dirt rim */
const fxHole = (p: Pen, u: number) => {
  p.ell(128, 128, 110, 104, "#a07850", 0);
  p.ell(128, 128, 60 + 36 * u, 56 + 34 * u, "#241726", 6);
};
/** a clod of dirt (128 x 128) */
const fxClod = (p: Pen, k: number) => { p.ell(64, 64, 34 + (k % 3) * 6, 26 + (k % 2) * 6, "#a07850", 6); p.ell(54, 56, 10, 7, "#c49a6a", 0); };
/** a clipboard (256 x 256) */
const fxClip = (p: Pen) => { p.poly([[50, 30], [206, 30], [206, 236], [50, 236]], "#c48a3a", 7); p.poly([[70, 60], [186, 60], [186, 220], [70, 220]], "#fbf6ea", 5); p.poly([[100, 18], [156, 18], [156, 46], [100, 46]], "#8a8f99", 5); for (let i = 0; i < 4; i++) p.stroke([[86, 92 + i * 32], [170, 92 + i * 32]], 6, "#8a9ccc"); };

// ---------------- shots ----------------
const RUB: [P2, P2] = [[268, 470], [332, 476]];          // rubbing hands at the chest
const RUB2: [P2, P2] = [[280, 476], [320, 470]];
const WAVE_IN: [P2, P2] = [[180, 520], [500, 210]];
const ARMS_UP: [P2, P2] = [[120, 170], [480, 170]];
const PALM: [P2, P2] = [[240, 560], [330, 205]];          // facepalm: one hand at the forehead
const SCRATCH: [P2, P2] = [[240, 560], [372, 140]];       // scratching the top of the head
const HIP: [P2, P2] = [[205, 600], [395, 600]];           // hands low (carrying)
const tip = (t: number, t0: number, t1: number, a: number, b: number) => { const u = smooth((t - t0) / (t1 - t0)); return { x: a + (b - a) * u, hop: u > 0 && u < 1 ? 0.09 * Math.abs(Math.sin(u * Math.PI * 5)) : 0 }; };
const step = (t: number, moving: boolean) => (moving ? (Math.sin(t * 13) > 0 ? 1 : -1) : 0);
const icon = (out: Stage, t: number, t0: number, kind: "shop" | "pay" | "social", col: string, x: number, y: number, z: number, s: number) => {
  const d = t - t0;
  if (d < 0) return;
  const k = d < 0.25 ? 0.3 + 0.7 * easeBack(d / 0.25) : 1;
  fx1(out, `icon${kind}`, 256, 256, (p) => fxIcon(p, kind, col), x, y + 0.3 * Math.sin(Math.min(1, d * 4) * Math.PI) * 0.3, z, s * k, s * k);
};
const easeBack = (u: number) => { const c = 1.9; const x = clamp01(u) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const burstAt = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d > 0 && d < 0.4) fx1(out, `${key}${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.8), col, 10, 30, 180), x, y, z, s, s);
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, t: number, fo: FrontOpts, y = 0.06, shadow = true) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {}));
  if (shadow) blob(out, x, Math.max(0, y), z, 1, 0.9);
};

const shots = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    // hook: the robot leans for the gift on the giant trap, hops back just in time, the bar bangs shut on nothing
    const r = robotAt(1, t), back = at(t, HOOK_SNAP - 0.2), smug = at(t, HOOK_SNAP + 0.45), wag = at(t, W.trick);
    const reach = Math.min(1, 0.75 + t * 0.3);
    robot(cam, out, r.x, r.z, 0.01 + r.hop, back
      ? (smug ? { face: "smug", la: wag ? 20 : 25, le: 115, ra: wag ? 160 : 30, re: wag ? 25 + 18 * Math.sin(t * 22) : 110, basket: wag ? undefined : "R", head: wag ? -6 : 4, sway: 0 }
              : { face: "wide", la: 120, le: 10, ra: 130, re: 10, basket: "R", sway: 6 })
      : { face: "star", la: 50 + 30 * reach, le: 15, ra: 20, re: 30, basket: "R", sway: -9 * reach, head: -8, step: 0 }, t);
    const sh = at(t, HOOK_SNAP), palm = at(t, W.trick - 0.3);
    standing(cam, out, 1, ENGA, ENG_DOOR[0], ENG_DOOR[1], t, { expr: palm ? "pained" : sh ? "shock" : "laugh", look: 0.6, headTilt: palm ? -6 : 8, reach: palm ? PALM : sh ? ARMS_UP : (Math.floor(t * 8) % 2 ? RUB : RUB2) });
    const T0 = TRAPS[0];
    burstAt(out, "snap", t, HOOK_SNAP + 0.08, T0.x - 0.3, 0.45, T0.z + 0.2, 1.5);
    if (sh && t < HOOK_SNAP + 0.6) { const k = Math.floor(t * 12); fx1(out, `shk${k % 2}`, 256, 256, (p) => fxShake(p, k), T0.x + 0.9, 0.55, T0.z + 0.3, 0.5, 0.5); }
  }
  if (id === 2) {
    // the fake web from above: icons pop over a shop, a checkout and a social front; the two engineers carry a trap down the street
    icon(out, t, W.shops - 0.07, "shop", "#e8483c", -5.0, 9.2, -4.2, 2.6);
    icon(out, t, W.checkouts - 0.07, "pay", "#2f8f7a", -11.5, 8.6, -4.2, 2.6);
    icon(out, t, W.social - 0.07, "social", "#d84a7a", 7.4, 8.8, -4.2, 2.6);
    const x = -14 + 1.2 * (t - 4.2);
    standing(cam, out, 1, ENGA, x, -0.6, t, { expr: "grin", look: 0.3, reach: HIP }, 0.01 + 0.06 * Math.abs(Math.sin(t * 9)));
    standing(cam, out, 2, ENGB, x + 1.2, 0.2, t, { expr: "smile", look: 0.3, reach: HIP }, 0.01 + 0.06 * Math.abs(Math.sin(t * 9 + 1.5)));
  }
  if (id === 3) {
    // the robot shopper rolls in with its basket; the engineers wave it in
    const r = robotAt(3, t);
    robot(cam, out, r.x, r.z, 0.01 + r.hop, { face: at(t, W.shopper) ? "star" : "happy", la: 12, le: 20, ra: 18 + 6 * Math.sin(t * 13), re: 25, basket: true, step: step(t, r.moving), head: 3 * Math.sin(t * 6) }, t);
    const wv = Math.sin(t * 9) * 40;
    standing(cam, out, 1, ENGA, -7.95, -0.2, t, { expr: "grin", look: -0.6, reach: [[180, 520], [500 + wv * 0.3, 210 + wv]] }, 0.01);
    standing(cam, out, 2, ENGB, -9.0, 1.45, t, { expr: at(t, W.shopper) ? "laugh" : "smile", look: -0.6, reach: WAVE_IN }, 0.01);
    void wv;
  }
  if (id === 4) {
    // hiding traps along the shop fronts: A lowers a trap on "traps", B sticks a note on a window on "text",
    // A holds a framed picture over the next window on "pictures", B sticks an invisible tag on "invisible labels"
    const ax = tip(t, 11.9, 13.2, -5.6, -2.95), bx = tip(t, 13.5, 14.5, -6.75, -5.75);
    const aPic = at(t, W.pictures - 0.5);
    standing(cam, out, 1, ENGA, ax.x, -3.25, t, { expr: at(t, W.traps) ? (aPic ? "grin" : "whistle") : "nervous", look: 0.3, reach: aPic ? [[120, 330], [150, 420]] : at(t, W.traps + 0.2) ? undefined : HIP }, 0.06 + ax.hop);
    const bNote = at(t, W.text - 0.25) && t < 13.5, bTag = at(t, W.invisible - 0.25);
    standing(cam, out, 2, ENGB, bx.x, -3.35, t, { expr: bNote || bTag ? "grin" : "whistle", look: -0.4, reach: bNote ? [[130, 330], [430, 560]] : bTag ? [[170, 560], [480, 380]] : undefined }, 0.06 + bx.hop);
    if (at(t, W.text)) fx1(out, "note", 256, 256, fxNote, -6.45, 1.55, -3.95, 0.62, 0.62, 0.06);
    if (aPic) fx1(out, "frame", 256, 256, fxFrame, -3.55, 1.45, -3.93, 0.95, 0.95, -0.05);
    if (at(t, W.invisible)) { const a = 0.7 + 0.25 * Math.sin(t * 7); fx1(out, `tag${Math.round(a * 10)}`, 256, 256, (p) => fxTag(p, a), -5.0, 1.55, -3.93, 0.75, 0.75, -0.1, true); }
    if (at(t, W.traps) && t < W.traps + 0.4) burstAt(out, "plop", t, W.traps, -5.0, 0.25, -2.6, 0.9);
  }
  if (id === 5) {
    // the goal: catch it getting fooled - the engineers peek out from behind a shop front's edge; A raises a butterfly net
    const net = at(t, W.catch), lol = at(t, W.fooled);
    standing(cam, out, 1, ENGA, -14.95, -4.35, t, { expr: lol ? "laugh" : "grin", look: 0.7, headTilt: 8, reach: net ? [[180, 560], [470, 200]] : RUB }, 0.0);
    standing(cam, out, 2, ENGB, -14.6, -5.05, t, { expr: lol ? "laugh" : "whistle", look: 0.7, headTilt: 6, reach: Math.floor(t * 8) % 2 ? RUB : RUB2 }, 0.0);
    if (net) { const [hx, hy, hz] = onCard(cam, -14.95, 0, -4.35, 470, 200, 0.05); const up = smooth((t - W.catch + 0.07) / 0.2); fx1(out, "net", 256, 512, fxNet, hx + 0.05, hy + 0.35 * up, hz, 0.75, 1.5, -0.25); }
  }
  if (id === 6) {
    // the robot reaches the signpost, squints at the weird address through a magnifier, then turns its eyes toward us
    const r = robotAt(6, t), look = at(t, W.noticed), early = t > 19.3, sus = at(t, W.suspicious - 0.1), cu = t >= 22.3 - 0.01;
    robot(cam, out, r.x, r.z, 0.01 + r.hop, cu
      ? { face: "squint", look: sus ? 0 : 10, la: 14, le: 20, ra: 18, re: 30, basket: true, head: sus ? 7 : 0, sway: 0 }
      : look ? { face: "squint", look: 12, la: 14, le: 20, ra: 150, re: 35, glass: true, basket: true, head: -10, sway: 4 }
             : { face: early ? "squint" : "happy", look: early ? 12 : 0, la: 12, le: 20, ra: 18 + 6 * Math.sin(t * 13), re: 25, basket: true, step: step(t, r.moving), head: -6 }, t);
    if (look && !cu) { const k = Math.floor(t * 5) % 2; fx1(out, `blink${k}`, 256, 256, (p) => fxBurst(p, 0.5 + 0.2 * k, "#fff3b0", 8, 30, 120), SIGN[0], 2.3, SIGN[1] + 0.15, 0.9, 0.9); }
  }
  if (id === 7) {
    const dig = t >= 26.55 - 0.01;
    if (!dig) {
      // the engineers groan: A facepalms, B scratches his head
      standing(cam, out, 1, ENGA, -2.5, 3.0, t, { expr: at(t, W.far) ? "pained" : "nervous", look: -0.3, headTilt: -5, reach: at(t, W.admits) ? PALM : undefined }, 0.06);
      standing(cam, out, 2, ENGB, -3.35, 3.35, t, { expr: at(t, W.perceptive) ? "dazed" : "nervous", look: 0.4, headTilt: 6, reach: at(t, W.far) ? SCRATCH : undefined }, 0.06);
    } else {
      // ... so the traps went deeper: A digs a hole on the kerb, the trap sinks into it; B gives a thumbs-up
      const u = clamp01((t - 26.6) / 1.0), sw = Math.sin(t * 11);
      out.fx.push({ key: `hole${Math.round(u * 6)}`, cw: 256, ch: 256, draw: (p) => fxHole(p, u), x: DIG[0], y: 0.075, z: DIG[1], w: 1.7, h: 1.2, flat: true });
      standing(cam, out, 1, ENGA, DIG[0] - 1.15, DIG[1] + 0.3, t, { expr: at(t, W.deeper) ? "laugh" : "grin", look: 0.5, reach: [[330 + 30 * sw, 470 + 50 * sw], [390 + 30 * sw, 560 + 50 * sw]] }, 0.06);
      const [hx, hy, hz] = onCard(cam, DIG[0] - 1.15, 0.06, DIG[1] + 0.3, 370, 520 + 50 * sw, 0.05);
      fx1(out, "spade", 256, 512, fxSpade, hx + 0.25, hy - 0.35, hz, 0.5, 1.0, 0.5 + 0.25 * sw);
      for (let i = 0; i < 5; i++) { const d = (t - 26.6 - i * 0.22) % 1.1; if (d < 0 || d > 0.7 || t > W.deeper) continue; fx1(out, `clod${i % 3}`, 128, 128, (p) => fxClod(p, i), DIG[0] + 0.3 + 1.6 * d, 0.3 + 2.4 * d - 3.5 * d * d, DIG[1] - 0.2 + 0.2 * i % 0.6, 0.22, 0.22); }
      standing(cam, out, 2, ENGB, DIG[0] + 2.9, DIG[1] + 0.5, t, { expr: at(t, W.deeper) ? "laugh" : "grin", look: -0.5, reach: [[200, 580], [460, 300]] }, 0.06);
      if (at(t, W.deeper) && t < W.deeper + 0.5) burstAt(out, "thud", t, W.deeper + 0.25, DIG[0], 0.3, DIG[1] - 0.3, 1.0);
    }
  }
  if (id === 8) {
    // would you let an AI shop for you? the robot lifts its basket to us; behind it an engineer tiptoes past with another trap
    const lift = at(t, W.shop), snd = at(t, W.send), side = at(t, W.clicks), r = robotAt(8, t);
    robot(cam, out, r.x, r.z, 0.01, side
      ? { face: at(t, W.link) ? "smug" : "squint", look: -12, la: 12, le: 20, ra: 30, re: 100, basket: true, head: -6 }
      : snd ? { face: "happy", la: 12, le: 20, ra: 120 + 25 * Math.sin(t * 12), re: 20, basket: true, head: 4 }
            : { face: lift ? "star" : "happy", la: lift ? 150 : 15, le: lift ? 20 : 20, ra: 18, re: 25, basket: true, head: lift ? 5 : 0 }, t);
    const x = SNEAK(t), h = 0.06 * Math.abs(Math.sin(t * 7));
    standing(cam, out, 1, ENGA, x, -3.2, t, { expr: side ? "shock" : "whistle", look: side ? 0.5 : 0.8, reach: HIP }, 0.06 + h);
  }
};
void fxClip; void ARMS_UP; void SCRATCH; void NORTH;

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  shots(cam, out, id, t);
  return out;
};
export { FPS };
