// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, THEATRE, LOBBY, STAGE_Y, SCREEN, PODIUM, POD, TOWER_FACE, SINGER, HOST_A, HOST_B, PRESENTER, STAR_WALK } from "./story";
import { fxClock, fxWaves, fxSparkle, fxPow, fxShake, fxWeb, fxZzz, fxHeads } from "./robot";
import { fxBlare, fxDots, fxTrophy, fxMic, fxSweat, fxConf, fxPlay, fxFlash, fxCamera } from "./awards_fx";
import { fxBurst, fxNote } from "./toon";
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

// ================= the AI-music-awards short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const SING: Outfit = { jacket: "#e8483c", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067", dress: "#e8483c" };
const HA: Outfit = { jacket: "#2b2d42", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#5a3b2a", skin: "#f5c9a0", buttons: "#f4f1ea" };
const HB: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#e0b040", skin: "#ffe2c2", dress: "#7b5ac9" };
const PRES: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#ecd0b6", moustache: "#2a2020" };
const STAR: Outfit = { jacket: "#f2c43a", pants: "#2b2d42", boots: "#1e1a24", hat: "hair", hair: "#3a2a2a", skin: "#c99067" };
const PHOTO: Outfit = { jacket: "#4a5a7a", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#3a64b8", skin: "#f5c9a0" };
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
const EARS: [[number, number], [number, number]] = [[172, 290], [428, 290]];
const pop = (d: number, k = 1.15) => (d < 0 ? 0 : d < 0.22 ? Math.sin((d / 0.22) * Math.PI * 0.5) * k : 1);
/** notes drifting out of a source point */
const notes = (out: Stage, t: number, x: number, y: number, z: number, n = 5, spread = 1.4, size = 0.32, t0 = 0) => {
  for (let i = 0; i < n; i++) {
    const u = ((t - t0) * 0.55 + i / n) % 1;
    const nx = x + (i % 2 ? 1 : -1) * spread * (0.2 + 0.8 * u) * (0.6 + 0.4 * ((i * 0.37) % 1)), ny = y + 0.9 * u + 0.12 * Math.sin(t * 3 + i), nz = z + 0.8 * u;
    const k = Math.min(1, u * 5, (1 - u) * 4);
    if (k <= 0.05) continue;
    const col = ["#ffd84a", "#7ff6ff", "#ffffff", "#ff6ad5"][i % 4];
    fx1(out, `note${i % 2}|${col}`, 256, 256, (p) => fxNote(p, i % 2, col), nx, ny, nz, size * k, size * k, 0.25 * Math.sin(t * 2 + i));
  }
};
/** the audience: rows of heads from behind (wide shots from the house) */
const heads = (out: Stage, z0 = 2.75, rows = 2, nx = 4) => {
  for (let r = 0; r < rows; r++) for (let i = -nx; i <= nx; i++) {
    const hx = THEATRE + i * 0.95 + (r ? 0.45 : 0), hz = z0 + r * 1.0;
    if (Math.abs(hx - THEATRE) < 0.4) continue;
    const v = (i + r * 7 + 14) % 3;
    fx1(out, `heads${v}`, 256, 256, (p) => fxHeads(p, v), hx, 0.98 + r * 0.06, hz, 0.95, 0.95);
  }
};
const confetti = (out: Stage, t: number, t0: number, cx: number, cz: number, w = 4, top = 4.6) => {
  for (let i = 0; i < 44; i++) {
    const u = ((t - t0) * 0.42 + i / 44) % 1, x = cx - w / 2 + w * ((i * 0.37) % 1), z = cz - 0.8 + 1.6 * ((i * 0.61) % 1);
    fx1(out, `conf${i % 6}`, 64, 32, (p) => fxConf(p, i), x + 0.15 * Math.sin(t * 3 + i), top - 3.4 * u, z, 0.15, 0.075, t * 4 + i);
  }
};

// ---------------- 1: the hook: she mimes, the AI sings ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const beat = Math.floor(t * 3.6) % 4, lip = at(t, W.lip), rob = at(t, W.robots);
  // her mouth flaps off the beat; on "robots" she freezes, caught
  const expr = rob ? "nervous" : ["shock", "laugh", "shock", "laugh"][beat] as Expr;
  const hand: [number, number] = [490, 540];
  standP(cam, out, 1, SING, SINGER, { expr, look: rob ? -0.5 : 0.1, tilt: rob ? -2 : 3 * Math.sin(t * 4.2), headTilt: rob ? 6 : 4 * Math.sin(t * 4.2 + 1), reach: [[210, 520], hand] }, t, true, [W.robots]);
  const [mx, my, mz] = onCard(cam.pos, SINGER[0], SINGER[1], SINGER[2], hand[0] - 14, hand[1] - 45, 1, 0.1);
  fx1(out, "mic", 128, 256, fxMic, mx, my, mz, 0.11, 0.22, 0.45);
  // the AI singer's notes pour out of the big screen
  notes(out, t, SCREEN.x, SCREEN.y - 0.2, SCREEN.z + 0.4, 6, 2.2, 0.42);
  // the backing track: a play icon pulsing by the screen corner on "lip-synced"
  if (lip) { const d = t - W.lip, k = pop(d) * (1 + 0.06 * Math.sin(t * 12)); fx1(out, "play", 256, 256, fxPlay, SCREEN.x + 2.45, SCREEN.y - 1.2, SCREEN.z + 0.3, 0.7 * k, 0.7 * k); }
  heads(out, 2.75, 1, 3);
};

// ---------------- 2: the stone tower reporter ----------------
const carpet = (cam: CamInfo, out: Stage, t: number) => {
  const p = STAR_WALK(t), walk = p[0] < LOBBY + 3.5;
  out.places.push(person(cam, who(5, STAR), p[0], p[1], p[2], { side: true, mirror: false }, {}, { mode: "march", phase: (t * 1.5) % 1, stride: 0.55, expr: at(t, W.couldnt) ? "grin" : "smile", blink: lidAt(t, 5) }));
  blob(out, p[0], p[1], p[2], 1, 0.9);
  void walk;
  // the tower talks: waves from its face toward the star
  if (t >= W.reporter && t < W.couldnt - 0.3) { const u = (t * 1.6) % 1; fx1(out, `tw${Math.floor(u * 20)}`, 256, 256, (pp) => fxWaves(pp, u), TOWER_FACE[0] - 0.55, TOWER_FACE[1] + 0.1, TOWER_FACE[2] + 0.2, 0.4, 0.4, -1.2); }
  // can't move: shake ticks + sweat
  if (at(t, W.couldnt)) {
    const k = Math.floor(t * 15) % 3;
    fx1(out, `tsh${k}`, 256, 256, fxShake, TOWER_FACE[0] - 0.05, TOWER_FACE[1] + 0.55, TOWER_FACE[2] + 0.1, 0.9, 0.9, k * 0.4 - 0.4);
    const u = ((t - W.couldnt) * 1.4) % 1;
    fx1(out, "sweat", 128, 160, fxSweat, TOWER_FACE[0] + 0.42, TOWER_FACE[1] + 0.25 - 0.3 * u, TOWER_FACE[2] + 0.12, 0.1, 0.125);
  }
  // photographers at the rope, flashes popping (wide only)
  if (t < W.couldnt - 0.1) {
    for (const [i, x] of [[6, -2.4], [7, -0.9]] as const) {
      const pp: [number, number, number] = [LOBBY + x, 0, -1.45];
      standP(cam, out, i, PHOTO, pp, { expr: "grin", look: 0.3, reach: [[230, 300], [370, 300]] }, t);
      const [cx, cy, cz] = onCard(cam.pos, pp[0], 0, pp[2], 300, 280, 1, 0.1);
      fx1(out, "camera", 192, 160, fxCamera, cx, cy, cz, 0.24, 0.2);
      const ph = (t * 1.3 + i * 0.37) % 1;
      if (ph < 0.12) fx1(out, `fl${Math.floor(ph * 50)}`, 256, 256, (q) => fxFlash(q, 1 - ph / 0.12), cx + 0.1, cy + 0.12, cz + 0.05, 0.5, 0.5);
    }
  }
};

// ---------------- 3: the announcer talks over the hosts ----------------
const announcer = (cam: CamInfo, out: Stage, t: number) => {
  const blare = at(t, W.announcer), loud = at(t, W.talking);
  standP(cam, out, 2, HA, HOST_A, { expr: loud ? "pained" : Math.floor(t * 7) % 2 ? "grin" : "laugh", look: loud ? 0.3 : 0.6, headTilt: loud ? -8 : 0, reach: loud ? EARS : [[220, 540], [400, 470]] }, t, true, [W.talking]);
  standP(cam, out, 3, HB, HOST_B, { expr: loud ? "stern" : Math.floor(t * 6 + 1) % 2 ? "grin" : "smile", look: loud ? -0.4 : -0.6, headTilt: loud ? -10 : 0, reach: loud ? [[260, 520], [340, 520]] : [[200, 540], [380, 460]] }, t, true, [W.talking]);
  // their little bubbles get squashed by the pod's giant one
  const sq = clamp01((t - W.talking) / 0.4);
  if (t < W.hosts + 0.3) {
    const [ax, ay, az] = onCard(cam.pos, HOST_A[0], HOST_A[1], HOST_A[2], 150, 120, 1, 0.08);
    fx1(out, `dotsA${Math.round(sq * 6)}`, 256, 192, (p) => fxDots(p, sq), ax, ay, az, 0.36 * (1 - 0.3 * sq), 0.27 * (1 - 0.3 * sq));
  }
  if (blare) {
    const d = t - W.announcer, k = pop(d, 1.1) * (1 + 0.04 * Math.sin(t * 20)), wob = Math.floor(t * 12) % 4;
    fx1(out, `blare${wob}`, 512, 384, (p) => fxBlare(p, wob), POD[0] + 1.25, POD[1] - 0.35, POD[2] + 0.6, 1.7 * k, 1.27 * k);
    const u = (t * 2.2) % 1;
    fx1(out, `pw${Math.floor(u * 20)}`, 256, 256, (p) => fxWaves(p, u, "#7ff6ff"), POD[0], POD[1] - 0.55, POD[2] + 0.5, 0.8, 0.8, Math.PI);
  }
};

// ---------------- 4: thirty minutes late; thirteen minutes for one award ----------------
const waiting = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const cu = at(t, W.one), lt = at(t, W.thirteen);
  const hand: [number, number] = [400, 585];
  standP(cam, out, 4, PRES, PRESENTER, { expr: lt ? "dazed" : cu ? "neutral" : "nervous", look: cu ? 0.2 : 0.6, headTilt: lt ? 10 : 0, tilt: lt ? -3 : 0, reach: [[230, 560], hand] }, t, true, [W.one, W.thirteen]);
  const [tx, ty, tz] = onCard(cam.pos, PRESENTER[0], PRESENTER[1], PRESENTER[2], hand[0] + 10, hand[1] - 80, 1, 0.12);
  fx1(out, "trophy", 256, 320, fxTrophy, tx, ty, tz, 0.24, 0.3);
  if (lt) { fx1(out, "web", 256, 256, fxWeb, tx + 0.08, ty + 0.12, tz + 0.02, 0.26, 0.26); const u = (t * 0.8) % 1; fx1(out, `zz${Math.floor(u * 16)}`, 256, 256, (p) => fxZzz(p, u), tx - 0.45, ty + 0.75, tz, 0.3, 0.3); }
  // a big clock spins in front of the screen (the show running late)
  const a = (t - 14.05) * (lt ? 10 : 6);
  if (!cu) fx1(out, `clk${Math.floor(a * 6) % 48}`, 256, 256, (p) => fxClock(p, a), SCREEN.x + 1.6, SCREEN.y - 0.1, SCREEN.z + 0.35, 1.6, 1.6);
  else fx1(out, `clk${Math.floor(a * 6) % 48}`, 256, 256, (p) => fxClock(p, a), PRESENTER[0] - 0.35, 3.05, PRESENTER[2] - 1.4, 0.7, 0.7);
  if (!cu) { heads(out, 2.75, 2, 4); for (let i = 0; i < 2; i++) { const u = (t * 0.7 + i * 0.5) % 1; fx1(out, `hz${i}${Math.floor(u * 16)}`, 256, 256, (p) => fxZzz(p, u), THEATRE - 1.5 + 2.9 * i, 1.55 + 0.2 * u, 2.85, 0.3, 0.3); } }
  void id;
};

