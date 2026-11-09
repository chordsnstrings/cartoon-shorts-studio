// Our own non-human characters and effect cards for the robot-cleaner short: the little cleaning robot (white shell,
// plain blue T-shirt, 3D-printed head with two antennae, claw hands, grippy socks), the toilet brush it holds, and the
// effect cards (coins, clock, signal waves, heat lines, loading ring, sparkles, smoke, the brush head). No text anywhere.
// Drawn with the same Pen (plum ink, two-tone fills) in the 600 x 1000 design canvas, soles at y = 975.
import { Pen, INK, mul, mix, ellPts, rrect, P2, thickAngle } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
const SH: [number, number, number] = [0.72, 0.74, 0.84];
const SHELL = "#f4f1ea", JOINT = "#8a93a6", JOINT_D = "#5d6578", SCREEN = "#1d2432", GLOW = "#7ff6ff";
const SHIRT = "#3a6fc8", SOCK = "#f2a03a", GRIP = "#c4462f";
export const BRUSH = "#e8483c", BRISTLE = "#f4f1ea";

export type RobotFace = "happy" | "dots" | "closed" | "dizzy" | "frozen" | "wink" | "proud";
export type RobotPose = {
  /** shoulder angle from hanging (deg, + = arm swings outward/up), elbow bend (deg) */
  la: number; le: number; ra: number; re: number;
  sway?: number; head?: number; face?: RobotFace; step?: number; blink?: number; light?: number;
  /** claws: 0 shut .. 1 open */
  claw?: number;
  /** legs hang loose (carried) with a swing phase */
  dangle?: number | null;
  /** toilet brush in the right claw: tip offset from the claw in canvas units, head on or off */
  brush?: { dx: number; dy: number; head: boolean } | null;
};

const limb = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  p.stroke([a, b], w + 10, INK);
  p.stroke([a, b], w, col);
};
const rotP = (q: P2, a: number, c: P2): P2 => {
  const s = Math.sin(a), co = Math.cos(a);
  return [c[0] + (q[0] - c[0]) * co - (q[1] - c[1]) * s, c[1] + (q[0] - c[0]) * s + (q[1] - c[1]) * co];
};

/** the arm geometry, shared with cast.ts (to find the claw on the card): returns elbow + claw centre */
export const armPts = (side: number, ang: number, el: number): [P2, P2] => {
  const sh: P2 = side < 0 ? [234, 664] : [366, 664];
  const a = rad(ang), L1 = 82, L2 = 78;
  const E: P2 = [sh[0] + side * Math.sin(a) * L1, sh[1] + Math.cos(a) * L1];
  const a2 = a + rad(el);
  return [E, [E[0] + side * Math.sin(a2) * L2, E[1] + Math.cos(a2) * L2]];
};

/** a two-finger claw at H pointing along angle dir (canvas rad, 0 = +x), opening k */
const claw = (p: Pen, H: P2, dir: number, k: number) => {
  const c = Math.cos(dir), s = Math.sin(dir), n: P2 = [-s, c];
  p.ell(H[0], H[1], 19, 19, JOINT_D, 6);
  for (const sd of [-1, 1]) {
    const open = rad(10 + 26 * k) * sd;
    const d1 = dir + open, d2 = dir - open * 1.2;
    const b: P2 = [H[0] + n[0] * sd * 8, H[1] + n[1] * sd * 8];
    const m: P2 = [b[0] + Math.cos(d1) * 26, b[1] + Math.sin(d1) * 26];
    const tp: P2 = [m[0] + Math.cos(d2) * 20, m[1] + Math.sin(d2) * 20];
    p.stroke([b, m, tp], 20, INK); p.stroke([b, m, tp], 10, "#c9ced8");
  }
};

/** the toilet brush, from the claw H to its tip T; head = bristle ball at the tip */
export const drawBrush = (p: Pen, H: P2, T: P2, head: boolean) => {
  p.stroke([H, T], 22, INK); p.stroke([H, T], 12, BRUSH);
  if (head) brushHead(p, T[0], T[1], Math.atan2(T[1] - H[1], T[0] - H[0]));
};
/** bristle head centred at (x, y), handle direction a */
export const brushHead = (p: Pen, x: number, y: number, a: number) => {
  const pts = ellPts(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 34, 26, 0, 360, (a * 180) / Math.PI);
  p.poly(pts, BRISTLE, 7);
  for (let i = 0; i < 7; i++) { const b = a - 1.3 + i * 0.43; p.stroke([[x + Math.cos(b) * 16, y + Math.sin(b) * 16], [x + Math.cos(b) * 40, y + Math.sin(b) * 40]], 5, mul(BRISTLE, [0.78, 0.8, 0.9])); }
  p.ell(x, y, 12, 12, BRUSH, 5);
};

