// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import { FPS, V3, SHOTS, W, smooth, clamp01, easeOut, at, HILL, satAt, faceAt, chipsAt, trainK, ASTRO, GALAXY, REG } from "./story";
import { hillY } from "./build";
import { drawSat, fxSparkle, fxGlow } from "./sat";
import { rrect, ellPts, P2 } from "./toon";
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
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; up?: THREE.Vector3; fwd?: THREE.Vector3; sun?: THREE.Vector3 };

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

// ================= the Million short's cast =================
const ASTRO_O: Outfit = { jacket: "#3f7f6a", pants: "#3b3f52", boots: "#5a3b2a", hat: "cap", cap: "#d9483c", skin: "#f5c9a0" };
const REG_O: Outfit = { jacket: "#3a4466", pants: "#2e3346", boots: "#2a2020", hat: "hair", hair: "#4a3a30", skin: "#ecd0b6", build: "stout" };
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const standing = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number, shadow = true, lift = 0, y = 0) => {
  const pl = person(cam, who(i, o), x, y + lift, z, { side: false, mirror: false }, { mode: "stand", ...fo, blink: lidAt(t, i) }, {});
  out.places.push(pl);
  if (shadow) blob(out, x, y, z, 1, lift > 0 ? 0.6 : 0.9);
  return pl;
};
const seated = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, z: number, fo: FrontOpts, t: number, lift = 0) => {
  out.places.push(person(cam, who(i, o), x, 0.33 + lift, z, { side: false, mirror: false }, { mode: "sit", ...fo, blink: lidAt(t, i) }, {}));
};
/** world point of a canvas point (cx, cy) on an upright camera-facing card standing at (x, y, z), pulled `fwd` m toward the lens */
const onCard = (cam: CamInfo, x: number, y: number, z: number, cx: number, cy: number, fwd = 0.05, sc = 1): V3 => {
  const yaw = Math.atan2(cam.pos.x - x, cam.pos.z - z), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = (cx - 300) * SU * sc, fx = Math.sin(yaw) * fwd, fz = Math.cos(yaw) * fwd;
  return [x + rx * dx + fx, y + (975 - cy) * SU * sc, z + rz * dx + fz];
};
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });

