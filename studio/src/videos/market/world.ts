// One three.js scene for the AI-Christmas-market short: the bare warehouse hall and the dream market of the ad
// (build.ts), plus the live parts: the AI banner (a real Seedream image, public/market/poster.jpg), fluorescent tubes,
// roll-down shutters, bucket water, fairy-light garlands + tree lights that twinkle, falling snow in the dream.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { staticFile } from "remotion";
import { buildHall, buildDream, lam, glow, BANNER, TUBES, HUT, hutPt, shutterTex } from "./build";
import { cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, HALL, HUTS, BUCKETS, DREAM_X, DREAM_HUTS, TREE, shutterAt, V3 } from "./story";

export const POSTER: { img: HTMLImageElement | null } = { img: null };
export const loadPoster = () => new Promise<void>((res) => {
  if (POSTER.img) return res();
  const img = new Image();
  img.onload = () => { POSTER.img = img; res(); };
  img.onerror = () => { console.error("poster texture failed"); res(); };
  img.src = staticFile("market/poster.jpg");
});

/** points along a hanging garland a -> b with sag */
const garland = (a: V3, b: V3, sag: number, n: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) { const u = i / n, m = 4 * u * (1 - u); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * m, a[2] + (b[2] - a[2]) * u]); }
  return out;
};
const hsh = (i: number) => { const v = Math.sin(i * 91.7 + 7.3) * 43758.5453; return v - Math.floor(v); };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private shutters: THREE.Mesh[] = [];
  private bulbs: THREE.InstancedMesh; private bulbBase: THREE.Color[] = [];
  private snow: THREE.Points; private snowBase: Float32Array;
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
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    buildHall(R);
    buildDream(R);

    // ---- the AI banner: the real generated image, unlit, slightly over 1 so it glows a little in the drab hall ----
    const img = POSTER.img;
    const tex = img ? new THREE.Texture(img) : null;
    if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(BANNER.w, BANNER.h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.08, 1.08, 1.08), fog: false }));
    banner.position.set(BANNER.x, BANNER.y0 + BANNER.h / 2, HALL.z0 + 0.07); banner.layers.set(NOINK); R.add(banner);

    // ---- fluorescent tubes (cool white, bloom) ----
    const tubeM = glow("tube", "#eef4ff", 2.2);
    for (const t of TUBES) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 8), tubeM); m.rotation.z = Math.PI / 2; m.position.set(t[0], t[1], t[2]); m.layers.set(NOINK); R.add(m); }
    // hanging wires of the tubes
    const wire = lam("wire", () => ({ color: "#30343c" }));
    for (const t of TUBES) for (const dx of [-0.6, 0.6]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), wire); m.position.set(t[0] + dx, t[1] + 0.44, t[2]); R.add(m); }

    // ---- shutters of the bare huts (roll down from the top of the opening) ----
    const shM = lam("shutterM", () => ({ map: shutterTex(), side: THREE.DoubleSide }));
    for (const h of HUTS) {
      const g = new THREE.PlaneGeometry(HUT.w - 0.2, 1); g.translate(0, -0.5, 0);
      const m = new THREE.Mesh(g, shM);
      const p = hutPt(h, 0, HUT.top, HUT.d / 2 + 0.03);
      m.position.set(...p); m.rotation.y = h.ry; m.castShadow = false; m.receiveShadow = true;
      R.add(m); this.shutters.push(m);
    }
    // ---- water in the buckets ----
    const waterM = lam("bucketWater", () => ({ color: "#7d93b8" }));
    for (const b of BUCKETS) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), waterM); m.rotation.x = -Math.PI / 2; m.position.set(b.x, 0.22, b.z); R.add(m); }

    // ---- the dream: fairy-light garlands (across the aisle, along the hut eaves, to the tree), tree baubles, star ----
    const pts: { p: V3; c: THREE.Color }[] = [];
    const warm = [new THREE.Color(3.0, 2.2, 1.1), new THREE.Color(3.0, 2.5, 1.5), new THREE.Color(2.6, 1.6, 0.8)];
    const add = (p: V3, c?: THREE.Color) => pts.push({ p, c: c ?? warm[pts.length % 3] });
    for (let i = 0; i < 7; i++) { // zig-zag garlands across the aisle at ridge height
      const z = 1.5 - i * 3.0, z2 = z - 1.6;
      for (const q of garland([DREAM_X - 4.6, 3.6, z], [DREAM_X + 4.6, 3.6, z2], 0.9, 26)) add(q);
    }
    for (let i = 0; i < 8; i++) { // long garlands from the hut rows up to the tree top
      const s = i % 2 ? 1 : -1, z = -1 - Math.floor(i / 2) * 4.2;
      for (const q of garland([DREAM_X + s * 4.4, 3.4, z], [TREE[0], 9.3, TREE[2]], 1.6, 40)) add(q);
    }
    for (const h of DREAM_HUTS) { // along the front roof edges of every hut
      const a = hutPt(h, -HUT.w / 2 - 0.28, HUT.h - 0.12, HUT.d / 2 + 0.47), m = hutPt(h, 0, HUT.ridge + 0.02, HUT.d / 2 + 0.47), b = hutPt(h, HUT.w / 2 + 0.28, HUT.h - 0.12, HUT.d / 2 + 0.47);
      for (const q of garland(a, m, 0.0, 7)) add(q);
      for (const q of garland(m, b, 0.0, 7)) add(q);
    }
    const bauble = [new THREE.Color(2.4, 0.35, 0.3), new THREE.Color(2.6, 2.0, 0.4), new THREE.Color(0.5, 1.2, 2.6), new THREE.Color(2.8, 2.4, 1.6)];
    for (let i = 0; i < 160; i++) { // spiral of lights + baubles on the tree cones
      const u = i / 160, y = 1.3 + u * 7.4, r = 3.3 * (1 - u * 0.86) * (0.92 + 0.08 * hsh(i)), a = u * 34 + hsh(i + 3) * 0.6;
      add([TREE[0] + r * Math.sin(a), y, TREE[2] + r * Math.cos(a)], bauble[i % 4]);
    }
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), pts.length);
    const mm = new THREE.Matrix4();
    pts.forEach((q, i) => { const s = i >= pts.length - 160 ? 2.1 : 1; mm.makeScale(s, s, s).setPosition(q.p[0], q.p[1], q.p[2]); this.bulbs.setMatrixAt(i, mm); this.bulbs.setColorAt(i, q.c); this.bulbBase.push(q.c.clone()); });
    this.bulbs.layers.set(NOINK); this.bulbs.frustumCulled = false; R.add(this.bulbs);
    // garland cords (thin dark lines under the bulbs) are skipped: at phone size the bulbs read as strings on their own
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glow("starM", "#ffd860", 3.2));
    star.position.set(TREE[0], 9.45, TREE[2]); star.scale.set(1, 1.25, 0.35); star.layers.set(NOINK); R.add(star);
    // falling snow: soft round points in a box around the dream aisle
    const N = 2600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = DREAM_X - 9 + 18 * hsh(i * 3 + 1); pos[i * 3 + 1] = 12 * hsh(i * 3 + 2); pos[i * 3 + 2] = 4.3 - 30 * hsh(i * 3 + 3); } // stays >= 2 m in front of the crane camera (z 6.5-9.5)
    this.snowBase = pos.slice();
    const flake = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.09, map: flake, transparent: true, depthWrite: false, color: new THREE.Color(1.2, 1.2, 1.3), fog: false, sizeAttenuation: true }));
    this.snow.layers.set(NOINK); this.snow.frustumCulled = false; R.add(this.snow);
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
    const Rr = THREE.MathUtils.clamp(dist * 1.3 + 2.5, 3, 16);
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
    void cloudHD;
    untone(L.fog, this.fog.color);
    this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;

    // ---- moving parts ----
    HUTS.forEach((_, i) => { const k = shutterAt(id, i, t); const m = this.shutters[i]; m.visible = k > 0.001; m.scale.y = Math.max(0.001, k * (HUT.top - HUT.sill)); });
    const dream = id === 2;
    this.bulbs.visible = dream; this.snow.visible = dream;
    if (dream) {
      // twinkle: each bulb breathes on its own phase; on "fairy lights" a wave of extra sparkle runs down the garlands
      const n = this.bulbBase.length, col = new THREE.Color();
      const wave = t - 6.0;
      for (let i = 0; i < n; i++) {
        const tw = 0.78 + 0.22 * Math.sin(t * (2.2 + 2.6 * hsh(i)) + hsh(i + 9) * 6.28);
        const w = wave > 0 && wave < 1.6 ? Math.max(0, 1 - Math.abs(wave * 1.3 - (i % 60) / 60) * 6) * 0.9 : 0;
        col.copy(this.bulbBase[i]).multiplyScalar(tw + w); this.bulbs.setColorAt(i, col);
      }
      this.bulbs.instanceColor!.needsUpdate = true;
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute, a = p.array as Float32Array, B0 = this.snowBase;
      for (let i = 0; i < a.length / 3; i++) {
        const sp = 0.55 + 0.35 * hsh(i + 77);
        let y = B0[i * 3 + 1] - sp * t; y = ((y % 12) + 12) % 12;
        a[i * 3 + 1] = y; a[i * 3] = B0[i * 3] + 0.25 * Math.sin(t * 0.9 + i); a[i * 3 + 2] = B0[i * 3 + 2] + 0.15 * Math.cos(t * 0.7 + i * 1.3);
      }
      p.needsUpdate = true;
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
