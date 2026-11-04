# ElevenLabs narration with emotion (eleven_v3 audio tags) + exact word timings, in one call per line.
# usage: python3 eleven_voice.py lines.json voice_id out_dir
#   lines.json: [{"text": "[deadpan] In March, a robot ...", "pause": 0.3}, ...]  (tags in [] are performance cues, not spoken)
# writes out_dir/voice.wav (48 kHz mono) and out_dir/words.json [{"w","s","e"}] on the film clock (0.35 s lead-in).
# env: SPEED (voice_settings.speed, default 1.0), MAX_GAP (s; silences inside a line longer than this are shortened
#      to it, word timings shifted to match: eleven_v3 sometimes leaves 1 s+ holes mid-sentence; default 0.32)
import base64, json, os, re, subprocess, sys, urllib.request
import numpy as np

KEY = os.environ["ELEVENLABS_API_KEY"]
LEAD = 0.35
SR = 48000


def tts(text, voice):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=pcm_48000",
        data=json.dumps({"text": text, "model_id": "eleven_v3", "voice_settings": {"stability": 0.5, "speed": float(os.environ.get("SPEED", "1.0"))}}).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=300))
    pcm = np.frombuffer(base64.b64decode(r["audio_base64"]), "<i2").astype(np.float32) / 32768
    al = r.get("normalized_alignment") or r["alignment"]
    return pcm, al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]


def words_from(chars, s, e, t0):
    out, cur, cs = [], "", None
    inside = False
    for c, a, b in zip(chars, s, e):
        if c == "[": inside = True; continue
        if c == "]": inside = False; continue
        if inside: continue
        if c.isspace():
            if cur.strip(): out.append({"w": cur, "s": round(t0 + cs, 3), "e": round(t0 + pe, 3)})
            cur, cs = "", None
            continue
        if cs is None: cs = a
        cur += c; pe = b
    if cur.strip(): out.append({"w": cur, "s": round(t0 + cs, 3), "e": round(t0 + pe, 3)})
    return out


def squeeze(seg, ws, t0, max_gap):
    """shorten silent holes (>max_gap) inside one line; ws = this line's words (times on the film clock, start t0)"""
    env = np.convolve(np.abs(seg), np.ones(480) / 480, "same") > 0.006
    keep, cut, i, n = np.ones(len(seg), bool), [], 0, len(seg)
    while i < n:
        if not env[i]:
            j = i
            while j < n and not env[j]: j += 1
            if i > 0 and j < n and (j - i) / SR > max_gap:
                a = i + int(max_gap * SR / 2); b = j - int(max_gap * SR / 2)
                keep[a:b] = False; cut.append((t0 + a / SR, (b - a) / SR))
            i = j
        else: i += 1
    def shift(t): return t - sum(d for c, d in cut if c < t)
    for w in ws: w["s"], w["e"] = round(shift(w["s"]), 3), round(shift(w["e"]), 3)
    return seg[keep]


def main():
    lines, voice, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    audio, words, t = [np.zeros(int(LEAD * SR), np.float32)], [], LEAD
    for ln in lines:
        pcm, ch, s, e = tts(ln["text"], voice)
        # trim leading/trailing near-silence the model adds, keep timings consistent
        a = np.abs(pcm); nz = np.flatnonzero(a > 0.01)
        i0 = max(0, nz[0] - int(0.02 * SR)) if len(nz) else 0
        i1 = min(len(pcm), nz[-1] + int(0.08 * SR)) if len(nz) else len(pcm)
        seg = pcm[i0:i1]
        ws = words_from(ch, s, e, t - i0 / SR)
        seg = squeeze(seg, ws, t, float(os.environ.get("MAX_GAP", "0.32")))
        words += ws
        audio += [seg, np.zeros(int(ln.get("pause", 0.25) * SR), np.float32)]
        t += len(seg) / SR + ln.get("pause", 0.25)
    y = np.concatenate(audio)
    raw = (np.clip(y, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", f"{out}/voice.wav"], input=raw, check=True)
    json.dump(words, open(f"{out}/words.json", "w"), indent=0)
    print(f"{len(y) / SR:.2f} s, {len(words)} words")


if __name__ == "__main__":
    main()
