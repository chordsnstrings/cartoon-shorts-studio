// Effect cards for the outage short (no text, no logos anywhere): a hand-held phone with a screen icon, a cloud
// that leaves, a red error bubble, a hooded hacker pictogram, a red cross stamp, an open product box, wifi arcs,
// sweat drop, a power spark star. Drawn with the same Pen (plum ink).
import { Pen, INK, P2, rrect } from "./toon";

export type PhoneMode = "on" | "err" | "out" | "lock" | "x" | "new" | "spin";
/** a phone held up (256 x 448): dark body, screen with an icon */
export const fxPhone = (p: Pen, mode: PhoneMode, k = 0) => {
  p.poly(rrect(28, 16, 228, 432, 34), "#2b2f3a", 10);
  const scr = mode === "err" || mode === "x" ? "#ffe2e0" : mode === "lock" ? "#e9ecf3" : mode === "out" ? "#eaf2ff" : null;
  if (scr) p.poly(rrect(44, 34, 212, 414, 22), scr, 0);
  else {
    const g = p.g.createLinearGradient(44, 34, 212, 414); g.addColorStop(0, "#5ad0ff"); g.addColorStop(0.55, "#8a6aff"); g.addColorStop(1, "#ff7ac8");
    p.g.fillStyle = g; p.poly(rrect(44, 34, 212, 414, 22), null, 0); p.g.fill();
  }
  p.poly(rrect(100, 46, 156, 62, 8), INK, 0); // notch
  if (mode === "on" || mode === "new") {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.poly(rrect(66 + c * 46, 96 + r * 56, 98 + c * 46, 128 + r * 56, 9), "rgba(255,255,255,0.85)", 0);
  } else if (mode === "err" || mode === "x") {
    p.ell(128, 224, 62, 62, "#e8483c", 9);
    if (mode === "err") { p.poly(rrect(118, 178, 138, 240, 9), "#ffffff", 0); p.ell(128, 262, 11, 11, "#ffffff", 0); }
    else { p.stroke([[100, 196], [156, 252]], 18, "#ffffff"); p.stroke([[156, 196], [100, 252]], 18, "#ffffff"); }
  } else if (mode === "lock") {
    p.arc(128, 200, 36, 40, 180, 360, 16, INK);
    p.poly(rrect(78, 200, 178, 282, 14), "#9aa3b8", 9);
    p.ell(128, 236, 11, 11, INK, 0); p.poly([[122, 240], [134, 240], [138, 264], [118, 264]], INK, 0);
  } else if (mode === "out") {
    // a person outline with a small red minus badge: signed out
    p.ell(128, 190, 34, 34, "#c9d3e6", 8); p.poly([[70, 300], [80, 252], [128, 236], [176, 252], [186, 300]], "#c9d3e6", 8);
    p.ell(176, 284, 26, 26, "#e8483c", 7); p.stroke([[162, 284], [190, 284]], 9, "#ffffff");
  } else if (mode === "spin") {
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, on = Math.floor(k * 8) % 8 === i; p.dot(128 + 50 * Math.cos(a), 224 + 50 * Math.sin(a), on ? 15 : 10, on ? "#ffffff" : "rgba(255,255,255,0.5)"); }
  }
};
/** a puffy cloud with a sad face (384 x 256) */
export const fxCloudSad = (p: Pen) => {
  p.poly(cloudPts(192, 140, 1), "#ffffff", 10);
  for (const x of [156, 228]) p.ell(x, 132, 9, 13, INK, 0);
  p.arc(192, 192, 26, 18, 200, 340, 8, INK);
};
const cloudPts = (cx: number, cy: number, s: number): P2[] => {
  const pts: P2[] = [];
  const bumps: [number, number, number][] = [[-110, 20, 48], [-62, -32, 60], [10, -56, 72], [80, -26, 58], [124, 22, 44]];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let r = 0;
    if (dy > 0.25) r = Math.min(150 / Math.max(0.3, Math.abs(dx)), 62 / dy);
    else for (const [bx, by, br] of bumps) { const t = bx * dx + by * dy, d2 = bx * bx + by * by - t * t; if (d2 < br * br) r = Math.max(r, t + Math.sqrt(br * br - d2)); }
    pts.push([cx + dx * r * s, cy + dy * r * s]);
  }
  return pts;
};
/** red error bubble with "!" made of a bar + dot (256 x 256) */
export const fxErr = (p: Pen) => {
  p.poly([[96, 196], [80, 248], [140, 204]], "#e8483c", 9);
  p.ell(128, 120, 96, 92, "#e8483c", 10);
  p.poly(rrect(114, 54, 142, 140, 12), "#ffffff", 0); p.ell(128, 172, 16, 16, "#ffffff", 0);
};
/** a hooded hacker pictogram in a white bubble (384 x 384): dark hood, no face, a little laptop */
export const fxHacker = (p: Pen) => {
  p.ell(192, 180, 160, 150, "#ffffff", 10);
  p.poly([[120, 270], [118, 170], [150, 104], [192, 88], [234, 104], [266, 170], [264, 270]], "#3a3550", 9);
  p.ell(192, 170, 46, 54, "#1a1726", 0);
  p.poly([[124, 250], [260, 250], [276, 290], [108, 290]], "#9aa3b8", 8);
  p.poly([[140, 200], [244, 200], [254, 252], [130, 252]], "#c9d0dc", 8);
};
/** big red cross stamp (384 x 384), k = scale-in 0..1 */
export const fxCross = (p: Pen, k = 1) => {
  const s = 0.6 + 0.4 * k, a = 150 * s;
  p.stroke([[192 - a, 192 - a], [192 + a, 192 + a]], 70 * s, INK); p.stroke([[192 + a, 192 - a], [192 - a, 192 + a]], 70 * s, INK);
  p.stroke([[192 - a, 192 - a], [192 + a, 192 + a]], 50 * s, "#e8483c"); p.stroke([[192 + a, 192 - a], [192 - a, 192 + a]], 50 * s, "#e8483c");
};
/** an open white product box, lid leaning behind (384 x 320) */
export const fxBoxOpen = (p: Pen) => {
  p.poly([[60, 40], [324, 40], [312, 150], [72, 150]], "#f6f6f8", 9); // lid behind
  p.poly([[40, 140], [344, 140], [344, 300], [40, 300]], "#ffffff", 10);
  p.poly([[60, 150], [324, 150], [324, 176], [60, 176]], "#d9dde6", 0);
};
/** wifi arcs (256 x 256): u animates the arcs lighting up from the dot; col = arc colour */
export const fxWifi = (p: Pen, u: number, col = "#3fd16a") => {
  for (let i = 0; i < 3; i++) {
    const r = 46 + i * 40, on = (u * 4) % 4 > i;
    p.arc(128, 210, r, r, 225, 315, 22, INK); p.arc(128, 210, r, r, 227, 313, 12, on ? col : "#c9d0dc");
  }
  p.dot(128, 210, 18, INK); p.dot(128, 210, 11, col);
};
/** a white-yellow power spark star (512 x 512), t = 0..1 */
export const fxSpark = (p: Pen, t: number) => {
  const k = t < 0.3 ? 0.6 + 1.3 * t : 1 - 0.6 * (t - 0.3);
  const star = (R: number, r: number, n: number, rot: number): P2[] => Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R * (0.8 + 0.2 * Math.sin(i * 5.1));
    return [256 + rr * Math.cos(a), 256 + rr * Math.sin(a)] as P2;
  });
  p.poly(star(220 * k, 90 * k, 7, 0.4), "#7ff6ff", 12);
  p.poly(star(130 * k, 55 * k, 7, 0.7), "#ffffff", 0);
};
export const fxSweat = (p: Pen) => p.poly([[64, 10], [100, 90], [96, 120], [64, 146], [32, 120], [28, 90]], "#9ad8ff", 7);
/** cream cartoon poof (256 x 256) */
export const fxPoof = (p: Pen, t: number) => {
  const k = 0.5 + 0.6 * t;
  for (const [x, y, r] of [[128, 140, 60], [80, 120, 44], [176, 118, 46], [110, 84, 40], [158, 80, 38]] as const) p.ell(128 + (x - 128) * k, 128 + (y - 128) * k, r * k, r * k, "#fff3dc", 8);
};
