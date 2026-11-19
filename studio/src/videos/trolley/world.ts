// One three.js scene for the trolley short (the downtown street with the trolley crossing), the vehicles (the robotaxi with its
// spinning roof sensor, reverse lights and smashable rear window, the red trolley), the gate arms (down, pushed, snapped, the
// flying piece), the flashing signal lamps, the sky and the light rig; update(id, f, camera) poses everything for shot `id` at frame f.
import * as THREE from "three";
import { buildCity, makeRobo, makeTrolley, makeGateArm, makeArmPiece, LAMPS, glow } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, ShotDef, ROAD, carPose, trolleyPose, armState, glassBroken, gateK, lampsOn, Pose, GATE_N, GATE_F, ARM_Y, ARM_L, SNAP, HSNAP, LANE_N,
} from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

type Veh = { g: THREE.Group; wheels: THREE.Group[]; r: number };
const poseVeh = (v: Veh, p: Pose, t: number, s = 1) => {
  v.g.visible = p.vis;
  if (!p.vis) return;
  v.g.position.set(p.x, p.y, p.z); v.g.rotation.set(0, 0, 0); v.g.rotation.order = "YZX";
  v.g.rotation.y = p.yaw; v.g.rotation.z = p.pitch; v.g.rotation.x = p.roll; v.g.scale.setScalar(s);
  const spin = -(p.speed * t) / (v.r * s);
  v.wheels.forEach((w) => { w.rotation.z = spin; });
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
  private robo: Veh & ReturnType<typeof makeRobo>; private trol: THREE.Group;
  private arms: ReturnType<typeof makeGateArm>[] = []; private piece: THREE.Group;
  private lamps: THREE.Mesh[] = []; private halos: THREE.Mesh[] = [];
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
    // clouds: a far ring on both sides of the road
    const cloud = (i: number, x: number, y: number, z: number, w: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, LOOK.day.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(x, y, z); m.scale.set(w, w / 2, 1); m.userData.cloud = i % 4; m.layers.set(NOINK); R.add(m);
      return m;
    };
    for (let i = 0; i < 9; i++) cloud(i, ROAD - 200 + i * 50, 60 + (i % 3) * 26, -330 - (i % 2) * 70, 70 + (i % 3) * 25);
    for (let i = 0; i < 6; i++) { const m = cloud(i + 1, ROAD - 150 + i * 60, 55 + (i % 2) * 20, 330, 70); m.rotation.y = Math.PI; }
    for (let i = 0; i < 4; i++) { const m = cloud(i + 2, ROAD - 330, 50 + i * 12, -120 + i * 80, 70); m.rotation.y = Math.PI / 2; }
    buildCity(R);
    const rb = makeRobo(); this.robo = { ...rb, r: 0.36 }; R.add(rb.g);
    this.trol = makeTrolley().g; R.add(this.trol);
    for (const [gx, gz, dir] of [GATE_N, GATE_F]) {
      const a = makeGateArm(); a.g.position.set(gx, ARM_Y, gz); a.g.rotation.y = dir < 0 ? Math.PI / 2 : -Math.PI / 2; // local +x -> world -z / +z
      R.add(a.g); this.arms.push(a);
    }
    this.piece = makeArmPiece(); R.add(this.piece);
    // signal lamps: a red lens disc per lamp + a soft additive halo (both flash)
    const halo = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(1.6, 0.25, 0.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (const [x, y, z, face] of LAMPS) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.04, 0.03) }));
      lens.position.set(x + face * 0.005, y, z); lens.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; R.add(lens); this.lamps.push(lens);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), halo); h.position.set(x + face * 0.05, y, z); h.layers.set(NOINK); h.renderOrder = 3; R.add(h); this.halos.push(h);
    }
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
    cam.fov = c.fov; cam.near = 0.05; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const big = 16;
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
    this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- vehicles ----
    const cp = carPose(id, t);
    poseVeh(this.robo, cp, t);
    this.robo.dome.rotation.y = t * 9;
    const broken = glassBroken(id, t);
    if (this.robo.gm.map !== (broken ? this.robo.glassBroken : this.robo.glassOk)) { this.robo.gm.map = broken ? this.robo.glassBroken : this.robo.glassOk; this.robo.gm.needsUpdate = true; }
    this.robo.rev.forEach((m) => (m.material as THREE.MeshBasicMaterial).color.setRGB(cp.rev ? 3 : 0.3, cp.rev ? 3 : 0.3, cp.rev ? 2.9 : 0.3));
    const tp = trolleyPose(id, t);
    this.trol.visible = tp.vis;
    if (tp.vis) { this.trol.position.set(tp.x, 0.12, tp.z); this.trol.rotation.set(0, tp.yaw, 0); }
    // gate arms: down per story; the near arm swings as the car pushes it and snaps (piece flies off)
    const gk = gateK(id, t), as = armState(id, t);
    this.arms.forEach((a, i) => {
      a.hinge.rotation.z = (Math.PI / 2) * (1 - gk);
      a.g.rotation.y = (i === 0 ? Math.PI / 2 : -Math.PI / 2) + (i === 0 ? -as.swing : 0);
      a.rest.visible = !(i === 0 && as.snapped);
      a.lamps.forEach((l, k) => { l.visible = !(i === 0 && as.snapped && k > 0); (l.material as THREE.MeshBasicMaterial).color.setRGB(lampsOn(id, t) && (Math.floor(t * 2.2) + k) % 2 ? 3 : 0.5, 0.15, 0.1); });
    });
    const t0 = id === 1 ? HSNAP : id === 7 ? SNAP : Infinity;
    this.piece.visible = t >= t0 || id >= 8;
    if (this.piece.visible) {
      const d = id >= 8 ? 9 : t - t0, swing = as.swing;
      // starts in line with the arm's outer part, flies back (-x) and up, spins, lands on the road and slides
      const L0 = 0.9 + (ARM_L - 0.9) / 2, sx = GATE_N[0] - Math.sin(swing) * L0, sz = GATE_N[1] - Math.cos(swing) * L0;
      const fl = Math.min(d, 0.75), slide = Math.max(0, Math.min(d - 0.75, 0.5));
      const x = sx - 2.2 * fl - 1.2 * (slide - slide * slide), y = d < 0.75 ? ARM_Y + 2.6 * fl - 4.9 * fl * fl * 1.1 + 0.06 : 0.07, z = sz - 0.4 * fl;
      this.piece.position.set(x, Math.max(0.07, y), z);
      this.piece.rotation.set(d < 0.75 ? 0.3 * fl : 0, Math.PI / 2 - swing + (d < 0.75 ? 7 * fl : 5.25 + 0.6 * slide), d < 0.75 ? 4 * fl : 0);
      if (id === 9) { this.piece.position.set(-7.5, 0.07, -0.35); this.piece.rotation.set(0, 0.35, 0); }
    }
    const on = lampsOn(id, t);
    LAMPS.forEach(([, , , , pair], i) => {
      const lit = on && (Math.floor(t * 2.2) + pair) % 2 === 0;
      (this.lamps[i].material as THREE.MeshBasicMaterial).color.setRGB(lit ? 4 : 0.25, lit ? 0.5 : 0.04, lit ? 0.35 : 0.03);
      this.halos[i].visible = lit; this.halos[i].quaternion.copy(cam.quaternion);
    });

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
