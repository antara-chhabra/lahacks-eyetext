from datetime import datetime
from uuid import uuid4
import os

from dotenv import load_dotenv
load_dotenv()

_mailbox_key = os.getenv("GAZE_INTENT_AGENT_MAILBOX_KEY", "")
if _mailbox_key:
    os.environ["AGENTVERSE_API_KEY"] = _mailbox_key

from openai import OpenAI
from uagents import Context, Protocol, Agent
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

ASI1_API_KEY = os.getenv("ASI1_API_KEY", "sk_58a1aa500d7d4b4699264da1d2763a70455ce53b6d4d41f5a2c28aa06824cff0")

client = OpenAI(
    base_url="https://api.asi1.ai/v1",
    api_key=ASI1_API_KEY,
)

agent = Agent(
    name="gaze-intent-agent",
    seed=os.getenv("GAZE_INTENT_AGENT_SEED", "catalyst-gaze-intent-seed-001"),
    port=8001,
    mailbox=True,
    publish_agent_details=True,
)

protocol = Protocol(spec=chat_protocol_spec)


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(
        sender,
        ChatAcknowledgement(timestamp=datetime.now(), acknowledged_msg_id=msg.msg_id),
    )

    text = ""
    for item in msg.content:
        if isinstance(item, TextContent):
            text += item.text

    response = "Something went wrong — unable to interpret input."
    try:
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
You are the GazeIntentAgent for Catalyst for Care — an assistive communication
system for ALS, stroke, and motor-decline patients who communicate by looking at tiles.

You combine two roles:
1. Gaze Interpretation: translate a tile selection into plain English
2. Intent Classification: determine the patient's intent, category, and urgency

Tile categories:
- needs: WATER, FOOD, BATHROOM, PAIN, MEDICATION, HOT, COLD, SLEEP
- people: FAMILY, CAREGIVER, DOCTOR, NURSE, DAUGHTER, SON
- feelings: HAPPY, SAD, TIRED, SCARED, FRUSTRATED
- responses: YES, NO, MAYBE, THANK_YOU, PLEASE
- actions: HELLO, GOODBYE, HELP, CALL, STOP

For each input, respond with:
- Interpretation: plain English description of what the patient wants
- Category: one of (need, greeting, emergency, social, response)
- Label: short description (e.g. "wants water", "in pain", "saying hello")
- Urgency: 1–5 where 1=routine, 5=emergency

Example input: "PAIN"
Example output:
Interpretation: The patient is experiencing pain and needs immediate attention.
Category: emergency
Label: patient is in pain
Urgency: 5

If asked what you do, explain both roles clearly.
                    """,
                },
                {"role": "user", "content": text},
            ],
            max_tokens=512,
        )
        response = str(r.choices[0].message.content)
    except Exception:
        ctx.logger.exception("Error querying ASI1")

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.utcnow(),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=response),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()
