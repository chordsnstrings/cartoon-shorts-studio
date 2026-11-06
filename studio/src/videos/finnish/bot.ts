// Our own characters that are not people: the scraper bot (a boxy little robot with a screen face, our design), its
// disguises (top hat, moustache, round glasses), the big blue AI door guard, and the effect cards of this short (search
// bubbles, flying books, catalogue cards, the accordion, food, a red stop cross). Same plum-ink Pen as toon.ts,
// 600 x 1000 design canvas, soles at y = 975. No text anywhere.
import { Pen, INK, mul, ellPts, rrect, P2, thickAngle, fxNote } from "./toon";

const rad = (d: number) => (d * Math.PI) / 180;
const SH: [number, number, number] = [0.72, 0.74, 0.84];
const SCREEN = "#1d2432", GLOW = "#7ff6ff";

export type BotFace = "happy" | "closed" | "dots" | "wink" | "x" | "scan" | "angry";
export type BotPose = {
  la: number; le: number; ra: number; re: number; // shoulder angle from hanging (deg, + = outward/up), elbow bend
  sway?: number; head?: number; face?: BotFace; step?: number; blink?: number; light?: number;
  shell?: string; joint?: string; disguise?: number; tray?: number; guard?: boolean; book?: boolean; phase?: number; tiptoe?: number;
};
const limb = (p: Pen, a: P2, b: P2, w: number, col: string) => { p.stroke([a, b], w + 10, INK); p.stroke([a, b], w, col); };
const rotP = (q: P2, a: number, c: P2): P2 => {
  const s = Math.sin(a), co = Math.cos(a);
  return [c[0] + (q[0] - c[0]) * co - (q[1] - c[1]) * s, c[1] + (q[0] - c[0]) * s + (q[1] - c[1]) * co];
};

