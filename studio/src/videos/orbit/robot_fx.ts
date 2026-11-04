// impact star (shared with the hot pot short)
import { Pen, P2 } from "./toon";
/** impact star: fat jagged yellow-white burst with ink, popping then shrinking */
export const fxPow = (p: Pen, t: number) => {
  const k = t < 0.3 ? 0.6 + 1.3 * t : 1 - 0.5 * (t - 0.3);
  const star = (R: number, r: number, n: number, rot: number): P2[] => Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R * (0.85 + 0.15 * Math.sin(i * 7.3));
    return [256 + rr * Math.cos(a), 256 + rr * Math.sin(a)] as P2;
  });
  p.poly(star(230 * k, 120 * k, 9, 0.2), "#ffd23c", 12);
  p.poly(star(140 * k, 72 * k, 9, 0.5), "#fff8d8", 0);
};
