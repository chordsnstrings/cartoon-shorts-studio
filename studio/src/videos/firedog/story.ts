// "The Robot Dog That Walked Out of the Fire": timeline timed to pipeline/stories/firedog/words.json (ElevenLabs George, 32.4 s).
// Two places: a fire-station TRAINING YARD (concrete yard, a burning concrete burn tower, the station, a fire truck) at x 0,
// and the tower's STAIRWELL interior at x 400. Day light outside, indoor light in the stairwell.
// Camera grammar from the bridge short: smootherstep glides 18-40 f, hard cuts on big jumps, every hold creeps in,
// impact kicks flip sign every frame and decay over 7 f.
export const FPS = 30;
export const TOTAL = 1008;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- story beats (film seconds, ElevenLabs alignment, whisper-checked) ----------------
export const W = {
  dog: 1.03, walked: 1.74, out: 2.01, thousand: 2.58, fire: 3.26, its: 3.9, secret: 4.19, coat: 5.0, only: 5.56, few: 6.14,
  millimetres: 6.35, thick: 6.96, made: 7.79, stuff: 8.62, flew: 9.26, rockets: 9.81, scientists: 10.58, china: 11.44, sent: 11.9,
  flames: 12.97, ten: 13.62, minutes: 14.24, climbed: 15.01, stairs: 15.46, found: 16.39, fire2: 16.82, reported: 17.65, back: 18.3,
  inside: 19.25, below: 19.94, eighty: 20.25, degrees: 20.61, just: 21.72, problem: 22.06, first: 23.1, try: 23.47, all: 24.24,
  four: 24.32, feet: 24.66, came: 25.03, out2: 25.26, fire3: 25.63, so: 26.36, gave: 26.87, newf: 27.22, feet2: 27.48,
  would: 28.32, robot: 28.82, dog2: 29.21, firstq: 29.64, send: 30.6, firefighter: 31.16,
};
const LEADS = 2 / FPS;
export const at = (t: number, w: number) => t >= w - LEADS;

// ---------------- layout shared with build / world / cast ----------------
/** the burn tower: concrete, door facing +z centred on x 0 */
export const TOWER = { x0: -3.2, x1: 3.2, z0: -14.5, z1: -8, h: 12.5, doorW: 2.2, doorH: 2.7 };
export const DOOR_Z = TOWER.z1;
/** the fire station (three bays facing +z) and the parked fire truck */
export const STATION = { x0: -24, x1: -9, z0: -20, z1: -10, h: 7.5 };
export const TRUCK = { x: 8.5, z: -6.5, yaw: -0.25 };
/** stairwell interior (x offset 400): a straight flight up along -z against the back wall, landing at y LAND_Y */
export const SX = 400;
export const STAIR = { x0: SX - 1.0, x1: SX + 0.8, z0: 0.6, z1: -4.6, y1: 3.0, landZ: -7.2 };
export const stairY = (z: number) => STAIR.y1 * clamp01((STAIR.z0 - z) / (STAIR.z0 - STAIR.z1));
export const SLOPE = Math.atan2(STAIR.y1, STAIR.z0 - STAIR.z1);

// ---------------- shots ----------------
export type Light = "day" | "indoor";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
const F = (s: number) => Math.round(s * FPS);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: F(3.75), light: "day", sunAz: 140, sunEl: 40 }, // hook: the dog trots out of the burning tower
  { id: 2, a: F(3.75), b: F(10.45), light: "day", sunAz: 140, sunEl: 40 }, // the coat: a few millimetres, rocket stuff
  { id: 3, a: F(10.45), b: F(14.8), light: "day", sunAz: 140, sunEl: 40 }, // scientists send it into the flames, ten minutes
  { id: 4, a: F(14.8), b: F(19.1), light: "indoor", sunAz: 60, sunEl: 45 }, // up the stairs, finds the fire, reports back
  { id: 5, a: F(19.1), b: F(21.65), light: "indoor", sunAz: 60, sunEl: 45 }, // inside it stays below eighty degrees
  { id: 6, a: F(21.65), b: F(26.25), light: "day", sunAz: 140, sunEl: 40 }, // first try: all four feet on fire, hosed down
  { id: 7, a: F(26.25), b: F(28.2), light: "day", sunAz: 140, sunEl: 40 }, // so they gave it new feet
  { id: 8, a: F(28.2), b: TOTAL, light: "day", sunAz: 140, sunEl: 40 }, // would you send a robot dog in first?
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = F(3.75);
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the robot dog ----------------
/** gait: phase in cycles (trot, diagonal pairs); stride 0 (standing) .. 1 (full trot); slope: ground pitch under it (stairs);
 *  sit 0..1; tap: lift one foot after another (proud new feet); eye: 0 off, 1 on, 2 happy arcs; wag: antenna swing */
