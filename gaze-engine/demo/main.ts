import { GazeEngine, WebGazerSource } from '@catalyst/gaze-engine';
import { SessionRecorder } from '../../claudinary-video/src/recorder';
import { uploadToCloudinary } from '../../claudinary-video/src/uploader';
import type { SessionEvent, SessionData, SessionSummary } from '../../claudinary-video/src/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOUDINARY_CLOUD = 'dsddkg2x6';
const CLOUDINARY_PRESET = 'Lahacks';
const BACKEND_URL = 'http://localhost:3001';
const AGENT_URL = 'http://localhost:8000';
const USER_ID = 'demo-1';
const SESSION_ID = `sess-${Date.now()}`;

// ── Per-mode state ────────────────────────────────────────────────────────────

type ModeState = {
  events: SessionEvent[];
  messages: string[];
  summaryPromise: Promise<SessionSummary> | null;
};

const talkState: ModeState = { events: [], messages: [], summaryPromise: null };
const helpState: ModeState = { events: [], messages: [], summaryPromise: null };

let currentMode: 'talk' | 'help' = 'talk';
function getState() { return currentMode === 'talk' ? talkState : helpState; }

// Mode select gaze bridge — resolved by the engine's onSelect when on mode-select screen
let modeSelectResolve: ((mode: 'talk' | 'help') => void) | null = null;

// ── Session recording ─────────────────────────────────────────────────────────

const recorder = new SessionRecorder();

// ── Next-word transition table ────────────────────────────────────────────────

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

// ── Help tiles ────────────────────────────────────────────────────────────────

const HELP_TILES = [
  { id: 'help-0', emoji: '🆘', label: 'Help me',   speech: 'Help me, please.' },
  { id: 'help-1', emoji: '😣', label: 'In Pain',   speech: 'I am in pain.' },
  { id: 'help-2', emoji: '💧', label: 'Water',     speech: 'I need water.' },
  { id: 'help-3', emoji: '🍽️', label: 'Food',      speech: 'I need food.' },
  { id: 'help-4', emoji: '🚽', label: 'Bathroom',  speech: 'I need to use the bathroom.' },
];

// ── Agent response ────────────────────────────────────────────────────────────

function showAgentResponse(text: string) {
  const banner = document.getElementById('agent-response')!;
  const textEl = document.getElementById('agent-response-text')!;
  textEl.textContent = text;
  banner.classList.remove('hidden');
}

function clearAgentResponse() {
  document.getElementById('agent-response')!.classList.add('hidden');
}

// ── Text state (Talk mode only) ───────────────────────────────────────────────

let composedText = '';

function updateDisplay() {
  const el = document.getElementById('text-content')!;
  if (currentMode === 'help') {
    el.textContent = 'Instant speak — one look, one message';
    el.classList.add('placeholder');
    return;
  }
  el.textContent = composedText || 'Look at a word to begin…';
  el.classList.toggle('placeholder', !composedText);
}

// ── Screen helpers ────────────────────────────────────────────────────────────

function showScreen(id: string) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)!.classList.add('active');
  document.body.dataset.screen = id;
}

// ── Calibration ───────────────────────────────────────────────────────────────

function showCalibrationVideo(): void {
  const wg = (globalThis as any).webgazer;
  if (!wg) return;
  wg.showVideo(true);
  const v = wg.getVideoElement?.() as HTMLVideoElement | null;
  if (!v) return;
  v.style.position = 'fixed';
  v.style.left = '50%';
  v.style.top = '50%';
  v.style.transform = 'translate(-50%, -50%)';
  v.style.width = '240px';
  v.style.height = '180px';
  v.style.borderRadius = '14px';
  v.style.border = '2.5px solid #E87240';
  v.style.objectFit = 'cover';
  v.style.zIndex = '590';
  v.style.display = 'block';
  v.style.pointerEvents = 'none';
}

