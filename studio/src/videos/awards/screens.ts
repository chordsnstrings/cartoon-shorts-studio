// Painted pictures for the awards short's screens (no text anywhere): the AI singer's robot face on the big screen
// (singing / idle / winning), the movie trailer (a tall picture of a figure in a long coat, tilted up by texture
// offset), colour bars, a dark screen, and the stone tower reporter's face (talking / straining / calm).
import * as THREE from "three";
import { ctex } from "./paint";

const INK = "#241726";
type G = CanvasRenderingContext2D;
const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
const star = (g: G, cx: number, cy: number, R: number, col: string) => {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
};
const note = (g: G, cx: number, cy: number, s: number, col: string) => {
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 6;
  g.beginPath(); g.ellipse(cx, cy, 26 * s, 19 * s, -0.35, 0, 6.283); g.fill(); g.stroke();
  g.fillRect(cx + 18 * s, cy - 85 * s, 11 * s, 85 * s); g.strokeRect(cx + 18 * s, cy - 85 * s, 11 * s, 85 * s);
  g.beginPath(); g.moveTo(cx + 29 * s, cy - 85 * s); g.lineTo(cx + 66 * s, cy - 62 * s); g.lineTo(cx + 66 * s, cy - 44 * s); g.lineTo(cx + 29 * s, cy - 64 * s); g.closePath(); g.fill(); g.stroke();
};

