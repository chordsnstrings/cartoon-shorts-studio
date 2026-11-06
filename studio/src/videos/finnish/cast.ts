// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts, INK, rrect } from "./toon";
import {
  FPS, SHOTS, W, smooth, clamp01, at, YT, LIB, BUF, FIN, KSCR, KIOSK, TABLES, GUARD, FINN, FBOT, JETTY_END, TRUCK, guestAt, marchAt,
} from "./story";
import { fxSparkle, fxGlow } from "./sat";
import { drawBot, BotPose, fxSearch, fxBook, fxCard, fxAccordion, fxFood, fxPaper, fxNoteC } from "./bot";
import { fxBurst } from "./toon";
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

// ================= the Finnish-music short's cast =================
const who = (i: number, o: Outfit) => ({ i, o, okey: JSON.stringify(o) });
const LIBRARIAN: Outfit = { jacket: "#8a5aa8", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#6a3a24", skin: "#f0c8a0" };
const FINNO: Outfit = { jacket: "#2f5aa8", pants: "#3b3f52", boots: "#2b2630", hat: "cap", cap: "#c0353a", skin: "#f5d6bc" };
const JACKETS = ["#e8483c", "#2fa39a", "#f2a03a", "#3a64b8", "#4f9a6e", "#c95b8a", "#7b5ac9", "#efece4"];
const HAIRS = ["#2a2020", "#5a3b2a", "#c98a3a", "#1a1414", "#8a4a2a", "#e0c070"];
const SKINS2 = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067", "#8a5a3c", "#e8b48a"];
const student = (i: number): Outfit => ({ jacket: JACKETS[i % 8], pants: ["#3b3f52", "#3b5b9a", "#4a3a30"][i % 3], boots: ["#efece4", "#2b2630", "#5a3b2a"][i % 3], hat: "hair", hair: HAIRS[(i * 5) % 6], skin: SKINS2[(i * 7) % 6] });

/** a bot card: lit like the people, same tiers, drawn with drawBot */
const bot = (cam: CamInfo, x: number, y: number, z: number, pose: BotPose, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.9 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const light = light2D(cam, false), P = { ...pose, light };
  return { key: `B|${fkey(P)}`, x, y, z, scale, draw: (p) => drawBot(p, P), size: [w, h, k] };
};
const fx1 = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0, soft = false) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, rot, soft });

/** seats at the reading tables: [x, z, side] */
const SEATS: [number, number, number][] = [];
for (const [tx, z0, z1] of TABLES) for (const side of [-1, 1]) for (let z = z0 + 0.75; z < z1; z += 1.5) SEATS.push([LIB + tx + side * 1.0, z, side]);
const students = (cam: CamInfo, out: Stage, t: number, mood: (i: number) => Expr, keep = 0.62, near = false) => {
  SEATS.forEach(([x, z], i) => {
    if (hh(i, 3) > keep) return;
    if (near && x < LIB - 5 && z > 0.5) return; // keep the shot-4 lens clear
    const tilt = Math.sin(t * 1.3 + i) * 3;
    out.places.push(person(cam, who(10 + i, student(i)), x, 0.33, z, { side: false, mirror: false }, { mode: "sit", expr: mood(i), look: (hh(i, 5) - 0.5) * 1.2, blink: lidAt(t, 10 + i), headTilt: tilt }, {}));
  });
};
/** search bubbles flying from the entrance to the kiosk (count grows), or swirling round it */
const bubbles = (out: Stage, t: number, n: number, swirl: number) => {
  for (let i = 0; i < n; i++) {
    const sp = 0.45 + hh(i, 1) * 0.35, u = (t * sp + hh(i, 2)) % 1;
    let x: number, y: number, z: number;
    if (hh(i, 4) < swirl) { // orbiting the kiosk
      const a = t * (0.8 + hh(i, 6)) + i * 2.399, r = 0.7 + hh(i, 7) * 1.3;
      x = KIOSK[0] + r * Math.cos(a); z = KIOSK[2] + r * Math.sin(a) * 0.8; y = 1.0 + hh(i, 8) * 2.4 + 0.2 * Math.sin(t * 2 + i);
    } else { // stream from the doorway
      const sx = LIB + (hh(i, 9) - 0.5) * 2.6, sy = 1.2 + hh(i, 10) * 2.4;
      x = sx + (KSCR[0] - sx) * u + 0.5 * Math.sin(u * 6 + i); y = sy + (KSCR[1] + 0.3 - sy) * u + 1.2 * Math.sin(u * Math.PI); z = -17.4 + (KSCR[2] + 17.4) * u;
    }
    const s = 0.26 + hh(i, 11) * 0.14;
    fx1(out, `sb${i % 4}`, 256, 256, (p) => fxSearch(p, i % 4), x, y, z, s, s, 0.15 * Math.sin(t * 2 + i));
  }
};

