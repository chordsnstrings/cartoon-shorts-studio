// Effect cards for the fire-dog short (no text anywhere; plum ink, two-tone fills): cartoon flames (world.ts draws them as
// HDR cards), a little rocket with a puff trail, the thin-coat gauge, thermometers, the scientists' tablet, a water jet from
// the hose, steam puffs, a question mark, a check pip, a flame alert pin.
import { Pen, INK, P2, rrect } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
const hsh = (i: number) => { const v = Math.sin(i * 127.1) * 43758.5453; return v - Math.floor(v); };

/** cartoon flame clump (256 x 384): 3 layered tongues (red, orange, yellow), animated by k (0..1 loop), seed varies the shape.
 *  Bottom-centre is the base. Drawn with a thin dark-red rim (no plum ink: fire is light). */
export const fxFlame = (p: Pen, k: number, seed: number) => {
  const layer = (sc: number, col: string, rim: string | null, ph: number) => {
    const n = 4 + (seed % 2), pts: P2[] = [];
    const base = 360, wid = 112 * sc;
    pts.push([128 - wid, base]);
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 0.5) / n;
      const x0 = 128 - wid + 2 * wid * u0, xt = 128 - wid + 2 * wid * u1;
      const ht = (150 + 170 * Math.sin(Math.PI * (u1 * 0.8 + 0.1)) * (0.75 + 0.25 * hsh(seed * 7 + i))) * sc;
      const sway = 22 * sc * Math.sin(2 * Math.PI * (k + ph + i * 0.27 + hsh(seed + i)));
      const bob = 26 * sc * Math.sin(2 * Math.PI * (2 * k + i * 0.41 + ph));
      if (i > 0) pts.push([x0, base - (60 + 40 * hsh(seed * 3 + i)) * sc]);
      pts.push([xt - 18 * sc + sway * 0.5, base - ht * 0.55]);
      pts.push([xt + sway, base - ht - bob]);
      pts.push([xt + 16 * sc + sway * 0.5, base - ht * 0.5]);
    }
    pts.push([128 + wid, base]);
    // round bottom
    for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; pts.push([128 + wid * Math.cos(a), base + 18 * sc * Math.sin(a)]); }
    p.poly(pts, col, rim ? 0 : 0);
    if (rim) { p.g.save(); p.g.lineJoin = "round"; p.g.strokeStyle = rim; p.g.lineWidth = 6; p.path(pts, true); p.g.stroke(); p.g.restore(); }
  };
  layer(1.0, "#e8462a", "#9a2418", 0);
  layer(0.74, "#ff9a2a", null, 0.33);
  layer(0.46, "#ffe066", null, 0.61);
  // a few sparks
  for (let i = 0; i < 3; i++) { const u = (k * 1.5 + i / 3 + hsh(seed + 9 * i)) % 1; p.dot(128 + 70 * Math.sin(seed + i * 2.3 + u * 3), 300 - 300 * u, 7 * (1 - u) + 2, "#ffd24a"); }
};

