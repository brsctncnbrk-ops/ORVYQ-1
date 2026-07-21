import React from 'react';
import {Composition} from 'remotion';
import {ORVYQVideo} from './ORVYQVideo';
import type {RenderInput} from './types';

const fallback: RenderInput = {
  schema_version: '1.0', project_id: 'unset',
  plan: {fps: 30, width: 1920, height: 1080, full_frame_count: 300, full_duration_seconds: 10, proof_boundary_frame: 300, shots: [{id: 'end', start_frame: 0, end_frame: 300, visual_class: 'orvyq_end_card'}]},
  timeline: {source_audio: ''}, assets: [], captions: []
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
    calculateMetadata={({props}: {props: RenderInput}) => ({durationInFrames: props.plan.full_frame_count, fps: props.plan.fps, width: props.plan.width, height: props.plan.height})}
  />
);
