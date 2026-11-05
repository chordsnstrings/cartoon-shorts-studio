# "The Sky Gave It Away": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_skyclue.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/skyclue/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 2055
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(found=1.07, hear=5.22, camera=8.11, trees=9.2, september=12.02, somewhere=13.08, hidden=14.61, planes=16.25, passing=17.18, apart=19.21,
         gigabytes=20.76, wrote=22.59, lines=23.57, code=24.14, seventy=25.75, fifteen=29.49, simulated=31.33, one=34.8, street=35.97,
         same=36.81, pole=38.22, cam2=39.33, luckily=40.4, slim=43.37, filters=45.99, noise=46.71, phone=47.26, siren=49.43, passes=50.99,
         close=55.38, broadcast=57.01, publicly=58.48, clock=62.24, map=63.41, films=66.01)
SHOT = {1: (0, 3.35, "river"), 2: (3.35, 6.0, "river"), 3: (6.0, 10.85, "desk"), 4: (10.85, 14.45, "map"), 5: (14.45, 19.95, "desk"),
        6: (19.95, 24.65, "desk"), 7: (24.65, 28.15, "map"), 8: (28.15, 30.85, "map"), 9: (30.85, 34.7, "map"), 10: (34.7, 36.0, "map"),
        11: (36.0, 40.25, "river"), 12: (40.25, 43.95, "desk"), 13: (43.95, 48.4, "desk"), 14: (48.4, 51.8, "street"), 15: (51.8, 56.3, "river"),
        16: (56.3, 60.45, "map"), 17: (60.45, 64.15, "river"), 18: (64.15, DUR, "river")}
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
def sfx():
    r = rng(11)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p == "river": bed = X.breeze(d, r, 0.6) + st(X.bird_chirps(d, r, 0.5) * 0.08 + lp(colored(ns(d), r, 1.0), 900) * 0.02)
        elif p == "desk": bed = st(room(d, r, 0.04) + hum(d, r, 120, 0.01))
        elif p == "map": bed = X.breeze(d, r, 0.35, gust=0.1, bright=1500) + st(hum(d, r, 80, 0.02))
        else: bed = X.breeze(d, r, 0.5) + st(lp(colored(ns(d), r, 1.0), 500) * 0.05)
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: a distant jet high above; nobody hears it
    ev(S, jet(6.2, r, 90, 0.85, 0.45, 0.35, 1200), 0.0, 0.6, 0, "jet distant")
    ev(S, sweep(1800, 900, 0.5, 0.15), W["hear"] - 0.1, 0.4, 0.2, "faint hush")
    ev(S, X.whoosh(0.5, r, 0.3, 300, 3000, tail=0.12), SPAN[3][0] - 0.3, 0.7, 0, "flash whoosh")
    # the clip: a CCTV click + beep
    ev(S, tick(r, 1800) * 1.4, SPAN[3][0] + 1.95, 0.6, 0.2, "clip click")
    ev(S, beep(1500, 0.07, 0.3), W["camera"], 0.4, 0.2, "rec beep")
    # map: calendar flip, magnifier swish
    ev(S, X.whoosh(0.3, r, 0.2, 800, 5000, tail=0.05), W["september"] - 0.1, 0.5, 0, "calendar flip")
    ev(S, X.whoosh(0.7, r, 0.4, 300, 2500, tail=0.2), W["somewhere"], 0.5, 0, "lens swish")
    # the spectrogram: streak pings, a ticking gap
    ev(S, chime(r, 1318, 1.0, 2), W["planes"] - 0.05, 0.55, -0.2, "streak 1")
    for i in range(6): ev(S, tick(r, 2200) * 0.8, W["passing"] + i * 0.33, 0.45, 0.2, "gap clock" if i == 0 else "")
    ev(S, chime(r, 1760, 1.0, 2), W["apart"] - 0.1, 0.55, 0.2, "streak 2")
    # 50 GB of drives clatter down, typing, the printer spews
    ev(S, clatter(r, 14, 1.45), W["gigabytes"] - 0.27, 0.9, -0.15, "DRIVES clatter")
    ev(S, keys(r, 1.2, 12), W["wrote"] - 0.05, 0.6, 0.2, "typing")
    ev(S, printer(1.6, r), W["lines"] - 0.4, 0.5, -0.3, "printer")
    ev(S, X.whoosh(0.8, r, 0.5, 1500, 7000, tail=0.2) * 0.6, W["lines"] - 0.2, 0.4, -0.3, "paper rush")
    # dots pop in, most blink out, computing, one remains
    ev(S, popcloud(r, 1.1, 40), W["seventy"] - 0.3, 0.6, 0, "dots pop")
    ev(S, sweep(1400, 300, 0.6, 0.3), W["fifteen"] - 0.1, 0.6, 0, "dots vanish")
    for i in range(14): ev(S, beep(r.uniform(900, 2000), 0.05, 0.25), W["simulated"] + i * 0.22, 0.4, r.uniform(-0.4, 0.4), "computing" if i == 0 else "")
    ev(S, chime(r, 1568, 1.6, 3), W["one"] - 0.05, 0.7, 0, "ONE ding")
    ev(S, X.whoosh(1.1, r, 0.55, 250, 2500, tail=0.3), SPAN[11][0] - 0.3, 0.7, 0, "dive whoosh")
    ev(S, sweep(500, 900, 0.25, 0.25) + 0, W["cam2"] - 0.15, 0.6, 0.2, "camera servo")
    ev(S, tick(r, 1400) * 1.5, W["cam2"] + 0.1, 0.6, 0.2, "servo click")
    # deadpan: filters swish, static burst, phone squash
    ev(S, X.whoosh(0.5, r, 0.3, 1000, 6000, tail=0.1), W["filters"] - 0.2, 0.5, 0, "filter swish")
    ev(S, st(static(0.6, r)), W["noise"] - 0.1, 0.45, 0, "STATIC")
    ev(S, sweep(600, 180, 0.3, 0.35), W["phone"] - 0.1, 0.6, 0, "squash")
    # the siren passes (Doppler)
    a, b = SPAN[14]
    ev(S, siren(b - a + 0.2, r, W["passes"] - a), a, 0.9, 0, "SIREN pass")
    ev(S, jet(2.2, r, 70, 0.9, 0.5, 0.5, 700), W["passes"] - 1.1, 0.35, 0, "engine")
    # planes do it too: the high one, then the low one roars past
    ev(S, jet(4.6, r, 95, 0.84, 0.5, 0.5, 1500), SPAN[15][0], 0.7, -0.2, "jet high")
    ev(S, jet(2.2, r, 120, 0.72, 0.42, 1.1, 2600), W["close"] - 0.9, 0.9, 0.3, "JET low pass")
    # broadcast blips
    for i in range(16): ev(S, beep(r.choice([1320, 1760, 2093]), 0.05, 0.22), W["broadcast"] + i * 0.19, 0.35, r.uniform(-0.6, 0.6), "blips" if i == 0 else "")
    # clock + map: a soft tick and a shimmer
    ev(S, tick(r, 2000) * 1.2, W["clock"], 0.5, 0, "clock tick")
    ev(S, chime(r, 1046, 1.4, 3), W["map"], 0.4, 0, "map shimmer")
    ev(S, jet(3.8, r, 85, 0.86, 0.5, 0.3, 1000), SPAN[17][0], 0.5, 0, "jet golden")
    # the ending: bird flutters in, lands, tweets
    ev(S, flutter(r, 0.6), 66.4, 0.6, -0.3, "bird flutter")
    ev(S, tick(r, 1100) * 1.2, 67.0, 0.5, 0, "bird lands")
    ev(S, sweep(3000, 4200, 0.08, 0.35), 67.35, 0.5, 0.1, "tweet")
    ev(S, sweep(3600, 2900, 0.1, 0.3), 67.5, 0.5, 0.1, "")
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
