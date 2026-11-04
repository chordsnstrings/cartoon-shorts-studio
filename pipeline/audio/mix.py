# SFX (own synthesis) + score + voice -> mix.wav (48 kHz, exact picture length), stems, cues.md.
# Standard mix: music +3 dB, SFX -6 dB, voice unchanged; music ducks -3 dB under speech (key = words.json);
# master normalised to -15 LUFS integrated, true-peak limited to -1.2 dBTP.
import json, os
import numpy as np
from scipy import signal, ndimage
from dsp import (SR, ns, tt, rng, lp, hp, bp, pan, place, st, fades, dbg, modal, colored, widen, make_ir, convolve_st,
                 integrated, momentary_max, true_peak, read_wav, write_wav, phase)
import sfx_gen as X
import timeline as T
import music

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = os.path.join(HERE, "..", "voice", "voice.wav")
WORDS = os.path.join(HERE, "..", "voice", "words.json")
N = ns(T.DUR)
W = T.W
CUES = []


def ev(buf, x, t, gain=1.0, p=0.0, name=""):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = pan(x, p)
    place(buf, x, t, gain)
    if name:
        CUES.append((t, name))


def add(a, b):
    n = max(len(a), len(b))
    return np.pad(a, (0, n - len(a))) + np.pad(b, (0, n - len(b)))


def norm(x, peak=1.0):
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


# ---------------------------------------------------------------- own one-shots
def servo(r, dur=0.35, f0=420, f1=760):
    t = tt(dur)
    f = f0 + (f1 - f0) * np.sin(np.pi * t / dur / 2)
    y = sum(np.sin(phase(f * k)) / k ** 1.5 for k in (1, 2, 3, 5))
    y += 0.25 * bp(colored(len(t), r, 0.2), 1200, 4000, 1)
    env = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.06)
    return fades(y * env * 0.4, 0.005, 0.03)


def powerdown(r, dur=1.0):
    t = tt(dur)
    f = 620 * np.exp(-t / 0.35) + 60
    y = sum(np.sin(phase(f * k)) / k ** 1.3 for k in (1, 2, 3)) * np.exp(-t / 0.5)
    return fades(y * 0.5, 0.003, 0.1)


def thump(r, big=1.0):
    """fist/arm on a wooden table: low body boom + knock"""
    t = tt(0.6)
    boom = np.sin(phase(70 * (1 + 0.6 * np.exp(-t / 0.02)))) * np.exp(-t / 0.13) * 1.3 * big
    knock = modal(0.3, [(r.uniform(180, 240), 1.0, 0.05), (r.uniform(420, 520), 0.6, 0.03), (r.uniform(900, 1200), 0.35, 0.015)], r)
    sl = hp(r.standard_normal(len(t)), 1500) * np.exp(-t / 0.004) * 0.4
    return add(boom + sl, knock)


def ceramic(r, big=1.0):
    """a plate hitting the floor: clatter of bright modes + a few shards"""
    y = np.zeros(ns(0.8))
    for i in range(int(5 + 6 * big)):
        c = modal(0.35, [(r.uniform(1800, 3600), 1.0, r.uniform(0.02, 0.08)), (r.uniform(4200, 7000), 0.5, 0.02)], r)
        X._place_mono(y, c * r.uniform(0.3, 1.0), abs(r.normal(0, 0.04)) + (0.12 * r.uniform() if i > 4 else 0))
    t = tt(0.8)
    y += bp(r.standard_normal(len(t)), 2000, 8000, 1) * np.exp(-t / 0.03) * 0.5
    return y


def sticks(r):
    """wooden chopsticks landing: dry little taps"""
    y = np.zeros(ns(0.5))
    for i in range(5):
        c = modal(0.12, [(r.uniform(1100, 1900), 1.0, 0.012), (r.uniform(2600, 4000), 0.5, 0.006)], r)
        X._place_mono(y, c * r.uniform(0.4, 1.0), i * r.uniform(0.03, 0.07))
    return y


def splat(r):
    t = tt(0.4)
    y = lp(r.standard_normal(len(t)), 1800) * np.exp(-t / 0.05) * (1 + 0.5 * np.sin(phase(30)))
    return add(y, 0.5 * X.bubbles(0.4, r, 40, f_lo=300, f_hi=900))


