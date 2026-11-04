// One three.js scene with every place of the satellite short (space + cartoon Earth, launch pad, lab, clean room,
// mission control, Arctic station, park), the moving parts (Earth spin, rocket, proton beam, wall-screen dot, dish,
// cable, laser, lamp), the sky (+ stars, sun disc) and the light rig; update(id, f, camera) poses everything for shot
// `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { staticFile } from "remotion";
import { buildPad, buildLab, buildClean, buildCtrl, buildStation, buildPark, lam, glow, cyl, starsTex, wallScreenTex, DISH_AT, PANEL_AT, LAMP_AT } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, PAD, PARK, CTRL, LAB, ROCKET, CHIP_AT, EARTH_R, EARTH_Y, rocketY, beamOn, orbitAng, W, SAT2, satPos } from "./story";

const glowTex = () => ctex("glowDisc", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.28, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
const rocketTex = () => ctex("rocketBody", 512, 1024, (g) => {
  g.fillStyle = "#f4f2ec"; g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "#2a2834"; for (const y of [120, 520, 860]) g.fillRect(0, y, 512, 40);
  g.fillStyle = "#3a64b8"; g.fillRect(0, 300, 512, 18);
  g.fillStyle = "rgba(0,0,0,0.06)"; for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 4, 1024);
});

