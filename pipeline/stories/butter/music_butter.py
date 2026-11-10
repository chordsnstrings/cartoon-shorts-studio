# Synthesized fallback score for the butter short (ElevenLabs music out of quota). C major, 120 bpm, sections on the beats.
# usage: python3 music_butter.py <day_dir>  -> audio/music.wav (48 kHz stereo, exact length)
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "audio"))
from dsp import SR, ns, rng, pan, place, write_wav, st, make_ir, convolve_st, lp
import instruments as I
m2f = I.m2f
DAY = sys.argv[1]; DUR = 31.0; N = ns(DUR); B = 0.5
r = rng(11)
buf = np.zeros((2, N))
CH = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62, 65]]  # C Am F G7
RT = [36, 33, 29, 31]
MEL = [72, 76, 79, 76, 74, 72, 74, 76, 77, 76, 74, 71, 72, 67, 72, 0]

def pizz(t0, t1, k0=0, vel=0.6, mel=False, brush=True):
    k = 0
    while t0 + k * B < t1 - 1e-6:
        tb = t0 + k * B; bar, beat = divmod(k + k0, 4); c = bar % 4
        if beat in (0, 2): place(buf, pan(I.pluck(m2f(RT[c] + 12), vel, r, dur=0.5, bright=0.35), -0.15), tb, 0.6)
        m = CH[c][(beat + bar) % len(CH[c])] + 12
        place(buf, pan(I.pluck(m2f(m), vel * 0.75, r, dur=0.35, bright=0.55), 0.3), tb + B / 2, 0.4)
        if mel and MEL[(k + k0) % 16]: place(buf, pan(I.glock(m2f(MEL[(k + k0) % 16]), 0.55, r, dur=0.9), 0.15), tb, 0.3)
        if brush and beat in (1, 3): place(buf, pan(I.brush(0.35, r), 0), tb, 0.25)
        k += 1

def tada(t, up=True):
    for j, m in enumerate([72, 76, 79, 84] if up else [79, 76, 72]):
        place(buf, pan(I.glock(m2f(m), 0.8, r, dur=1.3), 0.2), t + j * 0.06, 0.4)
    place(buf, pan(I.triangle(0.5, r), 0.3), t + 0.18, 0.3)

# hook 0-3.0: bouncy groove, brass stab on "butter" (2.3)
pizz(0.0, 3.0, mel=True, vel=0.7)
place(buf, pan(I.brass(m2f(48), 0.35, 0.8, r, kind="tuba"), 0), 2.28, 0.55)
place(buf, pan(I.brass(m2f(55), 0.35, 0.7, r, kind="tuba"), 0), 2.28, 0.4)
# setup 3.0-9.1: tiptoe pizzicato
pizz(3.0, 9.1, vel=0.5, brush=False)
# sizzles 9.1-11.0: three rising plucks
for i, t in enumerate([9.3, 9.74, 10.34]):
    place(buf, pan(I.pluck(m2f(67 + 4 * i), 0.8, r, dur=0.5, bright=0.7), 0.2 * (i - 1)), t, 0.5)
# surprise 11.0-14.4: hush, low pad, sparkle on "soften"
place(buf, st(I.pad([m2f(48), m2f(55), m2f(64)], 3.2, 0.4, r, att=0.4, rel=0.6)), 11.1, 0.35)
tada(13.5)
# proud 14.4-19.9: bright march with melody
pizz(14.4, 19.9, mel=True, vel=0.65)
for t in (16.58, 18.5): place(buf, pan(I.brass(m2f(60), 0.3, 0.7, r, kind="tuba"), 0), t, 0.35)
# deadpan 19.9-25.0: sparse plunks + tick
for k in range(10):
    t = 19.95 + k * B
    if k % 2 == 0: place(buf, pan(I.pluck(m2f(RT[(k // 4) % 4] + 12), 0.5, r, dur=0.6, bright=0.3), -0.1), t, 0.45)
    place(buf, pan(I.pluck(m2f(96), 0.25, r, dur=0.05, bright=0.9), 0.4), t + 0.25, 0.15)
place(buf, pan(I.brass(m2f(43), 0.6, 0.6, r, kind="tuba", fall=-3), 0), 24.4, 0.45)  # "lazy" droop
# outro 25.0-31.0: upbeat groove + button
pizz(25.0, 30.4, mel=True, vel=0.7)
tada(30.4)
wet = convolve_st(buf, make_ir(0.9, 5))
y = buf + 0.18 * wet
y = y / np.abs(y).max() * 0.7
f = np.ones(N); f[-ns(0.4):] = np.linspace(1, 0, ns(0.4)); y *= f
os.makedirs(f"{DAY}/audio", exist_ok=True)
write_wav(f"{DAY}/audio/music.wav", y)
print("ok", y.shape[1] / SR)
