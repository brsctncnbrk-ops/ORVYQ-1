import React from 'react';
import {Composition} from 'remotion';
import {ORVYQVideo} from './ORVYQVideo';
import type {RenderInput} from './types';

const fallback: RenderInput = {
  schema_version: '1.0',
  project_id: 'unconfigured',
  plan: {fps: 30, width: 1920, height: 1080, full_frame_count: 300, full_duration_seconds: 10, proof_boundary_frame: 300, audio_mix_asset: 'assets/audio/final_mix.mp3', shots: []},
  evidence: [],
  assets: [],
  captions: [],
  audio_mix_asset: 'assets/audio/final_mix.mp3'
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ORVYQVideo"
    component={ORVYQVideo}
    durationInFrames={fallback.plan.full_frame_count}
    fps={fallback.plan.fps}
    width={fallback.plan.width}
    height={fallback.plan.height}
    defaultProps={fallback}
    calculateMetadata={({props}) => ({
      durationInFrames: props.plan.full_frame_count,
      fps: props.plan.fps,
      width: props.plan.width,
      height: props.plan.height
    })}
  />
);
