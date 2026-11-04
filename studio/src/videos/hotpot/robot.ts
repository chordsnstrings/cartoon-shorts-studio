// Our own characters that are not people: the apron-wearing dance robot (screen face), the tin wind-up toy, and
// the effect cards of this short (confetti, steam, the planned-move dotted arc, sauce splats, music notes).
// Drawn with the same Pen (plum ink, two-tone fills) in the 600 x 1000 design canvas, soles at y = 975.
import { Pen, INK, mul, mix, ellPts, rrect, P2, thickAngle } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
const SH: [number, number, number] = [0.72, 0.74, 0.84];
const SHELL = "#f4f1ea", JOINT = "#3fa7a0", JOINT_D = "#2c7f7a", SCREEN = "#1d2432", GLOW = "#7ff6ff";
const APRON = "#d9443b", STRAP = "#f7efe2";

export type RobotFace = "happy" | "star" | "closed" | "dots" | "wink";
export type RobotPose = {
  /** shoulder angle from hanging (deg, + = arm swings outward/up), elbow bend (deg) */
  la: number; le: number; ra: number; re: number;
  sway?: number; head?: number; face?: RobotFace; sauce?: boolean; step?: number; blink?: number; light?: number;
};

const limb = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  p.stroke([a, b], w + 10, INK);
  p.stroke([a, b], w, col);
};
const rotP = (q: P2, a: number, c: P2): P2 => {
  const s = Math.sin(a), co = Math.cos(a);
  return [c[0] + (q[0] - c[0]) * co - (q[1] - c[1]) * s, c[1] + (q[0] - c[0]) * s + (q[1] - c[1]) * co];
};

