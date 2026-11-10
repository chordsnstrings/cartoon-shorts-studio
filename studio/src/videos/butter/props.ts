// Effect-card drawings for the butter short (all Canvas2D with the plum ink): knife, thermometer, snail, stopwatch,
// laptop with a frying egg, lightning bolt, butter splat. No letters or numerals anywhere.
import { Pen, P2, INK, rrect } from "./toon";
const rad = (d: number) => (d * Math.PI) / 180;

/** a butter knife pointing up-right, a little butter on the blade (256 x 256) */
export const fxKnife = (p: Pen) => {
  p.poly([[30, 196], [118, 178], [124, 214], [36, 232]], "#6a3f24", 9); // dark wooden handle
  p.dot(62, 205, 6, "#c9ced8"); p.dot(96, 198, 6, "#c9ced8"); // rivets
  p.poly([[118, 176], [214, 150], [246, 152], [248, 170], [124, 214]], "#cfd5df", 9); // broad silver blade, round tip
  p.stroke([[132, 186], [232, 160]], 6, "#f4f6fa");
};
/** thermometer (128 x 384): level 0..1, red (hot) or blue (cool) */
export const fxThermo = (p: Pen, level: number, hot: boolean) => {
  const col = hot ? "#e8483c" : "#3aa0e8";
  p.poly(rrect(44, 20, 84, 320, 20), "#fbfaf6", 9);
  const top = 300 - 270 * level;
  p.poly(rrect(54, top, 74, 318, 10), col, 0);
  p.ell(64, 330, 40, 40, col, 9);
  for (let i = 0; i < 6; i++) p.stroke([[84, 70 + i * 40], [98, 70 + i * 40]], 6, INK);
  if (hot) p.dot(52, 316, 8, "#ffb0a0"); else p.dot(52, 316, 8, "#c0e6ff");
};
/** lightning bolt (256 x 256), small and green (low power) */
export const fxBolt = (p: Pen) => {
  p.poly([[150, 20], [70, 140], [122, 140], [96, 236], [190, 104], [136, 104], [168, 20]], "#7be08a", 10);
};
/** a sleepy snail crawling right (384 x 256), u = crawl phase */
export const fxSnail = (p: Pen, u: number) => {
  const s = 1 + 0.06 * Math.sin(u * Math.PI * 2);
  const body: P2[] = [[40, 220], [300 * s, 220], [340 * s, 200], [350 * s, 160], [320 * s, 150], [300 * s, 190], [60, 200]];
  p.poly(body, "#e9c79a", 9);
  p.stroke([[318 * s, 160], [300 * s, 90]], 9, INK); p.stroke([[334 * s, 165], [346 * s, 92]], 9, INK);
  p.dot(300 * s, 88, 16, INK); p.dot(346 * s, 90, 16, INK); p.dot(300 * s, 88, 9, "#fbfaf6"); p.dot(346 * s, 90, 9, "#fbfaf6");
  p.stroke([[290 * s, 86], [310 * s, 86]], 7, INK); p.stroke([[336 * s, 88], [356 * s, 88]], 7, INK); // heavy lids: sleepy
  p.ell(170, 150, 100, 82, "#c96a3a", 10);
  const sp: P2[] = []; for (let i = 0; i <= 60; i++) { const a = rad(i * 12), r = 76 - i * 1.15; sp.push([170 + r * Math.cos(a), 150 + r * 0.82 * Math.sin(a)]); }
  p.stroke(sp, 8, "#7a3a20");
};
/** stopwatch (256 x 256), hand angle a */
export const fxStopwatch = (p: Pen, a: number) => {
  p.poly(rrect(112, 14, 144, 44, 6), "#c9ced8", 7);
  p.ell(128, 146, 96, 96, "#c9ced8", 10); p.ell(128, 146, 78, 78, "#fbfaf4", 6);
  for (let i = 0; i < 12; i++) { const b = (i * Math.PI) / 6; p.stroke([[128 + 62 * Math.cos(b), 146 + 62 * Math.sin(b)], [128 + 72 * Math.cos(b), 146 + 72 * Math.sin(b)]], 6, INK); }
  p.stroke([[128, 146], [128 + 60 * Math.cos(a - Math.PI / 2), 146 + 60 * Math.sin(a - Math.PI / 2)]], 8, "#e8483c");
  p.dot(128, 146, 9, INK);
};
/** open laptop seen from the front-top with an egg frying on the keyboard (512 x 384), t = time */
export const fxLaptopEgg = (p: Pen, t: number, egg: number) => {
  p.poly([[70, 30], [442, 30], [432, 200], [80, 200]], "#3a3f4c", 10); // lid back
  p.poly([[96, 52], [416, 52], [408, 182], [104, 182]], "#5ae0ff", 0);
  p.poly([[96, 52], [416, 52], [408, 182], [104, 182]], null, 6);
  p.poly([[40, 210], [472, 210], [500, 350], [12, 350]], "#c9ced8", 10); // base
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { const y = 228 + r * 26, x0 = 70 - r * 6 + k * 42; p.poly(rrect(x0, y, x0 + 32, y + 18, 4), "#9aa3b8", 3); }
  if (egg > 0) {
    const k = Math.min(1, egg * 1.4), wob = 1 + 0.03 * Math.sin(t * 20);
    const wp: P2[] = []; for (let i = 0; i < 28; i++) { const a = rad(i * 360 / 28), r = (70 + 12 * Math.sin(i * 2.3)) * k * wob; wp.push([256 + r * Math.cos(a), 290 + r * 0.45 * Math.sin(a)]); }
    p.poly(wp, "#fbfaf6", 7);
    p.ell(262, 282, 26 * k, 20 * k, "#ffb52a", 6);
    p.dot(254, 276, 6 * k, "#ffe6a0");
  }
};
/** butter splat drops (256 x 256), t 0..1 */
export const fxSplat = (p: Pen, t: number) => {
  for (let i = 0; i < 4; i++) {
    const a = rad(215 + i * 36), d = 30 + 100 * t, r = 12 * (1 - t) + 4;
    p.ell(128 + d * Math.cos(a), 170 + d * Math.sin(a) + 110 * t * t, r, r * 1.3, "#f8dc5a", 3);
  }
};
