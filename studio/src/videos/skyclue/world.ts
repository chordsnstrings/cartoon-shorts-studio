// One three.js scene with every place of the sky-clue short (river bank + camera pole, desk room, flight map, street),
// the moving parts (planes + contrails, the security-camera head, the desk monitor picture, falling drives, the code
// scroll, map dots, the ambulance), the sky and the light rig; update(id, f, camera) poses everything for shot `id`
// at frame f (pure function of id + f).
import * as THREE from "three";
import { buildRiver, buildDesk, buildMap, buildStreet, lam, glow, cyl, mapDots, PRINTER, LAMP_AT } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { drawScreen, screenKey } from "./screen";
import {
  FPS, SHOTS, camAt, ShotDef, RIV, MAP, ST, DESK, CAM_HEAD, camHeadYaw, camHeadPitch, riverPlanes, mapPlanes, PlaneState, ambX, W,
  MON, MON_YAW, MON_W, MON_H, screenAt, dotPhase, SPOT, drivesN, scrollLen, clamp01, at,
} from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const trailTex = () => ctex("trail", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0.15)"); gr.addColorStop(0.06, "rgba(255,255,255,0.9)"); gr.addColorStop(0.55, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
});
const ambTex = () => ctex("ambSide", 512, 256, (g) => {
  g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#d8443a"; g.fillRect(0, 140, 512, 30);
  g.fillStyle = "#f2c43a"; g.fillRect(0, 172, 512, 10);
  g.fillStyle = "#3a64b8"; g.beginPath(); g.arc(256, 60, 30, 0, 6.283); g.fill(); // plain blue disc (the red cross is a protected emblem: the 2026-11-05 render still has it)
  g.fillStyle = "#4a6aa8"; g.fillRect(380, 30, 110, 70);
});
const paperTex = () => ctex("codePaper", 256, 1024, (g, r) => {
  g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 256, 1024);
  const cols = ["#3a64b8", "#c0353a", "#4f9a6e", "#8a5a34", "#5a5866"];
  for (let y = 14; y < 1024; y += 16) {
    let x = 18 + Math.floor(r() * 4) * 14;
    while (x < 230) { const w = 12 + r() * 48; if (x + w > 238) break; g.fillStyle = cols[Math.floor(r() * 5)]; g.globalAlpha = 0.75; g.fillRect(x, y, w, 6); x += w + 8; }
  }
  g.globalAlpha = 1; g.fillStyle = "rgba(120,140,170,0.35)"; for (let y = 0; y < 1024; y += 128) g.fillRect(0, y, 256, 2);
  g.fillStyle = "#e3e2da"; for (let y = 8; y < 1024; y += 32) { g.beginPath(); g.arc(8, y, 3.5, 0, 6.283); g.arc(248, y, 3.5, 0, 6.283); g.fill(); }
});