def popper(r):
    t = tt(0.5)
    bang = bp(r.standard_normal(len(t)), 400, 5000, 1) * np.exp(-t / 0.012) * 1.5
    rustle = hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.25) * 0.25 * np.minimum(1, t / 0.03)
    return bang + rustle


def tick(r, f=2600):
    t = tt(0.06)
    return np.sin(phase(f + 0 * t)) * np.exp(-t / 0.008) + hp(r.standard_normal(len(t)), 4000) * np.exp(-t / 0.002) * 0.3


def tin_step(r):
    t = tt(0.12)
    return modal(0.12, [(r.uniform(2200, 2800), 1.0, 0.02), (r.uniform(4800, 5600), 0.5, 0.01)], r) + hp(r.standard_normal(len(t)), 2500) * np.exp(-t / 0.002) * 0.3


def clockwork(dur, r, rate):
    """ratchet ticking while the spring runs (rate per second, list or scalar)"""
    y = np.zeros(ns(dur))
    tm = 0
    while tm < dur:
        rr = rate(tm) if callable(rate) else rate
        if rr <= 0.1:
            break
        X._place_mono(y, tick(r, r.uniform(3200, 3800)) * 0.4, tm)
        tm += 1 / rr
    return y


def phone_tap(r):
    t = tt(0.09)
    return np.sin(phase(1400 + 0 * t)) * np.exp(-t / 0.03) * 0.6


def room_tone(dur, r, level=1.0):
    n = ns(dur)
    return lp(colored(n, r, 1.0), 400) * level


