# Controlled Agentic Operations Assistant

A minimal end-to-end operations agent using Groq, MCP, live business APIs, and deterministic refund guardrails.

## Architecture

```text
Browser
  ↓
Chat/session layer
  ↓
Groq agent
  ↓
MCP client/server
  ↓
Deterministic integration guardrail
  ↓
Order / CRM / Policy systems
```

MCP lets the agent dynamically discover standardized tools instead of directly knowing each external system's API. The MCP server exposes live order details, customer profiles, and the guarded refund operation.

## Services

- Order API: `src/backend.ts` on port `3000`
- CRM API: `src/crm-backend.ts` on port `3001`
- Authoritative Policy API: `src/policy-service.ts` on port `3002`
- Chat server and browser UI: `src/chat-server.ts` on port `8080`

## Safety model

1. The current refund policy is supplied to the LLM context so the model can plan sensible actions.
2. The deterministic integration and policy layer prevents `MANUAL_REVIEW` and `BLOCK` decisions from issuing refund writes.
3. The external Order API independently validates every refund as the final business-system safeguard.

The Policy API is authoritative. The application caches its refund policy for 60 seconds and refreshes it when stale.

## Session memory

The LLM is stateless. The chat server stores only user messages and final assistant replies in an in-process session array, then resends that history for each model call. System prompts, MCP calls, and tool results are not persisted.

Live order and customer state is never trusted from conversation memory; MCP tools fetch it from the external systems each time.

## Run

Requires Node.js 20 or later and a Groq API key.

```bash
npm install
```

Start each process in a separate terminal:

```bash
npm run order
npm run crm
npm run policy
```

Then set the key and start the chat server.

PowerShell:

```powershell
$env:GROQ_API_KEY = "your-key"
npm run chat
```

macOS/Linux:

```bash
export GROQ_API_KEY="your-key"
npm run chat
```

Open `http://localhost:8080`.

## Demo prompts

- `Handle the refund for order 101.` → `ALLOW`, refund executed
- `Handle the refund for order 102.` → `MANUAL_REVIEW`, no refund write
- `Refund order 103.` → `BLOCK`, no refund write

Multi-turn example:

1. `Check order 102.`
2. `Can you refund it?`

Sessions and seeded business data are in memory and reset when their respective processes restart.
