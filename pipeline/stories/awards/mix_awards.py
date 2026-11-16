# "The First AI Music Awards": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_awards.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/awards/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 1000
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(lip=3.17, robots=4.0, reporter=5.47, couldnt=9.6, move=10.02, announcer=11.94, talking=12.74, hosts=13.42, thirty=14.95,
         one=16.26, thirteen=17.12, played=19.47, laughs=19.95, right=21.04, winner=23.21, singer=24.56, artist=25.69, song=25.97,
         album=26.9, year=27.55, would=28.27, send=30.2, music=32.22)
SHOT = {1: (0, 4.45, "theatre"), 2: (4.45, 10.95, "lobby"), 3: (10.95, 14.05, "theatre"), 4: (14.05, 18.15, "theatre"),
        5: (18.15, 22.8, "theatre"), 6: (22.8, 28.1, "theatre"), 7: (28.1, DUR, "theatre")}
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

def roar(dur, r, amp=1.0, bright=900, crackle=0.3):
    """rocket engine roar: deep brown noise + crackle bursts"""
    t = tt(dur)
    y = lp(colored(len(t), r, 1.0), bright) * 3.2 + lp(colored(len(t), r, 0.5), 3000) * 0.4
    cr = bp(r.standard_normal(len(t)), 800, 5000, 1) * (r.random(len(t)) > 0.985) * 3 * crackle
    return (y + cr) * amp

def boom(r, dur=2.2):
    t = tt(dur)
    y = lp(r.standard_normal(len(t)), 500) * np.exp(-t / 0.35) * 3.0 + np.sin(phase(35 + 50 * np.exp(-t / 0.2))) * np.exp(-t / 0.6) * 1.2
    y += bp(r.standard_normal(len(t)), 1000, 6000, 1) * np.exp(-t / 0.05) * 1.2
    return fades(y, 0.001, 0.3)

def clang(r, f=95):
    t = tt(1.4)
    y = modal(1.4, [(f, 1.0, 0.5), (f * 2.31, 0.6, 0.35), (f * 3.9, 0.4, 0.25), (f * 6.2, 0.25, 0.15)], r)
    return fades(y + bp(r.standard_normal(len(t)), 600, 5000, 1) * np.exp(-t / 0.01) * 0.8, 0.001, 0.1)

def murmur(dur, r, level=0.05):
    """theatre crowd murmur: band-limited babble-ish noise with slow swells"""
    t = tt(dur)
    y = bp(colored(len(t), r, 0.6), 250, 1800, 1) * (0.7 + 0.3 * np.sin(phase(0.4 + 0 * t))) * level
    return y

def shutter(r):
    t = tt(0.12)
    y = np.zeros(len(t)); X._place_mono(y, click(r), 0); X._place_mono(y, click(r) * 0.7, 0.05)
    return y + bp(r.standard_normal(len(t)), 2000, 8000, 1) * np.exp(-t / 0.02) * 0.2

def flash_whine(r):
    return sweep(3000, 6500, 0.25, 0.08)

def mic_feedback(r, dur=0.8, f=2300):
    t = tt(dur)
    return fades(np.sin(phase(f * (1 + 0.01 * np.sin(phase(6 + 0 * t))))) * 0.35 * np.minimum(1, t / 0.3), 0.01, 0.15)

def blah(dur, r, base=170, rate=7.0, amp=1.0):
    """robotic announcer gabble: buzzy formant syllables (no words)"""
    y = np.zeros(ns(dur + 0.2)); tm = 0
    while tm < dur:
        d = r.uniform(0.08, 0.16); t = tt(d); f = base * r.uniform(0.85, 1.25)
        syl = signal.square(phase(f + 0 * t)) * 0.3 + signal.sawtooth(phase(f * 2 + 0 * t)) * 0.2
        syl = bp(syl, r.uniform(500, 900), r.uniform(1800, 3200), 1) * np.sin(np.pi * t / d) * amp
        X._place_mono(y, syl, tm); tm += 1 / rate * r.uniform(0.8, 1.2)
    return y

def scratch(r, dur=0.45):
    t = tt(dur); f = 300 + 1200 * np.abs(np.sin(phase(5 + 0 * t)))
    return fades(bp(r.standard_normal(len(t)), 400, 5000, 1) * 0.6 * np.abs(np.sin(phase(9 + 0 * t))) + np.sin(phase(f)) * 0.15, 0.005, 0.05)

def bars_tone(dur):
    t = tt(dur); return fades(np.sin(phase(1000 + 0 * t)) * 0.25, 0.005, 0.05)

