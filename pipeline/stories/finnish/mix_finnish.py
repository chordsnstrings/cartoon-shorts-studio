# "Eleven Thousand Searches for Finnish Music": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_finnish.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/finnish/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 2085
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(eleven=3.13, finnish=5.03, fifteen=7.66, students=11.2, humming=13.72, hundred=15.61, five=17.72, human=22.82, six=23.83,
         ticked=25.25, tf=25.65, queue=29.17, full=29.72, everybody=30.43, out=30.68, famous=33.57, people2=35.93, scraping=37.73,
         everything=38.34, doesnt=42.12, fills=43.17, truck=43.74, then=44.5, different2=46.26, again=47.47, again2=48.41, banned=49.94,
         came=52.4, letting=56.39, keeping=57.52, botsOut=57.95, worse=61.8, never=66.84, note=68.05)
SHOT = {1: (0, 2.9, "lib"), 2: (2.9, 6.55, "lib"), 3: (6.55, 8.75, "desk"), 4: (8.75, 14.45, "lib"), 5: (14.45, 17.45, "desk"),
        6: (17.45, 19.9, "desk"), 7: (19.9, 27.75, "desk"), 8: (27.75, 31.55, "lib"), 9: (31.55, 34.3, "fin"), 10: (34.3, 36.55, "lib"),
        11: (36.55, 40.45, "lib"), 12: (40.45, 49.25, "buf"), 13: (49.25, 54.0, "desk"), 14: (54.0, 58.9, "lib"), 15: (58.9, 62.5, "lib"),
        16: (62.5, DUR, "fin")}
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