const lib = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 1 || id === 4 || id === 15) students(cam, out, t, (i) => (id === 4 ? (["nervous", "dazed", "stern", "neutral"] as Expr[])[i % 4] : id === 15 ? (i % 2 ? "nervous" : "shock") : (i % 3 ? "neutral" : "stern")), 0.62, id === 4);
  if (id === 1) bubbles(out, t, Math.min(60, 8 + Math.floor(t * 20)), 0.1);
  if (id === 2) bubbles(out, t, Math.min(90, 40 + Math.floor((t - 2.9) * 18)), at(t, W.finnish) ? 0.85 : 0.5);
  if (id === 4 && at(t, W.humming)) for (let k = 0; k < 3; k++) { const u = ((t - W.humming) * 0.8 + k / 3) % 1; fx1(out, `hum${Math.floor(u * 10)}`, 128, 128, (p) => fxSparkle(p, k), KSCR[0] + (k - 1) * 0.35, KSCR[1] + 0.35 + u * 0.5, KSCR[2], 0.09, 0.09); }
  if (id === 8) {
    // a line of students at the kiosk; on "everybody out" they are flung back across the hall
    for (let k = 0; k < 4; k++) {
      const x0 = KIOSK[0] + (k % 2 ? 0.35 : -0.3), z0 = KIOSK[2] + 0.9 + k * 0.75;
      const d = t - (W.everybody - 0.05 + k * 0.05), fl = d > 0;
      const z = fl ? z0 + 7 * (1 - Math.exp(-d * 2.2)) : z0, y = fl ? 0.9 * Math.sin(Math.min(1, d * 1.3) * Math.PI) : 0;
      const ex: Expr = fl ? "shock" : at(t, W.queue) ? "nervous" : "neutral";
      out.places.push({ ...person(cam, who(40 + k, student(40 + k)), x0 + (fl ? (k - 1.5) * d * 1.4 : 0), y, z, { side: false, mirror: false }, { mode: fl ? "fall" : "stand", expr: ex, look: 0, blink: lidAt(t, 40 + k) }, {}), roll: fl ? (k % 2 ? 1 : -1) * Math.min(1.2, d * 2.2) : 0 });
      if (!fl) blob(out, x0, 0, z0, 1, 0.9);
      if (fl && d < 1.4) for (let j = 0; j < 3; j++) fx1(out, `pp${(k + j) % 5}`, 128, 160, (p) => fxPaper(p, k + j), x0 + (j - 1) * 0.5 + d * (j - 1), 1.2 + d * (1.6 - j * 0.3), z0 + d * 2.5, 0.25, 0.31, d * 4 + j);
    }
    if (at(t, W.full)) { const u = clamp01((t - W.full) / 0.35); fx1(out, `kb${Math.floor(u * 8)}`, 500, 500, (p) => fxBurst(p, Math.floor(u * 8) / 8, "#ff8a6a"), KSCR[0], KSCR[1], KSCR[2] + 0.15, 1.6, 1.6); }
  }
  if (id === 10) {
    // the bots march in through the entrance; the lead one stops and turns its face to us on "not people"
    for (let i = 0; i < 30; i++) {
      const m = marchAt(i, t, 31.6);
      if (!m) continue;
      const lanes = [0.25, -1.3, 1.5, -0.5, 2.4, -2.2];
      let x = LIB + lanes[i % 6] + 0.1 * Math.sin(i), z = m.z;
      const lead = i === 0, stop = lead && z > -12.6;
      if (lead) { x = LIB + 0.25; z = Math.min(z, -12.6); }
      const turn = lead && at(t, W.people2);
      out.places.push(bot(cam, x, 0, z, { la: 10, le: 10, ra: 10, re: 10, phase: stop ? 0 : m.phase, face: turn ? "dots" : "happy", head: turn ? 8 : 0, blink: lidAt(t, 60 + i) }));
      blob(out, x, 0, z, 0.8, 0.9);
    }
  }
  if (id === 11) {
    // bots at the stacks, arms up in the shelves, books flying out into their arms; cards streaming up "to feed AI models"
    const spots: [number, number][] = [[6.85, -13.4], [6.85, -11.2], [6.9, -9.0], [6.85, -7.0], [9.0, -12.0], [9.0, -9.4]];
    spots.forEach(([x, z], i) => {
      const reachUp = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7);
      out.places.push(bot(cam, LIB + x, 0, z, { la: 40 + 60 * reachUp, le: 30, ra: 150 - 30 * reachUp, re: 20, face: at(t, W.scraping) ? "scan" : "happy", phase: t, head: -6, blink: lidAt(t, 70 + i) }, i >= 4 ? 1.0 : 1.05));
      blob(out, LIB + x, 0, z, 0.8, 0.9);
      for (let k = 0; k < 3; k++) {
        const u = ((t * 1.4 + k / 3 + hh(i, k)) % 1), sx = LIB + 7.36, sy = 0.6 + 2.6 * hh(i * 3 + k, 2), sz = z + (hh(i, k + 5) - 0.5) * 1.6;
        const bx = LIB + x, by = 1.2;
        fx1(out, `bk${(i + k) % 6}|${Math.floor(u * 4)}`, 256, 192, (p) => fxBook(p, i + k, Math.floor(u * 4) / 4), sx + (bx - sx) * u + (i >= 4 ? 0 : 0), sy + (by - sy) * u + 0.6 * Math.sin(u * Math.PI), sz + (z - sz) * u, 0.32, 0.24, Math.sin(u * 6 + k) * 0.5);
      }
    });
    if (at(t, W.everything)) for (let i = 0; i < 26; i++) { // catalogue cards whirl up past the shelves
      const u = ((t - W.everything) * (0.5 + hh(i, 3) * 0.4) + hh(i, 4)) % 1;
      fx1(out, `cd${i % 4}`, 256, 160, (p) => fxCard(p, i), LIB + 6.4 + 1.6 * Math.sin(i * 2.3 + u * 3), 0.9 + u * 6, -13 + hh(i, 5) * 7, 0.3, 0.19, u * 6 + i);
    }
  }
  if (id === 14) {
    // the AI door guard; a student is waved in, then a bot is bounced out
    const gArmUp = at(t, W.letting) && t < W.keeping ? smooth((t - W.letting) / 0.3) : 0, stop = at(t, W.botsOut - 0.15) ? smooth((t - (W.botsOut - 0.15)) / 0.15) : 0;
    out.places.push(bot(cam, GUARD[0], 0, GUARD[2], { la: 15, le: 20, ra: 25 + 110 * gArmUp + 80 * stop, re: 10 + 30 * gArmUp, guard: true, face: stop > 0.5 ? "angry" : at(t, W.letting) ? "happy" : "dots", blink: lidAt(t, 80), head: 4 * gArmUp }, 1.55));
    blob(out, GUARD[0], 0, GUARD[2], 1.3, 0.9);
    // the student walks in
    const sd = t - (W.letting - 0.4);
    if (sd > 0) { const z = -17.6 + sd * 1.3, x = LIB + 0.7 - sd * 0.15; out.places.push(person(cam, who(50, student(3)), x, 0, z, { side: false, mirror: false }, { mode: "stroll", phase: sd * 1.7, expr: "smile", look: 0.4, blink: lidAt(t, 50) }, {})); blob(out, x, 0, z, 1, 0.9); }
    // the bot tries, and is bounced back out of the door
    const bd = t - (W.keeping - 0.6);
    if (bd > 0) {
      const hit = t - W.botsOut, flying = hit > 0;
      const z = flying ? -15.0 - 3.5 * (1 - Math.exp(-hit * 3)) : -17.6 + bd * 2.2, x = LIB + 1.4 + (flying ? -0.6 * hit : 0), y = flying ? 0.7 * Math.sin(Math.min(1, hit * 1.6) * Math.PI) : 0;
      out.places.push({ ...bot(cam, x, y, Math.min(z, -15.0), { la: 20, le: 20, ra: 20, re: 20, phase: flying ? 0 : bd * 2.2, face: flying ? "x" : "happy", blink: lidAt(t, 81) }), roll: flying ? Math.min(1.5, hit * 4) : 0 });
      if (!flying) blob(out, x, 0, Math.min(z, -15.0), 0.8, 0.9);
      if (flying && hit < 0.4) { const u = hit / 0.4; fx1(out, `gb${Math.floor(u * 8)}`, 500, 500, (p) => fxBurst(p, Math.floor(u * 8) / 8, "#fff3b0"), LIB + 1.6, 1.1, -15.1, 1.2, 1.2); }
    }
    // a few bots waiting at the doorway
    for (let i = 0; i < 4; i++) { const x = LIB - 1.2 + i * 0.55, z = -17.4; out.places.push(bot(cam, x, 0, z, { la: 10, le: 10, ra: 10, re: 10, face: "dots", blink: lidAt(t, 82 + i) }, 0.95)); }
  }
  if (id === 15) {
    // bots everywhere and still coming in; more pop in on "worse"
    const n = at(t, W.worse) ? 80 : at(t, W.everywhere) ? 60 : 40;
    for (let i = 0; i < n; i++) {
      const a = hh(i, 21), b = hh(i, 22);
      const x = LIB + (a - 0.5) * 17, z = -16 + b * 26 + 0.4 * Math.sin(t * 0.9 + i), ph = t * 1.2 + i;
      if (Math.abs(x - LIB) > 3.4 && Math.abs(x - LIB) < 5.8 && z > -3.4 && z < 9.4) continue; // not on the tables
      out.places.push(bot(cam, x, 0, z, { la: 10 + 40 * (i % 3), le: 20, ra: 140 * (i % 2), re: 20, phase: ph, face: i % 4 ? "happy" : "scan", blink: lidAt(t, 90 + i) }));
    }
    bubbles(out, t, 50, 0.6);
  }
};

