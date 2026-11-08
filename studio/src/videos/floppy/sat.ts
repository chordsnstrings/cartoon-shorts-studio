// Effect cards shared by the shots (message rings, sparkles, soft glows), drawn with the plum-ink Pen.
import { Pen, P2 } from "./toon";
const rad = (d: number) => (d * Math.PI) / 180;

/** message pulse: concentric arcs travelling outward (512 x 512), t 0..1 */
export const fxPulse = (p: Pen, t: number, col = "#9ff3ff") => {
  for (let k = 0; k < 3; k++) {
    const u = (t + k / 3) % 1;
    p.g.globalAlpha = Math.sin(u * Math.PI);
    p.arc(256, 256, 40 + 200 * u, 40 + 200 * u, 0, 360, 16 * (1 - u) + 5, col);
  }
  p.g.globalAlpha = 1;
};
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
