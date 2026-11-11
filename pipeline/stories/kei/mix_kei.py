# "The New Pickup That Tops Out at 25 mph": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_kei.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/kei/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 1060
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(toyota=0.7, tops=3.4, tf=4.03, hour=5.18, tiny=5.97, eleven=6.49, long=7.42, half=8.36, full=8.76, steering=10.19, wheel=10.67,
         right=11.64, why=12.3, slow=12.86, tf2=13.66, low=15.36, so=16.42, stuck=18.23, t35=19.06, slower=19.95, hauls=20.87, six=21.2,
         pounds=21.7, four=22.72, drive=23.3, air=24.34, cond=24.57, sell=25.48, revived=26.59, killed=27.63, y2016=28.1, scion=29.26,
         would=30.51, send=31.39, friend=32.28, fast=33.86)
SHOT = {1: (0, 3.3, "road"), 2: (3.3, 5.65, "road"), 3: (5.65, 10.0, "road"), 4: (10.0, 12.25, "road"), 5: (12.25, 14.9, "road"),
        6: (14.9, 16.35, "road"), 7: (16.35, 20.55, "busy"), 8: (20.55, 22.65, "road"), 9: (22.65, 24.0, "road"), 10: (24.0, 25.35, "road"),
        11: (25.35, 30.45, "show"), 12: (30.45, DUR, "evening")}
BALES = [W["hauls"] + 0.05, W["six"] - 0.02, W["pounds"] - 0.12, W["pounds"] + 0.22]
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

def putter(dur, r, rpm=1.0, amp=1.0):
    """little 660cc three-cylinder: a pulse train at the firing rate with a chuggy sawtooth body and tappet noise"""
    t = tt(dur); f = 38 * rpm * (1 + 0.04 * np.sin(phase(0.9 + 0 * t)))
    ph = phase(f); pulse = np.maximum(0, np.sin(ph)) ** 6
    y = lp(signal.sawtooth(ph) * 0.3 + pulse * 0.9, 900) + np.sin(phase(f * 0.5)) * 0.15 + bp(r.standard_normal(len(t)), 1500, 5000, 1) * 0.05 * pulse
    return fades(y * amp, 0.1, 0.15)

def v8_pass(dur, r, tpass, amp=1.0):
    """a big pickup roaring past: low V8 burble + roar swell, Doppler drop, panned left -> right"""
    t = tt(dur); x = (t - tpass) * 20; dist = np.sqrt(x ** 2 + 5 ** 2); dop = 343 / (343 + 20 * x / dist)
    f = 46 * dop; ph = phase(f)
    y = lp(signal.sawtooth(ph) * 0.5 + np.maximum(0, np.sin(ph)) ** 4 * 0.8, 1200) + lp(colored(len(t), r, 1.0), 1400) * 1.2
    y = y * (5 / dist) ** 1.1
    pn = np.clip(x / 20, -1, 1)
    return np.stack([y * np.sqrt((1 - pn) / 2) * amp, y * np.sqrt((1 + pn) / 2) * amp])

def car_pass(dur, r, tpass, amp=0.6, f0=70, direction=1):
    t = tt(dur); x = (t - tpass) * 20 * direction; dist = np.sqrt(x ** 2 + 6 ** 2); dop = 343 / (343 + 20 * x / dist * direction)
    y = lp(colored(len(t), r, 1.0), 2200) * 1.4 + np.sin(phase(f0 * dop)) * 0.3
    y = y * (6 / dist) ** 1.3
    pn = np.clip(x / 20, -1, 1)
    return np.stack([y * np.sqrt((1 - pn) / 2) * amp, y * np.sqrt((1 + pn) / 2) * amp])

def horn(r, f=440, dur=0.18, amp=0.5):
    t = tt(dur); y = signal.square(phase(f + 0 * t)) * 0.3 + signal.square(phase(f * 1.26 + 0 * t)) * 0.3
    return fades(lp(y, 3000) * amp, 0.005, 0.03)

