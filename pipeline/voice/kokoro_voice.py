# Free local fallback narration (Kokoro ONNX) when ElevenLabs is out of quota.
# usage: python3 kokoro_voice.py lines.json out_dir [voice] [speed]
#   lines.json as for eleven_voice.py; [tags] are stripped (Kokoro has no emotion tags); per-line "speed" overrides.
# writes out_dir/voice.wav (48 kHz mono, 0.35 s lead-in); word timings: run align.py voice.wav words.json afterwards.
# model files: /root/tts/kokoro-v1.0.onnx + voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx releases model-files-v1.0)
import json, os, re, subprocess, sys
import numpy as np
from kokoro_onnx import Kokoro
from scipy.signal import resample_poly
lines, out = json.load(open(sys.argv[1])), sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else "bm_george"
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.1
k = Kokoro("/root/tts/kokoro-v1.0.onnx", "/root/tts/voices-v1.0.bin")
os.makedirs(out, exist_ok=True)
parts = [np.zeros(int(0.35 * 24000), np.float32)]
for ln in lines:
    text = re.sub(r"\[[^\]]*\]\s*", "", ln["text"]).strip()
    y, sr = k.create(text, voice=voice, speed=ln.get("speed", speed), lang="en-gb" if voice.startswith("b") else "en-us")
    nz = np.flatnonzero(np.abs(y) > 0.01)
    y = y[max(0, nz[0] - 480):nz[-1] + 1920]
    parts += [y.astype(np.float32), np.zeros(int(ln.get("pause", 0.25) * 24000), np.float32)]
y = resample_poly(np.concatenate(parts), 2, 1)
y = y / max(1e-6, np.abs(y).max()) * 0.89
raw = (np.clip(y, -1, 1) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "48000", "-ac", "1", "-i", "-", f"{out}/voice.wav"], input=raw, check=True)
print(f"{len(y) / 48000:.2f} s")
