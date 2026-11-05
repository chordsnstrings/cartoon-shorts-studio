// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import {
  FPS, SHOTS, W, smooth, clamp01, at, YT, ST, MAP, SPOT, CAM_HEAD, riverPlanes, mapPlanes, ambX,
} from "./story";
import { fxPulse, fxSparkle, fxGlow } from "./sat";
import { mapDots } from "./build";
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

// ================= the sky-clue short's cast =================
const YTO: Outfit = { jacket: "#2fa39a", pants: "#3b3f52", boots: "#efece4", hat: "hair", hair: "#2a2020", skin: "#e8b48a" };
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const PHONES = "#e8483c";

/** Doppler rings around a moving source (512 x 512): wave fronts emitted earlier are bigger and their centres trail
 *  behind, so the rings bunch up in front (dir +1 = moving to screen right) */
const fxDoppler = (p: Pen, ph: number, dir: number, col = "#ffffff") => {
  for (let k = 0; k < 5; k++) {
    const a = (k + ph) / 5, r = 24 + 205 * a, cx = 256 - dir * 175 * a;
    p.g.globalAlpha = 0.95 * (1 - a) ** 0.8;
    p.arc(cx, 256, r, r, 0, 360, 13 * (1 - a) + 4, col);
  }
  p.g.globalAlpha = 1;
};
/** a little round bird (256 x 256); wing 0 folded .. 1 up */
const fxBird = (p: Pen, wing: number, look: number) => {
  p.ell(128, 150, 62, 52, "#5a8ad8", 7);
  p.ell(140, 168, 34, 26, "#cfe0f4", 0);
  p.ell(150 + 8 * look, 128, 9, 9, INK, 0);
  p.poly([[186, 130], [222, 140], [186, 150]], "#f2a03a", 5);
  p.poly([[70, 140], [40, 120 - 60 * wing], [100, 128]], "#3f6ab8", 6);
  p.stroke([[110, 198], [104, 228]], 6, INK); p.stroke([[146, 198], [150, 228]], 6, INK);
};
/** a wall-calendar page: grid of squares, one circled in red, no numbers (256 x 300) */
const fxCalendar = (p: Pen) => {
  p.poly(rrect(20, 30, 236, 280, 14), "#fbfaf4", 8);
  p.poly(rrect(20, 30, 236, 86, 14), "#e8483c", 0);
  p.stroke([[20, 86], [236, 86]], 6, INK);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) p.poly(rrect(36 + j * 40, 104 + i * 42, 66 + j * 40, 136 + i * 42, 4), "#e3e2da", 0);
  p.arc(36 + 2 * 40 + 15, 104 + 1 * 42 + 16, 24, 22, 0, 360, 7, "#e8483c");
  for (const x of [70, 186]) { p.ell(x, 30, 10, 18, "#9aa3ad", 5); }
};
/** magnifying glass (256 x 256) */
const fxLens = (p: Pen) => {
  p.stroke([[160, 160], [230, 230]], 30, INK); p.stroke([[160, 160], [228, 228]], 20, "#8a5a34");
  p.ell(110, 110, 76, 76, "rgba(190,230,255,0.35)", 12);
  p.arc(90, 90, 40, 40, 200, 260, 8, "#ffffff");
};
/** flat ring for the map (512 x 512) */
const fxRingFlat = (p: Pen, u: number, col: string) => { p.g.globalAlpha = 1 - u; p.arc(256, 256, 30 + 210 * u, 30 + 210 * u, 0, 360, 18 * (1 - u) + 6, col); p.g.globalAlpha = 1; };

const ytSeated = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => {
  out.places.push(person(cam, who(1, YTO), YT[0], 0.33, YT[2], { side: false, mirror: false }, { mode: "sit", look: 0.55, ...fo, blink: lidAt(t, 1) }, {}));
};

