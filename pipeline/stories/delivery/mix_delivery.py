# "The Drone That Delivered Shampoo, Then Crashed": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_delivery.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/delivery/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 1047
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(shampoo=2.29, then=3.25, crashed=3.44, garage=4.74, friday=5.49, app=7.14, arriving=7.89, drone=8.71, seven=9.26, minutes=9.58,
         did=10.73, but=11.72, away=12.21, cable=13.17, propeller=14.25, flapped=15.09, sick=16.06, bird=16.39, neighbor=17.19, line=19.13,
         off=21.7, nobody=22.12, hurt=22.77, three=24.36, hours=24.63, got=25.73, gift=26.67, card=26.95, air=27.35, investigating=28.85,
         would=30.12, deliver=30.98, send=32.24, everything=33.94)
HOOK_HIT, HOOK_LAND = 3.0, W["crashed"] + 0.02
HIT_T, LAND_T = W["line"] - 0.03, W["line"] + 0.42
DROP_T = 10.35 + 0.2
SHOT = {1: (0, 5.3, "day"), 2: (5.3, 8.45, "day"), 3: (8.45, 11.6, "day"), 4: (11.6, 14.95, "day"), 5: (14.95, 19.85, "day"), 6: (19.85, 22.0, "day"),
        7: (22.0, 23.0, "day"), 8: (23.0, 25.25, "night"), 9: (25.25, 27.3, "day"), 10: (27.3, 29.95, "day"), 11: (29.95, DUR, "day")}
SPAN = {k: (F(a), F(b)) for k, (a, b, _) in SHOT.items()}
CUES = []


def ev(buf, x, t, gain=1.0, p=0.0, name=""):
    x = np.asarray(x, float)
    if x.ndim == 1: x = pan(x, p)
    place(buf, x, t, gain)
    if name: CUES.append((t, name))


def env_seg(x, fade=0.08):
    n = x.shape[-1]; e = np.ones(n); k = min(n // 3, ns(fade)); e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k)
    return x * e


# ---------------------------------------------------------------- own one-shots
def chime(r, f0=1320, dur=1.4, n=3):
    y = np.zeros(ns(dur + 0.3))
    for i in range(n):
        c = modal(dur, [(f0 * (1.5 ** i), 1.0, 0.5), (f0 * (1.5 ** i) * 2.76, 0.3, 0.2), (f0 * (1.5 ** i) * 5.4, 0.12, 0.08)], r)
        X._place_mono(y, c * (0.8 ** i), i * 0.07)
    return y * 0.5

def beep(f, dur=0.12, amp=0.5):
    t = tt(dur)
    return fades(np.sign(np.sin(phase(f + 0 * t))) * 0.25 * amp + np.sin(phase(f + 0 * t)) * amp, 0.004, 0.02)

def sweep(f0, f1, dur, amp=0.5, r=None):
    t = tt(dur); f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(phase(f)) + 0.3 * np.sin(phase(2 * f))
    return fades(y * amp * np.sin(np.pi * t / dur) ** 0.5, 0.01, 0.05)

def hum(dur, r, f=110, amp=0.15):
    t = tt(dur)
    y = sum(np.sin(phase(f * k + 0 * t)) / k for k in (1, 2, 3, 4)) + 0.4 * lp(colored(len(t), r, 0.5), 500)
    return y * amp

def rumble(dur, r, amp=1.0):
    t = tt(dur)
    y = lp(colored(len(t), r, 1.0), 260) * 3 + bp(r.standard_normal(len(t)), 300, 2500, 1) * 0.35 * (np.abs(np.sin(phase(9 + 0 * t))) ** 4 + 0.5)
    e = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.3)
    return y * e * amp

def zap(r, dur=0.25):
    t = tt(dur)
    y = bp(r.standard_normal(len(t)), 1500, 7000, 1) * (np.random.default_rng(int(r.integers(1e6))).random(len(t)) > 0.6) * 0.9
    y += np.sin(phase(900 + 600 * np.sin(phase(37 + 0 * t)))) * 0.4
    return fades(y * np.exp(-t / (dur / 2.5)), 0.002, 0.03)

def beam_whine(dur, r):
    t = tt(dur); f = 180 + 40 * np.sin(phase(0.7 + 0 * t))
    y = signal.sawtooth(phase(f)) * 0.25 + np.sin(phase(f * 8)) * 0.12 + bp(r.standard_normal(len(t)), 2000, 6000, 1) * 0.12
    return y * np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.2)

