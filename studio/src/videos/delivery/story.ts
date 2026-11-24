// "The Drone That Delivered Shampoo, Then Crashed": timeline timed to pipeline/stories/delivery/words.json (ElevenLabs George, 34.8 s).
// One place: a suburban YARD (the buyer's house + lawn, the neighbour's detached garage + house, two utility poles with a
// fibre line and a power service drop). Day light, one night shot (the three-hour retrieval).
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1047;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- story beats (film seconds, ElevenLabs alignment, whisper-checked) ----------------
export const W = {
  shampoo: 2.29, then: 3.25, crashed: 3.44, garage: 4.74, friday: 5.49, michigan: 6.26, app: 7.14, arriving: 7.89, drone: 8.71,
  seven: 9.26, minutes: 9.58, and: 10.35, did: 10.73, but: 11.72, away: 12.21, clipped: 12.67, cable: 13.17, lost: 13.93, propeller: 14.25,
  flapped: 15.09, sick: 16.06, bird: 16.39, neighbor: 17.19, said: 17.56, right: 18.22, power: 18.85, line: 19.13,
  company: 20.31, switch: 20.95, house: 21.42, off: 21.7, nobody: 22.12, hurt: 22.77, getting: 23.04, down: 23.83, three: 24.36, hours: 24.63,
  neighbor2: 25.38, got: 25.73, hundred: 26.02, gift: 26.67, card: 26.95, air: 27.35, safety: 27.89, officials: 28.27, investigating: 28.85,
  would: 30.12, drone2: 30.6, deliver: 30.98, house2: 31.66, send: 32.24, someone: 33.05, orders: 33.55, everything: 33.94,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** the neighbour's detached garage: door facing +z at zf, gable ridge along x at zr */
export const GARAGE = { x0: 3, x1: 8.5, zf: -2, zb: -8, zr: -5, eave: 2.7, ridge: 4.3 };
export const roofY = (z: number) => GARAGE.eave + (GARAGE.ridge - GARAGE.eave) * clamp01((GARAGE.zf - z) / (GARAGE.zf - GARAGE.zr));
/** buyer's house (facade at z -4) and the neighbour's house (facade at z -6, live windows) */
export const HOUSE_A = { x0: -9.5, x1: -1.2, zf: -4, zb: -12, h: 5.2 };
export const HOUSE_B = { x0: 9.5, x1: 17.5, zf: -6, zb: -14, h: 5.4 };
/** utility poles on the sidewalk + their lines */
export const POLE1: V3 = [-0.6, 0, 8.4], POLE2: V3 = [4.6, 0, 8.4];
export const FIBER_A: V3 = [-0.6, 6.2, 8.4], FIBER_B: V3 = [-1.6, 4.6, -4.05];
export const POWER_A: V3 = [4.6, 7.6, 8.4], POWER_B: V3 = [9.7, 4.9, -8.0];
/** where the parcel lands on the buyer's lawn */
export const DROP: V3 = [-3.6, 0, 2.6];
/** the drone's resting spot on the garage roof's front slope + the impact point on the power line */
export const REST_Z = -3.25;
export const REST: V3 = [7.0, roofY(REST_Z) + 0.3, REST_Z];
export const HIT: V3 = [7.4, 5.25, -1.7];
export const CLIP: V3 = [-1.1, 5.05, 2.0];

// ---------------- shots ----------------
export type Light = "day" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(5.3), light: "day", sunAz: 120, sunEl: 34 }, // hook: the wounded drone drops onto the garage roof
  { id: 2, a: F(5.3), b: F(8.45), light: "day", sunAz: 120, sunEl: 34 }, // the app: arriving by drone in seven minutes
  { id: 3, a: F(8.45), b: F(11.6), light: "day", sunAz: 120, sunEl: 34 }, // it arrives, drops the parcel: shampoo!
  { id: 4, a: F(11.6), b: F(14.95), light: "day", sunAz: 120, sunEl: 34 }, // flying away it clips the cable, a propeller flies off
  { id: 5, a: F(14.95), b: F(19.85), light: "day", sunAz: 120, sunEl: 34 }, // flaps like a sick bird... into the power line
  { id: 6, a: F(19.85), b: F(22.0), light: "day", sunAz: 120, sunEl: 34 }, // the house goes dark
  { id: 7, a: F(22.0), b: F(23.0), light: "day", sunAz: 120, sunEl: 34 }, // nobody was hurt
  { id: 8, a: F(23.0), b: F(25.25), light: "night", sunAz: 140, sunEl: 40 }, // three hours on a ladder
  { id: 9, a: F(25.25), b: F(27.3), light: "day", sunAz: 120, sunEl: 34 }, // a $100 gift card
  { id: 10, a: F(27.3), b: F(29.95), light: "day", sunAz: 120, sunEl: 34 }, // officials investigating
  { id: 11, a: F(29.95), b: TOTAL, light: "day", sunAz: 120, sunEl: 34 }, // would you let a drone deliver?
];
export const XFADE: Record<number, number> = { 8: 10, 9: 8 };
export const FLASH_AT = F(5.3);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the drone ----------------
export type DroneState = { p: V3; yaw: number; pitch: number; roll: number; fly: boolean; eye: number; scale: number; lost?: boolean; box?: boolean; wob?: number };
type K4 = [number, number, number, number]; // t, x, y, z
const glide5 = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const glide = glide5;
/** smooth piecewise path through keys (smootherstep per segment) */
const path = (keys: K4[], t: number): V3 => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) { const u = glide5((t - a[0]) / (b[0] - a[0])); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]; }
  }
  const l = keys[keys.length - 1];
  return [l[1], l[2], l[3]];
};
/** Catmull-Rom through keys (no stop at every key: the sick-bird flight keeps moving) */
const spline = (keys: K4[], t: number): V3 => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  const n = keys.length;
  for (let i = 1; i < n; i++) {
    if (t > keys[i][0]) continue;
    const p0 = keys[Math.max(0, i - 2)], p1 = keys[i - 1], p2 = keys[i], p3 = keys[Math.min(n - 1, i + 1)], u = (t - p1[0]) / (p2[0] - p1[0]);
    const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    return [cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2]), cr(p0[3], p1[3], p2[3], p3[3])];
  }
  const l = keys[n - 1];
  return [l[1], l[2], l[3]];
};
const bob = (t: number, a = 0.06) => a * Math.sin(t * 4.1);
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
export const DRONE_S = 1.0;
const S0 = { pitch: 0, roll: 0, fly: true, eye: 1, scale: DRONE_S };
/** a flying state from a path: faces its velocity, tilts into it */
const moving = (pf: (t: number) => V3, t: number, tilt = 1, face?: number): DroneState => {
  const p = pf(t), q = pf(t + 0.08), vx = (q[0] - p[0]) / 0.08, vz = (q[2] - p[2]) / 0.08, v = Math.hypot(vx, vz);
  const yaw = face ?? (v > 0.4 ? yawTo(vx, vz) : 0.5);
  const fwd = vx * Math.sin(yaw) + vz * Math.cos(yaw), side = vx * Math.cos(yaw) - vz * Math.sin(yaw);
  return { ...S0, p, yaw, pitch: Math.max(-0.35, Math.min(0.35, fwd * 0.06 * tilt)), roll: Math.max(-0.35, Math.min(0.35, -side * 0.06 * tilt)) };
};
/** the wounded "sick bird" wobble: rolls and dips like flapping */
const sick = (s: DroneState, t: number, k = 1): DroneState => ({
  ...s, p: [s.p[0] + 0.06 * k * Math.sin(t * 9), s.p[1] - 0.22 * k * Math.abs(Math.sin(t * 5.2)), s.p[2]],
  roll: s.roll + 0.42 * k * Math.sin(t * 6.3), pitch: s.pitch + 0.22 * k * Math.sin(t * 4.7 + 1), wob: k, lost: true,
});
/** the fall from the power line onto the roof, landing at tLand; returns null before tHit */
const fall = (t: number, tHit: number, tLand: number): DroneState => {
  const u = clamp01((t - tHit) / (tLand - tHit));
  const p: V3 = [HIT[0] + (REST[0] - HIT[0]) * u, HIT[1] + (REST[1] - HIT[1]) * u * u, HIT[2] + (REST[2] - HIT[2]) * u];
  if (u < 1) return { ...S0, p, yaw: 2.2 + 0.8 * u, pitch: 0.5 * u, roll: -0.7 * Math.sin(u * 7), lost: true };
  const d = t - tLand, set = Math.exp(-d * 6) * Math.sin(d * 30) * 0.12;
  return { ...S0, p: REST, yaw: 3.0, pitch: 0.42 + set, roll: -0.25, fly: d < 0.25, lost: true, eye: Math.floor(t * 3) % 2 };
};
/** resting on the roof, tangled (eyes blinking feebly) */
const resting = (t: number): DroneState => ({ ...S0, p: REST, yaw: 3.0, pitch: 0.42, roll: -0.25, fly: false, lost: true, eye: Math.floor(t * 2.5) % 3 ? 0 : 1 });

