from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from uagents import Model


# ── Shared domain models (mirrors /shared/models.py) ─────────────────────────

class GazePoint(BaseModel):
    x: float
    y: float
    confidence: float
    timestamp: int

class GazeSequence(BaseModel):
    points: list[GazePoint]
    dwell_target_id: str
    dwell_duration_ms: int
    session_id: str
    user_id: str

class Intent(BaseModel):
    category: str   # need | greeting | emergency | social | response
    label: str
    urgency: int    # 1–5
    tile_id: str
    user_id: str
    session_id: str

class PhrasePrediction(BaseModel):
    phrase_id: str
    text: str
    similarity: float
    last_used: Optional[int] = None

class GeneratedMessage(BaseModel):
    text: str
    source_intent: Intent
    similar_phrases: list[PhrasePrediction] = Field(default_factory=list)
    voice_id: Optional[str] = None
    audio_url: Optional[str] = None

class RouteDecision(BaseModel):
    message: GeneratedMessage
    destinations: list[str]
    sms_sent: bool
    audio_url: Optional[str] = None
    routed_at: int

class Caregiver(BaseModel):
    id: str
    name: str
    relationship: str
    phone: str
    notify_urgency_gte: int = 4

class UserProfile(BaseModel):
    id: str
    name: str
    age: int
    diagnosis: Optional[str] = None
    preferred_voice_id: Optional[str] = None
    preferred_theme: str = "standard"
    caregivers: list[Caregiver] = Field(default_factory=list)


# ── Pipeline message types (uAgents Model — for inter-agent messaging) ────────

class PipelineContext(Model):
    """Grows as it passes through each agent in the pipeline."""
    request_id: str
    user_id: str
    session_id: str
    tile_id: str
    dwell_duration_ms: int
    gateway_address: str

    # Filled by GazeInterpretationAgent
    interpreted_text: str = ""

    # Filled by IntentUnderstandingAgent
    intent_category: str = ""
    intent_label: str = ""
    urgency: int = 1

    # Filled by UserProfileMemoryAgent
    user_name: str = ""
    user_age: int = 0
    user_diagnosis: str = ""
    caregiver_info: str = ""          # JSON string of caregivers list
    preferred_voice_id: str = ""

    # Filled by EmotionalStateAgent
    emotional_state: str = "calm"     # calm | distressed | confused | urgent
    urgency_override: int = 0         # non-zero overrides intent urgency

    # Filled by OutputGenerationAgent
    generated_text: str = ""

    # Filled by CommunicationRouterAgent
    destinations: str = ""            # comma-separated: tts,sms,dashboard,emergency
    sms_sent: bool = False
    audio_url: str = ""
    routed_at: int = 0


class PipelineResult(Model):
    """Sent from CommunicationRouterAgent back to the gateway coordinator."""
    request_id: str
    success: bool
    route_decision_json: str          # JSON-serialised RouteDecision
    error: str = ""
