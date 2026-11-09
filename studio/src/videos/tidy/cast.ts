// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, HALL, STOOP, HQ, BATH, SP, CURB, SPOTTER, PILOT, DESK_Z, DESK_H, TOILET, RB, REPORTER, ROBOT_S, carryAt, climbK, climbFrozen, climbY, stoopZ, headState, DROPS, BACKON } from "./story";
import { drawRobot, armPts, RobotPose, RobotFace, fxCoin, fxClock, fxWaves, fxHeat, fxLoading, fxSparkle, fxSmoke, fxBrushHead, fxDrop, fxPow, fxShake } from "./robot";
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

// ================= the robot-cleaner short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const CO: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#c98a3a", skin: "#ffe2c2" };
const REP: Outfit = { jacket: "#e0a23a", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20", skin: "#ecd0b6" };
const PIL: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const PHONES = "#2b2f3a";
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
const RLIGHT = (cam: CamInfo) => light2D(cam, false);
/** the robot card at (x, y, z) */
const robot = (cam: CamInfo, out: Stage, x: number, y: number, z: number, P: RobotPose, t: number, o: { roll?: number; blob?: boolean } = {}) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.9, z)) / ROBOT_S, [w, h, k] = tier(d);
  const face = P.face ?? "happy", blink = face === "dots" || face === "happy" ? lidAt(t, 77) : 0;
  const pose: RobotPose = { ...P, blink, light: RLIGHT(cam) };
  out.places.push({ key: "robot|" + fkey(pose), x, y, z, scale: ROBOT_S, size: [w, h, k], roll: o.roll ?? 0, draw: (p) => drawRobot(p, pose) });
  if (o.blob !== false) blob(out, x, y, z, 0.95, 1);
};
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, t: number, shadow = true) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  if (shadow) blob(out, x, y, z, 1, 0.9);
};
const REST: RobotPose = { la: 10, le: 12, ra: 10, re: 12 };

// ---------------- 1: the hook, carried up the hall stairs ----------------
const hall = (cam: CamInfo, out: Stage, t: number) => {
  const c = carryAt(t), x = HALL + 0.18;
  standP(cam, out, 1, CO, x, c.y, c.z, { expr: at(t, W.carried) ? "pained" : "nervous", tilt: 2 * c.bob - 1, headTilt: -4, look: 0.3, reach: [[175, 590], [185, 690]] }, t);
  const ry = c.y + 0.55 + 0.03 * c.bob;
  robot(cam, out, x - 0.36, ry, c.z + 0.16, { la: 120, le: 25, ra: 18, re: 12, face: "dizzy", dangle: t * 0.9, head: 8 * Math.sin(t * 3), sway: 3 * Math.sin(t * 2.2) }, t, { blob: false, roll: 0.22 + 0.04 * Math.sin(t * 2.4) });
  // effort: sweat drops flick off her head on "carried", a little shake mark by the robot
  if (at(t, W.carried)) for (let i = 0; i < 2; i++) {
    const u = ((t - W.carried) * 1.6 + i * 0.5) % 1, [px, py, pz] = onCard(cam, x, c.y, c.z, 190 - 60 * u - i * 30, 230 + 160 * u * u, 1, 0.1);
    fx1(out, "drop", 64, 96, fxDrop, px, py, pz, 0.05, 0.075, -0.4);
  }
  if (t > 0.3) fx1(out, "shake", 256, 256, fxShake, x - 0.95, ry + 1.25, c.z + 0.2, 0.32, 0.32, -0.3);
};

