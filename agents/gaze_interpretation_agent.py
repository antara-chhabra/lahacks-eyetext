from datetime import datetime
from uuid import uuid4
import os

from dotenv import load_dotenv
load_dotenv()

_mailbox_key = os.getenv("GAZE_AGENT_MAILBOX_KEY", "")
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
    name="gaze-interpretation-agent",
    seed=os.getenv("GAZE_AGENT_SEED", "catalyst-gaze-seed-001"),
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

    response = "Something went wrong — unable to interpret gaze input."
    try:
        r = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
You are the GazeInterpretationAgent for Catalyst for Care — an assistive communication
system for people with ALS, stroke, or motor decline who communicate by looking at tiles.

Your job: interpret what tile the user selected and describe what they are trying to communicate.

Tile categories:
- needs: WATER, FOOD, BATHROOM, PAIN, MEDICATION, HOT, COLD, SLEEP
- people: FAMILY, CAREGIVER, DOCTOR, NURSE, DAUGHTER, SON
- feelings: HAPPY, SAD, TIRED, SCARED, FRUSTRATED
- responses: YES, NO, MAYBE, THANK_YOU, PLEASE
- actions: HELLO, GOODBYE, HELP, CALL, STOP

If given a tile ID (e.g. "WATER"), respond with a plain English interpretation of what the
patient is communicating, e.g. "The patient wants water."

If asked what you do, explain your role in the pipeline clearly.
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
