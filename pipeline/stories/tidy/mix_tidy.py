# "The Robot Cleaner That Had to Be Carried": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_tidy.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/tidy/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 940
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(robot=0.89, carried=3.71, stairs=4.38, thirty=5.43, hour=6.03, claw=6.54, hands=7.01, grippy=7.61, socks=8.07, twist=9.15,
         human=10.06, remotely=11.37, hq=12.32, on=13.48, climbed=14.58, drunk=15.49, then=16.19, froze=16.45, pilots=17.39,
         equipment=17.99, overheated=18.41, visit=19.63, toilet=20.6, brush=21.41, fell=21.95, three=22.36, times=22.65, three2=24.01,
         times2=24.13, poked=24.75, onn=25.35, would=26.49, toilet2=27.87, send=28.54, chores=30.09)
SHOT = {1: (0, 5.0, "hall"), 2: (5.0, 9.0, "street"), 3: (9.0, 9.75, "street"), 4: (9.75, 13.42, "office"), 5: (13.42, 16.12, "street"),
        6: (16.12, 17.3, "street"), 7: (17.3, 19.55, "office"), 8: (19.55, 23.85, "bath"), 9: (23.85, 26.3, "bath"), 10: (26.3, DUR, "bath")}
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

def sfx():
    r = rng(29)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p in ("hall", "bath"): bed = st(room(d, r, 0.035))
        elif p == "office": bed = st(room(d, r, 0.04) + hum(d, r, 120, 0.01))
        else: bed = X.breeze(d, r, 0.3, gust=0.12, bright=1200) + st(X.bird_chirps(d, r, 0.25))
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: her footsteps on the carpeted stairs, the robot's dangling servo whine, an effort grunt-free bump on "carried"
    for i in range(5): ev(S, X.stroll_step(r, 0.3) * 0.6, 0.15 + i * 1.0, 0.7, -0.1, "stair step" if i == 0 else "")
    for i in range(3): ev(S, servo(r, 0.3, 300 + 40 * i, 520), 0.5 + i * 1.4, 0.35, -0.3, "servo" if i == 0 else "")
    ev(S, X.boot(r, 0.6), W["carried"] + 0.05, 0.6, 0, "carry bump")
    ev(S, X.whoosh(0.4, r, 0.3, 600, 5000, tail=0.1), 4.85, 0.5, 0, "flash whoosh")
    # $30 an hour: three coin dings + a clock tick; claw clacks; sock taps
    for i in range(3): ev(S, coin(r, 2300 + 200 * i), W["thirty"] - 0.05 + i * 0.12, 0.6, -0.2 + 0.2 * i, "COINS" if i == 0 else "")
    for i in range(4): ev(S, tick(r, 2600), W["hour"] + i * 0.12, 0.4, 0.3, "clock" if i == 0 else "")
    for i in range(6): ev(S, clink(r) if False else tick(r, 1400 + 200 * (i % 2)), W["claw"] + i * 0.142, 0.8, -0.2 + 0.4 * (i % 2), "CLAW clack" if i == 0 else "")
    for i in range(4): ev(S, squeak(r, 1600 + 150 * (i % 2)), W["grippy"] + 0.1 + i * 0.285, 0.5, -0.2 + 0.4 * (i % 2), "sock squeak" if i == 0 else "")
    # the twist: radio waves bleep out of the antennae; HQ: controller clicks + servo whirs
    ev(S, sweep(900, 2200, 0.5, 0.3), W["twist"], 0.5, 0, "antenna bleep")
    ev(S, sweep(1200, 2600, 0.4, 0.25), W["twist"] + 0.35, 0.4, 0.1, "")
    ev(S, st(keys(r, 3.2, 5)) * 0.3, 10.0, 0.35, 0.1, "controller clicks")
    for i in range(3): ev(S, servo(r, 0.35, 340, 600), 10.3 + i * 1.0, 0.3, 0.2, "")
    ev(S, sweep(900, 2000, 0.4, 0.25), W["remotely"], 0.4, 0.3, "signal")
    # the drunk climb: wobbly steps, servo strain, a slide back + clatter on "drunk"
    for i in range(5): ev(S, X.boot(r, 0.35), 13.2 + i * 0.48, 0.5, 0.2, "robot step" if i == 0 else "")
    ev(S, servo(r, 0.6, 250, 480, 0.4), 14.2, 0.4, 0.2, "servo strain")
    ev(S, X.whoosh(0.3, r, 0.25, 300, 2500, tail=0.05), W["drunk"] - 0.05, 0.6, 0, "slip")
    ev(S, X.boot(r, 0.9), W["drunk"] + 0.15, 0.9, 0, "SLIP THUMP")
    ev(S, X.rattle(0.4, r, 25), W["drunk"] + 0.17, 0.5, 0.1, "")
    # froze: power-down warble; overheated: sputter, fizz, alarm beeps
    ev(S, warble(r, 0.7) * 0.6, W["froze"] - 0.03, 0.6, 0, "FREEZE warble")
    for i in range(3): ev(S, beep(1100, 0.06, 0.25), W["froze"] + 0.4 + i * 0.25, 0.35, 0.2, "")
    ev(S, st(sputter(r, 1.2)), W["equipment"] - 0.05, 0.7, 0.3, "SPUTTER")
    ev(S, st(static(1.2, r)) * 0.3, W["overheated"] - 0.5, 0.45, 0.3, "static")
    for i in range(4): ev(S, beep(1500, 0.08, 0.3), W["overheated"] + i * 0.2, 0.45, 0.3, "alarm" if i == 0 else "")
    ev(S, X.whoosh(0.5, r, 0.3, 300, 2000, tail=0.2) * 0.5, W["overheated"] + 0.1, 0.4, 0.3, "smoke puff")
    # bathroom: scrub swishes, drips, the brush head falling (boing + clack) x3, pokes, the click back on, sparkle chime
    for k in range(3):
        a, b = (19.7, 21.9) if k == 0 else (22.3, 22.6) if k == 1 else (22.9, 23.1)
        tm = a
        while tm < b: ev(S, X.whoosh(0.18, r, 0.4, 1500, 7000, tail=0.02) * 0.5, tm, 0.35, 0.2, ""); tm += 0.35
    for i in range(int(DUR * 1.2)):
        tm = i / 1.2 + 0.7
        if 19.6 < tm < DUR: ev(S, drip(r), tm, 0.25, -0.4, "")
    for i, d in enumerate([W["fell"] - 0.03, W["three"] + 0.12, W["times"] + 0.42]):
        ev(S, boing(r, 200 + 30 * i), d + 0.05, 0.7, 0.2, f"HEAD OFF {i+1}")
        ev(S, tick(r, 900), d + 0.3, 0.8, 0.2, "")
    for tm in [W["three"] - 0.06, W["times"] + 0.22]: ev(S, click(r), tm, 0.8, 0.2, "click on")
    for tm in [W["times2"], W["poked"] - 0.05]: ev(S, tick(r, 1100), tm, 0.7, 0.2, "poke")
    ev(S, click(r), W["onn"] - 0.02, 1.0, 0.2, "CLICK ON")
    ev(S, chime(r, 1568, 0.8, 3), W["onn"] + 0.03, 0.55, 0.2, "sparkle chime")
    ev(S, chime(r, 1318, 1.0, 3), W["toilet2"], 0.4, 0.3, "clean sparkle")
    for i in range(2): ev(S, servo(r, 0.3, 400, 700), W["send"] + i * 0.35, 0.3, -0.2, "wave servo" if i == 0 else "")
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
