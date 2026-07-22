import React from "react";
import { Composition } from "remotion";
import { FactForgeVideo } from "./Video";
import sceneConfig from "./data/scene_config.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FactForgeVideo"
      component={FactForgeVideo}
      durationInFrames={sceneConfig.duration_frames}
      fps={sceneConfig.fps}
      width={sceneConfig.width}
      height={sceneConfig.height}
    />
  );
};