/** main flight (shots 3-5) */
const ARRIVE: K4[] = [[8.3, -9, 15, -2], [9.6, -4.4, 6.8, 1.6], [10.25, DROP[0], 4.4, DROP[2]], [11.75, DROP[0], 4.45, DROP[2]],
  [12.5, -2.6, 5.0, 2.4], [13.17, CLIP[0], CLIP[1], CLIP[2]]];
const BIRD: K4[] = [[13.17, CLIP[0], CLIP[1], CLIP[2]], [14.25, 0.3, 5.6, 1.6], [15.3, 1.4, 4.9, 1.0], [16.4, 2.9, 5.7, 0.6], [17.4, 4.2, 4.8, 0.0],
  [18.4, 5.9, 5.6, -0.8], [19.13, HIT[0], HIT[1], HIT[2]]];
/** the hook replays the end of the flight compressed: wobble toward the line, hit at 3.0 s, onto the roof on "crashed" */
const HOOKP: K4[] = [[0, 4.4, 4.55, 0.7], [1.0, 5.0, 5.3, 0.2], [2.0, 5.8, 5.7, -0.6], [3.0, HIT[0], HIT[1], HIT[2]]];
export const HOOK_HIT = 3.0, HOOK_LAND = W.crashed + 0.02;
export const HIT_T = W.line - 0.03, LAND_T = W.line + 0.42;
export const dropT = W.and + 0.2; // parcel released

