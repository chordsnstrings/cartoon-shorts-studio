// Our own characters that are not people: the little poet satellite (gold-foil body, blue solar wings, a screen face,
// four chip lights), the test chip (a black square with pin legs and a face), and the effect cards of this short
// (the poem scroll, message rings, sleep bubble, glitch zigzags, battery, sparkles, sunglasses glint, laser glow).
// Drawn with the same Pen (plum ink, two-tone fills) in the 600 x 1000 design canvas, soles at y = 975.
import { Pen, INK, mul, mix, ellPts, rrect, P2, thickAngle } from "./toon";
import type { SatFace } from "./story";

const rad = (d: number) => (d * Math.PI) / 180;
const SH: [number, number, number] = [0.72, 0.74, 0.84];
const FOIL = "#e6b440", FOIL2 = "#f6d77a", PANEL = "#2f56b8", GRID = "#7d9cf0", FRAME = "#d7dbe3";
const SCREEN = "#1a2130", GLOW = "#8ff7ff", CHIP_ON = "#9dff8a", CHIP_OFF = "#3a4150";

export type SatPose = {
  face: SatFace; wings: number; chips: number; beret?: boolean; shades?: boolean; scroll?: number;
  blink?: number; light?: number; tilt?: number;
};

/** the satellite, centred at design (300, 640); ~1.3 m wide with the wings open */
export const drawSat = (p: Pen, P: SatPose) => {
  const light = P.light ?? rad(-120), thick = thickAngle(light);
  const tilt = rad(P.tilt ?? 0);
  p.rot = tilt ? [tilt, 300, 640] : null;
  // ---- the poem scroll comes out of the slot under the chips (behind the body)
  const sc = P.scroll ?? 0;
  if (sc > 0.01) {
    const y1 = 760 + 190 * sc;
    const pp = rrect(254, 740, 346, y1, 10);
    p.gradFill(pp, "#fbf3dc", "#e9dcb8", light); p.inkRing(pp, 6, thick, 0.3);
    p.poly(ellPts(300, y1, 50, 12), "#efe2bf", 6);
    // three lines of verse (squiggles, not words)
    for (let i = 0; i < 3; i++) {
      const y = 780 + i * 46;
      if (y > y1 - 18) break;
      const w = i === 1 ? 64 : 50, pts: P2[] = [];
      for (let k = 0; k <= 12; k++) pts.push([300 - w / 2 + (w * k) / 12, y + 4 * Math.sin(k * 1.9 + i)]);
      p.stroke(pts, 5, "#6a5a7a");
    }
  }
  // ---- wings: struts + panels (fold flat against the body when w = 0)
  const w = P.wings;
  for (const s of [-1, 1]) {
    const inner = 300 + s * 84, pw = 26 + 150 * w, outer = inner + s * (14 + pw);
    p.band([[inner, 640], [inner + s * 14, 640]], FRAME, 10, 3);
    const x0 = Math.min(inner + s * 14, outer), x1 = Math.max(inner + s * 14, outer), ph = 90 + 80 * w;
    const pts = rrect(x0, 640 - ph, x1, 640 + ph, 8);
    p.gradFill(pts, PANEL, mul(PANEL, [0.7, 0.72, 0.82]), light);
    p.clip(pts, () => {
      const g = p.g; g.globalAlpha = 0.9;
      for (let x = x0 + 22; x < x1 - 4; x += 30) p.stroke([[x, 640 - ph], [x, 640 + ph]], 3, GRID);
      for (let y = 640 - ph + 26; y < 640 + ph; y += 30) p.stroke([[x0, y], [x1, y]], 3, GRID);
      g.globalAlpha = 0.35; p.poly([[x0, 640 - ph], [x0 + (x1 - x0) * 0.45, 640 - ph], [x0, 640 - ph * 0.1]], "#ffffff", 0); g.globalAlpha = 1;
    });
    p.inkRing(pts, 7, thick, 0.35);
  }
  // ---- antenna dish on top
  p.stroke([[300, 522], [300, 478]], 9, INK); p.stroke([[300, 522], [300, 478]], 4, FRAME);
  const dp = ellPts(300, 466, 52, 20, 0, 180);
  p.gradFill([...dp, [248, 466]], "#f2f2f4", "#c3c7d3", light); p.inkRing([...dp, [248, 466]], 6, thick, 0.3);
  p.stroke([[300, 466], [300, 432]], 4, INK); p.dot(300, 428, 8, "#f7d24a"); p.ell(300, 428, 8, 8, null, 4);
  // ---- beret (the poet), worn jauntily on the antenna dish
  if (P.beret) {
    const bt = ellPts(306, 452, 62, 30, 180, 360, -10);
    p.gradFill(bt, "#d02a40", "#8a1c2c", light); p.inkRing(bt, 7, thick, 0.3);
    p.band([[248, 458], [362, 446]], "#9a1f30", 9, 3);
    p.stroke([[318, 424], [326, 406]], 8, INK);
  }
  // ---- thrusters
  for (const s of [-1, 1]) p.poly([[300 + s * 40, 760], [300 + s * 58, 760], [300 + s * 64, 790], [300 + s * 34, 790]], "#8b8f9c", 6);
  // ---- gold-foil body with crinkles
  const bp = rrect(216, 520, 384, 764, 30);
  p.gradFill(bp, FOIL, mul(FOIL, SH), light);
  p.clip(bp, () => {
    const g = p.g; g.globalAlpha = 0.55;
    const cr: P2[][] = [[[220, 530], [262, 524], [248, 572], [218, 590]], [[330, 700], [384, 690], [384, 760], [346, 764]], [[260, 690], [300, 676], [290, 740]], [[350, 528], [384, 540], [372, 590]]];
    for (const c of cr) p.poly(c, FOIL2, 0);
    g.globalAlpha = 0.25; for (const c of [[[236, 610], [270, 600], [252, 660]], [[300, 530], [340, 524], [318, 560]]] as P2[][]) p.poly(c, "#a8741c", 0);
    g.globalAlpha = 1;
  });
  p.inkRing(bp, 9, thick);
  // ---- face screen
  const sp = rrect(238, 548, 362, 652, 26);
  p.poly(sp, SCREEN, 6);
  const face = P.face, blink = P.blink ?? 0, ex = 30, ey = 590;
  const arcUp = (x: number) => p.arc(x, ey + 6, 14, 11, 200, 340, 8, GLOW);
  const arcDn = (x: number) => p.arc(x, ey - 4, 14, 10, 20, 160, 8, GLOW);
  const dotE = (x: number, r = 10, dy = 0) => p.ell(x, ey + dy, r, blink > 0.2 ? 3 : r * 1.25, GLOW, 0);
  if (P.shades) {
    for (const s of [-1, 1]) p.poly(rrect(300 + s * ex - 24, ey - 15, 300 + s * ex + 24, ey + 15, 9), "#0b0b10", 4);
    p.stroke([[300 - 8, ey - 6], [300 + 8, ey - 6]], 5, "#0b0b10");
    p.g.globalAlpha = 0.8; p.stroke([[300 - ex - 14, ey - 6], [300 - ex - 2, ey - 10]], 4, "#ffffff"); p.g.globalAlpha = 1;
  } else if (face === "closed" || (blink > 0.6 && face !== "dazed")) { arcDn(300 - ex); arcDn(300 + ex); }
  else if (face === "happy" || face === "proud") { arcUp(300 - ex); arcUp(300 + ex); }
  else if (face === "star") {
    for (const s of [-1, 1]) {
      const pts: P2[] = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 18, a = rad(-90 + i * 36); pts.push([300 + s * ex + r * Math.cos(a), ey + r * Math.sin(a)]); }
      p.poly(pts, "#ffe66b", 0);
    }
  } else if (face === "dazed") {
    for (const s of [-1, 1]) { const pts: P2[] = []; for (let i = 0; i < 26; i++) { const a = i * 0.55, r = 2 + i * 0.55; pts.push([300 + s * ex + r * Math.cos(a * s), ey + r * Math.sin(a * s)]); } p.stroke(pts, 4, GLOW); }
  } else if (face === "sleepy") { for (const s of [-1, 1]) { p.stroke([[300 + s * ex - 14, ey + 2], [300 + s * ex + 14, ey + 2]], 7, GLOW); p.arc(300 + s * ex, ey + 2, 14, 8, 20, 160, 5, GLOW); } }
  else if (face === "curious") { dotE(300 - ex, 8); dotE(300 + ex, 12); p.stroke([[300 + ex - 14, ey - 24], [300 + ex + 12, ey - 30]], 5, GLOW); }
  else if (face === "worried") { dotE(300 - ex, 9, 2); dotE(300 + ex, 9, 2); for (const s of [-1, 1]) p.stroke([[300 + s * (ex - 14), ey - 20], [300 + s * (ex + 12), ey - 13]], 5, GLOW); }
  else if (face === "think") { dotE(300 - ex + 6, 9, -6); dotE(300 + ex + 6, 9, -6); }
  else dotE(300 - ex), dotE(300 + ex);
  // mouth
  if (face === "proud" || face === "star") p.arc(300, 618, 28, 18, 10, 170, 8, GLOW);
  else if (face === "worried") { const pts: P2[] = []; for (let k = 0; k <= 10; k++) pts.push([280 + 4 * k, 628 + 4 * Math.sin(k * 1.4)]); p.stroke(pts, 6, GLOW); }
  else if (face === "curious") p.ell(306, 626, 7, 8, null, 5);
  else if (face === "dazed") p.ell(300, 628, 10, 6, GLOW, 0);
  else if (face === "sleepy" || face === "closed") p.arc(300, 628, 10, 6, 20, 160, 5, GLOW);
  else if (face === "think") p.stroke([[292, 628], [312, 624]], 6, GLOW);
  else p.arc(300, 616, 22, 14, 15, 165, 7, GLOW);
  // ---- chip lights (the four AI chips)
  p.poly(rrect(244, 668, 356, 712, 10), "#2b303c", 6);
  for (let i = 0; i < 4; i++) {
    const on = i < P.chips, cx = 258 + i * 28;
    if (on) { p.g.globalAlpha = 0.45; p.ell(cx, 690, 16, 16, CHIP_ON, 0); p.g.globalAlpha = 1; }
    p.poly(rrect(cx - 9, 681, cx + 9, 699, 3), on ? CHIP_ON : CHIP_OFF, 0);
  }
  p.rot = null;
};

