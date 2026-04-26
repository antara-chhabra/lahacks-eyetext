"""
http_gateway.py — FastAPI HTTP gateway for the Catalyst for Care agent pipeline.

Exposes POST /intent for the frontend (gaze-engine → agents → RouteDecision).
Orchestrates the 6-agent pipeline directly via ASI1 API for reliability,
while the bureau.py agents are registered on Agentverse for ASI:One discoverability.

Usage:
  python http_gateway.py          # starts on :8000
  uvicorn http_gateway:app --reload --port 8000
"""

import asyncio
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))

from shared.models import (
    GazePoint,
    GazeSequence,
    GeneratedMessage,
    Intent,
    RouteDecision,
)
from shared.prompts import (
    EMOTIONAL_STATE_SYSTEM,
    GAZE_INTERPRETATION_SYSTEM,
    INTENT_UNDERSTANDING_SYSTEM,
    MEMORY_SYSTEM,
    OUTPUT_GENERATION_SYSTEM,
    ROUTER_SYSTEM,
)

load_dotenv()

ASI1_API_KEY = os.getenv("ASI1_API_KEY", "")
asi1 = AsyncOpenAI(api_key=ASI1_API_KEY, base_url="https://api.asi1.ai/v1")

MODEL = "asi1-mini"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


async def _call_asi1(system: str, user: str, temperature: float = 0.2) -> dict:
    resp = await asi1.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
    )
    return json.loads(_strip_fences(resp.choices[0].message.content))


# ── Pipeline steps (mirrors each agent's core logic) ─────────────────────────

async def step_gaze(tile_id: str, dwell_ms: int, user_id: str) -> dict:
    return await _call_asi1(
        GAZE_INTERPRETATION_SYSTEM,
        json.dumps({"tile_id": tile_id, "dwell_duration_ms": dwell_ms, "user_id": user_id}),
    )


async def step_intent(tile_id: str, interpreted_text: str, user_id: str) -> dict:
    return await _call_asi1(
        INTENT_UNDERSTANDING_SYSTEM,
        json.dumps({"tile_id": tile_id, "interpreted_text": interpreted_text, "user_id": user_id}),
    )


_PROFILES = {
    "demo-1": {
        "user_name": "John Davis", "user_age": 72, "user_diagnosis": "ALS",
        "preferred_voice_id": "EXAVITQu4vr4xnSDxMaL",
        "caregivers": [
            {"id": "cg-001", "name": "Mary Davis", "relationship": "daughter",
             "phone": "+12125550101", "notify_urgency_gte": 4},
        ],
    },
    "demo-2": {
        "user_name": "Margaret Chen", "user_age": 68, "user_diagnosis": "stroke recovery",
        "preferred_voice_id": "",
        "caregivers": [
            {"id": "cg-003", "name": "David Chen", "relationship": "son",
             "phone": "+13105550303", "notify_urgency_gte": 4},
        ],
    },
}

_DEFAULT = {"user_name": "Patient", "user_age": 0, "user_diagnosis": "",
            "preferred_voice_id": "", "caregivers": []}


async def step_memory(user_id: str, tile_id: str, intent_label: str) -> dict:
    profile = _PROFILES.get(user_id, _DEFAULT)
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{os.getenv('BACKEND_URL', 'http://localhost:3001')}/users/{user_id}/profile")
            if r.status_code == 200:
                data = r.json()
                profile = {
                    "user_name": data.get("name", "Patient"),
                    "user_age": data.get("age", 0),
                    "user_diagnosis": data.get("diagnosis", ""),
                    "preferred_voice_id": data.get("preferred_voice_id", ""),
                    "caregivers": data.get("caregivers", []),
                }
    except Exception:
        pass
    return profile