/** the bot, ~1.2 m tall at scale 1 (design 400 .. 975) */
export const drawBot = (p: Pen, P: BotPose) => {
  const light = P.light ?? rad(-120), thick = thickAngle(light);
  const SHELL = P.shell ?? (P.guard ? "#4f7fd6" : "#d6dbe3"), JOINT = P.joint ?? (P.guard ? "#2b3a66" : "#3fa7a0"), JOINT_D = mul(JOINT, [0.75, 0.75, 0.8]);
  const sway = rad(P.sway ?? 0), hip: P2 = [300, 840], step = P.step ?? 0, ph = P.phase ?? 0, tip = P.tiptoe ?? 0;
  const bob = -Math.abs(Math.sin(ph * Math.PI * 2)) * 14 - tip * 18;
  // legs: stubby, feet planted; walking swings them
  for (const side of [-1, 1]) {
    const sw = Math.sin(ph * Math.PI * 2) * side * 22, up = Math.max(0, side * step) * 26 + Math.max(0, Math.sin(ph * Math.PI * 2) * side) * 18 + tip * 20;
    const top: P2 = [300 + side * 36, 845 + bob], ank: P2 = [300 + side * 42 + sw, 948 - up];
    limb(p, top, ank, 34, JOINT_D);
    const fp = ellPts(ank[0] + side * 6, 958 - up, 36, 17);
    p.gradFill(fp, "#3b4150", "#262a36", light); p.inkRing(fp, 7, thick);
  }
  p.rot = sway || bob ? [sway, hip[0], hip[1], 0, bob] : null;
  const shL: P2 = [226, 682], shR: P2 = [374, 682];
  const arm = (sh: P2, side: number, ang: number, el: number) => {
    const a = rad(ang), L1 = 90, L2 = 84;
    const E: P2 = [sh[0] + side * Math.sin(a) * L1, sh[1] + Math.cos(a) * L1];
    const a2 = a + rad(el);
    const Hd: P2 = [E[0] + side * Math.sin(a2) * L2, E[1] + Math.cos(a2) * L2];
    limb(p, sh, E, 26, SHELL); limb(p, E, Hd, 24, SHELL);
    p.ell(E[0], E[1], 16, 16, JOINT, 6);
    p.ell(Hd[0], Hd[1], 21, 21, "#e9e2d6", 7);
    return Hd;
  };
  const hl = arm(shL, -1, P.la, P.le);
  // torso
  const tp = rrect(220, 650, 380, 862, 54);
  p.gradFill(tp, SHELL, mul(SHELL, SH), light); p.inkRing(tp, 9, thick);
  if (P.guard) { // shield badge (no text): a gold shield with a check tick
    const sh: P2[] = [[300, 700], [348, 716], [344, 770], [300, 800], [256, 770], [252, 716]];
    p.poly(sh, "#f2c43a", 7); p.stroke([[278, 748], [296, 766], [324, 726]], 10, INK);
  } else { // chest panel: three little lights
    p.poly(rrect(262, 700, 338, 760, 12), mul(SHELL, [0.86, 0.87, 0.92]), 6);
    for (const [i, c] of [[0, "#ff6a50"], [1, "#f2c43a"], [2, "#7fe07a"]] as const) p.dot(280 + i * 20, 730, 7, c);
  }
  const hr = arm(shR, 1, P.ra, P.re);
  for (const s of [shL, shR]) p.ell(s[0], s[1], 20, 20, JOINT, 7);
  // held things
  if (P.tray) { // a tray carried flat in both hands with a growing stack of plates and food
    const ty = Math.min(hl[1], hr[1]) - 6;
    p.poly(rrect(hl[0] - 30, ty - 10, hr[0] + 30, ty + 8, 6), "#c9ced8", 6);
    for (let i = 0; i < P.tray; i++) {
      const y = ty - 16 - i * 22, x = 300 + (i % 2 ? 8 : -6);
      p.ell(x, y, 62, 13, "#fbfaf4", 6);
      p.ell(x - 18 + (i * 13) % 30, y - 12, 18, 12, ["#e8483c", "#f2a03a", "#7fbf5a", "#c97a3a", "#f2d24a"][i % 5], 5);
    }
  }
  if (P.book) { const bx = hr[0] - 6, by = hr[1] - 40; p.poly([[bx - 40, by - 30], [bx + 40, by - 30], [bx + 40, by + 34], [bx - 40, by + 34]], "#3a64b8", 7); p.stroke([[bx - 30, by - 22], [bx - 30, by + 26]], 6, "#f4efe6"); }
  // head
  const neck: P2 = [300, 650];
  const nk = rotP(neck, sway, hip);
  p.rot = [sway + rad(P.head ?? 0), 300, 650, nk[0] - 300, nk[1] - 650 + bob];
  p.poly(rrect(282, 610, 318, 656, 8), JOINT_D, 6);
  const hp = rrect(206, 462, 394, 620, 54);
  p.gradFill(hp, SHELL, mul(SHELL, SH), light); p.inkRing(hp, 9, thick);
  for (const s of [-1, 1]) p.ell(300 + s * 96, 540, 13, 30, JOINT, 6);
  if (!P.guard) { p.stroke([[300, 462], [300, 420]], 7, INK); p.dot(300, 412, 13, "#ff6a50"); p.ell(300, 412, 13, 13, null, 5); }
  else { p.poly(rrect(250, 440, 350, 466, 10), "#2b3a66", 6); }
  const sp = rrect(230, 488, 370, 598, 36);
  p.poly(sp, SCREEN, 6);
  const face = P.face ?? "happy", blink = P.blink ?? 0, ex = 36, ey = 534;
  const arcEye = (x: number, up: boolean) => p.arc(x, ey + (up ? 6 : -4), 15, 12, up ? 200 : 20, up ? 340 : 160, 8, GLOW);
  if (face === "x") for (const s of [-1, 1]) { const x = 300 + s * ex; p.stroke([[x - 12, ey - 12], [x + 12, ey + 12]], 8, "#ff6a50"); p.stroke([[x + 12, ey - 12], [x - 12, ey + 12]], 8, "#ff6a50"); }
  else if (face === "scan") { p.stroke([[248, ey], [352, ey]], 9, GLOW); p.ell(300 + 40 * Math.sin((P.phase ?? 0) * 6), ey, 12, 12, GLOW, 0); }
  else if (blink > 0.6 || face === "closed") { arcEye(300 - ex, true); arcEye(300 + ex, true); }
  else if (face === "dots") for (const s of [-1, 1]) p.ell(300 + s * ex, ey, 10, blink > 0.2 ? 4 : 13, GLOW, 0);
  else if (face === "wink") { arcEye(300 - ex, true); p.ell(300 + ex, ey, 10, 13, GLOW, 0); }
  else if (face === "angry") for (const s of [-1, 1]) { p.ell(300 + s * ex, ey + 4, 10, 10, GLOW, 0); p.stroke([[300 + s * (ex + 16), ey - 18], [300 + s * (ex - 14), ey - 8]], 7, GLOW); }
  else { arcEye(300 - ex, true); arcEye(300 + ex, true); }
  if (face !== "x" && face !== "scan" && face !== "dots") p.arc(300, 560, 24, 14, 15, 165, 8, GLOW);
  if (face === "dots") p.stroke([[286, 566], [314, 566]], 7, GLOW);
  // disguises: 1 top hat, 2 moustache + top hat, 3 round glasses + moustache + top hat
  const d = P.disguise ?? 0;
  if (d >= 1) { p.poly(rrect(200, 456, 400, 476, 8), "#2b2630", 7); p.poly(rrect(236, 340, 364, 462, 10), "#2b2630", 7); p.poly([[236, 430], [364, 430], [364, 448], [236, 448]], "#c0353a", 0); }
  if (d >= 2) { p.poly([[300, 572], [264, 566], [232, 584], [258, 600], [300, 588], [342, 600], [368, 584], [336, 566]], "#3a2a22", 6); }
  if (d >= 3) { for (const s of [-1, 1]) p.ell(300 + s * ex, ey - 2, 26, 26, null, 9); p.stroke([[300 - ex + 26, ey - 4], [300 + ex - 26, ey - 4]], 8, INK); }
  p.rot = null;
};

