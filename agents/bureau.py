"""
bureau.py — starts all 6 Catalyst for Care agents as isolated subprocesses.

Each agent runs in its own process so it can use its own Agentverse mailbox key
from .env (e.g. GAZE_AGENT_MAILBOX_KEY, INTENT_AGENT_MAILBOX_KEY, etc.)

Usage:
  cd agents/
  python bureau.py

Press Ctrl-C to stop all agents.
"""

import os
import subprocess
import sys
import time
from dotenv import load_dotenv

load_dotenv()

AGENTS = [
    {
        "name": "GazeInterpretationAgent",
        "script": "gaze_interpretation_agent.py",
        "key_env": "GAZE_AGENT_MAILBOX_KEY",
        "port": 8001,
    },
    {
        "name": "IntentUnderstandingAgent",
        "script": "intent_understanding_agent.py",
        "key_env": "INTENT_AGENT_MAILBOX_KEY",
        "port": 8002,
    },
    {
        "name": "UserProfileMemoryAgent",
        "script": "user_profile_memory_agent.py",
        "key_env": "MEMORY_AGENT_MAILBOX_KEY",
        "port": 8003,
    },
    {
        "name": "EmotionalStateAgent",
        "script": "emotional_state_agent.py",
        "key_env": "EMOTIONAL_AGENT_MAILBOX_KEY",
        "port": 8004,
    },
    {
        "name": "OutputGenerationAgent",
        "script": "output_generation_agent.py",
        "key_env": "OUTPUT_AGENT_MAILBOX_KEY",
        "port": 8005,
    },
    {
        "name": "CommunicationRouterAgent",
        "script": "communication_router_agent.py",
        "key_env": "ROUTER_AGENT_MAILBOX_KEY",
        "port": 8006,
    },
]

AGENTS_DIR = os.path.dirname(os.path.abspath(__file__))


def start_agents():
    print("=" * 60)
    print("Catalyst for Care — Agent Bureau")
    print("=" * 60)

    processes = []

    for agent_cfg in AGENTS:
        key = os.getenv(agent_cfg["key_env"], "")

        # Build a clean env for this agent's process
        env = os.environ.copy()
        if key:
            # Override AGENTVERSE_API_KEY with this agent's specific key
            env["AGENTVERSE_API_KEY"] = key

        script_path = os.path.join(AGENTS_DIR, agent_cfg["script"])
        p = subprocess.Popen(
            [sys.executable, script_path],
            env=env,
            cwd=AGENTS_DIR,
        )

        status = f"mailbox={'enabled' if key else 'disabled (no key set)'}"
        print(f"  ✓ {agent_cfg['name']:<30} port={agent_cfg['port']}  {status}  pid={p.pid}")
        processes.append((agent_cfg["name"], p))

    print("=" * 60)
    if not any(os.getenv(a["key_env"]) for a in AGENTS):
        print("  ⚠  No mailbox keys found in .env — agents run locally only.")
        print("     Set the *_MAILBOX_KEY vars to register on Agentverse.")
    print("Press Ctrl-C to stop all agents.")
    print()

    try:
        while True:
            time.sleep(1)
            # Restart any agent that crashed
            for i, (name, p) in enumerate(processes):
                if p.poll() is not None:
                    print(f"  ↺  {name} exited (code {p.returncode}), restarting...")
                    agent_cfg = AGENTS[i]
                    env = os.environ.copy()
                    key = os.getenv(agent_cfg["key_env"], "")
                    if key:
                        env["AGENTVERSE_API_KEY"] = key
                    script_path = os.path.join(AGENTS_DIR, agent_cfg["script"])
                    new_p = subprocess.Popen(
                        [sys.executable, script_path], env=env, cwd=AGENTS_DIR
                    )
                    processes[i] = (name, new_p)
    except KeyboardInterrupt:
        print("\nStopping all agents...")
        for name, p in processes:
            p.terminate()
            print(f"  ✗ {name} stopped")
        print("Done.")


if __name__ == "__main__":
    start_agents()
