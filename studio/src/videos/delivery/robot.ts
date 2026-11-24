// Effect cards for the flying-camera short (coins, clock, signal waves, sparkles, impact star, buzz ticks, the delivery
// box, calendar pages without numbers, a cobweb, sleep Zs, a battery, a sandwich, audience heads, a soft spotlight).
// No text anywhere. Drawn with the same Pen (plum ink, two-tone fills).
import { Pen, INK, P2, rrect } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
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
export const fxWaves = (p: Pen, u: number, col = "#7ff6ff") => {
  for (let i = 0; i < 3; i++) {
    const r = 30 + ((u + i / 3) % 1) * 90, a = 1 - ((u + i / 3) % 1);
    p.g.globalAlpha = Math.min(1, a * 1.6);
    p.arc(128, 200, r, r, 220, 320, 14, INK); p.arc(128, 200, r, r, 222, 318, 7, col);
  }
  p.g.globalAlpha = 1;
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

/** cardboard delivery box with tape and a drone pictogram (512 x 512); open = 1 shows the flaps up */
export const fxBox = (p: Pen, open: number) => {
  p.poly([[96, 200], [416, 200], [416, 470], [96, 470]], "#c9925a", 12);
  p.poly([[96, 200], [416, 200], [416, 240], [96, 240]], "#b07c48", 0);
  if (open) {
    p.poly([[96, 200], [40, 110], [200, 120], [256, 200]], "#d9a46a", 12);
    p.poly([[416, 200], [472, 110], [312, 120], [256, 200]], "#d9a46a", 12);
    p.poly([[110, 200], [402, 200], [380, 222], [132, 222]], "#4a3528", 0);
  } else p.poly([[230, 200], [282, 200], [282, 470], [230, 470]], "#e9d8b0", 6);
  // pictogram: body + four rings
  const cx = open ? 256 : 160, cy = 360, s = open ? 1 : 0.7;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.ell(cx + sx * 44 * s, cy + sy * 26 * s, 24 * s, 10 * s, null, 6);
  p.ell(cx, cy, 26 * s, 17 * s, INK, 0);
};
/** a calendar page: red top band, rings, a grid of dots, no numbers (256 x 320); v = variant */
export const fxPage = (p: Pen, v: number) => {
  p.poly(rrect(20, 30, 236, 300, 14), "#fbfaf4", 9);
  p.poly(rrect(20, 30, 236, 100, 14), ["#e8483c", "#3a64b8", "#4f9a6e"][v % 3], 9);
  for (const x of [80, 176]) p.dot(x, 30, 12, INK);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) p.dot(52 + c * 38, 140 + r * 40, 8, r === 1 && c === (v + 2) % 5 ? "#e8483c" : "#9aa3b8");
};
/** a cobweb in a corner (256 x 256) */
export const fxWeb = (p: Pen) => {
  const O: P2 = [20, 20];
  for (let i = 0; i < 6; i++) { const a = rad(i * 18); p.stroke([O, [20 + 230 * Math.cos(a), 20 + 230 * Math.sin(a)]], 4, "#f4f4f8"); }
  for (let r = 50; r < 240; r += 45) { const pts: P2[] = []; for (let i = 0; i <= 10; i++) { const a = rad(i * 9), rr = r * (1 - 0.08 * Math.sin(i * 1.7)); pts.push([20 + rr * Math.cos(a), 20 + rr * Math.sin(a)]); } p.stroke(pts, 4, "#f4f4f8"); }
};
/** floating sleep Zs as little zigzags (no letters... drawn as three zigzag marks) (256 x 256) */
export const fxZzz = (p: Pen, u: number) => {
  for (let i = 0; i < 3; i++) {
    const k = (u + i / 3) % 1, s = 18 + 26 * k, x = 70 + 70 * k + 20 * i, y = 210 - 150 * k;
    p.g.globalAlpha = Math.min(1, (1 - k) * 2);
    const z: P2[] = [[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]];
    p.stroke(z, 16, INK); p.stroke(z, 8, "#cfe0ff");
  }
  p.g.globalAlpha = 1;
};
/** a battery icon filling up (256 x 256), k = charge 0..1 */
export const fxBattery = (p: Pen, k: number) => {
  p.poly(rrect(40, 76, 200, 180, 16), "#fbfaf4", 10);
  p.poly(rrect(200, 106, 222, 150, 6), INK, 0);
  const w = Math.max(8, 144 * k);
  p.poly(rrect(52, 88, 52 + w, 168, 8), k < 0.25 ? "#e8483c" : "#5adf6a", 0);
};
/** a sandwich (256 x 192) */
export const fxSandwich = (p: Pen) => {
  p.poly([[30, 120], [226, 120], [210, 160], [46, 160]], "#e9c27a", 8);
  p.poly([[26, 100], [230, 100], [234, 124], [22, 124]], "#6abf4a", 6);
  p.poly([[34, 84], [222, 84], [226, 104], [30, 104]], "#e8604c", 6);
  p.poly([[40, 40], [216, 40], [232, 84], [24, 84]], "#f2d08a", 8);
};
/** two audience heads + shoulders from behind, dark silhouettes (256 x 256) */
export const fxHeads = (p: Pen, v: number) => {
  const col = ["#141224", "#1a1730", "#16142a"][v % 3];
  for (const [x, s] of [[80, 1], [180, 0.92]] as const) {
    p.ell(x, 250, 70 * s, 70 * s, col, 0);
    p.ell(x, 150 - 10 * v, 42 * s, 48 * s, col, 0);
  }
};
/** soft spotlight glow (256 x 256): see-through warm ellipse */
export const fxGlow = (p: Pen) => {
  const g = p.g.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(255,244,200,0.55)"); g.addColorStop(0.6, "rgba(255,240,190,0.28)"); g.addColorStop(1, "rgba(255,240,190,0)");
  p.g.fillStyle = g; p.g.fillRect(0, 0, 256, 256);
};
/** Wi-Fi gone: grey arcs crossed out (256 x 256) */
export const fxNoWifi = (p: Pen) => {
  for (const r of [40, 80, 120]) { p.arc(128, 200, r, r, 225, 315, 14, INK); p.arc(128, 200, r, r, 227, 313, 7, "#9aa3b8"); }
  p.stroke([[60, 70], [196, 200]], 22, INK); p.stroke([[60, 70], [196, 200]], 11, "#e8483c");
};