// ---------------- 5: the trailer cuts off ----------------
const trailer = (cam: CamInfo, out: Stage, t: number) => {
  const cut = at(t, W.right);
  heads(out, 2.75, 1, 4);
  // the two hosts from behind? they stand at the podium, turned to the screen: shock -> laugh
  standP(cam, out, 2, HA, HOST_A, { expr: cut ? (t < W.right + 0.4 ? "shock" : "laugh") : "smile", look: -0.6, headTilt: -6, reach: cut ? [[150, 330], [450, 330]] : undefined }, t, true, [W.right]);
  if (cut && t < W.right + 0.3) { const d = t - W.right; fx1(out, `cpw${Math.floor(d * 30)}`, 512, 512, (p) => fxPow(p, d / 0.3), SCREEN.x - 1.6, SCREEN.y + 0.7, SCREEN.z + 0.3, 1.0, 1.0); }
  // the house laughs: little bounce ticks over the heads
};

// ---------------- 6: the AI singer wins three ----------------
const winner = (cam: CamInfo, out: Stage, t: number) => {
  const T3 = [W.artist, W.song, W.album];
  T3.forEach((t0, i) => {
    const d = t - (t0 - 0.03);
    if (d < 0) return;
    const k = pop(d, 1.2), x = SCREEN.x - 1.35 + 1.35 * i, y = SCREEN.y - 1.75 + 0.06 * Math.sin(t * 3 + i);
    fx1(out, `trophyW`, 256, 320, fxTrophy, x, y, SCREEN.z + 0.9, 0.62 * k, 0.78 * k);
    if (d < 0.3) fx1(out, `tb${i}${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), "#fff3b0", 10, 40, 220), x, y + 0.1, SCREEN.z + 0.85, 1.1, 1.1);
    for (let j = 0; j < 2; j++) { const u = (t * 1.1 + j * 0.5 + i * 0.2) % 1, kk = Math.sin(u * Math.PI); fx1(out, `ws${Math.floor(kk * 10)}`, 256, 256, (p) => fxSparkle(p, kk), x - 0.3 + 0.6 * j, y + 0.45 + 0.1 * j, SCREEN.z + 0.95, 0.22, 0.22); }
  });
  if (at(t, W.year)) confetti(out, t, W.year - 0.1, THEATRE, 0.0, 5, 5.2);
  if (!at(t, W.artist)) notes(out, t, SCREEN.x, SCREEN.y - 0.2, SCREEN.z + 0.4, 4, 2.0, 0.36);
  heads(out, 2.75, 2, 4);
};

// ---------------- 7: would you watch? ----------------
const ending = (cam: CamInfo, out: Stage, t: number) => {
  const send = at(t, W.send);
  standP(cam, out, 2, HA, HOST_A, { expr: send ? "laugh" : at(t, W.show2) ? "grin" : "smile", look: send ? 0 : 0.15, headTilt: send ? 0 : 6,
    reach: send ? [[200, 560], [440, 340 + 20 * Math.sin((t - W.send) * 8)]] : [[210, 520], [400, 470]] }, t, true, [W.send]);
  void PODIUM;
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (id === 1) hook(cam, out, t);
  else if (id === 2) carpet(cam, out, t);
  else if (id === 3) announcer(cam, out, t);
  else if (id === 4) waiting(cam, out, id, t);
  else if (id === 5) trailer(cam, out, t);
  else if (id === 6) winner(cam, out, t);
  else ending(cam, out, t);
  return out;
};
export { FPS, smooth };
