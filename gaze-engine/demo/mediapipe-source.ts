import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { GazeSource, GazeCallback } from '@catalyst/gaze-engine';

// ── Face mesh landmark indices (478-point model) ──────────────────────────────
//
//  Eye corners — used to find the eye center and measure eye width.
//  Eye width is our normalization unit: an iris shift of 1.0 = one full eye width.
//
const L_OUTER = 33;   // left eye temporal corner  (toward ear)
const L_INNER = 133;  // left eye nasal corner     (toward nose)
const L_TOP   = 159;  // left eye upper-lid midpoint
const L_BOT   = 145;  // left eye lower-lid midpoint
const R_INNER = 362;  // right eye nasal corner
const R_OUTER = 263;  // right eye temporal corner
const R_TOP   = 386;  // right eye upper-lid midpoint
const R_BOT   = 374;  // right eye lower-lid midpoint
const L_IRIS  = 468;  // left iris center
const R_IRIS  = 473;  // right iris center

const MIN_EYE_W = 0.01; // sanity guard — skip frame if eye is implausibly narrow

const WASM_URL  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class MediaPipeGazeSource implements GazeSource {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private _stream: MediaStream | null = null;
  private rafId: number | null = null;
  private cb: GazeCallback | null = null;

  get stream(): MediaStream | null { return this._stream; }

  /**
   * Last computed raw gaze vector: iris offset from eye center, normalised by
   * eye width. Typical range ≈ [-0.35, 0.35] on each axis.
   *
   * The calibration UI reads this every time the user clicks a dot and records
   * (lastRaw → known screen position) to build the CalibrationProfile.
   */
  lastRaw: { x: number; y: number } | null = null;

  async init(statusEl?: HTMLElement | null): Promise<void> {
    const status = (msg: string) => { if (statusEl) statusEl.textContent = msg; };

    status('Loading MediaPipe WASM…');
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    status('Downloading face-landmark model (~5 MB, once)…');
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      numFaces: 1,
    });

    status('Opening camera…');
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });

    this.video = document.createElement('video');
    this.video.id = 'webgazerVideoFeed'; // picks up the PiP CSS
    this.video.srcObject = this._stream;
    this.video.muted = true;
    this.video.playsInline = true;
    document.body.appendChild(this.video);
    await this.video.play();

    status('');
    // Run the frame loop immediately so lastRaw is ready before calibration starts
    this.loop();
  }

  // GazeSource interface — just registers/clears the callback
  async start(cb: GazeCallback): Promise<void> { this.cb = cb; }
  stop(): void { this.cb = null; }

  shutdown(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.cb = null;
    this._stream?.getTracks().forEach(t => t.stop());
    this.video?.remove();
    this.video = null;
    this.landmarker?.close();
    this.landmarker = null;
  }

  private loop(): void {
    if (!this.landmarker || !this.video) return;

    try {
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      const lm = result.faceLandmarks?.[0];

      if (lm && lm.length > R_IRIS) {
        // ── Eye geometry ────────────────────────────────────────────────────
        const lCX = (lm[L_OUTER].x + lm[L_INNER].x) / 2;
        const lCY = (lm[L_TOP].y   + lm[L_BOT].y)   / 2;
        const rCX = (lm[R_OUTER].x + lm[R_INNER].x) / 2;
        const rCY = (lm[R_TOP].y   + lm[R_BOT].y)   / 2;
        const lW  = Math.abs(lm[L_OUTER].x - lm[L_INNER].x);
        const rW  = Math.abs(lm[R_OUTER].x - lm[R_INNER].x);

        if (lW < MIN_EYE_W || rW < MIN_EYE_W) {
          this.rafId = requestAnimationFrame(() => this.loop());
          return;
        }

        // ── Normalised iris offset ──────────────────────────────────────────
        // This is the actual gaze signal. Moving the iris right/left within the
        // eye socket is what changes when you look at different screen positions.
        // Dividing by eye width makes it independent of face distance and size.
        const rawX = ((lm[L_IRIS].x - lCX) / lW + (lm[R_IRIS].x - rCX) / rW) / 2;
        const rawY = ((lm[L_IRIS].y - lCY) / lW + (lm[R_IRIS].y - rCY) / rW) / 2;

        this.lastRaw = { x: rawX, y: rawY };

        if (this.cb) {
          // Emit the raw offset — the GazeEngine applies CalibrationProfile
          // (scale + offset) to map these values to screen coordinates.
          this.cb({ x: rawX, y: rawY, confidence: 0.85, timestamp: Date.now() });
        }
      }
    } catch {
      // skip frame silently
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
