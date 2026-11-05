// The desk monitor's picture, drawn on a canvas per state (no text anywhere): the blurry security clip of trees and a
// riverbank, the spectrogram whose two Doppler streaks light up, and the "survived" sequence (filter sweep, static
// noise, phone squash) where the streaks keep glowing through everything.
import { Screen, curves, W, clamp01 } from "./story";

const q = (v: number, n = 20) => Math.round(v * n) / n;
export const screenKey = (s: Screen, t: number) => {
  if (s === "specA") { const [a, b] = curves(t); return `A|${q(a)}|${q(b)}|${Math.floor(t * 6) % 3}`; }
  if (s === "filters") return `F|${Math.floor(t * 15)}`;
  if (s === "clip") return `C|${Math.floor(t * 2) % 2}`;
  return s;
};
const rnd = (seed: number) => { let x = seed * 9301 + 49297; return () => { x = (x * 16807) % 2147483647; return (x % 100000) / 100000; }; };

/** a Doppler streak: high pitch flattening, a steep fall at the closest pass, low pitch flattening (x0..x1, rev 0..1) */
const streak = (g: CanvasRenderingContext2D, x0: number, x1: number, yHi: number, yLo: number, rev: number, w: number, col: string) => {
  if (rev <= 0) return;
  const n = 80, m = Math.floor(n * rev);
  const pt = (i: number) => { const u = i / n, x = x0 + (x1 - x0) * u, s = Math.tanh((u - 0.5) * 7); return [x, yHi + (yLo - yHi) * (s + 1) / 2] as const; };
  for (const [lw, a] of [[w * 4, 0.18], [w * 2, 0.35], [w, 1]] as const) {
    g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = lw; g.lineCap = "round"; g.beginPath();
    for (let i = 0; i <= m; i++) { const [x, y] = pt(i); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.globalAlpha = 1;
};
const specBase = (g: CanvasRenderingContext2D, W_: number, H: number, seed: number) => {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0b1238"); gr.addColorStop(1, "#1a1450");
  g.fillStyle = gr; g.fillRect(0, 0, W_, H);
  const r = rnd(seed);
  for (let i = 0; i < 1400; i++) { const y = r() * H, x = r() * W_; g.fillStyle = `rgba(${90 + r() * 80},${60 + r() * 60},${200},${0.15 + 0.25 * (y / H)})`; g.fillRect(x, y, 6 + r() * 14, 3); }
  // low rumble band at the bottom
  g.fillStyle = "rgba(130,90,220,0.35)"; g.fillRect(0, H * 0.86, W_, H * 0.14);
  // axes ticks (no labels)
  g.fillStyle = "rgba(255,255,255,0.25)"; for (let x = 0; x < W_; x += W_ / 16) g.fillRect(x, H - 8, 3, 8);
};
export const drawScreen = (g: CanvasRenderingContext2D, W_: number, H: number, s: Screen, t: number) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none";
  if (s === "off") { g.fillStyle = "#141a2a"; g.fillRect(0, 0, W_, H); g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.4, 0); g.lineTo(0, H * 0.7); g.fill(); g.restore(); return; }
  if (s === "clip") {
    // the blurry security clip: sky, far trees, the river, the near bank
    g.filter = "blur(7px)";
    const sk = g.createLinearGradient(0, 0, 0, H * 0.45); sk.addColorStop(0, "#9cbcd8"); sk.addColorStop(1, "#cfdbe0"); g.fillStyle = sk; g.fillRect(-20, -20, W_ + 40, H * 0.5);
    const r = rnd(7);
    for (let i = 0; i < 26; i++) { const x = i * (W_ / 22) - 20 + r() * 20, y = H * (0.3 + r() * 0.08), rr = 40 + r() * 40; g.fillStyle = ["#4a7a4a", "#5a8a52", "#3c6a42"][i % 3]; g.beginPath(); g.ellipse(x, y, rr, rr * 1.2, 0, 0, 6.283); g.fill(); }
    g.fillStyle = "#466e48"; g.fillRect(-20, H * 0.38, W_ + 40, H * 0.12);
    g.fillStyle = "#5f8fa8"; g.fillRect(-20, H * 0.5, W_ + 40, H * 0.16);
    g.fillStyle = "#7aa070"; g.fillRect(-20, H * 0.66, W_ + 40, H * 0.4);
    g.filter = "none";
    // greyish CCTV cast + scanlines + vignette
    g.fillStyle = "rgba(120,130,120,0.25)"; g.fillRect(0, 0, W_, H);
    g.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W_, 2);
    const vg = g.createRadialGradient(W_ / 2, H / 2, H * 0.3, W_ / 2, H / 2, W_ * 0.62); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)"); g.fillStyle = vg; g.fillRect(0, 0, W_, H);
    // REC dot (blinks) and a time bar - shapes only
    if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = "#ff3a2a"; g.beginPath(); g.arc(46, 42, 14, 0, 6.283); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 6; i++) g.fillRect(W_ - 250 + i * 36, 34, 26, 14);
    g.restore(); return;
  }
  specBase(g, W_, H, s === "specA" ? 3 + (Math.floor(t * 6) % 3) : 3);
  const [c1, c2] = s === "specA" ? curves(t) : [1, 1];
  // vertical squash for the phone compression
  let sq = 1, noise = 0, sweep = -1;
  if (s === "filters") {
    sweep = clamp01((t - (W.filters - 0.2)) / 0.6);
    noise = t > W.noise - 0.1 ? clamp01((t - (W.noise - 0.1)) / 0.2) : 0;
    sq = t > W.phone - 0.1 ? 1 - 0.55 * clamp01((t - (W.phone - 0.1)) / 0.25) : 1;
  }
  g.translate(0, H * (1 - sq) / 2); g.scale(1, sq);
  streak(g, W_ * 0.06, W_ * 0.44, H * 0.3, H * 0.72, c1, 9, "#fff27a");
  streak(g, W_ * 0.56, W_ * 0.94, H * 0.36, H * 0.76, c2, 9, "#7ff6ff");
  // the gap between them: a bracket that grows once the second streak is in
  if (s === "specA" && c2 > 0.3) {
    const k = clamp01((c2 - 0.3) / 0.5);
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 6; g.setLineDash([16, 12]);
    g.beginPath(); g.moveTo(W_ * 0.25, H * 0.12); g.lineTo(W_ * 0.25 + (W_ * 0.5) * k, H * 0.12); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#ffffff"; g.fillRect(W_ * 0.25 - 3, H * 0.07, 6, H * 0.1); if (k > 0.98) g.fillRect(W_ * 0.75 - 3, H * 0.07, 6, H * 0.1);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (sq < 1) { // phone compression: blocky bands above and below
    g.fillStyle = "#06081a"; g.fillRect(0, 0, W_, H * (1 - sq) / 2); g.fillRect(0, H - H * (1 - sq) / 2, W_, H * (1 - sq) / 2);
    g.fillStyle = "rgba(255,255,255,0.12)"; for (let x = 0; x < W_; x += 32) g.fillRect(x, H * (1 - sq) / 2 - 4, 16, 4);
  }
  if (sweep >= 0 && sweep < 1) { // filter: a translucent wiper sweeping across, erasing the noise behind it
    const x = W_ * sweep;
    g.fillStyle = "rgba(255,120,200,0.28)"; g.fillRect(x - 70, 0, 140, H);
    g.fillStyle = "rgba(255,160,220,0.9)"; g.fillRect(x - 4, 0, 8, H);
  }
  if (noise > 0) { // static snow over everything (the streaks punch through: redrawn on top, brighter)
    const r = rnd(Math.floor(t * 15));
    g.globalAlpha = 0.6 * noise;
    for (let i = 0; i < 3500; i++) { const v = Math.floor(r() * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * W_, r() * H, 5, 4); }
    g.globalAlpha = 1;
    g.translate(0, H * (1 - sq) / 2); g.scale(1, sq);
    streak(g, W_ * 0.06, W_ * 0.44, H * 0.3, H * 0.72, 1, 7, "#fff27a");
    streak(g, W_ * 0.56, W_ * 0.94, H * 0.36, H * 0.76, 1, 7, "#7ff6ff");
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  // bezel shine
  g.fillStyle = "rgba(255,255,255,0.04)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.35, 0); g.lineTo(0, H * 0.6); g.fill();
  g.restore();
};