/** the Earth map image, loaded once before any canvas mounts (see Short.tsx) */
export const EARTH: { img: HTMLImageElement | null } = { img: null };
export const loadEarth = () => new Promise<void>((res) => {
  if (EARTH.img) return res();
  const img = new Image();
  img.onload = () => { EARTH.img = img; res(); };
  img.onerror = () => { console.error("earth texture failed"); res(); };
  img.src = staticFile("orbit/earth.jpg");
});

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
  private rocket = new THREE.Group(); private flame: THREE.Group;
  private beam: THREE.Mesh; private laser: THREE.Mesh; private orbitDot: THREE.Mesh;
  private dish = new THREE.Group(); private cable: THREE.Mesh; private lamp: THREE.Mesh;
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
    // clouds over the pad and the park
    for (const [cx, n] of [[PAD, 7], [PARK, 6]] as const) for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudHD(i % 4, LOOK.day.cloud), color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 70 + (i % 3) * 25;
      m.position.set(cx - 180 + i * 60, 70 + (i % 3) * 22, -330 - (i % 2) * 60); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); R.add(m);
    }
    buildPad(R); buildLab(R); buildClean(R); buildCtrl(R); buildStation(R); buildPark(R);

    // ---- the cartoon Earth (painted map from a ModelArk Seedream plate, public/orbit/earth.jpg) ----
    // the painted map is preloaded by Short.tsx (the canvas only mounts once it has arrived: a texture that lands
    // after the first GL render would never be drawn, nothing re-renders a held frame)
    const eTex = new THREE.Texture(EARTH.img ?? undefined); eTex.colorSpace = THREE.SRGBColorSpace; eTex.anisotropy = 8; eTex.needsUpdate = !!EARTH.img;
    const eMat = lam("earth", () => ({ color: "#ffffff", map: eTex }));
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 96), eMat);
    this.earthMesh.receiveShadow = false;
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.018, 128, 96), new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0.45, 0.78, 1.6) } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(col, pow(r, 5.0) * 0.85); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.BackSide,
    }));
    atmo.layers.set(NOINK);
    this.earth.add(this.earthMesh, atmo);
    this.earth.position.set(0, EARTH_Y, 0);
    this.earth.rotation.set(-1.3, 0, 0.25); // equator up toward the satellite (the map's poles are ice)
    R.add(this.earth);

    // ---- rocket (white body, black bands, nose cone, fins) + flame ----
    const body = lam("rocketB", () => ({ map: rocketTex() })), dark = lam("rocketD", () => ({ color: "#2a2834" }));
    const rb = new THREE.Mesh(cyl(1.8, 1.8, 28, 32), body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.95, 6, 32).translate(0, 31, 0), lam("fairing", () => ({ color: "#f4f2ec" })));
    const fair = new THREE.Mesh(cyl(1.8, 1.95, 3, 32).translate(0, 25, 0), lam("fairing", () => ({ color: "#f4f2ec" })));
    this.rocket.add(rb, nose, fair);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4, 2.2).translate(0, 2, 2.4), dark); fin.rotation.y = (i * Math.PI) / 2 + Math.PI / 4; this.rocket.add(fin);
    }
    const eng = new THREE.Mesh(cyl(1.2, 1.5, 1.2, 24).translate(0, -1.2, 0), dark); this.rocket.add(eng);
    this.flame = new THREE.Group();
    const fl1 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 24, 1, true).rotateX(Math.PI).translate(0, -5.6, 0), glow("flameO", "#ff9a3a", 3.2));
    const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 20, 1, true).rotateX(Math.PI).translate(0, -3.6, 0), glow("flameI", "#fff2c0", 5));
    fl1.layers.set(NOINK); fl2.layers.set(NOINK); this.flame.add(fl1, fl2);
    this.rocket.add(this.flame);
    this.rocket.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.rocket.position.set(...ROCKET);
    R.add(this.rocket);

    // ---- proton beam (glowing violet rod from the nozzle to the chip) ----
    const bl = CHIP_AT[0] - 0.12 - (LAB - 0.45);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, bl, 12).rotateZ(Math.PI / 2), glow("beam", "#c9a4ff", 4));
    this.beam.position.set(LAB - 0.45 + bl / 2, CHIP_AT[1], CHIP_AT[2]); this.beam.layers.set(NOINK); R.add(this.beam);
    // ---- laser between the twin satellites ----
    this.laser = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), glow("laser", "#ff4a6a", 4));
    this.laser.layers.set(NOINK); R.add(this.laser);
    // ---- control-room wall screen + moving orbit dot ----
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.48), glow("wallScreen", "#ffffff", 1.05, wallScreenTex()));
    scr.position.set(CTRL, 2.0, -3.89); R.add(scr);
    this.orbitDot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), glow("orbitDot", "#ffe14a", 3));
    this.orbitDot.layers.set(NOINK); R.add(this.orbitDot);
    // ---- the dish (paraboloid + feed) on its pedestal ----
    const prof: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const r = (3.6 * i) / 12; prof.push(new THREE.Vector2(r, (r * r) / 9)); }
    const dm = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), lam("dishM", () => ({ color: "#f4f5f8", side: THREE.DoubleSide })));
    const feed = new THREE.Mesh(cyl(0.12, 0.12, 2.4, 10), lam("feed", () => ({ color: "#c9ced8" })));
    const fh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8).translate(0, 2.4, 0), lam("feed", () => ({ color: "#c9ced8" })));
    this.dish.add(dm, feed, fh);
    this.dish.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.dish.position.set(DISH_AT[0], 3.4, DISH_AT[2]);
    R.add(this.dish);
    // ---- park: cable from the panel's junction box to the phone, lamp bulb ----
    const c0 = new THREE.Vector3(PANEL_AT[0] - 0.12, 0.38, PANEL_AT[2] + 0.05), c3 = new THREE.Vector3(PARK + 0.33, 0.98, 0.16);
    const curve = new THREE.CatmullRomCurve3([c0, new THREE.Vector3(c0.x - 0.15, 0.03, c0.z + 0.2), new THREE.Vector3((c0.x + c3.x) / 2, 0.04, 0.15), new THREE.Vector3(c3.x + 0.05, 0.45, c3.z + 0.02), c3]);
    this.cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.012, 8), lam("cable", () => ({ color: "#f2f2f4" })));
    this.cable.castShadow = true; R.add(this.cable);
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), glow("lampOn", "#ffe2a0", 3));
    this.lamp.position.set(...LAMP_AT); this.lamp.layers.set(NOINK); R.add(this.lamp);
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
    cam.fov = c.fov; cam.near = 0.03; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const big = s.place === "pad" ? 90 : s.place === "sta" ? 50 : s.place === "park" ? 16 : 10;
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
    this.stars.position.copy(cam.position);
    this.stars.visible = s.light === "space" || s.light === "night";
    (this.stars.material as THREE.MeshBasicMaterial).opacity = s.light === "night" ? 0.55 : 1;
    // sun disc: space (white, small) and golden exteriors (big, peach)
    const showSun = s.light === "space" || s.light === "golden";
    this.sunDisc.visible = showSun;
    if (showSun) {
      const d = s.light === "space" ? 900 : 950, size = s.light === "space" ? 70 : 120;
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, d);
      this.sunDisc.quaternion.copy(cam.quaternion); this.sunDisc.scale.set(size, size, 1);
      (this.sunDisc.material as THREE.MeshBasicMaterial).color.setRGB(...((s.light === "space" ? [3.2, 3.1, 2.9] : [3.0, 2.2, 1.4]) as [number, number, number]));
    }
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    // ---- moving parts ----
    this.earth.visible = s.place === "space";
    this.earthMesh.rotation.y = 2.62 + t * 0.004;
    this.rocket.position.y = rocketY(t);
    this.flame.visible = t >= W.lifts - 0.03;
    this.flame.scale.set(1, 0.9 + 0.15 * Math.sin(t * 47) + Math.min(1, (t - W.lifts) * 2) * 0.4, 1);
    this.beam.visible = beamOn(t);
    this.beam.scale.set(1, 0.8 + 0.4 * Math.abs(Math.sin(t * 53)), 0.8 + 0.4 * Math.abs(Math.sin(t * 53)));
    const a = orbitAng(t);
    const th = -0.15, ox = 1.42 * Math.cos(a), oy = 0.86 * Math.sin(a);
    this.orbitDot.position.set(CTRL + ox * Math.cos(th) - oy * Math.sin(th), 2.0 - (ox * Math.sin(th) + oy * Math.cos(th)), -3.885);
    this.dish.rotation.set(-0.85 + 0.03 * Math.sin(t * 0.4), 1.15 + 0.02 * t, 0, "YXZ");
    this.cable.visible = t < W.unplugged - 2 / FPS;
    this.lamp.visible = s.place === "park";
    (this.lamp.material as THREE.MeshBasicMaterial).color.setRGB(...((s.light === "night" ? [3, 2.6, 1.8] : [0.9, 0.85, 0.75]) as [number, number, number]));
    // laser: from the hero to its twin, from "laser" on
    const lz = id === 20 && t >= W.laser - 2 / FPS;
    this.laser.visible = lz;
    if (lz) {
      const p0 = new THREE.Vector3(...satPos(t)).add(new THREE.Vector3(-0.45, 0.0, 0)), p1 = new THREE.Vector3(...SAT2).add(new THREE.Vector3(0.45, 0.0, 0));
      this.laser.position.copy(p0).add(p1).multiplyScalar(0.5);
      this.laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      this.laser.scale.set(1 + 0.3 * Math.sin(t * 60), p0.distanceTo(p1), 1 + 0.3 * Math.sin(t * 60));
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
