// One three.js scene with both places of the outage short (phone store, back office), the moving parts (wall screen,
// display phones, card reader, register, office monitor, rack LEDs), the light rig; update(id, f, camera) poses everything
// for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { buildStore, buildOffice, glow, PHONE_SPOTS, READER_FACE } from "./build";
import { heroTex, glitchTex, darkTex, spinTex, statusTex, phoneOnTex, phoneOffTex, readerTex, registerTex, monitorTex, rackTex } from "./screens";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, SCREEN, T1, T2, REGISTER, COUNTER, MONITOR, OFFICE, wallAt, tablePhonesOff, readerAt, monitorAt, racksOk } from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

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
  private screen: THREE.Mesh; private scrMats: Record<string, THREE.Material> = {};
  private phones: THREE.Mesh[] = []; private pOn: THREE.Material; private pOff: THREE.Material;
  private reader: THREE.Mesh; private rdMats: Record<string, THREE.Material> = {};
  private register: THREE.Mesh; private regOn: THREE.Material; private regOff: THREE.Material;
  private monitor: THREE.Mesh; private monMats: Record<string, THREE.Material> = {};
  private racks: THREE.Mesh[] = []; private rkMats: Record<string, THREE.Material> = {};
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
    this.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(3, 2.9, 2.6) }));
    this.sunDisc.renderOrder = -0.5; this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK);
    R.add(this.sky, this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    buildStore(R); buildOffice(R);
    // ---- the wall screen: swappable pictures ----
    this.scrMats = { hero: glow("wHero", "#ffffff", 1.05, heroTex()), dark: glow("wDark", "#ffffff", 1.0, darkTex()), status: glow("wStatus", "#ffffff", 1.0, statusTex()) };
    for (let k = 0; k < 3; k++) this.scrMats["glitch" + k] = glow("wGl" + k, "#ffffff", 1.1, glitchTex(k));
    for (let k = 0; k < 8; k++) this.scrMats["spin" + k] = glow("wSp" + k, "#ffffff", 1.0, spinTex(k));
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), this.scrMats.hero); this.screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z); R.add(this.screen);
    // ---- display phones' faces ----
    this.pOn = glow("pOn", "#ffffff", 1.1, phoneOnTex()); this.pOff = glow("pOff", "#ffffff", 1.0, phoneOffTex());
    const pg = new THREE.PlaneGeometry(0.086, 0.172);
    for (const t of [T1, T2]) for (const [px, py, pz] of PHONE_SPOTS(t)) {
      const m = new THREE.Mesh(pg, this.pOn); m.position.set(px, py + 0.1, pz); m.rotation.set(-0.45, 0, 0); m.translateZ(0.0075); R.add(m); this.phones.push(m);
    }
    // ---- card reader + register ----
    for (const k of ["ok", "no", "dark"] as const) this.rdMats[k] = glow("rd_" + k, "#ffffff", 1.1, readerTex(k));
    this.reader = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), this.rdMats.dark); this.reader.position.set(...READER_FACE()); this.reader.rotation.x = -Math.PI / 2; R.add(this.reader);
    this.regOn = glow("regOn", "#ffffff", 1.05, registerTex(true)); this.regOff = glow("regOff", "#ffffff", 1.0, registerTex(false));
    this.register = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), this.regOff); this.register.position.set(REGISTER[0], COUNTER.y + 0.42, REGISTER[2]); this.register.rotation.set(-0.2, -0.35, 0, "YXZ"); this.register.rotation.set(0, -0.35, 0); this.register.rotateX(-0.2); this.register.translateZ(0.017); R.add(this.register);
    // ---- office monitor + rack faces ----
    for (let k = 0; k <= 10; k++) this.monMats["u" + k] = glow("mon" + k, "#ffffff", 1.1, monitorTex(k));
    this.monMats.err = glow("monErr", "#ffffff", 1.15, monitorTex("err"));
    this.monitor = new THREE.Mesh(new THREE.PlaneGeometry(MONITOR.w, MONITOR.h), this.monMats.u0); this.monitor.position.set(MONITOR.x, MONITOR.y, MONITOR.z); R.add(this.monitor);
    for (const k of ["g0", "g1", "red"] as const) this.rkMats[k] = glow("rk_" + k, "#ffffff", k === "red" ? 1.5 : 1.25, rackTex(k));
    for (const x of [-1.5, -0.6, 0.3, 1.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.9), this.rkMats.g0); m.position.set(OFFICE + x, 1.05, -2.995); R.add(m); this.racks.push(m); }
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

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.02; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const big = s.place === "store" ? 12 : 8;
    const Rr = THREE.MathUtils.clamp(dist * 1.3 + 2.5, 3, big);
    this.sun.position.copy(focus).addScaledVector(sunDir, 120); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix();
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
    const showSun = false;
    this.sunDisc.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 950);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(120, 120, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(3.0, 2.2, 1.4);
    }
    for (const o of this.root.children) if (o.userData.cloud !== undefined) {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const want = cloudHD(o.userData.cloud, LOOK.day.cloud);
      if (m.map !== want) { m.map = want; m.needsUpdate = true; }
    }
    untone(L.fog, this.fog.color);
    this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    const wa = wallAt(id, t);
    this.screen.material = wa.mode === "glitch" || wa.mode === "spin" ? this.scrMats[wa.mode + wa.k] : this.scrMats[wa.mode];
    const off = tablePhonesOff(id, t), n = this.phones.length;
    this.phones.forEach((m, i) => { const order = ((i * 7) % n) / n; m.material = order < off ? this.pOff : this.pOn; });
    this.reader.material = this.rdMats[readerAt(id, t)];
    this.register.material = id === 1 && t < 2.3 ? this.regOn : this.regOff;
    const mo = monitorAt(t);
    this.monitor.material = mo.mode === "err" ? this.monMats.err : this.monMats["u" + Math.round(mo.u * 10)];
    const ok = racksOk(id, t), blink = Math.floor(t * 4) % 2 ? "g1" : "g0";
    for (const r of this.racks) r.material = ok ? this.rkMats[blink] : this.rkMats.red;

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
