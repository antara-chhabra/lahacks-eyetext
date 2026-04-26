import Anthropic from '@anthropic-ai/sdk';

// Mirrors claudinary-video/src/types.ts — kept local to avoid cross-package resolution issues
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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? 'dsddkg2x6';
const FRAME_COUNT = 8;

async function fetchFrameAsBase64(publicId: string, offsetSec: number): Promise<string | null> {
  const url = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_${offsetSec},f_jpg/${publicId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString('base64');
  } catch {
    return null;
  }
}

export async function analyzeSession(data: SessionData): Promise<SessionSummary> {
  const duration = Math.max(data.duration, 1);
  const interval = duration / (FRAME_COUNT + 1);

  // Fetch frames in parallel
  const framePromises = Array.from({ length: FRAME_COUNT }, (_, i) => {
    const sec = Math.round(interval * (i + 1));
    return fetchFrameAsBase64(data.videoPublicId, sec);
  });
  const frames = (await Promise.all(framePromises)).filter(Boolean) as string[];

  const transcript = data.messagesSent.length > 0
    ? data.messagesSent.map((m, i) => `${i + 1}. "${m}"`).join('\n')
    : '(no messages sent during session)';

  const wordSelectCount = data.events.filter(e => e.type === 'word_select').length;

  const imageBlocks: Anthropic.ImageBlockParam[] = frames.map(b64 => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
  }));

  const systemPrompt = `You are a clinical observer reviewing an AAC (Augmentative and Alternative Communication) session for a patient with ALS, stroke, or motor decline. The patient communicates by gazing at tiles.

Analyze the video frames and session data carefully. Return ONLY a valid JSON object with these exact keys:
- emotionalArc (string): How did the patient's emotional state change from start to end?
- bodyLanguage (string): Observable posture, facial expressions, eye engagement, physical comfort.
- communicationQuality (string): Effectiveness, fluency, engagement level, any patterns of struggle.
- keyMoments (array of strings): 2–4 notable moments (peak engagement, fatigue, apparent urgency, etc.).
- clinicalNotes (string): Anything caregivers should be aware of based on this session.

Be concise, compassionate, and clinically useful. Do not fabricate details — only report what is observable.`;

  const userContent: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    {
      type: 'text',
      text: `Session details:
- Duration: ${duration} seconds
- Tile selections made: ${wordSelectCount}
- Messages sent: ${data.messagesSent.length}
- User ID: ${data.userId}

${frames.length} video frames extracted at ~${Math.round(interval)}s intervals.

Session transcript:
${transcript}

Please analyze this session and return the JSON summary.`,
    },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = response.content.find(b => b.type === 'text')?.text ?? '{}';

  let parsed: Partial<SessionSummary>;
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {};
  }

  return {
    emotionalArc: parsed.emotionalArc ?? 'Unable to determine from available frames.',
    bodyLanguage: parsed.bodyLanguage ?? 'Unable to determine from available frames.',
    communicationQuality: parsed.communicationQuality ?? 'Unable to determine from available frames.',
    keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments : [],
    clinicalNotes: parsed.clinicalNotes ?? 'No additional notes.',
    generatedAt: Date.now(),
  };
}