// ---------------- effect cards (no text anywhere) ----------------
/** a satellite in the night sky (64 x 256): bright round head at the top, a fading tail below */
const fxTrain = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(0, 30, 0, 250);
  gr.addColorStop(0, "rgba(220,240,255,0.95)"); gr.addColorStop(1, "rgba(160,200,255,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(22, 32); g.lineTo(42, 32); g.lineTo(34, 250); g.lineTo(30, 250); g.fill();
  const hg = g.createRadialGradient(32, 32, 0, 32, 32, 30); hg.addColorStop(0, "rgba(255,255,255,1)"); hg.addColorStop(0.45, "rgba(255,255,255,1)"); hg.addColorStop(1, "rgba(200,225,255,0)");
  g.fillStyle = hg; g.beginPath(); g.arc(32, 32, 30, 0, 6.283); g.fill();
};
/** a soft spiral galaxy (512 x 512) */
const fxGalaxy = (p: Pen) => {
  const g = p.g;
  const core = g.createRadialGradient(256, 256, 0, 256, 256, 120); core.addColorStop(0, "rgba(255,246,220,1)"); core.addColorStop(0.3, "rgba(255,220,180,0.8)"); core.addColorStop(1, "rgba(180,150,255,0)");
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 260; i++) {
    const u = i / 260, a = arm * Math.PI + u * 7.5, r = 18 + u * 210;
    const x = 256 + r * Math.cos(a), y = 256 + r * Math.sin(a) * 0.62, s = 26 * (1 - u) + 6;
    const gg = g.createRadialGradient(x, y, 0, x, y, s); gg.addColorStop(0, `rgba(${u < 0.5 ? "190,170,255" : "140,190,255"},${(0.22 * (1 - u * 0.6)).toFixed(2)})`); gg.addColorStop(1, "rgba(140,170,255,0)");
    g.fillStyle = gg; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
  }
  g.fillStyle = core; g.beginPath(); g.arc(256, 256, 120, 0, 6.283); g.fill();
  for (let i = 0; i < 60; i++) { const a = i * 2.39, r = 30 + (i * 37) % 200; g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(256 + r * Math.cos(a), 256 + r * Math.sin(a) * 0.62, 1.8, 0, 6.283); g.fill(); }
};
/** the eyepiece ring (512 x 512): black with a round hole (hard cut) and a thin dark-grey rim */
const fxEyepiece = (p: Pen) => {
  const g = p.g; g.fillStyle = "#05060a"; g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(256, 256, 120, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over";
  g.strokeStyle = "#2a2e3a"; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 122, 0, 6.283); g.stroke();
};
/** a thought bubble with a glowing AI chip inside (512 x 512) */
const fxChipBubble = (p: Pen, t: number) => {
  p.ell(430, 478, 18, 16, "#fbfaf4", 6); p.ell(392, 418, 28, 24, "#fbfaf4", 7);
  const bub = ellPts(300, 220, 190, 165);
  p.poly(bub, "#fbfaf4", 9);
  // the chip: dark square, silver pins, glowing circuit lines + core
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const o = -54 + i * 36;
    p.stroke([[300 + o, 220 + s * 72], [300 + o, 220 + s * 100]], 10, "#b9c0cf");
    p.stroke([[300 + s * 72, 220 + o], [300 + s * 100, 220 + o]], 10, "#b9c0cf");
  }
  p.poly(rrect(222, 142, 378, 298, 16), "#2b303c", 8);
  const pulse = 0.6 + 0.4 * Math.sin(t * 9);
  const glow = `rgba(130,255,150,${pulse.toFixed(2)})`;
  for (const [a, b] of [[[240, 180], [280, 180]], [[320, 260], [360, 260]], [[240, 262], [262, 240]], [[338, 160], [360, 182]]] as P2[][]) p.stroke([a, b], 7, glow);
  p.poly(rrect(270, 190, 330, 250, 10), "#9dff8a", 0);
  p.poly(rrect(282, 202, 318, 238, 6), "#e8ffe0", 0);
};
/** sun rays fanning in from the upper right (512 x 512) */
const fxRays = (p: Pen, k: number) => {
  const g = p.g; g.globalAlpha = 0.85 * k;
  for (let i = 0; i < 6; i++) {
    const a0 = 2.35 + i * 0.16, a1 = a0 + 0.07;
    g.fillStyle = i % 2 ? "rgba(255,236,150,0.75)" : "rgba(255,220,110,0.6)";
    g.beginPath(); g.moveTo(512, 0); g.lineTo(512 + 720 * Math.cos(a0), 720 * Math.sin(a0)); g.lineTo(512 + 720 * Math.cos(a1), 720 * Math.sin(a1)); g.fill();
  }
  g.globalAlpha = 1;
};
/** the astronomers' complaint (256 x 320): a sheet with a telescope + star drawing and a few bars (no text) */
const fxPaper = (p: Pen) => {
  p.poly([[16, 12], [240, 12], [240, 308], [16, 308]], "#fbf6ea", 7);
  p.stroke([[70, 190], [168, 110]], 22, "#3a64b8"); p.stroke([[110, 160], [92, 236]], 6, "#3a3f4c"); p.stroke([[110, 160], [140, 236]], 6, "#3a3f4c");
  const st: P2[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 10 : 24, a = (-90 + i * 36) * Math.PI / 180; st.push([196 + r * Math.cos(a), 60 + r * Math.sin(a)]); }
  p.poly(st, "#f2c43a", 4);
  for (let i = 0; i < 3; i++) p.poly(rrect(40, 250 + i * 16, 40 + 170 - i * 40, 258 + i * 16, 4), "#9aa3b8", 0);
};
/** shrug lines (128 x 128): three short ink ticks fanning out beside a shoulder (side -1 left, +1 right) */
const fxShrug = (p: Pen, side: number) => {
  for (let i = 0; i < 3; i++) { const a = (-0.9 + i * 0.45) * side + (side < 0 ? Math.PI : 0); p.stroke([[64 + 22 * Math.cos(a), 64 + 22 * Math.sin(a)], [64 + 54 * Math.cos(a), 64 + 54 * Math.sin(a)]], 9, INK); }
};
/** a question mark bubble (192 x 256), drawn as a hook + dot, no font */
const fxQuestion = (p: Pen) => {
  p.ell(96, 110, 84, 96, "#fbfaf4", 8);
  const hook: P2[] = []; for (let k = 0; k <= 14; k++) { const a = Math.PI * 1.1 - k * (Math.PI * 1.35) / 14; hook.push([96 + 30 * Math.cos(a), 92 - 30 * Math.sin(a)]); }
  hook.push([96, 132]);
  p.stroke(hook, 15, "#3a64b8"); p.dot(96, 166, 10, "#3a64b8");
};
/** a cartoon "poof" of a few dark-grey puffs (300 x 300), for the dead satellite's last sputter */
const fxPuffBig = (p: Pen, seed: number, col = "#f4efe6", col2 = "#d9d3c8") => {
  for (let i = 0; i < 6; i++) { const a = seed + i * 1.05, r = 50 + 20 * Math.sin(i * 2.1 + seed); p.ell(150 + 62 * Math.cos(a), 156 + 40 * Math.sin(a), r, r * 0.85, i % 2 ? col : col2, 0); }
  p.ell(150, 150, 74, 64, col, 0);
};