const desk = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 3) ytSeated(cam, out, t, { expr: at(t, W.trees) ? "grin" : "smile" });
  else if (id === 5) ytSeated(cam, out, t, { expr: at(t, W.two) ? "shock" : at(t, W.hidden) ? "nervous" : "neutral", phones: PHONES, headTilt: at(t, W.hidden) ? 5 : 0 });
  else if (id === 6) ytSeated(cam, out, t, { expr: at(t, W.code) ? "dazed" : at(t, W.wrote) ? "grin" : at(t, W.gigabytes) ? "shock" : "smile", phones: PHONES, look: at(t, W.wrote) ? 0.55 : -0.2 });
  else if (id === 12) {
    const shrug = at(t, W.slim) ? smooth((t - (W.slim - 0.1)) / 0.25) : 0;
    ytSeated(cam, out, t, { expr: at(t, W.slim) ? "smile" : "smile_closed", look: 0, reach: shrug > 0.05 ? [[300 - 70 - 90 * shrug, 690 - 60 * shrug], [300 + 70 + 90 * shrug, 690 - 60 * shrug]] : undefined, headTilt: 6 * shrug });
  }
  // sparkles when the streaks light up are on the screen itself; drives get little impact puffs
  if (id === 6 && t > W.gigabytes && t < W.gigabytes + 1.6) {
    const k = Math.floor((t - W.gigabytes) * 12);
    out.fx.push({ key: `dspk${k % 6}`, cw: 128, ch: 128, draw: (p) => fxSparkle(p, k), x: YT[0] - 0.05, y: 0.95 + 0.05 * Math.sin(k), z: YT[2] + 0.45, w: 0.08, h: 0.08 });
  }
};

const river = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const planes = riverPlanes(t).filter((p) => p.vis);
  if (id === 2 && planes[0]) { // inaudible: faint rings drifting down from the plane to the camera's microphone
    for (let k = 0; k < 3; k++) {
      const u = ((t - 3.35) * 0.55 + k / 3) % 1, p0 = planes[0].p;
      out.fx.push({ key: `fall${Math.floor(t * 10) % 10}`, cw: 512, ch: 512, draw: (p) => fxPulse(p, (t * 1.2 + k * 0.3) % 1, "#ffffff"),
        x: p0[0] + (CAM_HEAD[0] - p0[0]) * u, y: p0[1] + (CAM_HEAD[1] + 0.6 - p0[1]) * u, z: p0[2] + (CAM_HEAD[2] - p0[2]) * u, w: 30 * (1 - u) + 1.2, h: 30 * (1 - u) + 1.2, soft: true });
    }
  }
  if (id === 15) for (const pl of planes) {
    const dir = Math.sign(Math.sin(pl.yaw) * cam.right.x + Math.cos(pl.yaw) * cam.right.z) || 1, ph = (t * 1.6) % 1, low = pl.p[1] < 50;
    out.fx.push({ key: `dop${dir}|${Math.floor(ph * 12)}`, cw: 512, ch: 512, draw: (p) => fxDoppler(p, Math.floor(ph * 12) / 12, dir), x: pl.p[0], y: pl.p[1], z: pl.p[2], w: low ? 46 : 70, h: low ? 46 : 70, soft: true });
  }
  if (id === 18) { // a bird lands on the camera
    const d = t - 66.4, k = smooth(d / 0.6);
    if (d > 0) {
      const x = CAM_HEAD[0] - 1.6 * (1 - k), y = CAM_HEAD[1] + 0.2 + 0.9 * (1 - k) ** 2, z = CAM_HEAD[2] + 0.05 + 0.5 * (1 - k);
      const wing = d < 0.6 ? Math.floor(t * 16) % 2 : 0, look = t > 67.3 && Math.floor(t * 1.5) % 2 ? -1 : 0;
      out.fx.push({ key: `bird${wing}${look}`, cw: 256, ch: 256, draw: (p) => fxBird(p, wing, look), x, y, z, w: 0.28, h: 0.28 });
    }
  }
};

