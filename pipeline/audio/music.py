# Original score for the hot pot robot short, composed and synthesized here (F major, 112 bpm).
# One tune, three dresses: the robot's dance track (kick / clap / hats / synth bass / pluck stabs / glock hook) whose
# beat grid starts on "The music started" (t = 17.66; the hook replays it at tau = t + 21.95), a light pizzicato
# underscore for the setup, and a music-box version for the wind-up toy that slows down and stops on "does".
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, lp, hp, bp, tt, write_wav, st
import instruments as I
import timeline as T

N = ns(T.DUR)
B = T.BEAT
G0 = T.W["music"]  # groove beat 0 (tau)
m2f = I.m2f

# melody: (beat, length in beats, midi), 16-beat loop
MEL = [(0, .5, 77), (.5, .5, 81), (1, .5, 84), (1.5, .5, 81), (2, 1, 79), (3, .5, 77), (3.5, .5, 79),
       (4, .5, 81), (4.5, .5, 79), (5, .5, 77), (5.5, .5, 74), (6, 1.5, 72),
       (8, .5, 77), (8.5, .5, 81), (9, .5, 84), (9.5, .5, 86), (10, 1, 84), (11, .5, 81), (11.5, .5, 82),
       (12, .5, 81), (12.5, .5, 79), (13, .5, 76), (13.5, .5, 79), (14, 2, 77)]
CHORDS = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55, 58]]  # F | Dm | Bb | C7
ROOTS = [41, 38, 34, 36]


def kick(r):
    t = tt(0.32)
    f = 45 + 85 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    y += 0.3 * hp(r.standard_normal(len(t)), 2000) * np.exp(-t / 0.002)
    return fades(y, 0.0005, 0.02)


def clap(r):
    n = ns(0.25)
    y = np.zeros(n)
    for k, d in enumerate([0, 0.009, 0.018, 0.026]):
        i = ns(d)
        m = n - i
        e = np.exp(-np.arange(m) / SR / (0.006 if k < 3 else 0.06))
        y[i:] += bp(r.standard_normal(m), 900, 3200, 2) * e
    return fades(y * 0.6, 0.0003, 0.03)


def hat(r, open_=False):
    t = tt(0.18 if open_ else 0.05)
    return fades(hp(r.standard_normal(len(t)), 7000, 2) * np.exp(-t / (0.05 if open_ else 0.012)) * 0.35, 0.0002, 0.01)


def bass(f, dur, r):
    t = tt(dur + 0.05)
    y = sum(np.sin(2 * np.pi * k * f * t + r.uniform(0, 6.28)) / k for k in range(1, 12))
    y = lp(y, 650) + 0.3 * hp(lp(y, 2400), 650) * np.exp(-t / 0.05)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.35) * (t < dur) + (t >= dur) * np.exp(-(t - dur) / 0.02) * np.exp(-dur / 0.35)
    return y * env * 0.5