/** the robot, ~1.37 m tall at ROBOT_S (design 388 .. 975) */
export const drawRobot = (p: Pen, P: RobotPose) => {
  const light = P.light ?? rad(-120), thick = thickAngle(light);
  const sway = rad(P.sway ?? 0), hip: P2 = [300, 830], step = P.step ?? 0, k = P.claw ?? 0.3;
  // ---- legs + grippy socks (not swayed)
  for (const side of [-1, 1]) {
    const up = P.dangle != null ? 0 : Math.max(0, side * step) * 26;
    const top: P2 = [300 + side * 32, 835];
    const sw = P.dangle != null ? rad(8 * Math.sin(P.dangle * 6.283 + side)) : 0;
    const ank: P2 = P.dangle != null ? [top[0] + side * 6 + Math.sin(sw) * 110, top[1] + Math.cos(sw) * 108] : [300 + side * 38, 940 - up];
    limb(p, top, ank, 30, JOINT_D);
    // the sock: ankle cuff + foot, toes outward, red grip dots on the sole
    const fx = ank[0] + side * 10, fy = ank[1] + 18;
    const fp = ellPts(fx, fy, 36, 18);
    p.gradFill(fp, SOCK, mul(SOCK, SH), light); p.inkRing(fp, 7, thick);
    p.poly(rrect(ank[0] - 17, ank[1] - 14, ank[0] + 17, ank[1] + 6, 6), mix(SOCK, "#ffffff", 0.35), 6);
    for (let i = 0; i < 4; i++) p.dot(fx - 22 + i * 15, fy + 12, 4.5, GRIP);
  }
  // ---- upper body rotates about the hip
  p.rot = sway ? [sway, hip[0], hip[1]] : null;
  const [eL, hL] = armPts(-1, P.la, P.le), [eR, hR] = armPts(1, P.ra, P.re);
  const shL: P2 = [234, 664], shR: P2 = [366, 664];
  // far (left) arm behind the torso
  limb(p, shL, eL, 24, SHELL); limb(p, eL, hL, 22, SHELL); p.ell(eL[0], eL[1], 14, 14, JOINT, 5);
  claw(p, hL, Math.atan2(hL[1] - eL[1], hL[0] - eL[0]), k);
  // torso shell + plain T-shirt (no print)
  const tp = rrect(228, 640, 372, 856, 54);
  p.gradFill(tp, SHELL, mul(SHELL, SH), light);
  p.inkRing(tp, 9, thick);
  const sh: P2[] = [[236, 668], [262, 646], [338, 646], [364, 668], [366, 800], [234, 800]];
  p.gradFill(sh, SHIRT, mul(SHIRT, SH), light); p.inkRing(sh, 7, thick, 0.3);
  p.arc(300, 648, 24, 14, 10, 170, 6, INK);
  for (const sd of [-1, 1]) p.poly([[300 + sd * 62, 650], [300 + sd * 84, 660], [300 + sd * 80, 700], [300 + sd * 62, 694]], SHIRT, 6); // sleeves
  // near (right) arm in front, with the brush
  limb(p, shR, eR, 24, SHELL); limb(p, eR, hR, 22, SHELL); p.ell(eR[0], eR[1], 14, 14, JOINT, 5);
  const dirR = Math.atan2(hR[1] - eR[1], hR[0] - eR[0]);
  if (P.brush) drawBrush(p, hR, [hR[0] + P.brush.dx, hR[1] + P.brush.dy], P.brush.head);
  claw(p, hR, dirR, P.brush ? 0.05 : k);
  for (const s of [shL, shR]) p.ell(s[0], s[1], 18, 18, JOINT, 6);
  // ---- head: tilts about the neck on top of the sway
  const neck: P2 = [300, 640];
  const nk = sway ? rotP(neck, sway, hip) : neck;
  p.rot = [sway + rad(P.head ?? 0), 300, 640, nk[0] - 300, nk[1] - 640];
  p.poly(rrect(284, 604, 316, 646, 8), JOINT_D, 6);
  // two antennae with round tips
  for (const sd of [-1, 1]) { p.stroke([[300 + sd * 44, 476], [300 + sd * 66, 410]], 7, INK); p.dot(300 + sd * 66, 404, 12, "#f7d24a"); p.ell(300 + sd * 66, 404, 12, 12, null, 5); }
  const hp = rrect(216, 466, 384, 612, 58);
  p.gradFill(hp, SHELL, mul(SHELL, SH), light);
  p.inkRing(hp, 9, thick);
  for (const s of [-1, 1]) p.ell(300 + s * 86, 540, 12, 26, JOINT, 6);
  const sp = rrect(238, 490, 362, 592, 38);
  p.poly(sp, SCREEN, 6);
  // face on the screen (glow colours, never outlined)
  const face = P.face ?? "happy", blink = P.blink ?? 0, ex = 32, ey = 532;
  const arcEye = (x: number, up: boolean) => p.arc(x, ey + (up ? 6 : -4), 14, 11, up ? 200 : 20, up ? 340 : 160, 8, GLOW);
  if (face === "dizzy") {
    for (const s of [-1, 1]) {
      const pts: P2[] = [];
      for (let i = 0; i < 26; i++) { const a = i * 0.55 * s, r = 2 + i * 0.62; pts.push([300 + s * ex + r * Math.cos(a), ey + r * Math.sin(a)]); }
      p.stroke(pts, 5, GLOW);
    }
    p.stroke([[276, 566], [288, 559], [300, 566], [312, 559], [324, 566]], 6, GLOW);
  } else if (face === "frozen") {
    for (const s of [-1, 1]) p.stroke([[300 + s * ex - 12, ey], [300 + s * ex + 12, ey]], 7, GLOW);
    p.stroke([[284, 564], [316, 564]], 6, GLOW);
  } else {
    if (blink > 0.6 || face === "closed") { arcEye(300 - ex, true); arcEye(300 + ex, true); }
    else if (face === "dots") { for (const s of [-1, 1]) p.ell(300 + s * ex, ey, 10, blink > 0.2 ? 4 : 13, GLOW, 0); }
    else if (face === "wink") { arcEye(300 - ex, true); p.ell(300 + ex, ey, 10, 13, GLOW, 0); }
    else if (face === "proud") { arcEye(300 - ex, true); arcEye(300 + ex, true); }
    else { arcEye(300 - ex, true); arcEye(300 + ex, true); }
    if (face === "dots") p.ell(300, 562, 9, 7, GLOW, 0); // little "o"
    else p.arc(300, 556, face === "proud" ? 30 : 24, face === "proud" ? 20 : 15, 15, 165, 8, GLOW);
  }
  p.rot = null;
};

