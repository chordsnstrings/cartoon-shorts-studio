// The pilot's monitor picture, no text anywhere: the robot's own camera view (a staircase seen from robot height,
// its two claws at the bottom moving with the pilot's hands, a little red "live" dot), then on "overheated" the
// picture breaks up into static with a red thermometer pictogram.
import { W, clamp01 } from "./story";

export type Screen = "pov" | "static";
export const screenAt = (id: number, t: number): Screen => (id === 7 && t >= W.overheated - 0.5 ? "static" : "pov");
export const screenKey = (s: Screen, t: number) => (s === "pov" ? `P|${Math.floor(t * 15)}` : `S|${Math.floor(t * 15)}`);

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

export const drawScreen = (g: CanvasRenderingContext2D, W_: number, H: number, s: Screen, t: number) => {
  if (s === "static") {
    let seed = Math.floor(t * 15) * 7919 + 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = "#3a3f4c"; g.fillRect(0, 0, W_, H);
    for (let i = 0; i < 900; i++) { const v = 60 + rnd() * 190 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * W_, rnd() * H, 10 + rnd() * 30, 4 + rnd() * 6); }
    // thermometer pictogram, centred (inside the middle band)
    const cx = W_ / 2, cy = H / 2, k = H / 300, blink = Math.floor(t * 6) % 2;
    g.fillStyle = "rgba(20,16,24,0.75)"; rr(g, cx - 70 * k, cy - 120 * k, 140 * k, 240 * k, 24 * k); g.fill();
    g.fillStyle = "#fbfaf4"; rr(g, cx - 18 * k, cy - 95 * k, 36 * k, 150 * k, 18 * k); g.fill();
    g.beginPath(); g.arc(cx, cy + 62 * k, 34 * k, 0, 6.283); g.fill();
    g.fillStyle = blink ? "#ff3b2f" : "#e8483c"; rr(g, cx - 9 * k, cy - 80 * k, 18 * k, 140 * k, 9 * k); g.fill();
    g.beginPath(); g.arc(cx, cy + 62 * k, 24 * k, 0, 6.283); g.fill();
    return;
  }
  // the robot's view: hall wall, stair treads receding up, banister, its two claws at the bottom edge
  const sway = Math.sin(t * 2.3) * 0.04;
  g.save(); g.translate(W_ / 2, H / 2); g.rotate(sway); g.translate(-W_ / 2, -H / 2);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#e9dcc0"); gr.addColorStop(1, "#d8c8a8");
  g.fillStyle = gr; g.fillRect(-40, -40, W_ + 80, H + 80);
  const cx = W_ * 0.5, vy = H * 0.18;
  for (let i = 0; i < 9; i++) {
    const a = 1 - i / 10, y0 = vy + (H * 1.05 - vy) * a, y1 = vy + (H * 1.05 - vy) * (1 - (i + 1) / 10), hw = W_ * 0.42 * a + 20, hw1 = W_ * 0.42 * (1 - (i + 1) / 10) + 20;
    g.fillStyle = i % 2 ? "#9a3b3f" : "#8a3438"; g.beginPath(); g.moveTo(cx - hw, y0); g.lineTo(cx + hw, y0); g.lineTo(cx + hw1, y1); g.lineTo(cx - hw1, y1); g.fill();
    g.fillStyle = "#e0b45a"; g.fillRect(cx - hw1, y1 - 3, hw1 * 2, 6);
  }
  g.strokeStyle = "#6a4a3a"; g.lineWidth = 10; g.beginPath(); g.moveTo(cx + W_ * 0.44, H); g.lineTo(cx + 40, vy); g.stroke();
  // claws (move with the pilot's hands)
  const k = clamp01(0.5 + 0.5 * Math.sin(t * 3.1));
  for (const sd of [-1, 1]) {
    const x = cx + sd * W_ * 0.2 + sd * 14 * Math.sin(t * 2.6 + sd), y = H * 0.9 - 18 * Math.sin(t * 3.1 + sd);
    g.fillStyle = "#c9ced8"; g.strokeStyle = "#241726"; g.lineWidth = 8;
    for (const f of [-1, 1]) { g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x + f * (16 + 18 * k), y - 20); g.lineTo(x + f * (6 + 10 * k), y - 52); g.stroke(); }
    g.fillStyle = "#5d6578"; g.beginPath(); g.arc(x, y + 64, 26, 0, 6.283); g.fill(); g.stroke();
  }
  g.restore();
  // live dot + corner brackets (no text)
  g.fillStyle = Math.floor(t * 2) % 2 ? "#ff3b2f" : "#b0302a"; g.beginPath(); g.arc(W_ * 0.36, H * 0.14, H * 0.035, 0, 6.283); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 6;
  for (const [x, y, sx, sy] of [[W_ * 0.3, H * 0.06, 1, 1], [W_ * 0.7, H * 0.06, -1, 1], [W_ * 0.3, H * 0.94, 1, -1], [W_ * 0.7, H * 0.94, -1, -1]]) {
    g.beginPath(); g.moveTo(x + sx * 40, y); g.lineTo(x, y); g.lineTo(x, y + sy * 40); g.stroke();
  }
};
