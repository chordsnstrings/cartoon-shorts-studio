import React from "react";
import { Composition } from "remotion";
import { HotpotShort, HOTPOT_FRAMES } from "./videos/hotpot/Short";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HotpotShort" component={HotpotShort} durationInFrames={HOTPOT_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
