// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import {
  FPS, V3, SHOTS, W, smooth, clamp01, satState, satPos, SAT2, SAT_S, ROCKET, rocketY, CHIP_AT, LAB, CLEAN, CTRL, STA, PARK, beamOn, at, EARTH_Y,
} from "./story";
import { drawSat, drawChip, fxPulse, fxSleep, fxZap, fxBattery, fxBolt, fxSparkle, fxGlow, fxBlip, ChipFace } from "./sat";
import { fxPow } from "./robot_fx";
import { DISH_AT } from "./build";
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

// ================= the satellite short's cast =================
const ENG_A: Outfit = { jacket: "#5b78c9", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#2a2020", skin: "#c99067" };
const ENG_B: Outfit = { jacket: "#e0a23a", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#6a3b22", skin: "#f5c9a0" };
const ENG_C: Outfit = { jacket: "#4f9a6e", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20" };
const SCI: Outfit = { jacket: "#f3f1ea", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#5a3b2a", skin: "#ecd0b6", buttons: "#9fb0b5" };
const TECH: Outfit = { jacket: "#eef1f7", pants: "#e3e8f2", boots: "#9fb8de", hat: "hair", hair: "#dfe5f0", skin: "#f5c9a0" };
const WALKER: Outfit = { jacket: "#c95b8a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#4a2a1a", skin: "#ecd0b6" };
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });

const seated = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number) => {
  out.places.push(person(cam, who(i, o), x, 0.33, z, { side: false, mirror: false }, { mode: "sit", ...fo, blink: lidAt(t, i) }, {}));
};
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number, shadow = true) => {
  out.places.push(person(cam, who(i, o), x, 0, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  if (shadow) blob(out, x, 0, z, 1, 0.9);
};

/** satellite card centred at c (the card origin is its feet: design y 975, centre at 640) */
const SAT_DY = (975 - 640) * SU;
const satPlace = (cam: CamInfo, out: Stage, c: V3, scale: number, P: { face: string; wings: number; chips: number; beret?: boolean; shades?: boolean; scroll?: number }, t: number, seed = 0, tilt = 0) => {
  const d = cam.pos.distanceTo(tmp.set(c[0], c[1], c[2])) / scale, [w, h, k] = tier(d);
  const light = light2D(cam, false), blinkable = P.face === "dots" || P.face === "happy" || P.face === "curious" || P.face === "think" || P.face === "worried";
  const pose = { ...P, face: P.face as never, blink: blinkable ? lidAt(t, 90 + seed) : 0, light, tilt: q(tilt, 30) };
  out.places.push({ key: "sat|" + fkey(pose), x: c[0], y: c[1] - SAT_DY * scale, z: c[2], scale, size: [w, h, k], draw: (p) => drawSat(p, pose) });
};

const space = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const S = satState(t), c = satPos(t);
  satPlace(cam, out, c, SAT_S, S, t, 0, 3 * Math.sin(t * 0.7));
  // sleep bubble
  if (S.zz > 0) out.fx.push({ key: `zz${Math.floor(t * 4) % 8}`, cw: 256, ch: 256, draw: (p) => fxSleep(p, Math.floor(t * 4)), x: c[0] + 0.62, y: c[1] + 0.75 + 0.05 * Math.sin(t * 2), z: c[2] + 0.05, w: 0.42, h: 0.42 });
  // the poem: sparkles around the scroll
  if (id === 2 && at(t, W.poem)) for (let i = 0; i < 3; i++) {
    const u = (t - W.poem) * 1.4 + i * 0.33;
    out.fx.push({ key: `spk${i}|${Math.floor(u * 8) % 6}`, cw: 128, ch: 128, draw: (p) => fxSparkle(p, Math.floor(u * 8)), x: c[0] + [-0.32, 0.34, 0.12][i], y: c[1] - 0.55 + 0.1 * Math.sin(u * 3) + [-0.05, -0.2, -0.45][i], z: c[2] + 0.1, w: 0.16, h: 0.16 });
  }
  // the message rises from the Earth to the satellite
  if (id === 10) {
    const u = clamp01((t - 29.0) / 1.6);
    if (u < 1) out.fx.push({ key: `pulse${Math.floor(t * 15) % 15}`, cw: 512, ch: 512, draw: (p) => fxPulse(p, (t * 1.5) % 1), x: c[0] - 0.2, y: -9 + 8.4 * u, z: c[2] + 0.3, w: 2.6, h: 2.6 });
    else if (t < 31.2) out.fx.push({ key: `glowhit`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(159,243,255,0.9)"), x: c[0], y: c[1] - 0.2, z: c[2] + 0.2, w: 1.2 * (1 - (t - 30.6) / 0.6), h: 1.2 * (1 - (t - 30.6) / 0.6), soft: true });
  }
  // the haiku: little sparkles drift up from the Earth ("data streams"), the core glows ("starlight")
  if (id === 14 && at(t, W.data)) for (let i = 0; i < 7; i++) {
    const u = ((t - W.data) * 0.35 + i / 7) % 1;
    out.fx.push({ key: `ds${i % 3}|${Math.floor(t * 6 + i) % 6}`, cw: 128, ch: 128, draw: (p) => fxSparkle(p, Math.floor(t * 6 + i)), x: c[0] - 1.8 + 3.6 * ((i * 0.37) % 1), y: -3.5 + 3.8 * u, z: c[2] - 1.5 + (i % 3), w: 0.14, h: 0.14 });
  }
  if (id === 14 && at(t, W.starlight)) out.fx.push({ key: `core`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,240,200,0.28)"), x: c[0], y: c[1] - 0.22, z: c[2] + 0.12, w: 0.36 + 0.03 * Math.sin(t * 5), h: 0.36 + 0.03 * Math.sin(t * 5), soft: true });
  // charging bolt while it sunbathes
  if (id === 19 && at(t, W.sun)) out.fx.push({ key: `bolt`, cw: 256, ch: 256, draw: fxBolt, x: c[0] + 0.62, y: c[1] + 0.55 + 0.04 * Math.sin(t * 6), z: c[2] + 0.05, w: 0.3, h: 0.3, rot: 0.15 * Math.sin(t * 3) });
  // the twin and their chatter
  if (id === 20) {
    satPlace(cam, out, SAT2, SAT_S, { face: at(t, W.talking) ? (Math.floor(t * 2.5) % 2 ? "happy" : "star") : "dots", wings: 1, chips: 4 }, t, 7, -3 * Math.sin(t * 0.8));
    if (at(t, W.talking) && t < W.laser - 0.1) {
      const k = Math.floor(t * 2.5) % 2, pz = k ? c : SAT2;
      out.fx.push({ key: `blip${Math.floor(t * 8) % 8}`, cw: 256, ch: 256, draw: (p) => fxBlip(p, t * 8), x: pz[0] + (k ? 0.3 : -0.3), y: pz[1] + 0.85, z: pz[2] + 0.05, w: 0.42, h: 0.42 });
    }
  }
  void EARTH_Y;
};

const pad = (cam: CamInfo, out: Stage, t: number) => {
  const d = t - W.lifts;
  if (d < -0.05) return;
  // billowing smoke at the base, spreading out sideways
  for (let i = 0; i < 9; i++) {
    const u = clamp01((d + 0.05) / (1.0 + 0.1 * i)), side = i % 2 ? 1 : -1, sp = (2 + i * 2.6) * u;
    out.fx.push({ key: `smoke${i % 3}|${Math.floor(u * 20)}`, cw: 300, ch: 300, draw: (p) => fxPuffBig(p, i), x: ROCKET[0] + side * sp, y: 2 + 3 * u + (i % 3), z: ROCKET[2] + 4 + (i % 4), w: 7 + 9 * u, h: 6 + 8 * u, soft: true });
  }
  const y = rocketY(t);
  out.fx.push({ key: `fglow`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,190,90,0.9)"), x: ROCKET[0], y: y - 6, z: ROCKET[2] + 2.5, w: 9, h: 12, soft: true });
};
/** fat cream smoke cloud for the launch (300 x 300) */
const fxPuffBig = (p: Pen, seed: number) => {
  for (let i = 0; i < 7; i++) {
    const a = seed + i * 0.9, r = 52 + 22 * Math.sin(i * 2.1 + seed);
    p.ell(150 + 70 * Math.cos(a), 160 + 40 * Math.sin(a), r, r * 0.85, i % 2 ? "#f4efe6" : "#e2dccf", 0);
  }
  p.ell(150, 150, 80, 70, "#fbf8f2", 0);
};

const clean = (cam: CamInfo, out: Stage, t: number) => {
  const S = satState(t);
  satPlace(cam, out, [CLEAN, 0.56 + SAT_DY * 0.95, 0], 0.95, S, t, 3);
  const lit = S.chips > 0;
  standing(cam, out, 40, TECH, CLEAN - 0.78, -0.45, { expr: lit ? "grin" : "smile", reach: [null, [445, 560]], look: 0.4 }, t);
  if (at(t, W.four) && t < W.four + 0.9) {
    const n = Math.min(4, S.chips);
    for (let i = 0; i < n; i++) out.fx.push({ key: `cspk${i}|${Math.floor(t * 10) % 5}`, cw: 128, ch: 128, draw: (p) => fxSparkle(p, Math.floor(t * 10)), x: CLEAN - 0.18 + i * 0.11, y: 0.56 + SAT_DY * 0.95 - 0.16 + 0.12, z: 0.12, w: 0.1, h: 0.1 });
  }
};

const lab = (cam: CamInfo, out: Stage, t: number) => {
  const glitch = at(t, W.glitching) && t < W.three - 0.1;
  const face: ChipFace = glitch ? "glitch" : at(t, W.three) ? "proud" : beamOn(t) ? "brace" : "calm";
  const jit = glitch ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
  const cs = 0.36, d = cam.pos.distanceTo(tmp.set(CHIP_AT[0], CHIP_AT[1], CHIP_AT[2])) / cs, [w, h, k] = tier(d);
  const light = light2D(cam, false);
  out.places.push({ key: `chip|${face}|${jit}|${q(light, 10)}`, x: CHIP_AT[0], y: 0.74, z: CHIP_AT[2], scale: cs, size: [w, h, k], draw: (p) => drawChip(p, face, jit, light) });
  if (beamOn(t)) out.fx.push({ key: `hit`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(220,190,255,0.9)"), x: CHIP_AT[0] - 0.13, y: CHIP_AT[1], z: CHIP_AT[2] + 0.02, w: 0.14 + 0.03 * Math.sin(t * 40), h: 0.14 + 0.03 * Math.sin(t * 40), soft: true });
  if (glitch) out.fx.push({ key: `zap${Math.floor(t * 15) % 4}`, cw: 256, ch: 256, draw: (p) => fxZap(p, Math.floor(t * 15)), x: CHIP_AT[0], y: CHIP_AT[1] - 0.02, z: CHIP_AT[2] + 0.05, w: 0.42, h: 0.42 });
  const ex: Expr = at(t, W.five) ? "smile" : at(t, W.three) ? "grin" : at(t, W.glitching) ? "shock" : at(t, W.blasted) ? "nervous" : "neutral";
  standing(cam, out, 41, SCI, LAB + 1.55, -2.55, { expr: ex, look: -0.5, wave: at(t, W.three) && t < W.five ? 0.8 : undefined }, t);
};

const ctrl = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const xs = [-1.3, 0, 1.3], os = [ENG_A, ENG_B, ENG_C];
  if (id === 15) { // they jump up and cheer
    const e: Expr[] = ["laugh", "grin", "laugh"];
    xs.forEach((x, i) => standing(cam, out, 50 + i, os[i], CTRL + x, -1.3, { expr: e[i], wave: 0.5 + 0.5 * Math.sin(t * 9 + i * 2) }, t, false));
    return;
  }
  xs.forEach((x, i) => {
    let ex: Expr = "neutral", look = 0;
    if (id === 9) ex = i === 0 ? (Math.floor(t * 6) % 3 ? "whistle" : "smile") : "smile_closed";
    else if (id === 11) { ex = i === 1 ? "nervous" : "neutral"; look = -0.6; }
    else if (id === 13) ex = i === 1 ? "relief_open" : "shock";
    seated(cam, out, 50 + i, os[i], CTRL + x, -1.3, { expr: ex, look, phase: t }, t);
  });
};

const station = (cam: CamInfo, out: Stage, id: number, t: number) => {
  // the satellite crossing the dusk sky, high up, with a glint
  const u = (t - 34.15) / 2.4, sx = STA - 30 + 50 * u, sy = 42 + 6 * Math.sin(u * 2), sz = -70;
  out.fx.push({ key: `sglow`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,250,235,0.95)"), x: sx, y: sy, z: sz, w: 6 + 0.8 * Math.sin(t * 9), h: 6 + 0.8 * Math.sin(t * 9), soft: true });
  satPlace(cam, out, [sx, sy, sz + 0.5], 4.2, { face: at(t, W.answers) ? "proud" : "think", wings: 1, chips: 4 }, t, 5);
  // the answer comes down to the dish
  if (at(t, W.answers)) {
    const k = clamp01((t - W.answers) / 0.9);
    const x = sx + (DISH_AT[0] - sx) * k, y = sy + (5.5 - sy) * k, z = sz + (DISH_AT[2] - sz) * k;
    if (k < 1) out.fx.push({ key: `apulse${Math.floor(t * 15) % 15}`, cw: 512, ch: 512, draw: (p) => fxPulse(p, (t * 1.5) % 1, "#ffe9a8"), x, y, z, w: 7, h: 7 });
    else out.fx.push({ key: `dglow`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,233,168,0.9)"), x: DISH_AT[0], y: 5.2, z: DISH_AT[2] + 1, w: 5 * (1.2 - 0.3 * Math.sin(t * 6)), h: 5 * (1.2 - 0.3 * Math.sin(t * 6)), soft: true });
  }
  void id;
};

const park = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const unplug = at(t, W.unplugged);
  const ex: Expr = id === 17 ? (at(t, W.phone) ? "grin" : "smile") : unplug ? (t > W.night ? "pained" : "shock") : "smile";
  standing(cam, out, 60, WALKER, PARK + 0.25, 0.1, { expr: ex, prop: "phone", look: 0.3 }, t);
  // battery over the phone: charging at sunset, draining after the plug pops
  const lv = id === 17 ? 0.55 + 0.25 * clamp01((t - 50.4) / 3.5) : unplug ? Math.max(0.08, 0.8 - (t - W.unplugged) * 0.9) : 0.8;
  const bx = PARK + 0.68, by = 1.18;
  out.fx.push({ key: `bat${q(lv, 20)}`, cw: 256, ch: 160, draw: (p) => fxBattery(p, lv), x: bx, y: by + 0.02 * Math.sin(t * 3), z: 0.2, w: 0.3, h: 0.19 });
  if (!unplug && t > W.solar) out.fx.push({ key: `pbolt`, cw: 256, ch: 256, draw: fxBolt, x: bx + 0.22, y: by + 0.02, z: 0.2, w: 0.16, h: 0.16 });
  const d = t - W.unplugged;
  if (d >= 0 && d < 0.3) out.fx.push({ key: `pow${Math.floor(d * 30)}`, cw: 512, ch: 512, draw: (p) => fxPow(p, d / 0.3), x: PARK + 0.38, y: 0.96, z: 0.2, w: 0.38, h: 0.38 });
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "space") space(cam, out, id, t);
  else if (s.place === "pad") pad(cam, out, t);
  else if (s.place === "clean") clean(cam, out, t);
  else if (s.place === "lab") lab(cam, out, t);
  else if (s.place === "ctrl") ctrl(cam, out, id, t);
  else if (s.place === "sta") station(cam, out, id, t);
  else park(cam, out, id, t);
  void smooth;
  return out;
};
export { FPS };
