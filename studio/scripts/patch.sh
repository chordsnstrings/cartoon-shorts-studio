#!/bin/bash
cd /home/claude/studio
C=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
mkdir -p out/hotpot/patch
for R in 148-158 858-883 1786-1818; do
  [ -f out/hotpot/patch/$R.done ] && continue
  npx remotion render src/index.ts HotpotShort out/hotpot/patch/$R --sequence --image-format png --frames=$R --scale 1.3333333333333333 \
    --browser-executable $C --gl swangle --concurrency 1 --timeout=300000 --props='{"post":{"msaa":0}}' > out/hotpot/patch/log_$R.txt 2>&1 && touch out/hotpot/patch/$R.done
done
echo ALLDONE >> out/hotpot/patch/status.txt
