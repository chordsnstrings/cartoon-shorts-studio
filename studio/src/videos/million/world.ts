// One three.js scene with every place of the Million short (space + cartoon Earth, the instanced satellite swarm and the
// Sun, the night hill with the telescope, the regulator's office), the moving parts (Earth spin, swarm orbits, the live
// wall screen), the sky (+ stars, sun / moon disc) and the light rig; update(id, f, camera) poses everything for shot `id` at frame f (pure function
// of id + f). The probe and the people are drawn cards (cast.ts).
import * as THREE from "three";
import { buildCtrl, buildHill, lam, starsTex, earthHD, drawWall, WallState, SCREEN_W, SCREEN_H, SCREEN_Y, SCREEN_Z } from "./build";
import { ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, W, EARTH_R, EARTH_C, CTRL, screenAt, swarmN, SWARM_MAX } from "./story";

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
  if (kind === "approve") return { kind, pop: clamp((t - (W.regulators - 0.1)) / 0.3, -1, 9), t };
  return { kind, pop: clamp((t - (W.didnt - 0.07)) / 0.3, -1, 9), t };
};
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const wallKey = (s: WallState) => `${s.kind}|${s.pop < 0 ? -1 : Math.round(Math.min(s.pop, 2.5) * 30)}|${Math.floor(s.t * 15)}`;

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
  private earth = new THREE.Group(); private earthMesh: THREE.Mesh;
  private swarm: THREE.InstancedMesh; private swarmOrb: Float32Array; private swarmK = "";
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

    buildHill(R);
    // ---- cartoon Earth: painted map + a soft blue atmosphere rim ----
    const et = earthHD(); et.anisotropy = 8;
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 96), lam("earth", () => ({ color: "#ffffff", map: et })));
    this.earthMesh.receiveShadow = false; this.earthMesh.castShadow = false;
    this.earth.add(this.earthMesh);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.03, 96, 64), new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0.45, 0.8, 1.7) } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(col, pow(r, 3.0) * 0.9); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
    }));
    atmo.layers.set(NOINK); this.earth.add(atmo);
    this.earth.position.set(...EARTH_C); this.earth.rotation.set(0.35, 0, 0.18);
    R.add(this.earth);
    // ---- the swarm: little glowing satellites (a body + two wing slabs) on inclined circular orbits round Earth ----
    const sg = new THREE.BoxGeometry(1.0, 1.0, 1.0), wg = new THREE.BoxGeometry(3.4, 0.12, 1.0);
    const merged = new THREE.BufferGeometry();
    {
      const parts = [sg.toNonIndexed(), wg.toNonIndexed()];
      const pos: number[] = [], col: number[] = [];
      parts.forEach((g, i) => { const p = g.attributes.position.array as Float32Array; for (let k = 0; k < p.length; k += 3) { pos.push(p[k], p[k + 1], p[k + 2]); if (i === 0) col.push(2.4, 2.0, 1.0); else col.push(0.9, 1.4, 2.6); } });
      merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    }
    this.swarm = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: true }), SWARM_MAX);
    this.swarm.layers.set(NOINK); this.swarm.frustumCulled = false; this.swarm.count = 0;
    this.swarmOrb = new Float32Array(SWARM_MAX * 4); // radius, inclination, node, phase (random order, so any prefix is spread evenly)
    let sd = 12345; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < SWARM_MAX; i++) {
      const shell = Math.floor(rnd() * 5);
      this.swarmOrb[i * 4] = EARTH_R + 7 + shell * 4.5 + rnd() * 2; this.swarmOrb[i * 4 + 1] = (rnd() * 2 - 1) * 1.45;
      this.swarmOrb[i * 4 + 2] = rnd() * Math.PI * 2; this.swarmOrb[i * 4 + 3] = rnd() * Math.PI * 2;
    }
    R.add(this.swarm);

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
    const wide = s.place === "space" && (id === 2 || id === 4);
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
    this.stars.visible = s.light === "space" || s.light === "night";
    // the Sun: a small white glare in the space shots; in shot 9 the huge cartoon Sun fills the lower frame. At night the
    // same disc is a pale moon, fixed up and to the left behind the hill.
    const showSun = s.light === "space" || s.light === "night";
    this.sunDisc.visible = showSun; this.sunBody.visible = s.light === "space" && id === 9;
    if (s.light === "night") {
      const md = new THREE.Vector3(-0.42, 0.62, -0.66).normalize();
      this.sunDisc.position.copy(cam.position).addScaledVector(md, 1200);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(70, 70, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(1.9, 1.95, 2.1);
    } else if (showSun) {
      const d = 1200, size = id === 9 ? 1150 : 95;
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, d);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(size, size, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(...((id === 9 ? [2.2, 1.6, 0.9] : [3.2, 3.1, 2.9]) as [number, number, number]));
      if (id === 9) {
        const bs = 600 + 50 * (t - 23.6); // the Sun grows as the dead satellite falls toward it
        this.sunBody.position.copy(cam.position).addScaledVector(sunDir, d - 10);
        this.sunBody.quaternion.copy(cam.quaternion); this.sunBody.rotateZ(t * 0.05); this.sunBody.scale.set(bs, bs, 1);
      }
    }
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    this.earth.visible = s.place === "space" && id !== 9;
    this.earthMesh.rotation.y = 1.1 + t * 0.012;
    const n = swarmN(id, t);
    this.swarm.visible = n > 0;
    if (n > 0) {
      const key = `${n}|${f}`;
      if (key !== this.swarmK) {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
        for (let i = 0; i < n; i++) {
          const r = this.swarmOrb[i * 4], inc = this.swarmOrb[i * 4 + 1], node = this.swarmOrb[i * 4 + 2], ph = this.swarmOrb[i * 4 + 3] + t * (0.05 + 0.02 * (i % 3));
          const x = r * Math.cos(ph), z = r * Math.sin(ph);
          // tilt the orbit by inc about x, then turn by node about y
          const y1 = -z * Math.sin(inc), z1 = z * Math.cos(inc);
          p.set(EARTH_C[0] + x * Math.cos(node) + z1 * Math.sin(node), EARTH_C[1] + y1, EARTH_C[2] - x * Math.sin(node) + z1 * Math.cos(node));
          e.set(inc, node + ph, 0.3 * (i % 5)); q.setFromEuler(e);
          const k = id === 4 ? 1.1 : 2.4; sc.set(k, k, k);
          m.compose(p, q, sc); this.swarm.setMatrixAt(i, m);
        }
        this.swarm.count = n; this.swarm.instanceMatrix.needsUpdate = true; this.swarmK = key;
      }
    }
    // wall screen
    if (s.place === "ctrl") {
      const ws = wallState(id, t), k = wallKey(ws);
      if (k !== this.wallK) { drawWall(this.wallCv.getContext("2d")!, this.wallCv.width, this.wallCv.height, ws); this.wallTex.needsUpdate = true; this.wallK = k; }
    }

    // ---- cast + effects ----
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
    const stg = stage(id, t, { pos: cam.position, right, up, fwd, sun: sunDir });
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
      { const hdr = p.key === "train" ? 2.4 : 1; ef.soft.color.setScalar(hdr); ef.mat.color.setScalar(1); }
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