/** a cartoon airliner, nose toward +z, ~12 m long at scale 1 */
const makePlane = () => {
  const g = new THREE.Group();
  const body = lam("planeBody", () => ({ color: "#f4f4f2" })), blue = lam("planeBlue", () => ({ color: "#3a64b8" })), grey = lam("planeGrey", () => ({ color: "#9aa3ad" }));
  const win = lam("planeWin", () => ({ color: "#2b3a5a" }));
  for (const m of [body, blue, grey, win]) m.fog = false;
  const fus = new THREE.CylinderGeometry(0.75, 0.75, 9, 18); fus.rotateX(Math.PI / 2);
  const nose = new THREE.SphereGeometry(0.75, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateX(Math.PI / 2); nose.scale(1, 1, 1.6); nose.translate(0, 0, 4.5);
  const tail = new THREE.ConeGeometry(0.75, 3, 18); tail.rotateX(-Math.PI / 2); tail.translate(0, 0.15, -6);
  const stripe = new THREE.CylinderGeometry(0.765, 0.765, 8.6, 18, 1, true, Math.PI * 0.42, Math.PI * 0.16); stripe.rotateX(Math.PI / 2);
  const stripe2 = stripe.clone(); stripe2.rotateZ(Math.PI);
  const wing = new THREE.BufferGeometry();
  const wp = [0, 0, 1.4, 6, 0, -1.6, 6, 0, -2.4, 0, 0, -1.4];
  const mk = (sx: number) => { const q = new THREE.Shape(); q.moveTo(0, 1.4); q.lineTo(sx * 6, -1.5); q.lineTo(sx * 6, -2.3); q.lineTo(0, -1.4); q.closePath(); const e = new THREE.ExtrudeGeometry(q, { depth: 0.16, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, -0.25, 0); return e; };
  void wing; void wp;
  const stab = (sx: number) => { const q = new THREE.Shape(); q.moveTo(0, -4.6); q.lineTo(sx * 2.6, -6.0); q.lineTo(sx * 2.6, -6.5); q.lineTo(0, -6.2); q.closePath(); const e = new THREE.ExtrudeGeometry(q, { depth: 0.1, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, 0.35, 0); return e; };
  const finS = new THREE.Shape(); finS.moveTo(-4.4, 0.5); finS.lineTo(-6.4, 2.9); finS.lineTo(-7.2, 2.9); finS.lineTo(-7.0, 0.5); finS.closePath();
  const fin = new THREE.ExtrudeGeometry(finS, { depth: 0.12, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(-0.06, 0, 0);
  const eng = (sx: number) => { const e = new THREE.CylinderGeometry(0.42, 0.36, 1.6, 14); e.rotateX(Math.PI / 2); e.translate(sx * 2.4, -0.7, 0.6); return e; };
  for (const [geo, m] of [[fus, body], [nose, body], [tail, body], [mk(1), body], [mk(-1), body], [stab(1), body], [stab(-1), body], [fin, blue], [eng(1), grey], [eng(-1), grey], [stripe, blue], [stripe2, blue]] as const) {
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = false; g.add(mesh);
  }
  // cockpit windows
  const cw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5).translate(0, 0.38, 5.0), win); g.add(cw);
  return g;
};

/** the security camera head: housing, hood, lens, glass, LED; lens toward local -z */
const makeCamHead = () => {
  const g = new THREE.Group();
  const white = lam("camWhite", () => ({ color: "#eef0f4" })), dark = lam("camDark", () => ({ color: "#2b2f3a" }));
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.46), white);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.56).translate(0, 0.11, -0.04), white);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20).rotateX(Math.PI / 2).translate(0, -0.005, -0.245), dark);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20).rotateY(Math.PI).translate(0, -0.005, -0.271), glow("camGlass", "#5a8ad8", 1.1));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6).translate(0.07, 0.05, -0.232), glow("camLed", "#ff3a2a", 3));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10).translate(-0.02, -0.14, 0.02), white);
  for (const m of [h, hood, ring, neck]) { m.castShadow = true; m.receiveShadow = true; }
  led.layers.set(NOINK); glass.layers.set(NOINK);
  g.add(h, hood, ring, glass, led, neck);
  return g;
};