def pop(r):
    t = tt(0.3)
    return fades(bp(r.standard_normal(len(t)), 300, 4000, 1) * np.exp(-t / 0.01) * 1.4 + np.sin(phase(220 * np.exp(-t / 0.05) + 60)) * np.exp(-t / 0.06), 0.001, 0.05)

def tick(r, f=2600):
    t = tt(0.06)
    return np.sin(phase(f + 0 * t)) * np.exp(-t / 0.008) + hp(r.standard_normal(len(t)), 4000) * np.exp(-t / 0.002) * 0.3

def keys(r, dur, rate=9):
    y = np.zeros(ns(dur)); tm = 0
    while tm < dur - 0.05:
        c = modal(0.05, [(r.uniform(1800, 2600), 1.0, 0.01), (r.uniform(3500, 4500), 0.4, 0.005)], r)
        X._place_mono(y, c * r.uniform(0.4, 1.0), tm); tm += r.uniform(0.6, 1.4) / rate
    return y

def warble(r, dur=1.2):
    t = tt(dur); f = 600 + 250 * np.sin(phase(7 + 0 * t)) * (1 - t / dur) - 300 * t / dur
    return fades(np.sin(phase(f)) * 0.5 * (1 - t / dur), 0.01, 0.1)

def room(dur, r, level=0.03):
    return lp(colored(ns(dur), r, 1.0), 400) * level


def jet(dur, r, f0=95, drop=0.82, tpass=0.5, amp=1.0, bright=1800):
    """a jet passing: broadband roar swelling to the pass then fading, its whine and hum falling in pitch (Doppler)"""
    t = tt(dur); u = (t / dur - tpass) * 6
    fac = 1 + (1 - drop) / 2 - (1 - drop) * (np.tanh(u) + 1) / 2
    e = np.exp(-((t / dur - tpass) / 0.28) ** 2)
    y = lp(colored(len(t), r, 1.0), bright) * 1.6 + bp(r.standard_normal(len(t)), 600, 3000, 1) * 0.25
    y = y + np.sin(phase(f0 * fac)) * 0.5 + np.sin(phase(f0 * 2.02 * fac)) * 0.25 + np.sin(phase(2600 * fac)) * 0.05
    return fades(y * e * amp, 0.05, 0.2)

def siren(dur, r, tpass, v=13.0, d0=8.0):
    """hi-lo siren passing at tpass (s into the clip): Doppler pitch drop + distance swell, panned left to right"""
    t = tt(dur); x = (t - tpass) * v; dist = np.sqrt(x ** 2 + d0 ** 2); vr = v * x / dist
    dop = 343 / (343 + vr)
    base = np.where((t * 1.6) % 1 < 0.5, 950.0, 720.0); base = ndimage.uniform_filter1d(base, ns(0.03))
    y = signal.square(phase(base * dop)) * 0.25 + np.sin(phase(base * dop)) * 0.6 + np.sin(phase(2 * base * dop)) * 0.2
    y = lp(y, 5000) * (d0 / dist) ** 1.2
    pn = np.clip(x / 25, -1, 1)
    return np.stack([y * np.sqrt((1 - pn) / 2), y * np.sqrt((1 + pn) / 2)])

def clatter(r, n=10, dur=1.4):
    y = np.zeros(ns(dur + 0.3))
    for i in range(n):
        t0, g = max(0, i * dur / n + r.uniform(-0.02, 0.02)), r.uniform(0.5, 1.0)
        X._place_mono(y, X.clink(r, r.uniform(700, 1600), 0.1, 0.7) * g, t0)
        X._place_mono(y, modal(0.08, [(r.uniform(150, 260), 1.0, 0.03)], r) * 0.8 * g, t0)
    return y

def printer(dur, r):
    t = tt(dur); f = 220 + 30 * np.sin(phase(11 + 0 * t))
    y = signal.sawtooth(phase(f)) * 0.18 + bp(r.standard_normal(len(t)), 1500, 5000, 1) * 0.2 * (np.sin(phase(14 + 0 * t)) > 0)
    return fades(y, 0.03, 0.1)

def static(dur, r):
    return fades(bp(r.standard_normal(ns(dur)), 800, 9000, 1) * 0.8, 0.01, 0.06)

def flutter(r, dur=0.6, rate=16):
    y = np.zeros(ns(dur + 0.1))
    for i in range(int(dur * rate)):
        X._place_mono(y, bp(r.standard_normal(ns(0.04)), 400, 2500, 1) * np.exp(-np.arange(ns(0.04)) / ns(0.012)) * 0.6, i / rate)
    return y