/** the robot, ~1.3 m tall (design 375 .. 975) */
export const drawRobot = (p: Pen, P: RobotPose) => {
  const light = P.light ?? rad(-120), thick = thickAngle(light);
  const sway = rad(P.sway ?? 0), hip: P2 = [300, 830], step = P.step ?? 0;
  // ---- legs (not swayed): short, slightly apart, feet planted; step lifts one foot a little
  for (const side of [-1, 1]) {
    const up = Math.max(0, side * step) * 26;
    const top: P2 = [300 + side * 34, 835], ank: P2 = [300 + side * 40, 948 - up];
    limb(p, top, ank, 34, JOINT_D);
    const fp = ellPts(ank[0] + side * 6, 958 - up, 34, 17);
    p.gradFill(fp, "#3b4150", "#262a36", light); p.inkRing(fp, 7, thick);
  }
  // ---- upper body rotates about the hip
  p.rot = sway ? [sway, hip[0], hip[1]] : null;
  const shL: P2 = [228, 672], shR: P2 = [372, 672];
  const arm = (sh: P2, side: number, ang: number, el: number, front: boolean) => {
    // ang 0 = hanging straight down; positive swings outward (left arm to -x, right arm to +x)
    const a = rad(ang), L1 = 92, L2 = 86;
    const E: P2 = [sh[0] + side * Math.sin(a) * L1, sh[1] + Math.cos(a) * L1];
    const a2 = a + side * 0 + rad(el) * side;
    const Hd: P2 = [E[0] + side * Math.sin(a2) * L2, E[1] + Math.cos(a2) * L2];
    limb(p, sh, E, 28, SHELL); limb(p, E, Hd, 26, SHELL);
    p.ell(E[0], E[1], 17, 17, JOINT, 6);
    p.ell(Hd[0], Hd[1], 22, 22, front && P.sauce ? "#e9e2d6" : "#e9e2d6", 7);
    if (front && P.sauce) {
      p.ell(Hd[0] + 4, Hd[1] + 2, 16, 12, "#d0782e", 0);
      p.ell(Hd[0] - 8, Hd[1] + 12, 6, 10, "#c4642a", 0);
      p.ell(Hd[0] - 8, Hd[1] + 24, 4, 5, "#c4642a", 0);
      for (const [dx, dy] of [[-4, -2], [8, 4], [2, 8], [12, -4]]) p.ell(Hd[0] + dx, Hd[1] + dy, 2.5, 1.6, "#7a2a14", 0);
    }
    return Hd;
  };
  // far (left) arm behind the torso
  arm(shL, -1, P.la, P.le, false);
  // torso shell
  const tp = rrect(222, 640, 378, 852, 58);
  p.gradFill(tp, SHELL, mul(SHELL, SH), light);
  p.inkRing(tp, 9, thick);
  // apron: bib + skirt, neck strap, waist ties, pocket
  p.band([[256, 640], [300, 610], [344, 640]], STRAP, 10, 3);
  const ap: P2[] = [[248, 700], [352, 700], [356, 760], [372, 770], [366, 895], [234, 895], [228, 770], [244, 760]];
  p.gradFill(ap, APRON, mul(APRON, SH), light);
  p.inkRing(ap, 7, thick, 0.3);
  p.band([[226, 768], [374, 768]], STRAP, 9, 3);
  p.poly(rrect(270, 800, 330, 850, 8), mul(APRON, [0.86, 0.86, 0.9]), 5);
  p.dot(300, 730, 9, "#f7d24a"); p.dot(300, 730, 4, INK);
  // near (right) arm in front
  arm(shR, 1, P.ra, P.re, true);
  for (const s of [shL, shR]) p.ell(s[0], s[1], 21, 21, JOINT, 7);
  // ---- head: tilts about the neck on top of the sway
  const neck: P2 = [300, 640];
  const nk = sway ? rotP(neck, sway, hip) : neck;
  p.rot = [sway + rad(P.head ?? 0), 300, 640, nk[0] - 300, nk[1] - 640];
  p.poly(rrect(282, 600, 318, 646, 8), JOINT_D, 6);
  const hp = rrect(214, 455, 386, 612, 62);
  p.gradFill(hp, SHELL, mul(SHELL, SH), light);
  p.inkRing(hp, 9, thick);
  for (const s of [-1, 1]) p.ell(300 + s * 88, 534, 13, 30, JOINT, 6);
  p.stroke([[300, 455], [300, 420]], 7, INK); p.dot(300, 414, 12, "#f7d24a"); p.ell(300, 414, 12, 12, null, 5);
  const sp = rrect(236, 480, 364, 590, 40);
  p.poly(sp, SCREEN, 6);
  // face on the screen (unlit glow colours; never outlined)
  const face = P.face ?? "happy", blink = P.blink ?? 0, ex = 34, ey = 528;
  const g = p.g;
  const arcEye = (x: number, up: boolean) => p.arc(x, ey + (up ? 6 : -4), 15, 12, up ? 200 : 20, up ? 340 : 160, 8, GLOW);
  if (blink > 0.6 || face === "closed") { arcEye(300 - ex, true); arcEye(300 + ex, true); }
  else if (face === "star") {
    for (const s of [-1, 1]) {
      const pts: P2[] = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 19, a = rad(-90 + i * 36); pts.push([300 + s * ex + r * Math.cos(a), ey + r * Math.sin(a)]); }
      p.poly(pts, "#ffe66b", 0);
    }
  } else if (face === "dots") { for (const s of [-1, 1]) p.ell(300 + s * ex, ey, 10, blink > 0.2 ? 4 : 13, GLOW, 0); }
  else if (face === "wink") { arcEye(300 - ex, true); p.ell(300 + ex, ey, 10, 13, GLOW, 0); }
  else { arcEye(300 - ex, true); arcEye(300 + ex, true); }
  // smile
  p.arc(300, 552, 26, 16, 15, 165, 8, GLOW);
  if (face === "star") { g.globalAlpha = 0.9; p.ell(300 - 60, 566, 9, 6, "#ff8fb0", 0); p.ell(300 + 60, 566, 9, 6, "#ff8fb0", 0); g.globalAlpha = 1; }
  p.rot = null;
};

