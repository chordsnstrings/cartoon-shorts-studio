import React from "react";
import { Composition } from "remotion";
import { HotpotShort, HOTPOT_FRAMES } from "./videos/hotpot/Short";
import { OrbitShort, ORBIT_FRAMES } from "./videos/orbit/Short";
import { SkyclueShort, SKYCLUE_FRAMES } from "./videos/skyclue/Short";
import { FinnishShort, FINNISH_FRAMES } from "./videos/finnish/Short";
import { FloppyShort, FLOPPY_FRAMES } from "./videos/floppy/Short";
import { TidyShort, TIDY_FRAMES } from "./videos/tidy/Short";
import { ButterShort, BUTTER_FRAMES } from "./videos/butter/Short";
import { DroneShort, DRONE_FRAMES } from "./videos/drone/Short";
import { KeiShort, KEI_FRAMES } from "./videos/kei/Short";
import { CatchShort, CATCH_FRAMES } from "./videos/catch/Short";
import { AwardsShort, AWARDS_FRAMES } from "./videos/awards/Short";
import { OutageShort, OUTAGE_FRAMES } from "./videos/outage/Short";
import { TrolleyShort, TROLLEY_FRAMES } from "./videos/trolley/Short";
import { GlitchShort, GLITCH_FRAMES } from "./videos/glitch/Short";
import { MirrorShort, MIRROR_FRAMES } from "./videos/mirror/Short";
import { RealityShort, REALITY_FRAMES } from "./videos/reality/Short";
import { MercuryShort, MERCURY_FRAMES } from "./videos/mercury/Short";
import { DeliveryShort, DELIVERY_FRAMES } from "./videos/delivery/Short";
import { FiredogShort, FIREDOG_FRAMES } from "./videos/firedog/Short";
import { MillionShort, MILLION_FRAMES } from "./videos/million/Short";
import { MarketShort, MARKET_FRAMES } from "./videos/market/Short";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HotpotShort" component={HotpotShort} durationInFrames={HOTPOT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="OrbitShort" component={OrbitShort} durationInFrames={ORBIT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="SkyclueShort" component={SkyclueShort} durationInFrames={SKYCLUE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FloppyShort" component={FloppyShort} durationInFrames={FLOPPY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="TidyShort" component={TidyShort} durationInFrames={TIDY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ButterShort" component={ButterShort} durationInFrames={BUTTER_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DroneShort" component={DroneShort} durationInFrames={DRONE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="KeiShort" component={KeiShort} durationInFrames={KEI_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="CatchShort" component={CatchShort} durationInFrames={CATCH_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="AwardsShort" component={AwardsShort} durationInFrames={AWARDS_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="OutageShort" component={OutageShort} durationInFrames={OUTAGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="TrolleyShort" component={TrolleyShort} durationInFrames={TROLLEY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="GlitchShort" component={GlitchShort} durationInFrames={GLITCH_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MirrorShort" component={MirrorShort} durationInFrames={MIRROR_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="RealityShort" component={RealityShort} durationInFrames={REALITY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MercuryShort" component={MercuryShort} durationInFrames={MERCURY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DeliveryShort" component={DeliveryShort} durationInFrames={DELIVERY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FiredogShort" component={FiredogShort} durationInFrames={FIREDOG_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MillionShort" component={MillionShort} durationInFrames={MILLION_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MarketShort" component={MarketShort} durationInFrames={MARKET_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FinnishShort" component={FinnishShort} durationInFrames={FINNISH_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
