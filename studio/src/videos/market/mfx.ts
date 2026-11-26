// Effect cards for the AI-Christmas-market short (no text anywhere; plum ink, two-tone fills): a water drop, a thought
// bubble that fills with little huts (50 stalls) or little people (2,500 visitors), a counting star, glitch pixels,
// an AI chip, shrug ticks.
import { Pen, INK, P2, rrect } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
/** a fat cartoon water drop (128 x 192) */
export const fxDrop = (p: Pen) => {
  const pts: P2[] = [[64, 12]];
  for (let i = 0; i <= 30; i++) { const a = rad(-28 + (i / 30) * 236); pts.push([64 + 46 * Math.cos(a), 130 + 46 * Math.sin(a)]); }
  p.poly(pts, "#9fd8ff", 7);
  p.ell(50, 126, 9, 15, "#e8f7ff", 0, 0, 360, -20);
};
/** thought bubble (640 x 520): cloud + trailing dots toward the lower left. kind 0 = huts grid (n of 50), 1 = crowd (k 0..1) */
export const fxBubble = (p: Pen, kind: number, k: number) => {
  const lobes: [number, number, number][] = [[200, 180, 120], [330, 130, 130], [460, 175, 120], [520, 290, 105], [420, 380, 120], [270, 385, 120], [140, 300, 110]];
  for (const [x, y, r] of lobes) p.ell(x, y, r, r * 0.86, "#ffffff", 9);
  for (const [x, y, r] of lobes) p.ell(x, y, r - 8, r * 0.86 - 8, "#ffffff", 0);
  p.ell(330, 270, 230, 160, "#ffffff", 0);
  p.ell(90, 450, 30, 26, "#ffffff", 8); p.ell(40, 500, 16, 14, "#ffffff", 7);
  if (kind === 0) {
    const n = Math.round(50 * k);
    for (let i = 0; i < n; i++) {
      const c = i % 10, r = Math.floor(i / 10), x = 150 + c * 38, y = 165 + r * 52;
      p.poly([[x - 15, y + 18], [x - 15, y], [x, y - 13], [x + 15, y], [x + 15, y + 18]], ["#c9773f", "#d8453a", "#2f8f4a", "#e8a33a"][i % 4], 4);
      p.poly([[x - 7, y + 18], [x - 7, y + 6], [x + 7, y + 6], [x + 7, y + 18]], "#ffe39a", 0);
    }
  } else {
    const n = Math.round(90 * k), cols = ["#e8743a", "#3a7ad8", "#5aa36a", "#c25a9a", "#f2c22a", "#7b5ac9"];
    for (let i = 0; i < n; i++) {
      const c = i % 15, r = Math.floor(i / 15), x = 130 + c * 27 + (r % 2) * 12, y = 170 + r * 40;
      p.ell(x, y + 14, 11, 12, cols[(i * 7) % 6], 3);
      p.ell(x, y - 4, 9, 9, "#f5c9a0", 3);
    }
  }
};
/** a bouncy yellow counting star with a white rim (256 x 256) */
export const fxCount = (p: Pen) => {
  const pts: P2[] = [];
  for (let k = 0; k < 10; k++) { const r = k % 2 ? 46 : 110, b = rad(k * 36 - 90); pts.push([128 + r * Math.cos(b), 136 + r * Math.sin(b)]); }
  p.poly(pts, "#ffd84a", 10);
  p.ell(128, 140, 22, 22, "#fff3b0", 0);
};
/** glitch pixel block (128 x 128): a coloured square with an RGB split edge */
export const fxPixel = (p: Pen, v: number) => {
  const cols = ["#ff3d8a", "#3de0ff", "#7dff6a", "#ffffff", "#ffd84a", "#7a3dff"];
  p.g.fillStyle = cols[(v + 3) % 6]; p.g.fillRect(14, 8, 104, 104);
  p.g.fillStyle = cols[v % 6]; p.g.fillRect(4, 18, 104, 104);
};
/** an AI chip (300 x 300): rounded square with pins and a glowing circuit brain, sparkles */
export const fxChip = (p: Pen) => {
  for (let i = 0; i < 5; i++) {
    const o = 90 + i * 30;
    p.stroke([[o, 40], [o, 70]], 12); p.stroke([[o, 230], [o, 260]], 12);
    p.stroke([[40, o], [70, o]], 12); p.stroke([[230, o], [260, o]], 12);
  }
  p.poly(rrect(66, 66, 234, 234, 26), "#2b3550", 10);
  p.poly(rrect(96, 96, 204, 204, 14), "#3de0ff", 6);
  p.stroke([[120, 150], [150, 150], [150, 120]], 9, INK); p.stroke([[180, 150], [150, 150], [150, 180]], 9, INK);
  for (const [x, y] of [[120, 150], [150, 120], [180, 150], [150, 180]] as P2[]) p.dot(x, y, 11, "#ffffff");
  for (const [x, y] of [[120, 150], [150, 120], [180, 150], [150, 180]] as P2[]) p.dot(x, y, 6, INK);
};
/** shrug ticks (300 x 200): two little curved strokes over each shoulder */
export const fxShrug = (p: Pen, k: number) => {
  const j = 8 * k;
  p.arc(60, 140 - j, 40, 40, 200, 260, 10); p.arc(70, 130 - j, 70, 70, 205, 255, 10);
  p.arc(240, 140 - j, 40, 40, 280, 340, 10); p.arc(230, 130 - j, 70, 70, 285, 335, 10);
};
/** a water splat sitting on a head (256 x 128): flattened drop with little bumps */
export const fxSplat = (p: Pen) => {
  p.ell(128, 74, 110, 40, "#9fd8ff", 7);
  for (const [x, r] of [[40, 22], [90, 28], [160, 26], [212, 20]] as P2[]) p.ell(x, 50, r, r * 0.8, "#9fd8ff", 6);
  p.ell(128, 70, 100, 32, "#9fd8ff", 0);
  p.ell(96, 58, 26, 9, "#e8f7ff", 0);
};