export const droneAt = (id: number, t: number): DroneState | null => {
  switch (id) {
    case 1: {
      const s = t < HOOK_HIT ? sick(moving((tt) => spline(HOOKP, tt), t, 0.8), t, 1) : fall(t, HOOK_HIT, HOOK_LAND);
      return { ...s, scale: 1.3 };
    }
    case 2: return null;
    case 3: case 4: {
      if (t < W.cable - 0.03) {
        const s = moving((tt) => { const p = path(ARRIVE, tt); return [p[0], p[1] + bob(tt), p[2]]; }, t, 1, t > 9.9 ? 0.6 : undefined);
        return { ...s, box: t < dropT };
      }
      const s = moving((tt) => spline(BIRD, tt), t, 0.6);
      const k = clamp01((t - W.cable) / 0.6) * 0.6 + (t > W.propeller ? 0.4 : 0);
      return t > W.propeller ? sick(s, t, k) : { ...s, roll: s.roll + 0.35 * Math.sin(t * 11) * Math.exp(-(t - W.cable) * 2), wob: 0.5 };
    }
    case 5: {
      if (t < HIT_T) return sick(moving((tt) => spline(BIRD, tt), t, 0.6), t, 1);
      return fall(t, HIT_T, LAND_T);
    }
    case 6: case 7: case 8: case 9: return resting(t);
    case 11: { const u = (t - 29.95) / 5; return { ...S0, p: [-1.0 + 2.6 * u, 4.5 + 0.12 * Math.sin(t * 2), -3.3 - 0.7 * u], yaw: 1.3, pitch: 0.12, box: true, scale: 1.0 }; }
    case 10: return { ...S0, p: [6.0, 0.36, 0.25], yaw: 2.4, pitch: 0.12, roll: 0.15, fly: false, lost: true, eye: 0 };
  }
  return null;
};
/** parcel position after the drop (shot 3+): falls from the drone, bounces once on the lawn */
export const parcelAt = (t: number): V3 | null => {
  if (t < dropT) return null;
  const d = t - dropT, y0 = 4.15;
  if (d < 0.5) return [DROP[0], Math.max(0.12, y0 - 0.5 * 33 * d * d), DROP[2]];
  const b = d - 0.5;
  return [DROP[0] + 0.2 * clamp01(b * 3), 0.12 + Math.max(0, 0.35 * Math.sin(Math.min(1, b / 0.3) * Math.PI)), DROP[2] + 0.1 * clamp01(b * 3)];
};