function get7CalibPoints(w: number, h: number): Array<{x: number; y: number}> {
  const mx  = Math.round(w * 0.07);   // horizontal inset ~7% from edges
  const top = 140;                     // below the calibration header text
  const mid = Math.round(h * 0.5);
  const bot = Math.round(h - 80);
  return [
    { x: mx,          y: top },   // top-left
    { x: w - mx,      y: top },   // top-right
    { x: mx,          y: mid },   // mid-left
    { x: w - mx,      y: mid },   // mid-right
    { x: Math.round(w * 0.25), y: bot },  // bottom-left
    { x: Math.round(w * 0.5),  y: bot },  // bottom-center
    { x: Math.round(w * 0.75), y: bot },  // bottom-right
  ];
}

function runWebcamCalibration(): Promise<void> {
  return new Promise(resolve => {
    const pts = get7CalibPoints(window.innerWidth, window.innerHeight);
    const surface    = document.getElementById('calib-surface')!;
    const progressEl = document.getElementById('calib-progress')!;
    surface.innerHTML = '';

    const dots = pts.map(pos => {
      const dot = document.createElement('div');
      dot.className = 'calib-dot';
      dot.style.left = `${pos.x}px`;
      dot.style.top  = `${pos.y}px`;
      surface.appendChild(dot);
      return dot;
    });

    document.querySelector('.calib-counter')!.innerHTML =
      `Point <span id="calib-n">1</span> / ${pts.length}`;
    const nEl = document.getElementById('calib-n')!;

    let current = 0;
    dots[0].classList.add('active');
    progressEl.textContent = 'Click the dot, then hold still';

    const finishCalibration = () => {
      // Freeze WebGazer's model — stop training from subsequent mouse events
      (globalThis as any).webgazer?.removeMouseEventListeners?.();
      // Hide camera preview now that calibration is done
      (globalThis as any).webgazer?.showVideo?.(false);
      surface.innerHTML = '';
      resolve();
    };

    const advance = () => {
      dots[current].classList.remove('active');
      dots[current].classList.add('done');
      current++;
      if (current >= pts.length) {
        finishCalibration();
        return;
      }
      nEl.textContent = String(current + 1);
      dots[current].classList.add('active');
    };

    dots.forEach(dot => dot.addEventListener('click', advance, { once: true }));

    document.getElementById('btn-skip-calib')!.addEventListener('click', () => {
      finishCalibration();
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

// ── Word board (Talk mode) ────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 44;

const WORD_TILE_IDS = ['word0', 'word1', 'word2', 'word3'];
const CTRL_UNDO = 'ctrl-UNDO';
const CTRL_SEND = 'ctrl-SEND';
const ALL_TALK_TILE_IDS = [...WORD_TILE_IDS, CTRL_UNDO, CTRL_SEND];
const HEADER_BTN_IDS = ['btn-back', 'btn-recalibrate', 'btn-bye', 'btn-toggle-talk', 'btn-toggle-help'];

function makeTileHTML(label: string): string {
  return `
    <div class="tile-word">${label}</div>
    <svg class="progress-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring-track" cx="50" cy="50" r="44"/>
      <circle class="ring-fill" cx="50" cy="50" r="44"
        stroke-dasharray="${CIRC.toFixed(2)}"
        stroke-dashoffset="${CIRC.toFixed(2)}"/>
    </svg>
    <div class="tile-prob-bar" style="width:0%"></div>`;
}

function makeHelpTileHTML(emoji: string, label: string): string {
  return `
    <div class="help-inner">
      <div class="help-emoji">${emoji}</div>
      <div class="tile-word">${label}</div>
    </div>
    <svg class="progress-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring-track" cx="50" cy="50" r="44"/>
      <circle class="ring-fill" cx="50" cy="50" r="44"
        stroke-dasharray="${CIRC.toFixed(2)}"
        stroke-dashoffset="${CIRC.toFixed(2)}"/>
    </svg>`;
}

function setWordTileLabels(words: string[], engine: GazeEngine, weights?: number[]) {
  const maxW = weights && weights.length ? Math.max(...weights, 1) : 10;
  let allEmpty = true;
  for (let i = 0; i < WORD_TILE_IDS.length; i++) {
    const el = document.getElementById(WORD_TILE_IDS[i])!;
    const label = words[i] ?? '';
    el.dataset.word = label;
    const wordEl = el.querySelector('.tile-word') as HTMLElement;
    if (wordEl) wordEl.textContent = label;
    el.classList.toggle('empty', !label);
    if (label) allEmpty = false;

    const bar = el.querySelector('.tile-prob-bar') as HTMLElement | null;
    if (bar) {
      const pct = weights ? Math.round((weights[i] ?? 0) / maxW * 100) : 0;
      bar.style.width = `${pct}%`;
    }
  }
  if (allEmpty) showAgentResponse('Please send or undo a word.');
  requestAnimationFrame(() => {
    for (const id of WORD_TILE_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      engine.registerTarget({ id, rect: { x: r.left-20, y: r.top-20, width: r.width+40, height: r.height+40 }, label: id });
    }
  });
}

// Toggle buttons get a much larger hit area so they're easy to fixate on
function headerPad(id: string) {
  return (id === 'btn-toggle-talk' || id === 'btn-toggle-help') ? 52 : 28;
}

function registerHeaderTargets(engine: GazeEngine) {
  for (const id of HEADER_BTN_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const p = headerPad(id);
    engine.registerTarget({ id, rect: { x: r.left - p, y: r.top - p, width: r.width + p * 2, height: r.height + p * 2 }, label: id });
  }
}

function registerTalkTargets(engine: GazeEngine) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  for (const id of ALL_TALK_TILE_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();

    let x      = r.left - 20;
    let y      = r.top  - 20;
    let width  = r.width  + 40;
    let height = r.height + 40;

    if (id === CTRL_SEND) { x = 0; y = 0; width = r.right + 20; height = H; }
    if (id === CTRL_UNDO) { x = r.left - 20; y = 0; width = W - x; height = H; }

    engine.registerTarget({ id, rect: { x, y, width, height }, label: id });
  }

  registerHeaderTargets(engine);
}

function registerHelpTargets(engine: GazeEngine) {
  const H = window.innerHeight;

  // SEND — full-height left column hit area, same as talk mode
  const sendEl = document.getElementById(CTRL_SEND);
  if (sendEl) {
    const r = sendEl.getBoundingClientRect();
    engine.registerTarget({ id: CTRL_SEND, rect: { x: 0, y: 0, width: r.right + 20, height: H }, label: CTRL_SEND });
  }

  for (const t of HELP_TILES) {
    const el = document.getElementById(t.id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    engine.registerTarget({ id: t.id, rect: { x: r.left - 10, y: r.top - 10, width: r.width + 20, height: r.height + 20 }, label: t.label, dwellMs: 2500 });
  }

  registerHeaderTargets(engine);
}

function buildTalkBoard(engine: GazeEngine) {
  const grid = document.getElementById('word-grid')!;
  grid.innerHTML = '';
  grid.classList.remove('help-mode');

  const send = document.createElement('div');
  send.className = 'tile ctrl-tile ctrl-send';
  send.id = CTRL_SEND;
  send.innerHTML = makeTileHTML('SEND ▶');
  grid.appendChild(send);

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
  undo.innerHTML = makeTileHTML('⌫ UNDO');
  grid.appendChild(undo);

  requestAnimationFrame(() => {
    registerTalkTargets(engine);
    refreshWordTiles(engine);
  });
}

function buildHelpBoard(engine: GazeEngine) {
  const grid = document.getElementById('word-grid')!;
  grid.innerHTML = '';
  grid.classList.add('help-mode');

  HELP_TILES.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = `tile help-tile help-tile-${i}`;
    el.id = t.id;
    el.dataset.helpText = t.speech;
    el.innerHTML = makeHelpTileHTML(t.emoji, t.label);
    grid.appendChild(el);
  });

  // SEND sits in the left column (same position as talk mode)
  const send = document.createElement('div');
  send.className = 'tile ctrl-tile ctrl-send';
  send.id = CTRL_SEND;
  send.innerHTML = makeTileHTML('SEND ▶');
  grid.appendChild(send);

  requestAnimationFrame(() => registerHelpTargets(engine));
}

function updateModeToggle() {
  document.getElementById('btn-toggle-talk')!.classList.toggle('active', currentMode === 'talk');
  document.getElementById('btn-toggle-help')!.classList.toggle('active', currentMode === 'help');
}

function switchMode(newMode: 'talk' | 'help', engine: GazeEngine) {
  if (currentMode === newMode) return;
  currentMode = newMode;
  updateModeToggle();
  engine.clearTargets();
  clearAgentResponse();

  // Re-register header buttons IMMEDIATELY after clearTargets so the toggle
  // buttons are never unregistered — prevents the one-frame gap where gaze
  // leaves the toggle mid-dwell and selection is lost.
  registerHeaderTargets(engine);

  if (newMode === 'talk') {
    buildTalkBoard(engine);
    updateDisplay();
  } else {
    buildHelpBoard(engine);
    updateDisplay();
  }
}

// ── Word prediction ───────────────────────────────────────────────────────────

async function refreshWordTiles(engine: GazeEngine) {
  const fallback = getNextWords(composedText);
  setWordTileLabels(fallback, engine, [10, 7, 4, 2]);

  try {
    const res = await fetch(`${AGENT_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: composedText.trim() || '', user_id: USER_ID }),
    });
    if (res.ok) {
      const data = await res.json() as { words?: string[]; weights?: number[] };
      const words   = data.words   ?? [];
      const weights = data.weights ?? [10, 7, 4, 2];
      if (Array.isArray(words) && words.length === 4 && words.some(w => w.trim())) {
        setWordTileLabels(words, engine, weights);
      }
    }
  } catch {
    // keep fallback
  }
}

// ── Select handler ────────────────────────────────────────────────────────────

function handleSelect(id: string, engine: GazeEngine) {
  // Mode select screen
  if (id === 'mode-card-talk' && modeSelectResolve) {
    modeSelectResolve('talk'); modeSelectResolve = null; return;
  }
  if (id === 'mode-card-help' && modeSelectResolve) {
    modeSelectResolve('help'); modeSelectResolve = null; return;
  }

  // Mode toggle on board
  if (id === 'btn-toggle-talk') { switchMode('talk', engine); return; }
  if (id === 'btn-toggle-help') { switchMode('help', engine); return; }

  // Header buttons (back, recalibrate, summary)
  if (HEADER_BTN_IDS.includes(id)) {
    document.getElementById(id)?.click();
    return;
  }

  // Help tiles
  const helpTile = HELP_TILES.find(t => t.id === id);
  if (helpTile) {
    speak(helpTile.speech);
    getState().events.push({ timestamp: Date.now(), type: 'word_select', value: helpTile.speech });
    getState().messages.push(helpTile.speech);
    showAgentResponse(`Speaking: "${helpTile.speech}"`);

    fetch(`${BACKEND_URL}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, message: helpTile.speech, sessionId: SESSION_ID }),
    }).catch(() => {});

    const el = document.getElementById(id);
    if (el) { el.classList.remove('selected'); void el.offsetWidth; el.classList.add('selected'); }
    return;
  }

  // UNDO
  if (id === CTRL_UNDO) {
    const trimmed = composedText.trimEnd();
    const lastSpace = trimmed.lastIndexOf(' ');
    composedText = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace) + ' ';
    getState().events.push({ timestamp: Date.now(), type: 'undo', value: '' });
    updateDisplay();
    refreshWordTiles(engine);
    return;
  }

  // SEND
  if (id === CTRL_SEND) {
    const text = composedText.trim();
    if (!text) return;
    speak(text);
    getState().messages.push(text);
    getState().events.push({ timestamp: Date.now(), type: 'send', value: text });
    showAgentResponse('…');

    fetch(`${BACKEND_URL}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, message: text, sessionId: SESSION_ID }),
    }).catch(() => {});
    fetch(`${BACKEND_URL}/phrases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, text, category: 'sent' }),
    }).catch(() => {});

    fetch(`${AGENT_URL}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [],
        dwell_target_id: text,
        dwell_duration_ms: 1300,
        session_id: SESSION_ID,
        user_id: USER_ID,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { message?: { text?: string; audio_url?: string } } | null) => {
        if (data?.message?.text) {
          showAgentResponse(data.message.text);
          speak(data.message.text);
          if (data.message.audio_url) new Audio(data.message.audio_url).play().catch(() => null);
        } else {
          clearAgentResponse();
        }
      })
      .catch(() => clearAgentResponse());

    composedText = '';
    updateDisplay();
    refreshWordTiles(engine);
    return;
  }

  // Word tiles
  const el = document.getElementById(id) as HTMLElement | null;
  const word = el?.dataset.word;
  if (!word) return;
  clearAgentResponse();
  getState().events.push({ timestamp: Date.now(), type: 'word_select', value: word });
  composedText = (composedText.trimEnd() + ' ' + word + ' ').trimStart();
  updateDisplay();
  refreshWordTiles(engine);
}

// ── Session summary ───────────────────────────────────────────────────────────

function section(title: string, body: string): string {
  if (!body.trim()) return '';
  return `<div class="summary-section"><h3>${title}</h3>${body}</div>`;
}

function renderSummary(s: SessionSummary): string {
  const moments = Array.isArray(s.keyMoments) && s.keyMoments.length > 0
    ? `<ul>${s.keyMoments.map(m => `<li>${m}</li>`).join('')}</ul>`
    : '';

  return [
    section('Emotional Arc',         s.emotionalArc        ? `<p>${s.emotionalArc}</p>`        : ''),
    section('Body Language',          s.bodyLanguage         ? `<p>${s.bodyLanguage}</p>`         : ''),
    section('Communication Quality',  s.communicationQuality ? `<p>${s.communicationQuality}</p>` : ''),
    section('Key Moments',            moments),
    section('Clinical Notes',         s.clinicalNotes        ? `<p>${s.clinicalNotes}</p>`        : ''),
  ].join('');
}

function localFallbackSummary(state: ModeState): SessionSummary {
  const wordSelections = state.events
    .filter(e => e.type === 'word_select')
    .map(e => e.value);
  const totalWords = wordSelections.length;
  const sends = state.events.filter(e => e.type === 'send').length;
  const allMessages = state.messages.length > 0
    ? state.messages
    : wordSelections.length > 0 ? [wordSelections.join(' ')] : [];

  const wordStr  = totalWords === 1 ? '1 word' : `${totalWords} words`;
  const sendStr  = sends === 1     ? '1 message sent' : sends > 1 ? `${sends} messages sent` : 'no full messages sent';
  const qualNote = totalWords > 0
    ? `Patient selected ${wordStr} and ${sendStr} during this session.`
    : '';

  return {
    emotionalArc:        '',   // requires video — omit in local fallback
    bodyLanguage:        '',   // requires video — omit in local fallback
    communicationQuality: qualNote,
    keyMoments: allMessages.slice(0, 4),
    clinicalNotes:       '',   // omit in local fallback
    generatedAt: Date.now(),
  };
}

async function generateSummary(state: ModeState): Promise<SessionSummary> {
  // Include word-select events as messages when SEND was never pressed
  const wordSelections = state.events
    .filter(e => e.type === 'word_select')
    .map(e => e.value);
  const effectiveMessages = state.messages.length > 0
    ? state.messages
    : wordSelections.length > 0 ? [wordSelections.join(' ')] : [];

  if (effectiveMessages.length === 0) return localFallbackSummary(state);

  let videoUrl = '';
  let videoPublicId = '';
  const duration = recorder.isRecording ? Math.round((Date.now() - recorder.startTime) / 1000) : 0;
  const blob = recorder.isRecording ? await recorder.stop() : null;
  if (blob && blob.size > 0) {
    try {
      const upload = await uploadToCloudinary(blob, CLOUDINARY_CLOUD, CLOUDINARY_PRESET);
      videoUrl = upload.secureUrl;
      videoPublicId = upload.publicId;
    } catch {
      // proceed with text-only summary
    }
  }

  const payload: SessionData = {
    userId: USER_ID,
    sessionId: SESSION_ID,
    videoUrl,
    videoPublicId,
    duration,
    events: state.events,
    messagesSent: effectiveMessages,
  };

  try {
    const res = await fetch(`${BACKEND_URL}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[summary] backend returned', res.status);
      return localFallbackSummary(state);
    }
    return await res.json() as SessionSummary;
  } catch (err) {
    console.error('[summary] fetch failed:', err);
    return localFallbackSummary(state);
  }
}

