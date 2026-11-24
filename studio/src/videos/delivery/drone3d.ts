// The delivery drone: a big hexacopter built from primitives (two-tone lit, inked by the world ink pass). Generic design
// (no logo): white rounded fuselage with a blue stripe, a dark hexagonal frame ring with six shrouded rotors, two skids,
// a cardboard box clipped underneath until the drop. ~1.7 m across. Nose toward +z at yaw 0.
import * as THREE from "three";
import { lam, glow, cyl } from "./build";
import { NOINK } from "./ink";
import { DroneState } from "./story";

const capsule = (r: number, len: number) => { const g = new THREE.CapsuleGeometry(r, len, 8, 20); g.rotateX(Math.PI / 2); return g; };

export const ROTORS = 6, RIM = 0.8;
export class Drone {
  g = new THREE.Group();
  private tilt = new THREE.Group();
  private blades: THREE.Mesh[] = [];
  private discs: THREE.Mesh[] = [];
  private stub: THREE.Mesh;
  private box: THREE.Group;
  private leds: THREE.Mesh[] = [];
  private ledOn: THREE.Material; private ledOff: THREE.Material;
  constructor(parent: THREE.Object3D) {
    const white = lam("dvWhite", () => ({ color: "#f4f1ea" })), dark = lam("dvDark", () => ({ color: "#2f3646" })), blue = lam("dvBlue", () => ({ color: "#2f86d8" }));
    const black = lam("dvBlack", () => ({ color: "#1b1e26" }));
    const T = this.tilt;
    this.g.add(T);
    const body = new THREE.Mesh(capsule(0.2, 0.55), white); body.scale.set(1.15, 0.85, 1); T.add(body);
    const stripe = new THREE.Mesh(capsule(0.205, 0.5), blue); stripe.scale.set(1.16, 0.18, 1.0); stripe.position.y = 0.02; T.add(stripe);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark); dome.scale.set(1, 0.55, 1.4); dome.position.set(0, 0.14, 0.05); T.add(dome);
    // hex frame ring + struts + six shrouded rotors at the corners
    const hex: THREE.Vector3[] = [];
    for (let i = 0; i < ROTORS; i++) { const a = (i / ROTORS) * Math.PI * 2 + Math.PI / 6; hex.push(new THREE.Vector3(RIM * Math.sin(a), 0, RIM * Math.cos(a))); }
    const ring = new THREE.TorusGeometry(0.24, 0.028, 10, 36); ring.rotateX(Math.PI / 2);
    for (let i = 0; i < ROTORS; i++) {
      const a = hex[i], b = hex[(i + 1) % ROTORS], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len * 0.62), dark); beam.position.copy(mid); beam.lookAt(b.x, 0, b.z); T.add(beam);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, RIM * 0.7), dark); strut.position.copy(a.clone().multiplyScalar(0.55)); strut.lookAt(a); T.add(strut);
      const sh = new THREE.Mesh(ring, i % 2 ? white : blue); sh.position.set(a.x, 0.03, a.z); T.add(sh);
      const hub = new THREE.Mesh(cyl(0.035, 0.035, 0.07, 12), dark); hub.position.set(a.x, -0.01, a.z); T.add(hub);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.008, 0.05), black); bl.position.set(a.x, 0.06, a.z); T.add(bl); this.blades.push(bl);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), new THREE.MeshBasicMaterial({ color: "#c9d2de", transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(a.x, 0.06, a.z); disc.layers.set(NOINK); T.add(disc); this.discs.push(disc);
    }
    // the broken rotor: a bent stub left on hub 0
    this.stub = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.05), black); this.stub.position.set(hex[0].x + 0.04, 0.07, hex[0].z); this.stub.rotation.set(0.3, 0.6, 0.4); T.add(this.stub);
    // nose LEDs ("eyes") + skids
    this.ledOn = glow("dvLedOn", "#bff4ff", 3.0); this.ledOff = lam("dvLedOff", () => ({ color: "#5a6070" }));
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), this.ledOn); l.position.set(sx * 0.09, 0.05, 0.44); T.add(l); this.leds.push(l); }
    for (const sx of [-1, 1]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.7), dark); sk.position.set(sx * 0.22, -0.34, 0); T.add(sk);
      for (const sz of [-1, 1]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), dark); lg.position.set(sx * 0.2, -0.24, sz * 0.2); lg.rotation.z = sx * 0.15; T.add(lg); }
    }
    // the parcel under the belly
    this.box = new THREE.Group();
    const card = lam("dvBox", () => ({ color: "#c9965e" })), tape = lam("dvTape", () => ({ color: "#e8d6b0" }));
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), card); this.box.add(bx);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.245, 0.06), tape); this.box.add(tp);
    this.box.position.y = -0.3; T.add(this.box);
    T.traverse((o) => { if (o instanceof THREE.Mesh && !o.layers.isEnabled(NOINK)) o.castShadow = true; });
    this.g.visible = false;
    parent.add(this.g);
  }
  /** pose for one frame (t in seconds drives the rotor blades) */
  pose(s: DroneState | null, t: number) {
    if (!s) { this.g.visible = false; return; }
    this.g.visible = true;
    this.g.position.set(...s.p); this.g.rotation.set(0, s.yaw, 0); this.g.scale.setScalar(s.scale);
    this.tilt.rotation.set(s.pitch, 0, s.roll);
    const a = t * 41;
    this.blades.forEach((b, i) => { const gone = s.lost && i === 0; b.visible = !gone && !s.fly; b.rotation.y = i * 0.7 + (s.fly ? a : 0.3); });
    this.discs.forEach((d, i) => (d.visible = s.fly && !(s.lost && i === 0)));
    this.stub.visible = !!s.lost;
    this.box.visible = !!s.box;
    for (const l of this.leds) l.material = s.eye > 0 ? this.ledOn : this.ledOff;
  }
}
