// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, HALL, STAGE, STAGE_Y, PEDESTAL, OWNER, BOX4, SOFA, ROUTER, SENSOR, DOCKP, DRONE_S, carryAt, droneAt, wifiUp } from "./story";
import { fxCoin, fxClock, fxWaves, fxSparkle, fxPow, fxShake, fxBox, fxPage, fxWeb, fxZzz, fxBattery, fxSandwich, fxHeads, fxGlow, fxNoWifi } from "./robot";
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

export type Stage = { places: Place[]; fx: FxPlace[]; drone?: import("./story").DroneState };

// ================= the flying-camera short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const OWN: Outfit = { jacket: "#3a7bd5", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#5a3b2a", skin: "#f5c9a0" };
const OLD: Outfit = { ...OWN, hair: "#b9b9c4", moustache: "#c4c4ce" };
const PJ: Outfit = { ...OLD, jacket: "#7fb8a8", pants: "#5f9a8a", boots: "#e8483c" };
const PRES: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067" };
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
const EARS: [[number, number], [number, number]] = [[172, 290], [428, 290]];
/** buzz marks around the flying drone */
const buzz = (out: Stage, p: [number, number, number], t: number, s = 0.36) => {
  const k = Math.floor(t * 15) % 3;
  fx1(out, `buzz${k}`, 256, 256, fxShake, p[0], p[1] + 0.02, p[2], s, s, k * 0.5 - 0.5);
};
const coins = (out: Stage, t: number, t0: number, x: number, y: number, z: number, step = 0.2) => {
  for (let i = 0; i < 3; i++) {
    const d = t - (t0 + i * 0.12);
    if (d < 0) continue;
    const pop = d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * 1.15 : 1, sp = (t * 1.4 + i * 0.3) % 1;
    fx1(out, `coin${Math.floor(sp * 16)}`, 256, 256, (p) => fxCoin(p, sp), x + (i - 1) * step, y + 0.1 * (i % 2) + 0.03 * Math.sin(t * 4 + i), z, step * pop, step * pop);
  }
};

// ---------------- 1: the hook ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[1], d = droneAt(1, t)!;
  const loud = at(t, W.loud);
  standP(cam, out, 1, OWN, x, y, z, { expr: loud ? "pained" : "shock", look: lookAt(cam, x, z, d.p), tilt: loud ? -3 : 2 * Math.sin(t * 3), headTilt: loud ? -6 : 0,
    reach: loud ? EARS : [[200, 520], [400, 520]] }, t);
  if (t < 3.95) buzz(out, d.p, t, loud ? 0.5 : 0.36);
};

// ---------------- 2: the 2020 keynote ----------------
const keynote = (cam: CamInfo, out: Stage, t: number) => {
  const x = STAGE - 0.62, z = -0.8, ship = at(t, W.shipping);
  const box: [number, number] = [455, 400];
  standP(cam, out, 2, PRES, x, STAGE_Y, z, { expr: ship ? "laugh" : "grin", look: 0.6, tilt: 2, reach: ship ? [[190, 560], box] : [[200, 560], [520, 430]] }, t);
  if (ship) {
    const d = t - W.shipping, pop = d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * 1.1 : 1;
    const [px, py, pz] = onCard(cam.pos, x, STAGE_Y, z, box[0] + 10, box[1] - 70, 1, 0.12);
    fx1(out, "box", 512, 512, (p) => fxBox(p, 0), px, py, pz, 0.48 * pop, 0.48 * pop);
    for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i * 0.33) % 1, k = Math.sin(u * Math.PI); fx1(out, `bs${Math.floor(k * 10)}`, 256, 256, (p) => fxSparkle(p, k), px - 0.3 + 0.3 * i, py + 0.3 + 0.1 * (i % 2), pz, 0.16, 0.16); }
  }
  coins(out, t, W.two - 0.05, PEDESTAL[0] - 0.05, STAGE_Y + 1.78, PEDESTAL[2] + 0.35, 0.22);
  // the audience: rows of heads in the dark foreground (wide only)
  for (let r = 0; r < 2; r++) for (let i = -3; i <= 3; i++) {
    const hx = STAGE + i * 0.95 + (r ? 0.45 : 0), hz = 2.6 + r * 0.9;
    fx1(out, `heads${(i + r * 7 + 14) % 3}`, 256, 256, (p) => fxHeads(p, (i + r * 7 + 14) % 3), hx, 0.95 + r * 0.06, hz, 0.95, 0.95);
  }
};

