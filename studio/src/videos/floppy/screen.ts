// The hero CRT's picture, drawn per state, no text anywhere: the green 1980s radar sweep with blips, the capacity page
// (a floppy icon whose tiny bar fills, then a selfie photo that overflows it), the social post with emoji pictograms
// (floppy crossed out + exploding-head face, then plane + take-off), the modern one-screen dashboard (weather, outage,
// alert tiles popping on), and the big save icon with a cursor clicking it.
import { Screen, W, clamp01, smooth } from "./story";

const q = (v: number, n = 20) => Math.round(v * n) / n;
export const screenKey = (s: Screen, t: number) => {
  if (s === "radar") return `R|${Math.floor(t * 15)}`;
  if (s === "cap") return `C|${q(smooth((t - (W.holds - 0.1)) / 0.4))}|${q(smooth((t - (W.mega - 0.1)) / 0.3))}`;
  if (s === "post") return `P|${q(smooth((t - (W.posted - 0.2)) / 0.4))}|${q(smooth((t - (W.out - 0.08)) / 0.25))}|${q(smooth((t - (W.twentyfirst - 0.08)) / 0.25))}|${q(smooth((t - (W.inn - 0.08)) / 0.25))}`;
  if (s === "eids") return `E|${[W.weather, W.outages, W.alerts, W.together].map((w) => q(smooth((t - (w - 0.1)) / 0.25))).join("|")}|${Math.floor(t * 4) % 2}`;
  if (s === "save") return `S|${q(smooth((t - 60.6) / 0.6))}|${q(smooth((t - (W.save - 0.35)) / 0.3))}|${t >= W.save - 0.06 && t < W.save + 0.3 ? 1 : 0}`;
  return s;
};
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const scan = (g: CanvasRenderingContext2D, W_: number, H: number, a = 0.12) => {
  g.fillStyle = `rgba(0,0,0,${a})`; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W_, 2);
  const v = g.createRadialGradient(W_ / 2, H / 2, H * 0.3, W_ / 2, H / 2, W_ * 0.62); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = v; g.fillRect(0, 0, W_, H);
};
const shine = (g: CanvasRenderingContext2D, W_: number, H: number) => { g.fillStyle = "rgba(255,255,255,0.06)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.35, 0); g.lineTo(0, H * 0.6); g.fill(); };

/** green phosphor radar: rings, sweep, blips with little tails */
export const drawRadar = (g: CanvasRenderingContext2D, W_: number, H: number, t: number) => {
  g.fillStyle = "#06180c"; g.fillRect(0, 0, W_, H);
  const cx = W_ / 2, cy = H / 2, R = H * 0.44;
  g.strokeStyle = "rgba(90,255,130,0.35)"; g.lineWidth = Math.max(2, H / 160);
  for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, (R * i) / 4, 0, 6.283); g.stroke(); }
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  const a = t * 2.2;
  const sw = g.createConicGradient ? g.createConicGradient(a - 1.0, cx, cy) : null;
  if (sw) { sw.addColorStop(0, "rgba(90,255,130,0)"); sw.addColorStop(0.16, "rgba(90,255,130,0.45)"); sw.addColorStop(0.161, "rgba(90,255,130,0)"); g.fillStyle = sw; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(160,255,180,0.9)"; g.lineWidth = Math.max(3, H / 110); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); g.stroke();
  for (let i = 0; i < 9; i++) {
    const ba = i * 2.399 + t * 0.05 * (i % 2 ? 1 : -1), br = R * (0.25 + ((i * 0.37) % 0.7));
    const x = cx + br * Math.cos(ba), y = cy + br * Math.sin(ba);
    let d = (a - ba) % 6.283; if (d < 0) d += 6.283;
    const glowK = 0.35 + 0.65 * Math.exp(-d * 1.2);
    g.fillStyle = `rgba(150,255,170,${glowK})`; g.beginPath(); g.arc(x, y, H / 55, 0, 6.283); g.fill();
    g.fillStyle = `rgba(150,255,170,${glowK * 0.5})`; g.fillRect(x + H / 40, y - H / 160, H / 14, H / 80); // the data tag (a bar, no text)
  }
  g.fillStyle = "rgba(90,255,130,0.5)"; for (let i = 0; i < 6; i++) g.fillRect(W_ * 0.04, H * 0.08 + i * H * 0.05, W_ * (0.06 + (i * 0.37) % 0.08), H * 0.018);
  scan(g, W_, H);
};
/** a floppy pictogram centred at (x, y), size s */
const floppyIcon = (g: CanvasRenderingContext2D, x: number, y: number, s: number, body = "#24305a", label = "#fbfaf4") => {
  g.save(); g.translate(x - s / 2, y - s / 2);
  g.fillStyle = body; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.88, 0); g.lineTo(s, s * 0.12); g.lineTo(s, s); g.lineTo(0, s); g.closePath(); g.fill();
  g.lineWidth = s * 0.04; g.strokeStyle = "#141a30"; g.stroke();
  g.fillStyle = "#c9ced8"; g.fillRect(s * 0.24, 0, s * 0.5, s * 0.34); g.fillStyle = body; g.fillRect(s * 0.56, s * 0.05, s * 0.1, s * 0.24);
  g.fillStyle = label; g.fillRect(s * 0.14, s * 0.48, s * 0.72, s * 0.46);
  g.restore();
};
/** a selfie photo: white frame, sky gradient, a happy face with a peace sign, size w x h at (x, y) top-left */
const selfie = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  g.save(); g.translate(x, y);
  g.fillStyle = "#ffffff"; rr(g, 0, 0, w, h, w * 0.05); g.fill();
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#5e93d9"); bg.addColorStop(1, "#f2c48a");
  g.fillStyle = bg; g.fillRect(w * 0.06, w * 0.06, w * 0.88, h - w * 0.12);
  g.fillStyle = "#ffe2c2"; g.beginPath(); g.ellipse(w * 0.5, h * 0.52, w * 0.24, w * 0.27, 0, 0, 6.283); g.fill();
  g.fillStyle = "#5a3b2a"; g.beginPath(); g.ellipse(w * 0.5, h * 0.4, w * 0.26, w * 0.13, 0, Math.PI, 0); g.fill();
  g.fillStyle = "#241726"; g.beginPath(); g.arc(w * 0.41, h * 0.52, w * 0.03, 0, 6.283); g.arc(w * 0.59, h * 0.52, w * 0.03, 0, 6.283); g.fill();
  g.strokeStyle = "#241726"; g.lineWidth = w * 0.025; g.beginPath(); g.arc(w * 0.5, h * 0.58, w * 0.09, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = "#3a64b8"; g.fillRect(w * 0.18, h * 0.78, w * 0.64, h * 0.16);
  g.restore();
};
const check = (g: CanvasRenderingContext2D, x: number, y: number, s: number, col = "#2fb36a") => { g.strokeStyle = col; g.lineWidth = s * 0.22; g.lineCap = "round"; g.beginPath(); g.moveTo(x - s * 0.4, y); g.lineTo(x - s * 0.1, y + s * 0.3); g.lineTo(x + s * 0.45, y - s * 0.35); g.stroke(); };
const cross = (g: CanvasRenderingContext2D, x: number, y: number, s: number, k: number) => {
  if (k <= 0) return; const r = s * (0.5 + 0.2 * Math.sin(k * Math.PI));
  g.lineCap = "round"; g.strokeStyle = "#241726"; g.lineWidth = s * 0.3; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
  g.strokeStyle = "#e8483c"; g.lineWidth = s * 0.2; g.stroke();
};
/** exploding-head face pictogram */
const mindBlown = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = "#f2c43a"; g.beginPath(); g.arc(x, y + s * 0.1, s * 0.42, 0, 6.283); g.fill();
  g.fillStyle = "#e8483c"; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.3; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.5, y - s * 0.3 + Math.sin(a) * s * 0.2, s * 0.09, s * 0.16, a + Math.PI / 2, 0, 6.283); g.fill(); }
  g.fillStyle = "#c9ced8"; g.beginPath(); g.ellipse(x, y - s * 0.38, s * 0.3, s * 0.12, 0, 0, 6.283); g.fill();
  g.fillStyle = "#241726"; g.beginPath(); g.arc(x - s * 0.14, y + s * 0.05, s * 0.05, 0, 6.283); g.arc(x + s * 0.14, y + s * 0.05, s * 0.05, 0, 6.283); g.fill();
  g.beginPath(); g.ellipse(x, y + s * 0.28, s * 0.09, s * 0.11, 0, 0, 6.283); g.fill();
};
/** a plane pictogram climbing (take-off) */
const planeUp = (g: CanvasRenderingContext2D, x: number, y: number, s: number, col = "#3a64b8") => {
  g.save(); g.translate(x, y); g.rotate(-0.45); g.fillStyle = col;
  g.beginPath(); g.ellipse(0, 0, s * 0.5, s * 0.09, 0, 0, 6.283); g.fill();
  g.beginPath(); g.moveTo(-s * 0.05, 0); g.lineTo(-s * 0.22, s * 0.42); g.lineTo(-s * 0.08, s * 0.42); g.lineTo(s * 0.16, 0); g.fill();
  g.beginPath(); g.moveTo(-s * 0.05, 0); g.lineTo(-s * 0.22, -s * 0.42); g.lineTo(-s * 0.08, -s * 0.42); g.lineTo(s * 0.16, 0); g.fill();
  g.beginPath(); g.moveTo(-s * 0.36, 0); g.lineTo(-s * 0.5, -s * 0.2); g.lineTo(-s * 0.42, -s * 0.2); g.lineTo(-s * 0.26, 0); g.fill();
  g.restore();
  g.fillStyle = "#5a5866"; g.fillRect(x - s * 0.6, y + s * 0.5, s * 1.2, s * 0.06);
};

