// The trolley short: our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, carPt, carPose, LANE_N, SEAT_RL, SEAT_RR, SEAT_DRV, GATE_N, HC, HSNAP, HGLASS, SNAP, GLASS, REV0, PARKED_X, V3 } from "./story";
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

// ================= the trolley short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const PAS1: Outfit = { jacket: "#e8883a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067", dress: "#e8883a" };
const PAS2: Outfit = { jacket: "#3a64b8", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#2fa39a", skin: "#f5c9a0" };
const INSP: Outfit = { jacket: "#f08a2c", pants: "#2b2d42", boots: "#1e1a24", hat: "cap", cap: "#f2c43a", skin: "#ecd0b6", buttons: "#f4f1ea", build: "stout" };
const EMP: Outfit = { jacket: "#c8e84a", pants: "#2b2d42", boots: "#1e1a24", hat: "cap", cap: "#2b3550", skin: "#f5c9a0", buttons: "#f4f1ea" };
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
/** a glass shard (64 x 64): pale blue triangle with a white glint */
const fxShard = (p: Pen, k: number) => {
  const pts: P2[] = [[[8, 56], [32, 6], [58, 44]], [[6, 20], [58, 10], [30, 58]], [[12, 8], [56, 30], [16, 56]]][k % 3] as P2[];
  p.poly(pts, "#bfe4ff", 4); p.stroke([pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]], 4, "#ffffff");
};
/** sound arcs (256 x 256): three nested arcs opening to the right, u 0..1 grows them */
const fxArcs = (p: Pen, u: number, col = "#fff3b0") => {
  for (let k = 0; k < 3; k++) {
    const r = 40 + 60 * k + 20 * u, pts: P2[] = [];
    for (let i = 0; i <= 12; i++) { const a = -0.8 + 1.6 * i / 12; pts.push([40 + r * Math.cos(a), 128 + r * Math.sin(a)]); }
    p.stroke(pts, 14 - 3 * k, col);
  }
};
/** a magnifying glass (256 x 256) */
const fxLoupe = (p: Pen) => { p.stroke([[160, 160], [236, 236]], 22, "#7a5a40"); p.ell(110, 110, 82, 82, "rgba(200,235,255,0.35)", 12); p.stroke([[70, 80], [100, 60]], 8, "#ffffff"); };

