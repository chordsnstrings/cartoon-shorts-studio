// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import { FPS, SHOTS, W, smooth, clamp01, at, CHIPX, CHIPZ, CHIP_TOP, BENCH, ENG, BOSS, CRITIC, LAND, MELT, meltAt, runningAt } from "./story";
import { fxWaves, fxHeat, fxSparkle, fxSmoke, fxPow } from "./robot";
import { fxKnife, fxThermo, fxBolt, fxSnail, fxStopwatch, fxLaptopEgg, fxSplat } from "./props";
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

// ================= the butter short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const ENGO: Outfit = { jacket: "#f4f1ea", pants: "#3b3f52", boots: "#2b2630", hat: "hair", hair: "#3a2a20", skin: "#ecd0b6", buttons: "#9aa3b8" };
const BOSSO: Outfit = { jacket: "#2f4a7a", pants: "#2b2f3a", boots: "#2b2630", hat: "hair", hair: "#5a4a40", skin: "#f5c9a0", buttons: "#e8c45a", build: "stout" };
const CRITO: Outfit = { jacket: "#e0a23a", pants: "#4a4458", boots: "#5a3b2a", hat: "hair", hair: "#c98a3a", skin: "#ffe2c2" };
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });
/** world point of a canvas point (cx, cy) on a camera-facing card of scale s standing at (x, y, z), nudged toward the camera */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, s = 1, fwd = 0.06): [number, number, number] => {
  const dx = cam.pos.x - x, dz = cam.pos.z - z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n;
  const u = (cx - 300) * SU * s, v = (975 - cy) * SU * s;
  return [x + rx * u + (dx / n) * fwd, y + v, z + rz * u + (dz / n) * fwd];
};
/** canvas y of a world height for a card standing at y0 */
const cy = (h: number, y0 = 0) => 975 - (h - y0) / SU;
const standP = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, t: number, shadow = false) => {
  out.places.push(person(cam, who(i, o), x, y, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {}));
  if (shadow) blob(out, x, y, z, 1, 0.9);
};

