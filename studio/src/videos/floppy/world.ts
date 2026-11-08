// One three.js scene with every place of the floppy-disk short (airport, control room, US map, highway), the moving parts
// (airliners + map planes with trails, the 435 site dots, the pickup truck, the hero CRT picture, the side terminals, the
// floppy and the drive light), the sky and the light rig; update(id, f, camera) poses everything for shot `id` at frame f
// (pure function of id + f).
import * as THREE from "three";
import { buildAirport, buildDesk, buildMap, buildStreet, makeTruck, mapDots, lam, glow } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { drawScreen, screenKey, drawRadar } from "./screen";
import {
  FPS, SHOTS, camAt, ShotDef, AIR, MAP, W, MON, MON_YAW, MON_W, MON_H, TERMS, DRIVE, screenAt, insertK, termOn, airPlanes, mapPlanes,
  PlaneState, sitesK, truckX, TRUCK_Z, at,
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
/** the top face of a 3.5-inch floppy: navy shell, metal shutter at the leading edge, blank white label, write-protect notch */
export const floppyTex = () => ctex("floppyTop", 256, 256, (g) => {
  g.fillStyle = "#24305a"; g.beginPath(); g.moveTo(10, 10); g.lineTo(230, 10); g.lineTo(246, 26); g.lineTo(246, 246); g.lineTo(10, 246); g.closePath(); g.fill();
  g.fillStyle = "#c9ced8"; g.fillRect(64, 10, 128, 92); g.fillStyle = "#2b2f3a"; g.fillRect(150, 24, 26, 64); g.fillStyle = "#e9ecf2"; g.fillRect(70, 14, 20, 84);
  g.fillStyle = "#fbfaf4"; g.fillRect(40, 130, 176, 116); g.fillStyle = "#e8483c"; g.fillRect(40, 130, 176, 14); g.fillStyle = "#c9ced8"; for (let i = 0; i < 4; i++) g.fillRect(56, 162 + i * 20, 120 - i * 14, 6);
  g.fillStyle = "#11162a"; g.fillRect(18, 220, 14, 14);
  g.strokeStyle = "#141a30"; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 10); g.lineTo(230, 10); g.lineTo(246, 26); g.lineTo(246, 246); g.lineTo(10, 246); g.closePath(); g.stroke();
});

