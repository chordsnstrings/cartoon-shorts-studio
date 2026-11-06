// The screens' picture (the kiosk in the hall and the office monitor share one canvas), drawn per state, no text
// anywhere: the search page with its tally bar shooting up, the two bars (fifteen vs eleven thousand), the load grid of
// little people icons (a hundred, then five hundred), the filter panel (six ticks vs twenty-five), the red queue-full
// stop page, and the ban map where red crosses cover every address and new ones pop up again.
import { Screen, W, clamp01, smooth } from "./story";

const q = (v: number, n = 20) => Math.round(v * n) / n;
export const screenKey = (s: Screen, t: number) => {
  if (s === "search") return `S|${Math.floor(t * 10)}`;
  if (s === "bars") return `B|${q(smooth((t - (W.fifteen - 0.1)) / 0.3))}|${Math.floor(t * 4) % 2}`;
  if (s === "load") return `L|${t < W.five - 0.1 ? 0 : Math.min(10, Math.floor((t - (W.five - 0.1)) * 25))}|${Math.floor(t * 3) % 2}`;
  if (s === "filters") return `F|${t < W.six - 0.2 ? 0 : 1}|${t < W.ticked - 0.1 ? 0 : Math.min(25, Math.floor((t - (W.ticked - 0.1)) * 38))}`;
  if (s === "full") return `X|${Math.floor(t * 4) % 2}`;
  if (s === "ban") return `N|${Math.floor(t * 12)}`;
  return s;
};
const rnd = (seed: number) => { let x = seed * 9301 + 49297; return () => { x = (x * 16807) % 2147483647; return (x % 100000) / 100000; }; };
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const flag = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = "#ffffff"; g.fillRect(x, y, 36 * s, 24 * s); g.fillStyle = "#2a5bb8"; g.fillRect(x + 10 * s, y, 7 * s, 24 * s); g.fillRect(x, y + 9 * s, 36 * s, 6 * s);
  g.strokeStyle = "#2a2232"; g.lineWidth = 2 * s; g.strokeRect(x, y, 36 * s, 24 * s);
};
const note = (g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) => {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 5 * s;
  g.beginPath(); g.ellipse(x, y, 10 * s, 7.5 * s, -0.35, 0, 6.283); g.fill();
  g.beginPath(); g.moveTo(x + 9 * s, y - 2 * s); g.lineTo(x + 9 * s, y - 34 * s); g.lineTo(x + 24 * s, y - 26 * s); g.stroke();
};
const mag = (g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) => {
  g.strokeStyle = col; g.lineWidth = 6 * s; g.beginPath(); g.arc(x, y, 14 * s, 0, 6.283); g.stroke();
  g.beginPath(); g.moveTo(x + 10 * s, y + 10 * s); g.lineTo(x + 24 * s, y + 24 * s); g.stroke();
};
/** a little person icon (head + shoulders) */
const person = (g: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) => {
  g.fillStyle = col; g.beginPath(); g.arc(x, y - 7 * s, 5 * s, 0, 6.283); g.fill();
  g.beginPath(); g.ellipse(x, y + 6 * s, 9 * s, 7 * s, 0, Math.PI, 0); g.fill();
};
const searchBar = (g: CanvasRenderingContext2D, W_: number, top: number) => {
  rr(g, W_ * 0.08, top, W_ * 0.84, 80, 40); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "#2a2232"; g.lineWidth = 5; g.stroke();
  mag(g, W_ * 0.08 + 52, top + 36, 1.1, "#2a2232");
  flag(g, W_ * 0.08 + 110, top + 26, 1.2); note(g, W_ * 0.08 + 190, top + 58, 1.1, "#e8483c");
};
const shine = (g: CanvasRenderingContext2D, W_: number, H: number) => { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(W_ * 0.35, 0); g.lineTo(0, H * 0.6); g.fill(); };