const makeAmbulance = () => {
  const g = new THREE.Group();
  const side = lam("ambSideM", () => ({ map: ambTex() })), white = lam("ambWhite", () => ({ color: "#f6f4ee" })), dark = lam("ambDark", () => ({ color: "#2b2f3a" }));
  const glass = lam("ambGlass", () => ({ color: "#4a6aa8" }));
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.3, 2.1).translate(-0.6, 1.55, 0), [side, side, white, white, side, side] as unknown as THREE.Material);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2.0).translate(1.85, 1.15, 0), white);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.7).translate(2.6, 1.55, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0)), glass);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 2.02).translate(1.9, 1.5, 0), glass);
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 2.1).translate(2.65, 0.55, 0), dark);
  g.add(box, cab, ws, sw, bump);
  for (const [x, z] of [[-1.5, 1.0], [-1.5, -1.0], [1.7, 1.0], [1.7, -1.0]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18).rotateX(Math.PI / 2).translate(x, 0.42, z), dark); g.add(w);
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.6).translate(1.0, 2.82, -0.45), glow("ambRed", "#ff3a2a", 3.2));
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.6).translate(1.0, 2.82, 0.45), glow("ambBlue", "#3a7aff", 3.2));
  const redOff = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.6).translate(1.0, 2.82, -0.45), lam("ambRedOff", () => ({ color: "#8a2a2a" })));
  const blueOff = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.6).translate(1.0, 2.82, 0.45), lam("ambBlueOff", () => ({ color: "#2a3a8a" })));
  red.layers.set(NOINK); blue.layers.set(NOINK);
  g.add(red, blue, redOff, blueOff);
  return { g, red, blue, redOff, blueOff };
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private sunDisc: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private planes: { g: THREE.Group; trail: THREE.Mesh }[] = [];
  private camHead: THREE.Group;
  private screen: THREE.Mesh; private screenCv: HTMLCanvasElement; private screenTex: THREE.CanvasTexture; private screenK = "";
  private drives: THREE.InstancedMesh; private driveTargets: [number, number, number, number][] = [];
  private scroll: THREE.Mesh; private scrollSegs = 0;
  private lamp: THREE.Mesh;
  private dots: THREE.InstancedMesh; private dotData: [number, number, number][];
  private spot: THREE.Mesh;
  private amb: ReturnType<typeof makeAmbulance>;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  private q = new THREE.Quaternion(); private e = new THREE.Euler(); private sc = new THREE.Vector3();

  constructor() {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -2; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    this.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(3, 2.9, 2.6) }));
    this.sunDisc.renderOrder = -0.5; this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK);
    R.add(this.sky, this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    // clouds over the river and the street (golden palette swaps in update)
    for (const [cx, n] of [[RIV, 8], [ST, 6]] as const) for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, LOOK.day.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 70 + (i % 3) * 25;
      m.position.set(cx - 190 + i * 52, 80 + (i % 3) * 30, -330 - (i % 2) * 70); m.scale.set(w, w / 2, 1);
      m.userData.cloud = i % 4;
      m.layers.set(NOINK); R.add(m);
    }
    buildRiver(R); buildDesk(R); buildMap(R); buildStreet(R);

    // ---- planes + contrails ----
    const tm = new THREE.MeshBasicMaterial({ map: trailTex(), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const tg = new THREE.CylinderGeometry(0.16, 0.6, 1, 10, 1, true); tg.translate(0, -0.5, 0); tg.rotateX(Math.PI / 2); // from the tail (z 0) back to z -1
    for (let i = 0; i < 20; i++) {
      const g = makePlane(); g.visible = false; R.add(g);
      const trail = new THREE.Mesh(tg, tm.clone()); trail.layers.set(NOINK); trail.visible = false; trail.frustumCulled = false; R.add(trail);
      this.planes.push({ g, trail });
    }
    // ---- security camera head ----
    this.camHead = makeCamHead(); this.camHead.position.set(...CAM_HEAD); R.add(this.camHead);
    // ---- desk monitor picture ----
    this.screenCv = document.createElement("canvas"); this.screenCv.width = 1024; this.screenCv.height = Math.round(1024 * MON_H / MON_W);
    this.screenTex = new THREE.CanvasTexture(this.screenCv); this.screenTex.colorSpace = THREE.SRGBColorSpace; this.screenTex.anisotropy = 8;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(MON_W, MON_H), new THREE.MeshBasicMaterial({ map: this.screenTex, color: new THREE.Color(1.05, 1.05, 1.05) }));
    this.screen.position.set(MON[0] + Math.sin(MON_YAW) * 0.001, MON[1], MON[2] + Math.cos(MON_YAW) * 0.001); this.screen.rotation.y = MON_YAW;
    R.add(this.screen);
    // ---- hard drives raining on the desk ----
    const dg = new THREE.BoxGeometry(0.1, 0.035, 0.14);
    this.drives = new THREE.InstancedMesh(dg, lam("drive", () => ({ color: "#3a3d4a" })), 26);
    this.drives.castShadow = true; this.drives.receiveShadow = true; this.drives.frustumCulled = false; R.add(this.drives);
    for (let i = 0; i < 26; i++) {
      const layer = Math.floor(i / 6), k = i % 6, x = DESK - 0.6 + (k % 3) * 0.12 + (layer % 2) * 0.03, z = -1.32 + Math.floor(k / 3) * 0.16;
      this.driveTargets.push(i < 24 ? [x, 0.75 + 0.0175 + layer * 0.036, z, (i * 0.7) % 0.5 - 0.25] : [DESK - 0.4 + (i - 24) * 0.3, 0.0175, -0.55, 0.8]);
    }
    // ---- the code scroll: a paper strip from the printer over the desk edge, piling on the floor ----
    const pts: THREE.Vector3[] = [];
    const [px, py, pz] = PRINTER;
    pts.push(new THREE.Vector3(px, py + 0.07, pz + 0.18), new THREE.Vector3(px, py + 0.03, pz + 0.3), new THREE.Vector3(px + 0.02, 0.76, -0.7), new THREE.Vector3(px + 0.03, 0.55, -0.64), new THREE.Vector3(px + 0.04, 0.2, -0.6), new THREE.Vector3(px + 0.05, 0.01, -0.5));
    for (let i = 0; i < 9; i++) pts.push(new THREE.Vector3(px + 0.1 + 0.12 * Math.sin(i * 1.3), 0.01 + 0.035 * (i % 2) + 0.004 * i, -0.38 + i * 0.13));
    const curve = new THREE.CatmullRomCurve3(pts);
    const N = 200; this.scrollSegs = N;
    const pos: number[] = [], uv: number[] = [], nor: number[] = [];
    const L = curve.getLength(), half = 0.13;
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), tng = curve.getTangentAt(u);
      const side = new THREE.Vector3(1, 0, 0), n = new THREE.Vector3().crossVectors(side, tng).normalize();
      pos.push(p.x - half, p.y, p.z, p.x + half, p.y, p.z); uv.push(0, (u * L) / 0.5, 1, (u * L) / 0.5); nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
    }
    const idx: number[] = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); sg.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); sg.setIndex(idx);
    const ptex = paperTex(); ptex.wrapT = THREE.RepeatWrapping;
    this.scroll = new THREE.Mesh(sg, lam("paper", () => ({ map: ptex, side: THREE.DoubleSide })));
    this.scroll.castShadow = true; this.scroll.receiveShadow = true; this.scroll.frustumCulled = false; R.add(this.scroll);
    // ---- desk lamp bulb ----
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glow("lampOn", "#ffe2a0", 3));
    this.lamp.position.set(...LAMP_AT); this.lamp.layers.set(NOINK); R.add(this.lamp);
    const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 16, 1, true).translate(0, 0.03, 0), lam("lampShade", () => ({ color: "#3a64b8", side: THREE.DoubleSide })));
    shadeM.position.set(LAMP_AT[0], LAMP_AT[1] + 0.02, LAMP_AT[2]); shadeM.castShadow = true; R.add(shadeM);
    // ---- map dots (deterministic points inside the outline; dot 0 = the hero spot) ----
    this.dotData = mapDots(5000, [SPOT[0] - MAP, SPOT[2]]);
    const cg = new THREE.CircleGeometry(0.42, 10); cg.rotateX(-Math.PI / 2);
    this.dots = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.95, 0.3), fog: false }), this.dotData.length);
    this.dots.frustumCulled = false; this.dots.layers.set(NOINK); R.add(this.dots);
    this.spot = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), glow("spotGlow", "#ff5a3a", 1.4));
    this.spot.position.set(SPOT[0], 0.25, SPOT[2]); this.spot.layers.set(NOINK); R.add(this.spot);
    // ---- ambulance ----
    this.amb = makeAmbulance(); this.amb.g.position.set(ST, 0, -2.2); R.add(this.amb.g);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  private posePlanes(list: PlaneState[], map: boolean) {
    let i = 0;
    for (const p of list) {
      if (!p.vis || i >= this.planes.length) continue;
      const { g, trail } = this.planes[i++];
      g.visible = true; g.position.set(...p.p); g.rotation.set(0, p.yaw, map ? 0 : 0.04); g.scale.setScalar(p.s);
      trail.visible = true;
      const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(-6.6 * p.s);
      trail.position.set(p.p[0] + back.x, p.p[1] + 0.1 * p.s, p.p[2] + back.z); trail.rotation.set(0, p.yaw, 0);
      trail.scale.set(p.s * (map ? 0.5 : 1.3), p.s * (map ? 0.5 : 1.3), p.trail);
      const tm = trail.material as THREE.MeshBasicMaterial;
      if (map) tm.color.setRGB(0.6, 1.4, 1.6); else tm.color.setRGB(1, 1, 1);
      tm.opacity = map ? 0.9 : 0.75;
    }
    for (; i < this.planes.length; i++) { this.planes[i].g.visible = false; this.planes[i].trail.visible = false; }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.place === "desk" ? 0.02 : 0.05; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const big = s.place === "map" ? 160 : s.place === "river" ? 40 : s.place === "street" ? 25 : 6;
    const Rr = THREE.MathUtils.clamp(dist * 1.3 + 2.5, 3, big);
    this.sun.position.copy(focus).addScaledVector(sunDir, s.place === "map" ? 300 : 120); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = s.place === "map" ? 700 : 260; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * Math.max(1, Rr / 6);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    const showSun = s.light === "golden";
    this.sunDisc.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 950);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(120, 120, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(3.0, 2.2, 1.4);
    }
    for (const o of this.root.children) if (o.userData.cloud !== undefined) {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const want = cloudHD(o.userData.cloud, s.light === "golden" ? LOOK.golden.cloud : LOOK.day.cloud);
      if (m.map !== want) { m.map = want; m.needsUpdate = true; }
    }
    untone(L.fog, this.fog.color);
    if (s.place === "map") { this.fog.near = 500; this.fog.far = 1500; } else { this.fog.near = L.fogNear; this.fog.far = L.fogFar; }
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    if (s.place === "river") this.posePlanes(riverPlanes(t), false);
    else if (s.place === "map") this.posePlanes(mapPlanes(t, id), true);
    else this.posePlanes([], false);
    this.camHead.rotation.set(camHeadPitch(t), camHeadYaw(t), 0, "YXZ");
    // monitor picture (redrawn only when its state key changes)
    const scr = screenAt(id, t), key = screenKey(scr, t);
    if (key !== this.screenK) { drawScreen(this.screenCv.getContext("2d")!, this.screenCv.width, this.screenCv.height, scr, t); this.screenTex.needsUpdate = true; this.screenK = key; }
    // drives: each falls from above the frame onto its stack spot, a little bounce
    const nD = drivesN(t);
    for (let i = 0; i < 26; i++) {
      const [x, y, z, r] = this.driveTargets[i], t0 = W.gigabytes - 0.25 + i / 18, d = t - t0;
      if (d < 0 || id < 6 || (id !== 6 && id !== 12)) { this.m4.makeScale(0, 0, 0); this.drives.setMatrixAt(i, this.m4); continue; }
      const fall = 0.45, yy = d < fall ? y + (2.9 - y) * (1 - (d / fall) ** 2) : y + 0.04 * Math.max(0, Math.sin((d - fall) * 18)) * Math.exp(-(d - fall) * 9);
      const spin = d < fall ? (1 - d / fall) * 3 * (i % 2 ? 1 : -1) : 0;
      this.e.set(spin * 0.5, r + spin, spin * 0.3); this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(x, yy, z), this.q, this.sc.set(1, 1, 1)); this.drives.setMatrixAt(i, this.m4);
    }
    void nD;
    this.drives.instanceMatrix.needsUpdate = true;
    const sl = id === 6 || id === 12 ? scrollLen(t) : 0;
    this.scroll.visible = sl > 0.001;
    this.scroll.geometry.setDrawRange(0, Math.floor(this.scrollSegs * sl) * 6);
    this.lamp.visible = s.place === "desk";
    // map dots
    const showDots = s.place === "map" && id !== 16 && id >= 7;
    this.dots.visible = showDots; this.spot.visible = s.place === "map" && at(t, W.one) && id === 10;
    if (showDots) {
      const P = dotPhase(t);
      this.dotData.forEach(([x, z, h], i) => {
        let k = 0;
        const w = (x + 110) / 220; // west -> east wave
        const a = clamp01((P.appear * 1.5 - w * 0.5 - h * 0.15) / 0.25);
        k = a < 1 ? a * (1 + 0.6 * Math.sin(a * Math.PI)) : 1;
        const survivor = i === 0 || h < 0.2;
        if (!survivor) k *= clamp01((P.keep - 0.2) / 0.8);
        if (P.one && i !== 0) k = 0;
        if (P.one && i === 0) k = 0;
        this.m4.compose(this.v.set(MAP + x, 0.2 + h * 0.02, z), this.q.identity(), this.sc.set(k, 1, k));
        this.dots.setMatrixAt(i, this.m4);
      });
      this.dots.instanceMatrix.needsUpdate = true;
    }
    if (this.spot.visible) { const u = t - W.one; const k = 0.8 + 0.15 * Math.sin(t * 12) + Math.max(0, 1.0 - u * 5); this.spot.scale.set(k, 1, k); }
    // ambulance + blinking light bar
    this.amb.g.visible = s.place === "street";
    this.amb.g.position.x = ambX(t);
    const blink = Math.floor(t * 8) % 2 === 0;
    this.amb.red.visible = blink; this.amb.redOff.visible = !blink; this.amb.blue.visible = !blink; this.amb.blueOff.visible = blink;

    // ---- cast + effects ----
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of stg.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 2.5 * sc2 + 0.3))) continue;
      const ac = this.actor(ai++);
      const [w, hh, k] = p.size ?? [300, 500, 0.5];
      ac.r = this.pool.req(p.key, w, hh, k, p.draw);
      ac.mesh.visible = true;
      ac.mesh.position.set(p.x, p.y, p.z);
      ac.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      ac.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      ac.mesh.castShadow = L.actorShadow;
      used.push(ac);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stg.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const ac of used) ac.bind();
    for (const ef of fused) ef.bind();
    void DESK;
    return focus;
  }
}
