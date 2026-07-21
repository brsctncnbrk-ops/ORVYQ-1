import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Asset, Evidence, GraphicItem, Shot} from './types';

const palette = {
  ground: '#05070C',
  panel: '#101A27',
  ink: '#F5F0E7',
  muted: '#B9C0C9',
  blue: '#86A9CC',
  accent: '#D95B53'
};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const projectPath = (projectId: string, relativePath: string) => staticFile(`projects/${projectId}/${relativePath}`);

const SourceBar: React.FC<{shot: Shot}> = ({shot}) => (
  <div style={{position: 'absolute', left: 70, right: 70, bottom: 28, display: 'flex', justifyContent: 'space-between', gap: 24, color: palette.muted, fontFamily: 'Arial, sans-serif', fontSize: shot.typography?.source_px ?? 17, letterSpacing: '.08em', textTransform: 'uppercase'}}>
    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{shot.source_label ?? 'ORVYQ · CONTEXTUAL'}</span>
    <span style={{whiteSpace: 'nowrap'}}>{shot.limitation ?? shot.editorial_purpose}</span>
  </div>
);

const Header: React.FC<{shot: Shot}> = ({shot}) => (
  <div style={{position: 'absolute', left: 70, right: 70, top: 52, zIndex: 5, fontFamily: 'Arial, sans-serif'}}>
    {shot.eyebrow ? <div style={{color: palette.blue, fontSize: 18, fontWeight: 850, letterSpacing: '.16em', textTransform: 'uppercase'}}>{shot.eyebrow}</div> : null}
    {shot.title ? <div style={{color: palette.ink, fontSize: shot.typography?.title_px ?? 50, lineHeight: 1.04, fontWeight: 830, letterSpacing: '-.028em', marginTop: 10, maxWidth: 1600}}>{shot.title}</div> : null}
    {shot.subtitle ? <div style={{color: palette.muted, fontSize: shot.typography?.subtitle_px ?? 25, lineHeight: 1.28, fontWeight: 560, marginTop: 14, maxWidth: 1450}}>{shot.subtitle}</div> : null}
  </div>
);

const fadeFor = (shot: Shot, frame: number, duration: number) => {
  const fade = Math.min(12, Math.max(1, Math.floor(duration / 5)));
  let opacity = 1;
  if (['short_dissolve', 'motivated_fade'].includes(shot.transition_in ?? 'cut')) opacity *= interpolate(frame, [0, fade], [0, 1], clamp);
  if (['short_dissolve', 'motivated_fade'].includes(shot.transition_out ?? 'cut')) opacity *= interpolate(frame, [Math.max(0, duration - fade), duration], [1, 0], clamp);
  return opacity;
};

function footageTransform(motion: Shot['motion'], progress: number) {
  switch (motion) {
    case 'push': return `scale(${interpolate(progress, [0, 1], [1.025, 1.085], clamp)})`;
    case 'pull': return `scale(${interpolate(progress, [0, 1], [1.085, 1.025], clamp)})`;
    case 'drift_left': return `scale(1.07) translateX(${interpolate(progress, [0, 1], [1.8, -1.8], clamp)}%)`;
    case 'drift_right': return `scale(1.07) translateX(${interpolate(progress, [0, 1], [-1.8, 1.8], clamp)}%)`;
    case 'slow_pan': return `scale(1.065) translateY(${interpolate(progress, [0, 1], [1.2, -1.2], clamp)}%)`;
    case 'focus_reframe': return `scale(${interpolate(progress, [0, 1], [1.04, 1.1], clamp)}) translateX(${interpolate(progress, [0, 1], [0.8, -0.8], clamp)}%)`;
    default: return 'scale(1.035)';
  }
}

export const FootageScene: React.FC<{projectId: string; shot: Shot; assets: Asset[]}> = ({projectId, shot, assets}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = shot.end_frame - shot.start_frame;
  const progress = interpolate(frame, [0, Math.max(1, duration - 1)], [0, 1], clamp);
  const opacity = fadeFor(shot, frame, duration);
  const asset = assets.find((item) => shot.asset_ids?.includes(item.asset_id));
  if (!asset) return <AbsoluteFill style={{backgroundColor: palette.ground}}><Header shot={shot}/><SourceBar shot={shot}/></AbsoluteFill>;
  return (
    <AbsoluteFill style={{backgroundColor: palette.ground, overflow: 'hidden', opacity}}>
      <OffthreadVideo
        src={projectPath(projectId, asset.relative_path)}
        muted
        startFrom={Math.round((shot.trim_in_seconds ?? 0) * fps)}
        endAt={shot.trim_out_seconds != null ? Math.round(shot.trim_out_seconds * fps) : undefined}
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: footageTransform(shot.motion ?? 'hold', progress), filter: 'contrast(1.055) saturate(.90) brightness(.94)'}}
      />
      <AbsoluteFill style={{pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(3,7,12,.36) 0%,rgba(3,7,12,.04) 58%,rgba(3,7,12,.18) 100%)'}}/>
      {(shot.title || shot.subtitle || shot.eyebrow) ? <Header shot={shot}/> : null}
      <SourceBar shot={shot}/>
    </AbsoluteFill>
  );
};