# ---------------------------------------------------------------- the event table
def sfx():
    r = rng(21)
    S = np.zeros((2, N))
    D = T.DUR
    rest = [(T.shot_span(i)) for i in T.SHOTS if T.SHOTS[i][2] == "rest"]
    # ---- beds: restaurant murmur + bubbling broth; street birds/breeze/traffic; kitchen room tone
    murmur = np.zeros(N)
    for k in range(7):
        b = X.babble(D, r, r.uniform(100, 220), r.uniform(0.95, 1.15), rate=3.6, active=0.6)
        murmur += lp(b, 2600) * r.uniform(0.5, 1.0)
    murmur = norm(murmur, 0.08)
    broth = norm(X.bubbles(D, r, 14, f_lo=250, f_hi=1100), 0.05)
    bed_r = np.zeros(N)
    for a, b in rest:
        i0, i1 = ns(a), ns(b)
        e = np.ones(i1 - i0); f8 = min(len(e) // 3, ns(0.12)); e[:f8] = np.linspace(0, 1, f8); e[-f8:] = np.linspace(1, 0, f8)
        k = 1.0
        bed_r[i0:i1] += (murmur[i0:i1] * k + broth[i0:i1]) * e
    # the room goes quieter after the slam (everyone watching), and silent after the freeze
    gate = np.ones(N)
    gate[ns(T.HITS[0]):] = 0.45
    gate[ns(W["does"]):] = 0.25
    S += widen(bed_r * gate, r, 13, 0.8)
    # broth close-up on "Luckily"
    a10, b10 = T.shot_span(10)
    ev(S, norm(X.bubbles(b10 - a10, r, 30, f_lo=220, f_hi=900), 0.22), a10, 1.0, -0.1, "broth close")
    a2, b2 = T.shot_span(2)
    street = X.breeze(b2 - a2, r, 0.6) + st(norm(X.bird_chirps(b2 - a2, r, 0.7), 0.12))
    street = street + st(norm(lp(colored(ns(b2 - a2), r, 1.2), 700), 0.06))
    ev(S, street * np.minimum(1, np.arange(street.shape[1]) / ns(0.1))[None, :], a2, 1.0, 0, "street bed")
    for i in (13, 15):
        a, b = T.shot_span(i)
        ev(S, norm(room_tone(b - a, r), 0.03), a, 1.0, 0)
    # ---- hook (tau = t + 21.95): the pounds and the flying tableware
    def hits_at(tau_list, name, gen, g, p=0.0):
        for tt_ in T.tau_to_t(tau_list):
            ev(S, gen(), tt_, g, p, name)
    hits_at([T.HITS[0]], "SLAM", lambda: thump(r, 1.4), 1.0, 0.2)
    hits_at(T.HITS[1:], "pound", lambda: thump(r, 0.9), 0.8, 0.2)
    hits_at(T.HITS, "rattle", lambda: X.rattle(0.35, r, 60) * 0.5, 0.45, 0.25)
    for (kind, at, vy) in T.ITEMS:
        land = T.land_tau(kind, at, vy)
        gen = {"chop": lambda: sticks(r), "sauce": lambda: add(splat(r), 0.6 * ceramic(r, 0.3)), "plate": lambda: ceramic(r, 1.0)}[kind]
        hits_at([land], kind + " lands", gen, 0.55 if kind != "plate" else 0.75, r.uniform(-0.4, 0.4))
        hits_at([at + 0.05], "", lambda: X.whoosh(0.35, r, 0.12, 600, 2600, tail=0.12) * 0.3, 0.5, r.uniform(-0.3, 0.3))
    ev(S, X.whoosh(0.5, r, 0.3, 300, 3000, tail=0.12), T.FLASH - 0.3, 0.7, 0, "flash whoosh")
    # ---- robot moves: servos on the pose changes, the slide, the celebration popper
    for tm, f0, f1, g in [(W["apron"] - 0.1, 400, 700, 0.5), (W["celebration"] - 0.05, 500, 900, 0.6), (W["armsUp"] - 0.1, 450, 850, 0.55),
                          (W["armsOut"] - 0.1, 600, 400, 0.55), (W["down"] - 0.5, 500, 900, 0.5)]:
        ev(S, servo(r, 0.4, f0, f1), tm, g, 0.1, "servo")
    ev(S, popper(r), W["celebration"], 0.8, 0.0, "popper")
    ev(S, add(servo(r, 0.95, 300, 520), 0.4 * lp(colored(ns(0.95), r, 0.5), 600) * np.hanning(ns(0.95))), W["soItDid"] - 0.05, 0.7, -0.2, "slide")
    # servo whirs on the groove's big swings (every other beat while dancing in the restaurant)
    k = 0
    while True:
        tb = W["music"] + k * T.BEAT
        if tb >= W["does"]:
            break
        if tb > T.HITS[0] + 0.4 and k % 2 == 0 and T.place_at(tb) == "rest":
            ev(S, servo(r, 0.25, 520, 720), tb - 0.05, 0.22, 0.1)
        k += 1
    ev(S, powerdown(r), W["does"], 0.8, 0.1, "power down")
    # ---- people
    ev(S, add(X.whoa(r, 160) * 0.7, 0.5 * X.whoa(r, 230)), T.HITS[0] + 0.15, 0.55, -0.3, "gasp")
    for k in range(3):
        ev(S, X.stroll_step(r, 0.8), W["three"] - 0.35 + k * 0.12, 0.45, -0.6 + 0.6 * k, "waiters run in")
    ev(S, X.oof(r, "ugh"), W["three"] + 0.2, 0.45, -0.3, "grab")
    ev(S, X.oof(r, "oof", 120), W["kept"] + 0.15, 0.35, 0.3)
    for tm in (30.45, 31.05, 31.5):
        ev(S, phone_tap(r), tm, 0.35, 0.4, "phone tap")
    # ---- the plan: a tick for every dot as it appears
    for n_ in range(2, 15):
        tm = W["plan"] + (n_ - 2) / 9.0
        ev(S, tick(r, 2200 + 90 * n_) * 0.5, tm, 0.4, 0.2, "plan dot" if n_ == 2 else "")
    # ---- kitchen: clockwork + tin footsteps; the spring runs down in shot 15
    a13, b13 = T.shot_span(13)
    ev(S, clockwork(b13 - a13, r, 9.0), a13, 0.45, 0.0, "clockwork")
    a15, b15 = T.shot_span(15)
    ev(S, clockwork(W["stops"] - a15, r, lambda tm: 9.0 * (1 - 0.55 * tm / (W["stops"] - a15))), a15, 0.45, 0.0, "clockwork slows")
    for tm in T.toy_steps():
        ev(S, tin_step(r), tm, 0.35, 0.0)
    ev(S, tick(r, 1800) * 1.2, W["stops"], 0.6, 0.0, "toy stops")
    # ---- the last plate, after the music stops
    land_last = T.LAST_DROP + np.sqrt(2 * (T.TABLE_H + 0.01) / 9.8)
    ev(S, X.whoosh(0.3, r, 0.2, 800, 3000, tail=0.1) * 0.4, T.LAST_DROP + 0.05, 0.5, 0.3)
    ev(S, ceramic(r, 1.6), land_last, 1.0, 0.3, "LAST PLATE")
    return S


def speech_spans(words, merge=0.3):
    sp = []
    for w in words:
        if sp and w["s"] - sp[-1][1] < merge:
            sp[-1][1] = w["e"]
        else:
            sp.append([w["s"], w["e"]])
    return sp


def duck(spans, depth=-3.0, pre=0.08, post=0.12, att=0.07, rel=0.45):
    g = np.zeros(N)
    for a, b in spans:
        g[max(0, ns(a - pre)):min(N, ns(b + post))] = 1
    k = np.exp(-np.arange(ns(rel * 3)) / ns(rel)); k /= k.sum()
    g = np.minimum(1, np.convolve(g, k, mode="full")[:N] * 1.0 + ndimage.maximum_filter1d(g, ns(att)))
    return dbg(depth * np.clip(g, 0, 1))


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    # release: one-pole in the log domain via a running max of the reduction, then smoothing
    red = -np.log(g1)
    kr = np.exp(-1 / (rel * SR))
    out = signal.lfilter([1 - kr], [1, -kr], red)
    red = np.maximum(red, out)
    g = np.exp(-ndimage.uniform_filter1d(red, 2 * La + 1, mode="nearest"))
    g = np.minimum(g, g1 * 0 + 1)
    return x * np.minimum(g, 1)[None, :]


def main():
    v, sr = read_wav(VOICE)
    assert sr == SR
    v = st(v)[:, :N]
    v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    words = json.load(open(WORDS))
    words[0]["s"] = 0.36  # hand fix: "In" starts after the 0.35 s lead-in
    mw = os.environ.get("MUSIC_WAV")  # ElevenLabs score (eleven_music.py) if given, else the synthesized one
    if mw:
        mus, _ = read_wav(mw)
        mus = np.pad(st(mus)[:, :N], ((0, 0), (0, max(0, N - st(mus).shape[1]))))
    else:
        Gm, Um, Mm = music.render()
        mus = Gm + Um + Mm
    S = sfx()
    Lv = integrated(v)
    # base levels: music bed 14 LU under the voice, SFX peaks at the voice's loudest moment; then the standard mix
    mus = mus * dbg(Lv - 14 - integrated(mus)) * dbg(+3.0)
    S = S * dbg(momentary_max(v) - momentary_max(S)) * dbg(-6.0)
    mus = mus * duck(speech_spans(words))[None, :]
    mix = v + mus + S
    mix = mix * dbg(-15.0 - integrated(mix))
    mix = limiter(mix, -1.2)
    mix = mix * dbg(-15.0 - integrated(mix))
    mix = limiter(mix, -1.2)
    write_wav(os.path.join(HERE, "mix.wav"), mix)
    k = dbg(-15.0 - integrated(v + mus + S))
    for nm, x in [("stem_voice", v), ("stem_music", mus), ("stem_sfx", S)]:
        write_wav(os.path.join(HERE, nm + ".wav"), x * k)
    with open(os.path.join(HERE, "cues.md"), "w") as f:
        f.write(f"# Cues (film seconds, frame)\n\nLUFS mix {integrated(mix):.1f}, TP {true_peak(mix):.1f} dBTP, voice {Lv:.1f}\n\n")
        for t, nm in sorted(CUES):
            f.write(f"- {t:7.3f}  f{round(t * 30):4d}  {nm}\n")
    print("mix", integrated(mix), true_peak(mix), mix.shape, N)


if __name__ == "__main__":
    main()