export type DogState = {
  p: V3; yaw: number; gait: number; stride: number; slope?: number; sit?: number; tap?: number; head?: number; headYaw?: number;
  eye: number; wag?: number; feetFire?: number; newFeet?: boolean; scale: number; steam?: number;
};
export const DOG_S = 1.4;
const glide5 = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const glide = glide5;
type K4 = [number, number, number, number]; // t, x, y, z
/** piecewise-linear path (constant speed per segment: walking feet stay planted) */
const lin = (keys: K4[], t: number): V3 => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b[0]) { const u = (t - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]; }
  }
  const l = keys[keys.length - 1];
  return [l[1], l[2], l[3]];
};
/** a walking state along a path: gait phase = distance / stride length, so the feet do not skate */
const STEP_LEN = 0.62; // metres per gait cycle at DOG_S
const walking = (keys: K4[], t: number, extra: Partial<DogState> = {}): DogState => {
  const p = lin(keys, t), q = lin(keys, t + 0.05), vx = (q[0] - p[0]) / 0.05, vz = (q[2] - p[2]) / 0.05, v = Math.hypot(vx, vz);
  // distance travelled so far (numeric, 0.05 s steps)
  let dist = 0;
  for (let tt = keys[0][0]; tt < t; tt += 0.05) { const a = lin(keys, tt), b = lin(keys, Math.min(t, tt + 0.05)); dist += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
  const yaw = v > 0.05 ? Math.atan2(vx, vz) : (extra.yaw ?? 0);
  return { p, yaw, gait: dist / STEP_LEN, stride: clamp01(v / 0.5), eye: 1, scale: DOG_S, ...extra };
};
const idle = (p: V3, yaw: number, extra: Partial<DogState> = {}): DogState => ({ p, yaw, gait: 0, stride: 0, eye: 1, scale: DOG_S, ...extra });

/** hook: out of the door toward the lens */
const HOOKP: K4[] = [[0, 0.2, 0, -7.0], [3.75, 0.55, 0, -4.0]];
/** shot 3: from the yard into the burning door */
const INTO: K4[] = [[10.45, 0.6, 0, -3.6], [12.9, 0.1, 0, -8.6], [14.8, 0.0, 0, -10.2]];
/** stairwell climb (x offset): along the flight up to the landing, turn toward the fire */
const CLIMB: K4[] = [[14.8, SX - 0.1, 0, 1.4], [15.3, SX - 0.1, 0, 0.6], [17.9, SX - 0.1, STAIR.y1, STAIR.z1], [18.4, SX - 0.1, STAIR.y1, STAIR.z1 - 0.7]];
/** shot 6: out of the door with the feet on fire */
const OUTP: K4[] = [[21.65, 0.0, 0, -10.0], [23.2, 0.05, 0, -8.6], [25.4, 0.45, 0, -4.9], [26.25, 0.5, 0, -4.6]];

export const dogAt = (id: number, t: number): DogState | null => {
  switch (id) {
    case 1: return walking(HOOKP, t, { head: -0.05 });
    case 2: {
      const k = at(t, W.flew) ? 1 : 0;
      return idle([0.5, 0, -2.2], 1.45, { head: -0.12 * k + 0.06 * Math.sin(t * 1.3), headYaw: 0.25 * Math.sin(t * 0.7) - 0.15 * k, eye: at(t, W.coat) && !at(t, W.only) ? 2 : 1 });
    }
    case 3: return walking(INTO, t);
    case 4: {
      const s0 = walking(CLIMB, t), onSt = s0.p[2] < STAIR.z0 + 0.1 && s0.p[2] > STAIR.z1 + 0.05;
      const s = { ...s0, p: [s0.p[0], s0.p[1] + (onSt ? 0.1 : 0), s0.p[2]] as V3, stride: s0.stride * 0.7 };
      const found = at(t, W.found);
      return { ...s, yaw: Math.PI, slope: onSt ? SLOPE : 0, head: found ? -0.1 : 0.15, headYaw: found ? -0.55 : 0 };
    }
    case 5: return idle([SX - 0.1, STAIR.y1, STAIR.z1 - 0.9], Math.PI / 2 + 0.5, { eye: at(t, W.eighty) ? 2 : 1, head: 0.04 * Math.sin(t * 1.6), headYaw: 0.1 });
    case 6: {
      const s = walking(OUTP, t), fire = t > 23.0 ? 1 : 0;
      const hosed = t > W.fire3 + 0.25;
      return { ...s, feetFire: hosed ? clamp01(1 - (t - W.fire3 - 0.25) / 0.35) : fire, steam: hosed ? clamp01((t - W.fire3 - 0.25) / 0.2) : 0, eye: at(t, W.all) ? 1 : 1, head: -0.15 };
    }
    case 7: {
      const tap = at(t, W.gave) ? (t - W.gave) * 3.0 : 0;
      return idle([0.6, 0, -3.0], 0.15, { newFeet: true, tap, eye: at(t, W.newf) ? 2 : 1, head: -0.18, headYaw: 0.2 });
    }
    case 8: return idle(DOG8, -0.6, { eye: at(t, W.send) ? 2 : 1, newFeet: true, wag: at(t, W.send) ? 1 : 0.3, head: at(t, W.would) && !at(t, W.send) ? 0.12 : 0, headYaw: at(t, W.would) && !at(t, W.send) ? 0.35 : 0 });
  }
  return null;
};

// ---------------- fires: [x, y, z, w, h, seed] (camera-facing flame cards) ----------------
export type Flame = [number, number, number, number, number, number];
const DOORF: Flame[] = [
  [-1.25, 1.0, -7.85, 1.3, 2.3, 1], [1.25, 1.0, -7.85, 1.3, 2.4, 2], [0, 2.75, -7.8, 2.6, 1.5, 3], [-0.55, 1.15, -8.9, 1.5, 2.4, 4], [0.6, 1.1, -9.1, 1.5, 2.4, 5],
];
const WINF: Flame[] = [
  [-1.8, 5.1, -7.85, 1.4, 1.9, 6], [1.8, 5.0, -7.85, 1.4, 1.9, 7], [1.8, 8.2, -7.85, 1.3, 1.8, 8], [-1.8, 8.3, -7.85, 1.4, 2.0, 9], [0.2, 13.2, -11, 4.2, 2.6, 10],
];
const STAIRF: Flame[] = [
  [SX - 0.6, STAIR.y1 + 1.0, STAIR.landZ + 0.6, 1.5, 2.2, 11], [SX + 0.6, STAIR.y1 + 0.85, STAIR.landZ + 0.4, 1.4, 1.9, 12],
  [SX - 0.85, STAIR.y1 + 2.0, -5.3, 1.1, 1.4, 13], [SX - 0.9, 1.9, -2.6, 1.0, 1.4, 14], [SX - 0.9, 0.7, 0.2, 1.0, 1.3, 15],
  [SX - 0.85, STAIR.y1 + 2.6, STAIR.landZ + 1.4, 1.6, 1.5, 16],
];
export const firesAt = (id: number, t: number): Flame[] => {
  if (id === 4 || id === 5) return STAIRF;
  if (id === 3 && at(t, W.ten)) return [...DOORF.map((f) => [f[0], f[1] * 1.08, f[2], f[3] * 1.15, f[4] * 1.15, f[5]] as Flame), ...WINF];
  return [...DOORF, ...WINF];
};

// ---------------- people (feet positions per shot) ----------------
/** a ground point at `depth` metres along the view and `nx` (-1..1) across a portrait frame of vertical fov `fov` */
export const placeAt = (pos: V3, look: V3, fov: number, depth: number, nx: number): V3 => {
  const fx = look[0] - pos[0], fz = look[2] - pos[2], n = Math.hypot(fx, fz) || 1, ux = fx / n, uz = fz / n;
  const half = Math.tan((fov * Math.PI) / 360) * (9 / 16) * depth;
  return [pos[0] + ux * depth - uz * half * nx, 0, pos[2] + uz * depth + ux * half * nx];
};

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
/** creep toward the look point (look kept ~4-9 m out so the creep stays small) */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** a look point d metres out from pos toward target */
export const aim = (pos: V3, target: V3, d: number): V3 => { const v = target.map((x, i) => x - pos[i]), n = Math.hypot(...v) || 1; return pos.map((x, i) => x + (v[i] / n) * d) as V3; };
const mixV = (a: V3, b: V3, k: number): V3 => a.map((v, i) => v + (b[i] - v) * k) as V3;
const dogP = (id: number, t: number, dy = 0.6): V3 => { const d = dogAt(id, t); return d ? [d.p[0], d.p[1] + dy, d.p[2]] : [0, 0.6, -4]; };

// fixed camera positions reused by cast placement
export const P1: V3 = [1.05, 0.78, -1.6];
export const L1: V3 = aim(P1, [0.1, 2.2, -8], 4);
export const P3: V3 = [0.55, 1.55, 2.6];
export const L3: V3 = aim(P3, [0.1, 1.9, -8], 5);
export const P6: V3 = [0.75, 1.5, 1.4];
export const L6: V3 = aim(P6, [0.15, 1.5, -8], 5);
export const P8: V3 = [0.7, 1.25, 1.75];
export const L8: V3 = aim(P8, [0.45, 1.0, -2.6], 4);

const CAMS: Record<number, Key[]> = {
  1: [
    // low in the yard, a firefighter in the left foreground: the dog trots out of the flames toward us
    { f: 0, s: (f) => { const tg = mixV([0.1, 2.2, -8], dogP(1, f / FPS), 0.15); return dolly(P1, aim(P1, tg, 4), pushK(f, 0, 0.0014), { fov: 54, roll: 0.03 }); } },
    { f: F(W.fire - 0.12), dur: 14, s: (f) => dolly(P1, aim(P1, [0.4, 1.4, -6], 4), pushK(f, F(W.fire), 0.0016, 0.006, 16), { fov: 54, roll: -0.04 }) },
  ],
  2: [
    // CU of the dog in its coat (3/4 view), the burning tower soft behind; rises a little for the rocket
    { f: F(3.75), s: (f) => { const P: V3 = [2.45, 1.25, 0.6]; return dolly(P, aim(P, [0.85, 0.85, -2.15], 3.5), pushK(f, F(3.75), 0.0018), { fov: 42, roll: -0.02 }); } },
    { f: F(W.few - 0.1), dur: 20, s: (f) => { const P: V3 = [2.3, 1.2, 0.35]; return dolly(P, aim(P, [0.85, 0.85, -2.15], 3.5), pushK(f, F(W.few), 0.0018, 0.006, 20), { fov: 42, roll: 0.02 }); } },
    { f: F(W.made - 0.1), dur: 26, s: (f) => { const P: V3 = [2.55, 1.15, 0.85]; return dolly(P, aim(P, [0.75, 1.55, -2.2], 3.5), pushK(f, F(W.made), 0.0016), { fov: 50, roll: -0.03 }); } },
  ],
  3: [
    // behind the two scientists: the dog trots into the burning door
    { f: F(10.45), s: (f) => { const tg = mixV([0.1, 1.9, -8], dogP(3, f / FPS), 0.18); return dolly(P3, aim(P3, tg, 5), pushK(f, F(10.45), 0.0016), { fov: 54, roll: 0.02 }); } },
    { f: F(W.ten - 0.1), dur: 20, s: (f) => dolly(P3, aim(P3, [0.1, 3.4, -8], 5), pushK(f, F(W.ten), 0.0016, 0.005, 20), { fov: 54, roll: -0.03 }) },
  ],
  4: [
    // stairwell, from the open side: follow the dog up the flight to the landing
    { f: F(14.8), s: (f) => { const P: V3 = [SX + 4.8, 1.7, -1.6], tg = mixV([SX - 0.2, 1.6, -2.0], dogP(4, f / FPS, 0.55), 0.85); return { pos: P, look: aim(P, tg, 5), fov: 60, roll: 0.02 }; } },
    { f: F(W.found - 0.1), dur: 22, s: (f) => { const P: V3 = [SX + 5.4, 4.5, -3.4], tg = mixV([SX - 0.3, 4.6, STAIR.landZ + 1.0], dogP(4, f / FPS, 0.6), 0.72); return dolly(P, aim(P, tg, 5), pushK(f, F(W.found), 0.0018, 0.005, 20), { fov: 56, roll: -0.03 }); } },
  ],
  5: [
    // close on the dog on the landing among the flames: calm
    { f: F(19.1), s: (f) => { const P: V3 = [SX + 3.8, 4.45, -3.4]; return dolly(P, aim(P, [SX + 0.45, 3.85, STAIR.z1 - 1.2], 4), pushK(f, F(19.1), 0.0022), { fov: 48, roll: 0.02 }); } },
  ],
  6: [
    // the door again, the scientists in front: out it comes, every foot on fire; glide down to the feet
    { f: F(21.65), s: (f) => { const tg = mixV([0.15, 1.5, -8], dogP(6, f / FPS, 0.5), 0.2); return dolly(P6, aim(P6, tg, 5), pushK(f, F(21.65), 0.0016), { fov: 54, roll: -0.02 }); } },
    { f: F(W.all - 0.05), cut: true, s: (f) => { const P: V3 = [1.75, 0.65, -2.5], tg = dogP(6, f / FPS, 0.35); return dolly(P, aim(P, tg, 3), pushK(f, F(W.all), 0.0016, 0.004, 18), { fov: 50, roll: 0.03 }); } },
  ],
  7: [
    // low on the new feet, tap tap
    { f: F(26.25), s: (f) => { const P: V3 = [2.4, 0.62, -0.75]; return dolly(P, aim(P, [0.6, 0.5, -3.0], 3), pushK(f, F(26.25), 0.0022, 0.006, 22), { fov: 42, roll: -0.03 }); } },
  ],
  8: [
    // the firefighter and the dog side by side, the tower behind
    { f: F(28.2), s: (f) => dolly(P8, L8, pushK(f, F(28.2), 0.0018), { fov: 46 }) },
    { f: F(W.send - 0.1), dur: 26, s: (f) => dolly([0.75, 1.25, 1.55], L8, pushK(f, F(W.send), 0.0012, 0.003, 22), { fov: 46, roll: 0.03 }) },
  ],
};

/** impact kicks: [t (film seconds), gain] */
const KICKS: [number, number][] = [[W.fire + 0.02, 0.5], [W.all + 0.02, 0.5], [W.fire3 + 0.25, 0.4]];
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

// ---------------- people placement (from the shot cameras) ----------------
export const FF1: V3 = placeAt(P1, L1, 54, 2.3, -0.6);
export const SCI3: [V3, V3] = [placeAt(P3, L3, 54, 2.4, -0.62), placeAt(P3, L3, 54, 2.7, 0.66)];
export const SCI6: [V3, V3] = [placeAt(P6, L6, 54, 2.3, -0.66), placeAt(P6, L6, 54, 2.6, 0.7)];
export const FF8: V3 = placeAt(P8, L8, 46, 4.2, -0.62);
export const DOG8: V3 = placeAt(P8, L8, 46, 3.8, 0.24);

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: F(3.75), cInf: 13, focus: () => [0.5, 0.95, -2.2] },
  { f: F(10.45), cInf: 0 },
  { f: F(14.8), cInf: 0 },
  { f: F(19.1), cInf: 10, focus: () => [SX - 0.1, 3.9, STAIR.z1 - 0.9] },
  { f: F(21.65), cInf: 0 },
  { f: F(W.all - 0.05), cInf: 8, focus: (f) => dogP(6, f / FPS, 0.3) },
  { f: F(26.25), cInf: 10, focus: () => [0.6, 0.4, -3.0] },
  { f: F(28.2), cInf: 9, focus: () => [0.4, 1.2, -2.6] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