/** the AI singer: a friendly robot head with headphones on a stage-glow background. mode: 0 idle, 1 singing, 2 winning */
export const botTex = (mode: 0 | 1 | 2) => ctex(`bot${mode}`, 1024, 576, (g) => {
  const gr = g.createRadialGradient(512, 300, 40, 512, 300, 620); gr.addColorStop(0, mode === 2 ? "#ff8ad8" : "#7a5ae0"); gr.addColorStop(1, "#1e1450");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 576);
  for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.arc((i * 173) % 1024, (i * 97) % 576, 8 + (i % 4) * 6, 0, 6.283); g.fill(); }
  // spotlight beams
  g.fillStyle = "rgba(255,240,200,0.10)";
  for (const x of [180, 840]) { g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 30, 0); g.lineTo(x + 200 * Math.sign(512 - x) + 120, 576); g.lineTo(x + 200 * Math.sign(512 - x) - 120, 576); g.closePath(); g.fill(); }
  // shoulders
  g.fillStyle = "#e8ecf4"; g.strokeStyle = INK; g.lineWidth = 12;
  rr(g, 300, 470, 424, 160, 70); g.fill(); g.stroke();
  // neck
  g.fillStyle = "#9aa3b8"; g.fillRect(470, 420, 84, 60); g.strokeRect(470, 420, 84, 60);
  // antenna
  g.beginPath(); g.moveTo(512, 120); g.lineTo(512, 70); g.stroke();
  g.fillStyle = mode === 2 ? "#ffd84a" : "#ff6ad5"; g.beginPath(); g.arc(512, 60, 20, 0, 6.283); g.fill(); g.stroke();
  // head
  g.fillStyle = "#f4f6fb"; rr(g, 340, 118, 344, 310, 90); g.fill(); g.stroke();
  // headphones
  g.strokeStyle = INK; g.lineWidth = 34; g.beginPath(); g.arc(512, 270, 200, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.strokeStyle = "#ff6ad5"; g.lineWidth = 18; g.beginPath(); g.arc(512, 270, 200, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.lineWidth = 12; g.strokeStyle = INK;
  for (const x of [318, 706]) { g.fillStyle = "#ff6ad5"; rr(g, x - 40, 210, 80, 130, 34); g.fill(); g.stroke(); }
  // visor
  g.fillStyle = "#1a1f3a"; rr(g, 380, 175, 264, 150, 60); g.fill(); g.stroke();
  // eyes
  g.fillStyle = "#7ff6ff"; g.strokeStyle = "#7ff6ff"; g.lineWidth = 18; g.lineCap = "round";
  if (mode === 2) { for (const x of [455, 569]) { g.beginPath(); g.arc(x, 262, 30, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
  else if (mode === 1) { for (const x of [455, 569]) { g.beginPath(); g.arc(x, 250, 30, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); } }
  else { for (const x of [455, 569]) { g.beginPath(); g.arc(x, 250, 26, 0, 6.283); g.fill(); } }
  // mouth
  g.lineCap = "butt";
  if (mode === 0) { g.strokeStyle = INK; g.lineWidth = 12; g.beginPath(); g.arc(512, 350, 34, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
  else { g.fillStyle = INK; g.beginPath(); g.ellipse(512, 372, 40, mode === 1 ? 34 : 26, 0, 0, 6.283); g.fill(); g.fillStyle = "#ff6a8a"; g.beginPath(); g.ellipse(512, 388, 22, 12, 0, 0, 6.283); g.fill(); }
  // notes / stars around
  if (mode === 1) { note(g, 190, 260, 1.4, "#ffd84a"); note(g, 820, 210, 1.2, "#7ff6ff"); note(g, 860, 420, 1.0, "#ffffff"); note(g, 150, 450, 1.0, "#7ff6ff"); }
  if (mode === 2) { star(g, 170, 170, 56, "#ffd84a"); star(g, 860, 150, 48, "#ffd84a"); star(g, 120, 420, 40, "#ffffff"); star(g, 900, 410, 44, "#ffffff"); }
});

/** the trailer: a tall picture (1024 x 1440) of a figure in a long coat at dusk, shown through a window 40 % tall */
export const trailerTex = () => {
  const t = ctex("trailer", 1024, 1440, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 1440); gr.addColorStop(0, "#2a2050"); gr.addColorStop(0.55, "#c85a5a"); gr.addColorStop(1, "#f2a24a");
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1440);
    // city skyline far behind
    g.fillStyle = "#4a2a4a";
    for (let i = 0; i < 12; i++) { const h = 260 + ((i * 131) % 360); g.fillRect(i * 90 - 20, 1440 - h, 80, h); }
    g.fillStyle = "#3a2236"; g.fillRect(0, 1360, 1024, 80);
    g.strokeStyle = INK; g.lineWidth = 14; g.lineJoin = "round";
    // shoes
    g.fillStyle = "#1e1a24";
    g.beginPath(); g.ellipse(430, 1370, 70, 30, 0, 0, 6.283); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(600, 1370, 70, 30, 0, 0, 6.283); g.fill(); g.stroke();
    // legs
    g.fillStyle = "#2e2a40"; g.fillRect(400, 1060, 70, 300); g.strokeRect(400, 1060, 70, 300); g.fillRect(560, 1060, 70, 300); g.strokeRect(560, 1060, 70, 300);
    // long coat
    g.fillStyle = "#8a5a3a";
    g.beginPath(); g.moveTo(370, 520); g.lineTo(660, 520); g.lineTo(720, 1110); g.lineTo(310, 1110); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(515, 560); g.lineTo(515, 1100); g.stroke();
    for (let i = 0; i < 4; i++) { g.fillStyle = "#e0b040"; g.beginPath(); g.arc(545, 640 + i * 110, 14, 0, 6.283); g.fill(); g.stroke(); }
    // belt
    g.fillStyle = "#3a2420"; g.fillRect(345, 800, 340, 44); g.strokeRect(345, 800, 340, 44);
    // arms
    g.fillStyle = "#7a4e32";
    g.beginPath(); g.moveTo(370, 540); g.lineTo(300, 900); g.lineTo(350, 910); g.lineTo(410, 600); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(660, 540); g.lineTo(730, 900); g.lineTo(680, 910); g.lineTo(620, 600); g.closePath(); g.fill(); g.stroke();
    // scarf + collar up to the chin
    g.fillStyle = "#e8483c"; g.beginPath(); g.moveTo(420, 450); g.lineTo(610, 450); g.lineTo(640, 540); g.lineTo(390, 540); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(570, 520); g.lineTo(600, 700); g.lineTo(550, 700); g.lineTo(530, 530); g.closePath(); g.fill(); g.stroke();
    // chin (the frame stops here) and the rest of the face, never shown
    g.fillStyle = "#e8b48a"; g.beginPath(); g.ellipse(515, 340, 120, 140, 0, 0, 6.283); g.fill(); g.stroke();
  });
  t.repeat.set(1, 0.4); t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};
/** colour bars (no text): the trailer cut off */
export const barsTex = () => ctex("bars", 1024, 576, (g) => {
  const c = ["#e8e8e8", "#e8e030", "#30e0e0", "#30d040", "#e030d0", "#e03030", "#3040e0"];
  c.forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 1024) / 7, 0, 1024 / 7 + 1, 400); });
  const c2 = ["#3040e0", "#1a1a1a", "#e030d0", "#1a1a1a", "#30e0e0", "#1a1a1a", "#e8e8e8"];
  c2.forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 1024) / 7, 400, 1024 / 7 + 1, 50); });
  g.fillStyle = "#101018"; g.fillRect(0, 450, 1024, 126);
});
export const darkTex = () => ctex("darkScr", 256, 144, (g) => { g.fillStyle = "#14101e"; g.fillRect(0, 0, 256, 144); });