def popcloud(r, dur, n):
    y = np.zeros(ns(dur + 0.2))
    for i in range(n): X._place_mono(y, beep(r.uniform(1400, 2600), 0.03, 0.25), dur * (i / n) + r.uniform(0, 0.03))
    return y


# ---------------------------------------------------------------- event table
def servo(r, dur=0.35, f0=420, f1=680):
    t = tt(dur); f = f0 + (f1 - f0) * np.sin(np.pi * t / dur)
    return fades((signal.sawtooth(phase(f)) * 0.2 + np.sin(phase(f * 2)) * 0.2) * (0.6 + 0.4 * np.sin(phase(30 + 0 * t))), 0.01, 0.05)

def robo_steps(dur, r, rate=6.0, n=1):
    y = np.zeros(ns(dur + 0.2)); tm = 0
    while tm < dur:
        for _ in range(n): X._place_mono(y, modal(0.06, [(r.uniform(500, 800), 1.0, 0.02), (r.uniform(1800, 2400), 0.3, 0.008)], r) * r.uniform(0.3, 0.7), tm + r.uniform(0, 0.05))
        tm += 1 / rate
    return y

def bloop(r, f0=700, f1=1400, dur=0.12):
    return sweep(f0, f1, dur, 0.4)

def boing(r, f0=180, dur=0.6):
    t = tt(dur); f = f0 * (1 + 0.5 * np.exp(-t / 0.05)) * (1 + 0.12 * np.sin(phase(14 + 0 * t)) * np.exp(-t / 0.3))
    return fades(np.sin(phase(f)) * np.exp(-t / 0.25) * 0.8, 0.002, 0.05)

def accordion_squeeze(dur, r):
    t = tt(dur); f = 440
    y = sum(signal.sawtooth(phase(f * k * (1 + 0.003 * np.sin(phase(5 + 0 * t))))) / k for k in (1, 1.5, 2))
    return fades(lp(y, 2500) * 0.15 * np.sin(np.pi * t / dur), 0.05, 0.1)



def clunk(r, f=180):
    t = tt(0.25)
    return fades(modal(0.25, [(f, 1.0, 0.06), (f * 2.7, 0.4, 0.03), (f * 5.1, 0.15, 0.015)], r) + bp(r.standard_normal(len(t)), 800, 5000, 1) * np.exp(-t / 0.006) * 0.6, 0.001, 0.05)
def drive_whir(r, dur=0.9):
    t = tt(dur); f = 90 + 25 * np.sin(phase(3 + 0 * t))
    y = signal.sawtooth(phase(f)) * 0.15 + bp(r.standard_normal(len(t)), 1200, 4000, 1) * 0.15 * (np.sin(phase(18 + 0 * t)) > 0.3)
    for i in range(5): X._place_mono(y, tick(r, 1400) * 0.5, 0.15 + i * 0.12)
    return fades(y, 0.02, 0.1)
def crt_on(r):
    t = tt(0.5); y = np.sin(phase(15700 * np.ones_like(t))) * 0.04 + lp(r.standard_normal(len(t)), 300) * np.exp(-t / 0.05) * 1.2
    return fades(y, 0.002, 0.1)
def sputter(r, dur=1.2):
    y = np.zeros(ns(dur + 0.2))
    for i in range(14): X._place_mono(y, zap(r, 0.08) * r.uniform(0.3, 1.0), r.uniform(0, dur))
    return y
def tyre_bounce(r):
    y = np.zeros(ns(1.6))
    for i, g in enumerate([1.0, 0.6, 0.35, 0.2]): X._place_mono(y, modal(0.2, [(95, 1.0, 0.05), (210, 0.4, 0.03)], r) * g, [0, 0.45, 0.8, 1.05][i])
    return y
def click(r):
    t = tt(0.05); return np.sin(phase(3200 + 0 * t)) * np.exp(-t / 0.004) + hp(r.standard_normal(len(t)), 5000) * np.exp(-t / 0.0015) * 0.4

def servo(r, dur=0.25, f0=380, f1=620, amp=0.4):
    t = tt(dur); f = f0 + (f1 - f0) * np.sin(np.pi * t / dur * 0.5)
    y = signal.sawtooth(phase(f)) * 0.3 + np.sin(phase(f * 2)) * 0.3 + bp(r.standard_normal(len(t)), 1500, 5000, 1) * 0.08
    return fades(y * amp, 0.01, 0.04)

