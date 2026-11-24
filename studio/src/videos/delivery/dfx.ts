// Effect cards for the delivery-drone short (no text anywhere; plum ink, two-tone fills): the order app on a phone,
// the shampoo bottle, a two-blade propeller, a light bulb on/off, the gift card with a ribbon, a clipboard, a magnifier,
// a question mark, a check pip, a little heart.
import { Pen, INK, P2, rrect } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
/** a big phone showing the order app (320 x 560): drone pictogram flying to a house, a countdown ring filling (k 0..1) */
export const fxApp = (p: Pen, k: number, drone: boolean) => {
  p.poly(rrect(20, 20, 300, 540, 42), "#2b2f3a", 10);
  p.poly(rrect(42, 70, 278, 490, 18), "#eaf4ff", 0);
  p.dot(160, 46, 8, "#5a6070");
  // a little house at the bottom, a dashed route up to the drone
  p.poly([[110, 440], [110, 390], [160, 350], [210, 390], [210, 440]], "#f6c96a", 7);
  p.poly([[148, 440], [148, 408], [172, 408], [172, 440]], "#8a3a3a", 5);
  for (let i = 0; i < 5; i++) p.dot(160 + 30 * Math.sin(i * 0.8), 330 - i * 34, 6, "#7a8aa8");
  if (drone) {
    p.stroke([[110, 150], [210, 150]], 12, INK);
    for (const x of [100, 220]) p.ell(x, 140, 34, 10, "#c9d2de", 6);
    p.ell(160, 165, 42, 24, "#f4f1ea", 8); p.stroke([[130, 165], [190, 165]], 7, "#2f86d8");
    p.poly(rrect(140, 190, 180, 222, 4), "#c9965e", 6);
  }
  // countdown ring
  p.ell(160, 270, 46, 46, "#ffffff", 8);
  const pts: P2[] = [[160, 270]];
  for (let i = 0; i <= 40; i++) { const a = rad(-90 + 360 * k * (i / 40)); pts.push([160 + 40 * Math.cos(a), 270 + 40 * Math.sin(a)]); }
  if (k > 0.01) p.poly(pts, "#5ac46a", 0);
  p.stroke([[160, 270], [160, 238]], 6, INK); p.stroke([[160, 270], [184, 270]], 6, INK);
};
/** the shampoo bottle (200 x 320): rounded pastel bottle, pump cap, a drop symbol label */
export const fxBottle = (p: Pen) => {
  p.poly(rrect(84, 30, 116, 74, 6), "#f4f1ea", 7);
  p.poly([[100, 30], [100, 14], [150, 14], [150, 26], [116, 26], [116, 30]], "#f4f1ea", 6);
  p.poly(rrect(56, 70, 144, 112, 16), "#ffffff", 7);
  p.poly(rrect(40, 100, 160, 300, 46), "#7fc8d8", 9);
  p.poly(rrect(62, 160, 138, 250, 16), "#ffffff", 6);
  p.poly([[100, 178], [118, 210], [114, 226], [100, 234], [86, 226], [82, 210]], "#3f9ad8", 5);
  p.poly(rrect(56, 116, 76, 280, 10), "rgba(255,255,255,0.55)", 0);
};
/** a two-blade propeller seen flat (256 x 256), a = spin angle */
export const fxProp = (p: Pen, a: number) => {
  for (const s of [0, Math.PI]) {
    const c = Math.cos(a + s), d = Math.sin(a + s);
    const tip: P2 = [128 + 108 * c, 128 + 108 * d], l: P2 = [128 + 40 * c - 22 * d, 128 + 40 * d + 22 * c], r: P2 = [128 + 60 * c + 10 * d, 128 + 60 * d - 10 * c];
    p.poly([[128, 128], l, tip, r], "#2b2f3a", 7);
  }
  p.ell(128, 128, 18, 18, "#8a8f9a", 6);
};
/** a light bulb (256 x 320): on = yellow with rays, off = grey with a dark filament */
export const fxBulb = (p: Pen, on: boolean) => {
  if (on) for (let i = 0; i < 8; i++) { const a = rad(-90 + (i - 3.5) * 30); p.stroke([[128 + 104 * Math.cos(a), 130 + 104 * Math.sin(a)], [128 + 124 * Math.cos(a), 130 + 124 * Math.sin(a)]], 10, INK); }
  p.ell(128, 130, 76, 80, on ? "#ffe25a" : "#9aa0ae", 10);
  p.poly(rrect(92, 196, 164, 262, 10), "#b9bcc6", 8);
  p.stroke([[94, 220], [162, 220]], 6, INK); p.stroke([[94, 240], [162, 240]], 6, INK);
  p.poly(rrect(110, 262, 146, 286, 8), "#3a3f4c", 6);
  p.arc(128, 150, 22, 14, 180, 360, 7, on ? "#c87a1a" : INK); p.stroke([[106, 150], [106, 196]], 6, INK); p.stroke([[150, 150], [150, 196]], 6, INK);
};
/** the gift card (420 x 280): a coloured card with a ribbon cross, a bow and a big star sticker */
export const fxGift = (p: Pen) => {
  p.poly(rrect(20, 50, 400, 250, 22), "#5a8fe8", 10);
  p.poly([[20, 96], [400, 96], [400, 124], [20, 124]], "#ffd84a", 0);
  p.poly(rrect(20, 50, 400, 250, 22), null, 10);
  p.poly(rrect(52, 150, 120, 200, 8), "#f2c43a", 6); p.stroke([[52, 175], [120, 175]], 4, INK); p.stroke([[86, 150], [86, 200]], 4, INK);
  const st: P2[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 50, a = rad(-90 + i * 36); st.push([320 + r * Math.cos(a), 180 + r * Math.sin(a)]); }
  p.poly(st, "#ffffff", 7);
  p.ell(372, 74, 14, 10, "#ffd84a", 5, 0, 360, -25); p.ell(392, 74, 14, 10, "#ffd84a", 5, 0, 360, 25);
};
/** a clipboard (220 x 300) with tick lines */
export const fxClip = (p: Pen) => {
  p.poly(rrect(20, 30, 200, 290, 14), "#c98a4a", 9);
  p.poly(rrect(38, 56, 182, 276, 6), "#fbfaf4", 5);
  p.poly(rrect(80, 16, 140, 46, 8), "#8a8f9a", 7);
  for (let i = 0; i < 4; i++) { const y = 92 + i * 46; p.stroke([[54, y], [66, y + 12], [84, y - 10]], 6, "#3aa04a"); p.stroke([[98, y], [166, y]], 7, "#9aa3b8"); }
};
/** a magnifying glass (300 x 300), handle toward the lower right */
export const fxLens = (p: Pen) => {
  p.stroke([[188, 188], [276, 276]], 30, INK); p.stroke([[190, 190], [272, 272]], 18, "#8a5a3a");
  p.ell(120, 120, 92, 92, "#d8eef8", 14);
  p.arc(120, 120, 64, 64, 200, 260, 10, "#ffffff");
};
/** a question mark (200 x 300) */
export const fxQ = (p: Pen) => {
  p.arc(100, 100, 58, 58, 180, 400, 34, INK); p.arc(100, 100, 58, 58, 182, 398, 18, "#ffd84a");
  p.stroke([[118, 152], [100, 176], [100, 200]], 34, INK); p.stroke([[118, 152], [100, 176], [100, 200]], 18, "#ffd84a");
  p.ell(100, 256, 22, 22, "#ffd84a", 8);
};
/** a round green check pip (256 x 256) */
export const fxCheck = (p: Pen) => {
  p.ell(128, 128, 96, 96, "#5ac46a", 10);
  p.stroke([[80, 132], [114, 166], [178, 94]], 22, "#ffffff");
};
/** a zig-zag electric spark (300 x 300), seed varies the shape */
export const fxZap = (p: Pen, s: number) => {
  for (let k = 0; k < 4; k++) {
    const a = rad(s * 37 + k * 90), pts: P2[] = [[150, 150]];
    for (let i = 1; i <= 4; i++) { const r = i * 30, j = (i % 2 ? 1 : -1) * 0.35; pts.push([150 + r * Math.cos(a + j), 150 + r * Math.sin(a + j)]); }
    p.stroke(pts, 16, INK); p.stroke(pts, 8, "#fff27a");
  }
};
