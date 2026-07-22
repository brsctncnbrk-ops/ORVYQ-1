import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {ShotScene} from './components';
import type {RenderInput} from './types';

const CaptionLayer: React.FC<{input: RenderInput}> = ({input}) => {
  const frame = useCurrentFrame();
  const activeShot = input.plan.shots.find((shot) => frame >= shot.start_frame && frame < shot.end_frame);
  if (activeShot?.captions_suppressed) return null;
  const caption = input.captions.find((item) => frame >= item.start_frame && frame < item.end_frame);
  if (!caption) return null;
  return (
    <div style={{position: 'absolute', left: 150, right: 150, bottom: 72, textAlign: 'center', color: '#F5F0E7', fontFamily: 'Arial, sans-serif', fontSize: 36, lineHeight: 1.18, fontWeight: 650, textShadow: '0 2px 13px rgba(0,0,0,.95)', padding: '8px 14px'}}>{caption.text}</div>
  );
};

export const ORVYQVideo: React.FC<RenderInput> = (input) => (
  <AbsoluteFill style={{backgroundColor: '#05070C'}}>
    <Audio src={staticFile(`projects/${input.project_id}/${input.audio_mix_asset}`)} volume={1}/>
    {input.plan.shots.map((shot) => (
      <Sequence key={shot.shot_id} from={shot.start_frame} durationInFrames={shot.end_frame - shot.start_frame} premountFor={30}>
        <ShotScene projectId={input.project_id} shot={shot} assets={input.assets} evidence={input.evidence}/>
      </Sequence>
    ))}
    <CaptionLayer input={input}/>
  </AbsoluteFill>
);
