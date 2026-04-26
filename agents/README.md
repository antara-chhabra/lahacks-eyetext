# Catalyst for Care — Fetch.ai Agent Pipeline

Four uAgents registered on Agentverse, discoverable via ASI:One.
Each agent handles one step of the assistive communication pipeline for ALS/stroke patients.

> **Note:** Agentverse has a limit of 4 agents per account. The original 6-agent design has been
> compressed into 4 by merging related roles.

---

## What each agent does

| Agent file | Agent name on Agentverse | Role |
|---|---|---|
| `gaze_intent_agent.py` | `gaze-intent-agent` | Reads the tile the patient selected and classifies intent + urgency (1–5) |
| `user_context_agent.py` | `user-context-agent` | Looks up the patient's profile and detects their emotional state |
| `output_generation_agent.py` | `output-generation-agent` | Generates a warm, personalised 1–2 sentence message from the intent |
| `communication_router_agent.py` | `communication-router-agent` | Decides where to deliver the message (TTS / dashboard / SMS / emergency) |

### Pipeline flow
```
Patient looks at tile (e.g. PAIN)
         │
         ▼
gaze-intent-agent       → "patient is in pain", category=emergency, urgency=5
         │
         ▼
user-context-agent      → John Davis, ALS, emotional_state=distressed
         │
         ▼
output-generation-agent → "URGENT: John is in pain and needs immediate attention."
         │
         ▼
communication-router    → TTS + dashboard + SMS + emergency alert
```

Each agent also responds to direct ASI:One chat messages independently.

---

## Step 1 — Install packages

```bash
source ../fetch-ai-project/venv/bin/activate
pip install uagents python-dotenv fastapi
```

---

## Step 2 — Register agents on Agentverse

Go to **https://agentverse.ai** and sign in.

Repeat for each of the 4 agents:

1. Click **My Agents** → **+ Launch an Agent**
2. Select **External Integration**
3. Enter the agent name exactly as shown in the table above
4. Click **Connect Agent**
5. Copy the **Agent Mailbox Key**
6. Paste it into your `.env` (see Step 3)

> **Important:** Agentverse has a **4-agent limit** per account. Do not create more than 4.

---

## Step 3 — Set up your `.env`

```bash
cp .env.example .env
```

Fill in the keys:

```env
ASI1_API_KEY=sk_58a1aa500d7d4b4699264da1d2763a70455ce53b6d4d41f5a2c28aa06824cff0

GAZE_INTENT_AGENT_MAILBOX_KEY=eyJ0...      ← from Agentverse
USER_CONTEXT_AGENT_MAILBOX_KEY=eyJ0...    ← from Agentverse
OUTPUT_AGENT_MAILBOX_KEY=eyJ0...          ← from Agentverse
ROUTER_AGENT_MAILBOX_KEY=eyJ0...          ← from Agentverse
```

---

## Step 4 — Run the agents

Each agent runs independently in its own terminal. Edit one → restart only that one.

```bash
# Terminal 1
cd agents/
python3 gaze_intent_agent.py

# Terminal 2
cd agents/
python3 user_context_agent.py

# Terminal 3
cd agents/
python3 output_generation_agent.py

# Terminal 4
cd agents/
python3 communication_router_agent.py
```

---

## Step 5 — Run the HTTP gateway

The gateway bridges the gaze engine frontend to the agent pipeline.

```bash
# Terminal 5
cd agents/
python3 http_gateway.py
```

Gateway runs at **http://localhost:8000**

---

## Step 6 — Verify on Agentverse

After running all agents for ~30 seconds:

1. Go to **https://agentverse.ai/agents**
2. All 4 agents should appear as **Active** with **ASI Available** and **Mailbox** badges
3. Click each → copy the profile URL for Devpost submission

---

## Step 7 — Modify an agent

Just edit the file and restart that one terminal. No need to touch Agentverse.

```bash
# Example: update gaze_intent_agent.py, then restart:
python3 gaze_intent_agent.py
```

The agent's identity is tied to its **seed** in `.env`. As long as the seed doesn't change,
Agentverse recognises it as the same agent — no re-registration needed.

---

## Eye tracker integration

The gaze engine (`gaze-engine/`) fires tile selections via `engine.onSelect`. When the user
selects **SEND**, the composed text is posted to the gateway:

```typescript
// gaze-engine/demo/main.ts — handleSelect, CTRL_SEND branch
fetch('http://localhost:8000/intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dwell_target_id: composedText.trim(),  // e.g. "I NEED WATER"
    dwell_duration_ms: 1200,
    user_id: 'demo-1',
  }),
})
.then(r => r.json())
.then(result => speak(result.message.text));
```

The gateway at `/intent` runs the full pipeline and returns the generated message.
The frontend speaks it via the Web Speech API.

**To wire this up**, replace the existing `/phrases/speak` call in `main.ts` with the
`/intent` call above.

---

## Testing the pipeline directly

```bash
# Routine request (urgency 2 — TTS + dashboard)
curl -X POST http://localhost:8000/intent \
  -H "Content-Type: application/json" \
  -d '{"dwell_target_id": "WATER", "dwell_duration_ms": 1350, "user_id": "demo-1"}'

# Emergency (urgency 5 — TTS + SMS + dashboard + alert)
curl -X POST http://localhost:8000/intent \
  -H "Content-Type: application/json" \
  -d '{"dwell_target_id": "PAIN", "dwell_duration_ms": 2000, "user_id": "demo-1"}'

# Health check
curl http://localhost:8000/health
```

---

## File structure

```
agents/
├── README.md
├── .env.example
├── .env                           ← fill in after Agentverse registration
├── gaze_intent_agent.py           ← Agent 1: gaze + intent (port 8001)
├── user_context_agent.py          ← Agent 2: user profile + emotion (port 8002)
├── output_generation_agent.py     ← Agent 3: message generation (port 8003)
├── communication_router_agent.py  ← Agent 4: routing (port 8004)
└── http_gateway.py                ← FastAPI bridge to gaze frontend (port 8000)
```

---

## Devpost checklist (Fetch.ai track)

- [ ] `.env` filled in with ASI1 key + 4 mailbox keys
- [ ] All 4 agents running in separate terminals
- [ ] All 4 agents appear as Active on Agentverse with Mailbox badge
- [ ] 4 Agentverse profile URLs copied
- [ ] ASI:One demo done — shared chat URL copied
- [ ] `http_gateway.py` running — gaze frontend sends to `/intent`
- [ ] GitHub repo is public
