# Re-cut a finished short into a shorter TikTok edit: picture segments from the master + audio rebuilt from stems.
# usage: python3 recut.py spec.json
# spec: {"master": "...mp4", "day": "<day_dir>", "out": "cut.mp4", "fps": 30,
#        "segs": [[src_start_s, src_end_s] or [vid_s, vid_e, aud_s, aud_e (aud_s < 0: silent)], ...],  # end to end; audio = voice+sfx stems
#        "extra_voice": [["file.wav", at_s, from_s, to_s], ...],                      # e.g. an added end question
#        "text": {"lines": ["..", ".."], "until_s": 3.0, "font": "...ttf"}}          # burned-in hook text (frame 1)
# Music: the raw score (audio/music.wav) runs continuously from 0 under the new cut, ducked -3 dB under speech,
# faded out over the last 1.2 s. Loudness -15 LUFS / -1.2 dBTP (same chain as the story mix scripts).
import json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp import SR, ns, st, dbg, integrated, true_peak, read_wav, write_wav
from scipy import ndimage, signal

spec = json.load(open(sys.argv[1])); day = spec["day"]; fps = spec.get("fps", 30)
segs = [s if len(s) == 4 else [s[0], s[1], s[0], s[1]] for s in spec["segs"]]
L = sum(s[1] - s[0] for s in segs); N = ns(L)
ld = lambda p: st(read_wav(p)[0])
V, S, M = ld(f"{day}/audio/stem_voice.wav"), ld(f"{day}/audio/stem_sfx.wav"), ld(f"{day}/audio/music.wav")
out_v, out_s = np.zeros((2, N)), np.zeros((2, N))
t = 0.0; xf = ns(0.02)
for vs, ve, a0, a1 in segs:
    n = ns(ve - vs); i0 = ns(t)
    if a0 < 0: t += ve - vs; continue  # silent segment (picture only)
    for src, dst in ((V, out_v), (S, out_s)):
        x = src[:, ns(a0):ns(a0) + n].copy(); x = np.pad(x, ((0, 0), (0, n - x.shape[1])))
        e = np.ones(n); e[:xf] = np.linspace(0, 1, xf); e[-xf:] = np.linspace(1, 0, xf)
        m = min(n, N - i0); dst[:, i0:i0 + m] += (x * e)[:, :m]
    t += ve - vs
for f, at, a, b in spec.get("extra_voice", []):
    x = st(read_wav(f)[0])[:, ns(a):ns(b)]; i0 = ns(at); m = min(x.shape[1], N - i0)
    # match the extra line to the stem's loudness
    x = x * dbg(integrated(V) - integrated(x)); out_v[:, i0:i0 + m] += x[:, :m]
mus = np.pad(M[:, :N], ((0, 0), (0, max(0, N - M.shape[1]))))
mus = mus * dbg(integrated(out_v) - 14 - integrated(mus)) * dbg(3.0)
g = (np.abs(out_v).max(0) > 0.01).astype(float)
g = ndimage.maximum_filter1d(g, ns(0.3)); k = np.exp(-np.arange(ns(1.2)) / ns(0.4)); k /= k.sum()
g = np.clip(np.convolve(g, k)[:N], 0, 1); mus = mus * dbg(-3.0 * g)[None, :]
fo = ns(1.2); mus[:, -fo:] *= np.linspace(1, 0, fo)[None, :]
mix = out_v + out_s + mus
def limit(x, c=dbg(-1.2)):
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)[: 4 * x.shape[1]]
    pk = np.pad(up, (0, 4 * x.shape[1] - len(up))).reshape(-1, 4).max(1)
    gr = ndimage.minimum_filter1d(np.minimum(1, c / np.maximum(pk, 1e-9)), ns(0.006))
    return x * ndimage.uniform_filter1d(gr, ns(0.006))[None, :]
for _ in range(3): mix = limit(mix * dbg(-15.0 - integrated(mix)))
wav = spec["out"].replace(".mp4", ".wav"); write_wav(wav, mix)
# picture: trim each segment from the master, concat, burn the hook text, mux
tmp = spec["out"][:-4] + "_parts"; os.makedirs(tmp, exist_ok=True); lst = []
for i, (vs, ve, _, _) in enumerate(segs):
    p = f"{tmp}/p{i}.mp4"; lst.append(p)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{vs:.4f}", "-i", spec["master"], "-frames:v", str(round((ve - vs) * fps)), "-an",
                    "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", p], check=True)
open(f"{tmp}/list.txt", "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in lst))
tx = spec.get("text")
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{tmp}/list.txt", "-i", wav]
if tx:
    # hook text card drawn with PIL (ffmpeg 6.1 drawtext takes no size expressions): white bold lines, plum outline, top third
    from PIL import Image, ImageDraw, ImageFont
    w_, h_ = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", spec["master"]],
                                     capture_output=True, text=True).stdout.strip().split(",")[:2])
    im = Image.new("RGBA", (w_, h_), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fs = round(h_ * 0.05); font = ImageFont.truetype(tx["font"], fs)
    for j, line in enumerate(tx["lines"]):
        y = round(h_ * 0.105 + j * fs * 1.22)
        d.text((w_ / 2, y), line, font=font, anchor="mt", fill=(255, 255, 255, 255), stroke_width=round(fs * 0.13), stroke_fill=(36, 23, 38, 255))
    png = f"{tmp}/hook.png"; im.save(png)
    cmd += ["-i", png, "-filter_complex", f"[0:v][2:v]overlay=0:0:enable='lt(t,{tx['until_s']})'[v]", "-map", "[v]", "-map", "1:a:0"]
else:
    cmd += ["-map", "0:v:0", "-map", "1:a:0"]
cmd += ["-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", spec["out"]]
subprocess.run(cmd, check=True)
print("cut", round(L, 2), "s;", round(integrated(mix), 1), "LUFS", round(true_peak(mix), 1), "dBTP")