def ratchet(r, dur=0.8, rate=26):
    y = np.zeros(ns(dur + 0.1))
    for i in range(int(dur * rate)): X._place_mono(y, tick(r, 1800 + 200 * (i % 2)) * 0.5, i / rate)
    return y

def rustle(r, dur=0.4):
    t = tt(dur); return fades(bp(r.standard_normal(len(t)), 1500, 7000, 1) * np.exp(-t / 0.12) * 0.6, 0.002, 0.05)

def splat(r):
    t = tt(0.3); return fades(lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.05) * 1.3 + np.sin(phase(140 * np.exp(-t / 0.08) + 60)) * np.exp(-t / 0.07) * 0.5, 0.001, 0.05)

def cloth_whip(r, dur=0.5):
    t = tt(dur); f = 600 + 2400 * np.sin(np.pi * t / dur)
    return fades(bp(r.standard_normal(len(t)), 500, 6000, 1) * np.sin(np.pi * t / dur) ** 2 * 0.9 + np.sin(phase(f)) * 0.02, 0.01, 0.08)

def drumroll(r, dur, rate=24):
    y = np.zeros(ns(dur + 0.2))
    for i in range(int(dur * rate)): X._place_mono(y, bp(r.standard_normal(ns(0.05)), 200, 3000, 1) * np.exp(-np.arange(ns(0.05)) / ns(0.015)) * (0.3 + 0.7 * i / (dur * rate)), i / rate + r.uniform(0, 0.006))
    return y