/** the test chip: a black square with silver pin legs, stubby arms and a face (feet at y = 975) */
export type ChipFace = "calm" | "brace" | "glitch" | "proud";
export const drawChip = (p: Pen, face: ChipFace, jit: number, light = rad(-120)) => {
  const thick = thickAngle(light), cx = 300 + jit * 10, cy = 760;
  // legs
  for (const s of [-1, 1]) { p.stroke([[cx + s * 50, 880], [cx + s * 54, 962]], 22, INK); p.stroke([[cx + s * 50, 880], [cx + s * 54, 958]], 12, "#9aa0ad"); p.ell(cx + s * 60, 962, 24, 11, "#3a3f4c", 5); }
  // pins on the sides
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const y = 682 + i * 38; p.poly(rrect(cx + s * 120 - (s > 0 ? 0 : 22), y, cx + s * 120 + (s > 0 ? 22 : 0), y + 14, 3), "#c8ccd6", 4);
  }
  // arms
  const up = face === "proud" ? -1 : face === "brace" ? 0.3 : 0;
  for (const s of [-1, 1]) p.stroke([[cx + s * 140, 780], [cx + s * 175, 780 + 60 + up * 140]], 10, INK);
  for (const s of [-1, 1]) p.dot(cx + s * 175, 780 + 60 + up * 140, 13, INK);
  const bp = rrect(cx - 120, 660, cx + 120, 890, 22);
  p.gradFill(bp, "#353a48", "#1e212b", light); p.inkRing(bp, 9, thick);
  p.poly(rrect(cx - 92, 686, cx + 92, 864, 14), "#4a5163", 0);
  p.g.globalAlpha = 0.25; p.poly([[cx - 92, 686], [cx - 10, 686], [cx - 92, 790]], "#ffffff", 0); p.g.globalAlpha = 1;
  // face
  const ey = 752;
  if (face === "glitch") {
    for (const s of [-1, 1]) { p.stroke([[cx + s * 40 - 12, ey - 12], [cx + s * 40 + 12, ey + 12]], 9, "#ffffff"); p.stroke([[cx + s * 40 + 12, ey - 12], [cx + s * 40 - 12, ey + 12]], 9, "#ffffff"); }
    const pts: P2[] = []; for (let k = 0; k <= 8; k++) pts.push([cx - 32 + 8 * k, 816 + (k % 2 ? -8 : 8)]); p.stroke(pts, 6, "#ffffff");
  } else if (face === "brace") {
    for (const s of [-1, 1]) p.stroke([[cx + s * 40 - 14, ey], [cx + s * 40 + 14, ey]], 8, "#ffffff");
    p.poly(rrect(cx - 30, 806, cx + 30, 826, 6), "#ffffff", 4);
  } else if (face === "proud") {
    for (const s of [-1, 1]) p.arc(cx + s * 40, ey + 6, 14, 11, 200, 340, 8, "#ffffff");
    p.arc(cx, 800, 30, 20, 15, 165, 8, "#ffffff");
  } else {
    for (const s of [-1, 1]) p.ell(cx + s * 40, ey, 11, 14, "#ffffff", 0);
    p.arc(cx, 802, 20, 12, 20, 160, 7, "#ffffff");
  }
};