// ---------------- cables ----------------
/** the fibre line: wobbles after the clip; the power drop: snagged by the drone from the hit onward */
export const cableAt = (name: "fiber" | "power", id: number, t: number): { a: V3; b: V3; sag: number; via?: V3; wob: number } => {
  if (name === "fiber") {
    const clipped = (id === 4 && t > W.cable) || id > 4;
    const d = id === 4 ? t - W.cable : 9;
    return { a: FIBER_A, b: FIBER_B, sag: 0.45, wob: clipped ? 0.5 * Math.exp(-d * 2.2) * Math.sin(d * 16) : 0 };
  }
  const hitT = id === 1 ? HOOK_HIT : id === 5 ? HIT_T : -1;
  const snag = id > 5 || (hitT > 0 && t > hitT);
  if (!snag) return { a: POWER_A, b: POWER_B, sag: 0.6, wob: 0 };
  const d = droneAt(id, t);
  if (!d || id === 10) return { a: POWER_A, b: POWER_B, sag: 0.6, wob: 0 };
  return { a: POWER_A, b: POWER_B, sag: 0.25, via: [d.p[0] + 0.15, d.p[1] + 0.18, d.p[2] + 0.1], wob: 0 };
};
/** the neighbour's windows are lit (power on) */
export const powerOn = (id: number, t: number) => !((id === 6 && t >= W.off - LEADS) || id === 7);

// ---------------- people (feet positions per shot) ----------------
/** a ground point at `depth` metres along the view and `nx` (-1..1) across a portrait frame of vertical fov `fov` */
const placeAt = (pos: V3, look: V3, fov: number, depth: number, nx: number): V3 => {
  const fx = look[0] - pos[0], fz = look[2] - pos[2], n = Math.hypot(fx, fz) || 1, ux = fx / n, uz = fz / n;
  const half = Math.tan((fov * Math.PI) / 360) * (9 / 16) * depth;
  return [pos[0] + ux * depth - uz * half * nx, 0, pos[2] + uz * depth + ux * half * nx];
};
const P5: V3 = [-0.8, 1.3, 7.9];
const L5 = (() => { const t: V3 = [3.0 * 0.75 + 2.9 * 0.25, 3.0 * 0.75 + 5.7 * 0.25, 0.6 * 0.25], v = t.map((x, i) => x - P5[i]), n = Math.hypot(...v); return P5.map((x, i) => x + (v[i] / n) * 8) as V3; })();
export const BUYER: Record<number, V3> = {
  1: [1.95, 0, 4.35], 2: [-3.0, 0, 3.7], 3: [-2.75, 0, 4.0], 4: [-2.3, 0, 4.2], 5: placeAt(P5, L5, 60, 3.0, -0.52), 7: [1.05, 0, 3.0], 11: [-3.0, 0, 3.7],
};
export const NEIGH: Record<number, V3> = { 5: placeAt(P5, L5, 60, 4.8, 0.5), 6: [6.4, 0, 1.6], 7: [2.0, 0, 2.7], 9: [5.6, 0, 2.4], 10: [6.4, 0, 1.2] };
export const WORKER: V3 = [6.1, 1.25, -1.55]; // up the ladder (feet on a rung)
export const INSPECT: V3 = [4.45, 0, 1.75];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** creep toward the look point (look kept ~5-9 m out so the creep stays small) */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** a look point d metres out from pos toward target */
const aim = (pos: V3, target: V3, d: number): V3 => { const v = target.map((x, i) => x - pos[i]), n = Math.hypot(...v) || 1; return pos.map((x, i) => x + (v[i] / n) * d) as V3; };
const mixV = (a: V3, b: V3, k: number): V3 => a.map((v, i) => v + (b[i] - v) * k) as V3;
const dp = (id: number, t: number) => droneAt(id, t)?.p ?? REST;