export const drawScreen = (g: CanvasRenderingContext2D, W_: number, H: number, s: Screen, t: number) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none"; g.lineCap = "butt";
  if (s === "off") { g.fillStyle = "#141a1e"; g.fillRect(0, 0, W_, H); shine(g, W_, H); g.restore(); return; }
  if (s === "radar") { drawRadar(g, W_, H, t); shine(g, W_, H); g.restore(); return; }
  if (s === "cap") {
    // old green UI: a floppy icon, a capacity bar with a tiny fill; then the selfie slides in, far too big, the bar goes red
    g.fillStyle = "#06180c"; g.fillRect(0, 0, W_, H);
    const k1 = smooth((t - (W.holds - 0.1)) / 0.4), k2 = smooth((t - (W.mega - 0.1)) / 0.3);
    // (portrait inserts see only the central ~40 % of the width: everything sits in the 0.32..0.68 band)
    floppyIcon(g, W_ * 0.5, H * 0.3, H * 0.36, "#1f6a3a", "#bfffd0");
    g.strokeStyle = "#5aff82"; g.lineWidth = 8; g.strokeRect(W_ * 0.34, H * 0.62, W_ * 0.32, H * 0.14);
    g.fillStyle = "#5aff82"; const bw = (W_ * 0.32 - 16) * 0.07 * k1; g.fillRect(W_ * 0.34 + 8, H * 0.62 + 8, bw, H * 0.14 - 16);
    if (k2 > 0) { g.fillStyle = "#5aff82"; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W_ * 0.44 + i * W_ * 0.06, H * 0.87, 12 * k2, 0, 6.283); g.fill(); } }
    scan(g, W_, H); shine(g, W_, H); g.restore(); return;
  }
  // modern light UI for the rest
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#eaf1fb"); bg.addColorStop(1, "#d6e2f4");
  g.fillStyle = bg; g.fillRect(0, 0, W_, H);
  if (s === "post") {
    // a post card: round avatar (a little tower), two lines of grey, then two rows: [floppy][X][mind-blown] and [plane][check]
    const k0 = smooth((t - (W.posted - 0.2)) / 0.4), kx = smooth((t - (W.out - 0.08)) / 0.25), kp = smooth((t - (W.twentyfirst - 0.08)) / 0.25), kc = smooth((t - (W.inn - 0.08)) / 0.25);
    g.globalAlpha = 0.3 + 0.7 * k0;
    rr(g, W_ * 0.3, H * 0.04, W_ * 0.4, H * 0.92, 24); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "#b9c6dc"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "#3a64b8"; g.beginPath(); g.arc(W_ * 0.36, H * 0.11, H * 0.045, 0, 6.283); g.fill();
    g.fillStyle = "#b9c6dc"; g.fillRect(W_ * 0.41, H * 0.085, W_ * 0.2, H * 0.025); g.fillStyle = "#d6dde8"; g.fillRect(W_ * 0.41, H * 0.125, W_ * 0.13, H * 0.02);
    g.globalAlpha = 1;
    // row 1: the 1980s floppy, crossed out, with the exploding head beside it
    floppyIcon(g, W_ * 0.42, H * 0.36, H * 0.2);
    cross(g, W_ * 0.42, H * 0.36, H * 0.13, kx);
    if (kx > 0) { g.save(); g.translate(W_ * 0.59, H * 0.36); g.scale(kx, kx); mindBlown(g, 0, 0, H * 0.2); g.restore(); }
    // row 2: 21st-century tech: a plane taking off, and a green check
    if (kp > 0) { g.save(); g.translate(W_ * 0.43, H * 0.7); g.scale(kp, kp); planeUp(g, 0, 0, H * 0.22); g.restore(); }
    if (kc > 0) check(g, W_ * 0.6, H * 0.7, H * 0.12 * kc);
    shine(g, W_, H); g.restore(); return;
  }
  if (s === "eids") {
    // the one-screen system: a mini map with plane dots in the middle, tiles popping on: weather, outage, alert; then all glow
    const ks = [W.weather, W.outages, W.alerts, W.together].map((w) => smooth((t - (w - 0.1)) / 0.25)), blink = Math.floor(t * 4) % 2;
    g.fillStyle = "#1f3f78"; g.fillRect(0, 0, W_, H * 0.1);
    for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(W_ * 0.04 + i * 30, H * 0.05, 9, 0, 6.283); g.fill(); }
    rr(g, W_ * 0.32, H * 0.14, W_ * 0.36, H * 0.4, 16); g.fillStyle = "#4a9ad8"; g.fill();
    g.fillStyle = "#8cbf5a"; g.beginPath(); g.ellipse(W_ * 0.5, H * 0.34, W_ * 0.13, H * 0.15, 0.15, 0, 6.283); g.fill();
    for (let i = 0; i < 4; i++) planeUp(g, W_ * (0.42 + ((i * 0.37) % 0.16)), H * (0.22 + ((i * 0.53) % 0.2)), H * 0.07, "#ffffff");
    const tile = (x: number, y: number, k: number, col: string, icon: (cx: number, cy: number, s: number) => void) => {
      if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k);
      rr(g, -W_ * 0.055, -H * 0.14, W_ * 0.11, H * 0.28, 14); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.stroke();
      if (ks[3] > 0.5 && blink) { g.fillStyle = col + "33"; g.fill(); }
      icon(0, 0, H * 0.15); g.restore();
    };
    tile(W_ * 0.375, H * 0.75, ks[0], "#f2a03a", (cx, cy, s) => { g.fillStyle = "#f2c43a"; g.beginPath(); g.arc(cx - s * 0.12, cy - s * 0.1, s * 0.25, 0, 6.283); g.fill(); g.fillStyle = "#c9d6e0"; g.beginPath(); g.ellipse(cx + s * 0.08, cy + s * 0.12, s * 0.34, s * 0.16, 0, 0, 6.283); g.fill(); });
    tile(W_ * 0.5, H * 0.75, ks[1], "#e8483c", (cx, cy, s) => { g.strokeStyle = "#e8483c"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(cx - s * 0.35, cy + s * 0.2); g.lineTo(cx - s * 0.1, cy - s * 0.2); g.lineTo(cx + s * 0.05, cy + s * 0.05); g.lineTo(cx + s * 0.35, cy - s * 0.3); g.stroke(); g.fillStyle = "#e8483c"; g.fillRect(cx - s * 0.4, cy + s * 0.28, s * 0.8, s * 0.06); });
    tile(W_ * 0.625, H * 0.75, ks[2], "#f2a03a", (cx, cy, s) => { g.fillStyle = "#f2c43a"; g.beginPath(); g.moveTo(cx, cy - s * 0.4); g.lineTo(cx + s * 0.4, cy + s * 0.32); g.lineTo(cx - s * 0.4, cy + s * 0.32); g.closePath(); g.fill(); g.fillStyle = "#241726"; g.fillRect(cx - s * 0.04, cy - s * 0.15, s * 0.08, s * 0.28); g.fillRect(cx - s * 0.04, cy + s * 0.18, s * 0.08, s * 0.07); });
    shine(g, W_, H); g.restore(); return;
  }
  // save: the big save icon on a modern screen, the cursor comes in and clicks it (press flash)
  const k0 = smooth((t - 60.6) / 0.6), kc = smooth((t - (W.save - 0.35)) / 0.3), press = t >= W.save - 0.06 && t < W.save + 0.3;
  g.fillStyle = "#1f3f78"; g.fillRect(0, 0, W_, H * 0.1);
  const sz = H * (0.36 + 0.04 * k0) * (press ? 0.92 : 1);
  if (press) { g.fillStyle = "rgba(90,176,240,0.35)"; g.beginPath(); g.arc(W_ / 2, H * 0.55, sz * 0.85, 0, 6.283); g.fill(); }
  floppyIcon(g, W_ / 2, H * 0.55, sz, "#3a64b8", "#ffffff");
  // cursor arrow
  const cx = W_ * (0.66 - 0.12 * kc), cy = H * (0.88 - 0.26 * kc);
  g.fillStyle = "#ffffff"; g.strokeStyle = "#241726"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 70); g.lineTo(cx + 18, cy + 54); g.lineTo(cx + 32, cy + 84); g.lineTo(cx + 44, cy + 78); g.lineTo(cx + 30, cy + 48); g.lineTo(cx + 54, cy + 48); g.closePath(); g.fill(); g.stroke();
  void clamp01;
  shine(g, W_, H); g.restore();
};
