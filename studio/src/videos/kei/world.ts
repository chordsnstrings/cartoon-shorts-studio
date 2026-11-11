// One three.js scene with both places of the kei-truck short (country road x 0, showroom x + 400), the vehicles (the tiny
// kei truck with its hinged door, the big red pickup, traffic cars, hay bales, the dust sheet and turntable, spotlight
// cones), the sky and the light rig; update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { buildStreet, buildShowroom, makeKei, makeTruck, makeCar, makeBale, makeTurntable, makeSheet, glow } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, ShotDef, ROAD, SHOW, keiPose, bigPose, trafficAt, doorK, sheetK, spotsOn, baleDrop, BALES, Pose, BIG_S, W, smooth,
} from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const beamTex = () => ctex("beam", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0.0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
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
  private kei: Veh & { door: THREE.Group }; private big: Veh; private cars: Veh[] = [];
  private bales: THREE.Mesh[] = []; private turn: THREE.Mesh; private sheet: THREE.Mesh;
  private beams: THREE.Mesh[] = []; private cans: THREE.Mesh[] = [];
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
    buildStreet(R); buildShowroom(R);
    const k = makeKei(); this.kei = { g: k.g, wheels: k.wheels, door: k.door, r: 0.29 }; R.add(k.g);
    const b = makeTruck(); this.big = { g: b.g, wheels: b.wheels, r: 0.44 }; R.add(b.g);
    [["#3a64b8", "carBlue"], ["#f2c43a", "carYellow"], ["#efece4", "carWhite"], ["#7b5ac9", "carPurple"], ["#2fa39a", "carTeal"], ["#e8883a", "carOrange"]].forEach(([c, key]) => {
      const m = makeCar(c, key); const v = { g: m.g, wheels: m.wheels, r: 0.34 }; v.g.visible = false; R.add(v.g); this.cars.push(v);
    });
    for (let i = 0; i < 4; i++) { const m = makeBale(); m.visible = false; R.add(m); this.bales.push(m); }
    this.turn = makeTurntable(); this.turn.position.set(SHOW, 0, 0); R.add(this.turn);
    this.sheet = makeSheet(); R.add(this.sheet);
    // showroom spotlights: emissive cans on the truss + soft beam cones toward the truck
    for (const x of [-4.2, -1.6, 1.6, 4.2]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.42, 16), glow("canOn", "#fff3d0", 3.0)); can.position.set(SHOW + x, 5.35, 1.98); R.add(can); this.cans.push(can);
      const top = new THREE.Vector3(SHOW + x, 5.2, 1.98), tgt = new THREE.Vector3(SHOW + x * 0.25, 0, 0);
      const len = top.distanceTo(tgt);
      const cg = new THREE.CylinderGeometry(0.12, 1.15, len, 24, 1, true); cg.translate(0, -len / 2, 0);
      const beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: beamTex(), color: new THREE.Color(1.0, 0.95, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.position.copy(top); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tgt.clone().sub(top).normalize());
      beam.layers.set(NOINK); beam.renderOrder = 2; R.add(beam); this.beams.push(beam);
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
    const big = s.place === "show" ? 9 : 16;
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
    const kp = keiPose(id, t);
    poseVeh(this.kei, kp, t);
    this.kei.door.rotation.y = -1.15 * doorK(id, t);
    if (id === 11) this.kei.g.rotation.y = -0.5 + 0.12 * smooth((t - W.scion) / 1.2) + 0.03 * (t - 25.35);
    poseVeh(this.big, bigPose(id, t), t, BIG_S);
    const tr = trafficAt(id, t);
    this.cars.forEach((cv, i) => { if (i < tr.length) poseVeh(cv, tr[i], t); else cv.g.visible = false; });
    // hay bales: fall into the bed (shot 8) and ride along over the mound (shot 9)
    const slots: [number, number, number][] = [[-1.15, 0.83, 0.22], [-1.15, 0.83, -0.24], [-0.2, 0.83, 0.0], [-0.7, 1.25, 0.0]];
    this.bales.forEach((m, i) => {
      const show = (id === 8 && t > BALES[i] - 0.32) || id === 9;
      m.visible = show;
      if (!show) return;
      const u = id === 8 ? baleDrop(i, t) : 1;
      const [lx, ly, lz] = slots[i];
      const p = new THREE.Vector3(lx, ly + 3.2 * (1 - u) * (1 - u), lz).applyEuler(this.kei.g.rotation).add(this.kei.g.position);
      m.position.copy(p); m.rotation.copy(this.kei.g.rotation); m.rotateY(i === 3 ? 0.3 : 0.05 * i); m.rotateZ((1 - u) * 0.6 * (i % 2 ? 1 : -1));
    });
    // showroom: turntable, dust sheet, spotlights
    this.turn.visible = s.place === "show";
    this.turn.rotation.y = this.kei.g.rotation.y;
    const sk = sheetK(t);
    this.sheet.visible = id === 11 && sk < 1;
    if (this.sheet.visible) {
      this.sheet.position.set(SHOW + 2.8 * sk * sk, 0.36 + 3.2 * sk * (1 - 0.3 * sk), -1.2 * sk); this.sheet.rotation.set(0.6 * sk, -0.5 + 0.8 * sk, 0.9 * sk * sk);
      this.sheet.scale.set(1 - 0.35 * sk, 0.83 - 0.5 * sk, 1 + 0.3 * sk);
    }
    const on = id === 11 && spotsOn(t);
    this.beams.forEach((b, i) => { b.visible = on && t > W.scion - 0.07 + 0.05 * i; });
    this.cans.forEach((m) => { m.visible = s.place === "show"; (m.material as THREE.MeshBasicMaterial).color.setRGB(on ? 3 : 0.25, on ? 2.85 : 0.22, on ? 2.4 : 0.2); });

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