const EvidenceFrame: React.FC<{projectId: string; evidence: Evidence; progress: number; contain?: boolean}> = ({projectId, evidence, progress, contain = true}) => (
  <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 10, background: '#EEECE6', border: '1px solid rgba(245,240,231,.18)', boxShadow: '0 24px 75px rgba(0,0,0,.45)'}}>
    <Img src={projectPath(projectId, evidence.relative_path)} style={{width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover', objectPosition: 'center', transform: `scale(${interpolate(progress, [0, 1], [1.005, 1.045], clamp)})`, filter: 'contrast(1.025) saturate(.96)'}}/>
  </div>
);

const Callout: React.FC<{text?: string}> = ({text}) => text ? (
  <div style={{background: 'linear-gradient(145deg,rgba(15,25,38,.97),rgba(7,13,22,.95))', border: '1px solid rgba(245,240,231,.18)', borderLeft: `5px solid ${palette.blue}`, color: palette.ink, padding: '28px 30px', fontFamily: 'Arial, sans-serif', fontSize: 28, lineHeight: 1.24, fontWeight: 690, boxShadow: '0 24px 70px rgba(0,0,0,.42)'}}>{text}</div>
) : null;

export const PrimaryEvidenceScene: React.FC<{projectId: string; shot: Shot; evidence: Evidence[]}> = ({projectId, shot, evidence}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = shot.end_frame - shot.start_frame;
  const reveal = spring({frame, fps, config: {damping: 24, stiffness: 95, mass: .9}, durationInFrames: Math.min(36, duration)});
  const progress = interpolate(frame, [0, Math.max(1, duration - 1)], [0, 1], clamp);
  const selected = (shot.evidence_ids ?? []).map((id) => evidence.find((item) => item.evidence_id === id)).filter(Boolean) as Evidence[];
  const split = shot.shot_type === 'split_documents' || shot.shot_type === 'image_sequence';
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 25% 10%,#18283A 0%,#08101A 56%,#05070C 100%)', color: palette.ink, opacity: fadeFor(shot, frame, duration)}}>
      <Header shot={shot}/>
      <div style={{position: 'absolute', left: 70, right: 70, top: 190, bottom: shot.limitation ? 190 : 115, display: 'grid', gridTemplateColumns: split ? `repeat(${Math.min(2, Math.max(1, selected.length))},1fr)` : shot.callout ? '1.55fr .7fr' : '1fr', gap: 24, opacity: reveal, transform: `translateY(${(1 - reveal) * 18}px)`}}>
        {selected.slice(0, split ? 4 : 1).map((item) => <EvidenceFrame key={item.evidence_id} projectId={projectId} evidence={item} progress={progress} contain={shot.shot_type !== 'official_screen'}/>) }
        {!split && shot.callout ? <Callout text={shot.callout}/> : null}
      </div>
      {shot.limitation ? <div style={{position: 'absolute', left: 70, right: 70, bottom: 76, borderLeft: `4px solid ${palette.accent}`, background: 'rgba(217,91,83,.14)', color: palette.ink, padding: '11px 15px', fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 720}}>{shot.limitation}</div> : null}
      <SourceBar shot={shot}/>
    </AbsoluteFill>
  );
};

const Panel: React.FC<{children: React.ReactNode; accent?: string}> = ({children, accent = palette.blue}) => (
  <div style={{position: 'relative', minHeight: 190, padding: '28px 26px', background: 'linear-gradient(145deg,rgba(15,25,38,.96),rgba(7,13,22,.94))', border: '1px solid rgba(245,240,231,.18)', boxShadow: '0 24px 70px rgba(0,0,0,.35)'}}>
    <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent}}/>{children}
  </div>
);

