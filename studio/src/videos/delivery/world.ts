// One three.js scene for the delivery-drone short: the suburban yard (build.ts), the delivery drone, the parcel, the
// fibre line + power drop (live tubes, wobble / snag), the neighbour's live windows, the night ladder; update(id, f, camera)
// poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { buildYard, lam, glow, B_WINDOWS } from "./build";
import { Drone } from "./drone3d";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, droneAt, parcelAt, cableAt, powerOn, HOUSE_B, GARAGE, V3 } from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const winTex = (on: boolean) => ctex(on ? "winOn" : "winOff", 128, 128, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 128);
  if (on) { gr.addColorStop(0, "#fff0b0"); gr.addColorStop(1, "#ffb648"); } else { gr.addColorStop(0, "#1c2234"); gr.addColorStop(1, "#10141f"); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#f4f0e6"; g.fillRect(60, 0, 8, 128); g.fillRect(0, 60, 128, 8);
  if (!on) { g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(10, 50); g.lineTo(50, 10); g.lineTo(58, 10); g.lineTo(18, 50); g.fill(); }
});
/** a hanging line: catenary a -> b (or a -> via -> b), wobble = vertical swing of the middle */
const cablePts = (a: V3, b: V3, sag: number, wob: number, via?: V3, n = 48) => {
  const out: THREE.Vector3[] = [];
  if (!via) {
    for (let i = 0; i <= n; i++) { const u = i / n, m = 4 * u * (1 - u); out.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - (sag + wob) * m, a[2] + (b[2] - a[2]) * u)); }
    return out;
  }
  const h = n / 2;
  for (let i = 0; i <= h; i++) { const u = i / h, m = 4 * u * (1 - u); out.push(new THREE.Vector3(a[0] + (via[0] - a[0]) * u, a[1] + (via[1] - a[1]) * u - sag * m, a[2] + (via[2] - a[2]) * u)); }
  for (let i = 1; i <= h; i++) { const u = i / h, m = 4 * u * (1 - u); out.push(new THREE.Vector3(via[0] + (b[0] - via[0]) * u, via[1] + (b[1] - via[1]) * u - sag * m, via[2] + (b[2] - via[2]) * u)); }
  return out;
};
class Cable {
  mesh: THREE.Mesh; private r: number;
  constructor(parent: THREE.Object3D, col: string, r: number) { this.r = r; this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), lam("cable" + col, () => ({ color: col }))); this.mesh.castShadow = true; this.mesh.frustumCulled = false; parent.add(this.mesh); }
  set(pts: THREE.Vector3[]) { this.mesh.geometry.dispose(); this.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, this.r, 6, false); }
}

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
  private wins: THREE.Mesh[] = []; private winOn: THREE.Material; private winOff: THREE.Material;
  private fiber: Cable; private power: Cable; private parcel: THREE.Group; private ladder: THREE.Group;
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
    buildYard(R);
    // ---- the neighbour's windows: warm lit glass / dark glass ----
    this.winOn = glow("winOnM", "#ffffff", 1.6, winTex(true)); this.winOff = lam("winOffM", () => ({ map: winTex(false) }));
    for (const [x, y, w, h] of B_WINDOWS) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.winOn); m.position.set(x + w / 2, y + h / 2, HOUSE_B.zf + 0.02); R.add(m); this.wins.push(m); }
    // ---- lines: the fibre (black, thin), the power drop (dark grey), static lines along the street ----
    this.fiber = new Cable(R, "#1e1f26", 0.022); this.power = new Cable(R, "#33343c", 0.03);
    const street = new Cable(R, "#2a2b33", 0.028); street.set(cablePts([-60, 6.6, 8.4], [-0.6, 6.6, 8.4], 0.9, 0));
    const st2 = new Cable(R, "#2a2b33", 0.028); st2.set(cablePts([-0.6, 6.6, 8.4], [4.6, 7.95, 8.4], 0.3, 0));
    const st3 = new Cable(R, "#2a2b33", 0.028); st3.set(cablePts([4.6, 7.95, 8.4], [60, 7.95, 8.4], 0.9, 0));
    // ---- the parcel (after the drop) ----
    this.parcel = new THREE.Group();
    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), lam("dvBox", () => ({ color: "#c9965e" }))); pb.castShadow = true;
    const pt = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.245, 0.06), lam("dvTape", () => ({ color: "#e8d6b0" })));
    this.parcel.add(pb, pt); this.parcel.scale.setScalar(1.25); R.add(this.parcel);
    // ---- the retrieval ladder against the garage front (night shot only) ----
    this.ladder = new THREE.Group();
    const al = lam("ladder", () => ({ color: "#c9ccd4" }));
    for (const sx of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.6, 0.06), al); r.position.set(sx, 1.8, 0); this.ladder.add(r); }
    for (let i = 0; i < 11; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), al); r.position.set(0, 0.3 + i * 0.3, 0); this.ladder.add(r); }
    this.ladder.position.set(6.1, 0, GARAGE.zf + 0.75); this.ladder.rotation.x = -0.2; this.ladder.traverse((o) => { o.castShadow = true; }); R.add(this.ladder);
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
    const big = 14;
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
        const on = powerOn(id, t);
    for (const m of this.wins) m.material = on ? this.winOn : this.winOff;
    const fc = cableAt("fiber", id, t), pc = cableAt("power", id, t);
    this.fiber.set(cablePts(fc.a, fc.b, fc.sag, fc.wob, fc.via)); this.power.set(cablePts(pc.a, pc.b, pc.sag, pc.wob, pc.via));
    const pp = id >= 3 && id <= 4 ? parcelAt(t) : id === 5 || id === 7 ? [-3.4, 0.12, 2.75] as V3 : null;
    this.parcel.visible = !!pp; if (pp) { this.parcel.position.set(...pp); this.parcel.rotation.set(0, 0.4, 0); }
    this.ladder.visible = id === 8;
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
