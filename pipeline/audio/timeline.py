# Picture timeline mirrored (read-only) from studio/src/videos/hotpot/story.ts so every sound lands on the frame.
import math

FPS = 30
TOTAL = 2061
DUR = TOTAL / FPS
fr = lambda f: f / FPS

W = dict(apron=9.96, celebration=12.52, guest=13.9, soItDid=16.6, music=17.66, armsUp=18.98, armsOut=19.88,
         down=21.42, chop=23.06, sauce=24.42, plates=25.3, three=26.48, kept=28.3, phone=29.44, luckily=33.02,
         unluckily=35.44, sauceHand=38.08, smile=39.12, here=40.48, watching=42.0, plan=43.72, every=44.44,
         whatever=46.3, like=47.6, edge1=51.54, left=52.86, right=53.72, restaurant=54.68, programmed=59.66,
         smaller=61.02, andThats=62.82, edge2=65.68, stops=66.62, does=67.34)
BEAT = 60 / 112
HITS = [W["down"] + 0.03, W["chop"], W["sauce"], W["plates"]]
LAST_DROP = W["does"] + 0.62
FLASH = fr(149)
HOOK_OFF = 21.95  # shot 1: tau = t + 21.95

F = lambda s: round(s * FPS)
SHOTS = {  # id: (a, b, place)
    1: (0, 153, "rest"), 2: (153, F(9.2), "street"), 3: (F(9.2), F(13.85), "rest"), 4: (F(13.85), F(17.6), "rest"),
    5: (F(17.6), F(20.83), "rest"), 6: (F(20.83), F(23.0), "rest"), 7: (F(23.0), F(26.43), "rest"), 8: (F(26.43), F(29.4), "rest"),
    9: (F(29.4), F(32.97), "rest"), 10: (F(32.97), F(35.4), "rest"), 11: (F(35.4), F(40.43), "rest"), 12: (F(40.43), F(47.55), "rest"),
    13: (F(47.55), F(54.63), "kitchen"), 14: (F(54.63), F(62.77), "rest"), 15: (F(62.77), F(67.15), "kitchen"), 16: (F(67.15), TOTAL, "rest"),
}


def shot_span(i):
    a, b, _ = SHOTS[i]
    return fr(a), fr(b)


def place_at(t):
    f = t * FPS
    for i, (a, b, p) in SHOTS.items():
        if a <= f < b:
            return p
    return "rest"


# flying items (mirror of ITEMS in story.ts): kind, launch tau, vy
TABLE_H, G = 0.76, 7.0
ITEMS = [("chop", HITS[1], 3.4), ("chop", HITS[1] + .04, 3.9), ("chop", HITS[1] + .06, 3.1), ("chop", HITS[1] + .03, 3.6),
         ("sauce", HITS[2], 3.0), ("sauce", HITS[2] + .05, 3.3), ("sauce", HITS[2] + .03, 3.6),
         ("plate", HITS[3], 3.6), ("plate", HITS[3] + .04, 3.9), ("plate", HITS[3] + .02, 4.2), ("plate", HITS[3] + .06, 3.3)]


def land_tau(kind, at, vy):
    y0 = TABLE_H + (0.012 if kind == "chop" else 0.01)
    return at + (vy + math.sqrt(vy * vy + 2 * G * (y0 - 0.015))) / G


def tau_to_t(tau_events, lo=0.0, hi=DUR):
    """story events (tau) -> film times: shots 3..16 use tau = t; shot 1 shows tau = t + 21.95 for t < 5.1"""
    out = []
    for e in tau_events:
        if 5.1 <= e < hi:
            out.append(e)
        h = e - HOOK_OFF
        if 0 <= h < 5.1:
            out.append(h)
    return out


# wind-up toy (mirror of toyX/toyPhase/toyStopped)
def toy_phase(t):
    if t < 60:
        return (t - W["like"]) * 1.25
    u = min(1, max(0, (t - W["andThats"]) / 3.8))
    return (W["andThats"] + (t - W["andThats"]) * (1.3 - 0.5 * u)) * 1.25


def toy_steps():
    """film times of the toy's footfalls (phase crosses k * 0.5) while a kitchen shot is on screen"""
    out = []
    for i in (13, 15):
        a, b = shot_span(i)
        t, prev = a, None
        while t < b:
            if i == 15 and t >= W["stops"]:
                break
            k = math.floor(toy_phase(t) * 2)
            if prev is not None and k != prev:
                out.append(t)
            prev = k
            t += 1 / 480
    return out
