export interface SessionEvent {
  timestamp: number;
  type: 'word_select' | 'send' | 'undo';
  value: string;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  videoUrl: string;
  videoPublicId: string;
  duration: number;
  events: SessionEvent[];
  messagesSent: string[];
}

export interface SessionSummary {
  emotionalArc: string;
  bodyLanguage: string;
  communicationQuality: string;
  keyMoments: string[];
  clinicalNotes: string;
  generatedAt: number;
}
