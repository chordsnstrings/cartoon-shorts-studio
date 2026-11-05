# The Sky Gave It Away — script (auto-approved)

Slug `skyclue` · category: tech / privacy (OSINT) · composition `SkyclueShort` 1080x1920 30 fps, 2055 f = 68.5 s · voice ElevenLabs George (JBFqnCBsd6RMkjVDRZzb), eleven_v3, SPEED 1.08

## Facts (verified 2026-11-05)
1. YouTuber "Colsto" showed how to geolocate a video from aircraft noise in its audio. — Gizmodo (Tom Hawking) 2026-11-05; IBTimes UK (Seneca Cabrera) 2026-11-03; shared on X 2026-11-02/03
2. Test clip: a low-res security-camera view of trees and a riverbank, filmed 8 September somewhere in the continental US. — Gizmodo; IBTimes
3. Spectrogram showed two aircraft Doppler curves, 920 seconds apart, not noticeable in normal playback. — Gizmodo; IBTimes
4. ~50 GB of ADS-B flight data, 5,000+ lines of code; terrain elevation + sound travel time modelled. — IBTimes
5. ~70,000 candidate points -> ~15,000 after the timing gap and "should have heard another plane" filters -> modelled every curve, one top score. — Gizmodo; IBTimes
6. Verified on Google Street View: tree shapes and a utility pole matched; the camera was found (within a few hundred feet). — Gizmodo; IBTimes
7. Patterns survived high-pass filtering, added noise and telephone-style compression; he says the odds of someone using this on a person are slim. — IBTimes
8. ADS-B aircraft broadcast position/speed/altitude; services like OpenSky make it public. — Gizmodo
Analogy: an ambulance siren dropping in pitch as it passes (Doppler).
Not on screen or in caption: any brand names; no text in the picture.

## Voice-over (lines.json is the performed version)
HOOK: A YouTuber found exactly where a video was filmed... using airplanes nobody could even hear.
SETTING: The clue: a blurry security camera clip. Trees. A riverbank. All he knew: September eighth, somewhere in America.
ACTION: But hidden in the audio were two planes... passing nine hundred and twenty seconds apart. He pulled fifty gigabytes of flight data, and wrote five thousand lines of code. First pass: seventy thousand possible spots. Filter by that gap: fifteen thousand. Then he simulated every plane's sound, from every spot.
SNAP: One spot fit. Street View... same trees. Same pole. There's the camera.
DEADPAN: Luckily, he says the odds of anyone doing this to you are slim. Unluckily, the plane sound survived filters, noise, and phone compression.
EXPLANATION: How? A siren drops in pitch as it passes you. Planes do it too, and how fast it drops tells you how close they flew. And planes broadcast where they are. Publicly. All day.
CONSEQUENCE: So the sky in your video is a clock... and a map.
TWIST: All that... to find a camera that films trees.
