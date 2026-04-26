// Re-exports relevant shared types for the frontend.
// Full definitions live in ../shared/models.ts — keep in sync.

export type Theme = 'standard' | 'highContrast' | 'largeText';
export type IntentCategory = 'need' | 'greeting' | 'emergency' | 'social' | 'response';
export type RouteDestination = 'tts' | 'sms' | 'dashboard' | 'emergency';

export interface TileMeta {
  id: string;           // e.g. "WATER"
  label: string;        // e.g. "Water"
  category: string;     // e.g. "needs"
  publicId: string;     // Cloudinary public ID, e.g. "catalyst-care/needs/water"
  emoji: string;        // Fallback when Cloudinary is unconfigured
}

export interface GazeSequence {
  points: never[];
  dwell_target_id: string;
  dwell_duration_ms: number;
  session_id: string;
  user_id: string;
}

export interface RouteDecision {
  message: {
    text: string;
    audio_url?: string | null;
  };
  destinations: RouteDestination[];
  sms_sent: boolean;
  routed_at: number;
}

export interface HistoryEntry {
  id: string;
  text: string;
  tile_id: string;
  intent_category: IntentCategory;
  urgency: number;
  destinations: RouteDestination[];
  sms_sent: boolean;
  created_at: number;
}
