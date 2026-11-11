// One three.js scene with every place of the robot-cleaner short (hall staircase, stoop + street, pilot HQ, bathroom),
// the moving parts (the pilot's monitor picture, the gear-box LED), the sky and the light rig; update(id, f, camera)
// poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { buildHall, buildLiving, buildStage, lam, glow, WINDOW_TEX, livingWindow, STAGE_SCREEN } from "./build";
import { Drone } from "./drone3d";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, STAGE, ROUTER, SENSOR, FRIDGE, droneAt, wifiUp, fridgeOpen, alarmOn } from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

const stageTex = () => ctex("stageScreenT", 1024, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 1024, 512); gr.addColorStop(0, "#1b3a8c"); gr.addColorStop(1, "#5a2a8c"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255,0.06)"; g.beginPath(); g.arc((i * 137) % 1024, (i * 89) % 512, 6 + (i % 5) * 4, 0, 6.283); g.fill(); }
  // big drone pictogram: body, four rings, arms
  g.strokeStyle = "#ffffff"; g.fillStyle = "#ffffff"; g.lineWidth = 14;
  const cx = 512, cy = 250;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + sx * 130, cy + sy * 80); g.stroke(); g.beginPath(); g.ellipse(cx + sx * 130, cy + sy * 80, 70, 26, 0, 0, 6.283); g.stroke(); }
  g.beginPath(); g.ellipse(cx, cy, 70, 46, 0, 0, 6.283); g.fill();
  g.fillStyle = "#1b3a8c"; g.beginPath(); g.arc(cx, cy + 8, 20, 0, 6.283); g.fill();
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
  private drone: Drone;
  private win: THREE.Mesh; private winDay: THREE.Material; private winNight: THREE.Material;
  private rLeds: THREE.Mesh[] = []; private ledGreen: THREE.Material; private ledRed: THREE.Material; private ledDark: THREE.Material;
  private alarm: THREE.Mesh;
  private fDoor: THREE.Mesh; private fGlow: THREE.Mesh;
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
    buildHall(R); buildLiving(R); buildStage(R);
    // ---- living-room window glass: garden by day, moonlit by night ----
    const lw = livingWindow;
    this.winDay = glow("winDay", "#ffffff", 1.05, WINDOW_TEX.day()); this.winNight = glow("winNight", "#ffffff", 1.0, WINDOW_TEX.night());
    this.win = new THREE.Mesh(new THREE.PlaneGeometry(lw.x1 - lw.x0, lw.y1 - lw.y0), this.winDay);
    this.win.position.set((lw.x0 + lw.x1) / 2, (lw.y0 + lw.y1) / 2, lw.z); R.add(this.win);
    // ---- router LEDs on the front face ----
    this.ledGreen = glow("ledG", "#5aff7a", 3.0); this.ledRed = glow("ledR", "#ff4a2a", 3.2); this.ledDark = lam("ledDark", () => ({ color: "#6a6f7a" }));
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.004), this.ledGreen); m.position.set(ROUTER[0] - 0.13 + i * 0.04, ROUTER[1] + 0.03, ROUTER[2] + 0.082); R.add(m); this.rLeds.push(m); }
    // ---- alarm sensor LED ----
    this.alarm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.008), this.ledDark); this.alarm.position.set(SENSOR[0], SENSOR[1] + 0.02, SENSOR[2] + 0.045); R.add(this.alarm);
    // ---- fridge door (hinged on its left) + the light inside ----
    const fd = new THREE.BoxGeometry(0.74, 1.8, 0.05); fd.translate(0.37, 0.9, 0.025);
    this.fDoor = new THREE.Mesh(fd, lam("fridgeDoor", () => ({ color: "#e8eef3" }))); this.fDoor.position.set(FRIDGE[0] - 0.37, 0.02, FRIDGE[2] + 0.32); this.fDoor.castShadow = true; R.add(this.fDoor);
    this.fGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.7), glow("fridgeLight", "#fff4d8", 1.6)); this.fGlow.position.set(FRIDGE[0], 0.95, FRIDGE[2] + 0.322); R.add(this.fGlow);
    // ---- keynote backdrop: a big glowing screen with a drone pictogram ----
    const ss = STAGE_SCREEN;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(ss.w, ss.h), glow("stageScreen", "#ffffff", 1.15, stageTex())); scr.position.set(ss.x, ss.y, ss.z); R.add(scr);
    this.drone = new Drone(R);
    void lam;
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
    const big = s.place === "stage" ? 12 : 7;
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
    const night = s.light === "night";
    this.win.material = night ? this.winNight : this.winDay;
    const up = wifiUp(id, t);
    this.rLeds.forEach((m, i) => (m.material = up ? (Math.floor(t * 6 + i * 2.3) % 4 ? this.ledGreen : this.ledDark) : i === 0 ? (Math.floor(t * 5) % 2 ? this.ledRed : this.ledDark) : this.ledDark));
    this.alarm.material = alarmOn(id, t) ? (Math.floor(t * 6) % 2 ? this.ledRed : this.ledDark) : this.ledDark;
    const open = fridgeOpen(id);
    this.fDoor.rotation.y = open ? -1.75 : 0; this.fGlow.visible = open;
    this.drone.pose(droneAt(id, t), t);

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
    if (stg.drone) this.drone.pose(stg.drone, t);
    for (const ac of used) ac.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }
}