let DOTS: [number, number, number][] | null = null;
const map = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 4) {
    if (at(t, W.september)) { const k = easeIn((t - (W.september - 0.07)) / 0.25); out.fx.push({ key: `cal`, cw: 256, ch: 300, draw: fxCalendar, x: MAP + 4, y: 14 + 1.5 * Math.sin(t * 2), z: -6, w: 14 * k, h: 16.4 * k }); }
    if (at(t, W.somewhere)) { const u = t - W.somewhere; out.fx.push({ key: `lens`, cw: 256, ch: 256, draw: fxLens, x: MAP - 40 + 60 * Math.sin(u * 1.4), y: 12, z: -8 + 14 * Math.sin(u * 2.1), w: 36, h: 36 }); }
  }
  if (id === 9 || id === 10) {
    DOTS = DOTS ?? mapDots(5000, [SPOT[0] - MAP, SPOT[2]]);
    if (id === 9) {
      let n = 0;
      for (let i = 0; i < DOTS.length && n < 26; i++) {
        const [x, z, h] = DOTS[i];
        if (i !== 0 && h >= 0.2) continue;
        if (Math.hypot(MAP + x - SPOT[0], z - SPOT[2]) > 34) continue;
        n++;
        const u = (t * 0.9 + h * 7) % 1;
        out.fx.push({ key: `rf${Math.floor(u * 12)}`, cw: 512, ch: 512, draw: (p) => fxRingFlat(p, Math.floor(u * 12) / 12, "#fff6c0"), x: MAP + x, y: 0.3, z, w: 7, h: 7, flat: true, soft: true });
      }
    } else if (at(t, W.one)) {
      for (let k = 0; k < 3; k++) { const u = ((t - W.one) * 0.9 + k / 3) % 1; out.fx.push({ key: `rs${Math.floor(u * 12)}`, cw: 512, ch: 512, draw: (p) => fxRingFlat(p, Math.floor(u * 12) / 12, "#ff7a5a"), x: SPOT[0], y: 0.35, z: SPOT[2], w: 14, h: 14, flat: true, soft: true }); }
      out.fx.push({ key: `spotglow`, cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,200,150,0.9)"), x: SPOT[0], y: 1.2, z: SPOT[2], w: 2.6 + Math.max(0, 4 - (t - W.one) * 12), h: 2.6 + Math.max(0, 4 - (t - W.one) * 12), soft: true });
    }
  }
  if (id === 16 && at(t, W.broadcast)) for (const pl of mapPlanes(t, id)) {
    if (!pl.vis) continue;
    const u = (t * 1.3 + pl.p[0] * 0.013) % 1;
    out.fx.push({ key: `bc${Math.floor(u * 12)}`, cw: 512, ch: 512, draw: (p) => fxPulse(p, Math.floor(u * 12) / 12, "#9ff3ff"), x: pl.p[0], y: pl.p[1], z: pl.p[2], w: 12, h: 12, soft: true });
  }
};
const easeIn = (u: number) => { const x = clamp01(u); return x < 1 ? x * (1 + 0.5 * Math.sin(x * Math.PI)) : 1; };

const street = (cam: CamInfo, out: Stage, t: number) => {
  const ears = t > W.siren - 0.1 && t < 51.7;
  const ex: Expr = ears ? (Math.abs(ambX(t) - ST) < 6 ? "pained" : "nervous") : t > 51.7 ? "smile" : "neutral";
  const look = Math.max(-0.8, Math.min(0.8, (ambX(t) - ST) / 10));
  out.places.push(person(cam, who(1, YTO), ST + 0.3, 0.15, 1.3, { side: false, mirror: false }, { mode: "stand", expr: ex, look, blink: lidAt(t, 1), reach: ears ? [[190, 322], [410, 322]] : undefined }, {}));
  blob(out, ST + 0.3, 0.15, 1.3, 1, 0.9);
  const dir = Math.sign(cam.right.x) || 1, ph = (t * 2.2) % 1;
  out.fx.push({ key: `adop${dir}|${Math.floor(ph * 12)}`, cw: 512, ch: 512, draw: (p) => fxDoppler(p, Math.floor(ph * 12) / 12, dir, "#ff6a50"), x: ambX(t) + 0.6, y: 1.7, z: -2.0, w: 10, h: 10, soft: true });
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "desk") desk(cam, out, id, t);
  else if (s.place === "river") river(cam, out, id, t);
  else if (s.place === "map") map(cam, out, id, t);
  else street(cam, out, t);
  return out;
};
export { FPS };