// ---------------- effect cards ----------------
/** a search bubble (256 x 256): white speech-ish round with a magnifier, a little blue-cross flag and a music note */
export const fxSearch = (p: Pen, kind: number) => {
  p.ell(128, 120, 104, 96, "#ffffff", 9);
  p.poly([[70, 196], [52, 244], [104, 208]], "#ffffff", 9);
  p.ell(128, 120, 98, 90, "#ffffff", 0);
  // magnifier
  p.ell(96, 104, 34, 34, "#e7f3ff", 9); p.stroke([[120, 128], [146, 154]], 14);
  if (kind % 2 === 0) { // flag: white field, blue nordic cross
    p.poly([[140, 70], [204, 70], [204, 114], [140, 114]], "#ffffff", 6);
    p.poly([[156, 70], [168, 70], [168, 114], [156, 114]], "#2a5bb8", 0);
    p.poly([[140, 86], [204, 86], [204, 98], [140, 98]], "#2a5bb8", 0);
    p.poly([[140, 70], [204, 70], [204, 114], [140, 114]], null, 6);
  }
  // music note
  const g = p.g; g.save(); g.translate(kind % 2 ? 140 : 152, kind % 2 ? 76 : 118); g.scale(0.42, 0.42); fxNote(p, kind % 2, "#e8483c"); g.restore();
};
/** a flying book (256 x 192), cover colour by kind, opening angle a */
export const fxBook = (p: Pen, kind: number, a: number) => {
  const cols = ["#e8483c", "#3a64b8", "#f2c43a", "#4f9a6e", "#c95b8a", "#8a5a34"], c = cols[kind % 6];
  const o = 40 * a;
  p.poly([[128, 40], [30 + o, 30 - o * 0.4], [30 + o, 150 - o * 0.2], [128, 160]], c, 8);
  p.poly([[128, 40], [226 - o, 30 - o * 0.4], [226 - o, 150 - o * 0.2], [128, 160]], mul(c, [0.85, 0.85, 0.9]), 8);
  if (a > 0.3) { p.poly([[128, 46], [44 + o, 40 - o * 0.4], [44 + o, 142 - o * 0.2], [128, 152]], "#fbfaf4", 5); for (let i = 0; i < 4; i++) p.stroke([[62 + o, 62 + i * 20], [116, 66 + i * 20]], 4, "#b9b4a8"); }
};
/** a catalogue index card (256 x 160): ruled lines, punch hole, no text */
export const fxCard = (p: Pen, kind: number) => {
  p.poly(rrect(14, 14, 242, 146, 10), kind % 3 === 0 ? "#fff7d6" : "#fbfaf4", 7);
  p.stroke([[30, 46], [226, 46]], 5, "#e8483c");
  for (let i = 0; i < 4; i++) p.stroke([[30, 70 + i * 18], [130 + ((i * 37 + kind * 23) % 90), 70 + i * 18]], 5, "#7a8aa8");
  p.ell(128, 132, 9, 9, "#c9c4b8", 4);
};
/** the accordion (320 x 240): two red end boxes, pleated bellows open by k (0..1) */
export const fxAccordion = (p: Pen, k: number) => {
  const w = 60 + 70 * k, cx = 160;
  p.poly(rrect(cx - w / 2 - 50, 50, cx - w / 2, 200, 10), "#c0353a", 8);
  p.poly(rrect(cx + w / 2, 50, cx + w / 2 + 50, 200, 10), "#c0353a", 8);
  const n = 7, pts: P2[] = [];
  for (let i = 0; i <= n; i++) { const x = cx - w / 2 + (w * i) / n; pts.push([x, i % 2 ? 64 : 56]); }
  for (let i = n; i >= 0; i--) { const x = cx - w / 2 + (w * i) / n; pts.push([x, i % 2 ? 186 : 194]); }
  p.poly(pts, "#2b2630", 6);
  for (let i = 1; i < n; i++) { const x = cx - w / 2 + (w * i) / n; p.stroke([[x, 62], [x, 188]], 4, i % 2 ? "#5a5466" : "#f2c43a"); }
  for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) p.dot(cx + w / 2 + 16 + i * 18, 76 + j * 32, 7, "#fbfaf4");
  p.poly(rrect(cx - w / 2 - 42, 64, cx - w / 2 - 10, 186, 6), "#f4efe6", 5);
};
/** food flying into the truck (192 x 192) */
export const fxFood = (p: Pen, kind: number) => {
  const c = ["#e8483c", "#f2a03a", "#7fbf5a", "#c97a3a", "#f2d24a"][kind % 5];
  if (kind % 3 === 0) { p.ell(96, 104, 70, 18, "#fbfaf4", 6); p.ell(90, 88, 34, 22, c, 6); }
  else if (kind % 3 === 1) { p.ell(96, 96, 44, 44, c, 7); p.ell(84, 78, 12, 8, "rgba(255,255,255,0.6)", 0); }
  else { p.poly([[40, 140], [96, 40], [152, 140]], c, 7); p.ell(96, 132, 50, 14, "#f4dca8", 5); }
};
/** a big red X stamp (256 x 256) */
export const fxCross = (p: Pen) => { p.stroke([[50, 50], [206, 206]], 46, INK); p.stroke([[206, 50], [50, 206]], 46, INK); p.stroke([[50, 50], [206, 206]], 30, "#e8483c"); p.stroke([[206, 50], [50, 206]], 30, "#e8483c"); };
/** loose paper sheet (128 x 160) */
export const fxPaper = (p: Pen, k: number) => { p.poly([[14, 14], [114, 8 + k % 3 * 4], [118, 146], [10, 150]], "#fbfaf4", 6); for (let i = 0; i < 5; i++) p.stroke([[26, 40 + i * 20], [96 - (i * 13 + k * 7) % 30, 40 + i * 20]], 4, "#9aa3b8"); };
/** a music note card (256 x 256) in a colour */
export const fxNoteC = (p: Pen, kind: number, col: string) => { const g = p.g; g.save(); g.translate(20, 10); g.scale(0.95, 0.95); fxNote(p, kind, col); g.restore(); };