// ---------------- 2-3, 5-6: the stoop ----------------
const curb = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const [x, , z] = CURB;
  let P: RobotPose = { ...REST, face: "happy" };
  if (id === 2 && at(t, W.claw) && !at(t, W.grippy)) {
    const k = 0.5 + 0.5 * Math.sin((t - W.claw) * 22);
    P = { la: 140, le: 28, ra: 140, re: 28, face: "happy", claw: k, head: 4 };
  }
  if (id === 2 && at(t, W.grippy)) P = { ...REST, face: "happy", step: Math.sin((t - W.grippy) * 11) };
  if (id === 3) P = { ...REST, face: "dots", head: -6 + 4 * smooth((t - W.twist) / 0.4), la: 14, ra: 14 };
  robot(cam, out, x, 0, z, P, t);
  if (id === 2 && !at(t, W.claw)) {
    // the co-founder by the van door, presenting
    standP(cam, out, 1, CO, STOOP + 1.3, 0, 1.95, { expr: "smile", look: -0.6, reach: [at(t, W.thirty) ? [120, 600] : null, null] }, t);
    // $30 an hour: three coins pop up over its shoulder, then a little clock
    for (let i = 0; i < 3; i++) {
      const d = t - (W.thirty - 0.05 + i * 0.12);
      if (d < 0) continue;
      const pop = d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * 1.15 : 1;
      fx1(out, `coin${Math.floor(((t * 1.4 + i * 0.3) % 1) * 16)}`, 256, 256, (p) => fxCoin(p, (t * 1.4 + i * 0.3) % 1), x - 0.85 + i * 0.2, 1.22 + 0.12 * (i % 2) + 0.03 * Math.sin(t * 4 + i), z + 0.1, 0.2 * pop, 0.2 * pop);
    }
    const dc = t - (W.hour - 0.08);
    if (dc > 0) { const pop = dc < 0.25 ? Math.sin((dc / 0.25) * Math.PI * 0.5) * 1.1 : 1; fx1(out, `clock${Math.floor(t * 12) % 12}`, 256, 256, (p) => fxClock(p, t * 6), x - 0.42, 1.62, z + 0.1, 0.26 * pop, 0.28 * pop); }
  }
  if (id === 2 && at(t, W.claw) && !at(t, W.grippy)) {
    const d = t - W.claw;
    if (d < 0.3) for (const sd of [-1, 1]) { const [px, py, pz] = onCard(cam, x, 0, z, 300 + sd * 150, 470, ROBOT_S, 0.12); fx1(out, `cb${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), "#fff3b0", 8, 30, 160), px, py, pz, 0.28, 0.28); }
  }
  if (id === 2 && at(t, W.grippy)) for (const sd of [-1, 1]) {
    const d = (t - W.grippy + (sd > 0 ? 0.15 : 0)) % 0.57;
    if (d < 0.2) { const [px, py, pz] = onCard(cam, x, 0, z, 300 + sd * 60, 985, ROBOT_S, 0.1); fx1(out, `tap${Math.floor(d * 40)}`, 256, 256, (p) => fxSparkle(p, 1 - d * 4), px, py + 0.02, pz, 0.12, 0.12); }
  }
  if (id === 3) for (const sd of [-1, 1]) {
    const [px, py, pz] = onCard(cam, x, 0, z, 300 + sd * 66, 360, ROBOT_S, 0.05);
    fx1(out, `wave${sd}${Math.floor(((t * 1.5) % 1) * 20)}`, 256, 256, (p) => fxWaves(p, (t * 1.5) % 1), px + sd * 0.03, py + 0.06, pz, 0.3, 0.3, sd * 0.35);
  }
};
const climb = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const k = climbK(t), frozen = id === 6 && climbFrozen(t);
  const wob = frozen ? 0.08 : Math.sin(t * 6.5), slip = t >= W.drunk - 0.05 && t < W.drunk + 0.5;
  const x = STOOP + 0.06 * wob, y = climbY(k), z = stoopZ(k) + 0.05;
  const P: RobotPose = frozen
    ? { la: 70, le: 40, ra: 25, re: 50, face: "frozen", step: 0.9, head: 6 }
    : { la: 40 + 30 * Math.max(0, wob), le: 30, ra: 40 + 30 * Math.max(0, -wob), re: 30, face: slip ? "dizzy" : "dots", step: Math.sin(t * 13), sway: 9 * wob, head: -10 * wob };
  robot(cam, out, x, y, z, P, t, { roll: frozen ? 0.06 : 0.12 * wob });
  // the co-founder spotting from the sidewalk, arms out; climbs a step behind it in the freeze shot
  const sp: FrontOpts = { expr: frozen ? "nervous" : slip ? "shock" : "nervous", look: 0.5, reach: [[395, 610], [450, 590]], tilt: frozen ? 0 : 3 };
  if (id === 5) standP(cam, out, 1, CO, SPOTTER[0], 0, SPOTTER[2], sp, t);
  else standP(cam, out, 1, CO, STOOP - 0.7, SP.rise * 1, stoopZ(1) + 0.1, { ...sp, look: 0.5, reach: [[400, 590], [450, 570]] }, t);
  if (slip) fx1(out, "shake", 256, 256, fxShake, x, y + 1.6, z + 0.05, 0.42, 0.42);
  if (frozen) { const [px, py, pz] = onCard(cam, x, y, z, 120, 470, ROBOT_S, 0.05); fx1(out, `load${Math.floor(t * 10) % 8}`, 256, 256, (p) => fxLoading(p, t * 1.25), px, py + 0.08, pz, 0.26, 0.26); }
};

// ---------------- 4, 7: the pilot at HQ ----------------
const hq = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const [x, , z] = PILOT;
  // the spare robot asleep in the corner
  robot(cam, out, HQ - 1.75, 0, -1.95, { ...REST, face: "closed", head: 8 }, t);
  if (id === 4) {
    const a = Math.sin(t * 2.6), b = Math.sin(t * 2.6 + 1.2);
    const L: [number, number] = [205 + 22 * a, 775 - 18 * b], R: [number, number] = [395 + 22 * b, 775 - 18 * a];
    out.places.push(person(cam, who(2, PIL), x, 0.33, z, { side: false, mirror: false }, { mode: "sit", expr: at(t, W.remotely) ? "grin" : "smile", look: 0.5, phones: PHONES, reach: [L, R], blink: lidAt(t, 2) }, {}));
    for (const [hx, hy] of [L, R]) { const [px, py, pz] = onCard(cam, x, 0.33, z, hx, hy + 10, 1, 0.1); fx1(out, "ctl", 128, 192, fxController, px, py, pz, 0.07, 0.105, 0.2 * Math.sin(t * 2)); }
    if (at(t, W.remotely)) { const u = (t * 1.3) % 1; fx1(out, `w4${Math.floor(u * 20)}`, 256, 256, (p) => fxWaves(p, u), HQ + 0.9, DESK_H + 0.55, DESK_Z - 0.24, 0.35, 0.35); }
  } else {
    const hot = at(t, W.equipment), fan = at(t, W.overheated);
    const R: [number, number] = fan ? [480 + 40 * Math.sin(t * 20), 560] : [395, 775];
    out.places.push(person(cam, who(2, PIL), x, 0.33, z, { side: false, mirror: false }, { mode: "sit", expr: fan ? "pained" : hot ? "shock" : "smile", look: hot ? 0.8 : 0.5, phones: PHONES, reach: [[205, 775], R], blink: lidAt(t, 2) }, {}));
    if (hot) {
      const d = t - W.equipment;
      for (let i = 0; i < 4; i++) { const u = (d * 0.8 + i / 4) % 1; fx1(out, `smk${Math.floor(u * 12)}`, 256, 256, (p) => fxSmoke(p, u), HQ + 0.88 + 0.04 * i, DESK_H + 0.42 + u * 0.75, DESK_Z - 0.24, 0.22 + u * 0.38, 0.22 + u * 0.38, u * 2); }
      fx1(out, `heat${Math.floor(t * 12) % 12}`, 256, 256, (p) => fxHeat(p, t), HQ + 0.62, DESK_H + 0.5, DESK_Z - 0.1, 0.3, 0.3);
      if (d < 0.35) fx1(out, `hb${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3), "#ffb070", 9, 30, 170), HQ + 0.9, DESK_H + 0.25, DESK_Z - 0.05, 0.6, 0.6);
    }
  }
};
/** a hand controller (128 x 192) */
const fxController = (p: Pen) => { p.poly(rrect(34, 20, 94, 180, 26), "#3a3f4c", 8); p.dot(64, 60, 12, "#7ff6ff"); p.dot(64, 110, 9, "#e8483c"); };

