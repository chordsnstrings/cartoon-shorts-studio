// One three.js scene with every place of the Mercury short (space + cartoon Mercury and the Sun, the flyby diagram,
// mission control), the moving parts (Mercury spin, orbit rings + trail arc, flyby trail, the live wall screen), the sky
// (+ stars, sun disc) and the light rig; update(id, f, camera) poses everything for shot `id` at frame f (pure function
// of id + f). The probe and the people are drawn cards (cast.ts).
import * as THREE from "three";
import { buildCtrl, lam, glow, starsTex, mercuryTex, venusTex, earthTex, drawWall, WallState, SCREEN_W, SCREEN_H, SCREEN_Y, SCREEN_Z } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, ShotDef, W, at, CTRL, MERC_R, MERC_C, R_PLAN, R_REAL, ringPt, orbitTh, P_EARTH, P_VENUS, P_MERC, R_EARTH, R_VENUS, R_MERCS,
  flyPt, flyS, screenAt, V3,
} from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
/** the cartoon Sun face-on: hot disc with darker freckles and a bright rim (drawn, HDR via the material colour) */
const sunTex = () => ctex("sunBody", 512, 512, (g, r) => {
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 250);
  gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.6, "#ffd25a"); gr.addColorStop(0.93, "#ffab3a"); gr.addColorStop(1, "rgba(255,150,60,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, 6.283); g.fill();
  for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = r() * 190; g.fillStyle = "rgba(255,150,50,0.35)"; g.beginPath(); g.ellipse(256 + d * Math.cos(a), 256 + d * Math.sin(a), 14 + r() * 26, 8 + r() * 14, r() * 3, 0, 6.283); g.fill(); }
});

/** wall-screen state for shot id at time t */
const wallState = (id: number, t: number): WallState => {
  const kind = screenAt(id);
  if (kind === "orbit") return { kind, flame: 0, bar: 1, alarm: false, t };
  if (id === 2) { const out = at(t, W.cut); return { kind, flame: out ? 0 : 0.8 + 0.2 * Math.sin(t * 30), bar: 0.78, alarm: out, t }; }
  if (id === 6) {
    const stop = at(t, W.engines), tb = Math.min(t, W.engines - 2 / FPS);
    return { kind, flame: stop ? 0 : 0.85 + 0.15 * Math.sin(t * 30), bar: Math.min(0.62, 0.08 + (tb - 12.8) * 0.18), alarm: stop, t };
  }
  return { kind, flame: 0, bar: 0.62, alarm: true, t };
};
const wallKey = (s: WallState) => `${s.kind}|${Math.round(s.flame * 10)}|${Math.round(s.bar * 50)}|${s.alarm ? Math.floor(s.t * 4) % 2 : "x"}|${s.kind === "orbit" ? Math.floor(s.t * 15) : 0}`;