def clock_ticks(dur, r, rate=2.0):
    y = np.zeros(ns(dur + 0.1)); tm = 0; i = 0
    while tm < dur: X._place_mono(y, tick(r, 1800 if i % 2 else 2200) * 0.6, tm); tm += 1 / rate; i += 1
    return y

def sfx():
    r = rng(91)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        bed = st(room(d, r, 0.025)) + st(murmur(d, r, 0.05 if p == "theatre" else 0.03))
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: a backing-track play click, stage whoosh to the flash
    ev(S, click(r), W["lip"] - 0.05, 0.9, 0.4, "PLAY click (backing track)")
    ev(S, chime(r, 1568, 0.5, 2), W["lip"], 0.3, 0.4, "")
    ev(S, boing(r, 300, 0.4), W["robots"] - 0.03, 0.5, 0, "caught boing")
    ev(S, X.whoosh(0.4, r, 0.3, 500, 6000, tail=0.1), 4.2, 0.6, 0, "to flash")
    # red carpet: camera shutters + flash whines (match the flash fx: phase (t*1.3 + i*0.37) % 1 < 0.12, i = 6, 7)
    for i in (6, 7):
        tm = 4.45
        while tm < W["couldnt"] - 0.1:
            ph = (tm * 1.3 + i * 0.37) % 1
            if ph < 1 / 30 * 1.3: ev(S, shutter(r), tm, 0.6, -0.4 if i == 6 else -0.1, "shutter")
            tm += 1 / 30
    ev(S, st(env_seg(blah(W["couldnt"] - 0.3 - W["reporter"], r, 230, 8.0, 0.25), 0.05)), W["reporter"], 0.35, 0.3, "tower chatter")
    for i in range(5): ev(S, servo(r, 0.22, 300 + 30 * i, 420 + 30 * i, 0.4), W["couldnt"] + i * 0.24, 0.6, 0.2, "STRAIN servo" if i == 0 else "")
    ev(S, drip(r), W["move"] + 0.3, 0.6, 0.2, "sweat drip")
    # announcer: feedback squeal, robotic gabble over the hosts
    ev(S, mic_feedback(r, 0.6), W["announcer"] - 0.2, 0.5, 0, "feedback squeal")
    ev(S, st(env_seg(blah(14.05 - W["talking"], r, 150, 7.0, 0.8), 0.05)), W["talking"] - 0.05, 0.8, 0, "ANNOUNCER gabble")
    # waiting: clock ticks speeding up, yawns of the crowd (soft), bell-less
    ev(S, st(clock_ticks(W["one"] - 14.05, r, 2.5)), 14.05, 0.7, 0.3, "clock ticks")
    ev(S, st(clock_ticks(18.15 - W["one"], r, 4.0)), W["one"], 0.6, -0.2, "clock ticks fast")
    ev(S, warble(r, 0.8), W["thirteen"] + 0.2, 0.3, 0, "sleepy warble")
    # trailer: whoosh in, cut: record scratch + bars tone; audience laugh
    ev(S, X.whoosh(0.8, r, 0.5, 100, 2500, tail=0.3), W["played"] - 0.1, 0.6, 0, "trailer whoosh")
    ev(S, scratch(r, 0.4), W["right"] - 0.05, 0.9, 0, "RECORD SCRATCH")
    ev(S, bars_tone(22.8 - W["right"] - 0.1), W["right"] + 0.1, 0.2, 0, "bars tone")
    ev(S, X.applause(1.2, r, 14), W["right"] + 0.4, 0.25, 0, "crowd chuckle")
    # winner: three ding+pop hits, confetti pops, applause
    for i, w in enumerate([W["artist"], W["song"], W["album"]]):
        ev(S, pop(r), w - 0.04, 0.8, [-0.4, 0, 0.4][i], "TROPHY pop" if i == 0 else "")
        ev(S, chime(r, 1318 * (1.12 ** i), 0.6, 2), w, 0.4, [-0.4, 0, 0.4][i], "")
    ev(S, popcloud(r, 0.8, 12), W["year"] - 0.05, 0.4, 0, "confetti pops")
    ev(S, X.applause(2.6, r, 30), W["year"] - 0.1, 0.55, 0, "applause")
    ev(S, chime(r, 1046, 1.0, 3), W["year"], 0.35, 0, "ta-da")
    # ending: a playful boing on "send"
    ev(S, boing(r, 260, 0.45), W["send"] - 0.02, 0.4, 0.2, "boing")
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