// ---------------- effect cards ----------------
/** message pulse: concentric arcs travelling outward (512 x 512), t 0..1 */
export const fxPulse = (p: Pen, t: number, col = "#9ff3ff") => {
  for (let k = 0; k < 3; k++) {
    const u = (t + k / 3) % 1;
    p.g.globalAlpha = Math.sin(u * Math.PI);
    p.arc(256, 256, 40 + 200 * u, 40 + 200 * u, 0, 360, 16 * (1 - u) + 5, col);
  }
  p.g.globalAlpha = 1;
};
/** sleep bubble: crescent moon in a bubble (256 x 256) */
export const fxSleep = (p: Pen, k: number) => {
  p.ell(128, 128, 70 + 6 * Math.sin(k), 70 + 6 * Math.sin(k), "#eef4ff", 8);
  p.ell(122, 128, 34, 34, "#ffd84a", 0); p.ell(138, 118, 30, 30, "#eef4ff", 0);
  p.ell(60, 210, 16, 16, "#eef4ff", 6); p.ell(36, 240, 9, 9, "#eef4ff", 5);
};
/** glitch zigzag sparks (256 x 256) */
export const fxZap = (p: Pen, s: number) => {
  for (let i = 0; i < 4; i++) {
    const a = s + i * 1.6, x = 128 + 70 * Math.cos(a), y = 128 + 70 * Math.sin(a), pts: P2[] = [];
    for (let k = 0; k < 5; k++) pts.push([x + Math.cos(a) * k * 12 + (k % 2 ? 12 : -12) * Math.sin(a), y + Math.sin(a) * k * 12 - (k % 2 ? 12 : -12) * Math.cos(a)]);
    p.line(pts, "#fff27a", 8);
  }
};
/** battery: level 0..1 (256 x 160), green -> red */
export const fxBattery = (p: Pen, lv: number) => {
  p.poly(rrect(20, 30, 216, 130, 18), "#f4f4f6", 10);
  p.poly(rrect(216, 60, 236, 100, 6), "#f4f4f6", 8);
  const col = lv > 0.5 ? "#5fd35a" : lv > 0.2 ? "#f2c43a" : "#e8483c";
  if (lv > 0.02) p.poly(rrect(36, 46, 36 + 164 * lv, 114, 10), col, 0);
};
/** lightning bolt (charging), 256 x 256 */
export const fxBolt = (p: Pen) => p.poly([[150, 20], [70, 140], [126, 140], [96, 236], [190, 104], [130, 104], [170, 20]], "#ffe14a", 10);
/** a four-point sparkle (128 x 128) */
export const fxSparkle = (p: Pen, k: number) => {
  const r = 60 * (0.6 + 0.4 * Math.sin(k)), pts: P2[] = [];
  for (let i = 0; i < 8; i++) { const a = rad(i * 45), rr = i % 2 ? r * 0.22 : r; pts.push([64 + rr * Math.cos(a), 64 + rr * Math.sin(a)]); }
  p.poly(pts, "#fffbe0", 0);
};
/** soft round glow (256 x 256) for the sun disc, flame core, station blink */
export const fxGlow = (p: Pen, col: string) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};
/** heart-ish speech blip between the twin satellites (256 x 256) */
export const fxBlip = (p: Pen, k: number) => {
  p.poly(rrect(30, 50, 226, 170, 40), "#ffffff", 9);
  p.poly([[90, 166], [70, 220], [130, 168]], "#ffffff", 0); p.stroke([[90, 170], [70, 220], [130, 170]], 9, INK);
  for (let i = 0; i < 3; i++) p.dot(88 + i * 40, 110, 13 * (0.7 + 0.3 * Math.sin(k + i)), INK);
};
export { mix };