const ytSeated = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => {
  out.places.push(person(cam, who(1, LIBRARIAN), YT[0], 0.33, YT[2], { side: false, mirror: false }, { mode: "sit", look: 0.55, ...fo, blink: lidAt(t, 1) }, {}));
};
const desk = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 5) ytSeated(cam, out, t, { expr: "smile" });
  else if (id === 6) ytSeated(cam, out, t, { expr: "shock", look: 0.5 });
  else if (id === 7) ytSeated(cam, out, t, { expr: at(t, 26.6) ? "dazed" : at(t, W.picky) ? "stern" : "nervous", headTilt: at(t, W.different) && t < 26 ? 7 : 0 });
  else if (id === 13) {
    const sh = smooth((t - 53.3) / 0.3);
    ytSeated(cam, out, t, { expr: "smile_closed", look: 0, headTilt: 6 * sh, reach: sh > 0.05 ? [[300 - 70 - 90 * sh, 690 - 60 * sh], [300 + 70 + 90 * sh, 690 - 60 * sh]] : undefined });
  } else if (id === 3) ytSeated(cam, out, t, { expr: "shock" });
};

const fin = (cam: CamInfo, out: Stage, id: number, t: number) => {
  if (id === 9) {
    // the lone figure at the end of the jetty: a slow deadpan shrug on "famous"
    const sh = at(t, W.famous) ? smooth((t - (W.famous - 0.1)) / 0.3) : 0;
    const [x, y, z] = JETTY_END;
    out.places.push(person(cam, who(5, FINNO), x, y, z, { side: false, mirror: false }, { mode: "stand", expr: "smile_closed", look: 0.3, blink: lidAt(t, 5), reach: sh > 0.05 ? [[300 - 80 - 100 * sh, 640 - 80 * sh], [300 + 80 + 100 * sh, 640 - 80 * sh]] : undefined, headTilt: 7 * sh }, {}));
    blob(out, x, y, z, 1, 0.9);
  }
  if (id === 16) {
    // the musician on the porch bench, squeezing the accordion; notes float off; the bot beside him with its tower of cards
    const k = 0.5 + 0.5 * Math.sin(t * 3.2), [fx, fy, fz] = FINN;
    const lw = 60 + 70 * k;
    out.places.push(person(cam, who(5, FINNO), fx, 0.76, fz, { side: false, mirror: false }, { mode: "sit", expr: "smile_closed", look: 0.4, blink: lidAt(t, 5), headTilt: 4 * Math.sin(t * 1.6), reach: [[300 - lw * 0.55 - 40, 690], [300 + lw * 0.55 + 40, 690]] }, {}));
    fx1(out, `acc${Math.round(k * 10)}`, 320, 240, (p) => fxAccordion(p, Math.round(k * 10) / 10), fx, 1.24, fz + 0.12, 0.62, 0.465);
    for (let i = 0; i < 6; i++) {
      const u = ((t - 62.5) * 0.32 + i / 6) % 1, late = at(t, W.never);
      // notes drift right toward the bot; after "never" they part round its head and float on past
      const x = fx + 0.2 + u * 2.4, base = 1.5 + u * 0.9 + 0.12 * Math.sin(u * 9 + i);
      const near = Math.abs(x - FBOT[0]) < 0.35, y = late && near ? base + 0.35 * Math.sign(i % 2 - 0.5) * Math.cos((x - FBOT[0]) * 4.5) : base;
      fx1(out, `nt${i % 2}${i % 3}`, 256, 256, (p) => fxNoteC(p, i % 2, ["#c0353a", "#2f5aa8", "#2b2630"][i % 3]), x, y, fz + 0.05, 0.2, 0.2, 0.3 * Math.sin(t * 3 + i));
    }
    const look = at(t, W.never) ? smooth((t - W.never) / 0.3) : 0;
    out.places.push(bot(cam, FBOT[0], FBOT[1], FBOT[2], { la: 15, le: 70, ra: 15, re: 70, face: at(t, W.note + 0.2) ? "dots" : at(t, W.never) ? "dots" : "happy", head: 10 * look, blink: lidAt(t, 95), book: !at(t, W.never) }));
    blob(out, FBOT[0], FBOT[1], FBOT[2], 0.8, 0.9);
    // the tower of catalogue cards beside the bot (it "knows" everything): a leaning stack
    for (let i = 0; i < 16; i++) fx1(out, `tw${i % 3}`, 256, 160, (p) => fxCard(p, i), FBOT[0] + 0.55 + 0.012 * i * Math.sin(i), FBOT[1] + 0.06 + i * 0.075, FBOT[2] - 0.1, 0.36, 0.22, 0.03 * Math.sin(i * 1.7));
    if (at(t, W.note + 0.3)) { const d = t - (W.note + 0.3); fx1(out, `bonk${Math.min(5, Math.floor(d * 12))}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 2), "#fff3b0", 8, 30, 160), FBOT[0], FBOT[1] + 1.3, FBOT[2] + 0.05, 0.4, 0.4); }
    // soft warm glow of the window light behind
    fx1(out, `winglow`, 256, 256, (p) => fxGlow(p, "rgba(255,200,130,0.35)"), FIN + 1.55, 1.95, -2.5, 1.8, 1.4, 0, true);
  }
};

const buf = (cam: CamInfo, out: Stage, t: number) => {
  const g = guestAt(t);
  // two people waiting their turn at the end of the table
  const shocked = at(t, W.different2);
  for (const [k, x, z] of [[0, BUF - 4.15, 0.6], [1, BUF - 4.0, 1.5]] as const) {
    out.places.push(person(cam, who(30 + k, student(20 + k)), x, 0, z, { side: false, mirror: false }, { mode: "stand", expr: shocked ? "shock" : t > W.fills ? "nervous" : "neutral", look: Math.max(-0.8, Math.min(0.8, (g.x - x) / 3)), blink: lidAt(t, 30 + k), reach: [[230, 640], [370, 640]] }, {}));
    blob(out, x, 0, z, 1, 0.9);
  }
  if (!g.vis) return;
  const carry = g.tray > 0;
  const arms = g.mode === "dump" ? { la: 60 + 90 * g.dumpK, le: 20, ra: 60 + 90 * g.dumpK, re: 20 } : carry ? { la: 30, le: 75, ra: 30, re: 75 } : g.mode === "tiptoe" ? { la: 50, le: 80, ra: 50, re: 80 } : { la: 12, le: 10, ra: 12, re: 10 };
  out.places.push(bot(cam, g.x, 0, g.z, { ...arms, face: g.face, head: 12 * g.shake, phase: g.mode === "walk" || g.mode === "tiptoe" || g.mode === "pop" ? g.walk : 0, tiptoe: g.mode === "tiptoe" ? 1 : 0, disguise: g.disguise, tray: g.mode === "dump" ? (g.dumpK < 0.5 ? g.tray : 0) : g.tray, blink: lidAt(t, 99) }));
  blob(out, g.x, 0, g.z, 0.8, 0.9);
  if (g.mode === "dump" || (t > W.truck - 0.1 && t < W.then + 0.3)) for (let i = 0; i < 7; i++) { // food arcs into the truck bed
    const u = clamp01((t - (W.truck - 0.1) - i * 0.07) / 0.45);
    if (u <= 0 || u >= 1) continue;
    const sx = g.x + 0.2, sy = 1.5, ex = TRUCK[0] - 0.8 + (i % 3) * 0.3, ey = 0.95;
    fx1(out, `fd${i % 5}`, 192, 192, (p) => fxFood(p, i), sx + (ex - sx) * u, sy + (ey - sy) * u + 0.9 * Math.sin(u * Math.PI), TRUCK[2] + (i % 2 ? 0.25 : -0.25) + (g.z - TRUCK[2]) * (1 - u), 0.24, 0.24, u * 5);
  }
  if (g.mode === "pop" && t - Math.floor(t) >= 0) { const d = t - (g.disguise === 1 ? W.different2 - 0.25 : g.disguise === 2 ? W.again - 0.1 : W.again2 - 0.1); if (d < 0.3) fx1(out, `pop${Math.floor(d * 26)}`, 500, 500, (p) => fxBurst(p, Math.min(1, d * 3.3), "#fff3b0", 8, 30, 180), g.x, 1.3, -5.0, 1.0, 1.0); }
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.place === "desk") desk(cam, out, id, t);
  else if (s.place === "lib") lib(cam, out, id, t);
  else if (s.place === "fin") fin(cam, out, id, t);
  else buf(cam, out, t);
  return out;
};
export { FPS };