const CAMS: Record<number, Key[]> = {
  1: [
    // from the street-side lawn: the buyer in front (shampoo in hand), the garage roof beyond, the wounded drone dropping onto it
    { f: 0, s: (f) => { const P: V3 = [0.4, 1.3, 7.3], tg = mixV([5.6, 4.0, -1.8], dp(1, f / FPS), 0.12); return dolly(P, aim(P, tg, 4), pushK(f, 0, 0.0016), { fov: 56, roll: 0.03 }); } },
    { f: F(W.crashed - 0.1), dur: 16, s: (f) => { const P: V3 = [0.6, 1.3, 7.0]; return dolly(P, aim(P, [6.2, 3.5, -2.6], 4), pushK(f, F(W.crashed), 0.0018, 0.006, 22), { fov: 56, roll: -0.04 }); } },
  ],
  2: [
    // MS of the buyer on his lawn with the phone: the app card pops up beside him
    { f: F(5.3), s: (f) => dolly([-2.35, 1.55, 6.4], [-2.7, 1.35, 3.7], pushK(f, F(5.3), 0.0022), { fov: 42, roll: -0.02 }) },
    { f: F(W.arriving - 0.1), dur: 20, s: (f) => dolly([-2.45, 1.55, 6.1], [-2.75, 1.45, 3.7], pushK(f, F(W.arriving), 0.0022, 0.006, 22), { fov: 42, roll: 0.03 }) },
  ],
  3: [
    // wide from the sidewalk, looking up a little: it comes down out of the sky, drops the parcel at his feet
    { f: F(8.45), s: (f) => { const P: V3 = [-1.3, 1.2, 8.7], tg = mixV([-2.9, 1.6, 2.8], dp(3, f / FPS), 0.3); return { pos: P, look: aim(P, tg, 8), fov: 60, roll: 0.02 }; } },
    { f: F(W.did - 0.2), dur: 18, s: (f) => dolly([-1.5, 1.3, 8.6], [-3.0, 2.0, 3.6], pushK(f, F(W.did), 0.002, 0.006, 22), { fov: 56, roll: -0.03 }) },
  ],
  4: [
    // low angle behind him: the drone climbs away, crosses the fibre line, clips it; a propeller spins off
    { f: F(11.6), s: (f) => { const P: V3 = [-3.6, 1.05, 8.2], tg = mixV([-1.6, 4.6, 2.2], dp(4, f / FPS), 0.5); return { pos: P, look: aim(P, tg, 8), fov: 54, roll: -0.03 }; } },
  ],
  5: [
    // the long wobble across the driveway, from the sidewalk: the neighbour points; it flaps into the power line
    { f: F(14.95), s: (f) => { const tg = mixV([3.0, 3.0, 0.0], dp(5, f / FPS), 0.25); return { pos: P5, look: aim(P5, tg, 8), fov: 60, roll: 0.02 }; } },
    { f: F(W.right), dur: 20, s: (f) => { const P: V3 = [0.2, 1.3, 7.6]; return dolly(P, aim(P, [6.4, 3.4, -2.2], 8), pushK(f, F(W.right), 0.002, 0.005, 22), { fov: 58, roll: -0.03 }); } },
  ],
  6: [
    // the neighbour's house with its lit windows and the garage roof: the lights go out on "off"
    { f: F(19.85), s: (f) => { const P: V3 = [5.2, 1.55, 11.0]; return dolly(P, aim(P, [10.2, 3.3, -6.0], 8), pushK(f, F(19.85), 0.0018), { fov: 52, roll: 0.02 }); } },
    { f: F(W.off - 0.08), dur: 12, s: (f) => { const P: V3 = [5.3, 1.55, 10.5]; return dolly(P, aim(P, [10.0, 3.2, -6.0], 8), pushK(f, F(W.off), 0.0018, 0.006, 22), { fov: 52, roll: -0.03 }); } },
  ],
  7: [
    { f: F(22.0), s: (f) => dolly([1.25, 1.5, 6.6], [1.5, 1.35, 2.85], pushK(f, F(22.0), 0.003, 0.006, 22), { fov: 44, roll: 0.02 }) },
  ],
  8: [
    // night: a worker up a ladder at the garage, the drone tangled on the roof
    { f: F(23.0), s: (f) => { const P: V3 = [4.5, 1.5, 3.6]; return dolly(P, aim(P, [6.5, 2.7, -2.4], 8), pushK(f, F(23.0), 0.0022), { fov: 54, roll: -0.02 }); } },
  ],
  9: [
    { f: F(25.25), s: (f) => dolly([5.05, 1.55, 5.3], [5.65, 1.4, 2.4], pushK(f, F(25.25), 0.0025, 0.006, 22), { fov: 44, roll: 0.03 }) },
  ],
  10: [
    { f: F(27.3), s: (f) => { const P: V3 = [3.6, 1.35, 5.2]; return dolly(P, aim(P, [5.2, 0.8, 0.8], 7), pushK(f, F(27.3), 0.0022), { fov: 50, roll: -0.02 }); } },
    { f: F(W.investigating - 0.1), dur: 20, s: (f) => { const P: V3 = [3.75, 1.3, 4.6]; return dolly(P, aim(P, [5.1, 0.85, 0.8], 7), pushK(f, F(W.investigating), 0.002, 0.005, 22), { fov: 50, roll: 0.03 }); } },
  ],
  11: [
    { f: F(29.95), s: (f) => dolly([-4.0, 1.5, 6.9], [-2.75, 1.5, 3.7], pushK(f, F(29.95), 0.0022), { fov: 44 }) },
    { f: F(W.send - 0.1), dur: 26, s: (f) => dolly([-3.9, 1.5, 6.6], [-2.8, 1.45, 3.7], pushK(f, F(W.send), 0.0012, 0.003, 22), { fov: 44, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [
  [HOOK_HIT + 0.02, 0.6], [HOOK_LAND + 0.02, 1.0], [W.did + 0.15, 0.4], [W.cable + 0.02, 0.7], [W.propeller + 0.02, 0.5], [HIT_T + 0.02, 0.7], [LAND_T + 0.02, 1.0],
  [W.off + 0.02, 0.6],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyes = (p: V3, dy = 1.62): (() => V3) => () => [p[0], p[1] + dy, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // hook wide: sharp
  { f: F(5.3), cInf: 12, focus: eyes(BUYER[2]) },
  { f: F(8.45), cInf: 0 },
  { f: F(W.did - 0.2), cInf: 7, dur: 18, focus: eyes(BUYER[3]) },
  { f: F(11.6), cInf: 0 },
  { f: F(19.85), cInf: 0 },
  { f: F(22.0), cInf: 11, focus: () => [1.5, 1.6, 2.85] },
  { f: F(23.0), cInf: 0 },
  { f: F(25.25), cInf: 11, focus: eyes(NEIGH[9]) },
  { f: F(27.3), cInf: 6, focus: () => [4.9, 0.9, 0.9] },
  { f: F(29.95), cInf: 10, focus: eyes(BUYER[11]) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