/** sizzle on a melting / melted chip: smoke wisps, heat lines, splats while it collapses */
const sizzle = (out: Stage, i: number, m: number, t: number, big = 1) => {
  if (m <= 0) return;
  const x = CHIPX[i], y = CHIP_TOP + 0.04;
  for (let k = 0; k < 3; k++) {
    const u = (t * 0.9 + k / 3 + i * 0.21) % 1;
    fx1(out, `smk${Math.floor(u * 12)}`, 256, 256, (p) => fxSmoke(p, u), x - 0.03 + 0.03 * k + 0.02 * Math.sin(t * 3 + k), y + 0.03 + u * 0.32 * big, CHIPZ + 0.02, (0.07 + u * 0.14) * big, (0.07 + u * 0.14) * big, u * 2, true);
  }
  fx1(out, `heat${Math.floor(t * 12) % 12}`, 256, 256, (p) => fxHeat(p, t), x, y + 0.13 * big, CHIPZ - 0.04, 0.16 * big, 0.16 * big);
  if (m < 1) { const s = clamp01(m * 1.2); fx1(out, `spl${Math.floor(s * 10)}`, 256, 256, (p) => fxSplat(p, s), x, y + 0.02, CHIPZ + 0.06, 0.15 * big, 0.15 * big); }
};
const burstAt = (out: Stage, t: number, t0: number, x: number, y: number, z: number, w: number, col = "#fff3b0") => {
  const d = t - t0;
  if (d >= 0 && d < 0.3) fx1(out, `b${col}${Math.floor(d * 30)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), col, 9, 30, 170), x, y, z, w, w);
};

const lab = (cam: CamInfo, out: Stage, id: number, t: number) => {
  // butter sizzle wherever a chip is melting / melted
  for (let i = 0; i < 4; i++) sizzle(out, i, meltAt(id, i, t), t, id === 4 ? 1 : 0.8);
  if (id === 1) {
    // the engineer crouched behind the bench at butter height, shocked; a butter-sizzle burst on "butter"
    const x = CHIPX[0] + 0.02, y = -0.26, z = -1.4;
    standP(cam, out, 1, ENGO, x, y, z, { expr: at(t, W.butter) ? "laugh" : "shock", look: -0.3, tilt: -3, headTilt: 5, reach: [[200, cy(BENCH.h + 0.12, y)], [400, cy(BENCH.h + 0.12, y)]] }, t);
    burstAt(out, t, W.butter - 0.05, CHIPX[0], CHIP_TOP + 0.08, CHIPZ + 0.05, 0.3);
    if (t < 0.25) fx1(out, `pw${Math.floor(t * 30)}`, 512, 512, (p) => fxPow(p, 0.4 + t), CHIPX[0], CHIP_TOP + 0.07, CHIPZ + 0.04, 0.16, 0.16);
    return;
  }
  if (id === 2) {
    // knife in hand, the knobs land one by one with a pop
    const next = LAND.findIndex((l) => t < l), tgt = next < 0 ? 3 : next;
    const hx = Math.max(120, Math.min(480, 300 + (CHIPX[tgt] - ENG[0]) / SU * 0.55));
    const hand: [number, number] = [hx, cy(BENCH.h + 0.1) - 30 * Math.max(0, Math.sin(t * 9))];
    standP(cam, out, 1, ENGO, ENG[0], 0, ENG[2], { expr: "smile", look: -0.2, reach: [null, hand] }, t);
    const [kx, ky, kz] = onCard(cam, ENG[0], 0, ENG[2], hand[0] + 40, hand[1] - 10, 1, 0.12);
    fx1(out, "knife", 256, 256, fxKnife, kx, ky, kz, 0.24, 0.24, 0.5);
    standP(cam, out, 2, BOSSO, BOSS[0], 0, BOSS[2], { expr: "smile", look: -0.5 }, t);
    LAND.forEach((l, i) => { const d = t - l; if (d >= 0 && d < 0.3) fx1(out, `sp${Math.floor(d * 30)}`, 256, 256, (p) => fxSparkle(p, 1 - d * 3), CHIPX[i], CHIP_TOP + 0.1, CHIPZ + 0.05, 0.12, 0.12); });
    return;
  }
  if (id === 3) {
    const press = at(t, W.ran) && t < W.ran + 0.5;
    standP(cam, out, 2, BOSSO, BOSS[0], 0, BOSS[2], { expr: at(t, W.ran) ? "grin" : "smile", look: -0.4, reach: [null, at(t, W.ran - 0.25) && t < W.ran + 0.6 ? [300, cy(BENCH.h + (press ? 0.07 : 0.14))] : [330, cy(BENCH.h + 0.25)]] }, t);
    standP(cam, out, 1, ENGO, ENG[0], 0, ENG[2], { expr: at(t, W.exact) ? "grin" : "smile", look: 0.4 }, t);
    burstAt(out, t, W.ran, 1.49, BENCH.h + 0.12, -0.53, 0.26, "#ff9a7a");
    if (runningAt(3, t)) CHIPX.forEach((x, i) => { const u = (t * 1.3 + i * 0.25) % 1; fx1(out, `w${Math.floor(u * 20)}`, 256, 256, (p) => fxWaves(p, u), x, CHIP_TOP + 0.13, CHIPZ, 0.2, 0.2); });
    return;
  }
  if (id === 4) {
    for (let i = 0; i < 3; i++) if (t >= MELT[i] && t < MELT[i] + 0.25) fx1(out, `pw${i}${Math.floor((t - MELT[i]) * 30)}`, 512, 512, (p) => fxPow(p, (t - MELT[i]) * 3.2), CHIPX[i], CHIP_TOP + 0.07, CHIPZ + 0.08, 0.2, 0.2);
    return;
  }
  if (id === 5) {
    // the engineer leans in over the last chip and pokes the solid butter with her knife
    const x = CHIPX[3] - 0.22, y = 0, z = -1.22, poke = at(t, W.didnt);
    const hand: [number, number] = poke ? [395 + 10 * Math.sin(t * 14), cy(CHIP_TOP + 0.16, y)] : [380, cy(BENCH.h + 0.25, y)];
    standP(cam, out, 1, ENGO, x, y, z, { expr: at(t, W.soften) ? "grin" : at(t, W.last) ? "shock" : "nervous", look: 0.5, tilt: 5, headTilt: -4, reach: [[220, cy(BENCH.h + 0.1, y)], hand] }, t);
    const kx = CHIPX[3] - 0.07 - (poke ? 0.015 * (1 + Math.sin(t * 14)) : 0.06), ky = CHIP_TOP + (poke ? 0.08 : 0.16), kz = CHIPZ + 0.04;
    fx1(out, "knifeD", 256, 256, fxKnife, kx, ky, kz, 0.17, 0.17, -0.55);
    for (let k = 0; k < 3; k++) { const d = t - (W.soften - 0.05 + k * 0.12); if (d >= 0 && d < 0.6) { const s = Math.sin(Math.min(1, d / 0.6) * Math.PI); fx1(out, `cs${Math.floor(s * 10)}`, 256, 256, (p) => fxSparkle(p, s), CHIPX[3] - 0.05 + 0.06 * k, CHIP_TOP + 0.09 + 0.05 * (k % 2), CHIPZ + 0.08, 0.13, 0.13); } }
    return;
  }
  if (id === 6) {
    const cheer = at(t, W.runs);
    const up = smooth((t - (W.runs - 0.07)) / 0.3);
    standP(cam, out, 2, BOSSO, 1.12, 0, -1.3, { expr: cheer ? "laugh" : "grin", look: -0.3, reach: cheer ? [[200 - 40 * up, 520 - 260 * up], [400 + 40 * up, 520 - 260 * up]] : [null, null] }, t);
    // thermometers: hot chip vs the cool one
    const d = t - (W.forty - 0.07);
    if (d > 0) {
      const pop = d < 0.25 ? Math.sin((d / 0.25) * Math.PI * 0.5) * 1.12 : 1, lv = smooth(d / 0.6);
      fx1(out, `th1${Math.floor(lv * 20)}`, 128, 384, (p) => fxThermo(p, 0.95 * lv, true), CHIPX[2] + 0.06, CHIP_TOP + 0.2, CHIPZ + 0.18, 0.12 * pop, 0.36 * pop);
      fx1(out, `th2${Math.floor(lv * 20)}`, 128, 384, (p) => fxThermo(p, 0.2 * lv, false), CHIPX[3] - 0.3, CHIP_TOP + 0.2, CHIPZ + 0.18, 0.12 * pop, 0.36 * pop);
    }
    const db = t - (W.five - 0.07);
    if (db > 0) { const pop = db < 0.25 ? Math.sin((db / 0.25) * Math.PI * 0.5) * 1.15 : 1; fx1(out, "bolt", 256, 256, fxBolt, CHIPX[3] + 0.1, CHIP_TOP + 0.16 + 0.01 * Math.sin(t * 5), CHIPZ + 0.2, 0.16 * pop, 0.16 * pop); }
    return;
  }
  if (id === 7) {
    // the critic, unimpressed, raises a stopwatch on "speed"; the boss sweats behind; on "lazy" a sleepy snail reaches the cool chip
    const lift = at(t, W.speed) ? smooth((t - W.speed + 0.07) / 0.25) : 0;
    const hand: [number, number] = [150, 600 - 130 * lift];
    standP(cam, out, 3, CRITO, CRITIC[0], 0, CRITIC[2], { expr: at(t, W.missing) ? "stern" : "neutral", look: -0.6, headTilt: 4, reach: [hand, null] }, t, true);
    const [sx, sy, sz] = onCard(cam, CRITIC[0], 0, CRITIC[2], hand[0], hand[1] - 60, 1, 0.1);
    fx1(out, `sw${Math.floor(t * 8) % 16}`, 256, 256, (p) => fxStopwatch(p, t * 3), sx, sy, sz, 0.2, 0.2);
    standP(cam, out, 2, BOSSO, 0.5, 0, BOSS[2], { expr: at(t, W.speed) ? "nervous" : "smile", look: 0.5 }, t);
    const u = clamp01((t - (W.lazy - 1.3)) / 2.2);
    if (u > 0) fx1(out, `sn${Math.floor(t * 6) % 6}`, 384, 256, (p) => fxSnail(p, t * 1.5), CHIPX[3] + 0.17 - 0.07 * u, BENCH.h + 0.04 + 0.012 * smooth(u * 3), CHIPZ + 0.12, 0.13, 0.087);
    return;
  }
  // 8: the engineer with her laptop: an egg fries on it
  const x = ENG[0] + 0.05, z = -1.3, egg = clamp01((t - (W.laptop - 0.1)) / 0.5);
  standP(cam, out, 1, ENGO, x, 0, z, { expr: at(t, W.send) ? "laugh" : "grin", look: 0.1, reach: [[205, 500], [395, 500]] }, t);
  const [lx, ly, lz] = onCard(cam, x, 0, z, 300, 455, 1, 0.2);
  fx1(out, `lap${egg > 0 ? Math.floor(t * 10) % 10 : "x"}${Math.floor(egg * 10)}`, 512, 384, (p) => fxLaptopEgg(p, t, egg), lx, ly, lz, 0.48, 0.36);
  if (egg > 0.3) for (let k = 0; k < 2; k++) { const u = (t * 0.9 + k / 2) % 1; fx1(out, `ls${Math.floor(u * 12)}`, 256, 256, (p) => fxSmoke(p, u), lx + 0.2 + 0.03 * k, ly + 0.02 + u * 0.22, lz + 0.03, 0.08 + u * 0.14, 0.08 + u * 0.14, u * 2, true); }
  burstAt(out, t, W.egg - 0.05, lx, ly + 0.02, lz + 0.03, 0.3);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  lab(cam, out, id, t);
  return out;
};
export { FPS };