// ---------------- effect cards ----------------
/** a gold coin (256 x 256), spin 0..1 squashes it */
export const fxCoin = (p: Pen, spin: number) => {
  const w = 100 * Math.max(0.15, Math.abs(Math.cos(spin * Math.PI)));
  p.ell(128, 128, w, 100, "#f2c43a", 9);
  if (w > 40) { p.ell(128, 128, w * 0.72, 72, null, 6); const st: P2[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 16 : 36, a = rad(-90 + i * 36); st.push([128 + (r * Math.cos(a) * w) / 100, 128 + r * Math.sin(a)]); } p.poly(st, "#fbe08a", 0); }
};
/** a round wall-clock face, one hand sweeping (256 x 256), no numerals */
export const fxClock = (p: Pen, a: number) => {
  p.ell(128, 128, 104, 104, "#fbfaf4", 10);
  for (let i = 0; i < 12; i++) { const b = (i * Math.PI) / 6; p.stroke([[128 + 80 * Math.cos(b), 128 + 80 * Math.sin(b)], [128 + 92 * Math.cos(b), 128 + 92 * Math.sin(b)]], 7, INK); }
  p.stroke([[128, 128], [128 + 50 * Math.cos(-Math.PI / 2 + 0.6), 128 + 50 * Math.sin(-Math.PI / 2 + 0.6)]], 12, INK);
  p.stroke([[128, 128], [128 + 76 * Math.cos(a - Math.PI / 2), 128 + 76 * Math.sin(a - Math.PI / 2)]], 8, "#e8483c");
  p.dot(128, 128, 9, INK);
};
/** radio waves: n arcs fanning upward (256 x 256) */
export const fxWaves = (p: Pen, u: number) => {
  for (let i = 0; i < 3; i++) {
    const r = 30 + ((u + i / 3) % 1) * 90, a = 1 - ((u + i / 3) % 1);
    p.g.globalAlpha = Math.min(1, a * 1.6);
    p.arc(128, 200, r, r, 220, 320, 14, INK); p.arc(128, 200, r, r, 222, 318, 7, "#7ff6ff");
  }
  p.g.globalAlpha = 1;
};
/** wavy red heat lines rising (256 x 256) */
export const fxHeat = (p: Pen, u: number) => {
  for (let i = 0; i < 3; i++) {
    const x = 70 + i * 58, pts: P2[] = [];
    for (let k = 0; k < 9; k++) { const y = 230 - k * 24; pts.push([x + 12 * Math.sin(k * 1.4 + u * 9 + i), y]); }
    p.stroke(pts, 18, INK); p.stroke(pts, 9, i === 1 ? "#ff7a3c" : "#e8483c");
  }
};
/** a "loading" ring of dots, one bright dot running round (256 x 256) */
export const fxLoading = (p: Pen, u: number) => {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, on = (Math.floor(u * 8) % 8) === i;
    p.dot(128 + 80 * Math.cos(a), 128 + 80 * Math.sin(a), on ? 22 : 15, INK);
    p.dot(128 + 80 * Math.cos(a), 128 + 80 * Math.sin(a), on ? 16 : 9, on ? "#ffffff" : "#9aa3b8");
  }
};
/** a four-point sparkle (256 x 256), k = size 0..1 */
export const fxSparkle = (p: Pen, k: number) => {
  const s = 110 * k, w = 22 * k;
  p.poly([[128, 128 - s], [128 + w, 128 - w], [128 + s, 128], [128 + w, 128 + w], [128, 128 + s], [128 - w, 128 + w], [128 - s, 128], [128 - w, 128 - w]], "#fff6c8", Math.max(1, 8 * k));
};
/** grey-dark smoke puff (256 x 256), t 0..1 */
export const fxSmoke = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) { const a = i * 1.6, r = 46 + 14 * (i % 2); const c = 80 + 50 * t | 0; p.ell(128 + 38 * Math.cos(a), 128 + 30 * Math.sin(a), r, r * 0.85, `rgba(${c},${c},${c + 8},${(0.95 - 0.7 * t).toFixed(2)})`, 0); }
};
/** the brush head alone, lying / falling (256 x 256) */
export const fxBrushHead = (p: Pen, a: number) => {
  const x = 128 - Math.cos(a) * 14, y = 128 - Math.sin(a) * 14;
  p.stroke([[x - Math.cos(a) * 30, y - Math.sin(a) * 30], [x, y]], 20, INK); p.stroke([[x - Math.cos(a) * 30, y - Math.sin(a) * 30], [x, y]], 10, BRUSH);
  brushHead(p, x, y, a);
};
/** a water drop (64 x 96) */
export const fxDrop = (p: Pen) => { p.poly([[32, 8], [52, 52], [52, 66], [42, 84], [22, 84], [12, 66], [12, 52]], "#8fd0ff", 6); p.dot(26, 60, 6, "#ffffff"); };
/** impact star: fat jagged yellow-white burst with ink */
export const fxPow = (p: Pen, t: number) => {
  const k = t < 0.3 ? 0.6 + 1.3 * t : 1 - 0.5 * (t - 0.3);
  const star = (R: number, r: number, n: number, rot: number): P2[] => Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R * (0.85 + 0.15 * Math.sin(i * 7.3));
    return [256 + rr * Math.cos(a), 256 + rr * Math.sin(a)] as P2;
  });
  p.poly(star(230 * k, 120 * k, 9, 0.2), "#ffd23c", 12);
  p.poly(star(140 * k, 72 * k, 9, 0.5), "#fff8d8", 0);
};
/** motion ticks around something wobbling (256 x 256) */
export const fxShake = (p: Pen) => {
  for (let i = 0; i < 6; i++) { const a = rad(-160 + i * 28); p.stroke([[128 + 70 * Math.cos(a), 128 + 70 * Math.sin(a)], [128 + 118 * Math.cos(a), 128 + 118 * Math.sin(a)]], 12, INK); }
};