def groove(buf, t_from, t_to, tau_shift=0.0, thin=False, r=None):
    """dance track on the tau grid between film times t_from..t_to (tau = t + tau_shift)"""
    r = r or rng(3)
    k0 = int(np.floor((t_from + tau_shift - G0) / B)) - 1
    k1 = int(np.ceil((t_to + tau_shift - G0) / B)) + 1
    tmp = np.zeros((2, N))
    for k in range(max(0, k0), k1):
        tb = G0 + k * B - tau_shift  # film time of beat k
        bar, beat = divmod(k, 4)
        ch = (bar % 4)
        place(tmp, pan(kick(r), 0), tb, 0.9)
        if beat in (1, 3):
            place(tmp, pan(clap(r), 0.05), tb, 0.55 if not thin else 0.3)
        place(tmp, pan(hat(r, beat == 3), 0.35), tb + B / 2, 0.5)
        if not thin:
            place(tmp, pan(hat(r), -0.3), tb + B * 0.75, 0.18)
        # bass: root on the beat, octave on the off-beat
        place(tmp, pan(bass(m2f(ROOTS[ch]), B * 0.45, r), 0), tb, 0.55)
        place(tmp, pan(bass(m2f(ROOTS[ch] + 12), B * 0.3, r), 0), tb + B / 2, 0.4)
        if not thin and beat in (1, 3):
            for j, m in enumerate(CHORDS[ch]):
                place(tmp, pan(I.pluck(m2f(m + 12), 0.5, r, dur=0.35, bright=0.7), -0.4 + 0.25 * j), tb + B / 2, 0.22)
    if not thin:
        for k in range(max(0, k0 // 16 * 16), k1, 16):
            for (b, d, m) in MEL:
                tb = G0 + (k + b) * B - tau_shift
                place(tmp, pan(I.glock(m2f(m), 0.6, r, dur=0.9), 0.15), tb, 0.3)
                place(tmp, pan(I.vibes(m2f(m - 12), 0.45, r, dur=d * B + 0.2), -0.15), tb, 0.18)
    a, b = ns(t_from), ns(t_to)
    env = np.zeros(N); env[a:b] = 1
    fi, fo = ns(0.01), ns(0.02)
    env[a:a + fi] = np.linspace(0, 1, fi); env[b - fo:b] = np.linspace(1, 0, fo)
    buf += tmp * env


def underscore(buf, t_from, t_to, r):
    """pizzicato bass + chord arpeggios and a sparse glock line, same tempo, grid from t_from"""
    k = 0
    while True:
        tb = t_from + k * B
        if tb >= t_to:
            break
        bar, beat = divmod(k, 4)
        ch = bar % 4
        if beat in (0, 2):
            place(buf, pan(I.pluck(m2f(ROOTS[ch] + 12), 0.7, r, dur=0.5, bright=0.35), -0.1), tb, 0.6)
        m = CHORDS[ch][(beat + bar) % len(CHORDS[ch])] + 12
        place(buf, pan(I.pluck(m2f(m), 0.45, r, dur=0.4, bright=0.55), 0.3), tb + B / 2, 0.38)
        if beat == 0 and bar % 2 == 0:
            place(buf, pan(I.brush(0.4, r), 0), tb, 0.3)
        k += 1


def tada(buf, t, r):
    for j, m in enumerate([77, 81, 84, 89]):
        place(buf, pan(I.glock(m2f(m), 0.8, r, dur=1.4), 0.2), t + j * 0.06, 0.45)
    place(buf, pan(I.triangle(0.6, r), 0.3), t + 0.18, 0.4)
    place(buf, st(I.cymbal(0.4, r, dur=1.6)), t + 0.18, 0.2)


def musicbox(buf, t_from, t_to, r, ritard_to=None, end_at=None):
    """the tune on a music box; with ritard_to the tempo falls linearly to that fraction and the last note lands on end_at"""
    notes = []
    for rep in range(6):
        for (b, d, m) in MEL:
            notes.append((rep * 16 + b, d, m))
    if ritard_to is None:
        for (b, d, m) in notes:
            tb = t_from + b * B
            if tb >= t_to:
                break
            place(buf, pan(I.musicbox(m2f(m + 12), 0.6, r, dur=1.4), 0.1), tb, 0.55)
            if b % 2 == 0:
                c = CHORDS[int(b // 4) % 4]
                place(buf, pan(I.musicbox(m2f(c[int(b) % len(c)] + 12), 0.35, r, dur=1.0), -0.2), tb, 0.3)
        return
    # ritardando: beat duration grows from B to B / ritard_to; find how many beats fit so the last one hits end_at
    span = end_at - t_from
    best = None
    for nb in range(4, 40):
        durs = [B / (1 - (1 - ritard_to) * i / nb) for i in range(nb)]
        if best is None or abs(sum(durs) - span) < abs(best[1] - span):
            best = (nb, sum(durs), durs)
    nb, tot, durs = best
    scale = span / tot
    pos = np.concatenate([[0], np.cumsum(durs)]) * scale
    for (b, d, m) in notes:
        if b > nb:
            break
        i = int(b); fr_ = b - i
        tb = t_from + pos[min(i, nb)] + fr_ * (durs[min(i, nb - 1)] * scale)
        last = b >= nb or b == notes[-1][0]
        place(buf, pan(I.musicbox(m2f(m + 12), 0.6, r, dur=1.6), 0.1), tb, 0.55)
    # the last note: tonic, exactly on end_at
    place(buf, pan(I.musicbox(m2f(77 + 12), 0.7, r, dur=2.2), 0.1), end_at, 0.6)
    place(buf, pan(I.musicbox(m2f(65 + 12), 0.5, r, dur=2.2), -0.1), end_at, 0.4)


def render():
    r = rng(11)
    G = np.zeros((2, N)); U = np.zeros((2, N)); M = np.zeros((2, N))
    W = T.W
    # hook: the dance track as it will sound during the chaos (tau = t + 21.95), cut by the flash
    groove(G, 0.0, T.FLASH + 0.02, tau_shift=T.HOOK_OFF, r=r)
    # setup underscore from the street to "The music started"
    underscore(U, T.FLASH + 0.12, W["music"] - 0.05, r)
    U *= 1.8
    tada(U, W["celebration"] - 0.03, r)
    # the dance: from "The music started" to the kitchen; thinner under the explanation
    a12, b12 = T.shot_span(12)
    groove(G, W["music"], a12, r=r)
    groove(G, a12, b12 - 0.13, thin=True, r=r)
    a13, b13 = T.shot_span(13)
    musicbox(M, a13 - 0.13, b13 - 0.13, r)
    a14, b14 = T.shot_span(14)
    groove(G, a14 - 0.13, b14 - 0.13, r=r)
    a15, _ = T.shot_span(15)
    musicbox(M, a15 - 0.13, W["does"], r, ritard_to=0.45, end_at=W["does"])
    ir = make_ir(0.9, 5, hf=0.7)
    U = U + 0.18 * convolve_st(U, ir)[:, :N]
    M = M + 0.3 * convolve_st(M, ir)[:, :N]
    G = G + 0.08 * convolve_st(G, ir)[:, :N]
    return G, U, M


if __name__ == "__main__":
    G, U, M = render()
    mix = G + U + M
    write_wav("music_raw.wav", mix / max(1e-9, np.abs(mix).max()) * 0.8)
    print("ok", mix.shape)