// ---------------- the satellite trains in the night sky ----------------
const SKY_R = 160;
type Train = { u: V3; v: V3; th0: number; w: number; n: number; gap: number };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const TRAINS: Train[] = (() => {
  const out: Train[] = [];
  let sd = 4242; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // six trains that cross the galaxy (the eyepiece view, shot 6) at 17.35-18.9 s
  const gd = norm([GALAXY[0] - HILL, GALAXY[1], GALAXY[2]]);
  for (let j = 0; j < 6; j++) {
    const n = norm(cross(gd, norm([rnd() - 0.5, rnd() * 0.3, rnd() - 0.5])));
    const u = gd, v = norm(cross(n, u)), w = 0.05 + 0.02 * rnd();
    const tc = 17.6 + j * 0.22; // the head reaches the galaxy at tc
    out.push({ u, v, th0: -w * tc, w, n: 6 + (j % 3), gap: 0.022 });
  }
  // the rest: great circles through random points of the sky in front of the hill cameras (looking toward -z, 12-75 deg up),
  // all drifting the same general way (left to right) like real satellite trains
  for (let j = 0; j < 46; j++) {
    const az = (rnd() - 0.5) * 2.0, el = 0.2 + rnd() * 1.1;
    const pnt: V3 = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
    const tang = norm([1, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4]);
    const n = norm(cross(pnt, tang)), u = pnt, v = norm(cross(n, u)), w = 0.035 + 0.03 * rnd();
    out.push({ u, v, th0: -w * (rnd() * 34) + (rnd() - 0.5) * 0.6, w, n: 7 + Math.floor(rnd() * 8), gap: 0.016 + 0.01 * rnd() });
  }
  return out;
})();
const skyTrains = (cam: CamInfo, out: Stage, k: number, t: number, big = 1) => {
  if (k <= 0.001 || !cam.up) return;
  const nT = Math.round(6 + (TRAINS.length - 6) * k);
  if (nT <= 0) return;
  for (let j = 0; j < nT; j++) {
    const T = TRAINS[j];
    for (let i = 0; i < T.n; i++) {
      const th = T.th0 + T.w * t - T.gap * i, c = Math.cos(th), s = Math.sin(th);
      const d: V3 = [T.u[0] * c + T.v[0] * s, T.u[1] * c + T.v[1] * s, T.u[2] * c + T.v[2] * s];
      if (d[1] < 0.12) continue;
      const vel: V3 = [-T.u[0] * s + T.v[0] * c, -T.u[1] * s + T.v[1] * c, -T.u[2] * s + T.v[2] * c];
      const vx = vel[0] * cam.right.x + vel[1] * cam.right.y + vel[2] * cam.right.z, vy = vel[0] * cam.up.x + vel[1] * cam.up.y + vel[2] * cam.up.z;
      const rot = Math.atan2(vy, vx) - Math.PI / 2;
      const sz = 2.3 * big;
      fx1(out, "train", 64, 256, fxTrain, HILL + SKY_R * d[0], SKY_R * d[1], SKY_R * d[2], sz, sz * 4.5, rot, true);
    }
  }
};

