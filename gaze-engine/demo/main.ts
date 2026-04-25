import { GazeEngine, buildCalibrationProfile } from '@catalyst/gaze-engine';
import type { GazeSource, GazeCallback, CalibrationSample, CalibrationProfile } from '@catalyst/gaze-engine';
import { MediaPipeGazeSource } from './mediapipe-source';

// ── Next-word transition table ────────────────────────────────────────────────
// Key = last 1–2 words of composed text (uppercase). Value = 4 suggestions.
// Lookup: try 2-word key first, then 1-word key, then '' (sentence start).

const TRANSITIONS: Record<string, string[]> = {
  '':           ['I',        'PLEASE',    'HELP',      'YES'       ],
  'I':          ['WANT',     'NEED',      'FEEL',      'AM'        ],
  'I WANT':     ['WATER',    'FOOD',      'MEDICINE',  'BATHROOM'  ],
  'WANT':       ['WATER',    'FOOD',      'MEDICINE',  'HELP'      ],
  'I NEED':     ['HELP',     'WATER',     'MEDICINE',  'DOCTOR'    ],
  'NEED':       ['HELP',     'WATER',     'MEDICINE',  'BATHROOM'  ],
  'I FEEL':     ['PAIN',     'TIRED',     'COLD',      'HOT'       ],
  'FEEL':       ['PAIN',     'TIRED',     'COLD',      'BETTER'    ],
  'I AM':       ['IN PAIN',  'TIRED',     'COLD',      'OKAY'      ],
  'AM':         ['IN PAIN',  'TIRED',     'OKAY',      'UNCOMFORTABLE'],
  'PLEASE':     ['HELP',     'CALL',      'STOP',      'COME'      ],
  'PLEASE CALL':['DOCTOR',   'NURSE',     'FAMILY',    'EMERGENCY' ],
  'CALL':       ['DOCTOR',   'NURSE',     'FAMILY',    'EMERGENCY' ],
  'HELP':       ['ME',       'NOW',       'PLEASE',    'DOCTOR'    ],
  'YES':        ['PLEASE',   'MORE',      'THAT',      'THANK YOU' ],
  'NO':         ['THANK YOU','MORE',      'STOP',      'PLEASE'    ],
  'THANK YOU':  ['SO MUCH',  'FOR EVERYTHING', 'VERY MUCH', 'ALL'  ],
  'PAIN':       ['HERE',     'CHEST',     'BACK',      'HEAD'      ],
  'IN PAIN':    ['HERE',     'CHEST',     'PLEASE HELP','MEDICINE' ],
  'MORE':       ['WATER',    'FOOD',      'MEDICINE',  'AIR'       ],
  'CANNOT':     ['BREATHE',  'MOVE',      'SLEEP',     'EAT'       ],
  'WATER':      ['PLEASE',   'NOW',       'MORE',      'THANK YOU' ],
  'FOOD':       ['PLEASE',   'MORE',      'WARM',      'THANK YOU' ],
  'MEDICINE':   ['PLEASE',   'NOW',       'MORE',      'THANK YOU' ],
  'DOCTOR':     ['PLEASE',   'NOW',       'COME',      'HELP'      ],
  'NURSE':      ['PLEASE',   'NOW',       'COME',      'HELP'      ],
  'TIRED':      ['VERY',     'PLEASE',    'SLEEP',     'REST'      ],
  'COLD':       ['BLANKET',  'PLEASE',    'VERY',      'HELP'      ],
  'HOT':        ['WATER',    'FAN',       'PLEASE',    'HELP'      ],
  'BATHROOM':   ['PLEASE',   'NOW',       'HELP',      'URGENT'    ],
  'OKAY':       ['THANK YOU','GOOD',      'YES',       'BETTER'    ],
  'STOP':       ['PLEASE',   'NOW',       'THAT',      'PAIN'      ],
};

const DEFAULT_WORDS = TRANSITIONS[''];

function getNextWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const key2 = words.slice(-2).join(' ');
    if (TRANSITIONS[key2]) return TRANSITIONS[key2];
  }
  if (words.length >= 1) {
    const key1 = words[words.length - 1];
    if (TRANSITIONS[key1]) return TRANSITIONS[key1];
  }
  return DEFAULT_WORDS;
}

// ── Text state ────────────────────────────────────────────────────────────────

let composedText = '';

function updateDisplay() {
  const el = document.getElementById('text-content')!;
  el.textContent = composedText || 'Look at a word to begin…';
  el.classList.toggle('placeholder', !composedText);
}

// ── Screen helpers ────────────────────────────────────────────────────────────

function showScreen(id: string) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)!.classList.add('active');
}

// ── Calibration ───────────────────────────────────────────────────────────────

const CALIB_GRID = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
];
const HOLD_MS = 300;
const POLL_MS = 33;

function runWebcamCalibration(source: MediaPipeGazeSource): Promise<CalibrationSample[]> {
  const samples: CalibrationSample[] = [];

  return new Promise(resolve => {
    const surface    = document.getElementById('calib-surface')!;
    const nEl        = document.getElementById('calib-n')!;
    const progressEl = document.getElementById('calib-progress')!;
    surface.innerHTML = '';

    const dots = CALIB_GRID.map((pos, i) => {
      const dot = document.createElement('div');
      dot.className = 'calib-dot';
      dot.style.left = `${pos.x * 100}vw`;
      dot.style.top  = `${pos.y * 100}vh`;
      if (i !== 0) dot.style.opacity = '0.3';
      surface.appendChild(dot);
      return dot;
    });

    let current = 0;
    let capturing = false;
    dots[0].classList.add('active');
    nEl.textContent = '1';
    progressEl.textContent = 'Click the dot, then hold still';

    const advance = () => {
      capturing = false;
      dots[current].classList.remove('active', 'capturing');
      dots[current].classList.add('done');
      current++;
      if (current >= CALIB_GRID.length) {
        surface.innerHTML = '';
        resolve(samples);
        return;
      }
      nEl.textContent = String(current + 1);
      progressEl.textContent = 'Click the dot, then hold still';
      dots[current].style.opacity = '1';
      dots[current].classList.add('active');
    };

    const startCapture = (i: number) => {
      if (i !== current || capturing) return;
      capturing = true;
      const pos = CALIB_GRID[i];
      const rawBuf: Array<{ x: number; y: number }> = [];
      dots[i].classList.add('capturing');
      progressEl.textContent = 'Holding… keep your gaze steady';

      const timer = setInterval(() => {
        const raw = source.lastRaw;
        if (raw) rawBuf.push({ x: raw.x, y: raw.y });
      }, POLL_MS);

      setTimeout(() => {
        clearInterval(timer);
        if (rawBuf.length >= 3) {
          const cx = rawBuf.reduce((s, p) => s + p.x, 0) / rawBuf.length;
          const cy = rawBuf.reduce((s, p) => s + p.y, 0) / rawBuf.length;
          const sorted = [...rawBuf].sort(
            (a, b) => (a.x-cx)**2 + (a.y-cy)**2 - ((b.x-cx)**2 + (b.y-cy)**2)
          );
          const kept = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.8)));
          samples.push({
            screenX:  pos.x * window.innerWidth,
            screenY:  pos.y * window.innerHeight,
            rawGazeX: kept.reduce((s, p) => s + p.x, 0) / kept.length,
            rawGazeY: kept.reduce((s, p) => s + p.y, 0) / kept.length,
          });
        }
        advance();
      }, HOLD_MS);
    };

    dots.forEach((dot, i) => dot.addEventListener('click', () => startCapture(i)));

    document.getElementById('btn-skip-calib')!.addEventListener('click', () => {
      surface.innerHTML = '';
      resolve(samples);
    }, { once: true });
  });
}

// ── Gaze cursor ───────────────────────────────────────────────────────────────

function moveCursor(x: number, y: number) {
  const el = document.getElementById('gaze-cursor')!;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
}

