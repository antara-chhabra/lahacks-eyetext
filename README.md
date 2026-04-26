# EyeText — Your eyes are the new keyboard.

> **LAHacks 2026**

EyeText is a browser-based Augmentative and Alternative Communication (AAC) system built for patients with ALS, stroke, or other motor decline. Using only a standard webcam and their eyes, patients can select word tiles, build sentences, and have an AI agent speak and respond on their behalf - no special hardware required.

---

## Track Submissions

### Catalyst for Care — Health Innovation
EyeText addresses a critical gap in patient-provider communication. Patients with severe motor impairment lose their ability to speak but retain full cognitive function. Existing AAC devices cost thousands of dollars and require specialist configuration. EyeText runs in any browser, needs only a webcam, and adapts to each patient's communication style over time using AI. A caregiver can sit a tablet in front of a patient and get a full communication session running in under two minutes, with an AI-generated clinical summary at the end of every session.

### Agentverse — Search & Discovery of Agents (Fetch.ai)
Six uAgents are registered on Agentverse and discoverable via ASI:One. They form a multi-agent pipeline that turns a raw gaze dwell event into a spoken, empathetic response:

| Agent | Port | Mailbox Key Env | Role |
|---|---|---|---|
| **GazeIntentAgent** | 8001 | `GAZE_INTENT_AGENT_MAILBOX_KEY` | Interprets which tile was dwelled on and infers the patient's communicative intent using the ASI1 LLM |
| **IntentUnderstandingAgent** | 8002 | `INTENT_AGENT_MAILBOX_KEY` | Decodes intent into a structured request (urgency, category, suggested response) |
| **UserProfileMemoryAgent** | 8003 | `MEMORY_AGENT_MAILBOX_KEY` | Reads and writes per-user communication profiles from MongoDB Atlas; adapts predictions to each patient's vocabulary |
| **EmotionalStateAgent** | 8004 | `EMOTIONAL_AGENT_MAILBOX_KEY` | Tracks the patient's inferred emotional context across the session to colour response tone |
| **OutputGenerationAgent** | 8005 | `OUTPUT_AGENT_MAILBOX_KEY` | Generates the final natural-language response using enriched context from all upstream agents |
| **CommunicationRouterAgent** | 8006 | `ROUTER_AGENT_MAILBOX_KEY` | Orchestrates the pipeline; routes messages between agents and triggers TTS output |