def sfx():
    r = rng(17)
    S = np.zeros((2, N))
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p == "lib": bed = st(room(d, r, 0.035) + hum(d, r, 100, 0.006))
        elif p == "desk": bed = st(room(d, r, 0.04) + hum(d, r, 120, 0.01))
        elif p == "fin": bed = X.breeze(d, r, 0.45, gust=0.12, bright=1200) + st(lp(colored(ns(d), r, 1.0), 700) * 0.02)
        else: bed = st(room(d, r, 0.05) + X.babble(d, r, 160, 1.0) * 0.02)
        ev(S, env_seg(bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook: bubbles pop in faster and faster
    for i in range(40):
        tm = 0.25 + 5.9 * (i / 40) ** 0.8
        ev(S, pop(r) * 0.5, tm, 0.35, r.uniform(-0.6, 0.6), "bubble pops" if i == 0 else "")
    ev(S, chime(r, 1318, 0.9, 2), W["eleven"] - 0.05, 0.5, 0, "eleven ding")
    ev(S, X.whoosh(0.7, r, 0.4, 300, 3000, tail=0.2), W["finnish"] - 0.25, 0.6, 0, "swirl whoosh")
    ev(S, X.whoosh(0.5, r, 0.3, 300, 3000, tail=0.12), SPAN[3][0] - 0.3, 0.7, 0, "flash whoosh")
    ev(S, bloop(r, 900, 500, 0.12), W["fifteen"] - 0.05, 0.6, -0.2, "tiny bar bloop")
    ev(S, st(keys(r, 1.6, 6)), W["students"], 0.25, 0, "pages/typing")
    ev(S, hum(1.2, r, 220, 0.1), W["humming"] - 0.1, 0.4, 0, "kiosk hum")
    # load: soft ticks, then a rush of ticks to 500
    for i in range(10): ev(S, tick(r, 2200) * 0.6, W["hundred"] - 0.2 + i * 0.12, 0.4, r.uniform(-0.3, 0.3), "icons" if i == 0 else "")
    ev(S, popcloud(r, 1.2, 50), W["five"] - 0.1, 0.6, 0, "FIVE HUNDRED rush")
    ev(S, sweep(500, 1400, 0.4, 0.35), W["five"] - 0.05, 0.6, 0, "meter up")
    # filters: six clicks, then twenty-five machine-gun ticks
    for i in range(6): ev(S, tick(r, 1800), W["six"] - 0.15 + i * 0.05, 0.5, -0.3, "six ticks" if i == 0 else "")
    for i in range(25): ev(S, tick(r, 2400), W["ticked"] - 0.1 + i / 38, 0.55, 0.3, "25 ticks" if i == 0 else "")
    # queue full: alarm buzz, students flung out
    ev(S, st(np.concatenate([beep(330, 0.25, 0.6), np.zeros(ns(0.08)), beep(330, 0.25, 0.6)])), W["queue"] - 0.05, 0.8, 0, "QUEUE FULL buzz")
    ev(S, X.whoosh(0.8, r, 0.3, 200, 2500, tail=0.3), W["everybody"] - 0.05, 0.9, 0, "fling whoosh")
    ev(S, X.oof(r, "oof"), W["out"] + 0.1, 0.5, -0.3, "oof"); ev(S, flutter(r, 0.8, 22), W["out"], 0.5, 0.3, "papers")
    # Finland: wind, one lonely bird
    ev(S, st(X.bird_chirps(1.5, r, 0.3)) * 0.2, W["famous"] - 0.8, 0.5, 0.2, "lone bird")
    # bots march in
    ev(S, st(robo_steps(2.2, r, 9, 2)), SPAN[10][0], 0.6, 0, "bot steps")
    ev(S, servo(r, 0.3, 500, 800), W["people2"] - 0.15, 0.7, 0, "head servo")
    ev(S, bloop(r, 1200, 1700, 0.08), W["people2"] + 0.2, 0.5, 0, "bleep")
    # scraping: vacuum whine + flapping books
    ev(S, st(beam_whine(3.6, r)), SPAN[11][0] + 0.2, 0.45, 0, "scrape whine")
    ev(S, flutter(r, 3.0, 12), SPAN[11][0] + 0.4, 0.5, 0.3, "book flaps")
    ev(S, X.whoosh(1.4, r, 0.6, 600, 6000, tail=0.3), W["everything"] - 0.1, 0.5, 0, "cards whirl")
    # buffet: plates clink, shake bleep, food thud into truck, tiptoe, door pops
    ev(S, clatter(r, 6, 1.5), SPAN[12][0] + 0.4, 0.5, -0.2, "plates")
    ev(S, np.concatenate([bloop(r, 900, 600, 0.08), bloop(r, 900, 600, 0.08)]), W["doesnt"], 0.5, 0, "nope bleep")
    ev(S, st(robo_steps(0.6, r, 6)), W["fills"], 0.5, 0.3, "steps")
    ev(S, clatter(r, 9, 0.6), W["truck"] - 0.05, 0.8, 0.4, "DUMP into truck")
    ev(S, st(robo_steps(1.6, r, 5)) * 0.5, W["then"], 0.4, -0.3, "tiptoe")
    for k, tm in enumerate([W["different2"] - 0.25, W["again"] - 0.1, W["again2"] - 0.1]):
        ev(S, X.whoosh(0.25, r, 0.1, 800, 5000, tail=0.05), tm, 0.5, -0.3 + 0.3 * k, "door pop" if k == 0 else "")
        ev(S, pop(r), tm + 0.05, 0.6, -0.3 + 0.3 * k, "")
    # ban map: stamps, then pops back
    for i in range(14): ev(S, tick(r, 900) * 1.2, W["banned"] - 0.1 + i * 0.1, 0.45, r.uniform(-0.4, 0.4), "stamps" if i == 0 else "")
    ev(S, popcloud(r, 1.0, 30), W["came"] - 0.2, 0.5, 0, "pop back")
    ev(S, X.oof(r, "oof") * 0.3, 53.4, 0.3, 0, "sigh")
    # the guard: welcome chime, then BOING
    ev(S, chime(r, 1046, 0.8, 2), W["letting"], 0.45, 0.2, "welcome chime")
    ev(S, st(robo_steps(0.6, r, 7)), W["keeping"] - 0.6, 0.5, 0.2, "bot approach")
    ev(S, boing(r), W["botsOut"] - 0.02, 0.9, 0.2, "BOING")
    ev(S, st(robo_steps(2.5, r, 10, 3)), SPAN[15][0] + 0.4, 0.45, 0, "more bots")
    ev(S, popcloud(r, 0.6, 18), W["worse"] - 0.1, 0.45, 0, "worse pops")
    # ending: wind, a soft plink when the note bonks the antenna
    ev(S, sweep(2000, 2600, 0.06, 0.3), W["note"] + 0.3, 0.6, 0.2, "note plink")
    ev(S, tick(r, 1600), W["note"] + 0.35, 0.5, 0.2, "")
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