def coin(r, f0=2400):
    return modal(0.5, [(f0, 1.0, 0.25), (f0 * 2.4, 0.5, 0.15), (f0 * 3.9, 0.25, 0.08)], r) * 0.5

def squeak(r, f=1700, dur=0.1):
    t = tt(dur); return fades(np.sin(phase(f + 500 * np.sin(np.pi * t / dur))) * 0.5 * np.sin(np.pi * t / dur), 0.005, 0.02)

def boing(r, f0=180, dur=0.45):
    t = tt(dur); f = f0 * (1 + 0.6 * np.exp(-t / 0.08)) * (1 + 0.15 * np.sin(phase(18 + 0 * t)) * np.exp(-t / 0.2))
    return fades(np.sin(phase(f)) * np.exp(-t / 0.15) * 0.8, 0.002, 0.05)

def drip(r):
    t = tt(0.12); f = 900 + 1400 * (t / 0.12)
    return fades(np.sin(phase(f)) * np.exp(-t / 0.03) * 0.5, 0.002, 0.03)

def rotor(dur, r, f=190, amp=1.0, wob=0.0):
    """quadcopter buzz: a rich sawtooth blade-pass tone + band noise, slight pitch wander"""
    t = tt(dur); ff = f * (1 + 0.03 * np.sin(phase(1.3 + 0 * t)) + wob * 0.12 * np.sin(phase(9 + 0 * t)))
    y = signal.sawtooth(phase(ff)) * 0.35 + signal.sawtooth(phase(ff * 2.01)) * 0.18 + np.sin(phase(ff * 0.5)) * 0.2
    y = lp(y, 3500) + bp(r.standard_normal(len(t)), 800, 6000, 1) * 0.18
    return fades(y * amp, 0.12, 0.15)

def spin_down(r, dur=0.7, f0=190):
    t = tt(dur); f = f0 * (1 - 0.8 * t / dur)
    return fades((signal.sawtooth(phase(f)) * 0.3 + bp(r.standard_normal(len(t)), 600, 4000, 1) * 0.1) * (1 - t / dur), 0.01, 0.1)

def alarm_beeps(r, dur, rate=3.0):
    y = np.zeros(ns(dur + 0.3)); tm = 0
    while tm < dur: X._place_mono(y, beep(1800, 0.12, 0.35), tm); X._place_mono(y, beep(1350, 0.12, 0.35), tm + 0.17); tm += 1 / rate
    return y

def doorbell(r):
    y = np.zeros(ns(1.6)); X._place_mono(y, modal(1.0, [(659, 1.0, 0.5), (659 * 2.76, 0.2, 0.2)], r) * 0.6, 0); X._place_mono(y, modal(1.2, [(523, 1.0, 0.6), (523 * 2.76, 0.2, 0.2)], r) * 0.6, 0.45)
    return y

def flap_rotor(dur, r, f=150, amp=1.0):
    """the wounded hexacopter: lower, wobbling buzz with a flapping amplitude (one rotor missing)"""
    y = rotor(dur, r, f, amp, wob=1.0); t = tt(dur)
    return y * (0.55 + 0.45 * np.abs(np.sin(phase(2.6 + 0 * t))))

def crash(r):
    y = np.zeros(ns(1.6))
    X._place_mono(y, X.push_thump(r) * 1.2, 0)
    X._place_mono(y, clunk(r, 140), 0.0)
    X._place_mono(y, clatter(r, 8, 0.6) * 0.8, 0.03)
    X._place_mono(y, spin_down(r, 0.8, 150) * 0.7, 0.05)
    return y

