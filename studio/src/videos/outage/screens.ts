// Painted pictures for the outage short's screens (no text, no logos anywhere): the store's wall screen (calm hero
// wallpaper, glitch, dark, loading spinner, an all-green status board), the little display phones (on / off), the card
// reader (waiting / red cross), the register (on / off) and the office monitor (update arrows + progress bar / error).
import { ctex } from "./paint";

const INK = "#241726";
type G = CanvasRenderingContext2D;
const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};

/** calm hero wallpaper: soft colour waves (1024 x 576) */
export const heroTex = () => ctex("wallHero", 1024, 576, (g) => {
  const gr = g.createLinearGradient(0, 0, 1024, 576); gr.addColorStop(0, "#5ad0ff"); gr.addColorStop(0.5, "#8a6aff"); gr.addColorStop(1, "#ff7ac8");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 576);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = `rgba(255,255,255,${0.12 + i * 0.05})`; g.beginPath(); g.moveTo(0, 576);
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 330 + i * 60 + 50 * Math.sin(x / 150 + i * 1.3));
    g.lineTo(1024, 576); g.closePath(); g.fill();
  }
});
/** glitch: torn colour blocks and scan bands (k variant) */
export const glitchTex = (k: number) => ctex(`wallGlitch${k}`, 1024, 576, (g) => {
  g.fillStyle = "#1a1530"; g.fillRect(0, 0, 1024, 576);
  const cols = ["#5ad0ff", "#8a6aff", "#ff7ac8", "#ffffff", "#2a2450"];
  for (let i = 0; i < 18; i++) {
    const y = ((i * 97 + k * 131) % 560), h = 12 + ((i * 37 + k * 17) % 50), x = ((i * 173 + k * 59) % 400) - 100;
    g.fillStyle = cols[(i + k) % cols.length]; g.fillRect(x, y, 500 + ((i * 71) % 600), h);
  }
});
export const darkTex = () => ctex("darkScr", 256, 144, (g) => { g.fillStyle = "#14101e"; g.fillRect(0, 0, 256, 144); });
/** loading spinner on a pale screen, step k (0..7) of the bright dot */
export const spinTex = (k: number) => ctex(`wallSpin${k}`, 1024, 576, (g) => {
  g.fillStyle = "#eef1f8"; g.fillRect(0, 0, 1024, 576);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, d = (i - k + 8) % 8, x = 512 + 120 * Math.cos(a), y = 288 + 120 * Math.sin(a);
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, 34, 0, 6.283); g.fill();
    g.fillStyle = d === 0 ? "#3a64b8" : d === 7 ? "#7f9ad8" : d === 6 ? "#b7c4e6" : "#d6dcea"; g.beginPath(); g.arc(x, y, 26, 0, 6.283); g.fill();
  }
});
/** status board: rows of green dots + grey bars (no words), everything "fine" */
export const statusTex = () => ctex("wallStatus", 1024, 576, (g) => {
  g.fillStyle = "#f6f8fb"; g.fillRect(0, 0, 1024, 576);
  g.fillStyle = "#3a64b8"; g.fillRect(0, 0, 1024, 70);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) {
    const x = 70 + c * 480, y = 110 + r * 76;
    g.fillStyle = INK; g.beginPath(); g.arc(x, y + 22, 28, 0, 6.283); g.fill();
    g.fillStyle = "#3fd16a"; g.beginPath(); g.arc(x, y + 22, 21, 0, 6.283); g.fill();
    g.strokeStyle = "#ffffff"; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(x - 10, y + 23); g.lineTo(x - 2, y + 31); g.lineTo(x + 12, y + 13); g.stroke();
    g.fillStyle = "#c9d0dc"; rr(g, x + 50, y + 10, 300 - ((r * 53 + c * 31) % 120), 24, 12); g.fill();
  }
});
/** little display phone face: on (bright wallpaper) / off */
export const phoneOnTex = () => ctex("phoneOn", 128, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 128, 256); gr.addColorStop(0, "#5ad0ff"); gr.addColorStop(0.55, "#8a6aff"); gr.addColorStop(1, "#ff7ac8");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = "rgba(255,255,255,0.75)"; rr(g, 14 + c * 38, 30 + r * 44, 26, 26, 7); g.fill(); }
});
export const phoneOffTex = () => ctex("phoneOff", 128, 256, (g) => { g.fillStyle = "#16131f"; g.fillRect(0, 0, 128, 256); });
/** card reader face: waiting (contactless waves) or a red cross */
export const readerTex = (k: "ok" | "no" | "dark") => ctex(`reader_${k}`, 256, 256, (g) => {
  g.fillStyle = k === "no" ? "#ffe2e0" : k === "dark" ? "#16131f" : "#eef7ff"; g.fillRect(0, 0, 256, 256);
  if (k === "dark") return;
  g.lineCap = "round";
  if (k === "ok") {
    for (const r of [40, 70, 100]) { g.strokeStyle = "#3a64b8"; g.lineWidth = 16; g.beginPath(); g.arc(70, 128, r, -0.7, 0.7); g.stroke(); }
  } else {
    g.fillStyle = INK; g.beginPath(); g.arc(128, 128, 96, 0, 6.283); g.fill();
    g.fillStyle = "#e8483c"; g.beginPath(); g.arc(128, 128, 84, 0, 6.283); g.fill();
    g.strokeStyle = "#ffffff"; g.lineWidth = 26; g.beginPath(); g.moveTo(88, 88); g.lineTo(168, 168); g.moveTo(168, 88); g.lineTo(88, 168); g.stroke();
  }
});
/** register screen: tiles on (a till grid) / off */
export const registerTex = (on: boolean) => ctex(`register_${on}`, 384, 256, (g) => {
  g.fillStyle = on ? "#f2f5fa" : "#16131f"; g.fillRect(0, 0, 384, 256);
  if (!on) return;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.fillStyle = ["#5ad0ff", "#8a6aff", "#3fd16a", "#ffd84a"][(r + c) % 4]; rr(g, 20 + c * 90, 30 + r * 72, 74, 56, 10); g.fill(); }
});
/** office monitor: two circling update arrows + a progress bar (step 0..10) or a big red error triangle */
export const monitorTex = (k: number | "err") => ctex(`monitor_${k}`, 768, 448, (g) => {
  if (k === "err") {
    g.fillStyle = "#3a1626"; g.fillRect(0, 0, 768, 448);
    g.fillStyle = INK; g.beginPath(); g.moveTo(384, 50); g.lineTo(590, 390); g.lineTo(178, 390); g.closePath(); g.fill();
    g.fillStyle = "#ffd23c"; g.beginPath(); g.moveTo(384, 82); g.lineTo(560, 372); g.lineTo(208, 372); g.closePath(); g.fill();
    g.fillStyle = INK; rr(g, 366, 170, 36, 120, 16); g.fill(); g.beginPath(); g.arc(384, 330, 22, 0, 6.283); g.fill();
    return;
  }
  g.fillStyle = "#1e2a4a"; g.fillRect(0, 0, 768, 448);
  // two circling arrows
  g.strokeStyle = "#7ff6ff"; g.lineWidth = 28; g.lineCap = "butt";
  const cx = 384, cy = 180, R = 100, rot = (k as number) * 0.5;
  for (const a0 of [0, Math.PI]) {
    g.beginPath(); g.arc(cx, cy, R, a0 + rot, a0 + rot + 2.3); g.stroke();
    const a = a0 + rot + 2.3, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a);
    g.fillStyle = "#7ff6ff"; g.beginPath(); g.moveTo(x + 34 * Math.cos(a), y + 34 * Math.sin(a)); g.lineTo(x - 34 * Math.cos(a), y - 34 * Math.sin(a)); g.lineTo(x + 40 * tx, y + 40 * ty); g.closePath(); g.fill();
  }
  // progress bar
  g.fillStyle = "#0e1428"; rr(g, 104, 340, 560, 50, 25); g.fill();
  g.fillStyle = "#3fd16a"; rr(g, 110, 346, Math.max(40, 548 * (k as number) / 10), 38, 19); g.fill();
});
/** server rack front: rows of LEDs, green (blink variant) or all red */
export const rackTex = (k: "g0" | "g1" | "red") => ctex(`rack_${k}`, 256, 512, (g) => {
  g.fillStyle = "#23262f"; g.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 10; r++) {
    const y = 20 + r * 49;
    g.fillStyle = "#30343f"; g.fillRect(14, y, 228, 38); g.strokeStyle = "#15171d"; g.lineWidth = 4; g.strokeRect(14, y, 228, 38);
    for (let i = 0; i < 4; i++) {
      const on = k === "red" ? true : ((r * 3 + i + (k === "g1" ? 1 : 0)) % 3) !== 0;
      g.fillStyle = k === "red" ? "#ff4a3a" : on ? "#5aff7a" : "#2c6a3a"; g.beginPath(); g.arc(160 + i * 20, y + 19, 6, 0, 6.283); g.fill();
    }
    g.fillStyle = "#15171d"; for (let i = 0; i < 6; i++) g.fillRect(28 + i * 18, y + 10, 8, 18);
  }
});
