# "The Satellite That Wrote a Poem": own synthesized SFX + ElevenLabs score + ElevenLabs voice -> mix.wav.
# usage: python3 mix_orbit.py <day_dir>   (reads voice/voice.wav, voice/words.json, audio/music.wav; writes audio/mix.wav)
# Standard mix (skill): music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech; -15 LUFS, -1.2 dBTP.
# Times mirror studio/src/videos/orbit/story.ts (W, SHOTS).
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, integrated, momentary_max, true_peak, read_wav, write_wav, phase
import sfx_gen as X
from scipy import signal, ndimage

DAY = sys.argv[1]
TOTAL = 2070
DUR = TOTAL / 30
N = ns(DUR)
F = lambda s: round(s * 30) / 30
W = dict(poem=5.31, rocket=8.13, lifts=9.99, four=11.58, orbit=15.28, blasted=17.24, glitching=20.25, three=21.12,
         wake=26.01, engineers=26.92, message=27.95, answers=35.48, blue=38.04, data=39.46, starlight=41.68, luckily=44.12,
         oneChip=47.35, twenty=49.25, minutes=49.58, solar=52.22, unplugged=54.15, sun=56.96, talking=61.91, laser=62.45,
         poets=63.93, limericks=66.48)
SHOT = {1: (0, 3.3, "space"), 2: (3.3, 6.3, "space"), 3: (6.3, 10.8, "pad"), 4: (10.8, 14.55, "clean"), 5: (14.55, 16.05, "space"),
        6: (16.05, 19.4, "lab"), 7: (19.4, 23.85, "lab"), 8: (23.85, 26.85, "space"), 9: (26.85, 29.0, "ctrl"), 10: (29.0, 31.95, "space"),
        11: (31.95, 34.15, "ctrl"), 12: (34.15, 36.55, "sta"), 13: (36.55, 37.9, "ctrl"), 14: (37.9, 43.9, "space"), 15: (43.9, 45.75, "ctrl"),
        16: (45.75, 50.35, "space"), 17: (50.35, 54.05, "park"), 18: (54.05, 55.6, "night"), 19: (55.6, 58.9, "space"), 20: (58.9, 63.2, "space"),
        21: (63.2, DUR, "space")}
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


