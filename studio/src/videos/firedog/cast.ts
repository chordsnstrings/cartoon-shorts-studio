// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, clamp01, at, V3, dogAt, FF1, SCI3, SCI6, FF8, SX, STAIR } from "./story";
import type { Dog } from "./dog3d";
import { fxClock, fxSparkle, fxWaves } from "./robot";
import { fxBurst } from "./toon";
import { fxRocket, fxSteam, fxThin, fxThermo, fxTablet, fxPin, fxWater, fxQ, fxStar } from "./dfx";
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
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3; dog?: Dog };

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

// ================= the fire-dog short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const FF: Outfit = { jacket: "#c9a24a", pants: "#b8923e", boots: "#2b2630", hat: "helmet", cap: "#d9342b", skin: "#f0c8a0", belt: "#f2e36a" };
const SCIA: Outfit = { jacket: "#f4f4f0", pants: "#3b4a6a", boots: "#2b2630", hat: "hair", hair: "#1e1a1e", skin: "#f5d2b0" };
const SCIB: Outfit = { jacket: "#f4f4f0", pants: "#4a4e60", boots: "#5a3b2a", hat: "hair", hair: "#2a2226", skin: "#ecc49e", build: "stout" };
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
export const onCard = (cam: { x: number; z: number }, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.x - x, dz = cam.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, p: V3, fo: FrontOpts, t: number, shadow = true) => {
  out.places.push(person(cam, who(i, o), p[0], p[1], p[2], { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  if (shadow) blob(out, p[0], p[1], p[2], 1, 0.9);
};
/** horizontal look (-1 left .. 1 right on screen) from a card at (x, z) toward a world point */
const lookAt = (cam: CamInfo, x: number, z: number, p: V3) => {
  const dx = p[0] - x, dz = p[2] - z, r = cam.right;
  return Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / 0.6));
};
const pop = (d: number, k = 1.1) => (d < 0 ? 0 : d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * k : 1);
const sparkles = (out: Stage, p: V3, t: number, s = 0.16, spread = 0.3) => {
  for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i * 0.33) % 1, k = Math.sin(u * Math.PI); fx1(out, `sp${Math.floor(k * 10)}`, 256, 256, (pp) => fxSparkle(pp, k), p[0] - spread + spread * i, p[1] + 0.1 * (i % 2), p[2], s, s); }
};
/** offset a world point along the camera's right vector and up */
const off = (cam: CamInfo, p: V3, r: number, up: number): V3 => [p[0] + cam.right.x * r, p[1] + up, p[2] + cam.right.z * r];
/** light-grey smoke puffs drifting up from the tower openings (never dark: dark smoke reads as a real disaster) */
const SMOKE: V3[] = [[0.3, 13.6, -11], [1.8, 6.1, -7.7], [-1.8, 9.4, -7.7]];
const smoke = (out: Stage, t: number, k = 1) => {
  SMOKE.forEach((s, j) => { for (let i = 0; i < 3; i++) {
    const u = (t * 0.22 + i / 3 + j * 0.17) % 1, sc = (1.6 + 2.6 * u) * k;
    fx1(out, `sm${Math.floor(u * 20)}`, 256, 256, (p) => fxSteam(p, u * 0.6), s[0] + 1.4 * u, s[1] + 3.6 * u, s[2] - 0.2, sc, sc, 0, true);
  } });
};
const dogBody = (cam: CamInfo, dy = 0.75): V3 => { const d = cam.dog!; const p = d.headPos; return [p.x, p.y + dy - 0.75, p.z]; };