// ── Board launcher ────────────────────────────────────────────────────────────

async function startBoard(engine: GazeEngine): Promise<GazeEngine> {
  composedText = '';

  const cursor = document.getElementById('gaze-cursor')!;
  const debugEl = document.getElementById('gaze-debug')!;
  cursor.style.display = 'block';

  // ── Fixation locking ────────────────────────────────────────────────────────
  // Two-stage filter: EMA (in engine) removes tremor; fixation zone below
  // prevents the cursor drifting when the eye is actually still.
  // Within FIXATION_RADIUS px the cursor barely moves (slow drift-correction).
  // Beyond it, the cursor chases the gaze proportionally fast.
  const FIXATION_RADIUS = 22; // px — dead-zone while fixating
  let curX = window.innerWidth  / 2;
  let curY = window.innerHeight / 2;

  engine.onGaze(pt => {
    const dx = pt.x - curX;
    const dy = pt.y - curY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > FIXATION_RADIUS) {
      // Outside dead-zone — move toward gaze slowly; cap keeps it from leaping on noise
      const speed = Math.min(0.15, Math.max(0.03, (dist - FIXATION_RADIUS) / 300));
      curX += dx * speed;
      curY += dy * speed;
    } else {
      // Inside dead-zone — almost no movement so cursor stays put during fixation
      curX += dx * 0.02;
      curY += dy * 0.02;
    }

    moveCursor(curX, curY);
    debugEl.textContent = `screen x:${Math.round(curX)} y:${Math.round(curY)}`;
  });

  let lastDwellId: string | null = null;

  engine.onDwellProgress((id, progress) => {
    if (lastDwellId && lastDwellId !== id) {
      const prev = document.getElementById(lastDwellId);
      if (prev) {
        const prevFill = prev.querySelector('.ring-fill') as SVGCircleElement | null;
        if (prevFill) prevFill.style.strokeDashoffset = String(CIRC);
        prev.classList.remove('dwelling', 'btn-dwelling');
      }
    }
    lastDwellId = id;

    const el = document.getElementById(id);
    if (!el) return;

    // Header buttons — show btn-dwelling highlight + fill progress bar for toggles
    if (HEADER_BTN_IDS.includes(id)) {
      el.classList.toggle('btn-dwelling', progress > 0);
      if (id === 'btn-toggle-talk' || id === 'btn-toggle-help') {
        const bar = el.querySelector('.toggle-dwell-bar') as HTMLElement | null;
        if (bar) bar.style.transform = `scaleX(${progress})`;
      }
      return;
    }
    // Mode select cards
    if (id === 'mode-card-talk' || id === 'mode-card-help') {
      const fill = el.querySelector('.ring-fill') as SVGCircleElement | null;
      if (fill) fill.style.strokeDashoffset = String(CIRC * (1 - progress));
      el.classList.toggle('dwelling', progress > 0);
      return;
    }
    // Empty word tile — skip ring
    if (el.dataset.word === '' && WORD_TILE_IDS.includes(id)) return;
    const fill = el.querySelector('.ring-fill') as SVGCircleElement | null;
    if (fill) fill.style.strokeDashoffset = String(CIRC * (1 - progress));
    el.classList.toggle('dwelling', progress > 0);
  });

  engine.onSelect((id) => {
    // Mode select cards
    if (id === 'mode-card-talk' || id === 'mode-card-help') {
      handleSelect(id, engine);
      return;
    }
    const el = document.getElementById(id);
    // Skip empty word tiles
    if (el?.dataset.word === '' && WORD_TILE_IDS.includes(id)) return;
    el?.classList.remove('selected');
    void el?.offsetWidth;
    el?.classList.add('selected');
    const fill = el?.querySelector('.ring-fill') as SVGCircleElement | null;
    if (fill) fill.style.strokeDashoffset = String(CIRC);
    el?.classList.remove('dwelling');
    handleSelect(id, engine);
  });

  window.addEventListener('resize', () => {
    engine.clearTargets();
    registerHeaderTargets(engine);
    if (currentMode === 'talk') registerTalkTargets(engine);
    else registerHelpTargets(engine);
  });

  // ── Mode selection screen ─────────────────────────────────────────────────
  showScreen('screen-mode-select');

  requestAnimationFrame(() => {
    for (const cardId of ['mode-card-talk', 'mode-card-help']) {
      const el = document.getElementById(cardId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      engine.registerTarget({ id: cardId, rect: { x: r.left, y: r.top, width: r.width, height: r.height }, label: cardId });
    }
  });

  currentMode = await new Promise<'talk' | 'help'>(resolve => {
    modeSelectResolve = resolve;
    document.getElementById('mode-card-talk')!.addEventListener('click', () => {
      modeSelectResolve = null; resolve('talk');
    }, { once: true });
    document.getElementById('mode-card-help')!.addEventListener('click', () => {
      modeSelectResolve = null; resolve('help');
    }, { once: true });
  });

  // ── Build board for selected mode ─────────────────────────────────────────
  engine.clearTargets();
  showScreen('screen-board');
  updateModeToggle();
  updateDisplay();

  if (currentMode === 'talk') {
    buildTalkBoard(engine);
  } else {
    buildHelpBoard(engine);
  }

  activeEngine = engine;
  return engine;
}

