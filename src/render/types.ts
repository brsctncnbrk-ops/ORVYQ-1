export type VisualClass =
  | 'cinematic_footage' | 'official_document' | 'official_figure' | 'source_mosaic'
  | 'document_overlay' | 'stat_overlay' | 'comparison_overlay' | 'process_diagram'
  | 'email_recreation' | 'quote_treatment' | 'limitation_treatment' | 'emphasis_beat'
  | 'orvyq_brand_open' | 'orvyq_end_card';

export type Asset = {
  id: string;
  relative_path: string;
  media_type: string;
  role?: string;
};

export type Caption = {id: string; start_frame: number; end_frame: number; text: string};

export type Shot = {
  id: string;
  start_frame: number;
  end_frame: number;
  visual_class: VisualClass;
  physical_asset?: string;
  asset_ids?: string[];
  footage_trim?: {start_seconds: number; end_seconds: number};
  semantic_purpose?: string;
  source_ids?: string[];
  claim_ids?: string[];
  source_label?: string;
  limitation?: string;
  title?: string;
  body?: string;
  quote?: string;
  transition?: string;
  emphasis_beat?: boolean;
  full_screen?: boolean;
};

export type RenderInput = {
  schema_version: string;
  project_id: string;
  plan: {
    fps: number;
    width: number;
    height: number;
    full_frame_count: number;
    full_duration_seconds: number;
    proof_boundary_frame: number;
    shots: Shot[];
    music_cues?: Array<{start_frame: number; end_frame: number; volume: number}>;
  };
  timeline: {source_audio: string};
  assets: Asset[];
  captions: Caption[];
};
