#!/bin/bash
# final 2K render in resumable chunks (JOBS chunks at a time), each its own browser; concat + mux afterwards.
# usage: scripts/final.sh <Composition> <slug> <totalFrames> [chunks=4] [jobs=2]
cd "$(dirname "$0")/.."
COMP=$1; SLUG=$2; TOTAL=$3; NCH=${4:-4}; JOBS=${5:-2}
C=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
D=out/$SLUG/final; mkdir -p $D
export TEMP=$PWD/out/remotion-tmp TMP=$PWD/out/remotion-tmp; mkdir -p $TEMP
seg() { local R=$1 O=$D/seg_$1.mp4
  [ -f $O.done ] && return
  npx remotion render src/index.ts $COMP $O --frames=$R --scale 1.3333333333333333 --codec h264 --crf 16 \
    --jpeg-quality 95 --browser-executable $C --gl swangle --concurrency 1 --timeout=300000 \
    --props='{"post":{"msaa":0}}' > $D/log_$R.txt 2>&1 && touch $O.done; }
STEP=$(( (TOTAL + NCH - 1) / NCH )); RANGES=()
for ((a=0; a<TOTAL; a+=STEP)); do b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1)); RANGES+=("$a-$b"); done
for R in "${RANGES[@]}"; do
  while [ $(jobs -rp | wc -l) -ge $JOBS ]; do sleep 5; done
  seg $R &
done
wait
printf "%s\n" "${RANGES[@]}" | sed "s#.*#file 'seg_&.mp4'#" > $D/list.txt
echo ALLDONE >> $D/status.txt