// ---------------- 8-10: the bathroom ----------------
const SCRUB_HAND: [number, number] = [0, 0];
const bath = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const [x, , z] = RB, S = ROBOT_S;
  const hs = headState(t), FLOOR: [number, number] = [470, 972];
  // the reporter at the doorway
  if (false) {
    const ex = id === 8 ? (at(t, W.fell) ? "laugh" : "grin") : at(t, W.send) ? "laugh" : "smile";
    standP(cam, out, 3, REP, REPORTER[0], 0, REPORTER[2], { expr: ex as Expr, look: 0.6, tilt: 2, reach: id === 10 && !at(t, W.send) ? [null, [380, 520]] : undefined }, t);
  }
  let P: RobotPose;
  if (id === 10) {
    const wave = at(t, W.send) ? Math.sin((t - W.send) * 9) : 0;
    const up = smooth((t - 26.35) / 0.5);
    P = { la: at(t, W.send) ? 150 + 18 * wave : 12, le: at(t, W.send) ? 25 : 12, ra: 60 + 90 * up, re: 30 - 10 * up, face: at(t, W.toilet2) ? "proud" : "happy", head: at(t, W.would) ? -6 : 0,
      brush: { dx: 34 - 24 * up, dy: 128 - 258 * up, head: true } };
    robot(cam, out, x, 0, z, P, t);
    // sparkles on the clean toilet
    for (let i = 0; i < 4; i++) { const u = (t * 1.1 + i * 0.27) % 1, kk = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(kk * 10)}`, 256, 256, (p) => fxSparkle(p, kk), TOILET[0] - 0.2 + 0.14 * i, 0.5 + 0.12 * ((i * 7) % 3), TOILET[2] + 0.25, 0.14, 0.14); }
    return;
  }
  // scrubbing / poking pose: the claw moves the brush; when the head is down the tip reaches for it on the floor
  const scrub = Math.sin(t * 9);
  const [, hand] = armPts(1, 58, 32);
  SCRUB_HAND[0] = hand[0]; SCRUB_HAND[1] = hand[1];
  let tip: [number, number] = [548 + 10 * scrub, 830 + 6 * Math.cos(t * 9)];
  let ra = 58, re = 32, face: RobotFace = "happy";
  if (hs.s === 2 || (hs.s === 1 && hs.u > 0.5)) {
    // poke: the handle end jabs at the head (misses, misses, connects on the third try in shot 9)
    ra = 44; re = 30; face = "dots";
    const ph = (t * 2.4) % 1, jab = Math.max(0, Math.sin(ph * Math.PI * 2));
    tip = [FLOOR[0] - 50 + 42 * jab, FLOOR[1] - 150 + 135 * jab];
  }
  if (hs.s === 0 && hs.n > 0 && t < BACKON[hs.n - 1] + 0.25) face = "proud";
  const [, hd] = armPts(1, ra, re);
  P = { la: 14, le: 16, ra, re, face, head: hs.s ? 8 : -4 + 3 * scrub, brush: { dx: tip[0] - hd[0], dy: tip[1] - hd[1], head: hs.s === 0 } };
  robot(cam, out, x, 0, z, P, t);
  // the loose head: falls from the tip to the floor with a bounce, lies there
  if (hs.s !== 0) {
    const a = onCard(cam, x, 0, z, 552, 836, S, 0.14), b = onCard(cam, x, 0, z, FLOOR[0] - 8, FLOOR[1] - 30, S, 0.03);
    const u = hs.u, bo = hs.s === 2 ? Math.abs(Math.sin(Math.min(1, (t - DROPS[hs.n] - 0.3) / 0.35) * Math.PI)) * 0.05 * Math.max(0, 1 - (t - DROPS[hs.n] - 0.3) * 2) : 0;
    const px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u * u + bo, pz = a[2] + (b[2] - a[2]) * u;
    fx1(out, `bh${hs.s === 1 ? Math.floor(u * 8) : 9}`, 256, 256, (p) => fxBrushHead(p, hs.s === 1 ? u * 4 : 0.3), px, py, pz, 0.3, 0.3);
    const d = t - (DROPS[hs.n] + 0.3);
    if (d > 0 && d < 0.25) fx1(out, `ph${Math.floor(d * 30)}`, 512, 512, (p) => fxPow(p, d / 0.25), b[0], b[1] + 0.06, b[2] + 0.02, 0.3, 0.3);
  }
  // sparkle when it clicks back on
  for (let i = 0; i < BACKON.length; i++) {
    const d = t - BACKON[i];
    if (d >= 0 && d < 0.35) { const c = onCard(cam, x, 0, z, 552, 836, S, 0.16); fx1(out, `bk${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3), "#fff3b0", 8, 30, 160), c[0], c[1], c[2], 0.32, 0.32); }
  }
  // drips from the tap
  const du = (t * 1.2) % 1;
  fx1(out, "drip", 64, 96, fxDrop, BATH - 0.75, 1.0 - 0.12 * du * du, -1.3 + 0.16, 0.025, 0.037);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "hall") hall(cam, out, t);
  else if (s.place === "stoop") { if (id === 5 || id === 6) climb(cam, out, id, t); else curb(cam, out, id, t); }
  else if (s.place === "hq") hq(cam, out, id, t);
  else bath(cam, out, id, t);
  return out;
};
export { FPS };