/** a little rocket going up (200 x 420): white body, red nose + fins, a round window, flame at the bottom (flick 0..1) */
export const fxRocket = (p: Pen, flick: number) => {
  const fl = 70 + 30 * Math.sin(flick * Math.PI * 2);
  p.poly([[100, 300], [76, 330], [100, 330 + fl], [124, 330]], "#ff9a2a", 5);
  p.poly([[100, 310], [88, 328], [100, 300 + fl * 0.7], [112, 328]], "#ffe066", 0);
  p.poly([[64, 250], [30, 320], [70, 305]], "#d9342b", 7); p.poly([[136, 250], [170, 320], [130, 305]], "#d9342b", 7);
  p.poly([[100, 30], [138, 110], [138, 300], [62, 300], [62, 110]], "#f4f1ea", 8);
  p.poly([[100, 30], [130, 92], [70, 92]], "#d9342b", 7);
  p.ell(100, 160, 22, 22, "#7fc8f0", 7);
  p.poly(rrect(62, 285, 138, 305, 4), "#9aa0ac", 6);
};
/** a round soft puff (256 x 256) for rocket trails and steam: cream, light grey shade (never dark) */
export const fxSteam = (p: Pen, u: number) => {
  const r = 50 + 60 * u, a = 1 - u * 0.85;
  p.g.save(); p.g.globalAlpha = a;
  p.ell(128, 140, r, r * 0.9, "#f4f2ee", 0); p.ell(128 - r * 0.5, 150, r * 0.6, r * 0.55, "#e6e6ec", 0); p.ell(128 + r * 0.45, 128, r * 0.55, r * 0.5, "#ffffff", 0);
  p.g.restore();
};
/** the thin coat (360 x 240): a cross-section of silver fabric layers, two arrowheads pinching its thickness */
export const fxThin = (p: Pen) => {
  p.poly(rrect(30, 100, 330, 140, 12), "#e2e5ea", 8);
  p.stroke([[40, 113], [320, 113]], 4, "#9aa0ac"); p.stroke([[40, 127], [320, 127]], 4, "#9aa0ac");
  for (const s of [-1, 1]) {
    const y0 = 120 + s * 26, y1 = 120 + s * 92;
    p.stroke([[180, y1], [180, y0]], 14, INK); p.stroke([[180, y1], [180, y0]], 7, "#ffd84a");
    p.poly([[180, y0], [160, y0 + s * 30], [200, y0 + s * 30]], "#ffd84a", 6);
  }
};
/** a thermometer (160 x 420): level 0..1, hot = red with a burst at the top, else green */
export const fxThermo = (p: Pen, level: number, hot: boolean) => {
  const col = hot ? "#e8462a" : "#4cc46a";
  p.poly(rrect(56, 30, 104, 330, 24), "#ffffff", 8);
  p.ell(80, 350, 46, 46, col, 8);
  const top = 320 - 280 * level;
  p.poly(rrect(66, top, 94, 340, 12), col, 0);
  p.ell(80, 350, 38, 38, col, 0);
  for (let i = 0; i < 6; i++) p.stroke([[104, 80 + i * 44], [122, 80 + i * 44]], 5, INK);
  if (hot) for (let i = 0; i < 7; i++) { const a = rad(-90 + (i - 3) * 26); p.stroke([[80 + 40 * Math.cos(a), 34 + 40 * Math.sin(a)], [80 + 70 * Math.cos(a), 34 + 70 * Math.sin(a)]], 10, "#ff9a2a"); }
  if (!hot) p.stroke([[60, 380], [74, 396], [102, 366]], 0, INK);
};
/** the scientists' tablet (300 x 220): dark frame, screen with a dog dot on a floor-plan grid and a flame spot */
export const fxTablet = (p: Pen, ping: number) => {
  p.poly(rrect(10, 10, 290, 210, 22), "#2b2f3a", 9);
  p.poly(rrect(28, 26, 272, 194, 10), "#dff1ff", 0);
  for (let i = 1; i < 4; i++) { p.stroke([[28 + i * 61, 26], [28 + i * 61, 194]], 3, "#9cc2e0"); p.stroke([[28, 26 + i * 42], [272, 26 + i * 42]], 3, "#9cc2e0"); }
  p.ell(110, 130, 16, 16, "#2f86d8", 5);
  p.poly([[205, 60], [222, 92], [216, 110], [205, 116], [194, 110], [188, 92]], "#e8462a", 5);
  if (ping > 0) p.arc(205, 92, 30 + 40 * ping, 30 + 40 * ping, 0, 360, 6 * (1 - ping) + 1, "#e8462a");
};
/** a flame alert pin (240 x 320): red map pin with a white flame inside, for "found the fire" */
export const fxPin = (p: Pen) => {
  p.poly([[120, 300], [50, 170], [44, 120], [70, 64], [120, 40], [170, 64], [196, 120], [190, 170]], "#e8462a", 9);
  p.poly([[120, 86], [146, 128], [140, 154], [120, 164], [100, 154], [94, 128]], "#ffffff", 6);
};
/** the hose jet (512 x 160): a fat blue-white stream with droplets, flowing to the right; k animates the droplets */
export const fxWater = (p: Pen, k: number) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) { const x = 10 + i * 24; pts.push([x, 80 - 14 - 10 * Math.sin(i * 0.7 + k * 12)]); }
  for (let i = 20; i >= 0; i--) { const x = 10 + i * 24; pts.push([x, 80 + 14 + 10 * Math.sin(i * 0.9 + k * 10) + i * 0.8]); }
  p.poly(pts, "#9fd6ff", 6);
  p.stroke([[20, 76], [480, 70]], 7, "#ffffff");
  for (let i = 0; i < 8; i++) { const u = (k * 2 + i / 8) % 1; p.ell(40 + 440 * u, 40 + 80 * hsh(i * 13), 9, 9, "#bfe6ff", 4); }
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
/** a five-point star sticker (256 x 256) */
export const fxStar = (p: Pen, col = "#ffd84a") => {
  const st: P2[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 46 : 110, a = rad(-90 + i * 36); st.push([128 + r * Math.cos(a), 132 + r * Math.sin(a)]); }
  p.poly(st, col, 9);
};