// ---------------- 1: the hook ----------------
const hook = (cam: CamInfo, out: Stage, t: number) => {
  const d = dogAt(1, t)!, lit = at(t, W.fire);
  standP(cam, out, 1, FF, FF1, { expr: lit ? "laugh" : "shock", look: lookAt(cam, FF1[0], FF1[2], d.p), headTilt: lit ? 4 : -2,
    reach: lit ? [[150, 380], [450, 380]] : [[190, 520], [410, 520]] }, t);
  smoke(out, t);
};
// ---------------- 2: the coat ----------------
const coat = (cam: CamInfo, out: Stage, t: number) => {
  const b = dogBody(cam, 0.72);
  smoke(out, t);
  if (at(t, W.coat) && !at(t, W.only)) sparkles(out, off(cam, b, 0.1, 0.1), t, 0.2, 0.32);
  const dt = t - (W.few - 0.05);
  if (dt > 0 && t < W.made) { const s = pop(dt); const q = off(cam, b, -0.62, 0.62); fx1(out, "thin", 360, 240, fxThin, q[0], q[1], q[2], 0.6 * s, 0.4 * s, 0.05); }
  const dr = t - (W.flew - 0.55);
  if (dr > 0) {
    const u = clamp01(dr / 2.4), base = off(cam, b, -0.75, 0.2);
    const y = base[1] + 0.2 + 2.0 * u * u;
    fx1(out, `rk${Math.floor(t * 12) % 4}`, 200, 420, (p) => fxRocket(p, (Math.floor(t * 12) % 4) / 4), base[0], y + 0.25, base[2], 0.28, 0.6);
    for (let i = 1; i < 6; i++) { const ti = dr - i * 0.16; if (ti < 0) continue; const ui = clamp01(ti / 2.4), yi = base[1] + 0.2 + 2.0 * ui * ui - 0.05; const age = clamp01(i / 6);
      fx1(out, `rt${Math.floor(age * 10)}`, 256, 256, (p) => fxSteam(p, age), base[0] + 0.02 * i, yi - 0.12, base[2], 0.14 + 0.05 * i, 0.14 + 0.05 * i, 0, true); }
    if (dr < 0.3) fx1(out, `rb${Math.floor(dr * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, dr * 3.3), "#fff3b0", 10, 30, 190), base[0], base[1] + 0.2, base[2], 0.7, 0.7);
  }
};
// ---------------- 3: the scientists send it in ----------------
const sendIn = (cam: CamInfo, out: Stage, t: number) => {
  const d = dogAt(3, t)!, door: V3 = [0, 1.6, -8];
  const [a, b] = SCI3, worry = at(t, W.flames);
  standP(cam, out, 2, SCIA, a, { expr: worry ? "nervous" : "neutral", look: lookAt(cam, a[0], a[2], d.p), headTilt: -3, reach: [[230, 600], [370, 600]] }, t);
  const [tx, ty, tz] = onCard(cam.pos, a[0], a[1], a[2], 300, 590, 1, 0.12);
  fx1(out, "tab0", 300, 220, (p) => fxTablet(p, 0), tx, ty, tz, 0.36, 0.26, 0.05);
  standP(cam, out, 3, SCIB, b, { expr: at(t, W.sent) ? (worry ? "stern" : "smile") : "neutral", look: lookAt(cam, b[0], b[2], door), headTilt: -2,
    reach: at(t, W.sent) && !worry ? [null, [470, 420]] : undefined }, t);
  smoke(out, t, at(t, W.ten) ? 1.2 : 1);
  const dc = t - (W.ten - 0.05);
  if (dc > 0) { const s = pop(dc), ang = dc * 9; fx1(out, `clk${Math.floor(ang * 6) % 48}`, 256, 256, (p) => fxClock(p, ang), 0.0, 4.1, -7.5, 1.3 * s, 1.3 * s); }
};
// ---------------- 4: the stairs ----------------
const stairs = (cam: CamInfo, out: Stage, t: number) => {
  const df = t - (W.found - 0.05);
  if (df > 0) { const s = pop(df); fx1(out, "pin", 240, 320, fxPin, SX - 0.3, STAIR.y1 + 2.5 + 0.08 * Math.sin(df * 5), STAIR.landZ + 1.0, 0.6 * s, 0.8 * s); }
  const dr = t - (W.reported - 0.05);
  if (dr > 0) { const h = cam.dog!.headPos, u = (dr * 1.4) % 1; fx1(out, `wv${Math.floor(u * 16)}`, 256, 256, (p) => fxWaves(p, u, "#ffffff"), h.x + 0.3, h.y + 0.6, h.z + 0.55, 1.1, 1.1); }
};
// ---------------- 5: inside, below eighty ----------------
const inside = (cam: CamInfo, out: Stage, t: number) => {
  const h = cam.dog!.headPos, hp: V3 = [h.x, h.y, h.z];
  const d1 = t - (W.inside - 0.05);
  if (d1 > 0) { const s = pop(d1), q = off(cam, hp, -0.8, 0.45); fx1(out, "thermoHot", 160, 420, (p) => fxThermo(p, 1, true), q[0], q[1], q[2], 0.3 * s, 0.78 * s); }
  const d2 = t - (W.eighty - 0.05);
  if (d2 > 0) { const s = pop(d2), q = off(cam, hp, 0.5, 0.55), lvl = 0.25 + 0.1 * clamp01(1 - d2 * 2); fx1(out, `thermoCool${Math.round(lvl * 20)}`, 160, 420, (p) => fxThermo(p, lvl, false), q[0], q[1], q[2], 0.26 * s, 0.68 * s); }
};
// ---------------- 6: feet on fire ----------------
const feet = (cam: CamInfo, out: Stage, t: number) => {
  const d = dogAt(6, t)!, [a, b] = SCI6, shock = at(t, W.all), worry = at(t, W.first);
  const ex = shock ? "shock" : worry ? "nervous" : "neutral";
  standP(cam, out, 2, SCIA, a, { expr: ex, look: lookAt(cam, a[0], a[2], d.p), headTilt: shock ? 3 : 0, reach: shock ? [[150, 420], [450, 420]] : [[230, 600], [370, 600]] }, t);
  if (!shock) { const [tx, ty, tz] = onCard(cam.pos, a[0], a[1], a[2], 300, 590, 1, 0.12); fx1(out, "tab0", 300, 220, (p) => fxTablet(p, 0), tx, ty, tz, 0.36, 0.26, 0.05); }
  standP(cam, out, 3, SCIB, b, { expr: shock ? "shock" : ex, look: lookAt(cam, b[0], b[2], d.p), headTilt: shock ? 3 : 0, reach: shock ? [[160, 400], [440, 400]] : undefined }, t);
  smoke(out, t);
  const dg = cam.dog!, fp = dg.feet, cx = (fp[0].x + fp[1].x + fp[2].x + fp[3].x) / 4, cz = (fp[0].z + fp[1].z + fp[2].z + fp[3].z) / 4;
  const dh = t - (W.fire3 + 0.12);
  if (dh > 0) {
    const q = off(cam, [cx, 0.3, cz], -0.85, 0.1), k = (t * 2) % 1;
    fx1(out, `wt${Math.floor(k * 12)}`, 512, 160, (p) => fxWater(p, k), q[0], q[1], q[2], 1.25, 0.39, -0.12);
  }
  const ds = d.steam ?? 0;
  if (ds > 0) for (let i = 0; i < 4; i++) { const u = clamp01(((t - W.fire3 - 0.25) * 1.2 + i * 0.25) % 1); const f = fp[i];
    fx1(out, `st${Math.floor(u * 12)}`, 256, 256, (p) => fxSteam(p, u), f.x, f.y + 0.15 + 0.7 * u, f.z, 0.4 + 0.5 * u, 0.4 + 0.5 * u, 0, true); }
};
// ---------------- 7: new feet ----------------
const newFeet = (cam: CamInfo, out: Stage, t: number) => {
  const fp = cam.dog!.feet;
  if (at(t, W.newf)) { const f = fp[0]; sparkles(out, [f.x, f.y + 0.12, f.z], t, 0.16, 0.25); const g = fp[1]; sparkles(out, [g.x, g.y + 0.1, g.z], t + 0.4, 0.14, 0.22); }
  const ds = t - (W.feet2 - 0.05);
  if (ds > 0 && ds < 0.6) { const f = fp[0], s = pop(ds), q = off(cam, [f.x, f.y, f.z], 0.15, 0.5); fx1(out, "star", 256, 256, (p) => fxStar(p), q[0], q[1], q[2], 0.32 * s, 0.32 * s, 0.2); }
};
// ---------------- 8: would you send a robot dog in first? ----------------
const ending = (cam: CamInfo, out: Stage, t: number) => {
  const send = at(t, W.send), dg = cam.dog!.headPos;
  standP(cam, out, 1, FF, FF8, { expr: send ? "laugh" : at(t, W.would) ? "grin" : "smile", look: send ? 0 : lookAt(cam, FF8[0], FF8[2], [dg.x, dg.y, dg.z]), headTilt: send ? 0 : -3,
    reach: send ? [[200, 600], [450, 420]] : [[220, 600], [380, 600]] }, t);
  smoke(out, t, 0.9);
  const d = t - (W.would - 0.05);
  if (d > 0 && !send) { const s = pop(d), q = off(cam, [dg.x, dg.y, dg.z], 0.62, 0.8); fx1(out, "q", 200, 300, fxQ, q[0], q[1], q[2], 0.46 * s, 0.69 * s, -0.12); }
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  [hook, coat, sendIn, stairs, inside, feet, newFeet, ending][id - 1](cam, out, t);
  return out;
};
export { FPS };