All agents are built with the `uagents` Fetch.ai SDK and communicate over the `chat_protocol`. Each agent is registered on [Agentverse](https://agentverse.ai) with a natural-language capability description, making them discoverable through **ASI:One** — Fetch.ai's unified AI search layer. ASI:One lets any external system find and invoke these agents by intent (e.g. "find an agent that interprets gaze events for AAC patients") without knowing their addresses in advance.

The HTTP Gateway (`agents/http_gateway.py`, port 8000) is a FastAPI server that the browser calls. It receives a tile dwell event and orchestrates the full six-agent pipeline, returning a structured response. The browser never talks directly to individual agents.

### Figma Make Challenge
The full UI was prototyped in Figma before implementation. The design system uses a warm cream palette (`#F7F0E4`) with coral/peach accents (`#E87240`), a clean sans-serif type scale, and components including the landing hero, 7-dot webcam calibration overlay, AAC word tile grid, Talk/Help mode switcher, dwell progress rings, and the session summary modal.

### Cloudinary Company Challenge
Cloudinary powers three aspects of EyeText:

1. **Session video recording**: The patient's webcam stream is recorded via the browser's `MediaRecorder` API and uploaded to Cloudinary at session end (`claudinary-video/src/uploader.ts`). Upload preset `Lahacks` is configured for unsigned video uploads into the `sessions/` folder.
2. **Frame extraction**: `backend/src/lib/claude-analyzer.ts` fetches 8 evenly-spaced JPEG frames from the uploaded video using Cloudinary's on-the-fly URL transformation API: `so_${offsetSec},f_jpg/${publicId}.jpg`.
3. **Multimodal AI summary**: The extracted frames are sent as inline base64 images to Gemini 2.5 Flash alongside the session transcript. The model analyzes facial expressions, posture, eye engagement, and key moments — returning a structured clinical summary displayed to caregivers at session end.

### MLH — Best Use of MongoDB Atlas
MongoDB Atlas stores three collections that power the adaptive communication model:

- **`phrases`**: Every sentence a patient sends is stored and indexed. Atlas Search vector similarity is used by the UserProfileMemoryAgent to surface the words most likely to be useful next — personalized to that patient's actual vocabulary patterns, not generic frequency tables.
- **`session_summaries`**: Gemini-generated session reports (Emotional Arc, Body Language, Clinical Notes, Key Moments) are persisted for caregiver review and longitudinal tracking.
- **`history`**: Every message is logged with timestamps so caregivers can review the full conversation timeline.

---

## Architecture

```
Browser (gaze-engine/demo/)
  │  WebGazer.js — webcam gaze tracking
  │  7-dot calibration → word tile grid
  │  Dwell 1.5s → tile selected
  │
  ├─► POST /predict  ──► agents/http_gateway.py  (port 8000)
  │                          └─► UserProfileMemoryAgent → MongoDB Atlas
  │                               (personalized next-word suggestions)
  │
  ├─► POST /intent   ──► agents/http_gateway.py  (port 8000)
  │                          └─► GazeIntentAgent
  │                               └─► IntentUnderstandingAgent
  │                                    └─► EmotionalStateAgent
  │                                         └─► OutputGenerationAgent
  │                                              └─► CommunicationRouterAgent
  │                                                   (spoken + text response)
  │
  └─► POST /session/end ──► backend/src/server.ts  (port 3001)
                                 ├─► Cloudinary video upload
                                 ├─► Frame extraction (8 JPEG frames)
                                 ├─► Gemini 2.5 Flash multimodal analysis
                                 └─► MongoDB Atlas  (session_summaries)
```

---

## Prerequisites

| Dependency | Minimum Version | Download |
|---|---|---|
| Node.js | 18 | https://nodejs.org |
| npm | 9 | bundled with Node.js |
| Python | 3.10 | https://python.org |
| pip | any | bundled with Python |
| Chrome / Edge | any recent | required for WebGazer + MediaRecorder |

### API Keys & Accounts

| Service | Purpose | Sign up |
|---|---|---|
| MongoDB Atlas | User profiles, history, session summaries | https://cloud.mongodb.com |
| Cloudinary | Video upload & frame extraction | https://cloudinary.com |
| Google Gemini | Session summary AI (model: gemini-2.5-flash) | https://aistudio.google.com |
| ASI1 | Agent LLM backbone | https://asi1.ai |
| Agentverse | Agent registration & mailboxes | https://agentverse.ai |

---

## Installation & Running

> Run all three services simultaneously for the full experience.

### 1. Clone the repo

```bash
git clone https://github.com/antara-chhabra/lahacks-eyetext.git
cd lahacks-eyetext
```

### 2. Backend — Express API (port 3001)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in the values below
npm run dev
```

`backend/.env` required values:
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/catalyst
GEMINI_API_KEY=your_gemini_api_key_here
CLOUDINARY_CLOUD_NAME=dsddkg2x6
PORT=3001
```

### 3. Agents — Fetch.ai pipeline (ports 8000–8006)

```bash
cd agents
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and fill in ASI1_API_KEY and the mailbox keys
```

**Terminal A** — HTTP gateway (the browser calls this):
```bash
python http_gateway.py
```

**Terminal B** — All 6 agents:
```bash
python bureau.py
```

`agents/.env` required values:
```env
ASI1_API_KEY=your_asi1_api_key_here

# Get each key from Agentverse → My Agents → New Agent → Agent Mailbox Key
GAZE_INTENT_AGENT_MAILBOX_KEY=
INTENT_AGENT_MAILBOX_KEY=
MEMORY_AGENT_MAILBOX_KEY=
EMOTIONAL_AGENT_MAILBOX_KEY=
OUTPUT_AGENT_MAILBOX_KEY=
ROUTER_AGENT_MAILBOX_KEY=

BACKEND_URL=http://localhost:3001
```

> Agents run locally without mailbox keys. Set the keys to register them on Agentverse and make them discoverable via ASI:One.

### 4. Gaze Engine / Frontend — Vite dev server (port 5173)

```bash
cd gaze-engine
npm install
npm run demo
```

Open **http://localhost:5173** in Chrome. Grant camera permission when prompted.

---

## Cloudinary Setup

1. Log in to [cloudinary.com](https://cloudinary.com)
2. Go to **Settings → Upload → Upload presets**
3. Create a preset named `Lahacks` with:
   - Signing mode: **Unsigned**
   - Resource type: **Video**
   - Folder: `sessions`

The cloud name `dsddkg2x6` is already set in `gaze-engine/demo/main.ts`. If using your own account, update `CLOUDINARY_CLOUD` in that file and `CLOUDINARY_CLOUD_NAME` in `backend/.env`.

---

## File Structure

```
lahacks-eyetext/
│
├── gaze-engine/                       # Main browser application (Vite + TypeScript)
│   ├── demo/
│   │   ├── index.html                 # App shell + session summary modal
│   │   ├── main.ts                    # Core logic: calibration, board, session lifecycle
│   │   └── style.css                  # Full design system
│   ├── src/                           # @catalyst/gaze-engine library
│   │   ├── index.ts                   # GazeEngine class (public API)
│   │   ├── dwell.ts                   # Dwell detection with per-target dwellMs override
│   │   ├── filter.ts                  # EMA gaze smoothing filter
│   │   ├── calibration.ts             # Calibration profile + IDW correction
│   │   ├── tracker.ts                 # WebGazerSource adapter
│   │   └── types.ts                   # Shared TypeScript interfaces
│   ├── package.json
│   └── vite.demo.config.ts
│
├── agents/                            # Fetch.ai uAgents (Python)
│   ├── http_gateway.py                # FastAPI gateway (port 8000) — browser entry point
│   ├── bureau.py                      # Starts all 6 agents as subprocesses
│   ├── gaze_intent_agent.py           # Tile dwell → patient intent (port 8001)
│   ├── intent_understanding_agent.py  # Intent → structured request (port 8002)
│   ├── user_profile_memory_agent.py   # Per-user vocabulary memory — MongoDB (port 8003)
│   ├── emotional_state_agent.py       # Session emotion tracking (port 8004)
│   ├── output_generation_agent.py     # Final response generation (port 8005)
│   ├── communication_router_agent.py  # Pipeline orchestration + TTS (port 8006)
│   ├── shared/
│   │   ├── models.py                  # Shared Pydantic models
│   │   └── prompts.py                 # Shared LLM prompt templates
│   ├── requirements.txt
│   └── .env.example
│
├── backend/                           # Express + TypeScript REST API (port 3001)
│   ├── src/
│   │   ├── server.ts                  # App entry point + route registration
│   │   ├── routes/
│   │   │   ├── session.ts             # POST /session/end → Cloudinary + Gemini analysis
│   │   │   ├── history.ts             # POST /history — message logging
│   │   │   ├── phrases.ts             # GET/POST /phrases — vocabulary store
│   │   │   ├── users.ts               # User management
│   │   │   └── caregivers.ts          # Caregiver access
│   │   ├── lib/
│   │   │   └── claude-analyzer.ts     # Cloudinary frame fetch + Gemini 2.5 Flash analysis
│   │   └── db/
│   │       ├── client.ts              # MongoDB Atlas connection
│   │       └── indexes.ts             # Atlas Search vector indexes
│   ├── package.json
│   └── .env.example
│
├── claudinary-video/                  # Shared browser recording + upload utilities
│   └── src/
│       ├── recorder.ts                # MediaRecorder wrapper (SessionRecorder class)
│       ├── uploader.ts                # Cloudinary unsigned video upload
│       └── types.ts                   # SessionEvent, SessionData, SessionSummary
│
├── cloudinary-assets/                 # Cloudinary asset management scripts
│   ├── src/
│   │   ├── upload.js                  # Bulk SVG icon upload to Cloudinary
│   │   ├── manifest-builder.js        # Tile manifest generation
│   │   └── theme-presets.js           # Visual theme configuration
│   └── source-icons/                  # SVG icon source files (actions, feelings, needs…)
│
├── shared/                            # Cross-service contracts
│   ├── api-contract.md                # REST API documentation
│   ├── models.ts                      # Shared TypeScript types
│   └── models.py                      # Shared Python types
│
└── README.md
```

---

## User Flow

1. **Landing** — Patient or caregiver opens the app and clicks "Start with Webcam"
2. **Calibration** — 7 orange dots appear around the screen. Patient looks at each dot and clicks it. WebGazer trains its gaze regression model from the 7 click+gaze pairs. After the last dot, the model is frozen (mouse events are removed) so subsequent cursor movement cannot bias predictions.
3. **Board** — An AAC word tile grid appears. The patient looks at a tile and holds their gaze for 1.5 seconds — a progress ring fills, then the tile fires.
4. **Talk mode** — Select words to compose a sentence. Dwell on SEND to speak it aloud. The AI agent pipeline generates a contextual response displayed on screen.
5. **Help mode** — Larger one-touch tiles for urgent needs (Pain, Help, Water, Nurse, etc.) with a longer 2.5-second dwell to prevent accidental activation.
6. **Session Summary** — Click the "Summary" button. The webcam recording is uploaded to Cloudinary, 8 frames are extracted, and Gemini 2.5 Flash analyzes facial expressions alongside the session transcript to produce a structured clinical report for caregivers.

---

## Key Technical Decisions

- **WebGazer over MediaPipe**: WebGazer's click-training model requires no ML model download and calibrates in seconds for non-technical users. The regression model is frozen after the 7-dot calibration sequence to eliminate mouse-position bias.
- **Fixation dead-zone (22 px)**: Gaze noise below 22 px is suppressed so the cursor stays still when the patient's eyes are stationary — critical for reducing fatigue.
- **Per-target dwell time**: Help tiles use 2500 ms vs 1500 ms for word tiles. Larger hit areas warrant longer confirmation to prevent accidental triggers.
- **Local summary fallback**: The session summary modal renders a local activity report instantly on click (word count, messages sent, key moments), then updates in-place with the AI-generated clinical analysis once Gemini responds.
- **MongoDB vector search**: Phrase predictions use Atlas Search semantic similarity rather than word frequency, so next-word suggestions adapt to each patient's actual vocabulary over time.

---

## Built by
Antara, Sujal, Sachin, Harshini at LAHacks 2026