// ── Speech ────────────────────────────────────────────────────────────────────

let currentUtterance: SpeechSynthesisUtterance | null = null;

function speak(text: string) {
  if (!window.speechSynthesis) return;
  if (currentUtterance) window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 0.9;
  window.speechSynthesis.speak(currentUtterance);
}

// ── Word board ────────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 44;

// Tile IDs: word0–word3, ctrl-UNDO, ctrl-SEND
const WORD_TILE_IDS = ['word0', 'word1', 'word2', 'word3'];
const CTRL_UNDO = 'ctrl-UNDO';
const CTRL_SEND = 'ctrl-SEND';
const ALL_TILE_IDS = [...WORD_TILE_IDS, CTRL_UNDO, CTRL_SEND];

function makeTileHTML(label: string): string {
  return `
    <div class="tile-word">${label}</div>
    <svg class="progress-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring-track" cx="50" cy="50" r="44"/>
      <circle class="ring-fill" cx="50" cy="50" r="44"
        stroke-dasharray="${CIRC.toFixed(2)}"
        stroke-dashoffset="${CIRC.toFixed(2)}"/>
    </svg>`;
}

function buildBoard(engine: GazeEngine) {
  const grid = document.getElementById('word-grid')!;
  grid.innerHTML = '';

  for (const id of WORD_TILE_IDS) {
    const el = document.createElement('div');
    el.className = 'tile word-tile';
    el.id = id;
    el.innerHTML = makeTileHTML('');
    grid.appendChild(el);
  }

  const undo = document.createElement('div');
  undo.className = 'tile ctrl-tile ctrl-undo';
  undo.id = CTRL_UNDO;
  undo.innerHTML = makeTileHTML('⌫ UNDO WORD');
  grid.appendChild(undo);

  const send = document.createElement('div');
  send.className = 'tile ctrl-tile ctrl-send';
  send.id = CTRL_SEND;
  send.innerHTML = makeTileHTML('SEND ▶');
  grid.appendChild(send);

  requestAnimationFrame(() => {
    for (const id of ALL_TILE_IDS) {
      const r = document.getElementById(id)!.getBoundingClientRect();
      engine.registerTarget({
        id,
        rect: { x: r.left - 10, y: r.top - 10, width: r.width + 20, height: r.height + 20 },
        label: id,
      });
    }
    refreshWordTiles(engine);
  });
}

function refreshWordTiles(engine: GazeEngine) {
  const words = getNextWords(composedText);
  for (let i = 0; i < WORD_TILE_IDS.length; i++) {
    const el = document.getElementById(WORD_TILE_IDS[i])!;
    const label = words[i] ?? '';
    el.dataset.word = label;
    const wordEl = el.querySelector('.tile-word') as HTMLElement;
    if (wordEl) wordEl.textContent = label;
    el.classList.toggle('empty', !label);
  }
}

function handleSelect(id: string, engine: GazeEngine) {
  if (id === CTRL_UNDO) {
    // Remove last word from composed text
    const trimmed = composedText.trimEnd();
    const lastSpace = trimmed.lastIndexOf(' ');
    composedText = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace) + ' ';
    updateDisplay();
    refreshWordTiles(engine);
    return;
  }

  if (id === CTRL_SEND) {
    const text = composedText.trim();
    if (!text) return;
    speak(text);
    fetch('/phrases/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {});
    composedText = '';
    updateDisplay();
    refreshWordTiles(engine);
    return;
  }

  const el = document.getElementById(id) as HTMLElement | null;
  const word = el?.dataset.word;
  if (!word) return;
  composedText = (composedText.trimEnd() + ' ' + word + ' ').trimStart();
  updateDisplay();
  refreshWordTiles(engine);
}

// ── Board launcher ────────────────────────────────────────────────────────────