// ---------------- 3: waiting ----------------
const waiting = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[3];
  out.places.push(person(cam, who(1, OWN), x, y, z, { side: false, mirror: false }, { mode: "sit", expr: at(t, W.never) ? "dazed" : "neutral", look: 0.1, headTilt: 9, tilt: -3, blink: lidAt(t, 1) }, {}));
  const [wx, wy, wz] = onCard(cam.pos, x, y, z, 430, 175, 1, -0.05);
  fx1(out, "web", 256, 256, fxWeb, wx, wy, wz, 0.42, 0.42);
  // calendar pages flying off
  for (let i = 0; i < 6; i++) {
    const u = (t - 9.75) * 0.9 - i * 0.16;
    if (u < 0 || u > 1) continue;
    fx1(out, `page${i % 3}`, 256, 320, (p) => fxPage(p, i % 3), SOFA[0] + 1.5 - 2.4 * u, 2.05 + 0.18 * Math.sin(u * 5 + i), SOFA[2] - 0.15 + 0.1 * Math.sin(u * 3 + i), 0.17, 0.21, u * 6 + i);
  }
};

// ---------------- 4: six years later ----------------
const arrival = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[4], d = droneAt(4, t) ?? { p: [BOX4[0], 0.4, BOX4[2]] as [number, number, number] }, fin = at(t, W.finally), same = at(t, W.same);
  const expr = same ? (t < W.same + 0.35 ? "shock" : "grin") : fin ? (at(t, W.here) ? "laugh" : "shock") : "neutral";
  standP(cam, out, 1, OLD, x, y, z, { expr, look: fin ? lookAt(cam, x, z, d.p) : -0.7, tilt: same && t < W.same + 0.3 ? -4 : 0, reach: fin && !same ? [[150, 330], [450, 330]] : undefined }, t);
  const [bx, , bz] = BOX4;
  fx1(out, fin ? "boxOpen" : "box", 512, 512, (p) => fxBox(p, fin ? 1 : 0), bx, 0.25, bz, 0.5, 0.5);
  blob(out, bx, 0, bz, 0.9, 0.8);
  const dd = t - W.finally;
  if (dd > 0 && dd < 0.35) fx1(out, `ob${Math.floor(dd * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, dd * 3), "#fff3b0", 9, 30, 170), bx, 0.55, bz + 0.05, 0.7, 0.7);
  if (fin) { for (let i = 0; i < 3; i++) { const u = (t * 1.1 + i * 0.33) % 1, k = Math.sin(u * Math.PI); fx1(out, `as${Math.floor(k * 10)}`, 256, 256, (p) => fxSparkle(p, k), d.p[0] - 0.25 + 0.25 * i, d.p[1] + 0.15 * (i % 2), d.p[2] + 0.1, 0.13, 0.13); } }
  if (fin) buzz(out, d.p, t, 0.32);
  coins(out, t, W.same - 0.05, x - 0.33, 1.95, z + 0.2, 0.14);
};

// ---------------- 5: carried round the house ----------------
const carry = (cam: CamInfo, out: Stage, t: number) => {
  const c = carryAt(t), x = HALL + 0.12;
  const H: [[number, number], [number, number]] = [[240, 565], [360, 565]];
  standP(cam, out, 1, OLD, x, c.y, c.z, { expr: "smile", tilt: 2 * c.bob - 1, headTilt: -4, look: 0.1, reach: H }, t);
  const p = onCard(cam.pos, x, c.y, c.z, 300, 520, 1, 0.24);
  out.drone = { p, yaw: Math.atan2(cam.pos.x - p[0], cam.pos.z - p[2]) + 0.9 * Math.sin(t * 1.7), pitch: 0.1, roll: 0, fly: false, shut: false, eye: 1, scale: DRONE_S };
  // it scans as it goes: signal waves from its lens
  const u = (t * 1.4) % 1;
  fx1(out, `scan${Math.floor(u * 20)}`, 256, 256, (pp) => fxWaves(pp, u), p[0], p[1] + 0.2, p[2], 0.34, 0.34);
};

// ---------------- 6-7: night ----------------
const napping = (cam: CamInfo, out: Stage, t: number) => {
  if (!at(t, W.alarm)) { const u = (t * 0.8) % 1; fx1(out, `zz${Math.floor(u * 16)}`, 256, 256, (p) => fxZzz(p, u), DOCKP[0] + 0.12, DOCKP[1] + 0.25 + 0.1 * u, DOCKP[2] + 0.05, 0.26, 0.26); }
  else {
    const u = (t * 2) % 1;
    fx1(out, `al${Math.floor(u * 20)}`, 256, 256, (p) => fxWaves(p, u, "#ff6a4a"), SENSOR[0], SENSOR[1] + 0.2, SENSOR[2] + 0.12, 0.45, 0.45, 0);
    const d = t - W.alarm;
    if (d < 0.3) fx1(out, `wk${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), "#fff3b0", 8, 30, 160), DOCKP[0], DOCKP[1] + 0.12, DOCKP[2] + 0.1, 0.4, 0.4);
  }
};
const caught = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[7], d = droneAt(7, t)!, lit = t >= W.look - 0.35;
  standP(cam, out, 1, PJ, x, y, z, { expr: lit ? "shock" : "smile", look: lit ? lookAt(cam, x, z, d.p) : -0.8, tilt: lit ? -3 : 0, reach: [[205, 520], lit ? [470, 300] : [380, 420]] }, t);
  const hand: [number, number] = lit ? [470, 300] : [380, 420];
  const [sx, sy, sz] = onCard(cam.pos, x, y, z, hand[0], hand[1] - 20, 1, 0.1);
  fx1(out, "sandwich", 256, 192, fxSandwich, sx, sy, sz, 0.22, 0.165, lit ? 0.4 : 0);
  buzz(out, d.p, t, 0.34);
};