def sfx():
    r = rng(41)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p == "show": bed = st(room(d, r, 0.03))
        elif p == "evening": bed = st(room(d, r, 0.02) + X.crickets(d, r, 2) * 0.12)
        else: bed = st(room(d, r, 0.02)) + X.breeze(d, r, 0.25) * 0.4 + X.bird_chirps(d, r, 0.3) * 0.12
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: the tiny engine putters along; the big pickup ROARS past, a horn blast; a "boing" on the dial
    ev(S, st(putter(5.7, r, 1.25, 0.6)), 0.0, 0.7, 0.1, "kei putter")
    ev(S, v8_pass(2.6, r, 0.5, 1.0), 0.0, 1.0, 0, "BIG PICKUP ROAR pass")
    ev(S, horn(r, 330, 0.35, 0.5), 0.15, 0.6, -0.3, "big horn")
    ev(S, X.whoosh(0.6, r, 0.3, 300, 4000, tail=0.15), 0.25, 0.8, 0, "whoosh")
    ev(S, boing(r, 300, 0.45), W["tf"] - 0.05, 0.7, -0.2, "DIAL boing")
    ev(S, clunk(r, 900), W["tf"] + 0.05, 0.6, -0.2, "needle stop clink")
    ev(S, X.whoosh(0.4, r, 0.3, 500, 6000, tail=0.1), 5.35, 0.6, 0, "to flash")
    # tiny: squeak; tape ratchet; tuba-ish thump on "half"
    ev(S, squeak(r, 2200, 0.12), W["tiny"] - 0.02, 0.6, 0, "tiny squeak")
    ev(S, ratchet(r, 0.8), W["eleven"] - 0.3, 0.5, -0.1, "TAPE ratchet")
    ev(S, clunk(r, 160), W["long"] - 0.05, 0.4, 0, "tape snap")
    ev(S, boing(r, 110, 0.5), W["half"], 0.5, 0.2, "half boing")
    # wheel: a little "meep meep" from the kei on "right"
    ev(S, horn(r, 620, 0.12, 0.4), W["right"] - 0.05, 0.6, 0.2, "MEEP")
    ev(S, horn(r, 620, 0.12, 0.4), W["right"] + 0.17, 0.6, 0.2, "meep")
    ev(S, sweep(500, 900, 0.25, 0.25), W["wheel"] - 0.1, 0.4, -0.2, "question bloop")
    # why so slow: shrug bloop; sticker slap
    ev(S, sweep(700, 350, 0.35, 0.25), W["slow"], 0.4, 0, "shrug")
    ev(S, X.push_thump(r), W["low"] - 0.08, 0.9, 0, "STICKER SLAP")
    ev(S, pop(r), W["low"] - 0.06, 0.6, 0, "")
    # busy road: cars whoosh both ways, the big pickup on "stuck", a sad descending slide
    for t0, dr in [(16.5, 1), (17.0, -1), (17.5, 1), (18.45, -1), (18.9, 1), (19.6, 1), (20.0, -1), (20.35, 1)]:
        ev(S, car_pass(1.6, r, 0.8, 0.55, 65 + 10 * (t0 % 1), dr), t0 - 0.8, 0.7, 0, "car pass")
    ev(S, v8_pass(2.0, r, 1.0, 0.8), W["stuck"] - 1.0, 0.8, 0, "big pickup pass")
    ev(S, sweep(600, 200, 0.7, 0.25), W["stuck"] + 0.1, 0.4, 0.1, "sad slide")
    ev(S, st(putter(4.2, r, 0.7, 0.35)), 16.35, 0.5, 0.2, "idle")
    # hauls: bale thumps + straw rustle, a cheer squeak
    for b in BALES: ev(S, clunk(r, 120), b, 0.9, -0.1, "BALE thump"); ev(S, rustle(r), b, 0.6, -0.1, "")
    # four-wheel drive: revving putter, splats
    ev(S, st(putter(1.4, r, 1.6, 0.8)), 22.6, 0.7, 0, "rev")
    for i in range(5): ev(S, splat(r), 22.8 + i * 0.22, 0.5, -0.4 + 0.2 * i, "mud splat" if i == 0 else "")
    ev(S, clunk(r, 140), W["four"], 0.6, 0, "bump")
    ev(S, clunk(r, 120), W["drive"] - 0.1, 0.6, 0, "bump")
    # air conditioning: breeze + sparkle
    ev(S, X.breeze(1.3, r, 0.9, 0.3, 2400), 24.0, 0.7, 0.2, "AC breeze")
    ev(S, chime(r, 1760, 0.8, 3), W["cond"], 0.35, 0.2, "cool sparkle")
    # showroom: creak, cloth yank, dust cough-less puff, drumroll, spot clunks, fanfare chime + applause, confetti pops
    ev(S, st(X.creak(0.8, r) * 0.3), 25.4, 0.4, -0.2, "creak")
    ev(S, cloth_whip(r), W["revived"] - 0.1, 0.9, 0.2, "SHEET YANK")
    ev(S, lp(colored(ns(1.2), r, 1.0), 800) * np.exp(-tt(1.2) / 0.4) * 1.2, W["revived"] + 0.15, 0.6, 0, "dust poof")
    ev(S, drumroll(r, 1.4), W["scion"] - 1.45, 0.6, 0, "drumroll")
    for i in range(4): ev(S, clunk(r, 260), W["scion"] - 0.07 + 0.05 * i, 0.7, -0.4 + 0.25 * i, "SPOT CLUNK" if i == 0 else "")
    ev(S, chime(r, 1318, 1.2, 3), W["scion"], 0.5, 0, "ta-da")
    ev(S, X.applause(1.6, r, 30), W["scion"] + 0.1, 0.45, 0, "applause")
    ev(S, popcloud(r, 0.8, 12), W["scion"] + 0.05, 0.3, 0.1, "confetti pops")
    # ending: putter toward us, horn toot on "would", the big pickup roars past on "fast"
    ev(S, st(putter(DUR - 30.45, r, 1.2, 0.5)), 30.45, 0.6, 0, "end putter")
    ev(S, horn(r, 620, 0.12, 0.4), W["would"] + 0.1, 0.5, 0, "toot")
    ev(S, v8_pass(2.4, r, 0.9, 1.0), W["fast"] - 0.9, 1.0, 0, "FAST ROAR")
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