// ---------------- the hero satellite ----------------
const SAT_DY = (975 - 640) * SU;
const sat = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const pa = satAt(id, t);
  if (!pa) return null;
  const { c, s, tilt, wings } = pa, face = faceAt(id, t);
  const d = cam.pos.distanceTo(tmp.set(c[0], c[1], c[2])) / s, [w, h, k] = tier(d);
  const light = light2D(cam, false), blinkable = face === "happy" || face === "curious";
  const pose = { face, wings, chips: chipsAt(id, t), nozzle: false, blink: blinkable ? lidAt(t, 90) : 0, light, tilt: q(tilt, 30) };
  out.places.push({ key: "sat|" + fkey(pose), x: c[0], y: c[1] - SAT_DY * s, z: c[2], scale: s, size: [w, h, k], draw: (p) => drawSat(p, pose as never) });
  return { c, s };
};

// ---------------- places ----------------
const space = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const pr = sat(cam, out, id, t);
  if (!pr) return;
  const { c, s } = pr;
  if (id === 3) {
    if (at(t, W.computer)) { // the thought bubble with the chip pops up and right of the antenna
      const dd = t - (W.computer - 2 / FPS), pop = dd < 0.15 ? 0.5 + 3.3 * dd : 1 + 0.08 * Math.exp(-dd * 7) * Math.sin(dd * 26);
      fx1(out, `chipB|${Math.floor(t * 10) % 6}`, 512, 512, (p) => fxChipBubble(p, Math.floor(t * 10) / 10), c[0] - 0.12 * s, c[1] + 0.86 * s, c[2] + 0.05, 0.58 * s * pop, 0.58 * s * pop);
    }
    const rk = smooth((t - (W.sunshine - 0.2)) / 0.4);
    if (rk > 0) { // sun rays onto the panels + glints
      fx1(out, `rays|${Math.round(rk * 10)}`, 512, 512, (p) => fxRays(p, rk), c[0] + 0.15 * s, c[1] + 0.3 * s, c[2] - 0.4, 3.2 * s, 3.2 * s, 0, true);
      for (let i = 0; i < 4; i++) { const sx = (i % 2 ? 1 : -1) * (0.42 + 0.12 * (i >> 1)) * s, sy = (0.08 - 0.16 * (i >> 1)) * s, kk = Math.floor(t * 12 + i) % 5; fx1(out, `spk|${kk}`, 128, 128, (p) => fxSparkle(p, kk), c[0] + sx, c[1] + sy, c[2] + 0.08, 0.2 * s * rk, 0.2 * s * rk); }
    }
  }
  if (id === 9) {
    if (at(t, W.where)) { // two question marks pop beside the tumbling satellite
      [0, 1].forEach((i) => {
        const dd = t - (W.where - 2 / FPS) - i * 0.25; if (dd < 0) return;
        const pop = dd < 0.12 ? 0.5 + 4 * dd : 1 + 0.08 * Math.exp(-dd * 7) * Math.sin(dd * 26);
        fx1(out, "qm", 192, 256, fxQuestion, c[0] + (i ? -0.42 : 0.45) * s, c[1] + (0.38 + 0.1 * i) * s, c[2] + 0.1, 0.36 * s * pop, 0.48 * s * pop, i ? 0.25 : -0.2);
      });
    }
    // a last little grey sputter puff drifting off the body
    const u = ((t - 23.6) * 0.7) % 1;
    fx1(out, `puff|${Math.floor(u * 10)}`, 300, 300, (p) => fxPuffBig(p, 3, `rgba(190,186,180,${(0.85 * (1 - u)).toFixed(1)})`, `rgba(160,156,150,${(0.85 * (1 - u)).toFixed(1)})`), c[0] - 0.45 * s - 0.3 * u, c[1] + 0.2 * s + 0.4 * u, c[2] - 0.1, 0.14 + 0.2 * u, 0.12 + 0.18 * u, 0, true);
  }
};
const hill = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const k = trainK(id, t);
  if (id === 6) { // the eyepiece view: the galaxy, the trains crossing it, the black ring in front of the lens
    fx1(out, "galaxy", 512, 512, fxGalaxy, GALAXY[0], GALAXY[1], GALAXY[2], 46, 46, 0.4, true);
    skyTrains(cam, out, k, t, 1.1);
    if (cam.fwd) { const p = cam.pos.clone().addScaledVector(cam.fwd, 0.6); fx1(out, "eyepiece", 512, 512, fxEyepiece, p.x, p.y, p.z, 0.36, 0.36); }
    return;
  }
  skyTrains(cam, out, k, t);
  const A = ASTRO;
  if (id === 1) { // gaping up at the flood
    const big = at(t, W.million);
    standing(cam, out, 60, ASTRO_O, A[0], A[2], { expr: "shock", look: 0, headTilt: 4 * Math.sin(t * 2), reach: big ? [[110, 520], [490, 520]] : [[160, 610], [440, 610]] }, t, true, big ? Math.max(0, 0.1 * Math.sin((t - W.million) * 9)) * (t - W.million < 0.36 ? 1 : 0) : 0);
  } else if (id === 5) { // at the eyepiece; flinches when the sky fills
    const flinch = at(t, W.warned);
    standing(cam, out, 60, ASTRO_O, A[0], A[2], { expr: flinch ? "nervous" : "neutral", look: flinch ? 0 : 0.7, headTilt: flinch ? 0 : 8, reach: [null, [470, 560]] }, t);
  } else if (id === 10) { // turns to us: gestures up at the sky, then grins
    const point = at(t, W.trade) && !at(t, W.send);
    standing(cam, out, 60, ASTRO_O, A[0], A[2], { expr: at(t, W.send) ? "grin" : point ? "smile" : "neutral", look: 0, reach: point ? [[70, 330], null] : null as never }, t);
  }
};
const ctrl = (cam: CamInfo, out: Stage, id: number, t: number) => {
  const R = REG;
  if (id === 7) {
    const flick = at(t, W.not), shrug = at(t, W.department);
    const ex: Expr = shrug ? "neutral" : flick ? "neutral" : "stern";
    seated(cam, out, 70, REG_O, R[0], R[2], { expr: ex, look: flick ? 0 : 0.35, headTilt: shrug ? -7 : 0, reach: shrug ? [[105, 745], [495, 745]] : flick ? [null, [500, 640]] : [null, [420, 680]] }, t);
    if (shrug) { const dd = t - (W.department - 2 / FPS), k = Math.min(1, dd / 0.12); for (const sd of [-1, 1]) { const [x, y, z] = onCard(cam, R[0], 0.33, R[2], 300 + sd * 235, 700, 0.08); fx1(out, `shrugL${sd}`, 128, 128, (p) => fxShrug(p, sd), x, y, z, 0.18 * k + 0.01, 0.18 * k + 0.01); } }
    // the complaint: on the desk in front of him, then flicked off to the right, spinning
    const dd = t - (W.not - 2 / FPS);
    if (dd < 0) fx1(out, "paper", 256, 320, fxPaper, R[0] + 0.32, 0.86, -0.42, 0.26, 0.33, -0.15);
    else if (dd < 1.4) fx1(out, "paper", 256, 320, fxPaper, R[0] + 0.32 + 2.2 * dd, 0.86 + 0.9 * dd - 2.2 * dd * dd, -0.42 + 0.3 * dd, 0.26, 0.33, -0.15 - 9 * dd);
    return;
  }
  // id 8: he shakes his head under the red screen
  const shake = at(t, W.didnt) ? 0.45 * Math.sin((t - W.didnt) * 16) * Math.exp(-(t - W.didnt) * 1.2) : 0;
  seated(cam, out, 70, REG_O, R[0], R[2], { expr: at(t, W.didnt) ? "stern" : "neutral", look: shake, headTilt: shake * 10 }, t);
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "space") space(cam, out, id, t);
  else if (s.place === "hill") hill(cam, out, id, t);
  else ctrl(cam, out, id, t);
  void fxBurst; void viewOf; void vOf; void hh; void LIGHTS; void NOINK; void bodySide; void FPS; void clamp01; void easeOut; void fxGlow; void INK; void onCard; void hillY;
  return out;
};
export { FPS };
