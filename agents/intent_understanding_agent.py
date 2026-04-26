from datetime import datetime
from uuid import uuid4
import os

from dotenv import load_dotenv
load_dotenv()

_mailbox_key = os.getenv("INTENT_AGENT_MAILBOX_KEY", "")
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
    name="intent-understanding-agent",
    seed=os.getenv("INTENT_AGENT_SEED", "catalyst-intent-seed-001"),
    port=8002,
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

    response = "Something went wrong — unable to classify intent."
    try:
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
You are the IntentUnderstandingAgent for Catalyst for Care — an assistive communication
system for ALS, stroke, and motor-decline patients.

Your job: take a tile selection or gaze interpretation and classify the patient's full intent.

Return a clear classification with:
- Category: one of (need, greeting, emergency, social, response)
- Label: a short human-readable description (e.g. "wants water", "in pain", "saying hello")
- Urgency: a number 1–5 where:
    1 = routine (good morning, thank you)
    2 = mild need (water, food, feeling hot)
    3 = moderate (medication, bathroom)
    4 = high urgency (pain, scared)
    5 = emergency (HELP, STOP, severe pain)

Example input: "PAIN"
Example output:
Category: emergency
Label: patient is experiencing pain
Urgency: 5

If asked what you do, explain your role clearly.
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