export const drawScreen = (g: CanvasRenderingContext2D, W_: number, H: number, s: Screen, t: number) => {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none";
  if (s === "off") { g.fillStyle = "#141a2a"; g.fillRect(0, 0, W_, H); shine(g, W_, H); g.restore(); return; }
  if (s === "full") {
    const blink = Math.floor(t * 4) % 2;
    g.fillStyle = blink ? "#d8362e" : "#c42c26"; g.fillRect(0, 0, W_, H);
    // a white stop hand in a circle, and a queue of grey dots behind a bar
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(W_ * 0.5, H * 0.42, H * 0.27, 0, 6.283); g.fill();
    g.fillStyle = "#d8362e"; const cx = W_ * 0.5, cy = H * 0.45, u = H * 0.0042;
    rr(g, cx - 34 * u, cy - 10 * u, 68 * u, 52 * u, 16 * u); g.fill();
    for (let i = 0; i < 4; i++) { rr(g, cx - 34 * u + i * 17.5 * u, cy - 44 * u - (i === 1 || i === 2 ? 6 * u : 0), 13 * u, 44 * u, 6 * u); g.fill(); }
    rr(g, cx - 52 * u, cy - 4 * u, 22 * u, 13 * u, 6 * u); g.fill();
    for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.arc(W_ * 0.12 + i * W_ * 0.055, H * 0.86, 12, 0, 6.283); g.fill(); }
    g.fillStyle = "#ffffff"; g.fillRect(W_ * 0.08, H * 0.8, 10, H * 0.12);
    shine(g, W_, H); g.restore(); return;
  }
  // light UI background for the rest
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#eaf1fb"); bg.addColorStop(1, "#d6e2f4");
  g.fillStyle = bg; g.fillRect(0, 0, W_, H);
  g.fillStyle = "#2f5aa8"; g.fillRect(0, 0, W_, 34); // header band
  for (let i = 0; i < 3; i++) { g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(28 + i * 26, 17, 7, 0, 6.283); g.fill(); }
  if (s === "search" || s === "ok") {
    searchBar(g, W_, 60);
    if (s === "ok") {
      for (let i = 0; i < 4; i++) { rr(g, W_ * 0.08, 170 + i * 82, W_ * 0.84, 64, 12); g.fillStyle = "#ffffff"; g.fill(); g.fillStyle = "#b9c6dc"; g.fillRect(W_ * 0.12, 192 + i * 82, W_ * (0.3 + 0.1 * (i % 3)), 14); g.fillStyle = "#8fb0e0"; g.fillRect(W_ * 0.12, 214 + i * 82, W_ * 0.2, 10); }
    } else {
      // result rows flickering past + a tally bar on the right shooting up
      const k = Math.floor(t * 10), r = rnd(k);
      for (let i = 0; i < 4; i++) { rr(g, W_ * 0.14, 170 + i * 82, W_ * 0.44, 64, 12); g.fillStyle = "#ffffff"; g.fill(); flag(g, W_ * 0.16, 186 + i * 82, 0.9); note(g, W_ * 0.16 + 60, 222 + i * 82, 0.8, "#e8483c"); g.fillStyle = "#b9c6dc"; g.fillRect(W_ * 0.28, 194 + i * 82, W_ * (0.1 + 0.18 * r()), 14); }
      const lvl = clamp01((t - 0.3) / 5.2) ** 0.7, bh = (H - 200) * lvl;
      rr(g, W_ * 0.62, H - 30 - (H - 200), W_ * 0.2, H - 200, 14); g.fillStyle = "rgba(47,90,168,0.12)"; g.fill();
      rr(g, W_ * 0.62, H - 30 - bh, W_ * 0.2, bh, 14); g.fillStyle = lvl > 0.75 ? "#e8483c" : "#f2a03a"; g.fill(); g.strokeStyle = "#2a2232"; g.lineWidth = 5; g.stroke();
      for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(W_ * 0.64, H - 30 - bh * (i + 0.5) / 6, W_ * 0.16, 4); }
    }
    shine(g, W_, H); g.restore(); return;
  }
  if (s === "bars") {
    // eleven thousand (huge, red, off the top) vs fifteen (a sliver) - baseline at the bottom
    const base = H - 50;
    g.fillStyle = "#2a2232"; g.fillRect(W_ * 0.08, base, W_ * 0.84, 6);
    const k = smooth((t - (W.fifteen - 0.1)) / 0.3);
    rr(g, W_ * 0.52, 46, W_ * 0.15, base - 46, 14); g.fillStyle = "#e8483c"; g.fill(); g.strokeStyle = "#2a2232"; g.lineWidth = 6; g.stroke();
    flag(g, W_ * 0.545, 70, 1.4); note(g, W_ * 0.6, 170, 1.3, "#ffffff");
    if (k > 0) { const h = 10 * k + 2; rr(g, W_ * 0.33, base - h, W_ * 0.15, h, 4); g.fillStyle = "#2f5aa8"; g.fill(); g.stroke(); }
    // calendar page icons under each bar: last month / this one
    for (const [x, c] of [[W_ * 0.405, "#9aa3b8"], [W_ * 0.595, "#e8483c"]] as const) { g.fillStyle = c; g.fillRect(x - 18, base + 14, 36, 8); }
    if (k > 0.5) { g.strokeStyle = "#2f5aa8"; g.lineWidth = 5; g.beginPath(); g.arc(W_ * 0.405, base - 30, 50, 0, 6.283); g.stroke(); }
    shine(g, W_, H); g.restore(); return;
  }
  if (s === "load") {
    const n5 = t < W.five - 0.1 ? 0 : Math.min(10, Math.floor((t - (W.five - 0.1)) * 25));
    const cols = 12, N = 100 + n5 * 40, red = n5 > 0, rows = Math.ceil(N / cols);
    const cell = Math.min((W_ * 0.36) / cols, (H - 60) / rows), x0 = W_ * 0.5 - (cols * cell) / 2;
    for (let i = 0; i < N; i++) { const c = i % cols, rw = Math.floor(i / cols); person(g, x0 + (c + 0.5) * cell, 46 + (rw + 0.6) * cell, cell / 24, i >= 100 ? "#e8483c" : "#2f5aa8"); }
    if (red && Math.floor(t * 3) % 2) { g.fillStyle = "rgba(232,72,60,0.18)"; g.fillRect(0, 34, W_, H); }
    shine(g, W_, H); g.restore(); return;
  }
  if (s === "filters") {
    const hum = t >= W.six - 0.2, nb = t < W.ticked - 0.1 ? 0 : Math.min(25, Math.floor((t - (W.ticked - 0.1)) * 38));
    const rows = 25, top = 54, rh = (H - top - 14) / rows;
    for (const [x0, n, col, icon] of [[W_ * 0.06, hum ? 6 : 0, "#2f5aa8", 0], [W_ * 0.54, nb, "#e8483c", 1]] as const) {
      // column header icon: a person / a little robot head
      g.fillStyle = col;
      if (icon === 0) person(g, x0 + 30, top - 6, 1.1, col); else { rr(g, x0 + 14, top - 22, 32, 24, 6); g.fill(); g.fillStyle = "#7ff6ff"; g.fillRect(x0 + 21, top - 14, 6, 6); g.fillRect(x0 + 33, top - 14, 6, 6); }
      for (let i = 0; i < rows; i++) {
        const y = top + 8 + i * rh, on = i < n;
        g.strokeStyle = "#2a2232"; g.lineWidth = 2.5; g.fillStyle = "#ffffff"; g.fillRect(x0 + 60, y, rh - 4, rh - 4); g.strokeRect(x0 + 60, y, rh - 4, rh - 4);
        if (on) { g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 63, y + rh * 0.45); g.lineTo(x0 + 60 + rh * 0.4, y + rh - 8); g.lineTo(x0 + 60 + rh - 6, y + 2); g.stroke(); }
        g.fillStyle = on ? "#7a8aa8" : "#c3cddc"; g.fillRect(x0 + 60 + rh + 6, y + rh * 0.3, W_ * (0.16 + 0.12 * ((i * 37) % 10) / 10), rh * 0.3);
      }
    }
    shine(g, W_, H); g.restore(); return;
  }
  if (s === "ban") {
    // addresses as dots; red crosses sweep over all of them; then new green ones pop up in the gaps
    const r = rnd(5), n = 260, sweep = clamp01((t - (W.banned - 0.15)) / 1.4), back = clamp01((t - (W.came - 0.2)) / 1.0);
    for (let i = 0; i < n; i++) {
      const x = 30 + r() * (W_ - 60), y = 50 + r() * (H - 70), h = r();
      if (h < sweep) { g.strokeStyle = "#e8483c"; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); g.stroke(); }
      else { g.fillStyle = "#2f5aa8"; g.beginPath(); g.arc(x, y, 6, 0, 6.283); g.fill(); }
    }
    const r2 = rnd(11);
    for (let i = 0; i < 200; i++) {
      const x = 30 + r2() * (W_ - 60), y = 50 + r2() * (H - 70), h = r2();
      if (h < back) { const k = clamp01((back - h) * 6); g.fillStyle = "#3fbf6a"; g.beginPath(); g.arc(x, y, 7 * (k < 1 ? k * 1.4 : 1), 0, 6.283); g.fill(); }
    }
    shine(g, W_, H); g.restore(); return;
  }
  g.restore();
};