/** the stone tower's face screen (512 x 384): cyan line face on a dark glass */
export const towerTex = (k: "talk0" | "talk1" | "strain" | "calm") => ctex(`tower_${k}`, 512, 384, (g) => {
  g.fillStyle = "#16203a"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#7ff6ff"; g.fillStyle = "#7ff6ff"; g.lineWidth = 22; g.lineCap = "round"; g.lineJoin = "round";
  if (k === "strain") {
    // squeezed eyes > <, gritted wavy mouth, sweat drop
    g.beginPath(); g.moveTo(130, 120); g.lineTo(190, 150); g.lineTo(130, 180); g.stroke();
    g.beginPath(); g.moveTo(382, 120); g.lineTo(322, 150); g.lineTo(382, 180); g.stroke();
    g.beginPath(); g.moveTo(170, 270); for (let i = 1; i <= 6; i++) g.lineTo(170 + i * 29, 270 + (i % 2 ? -16 : 16)); g.stroke();
    g.fillStyle = "#9ad8ff"; g.beginPath(); g.moveTo(440, 60); g.quadraticCurveTo(470, 110, 455, 130); g.arc(440, 120, 18, 0.3, Math.PI - 0.3); g.closePath(); g.fill();
  } else {
    for (const x of [170, 342]) { g.beginPath(); g.arc(x, 150, 30, 0, 6.283); g.fill(); }
    if (k === "calm") { g.beginPath(); g.arc(256, 230, 70, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
    else { g.beginPath(); g.ellipse(256, 270, 60, k === "talk1" ? 48 : 18, 0, 0, 6.283); g.fill(); }
  }
  g.strokeStyle = "#2a3a5e"; g.lineWidth = 10; g.strokeRect(5, 5, 502, 374);
});

/** faux stone blocks for the tower (cream white) */
export const stoneTex = () => ctex("fauxStone", 512, 512, (g) => {
  g.fillStyle = "#f2efe8"; g.fillRect(0, 0, 512, 512);
  const rows = 6, h = 512 / rows;
  g.strokeStyle = "rgba(90,80,90,0.55)"; g.lineWidth = 5;
  for (let r = 0; r < rows; r++) {
    g.beginPath(); g.moveTo(0, r * h); g.lineTo(512, r * h); g.stroke();
    const off = (r % 2) * 128;
    for (let x = off; x < 512 + 256; x += 256) { g.beginPath(); g.moveTo(x % 512, r * h); g.lineTo(x % 512, (r + 1) * h); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(160,150,140,0.10)"; g.beginPath(); g.ellipse(((i * 97 + r * 53) % 512), r * h + h / 2, 30, 12, 0, 0, 6.283); g.fill(); }
  }
});
