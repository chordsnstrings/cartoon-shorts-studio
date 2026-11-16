// One three.js scene with every place of the catch short (space + cartoon Earth, launch pad, Gulf sky), the moving parts
// (ship, booster, catch arms, lap rings, Earth spin), the sky (+ stars, sun disc) and the light rig; update(id, f, camera)
// poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { staticFile } from "remotion";
import { buildPad, buildSea, lam, glow, cyl, starsTex } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, ShotDef, PAD, SEA, AXIS, EARTH_R, EARTH_Y, SHIP_R, SHIP_H, BOOST_H, PIN_Y, TOWER_X, ARM_Y, ARM_Z,
  shipPose, boostPose, shipFlames, boostFlame, armOpen, lapAng, lapPt, LAP_TILT, Pose,
} from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
/** brushed stainless: warm light grey with ring seams and faint vertical streaks */
const steelTex = () => ctex("stainless", 512, 1024, (g, r) => {
  g.fillStyle = "#d4d6da"; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 60; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,64,80,0.07)"; g.fillRect(r() * 512, 0, 2 + r() * 10, 1024); }
  g.fillStyle = "rgba(40,36,52,0.45)"; for (let y = 0; y < 1024; y += 128) g.fillRect(0, y, 512, 4);
});
/** black hex-tile heat shield */
const tileTex = () => ctex("heatTiles", 512, 512, (g) => {
  g.fillStyle = "#2a2a32"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(90,90,110,0.55)"; g.lineWidth = 2;
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 512; x += 32) g.strokeRect(x, y, 32, 32);
});
const gridTex = () => ctex("gridFin", 256, 256, (g) => {
  g.fillStyle = "#2c2e36"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#121218"; for (let y = 12; y < 256; y += 30) for (let x = 12; x < 256; x += 30) g.fillRect(x, y, 22, 22);
});

/** the Earth map image (ModelArk Seedream plate, public/catch/earth.jpg), loaded before any canvas mounts (Short.tsx) */
export const EARTH: { img: HTMLImageElement | null } = { img: null };
export const loadEarth = () => new Promise<void>((res) => {
  if (EARTH.img) return res();
  const img = new Image();
  img.onload = () => { EARTH.img = img; res(); };
  img.onerror = () => { console.error("earth texture failed"); res(); };
  img.src = staticFile("catch/earth.jpg");
});

