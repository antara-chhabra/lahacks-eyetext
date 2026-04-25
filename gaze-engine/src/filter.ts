import type { GazePoint } from './types.js';

// px/ms below which gaze is considered "settled" and gets extra smoothing.
// At 30 fps (dt≈33 ms) this is ~50 px per frame — a small natural drift.
const SETTLE_VELOCITY = 1.5;

export class GazeFilter {
  private readonly alpha: number;
  private readonly confidenceThreshold: number;
  private prevX: number | null = null;
  private prevY: number | null = null;
  private prevTs: number | null = null;

  constructor(alpha = 0.4, confidenceThreshold = 0.3) {
    this.alpha = alpha;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Apply EMA smoothing to one raw gaze frame.
   * Returns null if the frame is dropped (low confidence).
   *
   * Alpha is adaptive: when gaze velocity is below SETTLE_VELOCITY the filter
   * uses alpha*0.2 (very smooth / stable), otherwise it uses the configured
   * alpha (responsive during eye movements). Tests that supply timestamp=0 for
   * all frames see dt=0 and always get the base alpha — no test changes needed.
   */
  process(point: GazePoint): GazePoint | null {
    if (point.confidence < this.confidenceThreshold) return null;

    if (this.prevX === null || this.prevY === null || this.prevTs === null) {
      this.prevX = point.x;
      this.prevY = point.y;
      this.prevTs = point.timestamp;
      return point;
    }

    const dt = point.timestamp - this.prevTs;
    let alpha = this.alpha;

    if (dt > 0) {
      const dx = point.x - this.prevX;
      const dy = point.y - this.prevY;
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      if (velocity < SETTLE_VELOCITY) {
        // Eye is barely moving — use a much lower alpha so jitter averages out.
        alpha = Math.max(this.alpha * 0.2, 0.05);
      }
    }

    const x = alpha * point.x + (1 - alpha) * this.prevX;
    const y = alpha * point.y + (1 - alpha) * this.prevY;
    this.prevX = x;
    this.prevY = y;
    this.prevTs = point.timestamp;

    return { ...point, x, y };
  }

  reset(): void {
    this.prevX = null;
    this.prevY = null;
    this.prevTs = null;
  }
}
