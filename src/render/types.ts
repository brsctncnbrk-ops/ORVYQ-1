export type Asset = {
  asset_id: string;
  role: string;
  media_type: 'audio' | 'video' | 'image';
  relative_path: string;
  duration_seconds: number;
  width?: number;
  height?: number;
};

export type Evidence = {
  evidence_id: string;
  evidence_type: string;
  relative_path: string;
  caption: string;
  source_ids: string[];
  claim_ids: string[];
};

export type Caption = {
  caption_id: string;
  start_frame: number;
  end_frame: number;
  text: string;
};

export type Shot = {
  shot_id: string;
  shot_type: string;
  start_frame: number;
  end_frame: number;
  claim_ids: string[];
  evidence_ids?: string[];
  asset_ids?: string[];
  editorial_purpose: string;
  motif_id: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  source_label?: string;
  limitation?: string;
  callout?: string;
  left?: string;
  right?: string;
  left_detail?: string;
  right_detail?: string;
  items?: Array<{label: string; value: string; detail?: string}>;
  steps?: string[];
  transition_in?: 'cut' | 'short_dissolve' | 'motivated_fade' | 'match_motion' | 'audio_led_cut';
  transition_out?: 'cut' | 'short_dissolve' | 'motivated_fade' | 'match_motion' | 'audio_led_cut';
  motion?: 'hold' | 'push' | 'pull' | 'drift_left' | 'drift_right' | 'slow_pan' | 'focus_reframe';
  trim_in_seconds?: number;
  trim_out_seconds?: number;
  evidence_claim?: boolean;
  captions_suppressed?: boolean;
  typography?: {title_px?: number; subtitle_px?: number; source_px?: number};
  safe_area?: {left: number; right: number; top: number; bottom: number};
};

export type ProductionPlan = {
  fps: number;
  width: number;
  height: number;
  full_frame_count: number;
  full_duration_seconds: number;
  proof_boundary_frame: number;
  audio_mix_asset: string;
  shots: Shot[];
};

export type RenderInput = {
  schema_version: '1.0';
  project_id: string;
  plan: ProductionPlan;
  evidence: Evidence[];
  assets: Asset[];
  captions: Caption[];
  audio_mix_asset: string;
};
