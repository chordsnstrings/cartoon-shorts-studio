# ElevenLabs instrumental score at the exact picture length, optionally as a composition plan locked to the beats.
# usage: python3 eleven_music.py plan.json out.wav
#   plan.json: {"length_s": 68.7, "prompt": "playful cartoon ..."}  or
#              {"length_s": 68.7, "sections": [{"name": "hook", "s": 0, "e": 5.1, "style": "bouncy funk, cheeky"}, ...]}
# The result is resampled to 48 kHz stereo and padded/trimmed to length_s exactly (mix.py expects that).
import json, os, subprocess, sys, urllib.request, urllib.error

KEY = os.environ["ELEVENLABS_API_KEY"]


def call(body):
    req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=600).read()


def main():
    plan, out = json.load(open(sys.argv[1])), sys.argv[2]
    L = plan["length_s"]
    if "sections" in plan:
        body = {"model_id": plan.get("model_id", "music_v1"), "force_instrumental": True, "composition_plan": {
            "positive_global_styles": plan.get("global", ["instrumental", "cartoon score"]), "negative_global_styles": ["vocals", "lyrics"],
            "sections": [{"section_name": s["name"], "positive_local_styles": [s["style"]], "negative_local_styles": [],
                          "duration_ms": max(3000, round((s["e"] - s["s"]) * 1000)), "lines": []} for s in plan["sections"]]}}
    else:
        body = {"model_id": plan.get("model_id", "music_v1"), "prompt": plan["prompt"], "music_length_ms": round(L * 1000), "force_instrumental": True}
    try:
        mp3 = call(body)
    except urllib.error.HTTPError as e:
        sys.exit(f"music API {e.code}: {e.read()[:400]}")
    open(out + ".mp3", "wb").write(mp3)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out + ".mp3", "-ar", "48000", "-ac", "2", "-af", f"apad,atrim=0:{L}", out], check=True)
    print("ok", out)


if __name__ == "__main__":
    main()