def sfx():
    r = rng(47)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p == "night": bed = st(room(d, r, 0.02) + X.crickets(d, r, 3) * 0.2)
        else: bed = st(room(d, r, 0.03) + X.breeze(d, r, 0.25) + X.bird_chirps(d, r, 0.35) * 0.25)
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: the wounded drone buzzes and wobbles in, ZAP on the power line, CRASH on the roof (on "crashed"), dizzy tweets
    ev(S, st(flap_rotor(HOOK_HIT + 0.1, r, 150, 1.0)), 0.0, 0.9, 0.3, "WOBBLY ROTOR")
    ev(S, zap(r, 0.4), HOOK_HIT, 1.0, 0.4, "ZAP power line")
    ev(S, X.whoosh(0.45, r, 0.6, 400, 3000, tail=0.05), HOOK_HIT + 0.02, 0.6, 0.4, "fall whoosh")
    ev(S, crash(r), HOOK_LAND, 1.0, 0.4, "CRASH roof")
    ev(S, boing(r, 200, 0.45), HOOK_LAND + 0.05, 0.5, 0.4, "")
    for i in range(3): ev(S, squeak(r, 2400 + 300 * i, 0.08), HOOK_LAND + 0.5 + i * 0.25, 0.25, 0.4, "dizzy tweet" if i == 0 else "")
    # the app: notification ding + card pop, a bright bloop when the drone icon appears, ticking countdown
    ev(S, chime(r, 1760, 0.6, 2), W["app"] - 0.05, 0.5, -0.2, "APP ding")
    ev(S, pop(r), W["app"] - 0.08, 0.4, -0.2, "card pop")
    ev(S, bloop(r, 700, 1500, 0.14), W["arriving"], 0.5, -0.2, "drone icon bloop")
    for i in range(int((8.45 - 8.0) / 0.25) + 1): ev(S, tick(r, 2400 + 300 * (i % 2)), 8.0 + i * 0.25, 0.3, -0.2, "countdown tick" if i == 0 else "")
    # it arrives: rotor swelling in, the release click, parcel thump + bounce, a ta-da chime on "did"
    ab = rotor(11.6 - 8.45, r, 185, 1.0); ab = ab * np.minimum(1, tt(11.6 - 8.45) / 1.2) ** 1.5
    ev(S, st(ab), 8.45, 0.75, -0.3, "ROTOR arrive")
    ev(S, click(r), DROP_T, 0.6, -0.2, "release click")
    ev(S, X.whoosh(0.4, r, 0.7, 300, 2500, tail=0.05), DROP_T + 0.05, 0.4, -0.2, "")
    ev(S, X.push_thump(r), DROP_T + 0.5, 0.9, -0.2, "PARCEL thump")
    ev(S, boing(r, 260, 0.35), DROP_T + 0.52, 0.4, -0.2, "")
    ev(S, chime(r, 1568, 0.9, 3), W["did"] + 0.1, 0.5, 0, "ta-da")
    # the cable: rotor leaving, TWANG + zap on "cable", wobble, the propeller POPS off and whooshes away
    ev(S, st(rotor(W["cable"] - 11.6, r, 190, 0.8)), 11.6, 0.7, 0.1, "rotor leave")
    ev(S, boing(r, 110, 0.6), W["cable"], 0.9, 0.2, "CABLE TWANG")
    ev(S, zap(r, 0.25), W["cable"], 0.6, 0.2, "")
    ev(S, st(rotor(W["propeller"] - W["cable"], r, 180, 0.8, wob=0.6)), W["cable"], 0.7, 0.2, "wobble rotor")
    ev(S, pop(r), W["propeller"], 1.0, 0.1, "PROP POP")
    ev(S, X.whoosh(0.9, r, 0.3, 500, 5000, tail=0.2), W["propeller"] + 0.02, 0.7, -0.4, "prop whoosh")
    ev(S, st(flap_rotor(14.95 - W["propeller"], r, 155, 0.9)), W["propeller"], 0.75, 0.2, "")
    # the sick bird: the long flapping wobble, a laugh-ish warble on "sick bird", ZAP into the line, CRASH onto the roof
    ev(S, st(flap_rotor(HIT_T - 14.95 + 0.1, r, 150, 1.0)), 14.95, 0.8, 0.1, "FLAP ROTOR")
    ev(S, warble(r, 0.9), W["sick"], 0.35, 0.2, "sick warble")
    ev(S, zap(r, 0.45), HIT_T, 1.0, 0.4, "ZAP 2")
    ev(S, crash(r), LAND_T, 1.0, 0.4, "CRASH 2")
    # lights out: a heavy relay clunk + power-down sweep on "off"
    ev(S, clunk(r, 120), W["off"] - 0.02, 1.0, 0.3, "POWER CLUNK")
    ev(S, sweep(500, 70, 0.7, 0.45), W["off"], 0.8, 0.3, "power down")
    # nobody hurt: a soft sparkle ding
    ev(S, chime(r, 1318, 0.8, 2), W["nobody"], 0.4, 0, "check ding")
    # three hours on a ladder: fast clock ticks, ladder creaks, tug squeaks
    for i in range(int(2.2 / 0.09)): ev(S, tick(r, 2600), 23.05 + i * 0.09, 0.28, -0.3, "fast clock" if i == 0 else "")
    for i in range(3): ev(S, X.creak(0.35, r, 120, 190), 23.2 + i * 0.7, 0.3, 0.2, "ladder creak" if i == 0 else "")
    for i in range(4): ev(S, squeak(r, 1300 + 150 * i, 0.12), 23.4 + i * 0.45, 0.25, 0.2, "")
    # the gift card: pop + coin + sparkle
    ev(S, pop(r), W["got"] - 0.07, 0.5, 0.1, "card pop")
    for i in range(3): ev(S, coin(r, 2300 + 200 * i), W["got"] + i * 0.12, 0.5, -0.1 + 0.1 * i, "COINS" if i == 0 else "")
    ev(S, chime(r, 1568, 0.8, 3), W["card"], 0.35, 0, "")
    # investigating: a hmm-bloop, clipboard ticks, a question pop
    for i in range(3): ev(S, tick(r, 1900), 27.6 + i * 0.35, 0.35, -0.2, "pen ticks" if i == 0 else "")
    ev(S, pop(r), 28.27 - 0.08, 0.4, 0.2, "question pop")
    ev(S, sweep(300, 600, 0.35, 0.3), W["investigating"], 0.4, 0.2, "magnify bloop")
    # ending: question pop on "would", a ding on "send"
    ev(S, pop(r), W["would"] - 0.08, 0.35, -0.2, "")
    ev(S, chime(r, 1568, 0.9, 3), W["send"], 0.4, 0.2, "send ding")
    return S


