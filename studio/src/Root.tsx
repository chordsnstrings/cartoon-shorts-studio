import React from "react";
import { Composition } from "remotion";
import { HotpotShort, HOTPOT_FRAMES } from "./videos/hotpot/Short";
import { OrbitShort, ORBIT_FRAMES } from "./videos/orbit/Short";
import { SkyclueShort, SKYCLUE_FRAMES } from "./videos/skyclue/Short";
import { FinnishShort, FINNISH_FRAMES } from "./videos/finnish/Short";
import { FloppyShort, FLOPPY_FRAMES } from "./videos/floppy/Short";
import { TidyShort, TIDY_FRAMES } from "./videos/tidy/Short";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HotpotShort" component={HotpotShort} durationInFrames={HOTPOT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="OrbitShort" component={OrbitShort} durationInFrames={ORBIT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="SkyclueShort" component={SkyclueShort} durationInFrames={SKYCLUE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FloppyShort" component={FloppyShort} durationInFrames={FLOPPY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="TidyShort" component={TidyShort} durationInFrames={TIDY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FinnishShort" component={FinnishShort} durationInFrames={FINNISH_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