// ---------------- helpers ----------------
/** someone sitting in the robotaxi at a local seat */
const seated = (cam: CamInfo, out: Stage, i: number, o: Outfit, id: number, t: number, seat: V3, fo: FrontOpts, sc = 0.95) => {
  const [x, y, z] = carPt(id, t, seat[0], seat[1], seat[2]);
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "sit", blink: lidAt(t, i), ...fo }, {}, sc));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, t: number, fo: FrontOpts, y = 0.15) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, i), ...fo }, {}));
  blob(out, x, y, z, 1, 0.9);
};
const burstAt = (out: Stage, key: string, t: number, t0: number, x: number, y: number, z: number, s: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d > 0 && d < 0.4) fx1(out, `${key}${Math.floor(d * 24)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2.8), col, 10, 30, 180), x, y, z, s, s);
};
/** glass shards bursting backwards (-x) out of the rear window from (x, y, z) at t0 */
const shards = (out: Stage, t: number, t0: number, x: number, y: number, z: number, n = 14, sp = 1) => {
  const d = t - t0;
  if (d <= 0 || d > 1.1) return;
  for (let i = 0; i < n; i++) {
    const a = ((i * 137.5) % 360) * Math.PI / 180, vx = -(1.6 + 1.4 * ((i * 7) % 5) / 5) * sp, vy = 1.2 + 1.8 * Math.abs(Math.sin(a)), vz = 1.6 * Math.cos(a);
    const py = y + vy * d - 4.9 * d * d;
    if (py < 0.03) continue;
    fx1(out, `sh${i % 3}`, 64, 64, (p) => fxShard(p, i), x + vx * d, py, z + vz * d, 0.2 + 0.07 * (i % 3), 0.2 + 0.07 * (i % 3), d * 9 + i);
  }
};
/** beeping arcs behind a reversing car */
const beeps = (out: Stage, id: number, t: number, t0: number) => {
  if (t < t0) return;
  const u = ((t - t0) * 2.2) % 1;
  if (u > 0.55) return;
  const [x, y, z] = carPt(id, t, -2.75, 1.15, 0);
  fx1(out, `beep${Math.floor(u * 10)}`, 256, 256, (p) => fxArcs(p, u * 1.8, "#ffffff"), x, y, z, 0.6, 0.6, Math.PI);
};
/** walk from a to b between t0 and t1 with a little hop */
const walkTo = (t: number, t0: number, t1: number, a: [number, number], b: [number, number]) => {
  const u = smooth((t - t0) / (t1 - t0));
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, hop: u > 0 && u < 1 ? 0.12 * Math.abs(Math.sin(u * Math.PI * 4)) : 0, moving: u > 0 && u < 1 };
};

// ---------------- shots ----------------
const shots = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1) {
    // hook: the passengers on the sidewalk watch their robotaxi back through the gate; arm snaps, glass bursts
    const hit = at(t, HC);
    standing(cam, out, 1, PAS1, -0.95, 3.7, t, { expr: hit ? "shock" : "nervous", look: 0.6, headTilt: hit ? -6 : 0, reach: hit ? [[200, 330], [400, 330]] : undefined });
    standing(cam, out, 2, PAS2, 0.45, 3.95, t, { expr: hit ? "shock" : "nervous", look: -0.5, headTilt: hit ? 5 : 0, reach: hit ? [[150, 420], [450, 420]] : [[230, 560], [370, 560]] });
    const [rx, ry, rz] = carPt(1, t, -2.3, 1.2, 0);
    burstAt(out, "hb", t, HC, GATE_N[0] - 0.2, 1.1, LANE_N + 0.7, 1.1);
    burstAt(out, "hs", t, HSNAP, rx - 0.2, ry + 0.1, rz + 0.5, 1.4, "#ffffff");
    shards(out, t, HSNAP, rx, ry, rz, 16, 0.9);
    shards(out, t, HGLASS, rx, ry - 0.1, rz + 0.3, 10, 0.7);
    if (t < 1.5) beeps(out, 1, t, 0);
  }
  if (id === 2) {
    // the robotaxi heading down the street: a few pedestrians far off on the sidewalks
    for (const [i, x, z, o] of [[11, -36, 2.6, PAS2], [12, -22, -9.0, PAS1], [13, -12, 3.0, EMP]] as const) standing(cam, out, i, o, x, z, t, { expr: "smile", look: 0.3 });
  }
  if (id === 3) {
    // the two passengers in the back, chatting ... the car stops on the rails: uh-oh
    const st = at(t, W.stopped2);
    seated(cam, out, 1, PAS1, 3, t, SEAT_RR, { expr: st ? "nervous" : "smile", look: st ? 0.5 : -0.5, headTilt: st ? -5 : 2 });
    seated(cam, out, 2, PAS2, 3, t, SEAT_RL, { expr: st ? "shock" : "grin", look: st ? 0.4 : 0.6 });
  }
  if (id === 4) {
    const wide = t >= 11.95;
    if (!wide) {
      // the bell rings: arcs from the bell dome
      if (at(t, W.bells - 0.1)) { const u = ((t - W.bells) * 2.5) % 1; fx1(out, `bell${Math.floor(u * 10)}`, 256, 256, (p) => fxArcs(p, u), GATE_N[0] + 0.55, 4.3, GATE_N[1] + 0.2, 0.9, 0.9, -0.3); fx1(out, `bellL${Math.floor(u * 10)}`, 256, 256, (p) => fxArcs(p, u), GATE_N[0] - 0.55, 4.3, GATE_N[1] - 0.2, 0.9, 0.9, Math.PI + 0.3); }
    } else {
      const g = at(t, W.gates);
      seated(cam, out, 1, PAS1, 4, t, SEAT_RR, { expr: g ? "shock" : "nervous", look: -0.6, headTilt: g ? -6 : 0 });
      seated(cam, out, 2, PAS2, 4, t, SEAT_RL, { expr: g ? "shock" : "nervous", look: -0.4 });
    }
  }
  if (id === 5) {
    // through the window: they look at each other ... then at us, deadpan
    const sm = at(t, W.smart);
    seated(cam, out, 1, PAS1, 5, t, SEAT_RR, { expr: sm ? "neutral" : "nervous", look: sm ? 0 : -0.8, headTilt: sm ? 3 : 0 }, 1.0);
    seated(cam, out, 2, PAS2, 5, t, SEAT_RL, { expr: sm ? "neutral" : "nervous", look: sm ? 0 : 0.8, headTilt: sm ? -3 : 0 }, 1.0);
  }
  if (id === 6) {
    if (t < 16.45) {
      // they hop out of the right-hand doors and hurry to the sidewalk
      const w2 = walkTo(t, W.they - 0.05, W.they + 0.75, [0.1, -0.55], [-2.9, 2.5]), w1 = walkTo(t, W.got - 0.1, W.got + 0.75, [-0.9, -0.55], [-4.2, 2.1]);
      if (t < W.they - 0.05) seated(cam, out, 2, PAS2, 6, t, SEAT_RL, { expr: "nervous", look: 0.5 });
      else standing(cam, out, 2, PAS2, w2.x, w2.z, t, { expr: "nervous", look: -0.6, reach: w2.moving ? [[170, 470], [430, 470]] : undefined }, w2.z > 0.1 ? 0.15 + w2.hop : w2.hop);
      if (t < W.got - 0.1) seated(cam, out, 1, PAS1, 6, t, SEAT_RR, { expr: "nervous", look: 0.5 });
      else standing(cam, out, 1, PAS1, w1.x, w1.z, t, { expr: at(t, W.out) ? "relief" : "nervous", look: -0.6, reach: w1.moving ? [[170, 470], [430, 470]] : undefined }, w1.z > 0.1 ? 0.15 + w1.hop : w1.hop);
    } else {
      // the empty car ... reverse lights, beeping
      beeps(out, 6, t, REV0);
    }
  }
  if (id === 7) {
    // side-on: the car backs through the gate; the arm bends, snaps; the back window bursts; the passengers gasp across the street
    const [rx, ry, rz] = carPt(7, t, -2.3, 1.2, 0);
    burstAt(out, "gb", t, W.gate, GATE_N[0], 1.05, LANE_N + 0.6, 0.9);
    burstAt(out, "sb", t, SNAP, rx + 0.1, ry, rz - 0.2, 1.3, "#ffffff");
    burstAt(out, "wb", t, GLASS, rx + 0.1, ry + 0.1, rz - 0.3, 1.5, "#ffffff");
    shards(out, t, SNAP, rx, ry, rz - 0.4, 10, 0.8);
    shards(out, t, GLASS, rx, ry, rz - 0.4, 18, 1.1);
    if (t < 21.3) beeps(out, 7, t, REV0);
    const s = at(t, SNAP);
    standing(cam, out, 1, PAS1, -0.4, 2.3, t, { expr: s ? "shock" : "nervous", look: -0.7, reach: s ? [[200, 330], [400, 330]] : undefined });
    standing(cam, out, 2, PAS2, 1.1, 2.7, t, { expr: s ? "shock" : "nervous", look: -0.8 });
  }
  if (id === 8) {
    // nobody was hurt: relief; the trolley rolls through behind them
    standing(cam, out, 1, PAS1, 3.7, 2.4, t, { expr: at(t, W.hurt) ? "relief" : "nervous", look: -0.3, reach: at(t, W.hurt) ? [[240, 520], [360, 520]] : undefined });
    standing(cam, out, 2, PAS2, 5.0, 3.0, t, { expr: at(t, W.hurt) ? "relief_open" : "nervous", look: -0.3, headTilt: at(t, W.hurt) ? 6 : 0 });
  }
  if (id === 9) {
    // the transit inspector studies the snapped arm through a magnifier
    const x = -6.9, z = 0.9, inv = at(t, W.investigating);
    standing(cam, out, 3, INSP, x, z, t, { expr: inv ? "stern" : "neutral", look: 0.7, headTilt: 8, reach: [null, [450, 560]] });
    const [lx, ly, lz] = onCard(cam, x, 0.15, z, 480 + 10 * Math.sin(t * 3), 560, 0.12);
    fx1(out, "loupe", 256, 256, fxLoupe, lx + 0.12, ly - 0.12, lz, 0.45, 0.45, Math.PI / 2);
  }
  if (id === 10) {
    // a human at the wheel drives it away, a little sheepish
    seated(cam, out, 4, EMP, 10, t, SEAT_DRV, { expr: at(t, W.drive) ? "grin" : "nervous", look: 0.3, reach: [[240, 600], [360, 600]] });
  }
  if (id === 11) {
    // would you ride in one? she is not sure; he can't wait to hop back in
    const tr = at(t, W.trusts);
    standing(cam, out, 1, PAS1, PARKED_X - 1.5, 1.6, t, { expr: at(t, W.send) ? "nervous" : "stern", look: 0, headTilt: at(t, W.ride) && !at(t, W.send) ? -7 : 0, reach: [[220, 520], [380, 520]] });
    standing(cam, out, 2, PAS2, PARKED_X - 1.0, 3.1, t, { expr: tr ? "laugh" : "grin", look: -0.6, headTilt: tr ? 5 : 0, reach: tr ? [[120, 380 + 25 * Math.sin(t * 12)], [470, 400]] : [[230, 560], [370, 560]] });
  }
};
void clamp01; void carPose; void HGLASS; void GLASS; void fxBurst; void fxPuff;

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  shots(cam, out, id, t);
  return out;
};
export { FPS };
