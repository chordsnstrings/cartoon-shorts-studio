#!/bin/bash
# final 2K render in 4 resumable chunks, then concat + mux
cd /home/claude/studio
C=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
mkdir -p out/hotpot/final
for R in 0-514 515-1029 1030-1544 1545-2060; do
  O=out/hotpot/final/seg_$R.mp4
  [ -f $O.done ] && continue
  npx remotion render src/index.ts HotpotShort $O --frames=$R --scale 1.3333333333333333 --codec h264 --crf 16 \
    --jpeg-quality 95 --browser-executable $C --gl swangle --concurrency 1 --timeout=300000 \
    --props='{"post":{"msaa":0}}' > out/hotpot/final/log_$R.txt 2>&1 && touch $O.done
done
echo ALLDONE >> out/hotpot/final/status.txt