/** a cartoon airliner, nose toward +z, ~12 m long at scale 1, with landing gear; wheels at y -1.25 */
const makePlane = () => {
  const g = new THREE.Group();
  const body = lam("planeBody", () => ({ color: "#f4f4f2" })), blue = lam("planeBlue", () => ({ color: "#2fa39a" })), grey = lam("planeGrey", () => ({ color: "#9aa3ad" }));
  const win = lam("planeWin", () => ({ color: "#2b3a5a" })), tyre = lam("tyre", () => ({ color: "#2b2f3a" })), belly = lam("planeBelly", () => ({ color: "#3a64b8" }));
  const fus = new THREE.CylinderGeometry(0.75, 0.75, 9, 18); fus.rotateX(Math.PI / 2);
  const nose = new THREE.SphereGeometry(0.75, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateX(Math.PI / 2); nose.scale(1, 1, 1.6); nose.translate(0, 0, 4.5);
  const tail = new THREE.ConeGeometry(0.75, 3, 18); tail.rotateX(-Math.PI / 2); tail.translate(0, 0.15, -6);
  const stripe = new THREE.CylinderGeometry(0.765, 0.765, 8.6, 18, 1, true, Math.PI * 0.42, Math.PI * 0.16); stripe.rotateX(Math.PI / 2);
  const stripe2 = stripe.clone(); stripe2.rotateZ(Math.PI);
  const bel = new THREE.CylinderGeometry(0.762, 0.762, 8.8, 18, 1, true, Math.PI * 0.75, Math.PI * 0.5); bel.rotateX(Math.PI / 2);
  const mk = (sx: number) => { const q = new THREE.Shape(); q.moveTo(0, 1.4); q.lineTo(sx * 6, -1.5); q.lineTo(sx * 6, -2.3); q.lineTo(0, -1.4); q.closePath(); const e = new THREE.ExtrudeGeometry(q, { depth: 0.16, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, -0.25, 0); return e; };
  const stab = (sx: number) => { const q = new THREE.Shape(); q.moveTo(0, -4.6); q.lineTo(sx * 2.6, -6.0); q.lineTo(sx * 2.6, -6.5); q.lineTo(0, -6.2); q.closePath(); const e = new THREE.ExtrudeGeometry(q, { depth: 0.1, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, 0.35, 0); return e; };
  const finS = new THREE.Shape(); finS.moveTo(-4.4, 0.5); finS.lineTo(-6.4, 2.9); finS.lineTo(-7.2, 2.9); finS.lineTo(-7.0, 0.5); finS.closePath();
  const fin = new THREE.ExtrudeGeometry(finS, { depth: 0.12, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(-0.06, 0, 0);
  const eng = (sx: number) => { const e = new THREE.CylinderGeometry(0.42, 0.36, 1.6, 14); e.rotateX(Math.PI / 2); e.translate(sx * 2.4, -0.7, 0.6); return e; };
  const leg = (x: number, z: number) => { const e = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8); e.translate(x, -0.85, z); return e; };
  const whl = (x: number, z: number) => { const e = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12); e.rotateZ(Math.PI / 2); e.translate(x, -1.08, z); return e; };
  for (const [geo, m] of [[fus, body], [nose, body], [tail, body], [mk(1), body], [mk(-1), body], [stab(1), body], [stab(-1), body], [fin, blue], [eng(1), grey], [eng(-1), grey], [stripe, blue], [stripe2, blue], [bel, belly],
    [leg(0, 3.6), grey], [leg(0.7, -0.6), grey], [leg(-0.7, -0.6), grey], [whl(0, 3.6), tyre], [whl(0.7, -0.6), tyre], [whl(-0.7, -0.6), tyre]] as const) {
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  }
  const cw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5).translate(0, 0.38, 5.0), win); g.add(cw);
  // a row of cabin windows on both sides
  const wg = new THREE.BoxGeometry(0.04, 0.16, 0.2);
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) { const m = new THREE.Mesh(wg, win); m.position.set(s * 0.74, 0.22, 3.4 - i * 0.55); g.add(m); }
  return g;
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
  private screen: THREE.Mesh; private screenCv: HTMLCanvasElement; private screenTex: THREE.CanvasTexture; private screenK = "";
  private terms: { m: THREE.Mesh; on: THREE.Material; off: THREE.Material }[] = [];
  private led: THREE.Mesh; private ledOn: THREE.Material; private ledOff: THREE.Material;
  private floppy: THREE.Mesh;
  private planes: { g: THREE.Group; trail: THREE.Mesh }[] = [];
  private dots: THREE.InstancedMesh; private dotData: [number, number, number][];
  private truck: { g: THREE.Group; wheels: THREE.Mesh[] };
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  private q = new THREE.Quaternion(); private sc = new THREE.Vector3();

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
    // clouds: a far ring for the ground shots, and a layer around the cruising airliner (shot 4)
    const cloud = (i: number, x: number, y: number, z: number, w: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, LOOK.day.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(x, y, z); m.scale.set(w, w / 2, 1); m.userData.cloud = i % 4; m.layers.set(NOINK); R.add(m);
    };
    for (let i = 0; i < 8; i++) cloud(i, AIR - 190 + i * 52, 70 + (i % 3) * 30, -330 - (i % 2) * 70, 70 + (i % 3) * 25);
    for (let i = 0; i < 10; i++) cloud(i + 1, AIR - 140 + i * 30, 112 + (i % 3) * 9, -70 - (i % 4) * 32, 40 + (i % 3) * 14);
    for (let i = 0; i < 5; i++) cloud(i + 2, AIR - 90 + i * 45, 175 + (i % 2) * 14, -150 - (i % 2) * 40, 50);
    buildAirport(R); buildDesk(R); buildMap(R); buildStreet(R);
    // ---- the hero CRT picture ----
    this.screenCv = document.createElement("canvas"); this.screenCv.width = 1024; this.screenCv.height = Math.round(1024 * MON_H / MON_W);
    this.screenTex = new THREE.CanvasTexture(this.screenCv); this.screenTex.colorSpace = THREE.SRGBColorSpace; this.screenTex.anisotropy = 8;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(MON_W, MON_H), new THREE.MeshBasicMaterial({ map: this.screenTex, color: new THREE.Color(1.05, 1.05, 1.05) }));
    this.screen.position.set(MON[0] + Math.sin(MON_YAW) * 0.001, MON[1], MON[2] + Math.cos(MON_YAW) * 0.001); this.screen.rotation.y = MON_YAW;
    this.screen.layers.set(NOINK); R.add(this.screen);
    // ---- the three side terminals: a still radar picture, on or off ----
    const radar = ctex("sideRadar", 512, 390, (g) => drawRadar(g, 512, 390, 1.3));
    const on = new THREE.MeshBasicMaterial({ map: radar, color: new THREE.Color(1.1, 1.1, 1.1) }), off = new THREE.MeshBasicMaterial({ color: new THREE.Color("#1a2024") });
    for (const [x, yaw] of TERMS) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(MON_W, MON_H), on);
      m.position.set(x + Math.sin(yaw) * 0.001, MON[1], MON[2] + Math.cos(yaw) * 0.001); m.rotation.y = yaw; m.layers.set(NOINK); R.add(m);
      this.terms.push({ m, on, off });
    }
    // ---- drive light + the floppy itself ----
    const [dx, dy, dz] = DRIVE;
    this.ledOn = glow("ledOn", "#5aff7a", 3.2); this.ledOff = lam("ledOff", () => ({ color: "#3a5a40" }));
    this.led = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.004), this.ledOff); this.led.position.set(dx - 0.09, dy - 0.03, dz + 0.002); R.add(this.led);
    const top = new THREE.MeshLambertMaterial({ map: floppyTex() }), side = lam("floppySide", () => ({ color: "#1c2648" }));
    this.floppy = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.0034, 0.094), [side, side, top, side, side, side] as unknown as THREE.Material);
    this.floppy.castShadow = true; R.add(this.floppy);
    // ---- planes (air: big, no trail; map: small with trails) ----
    const tm = new THREE.MeshBasicMaterial({ map: trailTex(), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const tg = new THREE.CylinderGeometry(0.16, 0.6, 1, 10, 1, true); tg.translate(0, -0.5, 0); tg.rotateX(Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const g = makePlane(); g.visible = false; R.add(g);
      const trail = new THREE.Mesh(tg, tm.clone()); trail.layers.set(NOINK); trail.visible = false; trail.frustumCulled = false; R.add(trail);
      this.planes.push({ g, trail });
    }
    // ---- 435 site dots on the map ----
    this.dotData = mapDots(435);
    const cg = new THREE.CircleGeometry(1.25, 14); cg.rotateX(-Math.PI / 2);
    this.dots = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.5, 0.35), fog: false }), this.dotData.length);
    this.dots.frustumCulled = false; this.dots.layers.set(NOINK); R.add(this.dots);
    // ---- the pickup truck on the highway ----
    this.truck = makeTruck(); R.add(this.truck.g);
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
      g.visible = true; g.position.set(...p.p); g.rotation.set(0, 0, 0); g.rotateY(p.yaw); g.rotateX(p.pitch); g.scale.setScalar(p.s);
      trail.visible = map;
      if (map) {
        const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(-6.6 * p.s);
        trail.position.set(p.p[0] + back.x, p.p[1] + 0.1 * p.s, p.p[2] + back.z); trail.rotation.set(0, p.yaw, 0);
        trail.scale.set(p.s * 0.5, p.s * 0.5, p.trail);
        const tmat = trail.material as THREE.MeshBasicMaterial; tmat.color.setRGB(0.6, 1.4, 1.6); tmat.opacity = 0.9;
      }
    }
    for (; i < this.planes.length; i++) { this.planes[i].g.visible = false; this.planes[i].trail.visible = false; }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.place === "desk" ? 0.02 : s.place === "air" || s.place === "map" ? 0.3 : 0.05; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const big = s.place === "air" ? 60 : s.place === "map" ? 120 : s.place === "road" ? 14 : 6;
    const Rr = THREE.MathUtils.clamp(dist * 1.3 + 2.5, 3, big);
    this.sun.position.copy(focus).addScaledVector(sunDir, s.place === "map" ? 400 : 120); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = s.place === "map" ? 800 : 260; sc.updateProjectionMatrix();
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
    this.fog.near = L.fogNear; this.fog.far = s.place === "map" ? Math.max(L.fogFar, 600) : L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    const scr = screenAt(id, t), key = screenKey(scr, t);
    if (key !== this.screenK) { drawScreen(this.screenCv.getContext("2d")!, this.screenCv.width, this.screenCv.height, scr, t); this.screenTex.needsUpdate = true; this.screenK = key; }
    this.terms.forEach((tm, i) => { const lit = termOn(id, t, i) && !(i === 0 && id === 6 && at(t, W.breaks)); tm.m.material = lit ? tm.on : tm.off; });
    const k = insertK(id, t);
    const [dx, dy, dz] = DRIVE;
    this.floppy.visible = id === 2 || id === 20;
    this.floppy.position.set(dx, dy, dz + 0.1 - 0.175 * k);
    this.floppy.rotation.set(0, 0, 0);
    this.led.material = (id === 2 || id === 20 ? k > 0.97 : true) ? this.ledOn : this.ledOff;
    if (s.place === "air") this.posePlanes(airPlanes(id, t), false);
    else if (s.place === "map") this.posePlanes(mapPlanes(t, id), true);
    else this.posePlanes([], false);
    // site dots: pop on west -> east with a little overshoot
    this.dots.visible = s.place === "map" && id === 17;
    if (this.dots.visible) {
      const P = sitesK(t);
      this.dotData.forEach(([x, z, h], i) => {
        const w = (x + 110) / 220, a = Math.max(0, Math.min(1, (P * 1.6 - w * 0.5 - h * 0.1) / 0.18));
        const kk = a < 1 ? a * (1 + 0.6 * Math.sin(a * Math.PI)) : 1;
        this.m4.compose(this.v.set(MAP + x, 0.2 + (i % 7) * 0.003, z), this.q.identity(), this.sc.set(kk, 1, kk));
        this.dots.setMatrixAt(i, this.m4);
      });
      this.dots.instanceMatrix.needsUpdate = true;
    }
    // the truck: rolls along the road, wheels spin; the near rear wheel is off between "changing" and the swap
    this.truck.g.visible = s.place === "road";
    if (this.truck.g.visible) {
      const x = truckX(t);
      this.truck.g.position.set(x, 0.02 + 0.015 * Math.sin(t * 9), TRUCK_Z);
      this.truck.wheels.forEach((w, i) => { w.rotation.z = -(x - 1990) / 0.4; w.visible = !(i === 0 && t >= W.changing + 0.1 && t < W.driving - 0.3); });
    }

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
      const [w, hh, kq] = p.size ?? [300, 500, 0.5];
      ac.r = this.pool.req(p.key, w, hh, kq, p.draw);
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
    return focus;
  }
}