async function startBoard(source: GazeSource, calibration?: CalibrationProfile): Promise<GazeEngine> {
  composedText = '';

  const engine = new GazeEngine(
    { dwellMs: 1200, confidenceThreshold: 0.3, filterAlpha: 0.5 },
    source,
  );
  if (calibration) engine.loadCalibrationProfile(calibration);

  showScreen('screen-board');
  updateDisplay();
  buildBoard(engine);

  const cursor = document.getElementById('gaze-cursor')!;
  cursor.style.display = 'block';
  engine.onGaze(pt => moveCursor(pt.x, pt.y));

  engine.onDwellProgress((id, progress) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.word === '' && WORD_TILE_IDS.includes(id)) return; // skip empty prediction tiles
    const fill = el.querySelector('.ring-fill') as SVGCircleElement | null;
    if (fill) fill.style.strokeDashoffset = String(CIRC * (1 - progress));
    el.classList.toggle('dwelling', progress > 0);
  });

  engine.onSelect((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.word === '' && WORD_TILE_IDS.includes(id)) return;
    el.classList.remove('selected');
    void el.offsetWidth;
    el.classList.add('selected');
    const fill = el.querySelector('.ring-fill') as SVGCircleElement | null;
    if (fill) fill.style.strokeDashoffset = String(CIRC);
    el.classList.remove('dwelling');
    handleSelect(id, engine);
  });

  window.addEventListener('resize', () => {
    engine.clearTargets();
    for (const id of ALL_TILE_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      engine.registerTarget({ id, rect: { x: r.left-10, y: r.top-10, width: r.width+20, height: r.height+20 }, label: id });
    }
  });

  await engine.start();
  return engine;
}

// ── Button wiring ─────────────────────────────────────────────────────────────

let mpSource: MediaPipeGazeSource | null = null;

function wireButtons(engine: GazeEngine, calibration: CalibrationProfile | undefined) {
  ['btn-back', 'btn-recalibrate'].forEach(btnId => {
    const old = document.getElementById(btnId)!;
    const fresh = old.cloneNode(true) as HTMLElement;
    old.parentNode!.replaceChild(fresh, old);
  });

  document.getElementById('btn-back')!.addEventListener('click', () => {
    engine.stop();
    mpSource?.shutdown();
    mpSource = null;
    document.getElementById('gaze-cursor')!.style.display = 'none';
    const btn = document.getElementById('btn-webcam') as HTMLButtonElement;
    btn.textContent = '📷 Start with Webcam →';
    btn.disabled = false;
    showScreen('screen-landing');
  });

  document.getElementById('btn-recalibrate')!.addEventListener('click', async () => {
    engine.stop();
    if (!mpSource) return;
    showScreen('screen-calibration');
    const newSamples = await runWebcamCalibration(mpSource);
    const newCal = newSamples.length >= 2 ? buildCalibrationProfile(newSamples) : calibration;
    const newEngine = await startBoard(mpSource, newCal);
    wireButtons(newEngine, newCal);
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

document.getElementById('btn-webcam')!.addEventListener('click', async () => {
  const btn = document.getElementById('btn-webcam') as HTMLButtonElement;
  const setStatus = (msg: string, disabled = true) => {
    btn.textContent = msg;
    btn.disabled = disabled;
  };

  setStatus('Initializing…');

  try {
    const statusEl = document.getElementById('calib-instruction');
    mpSource = new MediaPipeGazeSource();
    showScreen('screen-calibration');
    await mpSource.init(statusEl);

    const samples = await runWebcamCalibration(mpSource);
    const calibration = samples.length >= 2 ? buildCalibrationProfile(samples) : undefined;
    if (!calibration) console.warn('Too few calibration samples — gaze will be uncalibrated');

    const engine = await startBoard(mpSource, calibration);
    wireButtons(engine, calibration);

  } catch (err) {
    console.error('Webcam init failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`⚠ ${msg.slice(0, 55)}`, false);
    mpSource?.shutdown();
    mpSource = null;
    showScreen('screen-landing');
    setTimeout(() => setStatus('📷 Start with Webcam →', false), 4000);
  }
});