def speech_spans(words, merge=0.3):
    sp = []
    for w in words:
        if sp and w["s"] - sp[-1][1] < merge: sp[-1][1] = w["e"]
        else: sp.append([w["s"], w["e"]])
    return sp


def duck(spans, depth=-3.0, pre=0.08, post=0.12, att=0.07, rel=0.45):
    g = np.zeros(N)
    for a, b in spans: g[max(0, ns(a - pre)):min(N, ns(b + post))] = 1
    k = np.exp(-np.arange(ns(rel * 3)) / ns(rel)); k /= k.sum()
    g = np.minimum(1, np.convolve(g, k, mode="full")[:N] + ndimage.maximum_filter1d(g, ns(att)))
    return dbg(depth * np.clip(g, 0, 1))


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    c = dbg(ceil_db); n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12)); La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    red = -np.log(g1); kr = np.exp(-1 / (rel * SR))
    red = np.maximum(red, signal.lfilter([1 - kr], [1, -kr], red))
    g = np.exp(-ndimage.uniform_filter1d(red, 2 * La + 1, mode="nearest"))
    return x * np.minimum(g, 1)[None, :]


def main():
    v, sr = read_wav(f"{DAY}/voice/voice.wav"); assert sr == SR
    v = st(v)[:, :N]; v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    words = json.load(open(f"{DAY}/voice/words.json"))
    mus, _ = read_wav(f"{DAY}/audio/music.wav"); mus = st(mus)[:, :N]; mus = np.pad(mus, ((0, 0), (0, N - mus.shape[1])))
    fo = ns(1.2); mus[:, -fo:] *= np.linspace(1, 0, fo)[None, :]
    S = sfx()
    Lv = integrated(v)
    mus = mus * dbg(Lv - 14 - integrated(mus)) * dbg(+3.0)
    S = S * dbg(momentary_max(v) - momentary_max(S)) * dbg(-6.0)
    mus = mus * duck(speech_spans(words))[None, :]
    mix = v + mus + S
    for _ in range(2):
        mix = mix * dbg(-15.0 - integrated(mix)); mix = limiter(mix, -1.2)
    os.makedirs(f"{DAY}/audio", exist_ok=True)
    write_wav(f"{DAY}/audio/mix.wav", mix)
    k = dbg(-15.0 - integrated(v + mus + S))
    for nm, x in [("stem_voice", v), ("stem_music", mus), ("stem_sfx", S)]: write_wav(f"{DAY}/audio/{nm}.wav", x * k)
    with open(f"{DAY}/audio/cues.md", "w") as f:
        f.write(f"# Cues\n\nLUFS mix {integrated(mix):.1f}, TP {true_peak(mix):.1f} dBTP, voice {Lv:.1f}\n\n")
        for t, nm in sorted(CUES): f.write(f"- {t:7.3f}  f{round(t * 30):4d}  {nm}\n")
    print("mix", round(integrated(mix), 2), round(true_peak(mix), 2), mix.shape, N)


if __name__ == "__main__":
    main()
