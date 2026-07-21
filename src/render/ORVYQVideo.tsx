import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {ShotScene} from './components';
import type {Asset, RenderInput} from './types';

const resolveAsset = (projectId: string, asset: Asset): Asset => ({
  ...asset,
  relative_path: asset.relative_path.startsWith('assets/')
    ? `projects/${projectId}/${asset.relative_path}`
    : asset.relative_path
});

export const ORVYQVideo: React.FC<RenderInput> = (input) => {
  const frame = useCurrentFrame();
  const assets = input.assets.map((asset) => resolveAsset(input.project_id, asset));
  const narration = assets.find((asset) => asset.role === 'full_narration');
  const music = assets.find((asset) => asset.role === 'music_bed');
  const activeCaption = input.captions.find((caption) => frame >= caption.start_frame && frame < caption.end_frame);
  return (
    <AbsoluteFill style={{backgroundColor: '#03070b'}}>
      {input.plan.shots.map((shot) => {
        const resolvedShot = shot.physical_asset?.startsWith('assets/')
          ? {...shot, physical_asset: `projects/${input.project_id}/${shot.physical_asset}`}
          : shot;
        return (
          <Sequence key={shot.id} from={shot.start_frame} durationInFrames={shot.end_frame - shot.start_frame} premountFor={30}>
            <ShotScene shot={resolvedShot} assets={assets}/>
          </Sequence>
        );
      })}
      {narration ? <Audio src={staticFile(narration.relative_path)} volume={1}/> : null}
      {music ? <Audio src={staticFile(music.relative_path)} volume={(f) => {
        const cue = input.plan.music_cues?.find((item) => f >= item.start_frame && f < item.end_frame);
        return cue?.volume ?? 0.12;
      }}/> : null}
      {activeCaption ? <div style={{position: 'absolute', left: 150, right: 150, bottom: 74, textAlign: 'center', color: '#f4f5f5', fontFamily: 'Arial, sans-serif', fontSize: 37, lineHeight: 1.18, fontWeight: 600, textShadow: '0 2px 12px rgba(0,0,0,.95)'}}>{activeCaption.text}</div> : null}
    </AbsoluteFill>
  );
};