// ---------------- wind-up toy (our own: a round tin bird on two wire legs, key in its back) ----------------
const TIN = "#e8533f", TIN2 = "#f6c445", KEY = "#c9ccd2";
/** canvas 600 x 600, feet at y = 560; phase 0..1 per step pair, key turn angle, stopped = legs together */
export const drawToy = (p: Pen, phase: number, keyAng: number, stopped: boolean, light = rad(-120)) => {
  const thick = thickAngle(light), two = Math.PI * 2;
  const bob = stopped ? 0 : 10 * Math.abs(Math.sin(two * phase));
  const tilt = stopped ? 0 : rad(5 * Math.sin(two * phase));
  // legs: thin wire with big flat feet, alternating
  for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
    const up = stopped ? 0 : Math.max(0, Math.sin(two * (phase + ph))) * 34;
    const fx = 300 + side * 44 + (stopped ? 0 : 26 * Math.cos(two * (phase + ph))), fy = 548 - up;
    p.stroke([[300 + side * 30, 430 - bob], [fx, fy]], 16, INK);
    p.stroke([[300 + side * 30, 430 - bob], [fx, fy]], 7, "#7d848c");
    p.ell(fx + 22, fy + 8, 40, 14, TIN2, 7);
  }
  p.rot = [tilt, 300, 440 - bob];
  // key (behind, sticking out the left)
  const ks = Math.abs(Math.cos(keyAng));
  p.band([[150, 330 - bob], [100, 330 - bob]], KEY, 16, 5);
  p.ell(78, 330 - bob, 14 + 26 * ks, 44, KEY, 7);
  p.ell(78, 330 - bob, 4 + 8 * ks, 16, "#9aa0a8", 0);
  // body: round tin egg with a stripe, wing, tail
  const bp = ellPts(300, 330 - bob, 160, 130);
  p.gradFill(bp, TIN, mul(TIN, SH), light);
  p.clip(bp, () => {
    p.band([[120, 380 - bob], [480, 380 - bob]], TIN2, 26, 0);
    for (let i = 0; i < 7; i++) p.dot(170 + i * 45, 380 - bob, 6, "#fff4d8");
  });
  p.inkRing(bp, 10, thick);
  p.poly([[160, 300 - bob], [92, 262 - bob], [118, 318 - bob]], TIN2, 8);
  const wp = ellPts(290, 340 - bob, 70, 44, 0, 360, -15);
  p.poly(wp, mix(TIN, INK, 0.18), 8);
  // head bump + eye + beak
  p.ell(400, 250 - bob, 70, 62, TIN, 9);
  p.dot(418, 238 - bob, 13, INK); p.dot(423, 233 - bob, 4, "#ffffff");
  p.poly([[462, 252 - bob], [520, 266 - bob], [462, 282 - bob]], TIN2, 7);
  p.rot = null;
};

