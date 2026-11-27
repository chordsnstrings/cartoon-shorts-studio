// The firefighting robot dog: a quadruped built from primitives (two-tone lit, inked by the world ink pass). Generic design
// (no logo): a silver quilted fireproof COAT over the body and upper legs, dark grey lower legs, black rubber feet (or the
// bright orange new feet), a boxy head with a dark visor and two cyan LED eyes, a lidar puck and a little antenna on the back.
// ~0.85 m long at scale 1. Nose toward +z at yaw 0. Legs are solved per frame (two-bone IK in the leg's sagittal plane).
import * as THREE from "three";
import { lam, glow, cyl } from "./build";
import { ctex } from "./paint";
import { NOINK } from "./ink";
import { DogState, clamp01 } from "./story";

/** quilted silver fabric: diamond stitching, soft sheen bands */
const coatTex = () => ctex("dogCoat", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 512, 512);
  gr.addColorStop(0, "#b3b9c4"); gr.addColorStop(0.45, "#dfe3ea"); gr.addColorStop(0.55, "#a9b0bc"); gr.addColorStop(1, "#c4cad3");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(70,72,90,0.55)"; g.lineWidth = 5;
  for (let i = -512; i < 1024; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke(); g.beginPath(); g.moveTo(i + 512, 0); g.lineTo(i, 512); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = -512; i < 1024; i += 128) { g.beginPath(); g.moveTo(i + 20, 0); g.lineTo(i + 532, 512); g.lineTo(i + 552, 512); g.lineTo(i + 40, 0); g.fill(); }
});
const visorTex = () => ctex("dogVisor", 256, 128, (g) => {
  g.fillStyle = "#1c2230"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.moveTo(20, 20); g.lineTo(90, 20); g.lineTo(60, 108); g.lineTo(-10, 108); g.fill();
});

const L1 = 0.27, L2 = 0.27;
type Leg = { hip: THREE.Group; knee: THREE.Group; foot: THREE.Mesh; fire: THREE.Object3D; front: boolean; sx: number; hz: number; pair: number };

export class Dog {
  g = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legs: Leg[] = [];
  private eyes: THREE.Mesh[] = [];
  private arcs: THREE.Mesh[] = [];
  private antenna = new THREE.Group();
  private rubber: THREE.Material; private orange: THREE.Material;
  private eyeOn: THREE.Material; private eyeOff: THREE.Material;
  feet: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  headPos = new THREE.Vector3();
  visible = false;

