import json, sys
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
import subprocess, numpy as np
raw = subprocess.run(["ffmpeg","-v","error","-i",sys.argv[1],"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
aud = np.frombuffer(raw, np.float32)
segs, _ = m.transcribe(aud, word_timestamps=True, beam_size=5, language="en")
W = []
txt = []
for s in segs:
    txt.append(s.text)
    for w in s.words: W.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
json.dump(W, open(sys.argv[2], "w"), indent=0)
print(" ".join(txt)); print(len(W), "words")