// ---------------- effect cards ----------------
export const fxConfetti = (p: Pen, seed: number) => {
  const cols = ["#ffd34d", "#ff6f91", "#5ad1c9", "#8f7bff", "#ffffff", "#ff9a3c"];
  for (let i = 0; i < 26; i++) {
    const r1 = Math.sin(seed * 91.7 + i * 12.9898) * 43758.5453, r = r1 - Math.floor(r1);
    const r2 = Math.sin(seed * 31.3 + i * 78.233) * 12543.11, q = r2 - Math.floor(r2);
    const x = 40 + r * 420, y = 40 + q * 420, a = r * 6.28;
    const pts: P2[] = [[-12, -6], [12, -6], [12, 6], [-12, 6]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)] as P2);
    p.poly(pts, cols[i % cols.length], 3);
  }
};
export const fxSteam = (p: Pen) => {
  const g = p.g;
  for (const [x, y, r, a] of [[128, 190, 70, 0.32], [100, 120, 56, 0.26], [150, 70, 44, 0.2], [120, 230, 50, 0.3]] as const) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,252,246,${a})`); gr.addColorStop(1, "rgba(255,252,246,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
};
/** the dance as a plan: a dotted arc ahead of the hand (canvas 512 x 512, arc centre 256,256, radius 200) */
export const fxPlanArc = (p: Pen, a0: number, a1: number, n: number) => {
  const N = 14;
  for (let i = 0; i < Math.min(n, N); i++) {
    const a = rad(a0 + ((a1 - a0) * i) / (N - 1)), b = a + rad(((a1 - a0) / (N - 1)) * 0.55);
    const pts: P2[] = [[256 + 210 * Math.cos(a), 256 + 210 * Math.sin(a)], [256 + 210 * Math.cos(b), 256 + 210 * Math.sin(b)]];
    p.stroke(pts, 30, INK); p.stroke(pts, 16, "#ffe66b");
  }
  if (n >= N) {
    const a = rad(a1 + 6), x = 256 + 210 * Math.cos(a), y = 256 + 210 * Math.sin(a), t = a + Math.PI / 2; // tangent (clockwise)
    const tip: P2 = [x + 46 * Math.cos(t), y + 46 * Math.sin(t)];
    const l: P2 = [x + 30 * Math.cos(a), y + 30 * Math.sin(a)], r: P2 = [x - 30 * Math.cos(a), y - 30 * Math.sin(a)];
    p.poly([tip, l, r], "#ffe66b", 8);
  }
};
/** impact star: fat jagged yellow-white burst with ink, popping then shrinking */
export const fxPow = (p: Pen, t: number) => {
  const k = t < 0.3 ? 0.6 + 1.3 * t : 1 - 0.5 * (t - 0.3);
  const star = (R: number, r: number, n: number, rot: number): P2[] => Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R * (0.85 + 0.15 * Math.sin(i * 7.3));
    return [256 + rr * Math.cos(a), 256 + rr * Math.sin(a)] as P2;
  });
  p.poly(star(230 * k, 120 * k, 9, 0.2), "#ffd23c", 12);
  p.poly(star(140 * k, 72 * k, 9, 0.5), "#fff8d8", 0);
};
export const fxSplat = (p: Pen, seed: number) => {
  p.ell(128, 128, 70, 46, "#c4642a", 0);
  for (let i = 0; i < 7; i++) { const a = seed + i * 0.9, d = 70 + 30 * Math.sin(i * 3.1 + seed); p.ell(128 + d * Math.cos(a), 128 + 0.66 * d * Math.sin(a), 11, 8, "#c4642a", 0); }
  p.ell(110, 118, 22, 12, "#e08a44", 0);
  for (let i = 0; i < 9; i++) p.ell(100 + (i * 37) % 60, 110 + (i * 23) % 40, 4, 2.5, "#7a2a14", 0);
};
export const fxMusic = (p: Pen, kind: number) => {
  const col = "#2d2140";
  if (kind % 2) { p.ell(70, 190, 34, 26, col, 0, 0, 360, -20); p.stroke([[100, 182], [104, 50]], 12, col); p.stroke([[104, 50], [170, 80], [170, 120]], 14, col); }
  else { p.ell(60, 200, 30, 23, col, 0, 0, 360, -20); p.ell(170, 175, 30, 23, col, 0, 0, 360, -20); p.stroke([[86, 192], [90, 70], [196, 46], [196, 168]], 12, col); p.stroke([[90, 74], [196, 50]], 22, col); }
};
export const fxShake = (p: Pen) => { // little motion ticks around an impact
  for (let i = 0; i < 6; i++) { const a = rad(-160 + i * 28); p.stroke([[128 + 70 * Math.cos(a), 128 + 70 * Math.sin(a)], [128 + 118 * Math.cos(a), 128 + 118 * Math.sin(a)]], 12, INK); }
};