# ---------------------------------------------------------------- event table
def sfx():
    r = rng(7)
    S = np.zeros((2, N))
    # beds per place
    for k, (a, b) in SPAN.items():
        p, d = SHOT[k][2], b - a
        if p == "space": bed = st(hum(d, r, 55, 0.05) + lp(colored(ns(d), r, 1.2), 300) * 0.05)
        elif p == "pad": bed = X.breeze(d, r, 0.7) + st(X.bird_chirps(d, r, 0.5) * 0.08)
        elif p in ("lab", "clean", "ctrl"): bed = st(room(d, r, 0.04) + hum(d, r, 120, 0.012))
        elif p == "sta": bed = X.breeze(d, r, 1.3, gust=0.3, bright=1400)
        elif p == "park": bed = X.breeze(d, r, 0.5) + st(X.bird_chirps(d, r, 0.4) * 0.07)
        else: bed = st(X.crickets(d, r) * 0.25) if hasattr(X, "crickets") else st(room(d, r))
        ev(S, env_seg(widen(bed[0] if bed.ndim == 2 else bed, r, 11, 0.6) if bed.ndim == 1 else bed, 0.06), a, 1.0, 0, f"bed {p}")
    # hook
    ev(S, chime(r, 1568), W["poem"], 0.7, 0.2, "poem chime")
    ev(S, X.whoosh(0.5, r, 0.3, 300, 3000, tail=0.12), SPAN[3][0] - 0.3, 0.7, 0, "flash whoosh")
    # launch
    ev(S, st(rumble(SPAN[3][1] - W["lifts"] + 0.4, r, 1.0)), W["lifts"] - 0.05, 1.0, 0, "ROCKET ignition")
    ev(S, pop(r) * 1.2, W["lifts"] - 0.02, 0.8, 0, "ignition crack")
    # clean room: four chips light up
    for i in range(4): ev(S, beep(880 * (1.26 ** i), 0.1, 0.4), W["four"] - 0.07 + i * 0.18, 0.6, -0.2 + 0.13 * i, "chip on" if i == 0 else "")
    # wings unfold
    ev(S, sweep(300, 900, 0.5, 0.3), W["orbit"] - 0.25, 0.6, 0, "wings servo")
    ev(S, tick(r, 1600) * 1.5, W["orbit"] + 0.25, 0.7, 0, "wings click")
    ev(S, chime(r, 1760, 1.0, 2), W["orbit"] + 0.2, 0.4, 0)
    # proton beam
    ev(S, st(beam_whine(SPAN[7][1] - W["blasted"], r)), W["blasted"] - 0.03, 0.5, 0, "BEAM on")
    ev(S, zap(r, 0.35), W["blasted"] - 0.03, 0.9, -0.3, "beam zap")
    for i in range(6): ev(S, zap(r, 0.12), W["glitching"] + i * 0.13, 0.7, r.uniform(-0.3, 0.3), "glitch" if i == 0 else "")
    ev(S, chime(r, 1046, 0.8, 2), W["three"], 0.5, 0.2, "ding")
    # wake up
    ev(S, sweep(200, 1400, 0.6, 0.35), W["wake"] - 0.4, 0.7, 0, "power up")
    ev(S, chime(r, 1318, 0.8, 2), W["wake"] + 0.05, 0.5, 0)
    # control room: typing, mic beep, send
    ev(S, keys(r, 1.0), SPAN[9][0] + 0.05, 0.5, -0.3, "typing")
    ev(S, beep(1200, 0.08, 0.4), W["message"] - 0.05, 0.5, -0.3, "mic beep")
    ev(S, sweep(400, 2400, 1.2, 0.3), SPAN[10][0], 0.6, 0, "uplink sweep")
    ev(S, chime(r, 2093, 0.6, 1), SPAN[10][0] + 1.6, 0.5, 0, "message arrives")
    # waiting: slow clock ticks
    for i in range(5): ev(S, tick(r, 2000) * 0.8, SPAN[11][0] + 0.15 + i * 0.45, 0.5, 0.3, "clock" if i == 0 else "")
    # station: the answer comes down
    ev(S, sweep(2400, 600, 0.9, 0.3), W["answers"], 0.6, 0, "downlink")
    ev(S, chime(r, 1568, 1.6, 3), W["answers"] + 0.85, 0.6, 0.1, "answer chime")
    ev(S, X.whoa(r, 180) * 0.6, SPAN[13][0] + 0.1, 0.5, -0.2, "ooh")
    # haiku shimmer
    for tm, f in ((W["blue"], 1046), (W["data"], 1318), (W["starlight"], 1568)): ev(S, chime(r, f, 1.8, 3), tm, 0.35, r.uniform(-0.3, 0.3), "shimmer")
    # celebration
    a, b = SPAN[15]
    for i, base in enumerate((150, 210, 120)): ev(S, X.hurrah(r, base, 1.0), a + 0.05 + 0.18 * i, 0.5, -0.4 + 0.4 * i, "cheer" if i == 0 else "")
    ap = X.applause(b - a, r, 10); ev(S, env_seg(ap, 0.1), a + 0.1, 0.35, 0, "clap")
    # one chip at a time, falls asleep
    for i in range(3): ev(S, beep(700 * (0.8 ** i), 0.09, 0.35), W["oneChip"] + i * 0.1, 0.6, 0.1, "chips off" if i == 0 else "")
    ev(S, sweep(900, 150, 1.1, 0.3), W["minutes"] + 0.1, 0.6, 0, "sleepy powerdown")
    # park: plug pops, sad tone
    ev(S, pop(r), W["unplugged"], 1.0, 0.2, "PLUG pop")
    ev(S, sweep(700, 300, 0.7, 0.25), W["unplugged"] + 0.2, 0.5, 0.2, "battery low")
    # charging in the sun
    ev(S, sweep(300, 1200, 0.5, 0.25), W["sun"] - 0.05, 0.5, 0.2, "charge")
    # twins chatter + laser
    for i in range(6): ev(S, beep(r.uniform(900, 1800), 0.06, 0.3), W["talking"] + i * 0.09, 0.45, (-0.4 if i % 2 else 0.4), "chatter" if i == 0 else "")
    ev(S, sweep(2200, 500, 0.25, 0.4), W["laser"], 0.7, 0, "LASER")
    ev(S, st(hum(SPAN[20][1] - W["laser"] - 0.1, r, 440, 0.03)), W["laser"] + 0.1, 0.8, 0)
    # twist
    ev(S, chime(r, 1975, 0.5, 1), W["poets"], 0.35, 0.2, "beret plink")
    ev(S, warble(r, 1.2), W["limericks"] + 0.05, 0.6, 0, "dizzy warble")
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