const flameCone = (r: number, len: number, key: string, col: string, k: number) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 20, 1, true).rotateX(Math.PI).translate(0, -len / 2, 0), glow(key, col, k));
  m.layers.set(NOINK); return m;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Mesh; private sunDisc: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private earth = new THREE.Group(); private earthMesh: THREE.Mesh;
  private ship = new THREE.Group(); private shipFl: THREE.Group[] = [];
  private boost = new THREE.Group(); private boostFl = new THREE.Group();
  private arms: THREE.Group[] = [];
  private rings: THREE.Mesh[] = []; private arc: THREE.Mesh; private arcN = -1;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

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
    const st = starsTex(); st.wrapS = THREE.RepeatWrapping; st.repeat.set(3, 2);
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(1050, 48, 24), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
    this.stars.renderOrder = -1; this.stars.frustumCulled = false; this.stars.layers.set(NOINK);
    this.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(3, 2.9, 2.6) }));
    this.sunDisc.renderOrder = -0.5; this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK);
    R.add(this.sky, this.stars, this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    // clouds: behind the pad, and around the Gulf sky (high, so the falling ship passes them)
    for (const [cx, n, y0, z0] of [[PAD, 7, 90, -380], [SEA, 9, 150, -420]] as const) for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, LOOK.day.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 80 + (i % 3) * 30;
      m.position.set(cx - 200 + i * 52, y0 + (i % 3) * 30, z0 - (i % 2) * 70); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); R.add(m);
    }
    buildPad(R); buildSea(R);

    // ---- the cartoon Earth ----
    const eTex = new THREE.Texture(EARTH.img ?? undefined); eTex.colorSpace = THREE.SRGBColorSpace; eTex.anisotropy = 8; eTex.needsUpdate = !!EARTH.img;
    const eMat = lam("earth", () => ({ color: "#ffffff", map: eTex }));
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 96), eMat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.018, 128, 96), new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0.45, 0.78, 1.6) } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(col, pow(r, 5.0) * 0.85); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
    }));
    atmo.layers.set(NOINK);
    this.earth.add(this.earthMesh, atmo);
    this.earth.position.set(0, EARTH_Y, 0);
    this.earth.rotation.set(-0.35, 0, 0.2);
    R.add(this.earth);

    // ---- the ship: stainless body + ogive nose, black heat shield on local -x, four flaps, two catch pins, three engines ----
    const ss = lam("shipSteel", () => ({ map: steelTex() })), hs = lam("shipTiles", () => ({ map: tileTex(), side: THREE.DoubleSide }));
    const dk = lam("shipDark", () => ({ color: "#2c2c34" })), pinM = lam("shipPin", () => ({ color: "#9a9ca6" }));
    const body = new THREE.Mesh(cyl(SHIP_R, SHIP_R, 32, 40), ss);
    const prof: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const h = (8 * i) / 12; prof.push(new THREE.Vector2(Math.max(0.25, SHIP_R * Math.sqrt(1 - (h / 8.2) ** 2)), 32 + h)); }
    const nose = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), ss);
    const shieldB = new THREE.Mesh(new THREE.CylinderGeometry(SHIP_R + 0.06, SHIP_R + 0.06, 31.5, 24, 1, true, Math.PI, Math.PI).translate(0, 16.25, 0), hs);
    const prof2 = prof.map((v) => new THREE.Vector2(v.x + 0.06, v.y));
    const shieldN = new THREE.Mesh(new THREE.LatheGeometry(prof2, 24, Math.PI, Math.PI), hs);
    this.ship.add(body, nose, shieldB, shieldN);
    for (const sz of [-1, 1]) {
      const ff = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.6, 2.4), dk); ff.position.set(-2.0, 36.0, sz * (3.4 + 1.0)); ff.rotation.x = sz * -0.18; this.ship.add(ff);
      const af = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 2.6), dk); af.position.set(-3.3, 5.5, sz * 4.3); this.ship.add(af);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 2.3), pinM); pin.position.set(0, PIN_Y + 0.5, sz * (SHIP_R + 0.9)); this.ship.add(pin);
    }
    const skirt = new THREE.Mesh(cyl(SHIP_R * 0.92, SHIP_R, 0.8, 32).translate(0, -0.2, 0), dk); this.ship.add(skirt);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2, x = 1.8 * Math.cos(a), z = 1.8 * Math.sin(a);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 1.8, 18, 1, true).translate(0, -1.0, 0), dk); bell.position.set(x, 0, z); this.ship.add(bell);
      const fl = new THREE.Group(); fl.add(flameCone(0.95, 11, "flameO", "#ff9a3a", 3.2), flameCone(0.5, 6, "flameI", "#fff2c0", 5)); fl.position.set(x, -1.9, z);
      this.ship.add(fl); this.shipFl.push(fl);
    }
    this.ship.traverse((o) => { if (o instanceof THREE.Mesh && !o.layers.isEnabled(NOINK)) { o.castShadow = true; o.receiveShadow = true; } });
    R.add(this.ship);

    // ---- the booster: stainless body, dark hot-stage ring, four grid fins, engine skirt, one big flame cluster ----
    const bb = new THREE.Mesh(cyl(SHIP_R, SHIP_R, 52, 40), ss);
    const hot = new THREE.Mesh(cyl(SHIP_R * 0.98, SHIP_R * 0.98, 4, 40).translate(0, 52, 0), dk);
    const bsk = new THREE.Mesh(cyl(SHIP_R * 0.9, SHIP_R, 1.4, 32).translate(0, -0.6, 0), dk);
    this.boost.add(bb, hot, bsk);
    const gm = lam("gridFin", () => ({ map: gridTex(), side: THREE.DoubleSide }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 2.8), gm);
      fin.position.set((SHIP_R + 1.4) * Math.cos(a), 50, (SHIP_R + 1.4) * Math.sin(a)); fin.rotation.y = -a + Math.PI / 2; this.boost.add(fin);
    }
    this.boostFl.add(flameCone(4.2, 30, "bflameO", "#ff9a3a", 3.0), flameCone(2.4, 16, "bflameI", "#fff2c0", 5));
    this.boostFl.position.y = -1.3; this.boost.add(this.boostFl);
    this.boost.traverse((o) => { if (o instanceof THREE.Mesh && !o.layers.isEnabled(NOINK)) { o.castShadow = true; o.receiveShadow = true; } });
    R.add(this.boost);

    // ---- the catch arms ("chopsticks"): two long box arms on hinges at the tower, padded inner rails ----
    const armM = lam("armSteel", () => ({ color: "#5d616e" })), padM = lam("armPad", () => ({ color: "#e7c13a" }));
    for (const sz of [-1, 1]) {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(21, 3, 2.5).translate(-10.5, -1.5, 0), armM);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.8, 0.5).translate(-14.5, -0.4, -sz * 1.3), padM);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 0.5).translate(-9.5, 1.2, 0), armM);
      const tieA = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5).translate(-4, 0, 0), armM), tieB = tieA.clone(); tieB.position.x = -9; const tieC = tieA.clone(); tieC.position.x = -14;
      g.add(beam, rail, truss, tieA, tieB, tieC);
      g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.position.set(TOWER_X - 4.8, ARM_Y, AXIS[2] + sz * (ARM_Z + 1.25));
      g.userData.sz = sz;
      R.add(g); this.arms.push(g);
    }

    // ---- lap rings around the Earth (shot 6) ----
    const ringM = glow("lapRing", "#bff4ff", 1.6);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(156, 0.9, 6, 160), ringM);
      m.position.set(0, EARTH_Y, 0); m.rotation.set(Math.PI / 2 - LAP_TILT + 0.05 * (k + 1), 0, 0.12 * (k + 1)); m.layers.set(NOINK); m.visible = false;
      R.add(m); this.rings.push(m);
    }
    this.arc = new THREE.Mesh(new THREE.BufferGeometry(), ringM); this.arc.layers.set(NOINK); this.arc.visible = false; this.arc.frustumCulled = false;
    this.arc.position.set(0, EARTH_Y, 0); R.add(this.arc);
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
  private pose(g: THREE.Object3D, p: Pose) {
    g.visible = p.vis; g.position.set(...p.p); g.rotation.set(p.r[0], p.r[1], p.r[2]); const s = p.s ?? 1; g.scale.set(s, s, s);
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.place === "space" ? 0.5 : 0.05; cam.far = 3000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.1 + 2.5, 3, s.place === "space" ? 260 : 140);
    this.sun.position.copy(focus).addScaledVector(sunDir, 400); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = 900; sc.updateProjectionMatrix();
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
    this.stars.position.copy(cam.position);
    this.stars.visible = s.light === "space" || s.light === "night";
    (this.stars.material as THREE.MeshBasicMaterial).opacity = s.light === "night" ? 0.55 : 1;
    const showSun = s.light === "space" || s.light === "golden";
    this.sunDisc.visible = showSun;
    if (showSun) {
      const d = s.light === "space" ? 900 : 950, size = s.light === "space" ? 70 : 120;
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, d);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(size, size, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(...((s.light === "space" ? [3.2, 3.1, 2.9] : [3.0, 2.2, 1.4]) as [number, number, number]));
    }
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = s.place === "sea" ? L.fogFar * 3 : s.place === "pad" ? L.fogFar * 1.6 : L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    this.earth.visible = s.place === "space";
    this.earthMesh.rotation.y = 2.62 + t * 0.004 + (id === 6 ? (t - 12) * 1.1 : 0);
    this.pose(this.ship, shipPose(id, t));
    const nf = shipFlames(id, t);
    this.shipFl.forEach((g, i) => { g.visible = i < Math.min(3, nf); const fk = 0.9 + 0.15 * Math.sin(t * 47 + i * 2) + (nf === 6 ? 0.5 : 0); g.scale.set(nf === 6 ? 1.3 : 1, fk, nf === 6 ? 1.3 : 1); });
    this.pose(this.boost, boostPose(id, t));
    const bf = boostFlame(id, t);
    this.boostFl.visible = bf > 0; this.boostFl.scale.set(0.6 + 0.4 * bf, bf * (0.92 + 0.12 * Math.sin(t * 41)), 0.6 + 0.4 * bf);
    for (const g of this.arms) { g.rotation.y = g.userData.sz * 0.62 * armOpen(t, id); g.visible = s.place === "pad"; }
    // lap rings: one per finished lap, plus the arc of the current lap behind the ship
    const lap = id === 6;
    const a0 = lapAng(12.0), a = lapAng(t), done = Math.floor((a - a0) / (Math.PI * 2));
    this.rings.forEach((m, k) => { m.visible = lap && k < done; });
    this.arc.visible = lap;
    if (lap) {
      const arcLen = Math.max(0.02, (a - a0) - done * Math.PI * 2), n = Math.round(arcLen * 40);
      if (n !== this.arcN) { this.arc.geometry.dispose(); this.arc.geometry = new THREE.TorusGeometry(156, 0.9, 6, Math.max(4, n), arcLen); this.arcN = n; }
      this.arc.rotation.set(Math.PI / 2 - LAP_TILT, 0, a0 + done * Math.PI * 2); // torus XY -> orbit plane (matches lapPt)
      void lapPt;
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
    return focus;
  }
}
