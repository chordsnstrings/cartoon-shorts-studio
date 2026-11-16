// Effect cards for the AI-music-awards short (no text anywhere): a jagged blaring speech bubble full of scribble,
// a tiny squashed host bubble, a gold trophy, a handheld mic, a sweat drop, confetti, a play icon, a cobweb strand,
// camera-flash burst. Drawn with the same Pen (plum ink).
import { Pen, INK, P2 } from "./toon";

/** big jagged speech bubble (512 x 384) with scribble lines instead of words; tail toward bottom-left */
export const fxBlare = (p: Pen, k: number) => {
  const pts: P2[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = i % 2 ? 0.78 : 1;
    pts.push([256 + 220 * r * Math.cos(a) * (0.96 + 0.04 * Math.sin(i * 3 + k)), 170 + 140 * r * Math.sin(a)]);
  }
  p.poly([[150, 270], [96, 372], [210, 285]], "#ffffff", 9);
  p.poly(pts, "#ffffff", 10);
  for (let j = 0; j < 3; j++) {
    const s: P2[] = [];
    for (let i = 0; i <= 18; i++) s.push([130 + i * 14, 120 + j * 50 + 12 * Math.sin(i * 1.7 + k * 2 + j)]);
    p.stroke(s, 10, j === 1 ? "#e8483c" : INK);
  }
};
/** small host bubble (256 x 192) with three dots, squashed by k (0..1) */
export const fxDots = (p: Pen, k: number) => {
  const sx = 1 - 0.45 * k;
  p.ell(128, 90, 100 * sx, 66 * (1 - 0.2 * k), "#ffffff", 8);
  p.poly([[90, 140], [70, 186], [118, 148]], "#ffffff", 7);
  for (let i = -1; i <= 1; i++) p.dot(128 + i * 30 * sx, 92, 11, INK);
};
/** gold trophy cup with a star (256 x 320) */
export const fxTrophy = (p: Pen) => {
  p.poly([[78, 286], [178, 286], [186, 312], [70, 312]], "#5a3a2e", 8);
  p.poly([[110, 210], [146, 210], [156, 286], [100, 286]], "#e0b040", 8);
  p.arc(56, 90, 40, 46, 90, 270, 14, INK); p.arc(56, 90, 40, 46, 90, 270, 7, "#f2c43a");
  p.arc(200, 90, 40, 46, -90, 90, 14, INK); p.arc(200, 90, 40, 46, -90, 90, 7, "#f2c43a");
  p.poly([[50, 30], [206, 30], [196, 120], [160, 196], [96, 196], [60, 120]], "#f2c43a", 9);
  p.poly([[80, 44], [100, 44], [92, 140], [78, 120]], "#fff2b0", 0);
  const st: P2[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 13 : 30; st.push([128 + r * Math.cos(a), 104 + r * Math.sin(a)]); }
  p.poly(st, "#fff6c8", 5);
};
/** handheld mic (128 x 256): grille ball on a black handle */
export const fxMic = (p: Pen) => {
  p.poly([[50, 100], [78, 100], [72, 240], [56, 240]], "#2a2a34", 7);
  p.ell(64, 62, 42, 46, "#b9bfcc", 8);
  for (let i = -2; i <= 2; i++) p.stroke([[38, 62 + i * 14], [90, 62 + i * 14]], 3, "#7a8090");
};
/** sweat drop (128 x 160) */
export const fxSweat = (p: Pen) => p.poly([[64, 10], [100, 90], [96, 120], [64, 146], [32, 120], [28, 90]], "#9ad8ff", 7);
const CONF = ["#f2c43a", "#e8483c", "#7ff6ff", "#ff6ad5", "#6abf4a", "#ffffff"];
export const fxConf = (p: Pen, k: number) => p.poly([[4, 4], [60, 4], [60, 28], [4, 28]], CONF[k % CONF.length], 3);
/** big round "play" icon (256 x 256): the backing track */
export const fxPlay = (p: Pen) => {
  p.ell(128, 128, 104, 104, "#7ff6ff", 10);
  p.poly([[100, 76], [186, 128], [100, 180]], "#ffffff", 8);
};
/** a camera flash star (256 x 256) */
export const fxFlash = (p: Pen, k: number) => {
  const s = 120 * k, w = 18 * k;
  p.poly([[128, 128 - s], [128 + w, 128 - w], [128 + s, 128], [128 + w, 128 + w], [128, 128 + s], [128 - w, 128 + w], [128 - s, 128], [128 - w, 128 - w]], "#ffffff", Math.max(1, 6 * k));
};
/** press camera held up (192 x 160) */
export const fxCamera = (p: Pen) => {
  p.poly([[16, 50], [176, 50], [176, 150], [16, 150]], "#2a2a34", 8);
  p.poly([[50, 24], [110, 24], [120, 50], [40, 50]], "#2a2a34", 7);
  p.ell(96, 100, 38, 38, "#4a5a7a", 8); p.ell(96, 100, 18, 18, "#9ad8ff", 0);
  p.poly([[140, 30], [170, 30], [170, 48], [140, 48]], "#e9edf6", 5);
};
