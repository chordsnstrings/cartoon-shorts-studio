// The flying camera: a small quadcopter built from primitives (two-tone lit, inked by the world ink pass).
// Lens faces +z at yaw 0. ~0.38 m across (a touch bigger than life so it reads in a portrait frame).
import * as THREE from "three";
import { lam, glow, cyl } from "./build";
import { NOINK } from "./ink";
import { DroneState } from "./story";

const rounded = (w: number, h: number, d: number, r: number) => {
  const s = new THREE.Shape(), x = w / 2 - r, z = d / 2 - r;
  s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -z); s.lineTo(w / 2, z); s.quadraticCurveTo(w / 2, d / 2, x, d / 2);
  s.lineTo(-x, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, z); s.lineTo(-w / 2, -z); s.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(Math.PI / 2); g.translate(0, h / 2, 0);
  return g;
};

export class Drone {
  g = new THREE.Group();
  private tilt = new THREE.Group();
  private blades: THREE.Mesh[] = [];
  private discs: THREE.Mesh[] = [];
  private shutter: THREE.Mesh;
  private lens: THREE.Mesh;
  private leds: THREE.Mesh[] = [];
  private ledOn: THREE.Material; private ledOff: THREE.Material;
  constructor(parent: THREE.Object3D) {
    const white = lam("drWhite", () => ({ color: "#f4f1ea" })), grey = lam("drGrey", () => ({ color: "#3a3f4c" })), black = lam("drBlack", () => ({ color: "#1b1e26" }));
    const accent = lam("drBlue", () => ({ color: "#3f8fd8" }));
    const T = this.tilt;
    this.g.add(T);
    const body = new THREE.Mesh(rounded(0.17, 0.07, 0.2, 0.05), white); T.add(body);
    const top = new THREE.Mesh(rounded(0.11, 0.012, 0.13, 0.04), accent); top.position.y = 0.047; T.add(top);
    // camera head on the nose: dark bezel, glass lens, the privacy shutter that slides over it
    const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.03, 28), black); bez.rotation.x = Math.PI / 2; bez.position.set(0, 0, 0.112); T.add(bez);
    this.lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 28), glow("drLens", "#2a6fb0", 1.0)); this.lens.position.set(0, 0, 0.128); T.add(this.lens);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), glow("drGlint", "#ffffff", 1.6)); glint.position.set(0.012, 0.012, 0.129); glint.layers.set(NOINK); T.add(glint);
    this.shutter = new THREE.Mesh(new THREE.CircleGeometry(0.04, 28), lam("drShut", () => ({ color: "#e8e4da" }))); this.shutter.position.set(0, 0, 0.1305); T.add(this.shutter);
    // arms + shrouded rotors at the four corners
    const ring = new THREE.TorusGeometry(0.078, 0.013, 10, 36); ring.rotateX(Math.PI / 2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx * 0.145, z = sz * 0.13;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.03), grey); arm.position.set(x * 0.55, 0.0, z * 0.55); arm.rotation.y = Math.atan2(-z, x); T.add(arm);
      const sh = new THREE.Mesh(ring, white); sh.position.set(x, 0.01, z); T.add(sh);
      const hub = new THREE.Mesh(cyl(0.014, 0.014, 0.03, 12), grey); hub.position.set(x, -0.005, z); T.add(hub);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.018), black); bl.position.set(x, 0.022, z); T.add(bl); this.blades.push(bl);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), new THREE.MeshBasicMaterial({ color: "#c9d2de", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.022, z); disc.layers.set(NOINK); T.add(disc); this.discs.push(disc);
    }
    // two front LEDs + a light underneath
    this.ledOn = glow("drLedOn", "#fff6d8", 3.2); this.ledOff = lam("drLedOff", () => ({ color: "#8a8f9a" }));
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.006), this.ledOn); l.position.set(sx * 0.062, 0.012, 0.1); T.add(l); this.leds.push(l); }
    const under = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), this.ledOn); under.rotation.x = Math.PI / 2; under.position.y = -0.037; T.add(under); this.leds.push(under);
    // landing feet
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.14), grey); f.position.set(sx * 0.06, -0.045, 0); T.add(f); }
    this.g.visible = false;
    parent.add(this.g);
  }
  /** pose for one frame (t in seconds drives the rotor blades) */
  pose(s: DroneState | null, t: number) {
    if (!s) { this.g.visible = false; return; }
    this.g.visible = true;
    this.g.position.set(...s.p); this.g.rotation.set(0, s.yaw, 0); this.g.scale.setScalar(s.scale);
    this.tilt.rotation.set(s.pitch, 0, s.roll);
    const a = t * 47;
    this.blades.forEach((b, i) => { b.visible = !s.fly; b.rotation.y = i * 0.7 + (s.fly ? a : 0.3); });
    this.discs.forEach((d) => (d.visible = s.fly));
    this.shutter.visible = s.shut;
    for (const l of this.leds) l.material = s.eye > 0 ? this.ledOn : this.ledOff;
  }
}