async def step_emotional(tile_id: str, intent_category: str, intent_label: str,
                          urgency: int, dwell_ms: int) -> dict:
    _EMERGENCY = {"PAIN", "HELP", "STOP"}
    if tile_id in _EMERGENCY:
        return {"emotional_state": "emergency" if tile_id in {"HELP", "STOP"} else "distressed",
                "urgency_override": 5, "notes": "auto-escalated"}
    return await _call_asi1(
        EMOTIONAL_STATE_SYSTEM,
        json.dumps({"tile_id": tile_id, "intent_category": intent_category,
                    "intent_label": intent_label, "urgency": urgency,
                    "dwell_duration_ms": dwell_ms}),
    )


async def step_output(tile_id: str, intent_label: str, urgency: int,
                       emotional_state: str, user_name: str, user_diagnosis: str,
                       caregiver_info: str) -> dict:
    caregivers = json.loads(caregiver_info) if caregiver_info else []
    cg_names = ", ".join(f"{c.get('name')} ({c.get('relationship')})" for c in caregivers) or "caregiver"
    return await _call_asi1(
        OUTPUT_GENERATION_SYSTEM,
        json.dumps({"tile_id": tile_id, "intent_label": intent_label,
                    "urgency": urgency, "emotional_state": emotional_state,
                    "user_name": user_name, "user_diagnosis": user_diagnosis,
                    "caregiver_names": cg_names}),
        temperature=0.4,
    )


def _route_deterministic(urgency: int, emotional_state: str) -> list[str]:
    if urgency >= 5 or emotional_state == "emergency":
        return ["tts", "sms", "dashboard", "emergency"]
    if urgency >= 4:
        return ["tts", "sms", "dashboard"]
    return ["tts", "dashboard"]


async def step_router(generated_text: str, urgency: int, emotional_state: str,
                       user_name: str, caregiver_info: str) -> dict:
    destinations = _route_deterministic(urgency, emotional_state)
    caregivers = json.loads(caregiver_info) if caregiver_info else []
    recipients = [c["phone"] for c in caregivers
                  if c.get("notify_urgency_gte", 4) <= urgency and c.get("phone")]
    sms_sent = bool(recipients) and "sms" in destinations
    if sms_sent:
        for phone in recipients:
            print(f"[SMS stub] → {phone}: {generated_text}")
    return {"destinations": destinations, "sms_sent": sms_sent}


# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Catalyst for Care — HTTP Gateway started on :8000")
    yield

