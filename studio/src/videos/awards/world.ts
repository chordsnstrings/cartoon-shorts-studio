// One three.js scene with every place of the robot-cleaner short (hall staircase, stoop + street, pilot HQ, bathroom),
// the moving parts (the pilot's monitor picture, the gear-box LED), the sky and the light rig; update(id, f, camera)
// poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { buildTheatre, buildLobby, lam, glow, cyl } from "./build";
import { botTex, trailerTex, barsTex, darkTex, towerTex, stoneTex } from "./screens";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, SCREEN, POD, TOWER, TOWER_H, TOWER_FACE, screenAt, towerFace, towerRock, W, at } from "./story";

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
  private screen: THREE.Mesh; private scrMats: Record<string, THREE.Material> = {}; private trailer: THREE.Texture;
  private podRing: THREE.Mesh; private ringOn: THREE.Material; private ringOff: THREE.Material;
  private tower = new THREE.Group(); private tFace: THREE.Mesh; private tMats: Record<string, THREE.Material> = {};
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
    buildTheatre(R); buildLobby(R);
    // ---- the big screen: swappable pictures ----
    this.trailer = trailerTex();
    this.scrMats = { bot: glow("scrBot0", "#ffffff", 1.1, botTex(0)), bot1: glow("scrBot1", "#ffffff", 1.1, botTex(1)), botWin: glow("scrBot2", "#ffffff", 1.15, botTex(2)),
      trailer: glow("scrTrailer", "#ffffff", 1.1, this.trailer), bars: glow("scrBars", "#ffffff", 1.05, barsTex()), dark: glow("scrDark", "#ffffff", 1.0, darkTex()) };
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), this.scrMats.bot); this.screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z); R.add(this.screen);
    // ---- the announcer pod: a glowing ring + grille facing the audience ----
    this.ringOn = glow("podRingOn", "#7ff6ff", 3.0); this.ringOff = lam("podRingOff", () => ({ color: "#3a5a6a" }));
    this.podRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 10, 32), this.ringOff); this.podRing.position.set(POD[0], POD[1] - 0.02, POD[2] + 0.4); R.add(this.podRing);
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), lam("grille", () => ({ color: "#14121c" }))); grille.position.set(POD[0], POD[1] - 0.02, POD[2] + 0.39); R.add(grille);
    // ---- the AI reporter: a tall faux-stone vessel with a face screen (rocks in place) ----
    const stone = lam("stoneM", () => ({ map: stoneTex() }));
    const body = new THREE.Mesh(cyl(0.55, 0.46, TOWER_H, 8), stone); body.castShadow = true; body.receiveShadow = true;
    const cap = new THREE.Mesh(cyl(0.56, 0.36, 0.28, 8), stone); cap.position.y = TOWER_H; cap.castShadow = true;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), stone); top.position.y = TOWER_H + 0.3;
    const base = new THREE.Mesh(cyl(0.68, 0.66, 0.18, 8), lam("stoneBase", () => ({ color: "#d9d2c4" }))); base.castShadow = true;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 0.06), lam("monBlack", () => ({ color: "#22252e" }))); fr.position.set(0, TOWER_FACE[1], TOWER_FACE[2] - TOWER[2] - 0.02);
    for (const k of ["talk0", "talk1", "strain", "calm"]) this.tMats[k] = glow("tw_" + k, "#ffffff", 1.2, towerTex(k as "calm"));
    this.tFace = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.44), this.tMats.calm); this.tFace.position.set(0, TOWER_FACE[1], TOWER_FACE[2] - TOWER[2] + 0.015);
    this.tower.add(body, cap, top, base, fr, this.tFace); this.tower.position.set(TOWER[0], 0, TOWER[2]); R.add(this.tower);
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
    const big = s.place === "theatre" ? 12 : 8;
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
    const sc0 = screenAt(id, t);
    this.screen.material = sc0.mode === "bot" ? (sc0.sing ? this.scrMats.bot1 : this.scrMats.bot) : this.scrMats[sc0.mode];
    this.trailer.offset.set(0, 0.3 * sc0.u);
    const blaring = id === 3 && at(t, W.announcer - 0.1);
    this.podRing.material = blaring && Math.floor(t * 10) % 3 ? this.ringOn : id === 3 ? this.ringOn : this.ringOff;
    this.tFace.material = this.tMats[towerFace(t)];
    this.tower.rotation.set(0, 0, towerRock(id, t));

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
