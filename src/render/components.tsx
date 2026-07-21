import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Asset, Shot} from './types';

const palette = {ink: '#071019', paper: '#edf1f2', muted: '#aab5bc', accent: '#d94d54', panel: '#101c27'};

const footer: React.CSSProperties = {position: 'absolute', left: 58, right: 58, bottom: 28, display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', fontSize: 18, letterSpacing: 1.1, color: palette.muted, textTransform: 'uppercase'};

export const SourceFooter: React.FC<{shot: Shot}> = ({shot}) => (
  <div style={footer}>
    <span>{shot.source_label || 'ORVYQ · CONTEXTUAL'}</span>
    <span>{shot.limitation || shot.semantic_purpose || ''}</span>
  </div>
);

const Headline: React.FC<{kicker?: string; title?: string; body?: string}> = ({kicker, title, body}) => (
  <div style={{position: 'absolute', left: 70, right: 70, top: 64, fontFamily: 'Arial, sans-serif', color: palette.paper}}>
    {kicker ? <div style={{fontSize: 18, color: palette.accent, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase'}}>{kicker}</div> : null}
    {title ? <div style={{fontSize: 54, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.5, maxWidth: 1420, marginTop: 12}}>{title}</div> : null}
    {body ? <div style={{fontSize: 25, lineHeight: 1.35, color: palette.muted, maxWidth: 1180, marginTop: 18}}>{body}</div> : null}
  </div>
);

const assetFor = (shot: Shot, assets: Asset[]) => assets.find((asset) => asset.relative_path === shot.physical_asset || shot.asset_ids?.includes(asset.id));

export const FootageScene: React.FC<{shot: Shot; assets: Asset[]}> = ({shot, assets}) => {
  const frame = useCurrentFrame();
  const asset = assetFor(shot, assets);
  const scale = interpolate(frame, [0, Math.max(1, shot.end_frame - shot.start_frame)], [1.02, 1.08], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (!asset) return <AbsoluteFill style={{backgroundColor: palette.ink}}><Headline title={shot.title} body={shot.body}/><SourceFooter shot={shot}/></AbsoluteFill>;
  return (
    <AbsoluteFill style={{backgroundColor: palette.ink, overflow: 'hidden'}}>
      <OffthreadVideo src={staticFile(asset.relative_path)} startFrom={Math.round((shot.footage_trim?.start_seconds || 0) * 30)} endAt={shot.footage_trim ? Math.round(shot.footage_trim.end_seconds * 30) : undefined} muted style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'brightness(0.65) saturate(0.75) contrast(1.08)'}}/>
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(3,9,14,.76), rgba(3,9,14,.08) 70%, rgba(3,9,14,.36))'}}/>
      <Headline kicker={shot.emphasis_beat ? 'THE TURN' : undefined} title={shot.title} body={shot.body}/>
      <SourceFooter shot={shot}/>
    </AbsoluteFill>
  );
};

export const EvidenceScene: React.FC<{shot: Shot; assets: Asset[]}> = ({shot, assets}) => {
  const frame = useCurrentFrame();
  const asset = assetFor(shot, assets);
  const lift = interpolate(frame, [0, 20], [18, 0], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 25% 10%, #142536 0%, ${palette.ink} 55%)`, color: palette.paper}}>
      <Headline kicker={shot.visual_class.replaceAll('_', ' ')} title={shot.title} body={shot.body}/>
      <div style={{position: 'absolute', left: 90, right: 90, top: 245, bottom: 92, transform: `translateY(${lift}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {asset?.relative_path.endsWith('.svg') || asset?.relative_path.match(/\.(png|jpg|jpeg)$/i)
          ? <Img src={staticFile(asset.relative_path)} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 26px 70px rgba(0,0,0,.46)'}}/>
          : <div style={{width: '82%', border: `1px solid ${palette.muted}55`, backgroundColor: '#f4f1ea', color: '#17202a', padding: 48, fontFamily: 'Georgia, serif', fontSize: 34, lineHeight: 1.35}}>{shot.quote || shot.body || shot.semantic_purpose}</div>}
      </div>
      <SourceFooter shot={shot}/>
    </AbsoluteFill>
  );
};

export const GraphicScene: React.FC<{shot: Shot}> = ({shot}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [4, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: palette.ink, color: palette.paper}}>
      <Headline kicker={shot.visual_class.replaceAll('_', ' ')} title={shot.title} body={shot.body}/>
      <div style={{position: 'absolute', left: 110, right: 110, top: 330, height: 260, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24}}>
        {[0,1,2,3].map((index) => <div key={index} style={{border: `1px solid ${palette.muted}44`, backgroundColor: palette.panel, padding: 28, opacity: Math.max(.18, progress - index * .16)}}><div style={{height: 4, backgroundColor: index === 2 ? palette.accent : palette.muted, marginBottom: 28}}/><div style={{fontFamily: 'Arial', fontSize: 25, fontWeight: 700}}>STEP {index + 1}</div><div style={{fontFamily: 'Arial', fontSize: 19, color: palette.muted, marginTop: 14}}>{shot.semantic_purpose || 'Verified structural explanation'}</div></div>)}
      </div>
      <SourceFooter shot={shot}/>
    </AbsoluteFill>
  );
};

export const BrandOpen: React.FC<{shot: Shot}> = ({shot}) => <AbsoluteFill style={{backgroundColor: '#03070b', justifyContent: 'center', alignItems: 'center', color: palette.paper, fontFamily: 'Arial'}}><div style={{fontSize: 92, fontWeight: 800, letterSpacing: 14}}>ORVYQ</div><div style={{fontSize: 22, letterSpacing: 8, color: palette.muted, marginTop: 20}}>BEYOND THE KNOWN</div><SourceFooter shot={shot}/></AbsoluteFill>;
export const EndCard: React.FC = () => <AbsoluteFill style={{backgroundColor: '#03070b', justifyContent: 'center', alignItems: 'center', color: palette.paper, fontFamily: 'Arial'}}><div style={{fontSize: 78, fontWeight: 800, letterSpacing: 13}}>ORVYQ STUDIO</div><div style={{fontSize: 22, letterSpacing: 6, color: palette.muted, marginTop: 22}}>A FILM BEYOND THE KNOWN</div></AbsoluteFill>;

export const ShotScene: React.FC<{shot: Shot; assets: Asset[]}> = ({shot, assets}) => {
  if (shot.visual_class === 'orvyq_brand_open') return <BrandOpen shot={shot}/>;
  if (shot.visual_class === 'orvyq_end_card') return <EndCard/>;
  if (shot.visual_class === 'cinematic_footage' || shot.visual_class === 'emphasis_beat') return <FootageScene shot={shot} assets={assets}/>;
  if (['official_document','official_figure','source_mosaic','document_overlay','email_recreation','quote_treatment','limitation_treatment'].includes(shot.visual_class)) return <EvidenceScene shot={shot} assets={assets}/>;
  return <GraphicScene shot={shot}/>;
};
