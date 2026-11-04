import sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("/root/tts/kokoro-v1.0.onnx", "/root/tts/voices-v1.0.bin")
voice = sys.argv[1] if len(sys.argv) > 1 else "bm_george"
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
# (text, pause after in seconds)
L = [
 ("In March, a robot in Silicon Valley was asked to dance.", 0.25),
 ("It destroyed a dinner table.", 0.7),
 ("Cupertino, California.", 0.25),
 ("A hot pot restaurant, proud of its robots.", 0.3),
 ("This one wore an apron, and for birthdays it had a special setting: celebration mode.", 0.55),
 ("A guest asked for it to come a little closer to their table.", 0.25),
 ("So it did.", 0.45),
 ("The music started.", 0.2), ("Arms up.", 0.15), ("Arms out.", 0.2),
 ("Arms, straight down onto the table.", 0.45),
 ("Chopsticks took off.", 0.1), ("Sauces took off.", 0.1), ("Plates took off.", 0.4),
 ("Three waiters grabbed hold of it.", 0.15), ("It kept dancing.", 0.35),
 ("One of them checked her phone, possibly looking for the off switch.", 0.5),
 ("Luckily, the pots of boiling broth stayed put.", 0.3),
 ("Unluckily, the robot kept going for about another minute, sauce on its hand, smile on its face.", 0.6),
 ("Here's the thing. The robot wasn't watching the table.", 0.2),
 ("Its dance was a plan: every move played back at full swing, whatever was in the way.", 0.5),
 ("Like a wind-up toy marching across the kitchen counter.", 0.2),
 ("It doesn't know there's an edge.", 0.2), ("It only knows: left foot, right foot.", 0.55),
 ("The restaurant said the robot was not malfunctioning, or out of control.", 0.25),
 ("It did exactly what it was programmed to do.", 0.2), ("Just in a smaller space than usual.", 0.6),
 ("And that's the thing about a wind-up toy.", 0.3),
 ("It doesn't stop at the edge.", 0.45), ("It stops when the song does.", 1.2),
]
out = [np.zeros(int(0.35 * 24000), np.float32)]
for t, pz in L:
    pz *= 0.62
    a, sr = k.create(t, voice=voice, speed=speed, lang="en-gb" if voice.startswith("b") else "en-us")
    out += [a.astype(np.float32), np.zeros(int(pz * sr), np.float32)]
y = np.concatenate(out)
sf.write(sys.argv[3] if len(sys.argv) > 3 else "voice_raw.wav", y, 24000)
print(len(y) / 24000)