export const GraphicScene: React.FC<{shot: Shot}> = ({shot}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = shot.end_frame - shot.start_frame;
  const reveal = spring({frame, fps, config: {damping: 23, stiffness: 100, mass: .9}, durationInFrames: Math.min(34, duration)});
  const items = shot.items ?? [];
  const steps = shot.steps ?? [];
  const comparison = ['comparison_graphic', 'limitation_treatment'].includes(shot.shot_type);
  const cards: GraphicItem[] = items.length ? items : steps.map((step, index) => ({label: String(index + 1).padStart(2, '0'), value: step, detail: ''}));
  return (
    <AbsoluteFill style={{background: 'linear-gradient(135deg,#101A27 0%,#0C1320 48%,#151C23 100%)', color: palette.ink, opacity: fadeFor(shot, frame, duration)}}>
      <Header shot={shot}/>
      <div style={{position: 'absolute', left: 85, right: 85, top: 235, bottom: 115, display: 'grid', gridTemplateColumns: comparison ? '1fr 1fr' : `repeat(${Math.max(1, Math.min(4, cards.length || 1))},1fr)`, gap: 18, alignItems: 'stretch', opacity: reveal, transform: `translateY(${(1 - reveal) * 18}px)`}}>
        {comparison ? [
          {label: 'SUPPORTS', value: shot.left ?? 'What the source supports', detail: shot.left_detail ?? '', accent: palette.blue},
          {label: 'DOES NOT ESTABLISH', value: shot.right ?? 'What the source does not prove', detail: shot.right_detail ?? '', accent: palette.accent}
        ].map((item) => <Panel key={item.label} accent={item.accent}><div style={{color: item.accent, fontFamily: 'Arial', fontSize: 17, letterSpacing: '.13em', fontWeight: 900}}>{item.label}</div><div style={{fontFamily: 'Arial', fontSize: 34, lineHeight: 1.08, fontWeight: 820, marginTop: 18}}>{item.value}</div><div style={{color: palette.muted, fontFamily: 'Arial', fontSize: 24, lineHeight: 1.28, marginTop: 18}}>{item.detail}</div></Panel>) :
          cards.map((item, index) => <Panel key={`${item.label}-${index}`} accent={index === cards.length - 1 ? palette.accent : palette.blue}><div style={{color: index === cards.length - 1 ? palette.accent : palette.blue, fontFamily: 'Arial', fontSize: 17, letterSpacing: '.13em', fontWeight: 900}}>{item.label}</div><div style={{fontFamily: 'Arial', fontSize: 29, lineHeight: 1.12, fontWeight: 780, marginTop: 17}}>{item.value}</div>{item.detail ? <div style={{color: palette.muted, fontFamily: 'Arial', fontSize: 21, lineHeight: 1.22, marginTop: 14}}>{item.detail}</div> : null}</Panel>)}
      </div>
      <SourceBar shot={shot}/>
    </AbsoluteFill>
  );
};

export const EditorialPauseScene: React.FC<{shot: Shot}> = ({shot}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = shot.end_frame - shot.start_frame;
  const reveal = spring({frame, fps, config: {damping: 20, stiffness: 105, mass: .9}, durationInFrames: Math.min(30, duration)});
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%,#23384D 0%,#0B121D 48%,#05070C 100%)', color: palette.ink, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '7%', opacity: fadeFor(shot, frame, duration)}}>
      <div style={{opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)`}}>
        <div style={{color: palette.blue, letterSpacing: '.28em', fontFamily: 'Arial', fontSize: 20, fontWeight: 780}}>{shot.eyebrow ?? 'THE TURN'}</div>
        <div style={{fontFamily: 'Arial', fontSize: 82, lineHeight: 1.02, fontWeight: 820, letterSpacing: '-.04em', marginTop: 24}}>{shot.title}</div>
        {shot.subtitle ? <div style={{color: palette.muted, fontFamily: 'Arial', fontSize: 28, lineHeight: 1.35, marginTop: 24}}>{shot.subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const BrandScene: React.FC<{shot: Shot}> = ({shot}) => (
  <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 42%,#263C53 0%,#0B121D 44%,#05070C 100%)', color: palette.ink, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '7%'}}>
    <div style={{color: palette.blue, letterSpacing: '.3em', fontFamily: 'Arial', fontSize: 20, marginBottom: 28}}>{shot.eyebrow ?? 'ORVYQ'}</div>
    <div style={{fontFamily: 'Arial', fontSize: 88, lineHeight: 1, fontWeight: 790, letterSpacing: '-.04em'}}>{shot.title ?? 'BEYOND THE KNOWN'}</div>
    {shot.subtitle ? <div style={{color: palette.muted, fontFamily: 'Arial', fontSize: 29, lineHeight: 1.35, marginTop: 28, maxWidth: 1100}}>{shot.subtitle}</div> : null}
  </AbsoluteFill>
);

export const ShotScene: React.FC<{projectId: string; shot: Shot; assets: Asset[]; evidence: Evidence[]}> = ({projectId, shot, assets, evidence}) => {
  if (['cinematic_hook', 'contextual_footage'].includes(shot.shot_type)) return <FootageScene projectId={projectId} shot={shot} assets={assets}/>;
  if (['primary_document', 'split_documents', 'official_figure', 'official_screen', 'official_article', 'image_sequence'].includes(shot.shot_type)) return <PrimaryEvidenceScene projectId={projectId} shot={shot} evidence={evidence}/>;
  if (shot.shot_type === 'editorial_pause') return <EditorialPauseScene shot={shot}/>;
  if (['brand_open', 'brand_close'].includes(shot.shot_type)) return <BrandScene shot={shot}/>;
  return <GraphicScene shot={shot}/>;
};