  constructor(parent: THREE.Object3D) {
    const coat = lam("dogCoat", () => ({ map: coatTex() })), trim = lam("dogTrim", () => ({ color: "#9aa0ac" }));
    const dark = lam("dogDark", () => ({ color: "#3a3f4c" })), joint = lam("dogJoint", () => ({ color: "#5b6170" }));
    const shell = lam("dogShell", () => ({ color: "#e9a23a" }));
    this.rubber = lam("dogRubber", () => ({ color: "#1d1e24" })); this.orange = lam("dogNewFeet", () => ({ color: "#ff7a1e" }));
    this.eyeOn = glow("dogEyeOn", "#9ff6ff", 3.2); this.eyeOff = lam("dogEyeOff", () => ({ color: "#46506a" }));
    this.g.add(this.body);
    // body: a rounded box under the coat (the coat is a slightly bigger rounded box with quilting + a dark trim hem)
    const rb = (w: number, h: number, d: number, r: number) => { const gg = new THREE.CapsuleGeometry(r, d - 2 * r, 6, 16); gg.rotateX(Math.PI / 2); gg.scale(w / (2 * r), h / (2 * r), 1); return gg; };
    const core = new THREE.Mesh(rb(0.3, 0.2, 0.66, 0.1), dark); core.position.y = 0; this.body.add(core);
    const coatM = new THREE.Mesh(rb(0.38, 0.26, 0.78, 0.13), coat); coatM.position.y = 0.035; this.body.add(coatM);
    const hem = new THREE.Mesh(rb(0.39, 0.05, 0.8, 0.025), trim); hem.position.y = -0.065; this.body.add(hem);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), trim); collar.position.set(0, 0.06, 0.37); this.body.add(collar);
    // lidar puck + antenna on the back
    const puck = new THREE.Mesh(cyl(0.07, 0.07, 0.07, 18), dark); puck.position.set(0, 0.17, 0.12); this.body.add(puck);
    const lens = new THREE.Mesh(cyl(0.05, 0.05, 0.03, 16), glow("dogLidar", "#ff5a4a", 1.4)); lens.position.set(0, 0.235, 0.12); this.body.add(lens);
    this.antenna.position.set(0.07, 0.15, -0.28); this.body.add(this.antenna);
    const rod = new THREE.Mesh(cyl(0.008, 0.008, 0.22, 6), dark); this.antenna.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), glow("dogTip", "#ffd84a", 1.6)); tip.position.y = 0.23; this.antenna.add(tip);
    // head: boxy, orange shell, dark visor with two eyes
    this.head.position.set(0, 0.08, 0.44); this.body.add(this.head);
    const hb = new THREE.Mesh(rb(0.24, 0.17, 0.22, 0.07), shell); hb.position.set(0, 0.04, 0.06); this.head.add(hb);
    const vis = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), lam("dogVisorM", () => ({ map: visorTex() }))); vis.position.set(0, 0.045, 0.172); this.head.add(vis);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), this.eyeOn); e.position.set(sx * 0.048, 0.05, 0.175); e.layers.set(NOINK); this.head.add(e); this.eyes.push(e);
      const a = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.026, 16, 1, 0, Math.PI), this.eyeOn); a.position.set(sx * 0.048, 0.04, 0.175); a.layers.set(NOINK); this.head.add(a); this.arcs.push(a);
    }
    // legs: hip group (upper leg in the coat sleeve) -> knee group (dark lower leg) -> foot
    const sleeve = new THREE.Mesh(cyl(0.05, 0.065, L1, 12), coat); sleeve.rotation.x = Math.PI; // hangs down from the hip
    const lower = new THREE.Mesh(cyl(0.03, 0.04, L2, 10), dark); lower.rotation.x = Math.PI;
    let pair = 0;
    for (const front of [true, false]) for (const sx of [-1, 1]) {
      const hip = new THREE.Group(), knee = new THREE.Group();
      const up = sleeve.clone(); hip.add(up);
      const kj = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), joint); kj.position.y = -L1; hip.add(kj);
      knee.position.y = -L1; hip.add(knee);
      knee.add(lower.clone());
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), this.rubber); foot.scale.set(1, 0.75, 1.15); foot.position.y = -L2; knee.add(foot);
      const fire = new THREE.Object3D(); fire.position.y = -L2; knee.add(fire);
      this.g.add(hip);
      this.legs.push({ hip, knee, foot, fire, front, sx, hz: front ? 0.3 : -0.3, pair: (front ? 0 : 1) ^ (sx > 0 ? 1 : 0) });
      pair++;
    }
    this.g.traverse((o) => { if (o instanceof THREE.Mesh && !o.layers.isEnabled(NOINK)) o.castShadow = true; });
    this.g.visible = false;
    parent.add(this.g);
  }

  pose(s: DogState | null, t: number) {
    this.visible = !!s;
    if (!s) { this.g.visible = false; return; }
    this.g.visible = true;
    const S = s.scale, sit = s.sit ?? 0, slope = s.slope ?? 0;
    this.g.position.set(...s.p); this.g.rotation.set(0, s.yaw, 0); this.g.scale.setScalar(S);
    const ph = s.gait * Math.PI * 2, st = s.stride;
    // body: hip height 0.5, trot bob, sitting tips the nose up around the rear hips; on stairs it pitches with the slope
    const bob = st * 0.018 * Math.cos(ph * 2) + (st ? 0 : 0.006 * Math.sin(t * 2.2));
    const pitch = -slope - sit * 0.55, hy = 0.5 - sit * 0.04 + bob; // rotation.x < 0 = nose up
    this.body.position.set(0, hy, 0); this.body.rotation.set(pitch, 0, 0);
    this.head.rotation.set((s.head ?? 0) + sit * 0.4, s.headYaw ?? 0, 0);
    this.antenna.rotation.set(0, 0, (s.wag ?? 0) * 0.45 * Math.sin(t * 14) + 0.05 * Math.sin(t * 3));
    const happy = s.eye === 2;
    this.eyes.forEach((e) => { e.visible = !happy; e.material = s.eye > 0 ? this.eyeOn : this.eyeOff; });
    this.arcs.forEach((a) => (a.visible = happy));
    for (const L of this.legs) L.foot.material = s.newFeet ? this.orange : this.rubber;
    // legs
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      // hip point in the dog frame (body pitched about its centre)
      const hz0 = L.hz, hy0 = -0.04;
      const hz = hy0 * sp + hz0 * cp, hyy = this.body.position.y + hy0 * cp - hz0 * sp;
      L.hip.position.set(L.sx * 0.15, hyy, hz);
      // foot target: under the hip on the ground (slope plane), stepping with the trot
      const lp = ph + (L.pair ? Math.PI : 0);
      let fz = hz + st * 0.15 * Math.sin(lp), lift = st * Math.max(0, Math.cos(lp)) * 0.09;
      if (sit && !L.front) fz = hz + 0.12 * sit;
      if (sit && L.front) fz = hz;
      const tap = s.tap ?? 0;
      if (tap > 0) { const k = (tap + i * 0.25) % 1; lift += k < 0.35 ? Math.sin((k / 0.35) * Math.PI) * 0.08 : 0; }
      const gy = Math.tan(slope) * fz; // ground under the foot (dog frame)
      const fy = gy + 0.05 + lift;
      // two-bone IK in the y-z plane
      const dz = fz - hz, dy = fy - hyy, d = Math.min(L1 + L2 - 0.001, Math.max(0.08, Math.hypot(dz, dy)));
      const base = Math.atan2(dz, -dy), A = Math.acos(clamp01((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
      const a1 = base - A; // upper leg angle from straight down toward +z; every knee points backward (robot-dog stance)
      const kneeZ = Math.sin(a1) * L1, kneeY = -Math.cos(a1) * L1;
      const a2 = Math.atan2(dz - kneeZ, -(dy - kneeY));
      L.hip.rotation.set(-a1, 0, 0); L.knee.rotation.set(-(a2 - a1), 0, 0); // rotation.x > 0 swings a hanging point toward -z
    }
    this.g.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) this.legs[i].fire.getWorldPosition(this.feet[i]);
    this.head.getWorldPosition(this.headPos);
  }
}