app = FastAPI(
    title="Catalyst for Care — Agent Gateway",
    description="Routes gaze input through the 6-agent pipeline and returns a RouteDecision.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GazeRequest(BaseModel):
    points: list = []
    dwell_target_id: str
    dwell_duration_ms: int = 1200
    session_id: str = ""
    user_id: str = "demo-1"


@app.post("/intent", response_model=dict)
async def handle_intent(req: GazeRequest):
    """
    Full 6-agent pipeline:
    GazeInterpretation → IntentUnderstanding → UserProfileMemory
    → EmotionalState → OutputGeneration → CommunicationRouter
    """
    session_id = req.session_id or str(uuid4())
    tile_id = req.dwell_target_id.upper()

    try:
        # Step 1 — GazeInterpretationAgent
        gaze_result = await step_gaze(tile_id, req.dwell_duration_ms, req.user_id)
        interpreted_text = gaze_result.get("interpreted_text", f"selected {tile_id}")

        # Step 2 — IntentUnderstandingAgent
        intent_result = await step_intent(tile_id, interpreted_text, req.user_id)
        intent_category = intent_result.get("category", "need")
        intent_label = intent_result.get("label", interpreted_text)
        urgency = int(intent_result.get("urgency", 2))

        # Step 3 — UserProfileMemoryAgent
        profile = await step_memory(req.user_id, tile_id, intent_label)
        user_name = profile.get("user_name", "Patient")
        caregiver_info = json.dumps(profile.get("caregivers", []))

        # Step 4 — EmotionalStateAgent
        emotional_result = await step_emotional(
            tile_id, intent_category, intent_label, urgency, req.dwell_duration_ms
        )
        emotional_state = emotional_result.get("emotional_state", "calm")
        override = int(emotional_result.get("urgency_override", 0))
        if override > 0:
            urgency = override

        # Step 5 — OutputGenerationAgent
        output_result = await step_output(
            tile_id, intent_label, urgency, emotional_state,
            user_name, profile.get("user_diagnosis", ""), caregiver_info,
        )
        generated_text = output_result.get("text", f"{user_name} needs {tile_id.lower()}")

        # Step 6 — CommunicationRouterAgent
        routing = await step_router(generated_text, urgency, emotional_state,
                                     user_name, caregiver_info)

        # Assemble RouteDecision
        intent_obj = Intent(
            category=intent_category,
            label=intent_label,
            urgency=urgency,
            tile_id=tile_id,
            user_id=req.user_id,
            session_id=session_id,
        )
        gen_msg = GeneratedMessage(
            text=generated_text,
            source_intent=intent_obj,
            voice_id=profile.get("preferred_voice_id") or None,
        )
        route_decision = RouteDecision(
            message=gen_msg,
            destinations=routing["destinations"],
            sms_sent=routing["sms_sent"],
            routed_at=int(time.time() * 1000),
        )

        return route_decision.model_dump()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PredictRequest(BaseModel):
    prefix: str = ""   # single letter, e.g. "H"
    context: str = ""  # current composed text, e.g. "I WANT"


@app.post("/predict", response_model=dict)
async def predict_words(req: PredictRequest):
    """
    Given a starting letter (prefix) or current sentence context, return 4
    word/phrase completions using the ASI1 LLM.
    """
    if req.prefix:
        prompt = (
            f"The user started typing with the letter '{req.prefix.upper()}'. "
            f"Suggest exactly 4 short words or phrases an ALS/stroke patient might want to say "
            f"that start with '{req.prefix.upper()}'. "
            f"Reply with ONLY a JSON array of 4 strings, no explanation. Example: [\"HI\", \"HELLO\", \"HELP\", \"HOW ARE YOU\"]"
        )
    else:
        prompt = (
            f"The patient has typed: \"{req.context.strip()}\". "
            f"Suggest exactly 4 short words or phrases that naturally follow. "
            f"Reply with ONLY a JSON array of 4 strings, no explanation. Example: [\"PLEASE\", \"NOW\", \"MORE\", \"THANK YOU\"]"
        )

    try:
        resp = await asi1.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": (
                    "You are an AAC (Augmentative and Alternative Communication) word predictor "
                    "for people with ALS, stroke, or motor decline. "
                    "Always respond with ONLY a valid JSON array of exactly 4 strings. "
                    "Keep each item under 4 words. Use ALL CAPS."
                )},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        raw = _strip_fences(resp.choices[0].message.content)
        words = json.loads(raw)
        if isinstance(words, list):
            return {"words": [str(w).upper()[:30] for w in words[:4]]}
        raise ValueError("not a list")
    except Exception as e:
        print(f"[predict] fallback due to: {e}")
        return {"words": []}


@app.get("/health")
async def health():
    return {"status": "ok", "agents": 6, "timestamp": int(time.time() * 1000)}


@app.get("/agents")
async def list_agents():
    """Returns the Agentverse addresses of all 6 registered agents."""
    from uagents import Agent as _A
    seeds = {
        "GazeInterpretationAgent": os.getenv("GAZE_AGENT_SEED", "catalyst-gaze-seed-001"),
        "IntentUnderstandingAgent": os.getenv("INTENT_AGENT_SEED", "catalyst-intent-seed-001"),
        "UserProfileMemoryAgent": os.getenv("MEMORY_AGENT_SEED", "catalyst-memory-seed-001"),
        "EmotionalStateAgent": os.getenv("EMOTIONAL_AGENT_SEED", "catalyst-emotional-seed-001"),
        "OutputGenerationAgent": os.getenv("OUTPUT_AGENT_SEED", "catalyst-output-seed-001"),
        "CommunicationRouterAgent": os.getenv("ROUTER_AGENT_SEED", "catalyst-router-seed-001"),
    }
    return {
        name: _A(name=name.lower().replace(" ", "-"), seed=seed).address
        for name, seed in seeds.items()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