/** a glowing tube along points */
const tubeGeo = (pts: V3[], r: number, seg = 6) => {
  if (pts.length < 2) return new THREE.BufferGeometry();
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(4, pts.length * 2), r, seg, false);
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Mesh; private sunDisc: THREE.Mesh; private sunBody: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private merc = new THREE.Group(); private mercMesh: THREE.Mesh;
  private planets = new THREE.Group();
  private planRing: THREE.Mesh; private realRing: THREE.Mesh; private arc: THREE.Mesh; private arcK = "";
  private flyTrail: THREE.Mesh; private flyK = -1;
  private wall: THREE.Mesh; private wallCv: HTMLCanvasElement; private wallTex: THREE.CanvasTexture; private wallK = "";
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), this.skyMat);
    this.sky.renderOrder = -2; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    const st = starsTex(); st.wrapS = THREE.RepeatWrapping; st.repeat.set(3, 2);
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(1350, 48, 24), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
    this.stars.renderOrder = -1; this.stars.frustumCulled = false; this.stars.layers.set(NOINK);
    this.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(3, 2.9, 2.6) }));
    this.sunDisc.renderOrder = -0.6; this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK);
    this.sunBody = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sunTex(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.35, 1.0) }));
    this.sunBody.renderOrder = -0.5; this.sunBody.frustumCulled = false; this.sunBody.layers.set(NOINK);
    R.add(this.sky, this.stars, this.sunDisc, this.sunBody);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    buildCtrl(R);

    // ---- cartoon Mercury: painted grey crater map + a faint warm rim ----
    const mt = mercuryTex(); mt.anisotropy = 8;
    this.mercMesh = new THREE.Mesh(new THREE.SphereGeometry(MERC_R, 128, 96), lam("mercury", () => ({ color: "#ffffff", map: mt })));
    this.mercMesh.receiveShadow = false; this.mercMesh.castShadow = false;
    this.merc.add(this.mercMesh); this.merc.position.set(...MERC_C); this.merc.rotation.set(0.25, 0, 0.12);
    R.add(this.merc);

    // ---- the flyby diagram planets ----
    const mkP = (c: V3, r: number, key: string, tex: THREE.Texture, atmo?: THREE.Color) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), lam(key, () => ({ color: "#ffffff", map: tex })));
      m.position.set(...c); m.rotation.set(0.3, 0.6, 0.1); this.planets.add(m);
      if (atmo) {
        const a = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 48, 32), new THREE.ShaderMaterial({
          uniforms: { col: { value: atmo } },
          vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
          fragmentShader: "uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(col, pow(r, 4.0) * 0.8); }",
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
        }));
        a.position.set(...c); a.layers.set(NOINK); this.planets.add(a);
      }
    };
    mkP(P_EARTH, R_EARTH, "earthP", earthTex(), new THREE.Color(0.45, 0.78, 1.6));
    mkP(P_VENUS, R_VENUS, "venusP", venusTex(), new THREE.Color(1.4, 1.1, 0.6));
    mkP(P_MERC, R_MERCS, "mercP", mercuryTex());
    R.add(this.planets);
    this.flyTrail = new THREE.Mesh(new THREE.BufferGeometry(), glow("flyTrail", "#bff4ff", 1.8));
    this.flyTrail.layers.set(NOINK); this.flyTrail.frustumCulled = false; R.add(this.flyTrail);

    // ---- Mercury orbits: the planned one dashed (white beads), the real one solid gold; the live arc behind the probe ----
    const dash: V3[][] = [];
    for (let i = 0; i < 64; i++) { const a0 = (i / 64) * Math.PI * 2, a1 = a0 + (0.55 / 64) * Math.PI * 2; dash.push([ringPt(a0, R_PLAN), ringPt((a0 + a1) / 2, R_PLAN), ringPt(a1, R_PLAN)]); }
    const dg = dash.map((pts) => tubeGeo(pts, 1.1, 5));
    const merged = new THREE.BufferGeometry();
    { // merge the dash tubes
      const pos: number[] = [], idx: number[] = []; let off = 0;
      for (const g of dg) { const p = g.attributes.position.array as Float32Array; for (let k = 0; k < p.length; k++) pos.push(p[k]); const ix = g.index!.array; for (let k = 0; k < ix.length; k++) idx.push(ix[k] + off); off += p.length / 3; }
      merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); merged.setIndex(idx);
    }
    this.planRing = new THREE.Mesh(merged, glow("planRing", "#e8f0ff", 1.3)); this.planRing.layers.set(NOINK); this.planRing.frustumCulled = false; R.add(this.planRing);
    const full: V3[] = []; for (let i = 0; i <= 160; i++) full.push(ringPt((i / 160) * Math.PI * 2, R_REAL));
    this.realRing = new THREE.Mesh(tubeGeo(full, 1.5, 6), glow("realRing", "#ffd24a", 1.8)); this.realRing.layers.set(NOINK); this.realRing.frustumCulled = false; R.add(this.realRing);
    this.arc = new THREE.Mesh(new THREE.BufferGeometry(), glow("realRing", "#ffd24a", 1.8)); this.arc.layers.set(NOINK); this.arc.frustumCulled = false; R.add(this.arc);

    // ---- control-room wall screen (live canvas) ----
    this.wallCv = document.createElement("canvas"); this.wallCv.width = 1024; this.wallCv.height = Math.round(1024 * SCREEN_H / SCREEN_W);
    this.wallTex = new THREE.CanvasTexture(this.wallCv); this.wallTex.colorSpace = THREE.SRGBColorSpace; this.wallTex.anisotropy = 8;
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: this.wallTex, color: new THREE.Color(1.05, 1.05, 1.05) }));
    this.wall.position.set(CTRL, SCREEN_Y, SCREEN_Z); this.wall.layers.set(NOINK); R.add(this.wall);
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
    const wide = s.place === "fly" || (s.place === "space" && (id === 9 || id === 11 || id === 13));
    cam.fov = c.fov; cam.near = wide ? 1 : 0.03; cam.far = 3000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.3 + 2.5, 3, s.place === "ctrl" ? 10 : 12);
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
    this.stars.position.copy(cam.position);
    this.stars.visible = s.light === "space";
    // the Sun: a small white glare in most space shots; in shot 3 the huge cartoon Sun fills the lower frame
    const showSun = s.light === "space";
    this.sunDisc.visible = showSun; this.sunBody.visible = showSun && id === 3;
    if (showSun) {
      const d = 1200, size = id === 3 ? 1150 : 95;
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, d);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(size, size, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(...((id === 3 ? [2.2, 1.6, 0.9] : [3.2, 3.1, 2.9]) as [number, number, number]));
      if (id === 3) {
        const bs = 560 + 40 * (t - 4.47); // the Sun grows as the probe falls toward it
        this.sunBody.position.copy(cam.position).addScaledVector(sunDir, d - 10);
        this.sunBody.quaternion.copy(cam.quaternion); this.sunBody.rotateZ(t * 0.05); this.sunBody.scale.set(bs, bs, 1);
      }
    }
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    this.merc.visible = s.place === "space" && id !== 3;
    this.mercMesh.rotation.y = 1.1 + t * 0.01;
    this.planets.visible = s.place === "fly";
    // flyby trail up to the probe
    const fs = s.place === "fly" ? flyS(t) : 0, fk = Math.round(fs * 240);
    this.flyTrail.visible = s.place === "fly" && fs > 0.01;
    if (this.flyTrail.visible && fk !== this.flyK) {
      const pts: V3[] = []; for (let i = 0; i <= fk; i++) pts.push(flyPt(i / 240));
      this.flyTrail.geometry.dispose(); this.flyTrail.geometry = tubeGeo(pts, 0.32, 6); this.flyK = fk;
    }
    // orbit rings
    const ringShot = id === 9 || id === 11 || id === 13;
    this.planRing.visible = id === 11;
    this.realRing.visible = id === 11 || id === 13;
    this.arc.visible = id === 9;
    if (id === 9) {
      const th1 = orbitTh(9, t), th0 = -0.45 - 0.9, n = Math.max(2, Math.round((th1 - th0) * 30)), key = `${n}`;
      if (key !== this.arcK) {
        const pts: V3[] = []; for (let i = 0; i <= n; i++) pts.push(ringPt(th0 + ((th1 - th0) * i) / n, R_REAL));
        this.arc.geometry.dispose(); this.arc.geometry = tubeGeo(pts, 1.5, 6); this.arcK = key;
      }
    }
    void ringShot;
    // wall screen
    if (s.place === "ctrl") {
      const ws = wallState(id, t), k = wallKey(ws);
      if (k !== this.wallK) { drawWall(this.wallCv.getContext("2d")!, this.wallCv.width, this.wallCv.height, ws); this.wallTex.needsUpdate = true; this.wallK = k; }
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