// ---------------- 8: the charger ----------------
const charger = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[8], d = droneAt(8, t)!, landed = t >= 24.78;
  standP(cam, out, 1, OLD, x, y, z, { expr: landed ? (at(t, W.charger) ? "dazed" : "stern") : "grin", look: lookAt(cam, x, z, d.p), reach: landed ? [[330, 520], [270, 520]] : [[200, 560], [470, 420]] }, t);
  if (d.fly) buzz(out, d.p, t, 0.3);
  if (landed) {
    const k = clamp01((t - 24.78) / 9) * 0.6 + 0.05;
    fx1(out, `bat${Math.floor(k * 20)}`, 256, 256, (p) => fxBattery(p, k), DOCKP[0] - 0.05, DOCKP[1] + 0.32, DOCKP[2] + 0.1, 0.26, 0.26);
    const a = (t - 24.78) * 9;
    fx1(out, `clk${Math.floor(a * 6) % 48}`, 256, 256, (p) => fxClock(p, a), DOCKP[0] + 0.3, 1.75, -2.93, 0.42, 0.42);
  }
};

// ---------------- 9: Wi-Fi drops ----------------
const wifi = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const [x, y, z] = OWNER[9], d = droneAt(9, t)!, up = wifiUp(id, t), landed = t >= W.lands;
  standP(cam, out, 1, OLD, x, y, z, { expr: landed ? "dazed" : up ? "smile" : "shock", look: lookAt(cam, x, z, d.p), reach: undefined, headTilt: landed ? 7 : 0 }, t);
  if (up) { const u = (t * 1.5) % 1; fx1(out, `wf${Math.floor(u * 20)}`, 256, 256, (p) => fxWaves(p, u), ROUTER[0] - 0.06, ROUTER[1] + 0.25, ROUTER[2] + 0.1, 0.34, 0.34); }
  else if (!landed || t < W.lands + 0.8) fx1(out, "nowifi", 256, 256, fxNoWifi, ROUTER[0] - 0.3, ROUTER[1] + 0.45, ROUTER[2] + 0.1, 0.32, 0.32);
  if (!landed) buzz(out, d.p, t, up ? 0.3 : 0.38);
  const dd = t - W.lands;
  if (dd > 0 && dd < 0.28) fx1(out, `pw${Math.floor(dd * 30)}`, 512, 512, (p) => fxPow(p, dd / 0.28), d.p[0], d.p[1] + 0.05, d.p[2] + 0.12, 0.42, 0.42);
};

// ---------------- 10: would you let one patrol? ----------------
const ending = (cam: CamInfo, out: Stage, t: number) => {
  const [x, y, z] = OWNER[10], d = droneAt(10, t)!, send = at(t, W.send);
  standP(cam, out, 1, OLD, x, y, z, { expr: send ? "laugh" : at(t, W.patrol) ? "grin" : "smile", look: send ? 0 : 0.5, headTilt: send ? 0 : 5,
    reach: send ? [[200, 560], [300 + 140, 330 + 20 * Math.sin((t - W.send) * 8)]] : [[150, 380], [450, 380]] }, t);
  buzz(out, d.p, t, 0.3);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (id === 1) hook(cam, out, t);
  else if (id === 2) keynote(cam, out, t);
  else if (id === 3) waiting(cam, out, t);
  else if (id === 4) arrival(cam, out, t);
  else if (id === 5) carry(cam, out, t);
  else if (id === 6) napping(cam, out, t);
  else if (id === 7) caught(cam, out, t);
  else if (id === 8) charger(cam, out, t);
  else if (id === 9) wifi(cam, out, id, t);
  else ending(cam, out, t);
  return out;
};
export { FPS };