// ── Button wiring ─────────────────────────────────────────────────────────────

let activeEngine: GazeEngine | null = null;

wireKeyboard(() => activeEngine);

function wireButtons(engine: GazeEngine) {
  ['btn-back', 'btn-recalibrate', 'btn-bye', 'btn-toggle-talk', 'btn-toggle-help'].forEach(btnId => {
    const old = document.getElementById(btnId)!;
    const fresh = old.cloneNode(true) as HTMLElement;
    old.parentNode!.replaceChild(fresh, old);
  });

  document.getElementById('btn-back')!.addEventListener('click', () => {
    engine.stop();
    activeEngine = null;
    document.getElementById('gaze-cursor')!.style.display = 'none';
    const btn = document.getElementById('btn-webcam') as HTMLButtonElement;
    btn.textContent = '📷 Start with Webcam →';
    btn.disabled = false;
    talkState.events = []; talkState.messages = []; talkState.summaryPromise = null;
    helpState.events = []; helpState.messages = []; helpState.summaryPromise = null;
    showScreen('screen-landing');
  });

  document.getElementById('btn-recalibrate')!.addEventListener('click', async () => {
    engine.stop();
    showScreen('screen-calibration');
    const newSource = new WebGazerSource();
    const newEngine = new GazeEngine(
      { dwellMs: 1500, confidenceThreshold: 0.5, filterAlpha: 0.08 },
      newSource,
    );
    await newEngine.start();
    showCalibrationVideo();
    await runWebcamCalibration();
    const builtEngine = await startBoard(newEngine);
    wireButtons(builtEngine);
  });

  document.getElementById('btn-bye')!.addEventListener('click', () => {
    const state     = getState();
    console.log('[bye] clicked — events:', state.events.length, 'messages:', state.messages.length);
    const modal     = document.getElementById('summary-modal')!;
    const loadingEl = document.getElementById('summary-loading')!;
    const contentEl = document.getElementById('summary-content')!;

    // Open modal first — nothing after this should block rendering
    modal.classList.remove('hidden');

    const cursor = document.getElementById('gaze-cursor');
    if (cursor) cursor.style.display = 'none';

    try { engine.stop(); } catch (e) { console.warn('[bye] engine.stop threw:', e); }

    loadingEl.classList.add('hidden');

    // Always render something immediately — local fallback is synchronous
    const snapshot = localFallbackSummary(state);
    if (state.events.length === 0 && state.messages.length === 0) {
      contentEl.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px 0;">No activity recorded in ${currentMode} mode yet.</p>`;
    } else {
      contentEl.innerHTML = renderSummary(snapshot);
    }

    // Then try AI analysis in the background
    if (!state.summaryPromise) {
      state.summaryPromise = generateSummary(state);
    }

    loadingEl.classList.remove('hidden');

    state.summaryPromise
      .then(summary => {
        loadingEl.classList.add('hidden');
        if (!modal.classList.contains('hidden')) {
          contentEl.innerHTML = renderSummary(summary);
        }
      })
      .catch(err => {
        console.error('[summary]', err);
        loadingEl.classList.add('hidden');
        // local fallback already showing — nothing to do
      });
  });

  document.getElementById('btn-toggle-talk')!.addEventListener('click', () => {
    switchMode('talk', engine);
  });

  document.getElementById('btn-toggle-help')!.addEventListener('click', () => {
    switchMode('help', engine);
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function wireKeyboard(getEngine: () => GazeEngine | null) {
  window.addEventListener('keydown', (e) => {
    const engine = getEngine();
    if (!engine) return;
    if (document.body.dataset.screen !== 'screen-board') return;
    if (currentMode !== 'talk') return;
    if (e.code === 'Space') {
      e.preventDefault();
      handleSelect(CTRL_SEND, engine);
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault();
      handleSelect(CTRL_UNDO, engine);
    }
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

document.getElementById('btn-close-summary')!.addEventListener('click', () => {
  document.getElementById('summary-modal')!.classList.add('hidden');
  document.getElementById('gaze-cursor')!.style.display = 'block';
  activeEngine?.start();
});

document.getElementById('btn-webcam')!.addEventListener('click', async () => {
  const btn = document.getElementById('btn-webcam') as HTMLButtonElement;
  const setStatus = (msg: string, disabled = true) => {
    btn.textContent = msg;
    btn.disabled = disabled;
  };

  setStatus('Initializing…');

  try {
    // Load WebGazer lazily on first use
    if (!(globalThis as any).webgazer) {
      setStatus('Loading eye tracker…');
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/webgazer@2.1.0/dist/webgazer.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load WebGazer'));
        document.head.appendChild(s);
      });
    }

    const source = new WebGazerSource();
    const engine = new GazeEngine(
      { dwellMs: 1500, confidenceThreshold: 0.5, filterAlpha: 0.08 },
      source,
    );

    setStatus('Starting camera…');
    await engine.start();

    // Grab WebGazer's camera stream for session recording
    await new Promise(r => setTimeout(r, 500));
    const wgVideo = (globalThis as any).webgazer?.getVideoElement?.() as HTMLVideoElement | null;
    const stream = wgVideo?.srcObject as MediaStream | null;
    if (stream) recorder.start(stream);

    showScreen('screen-calibration');
    showCalibrationVideo();
    await runWebcamCalibration();

    const finalEngine = await startBoard(engine);
    wireButtons(finalEngine);

  } catch (err) {
    console.error('Webcam init failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`⚠ ${msg.slice(0, 55)}`, false);
    showScreen('screen-landing');
    setTimeout(() => setStatus('📷 Start with Webcam →', false), 4000);
  }
});
