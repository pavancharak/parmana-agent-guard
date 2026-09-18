# Parmana Agent Guard

> **AI can propose. Business policy authorizes. Parmana enforces before execution.**

A focused MVP demonstrating how an AI agent can propose a business action while a server-side authorization layer determines whether that action may actually execute.

## Demo

This prototype uses a customer refund agent.

Policy:

- Standard customers may receive automatic refunds up to ₹5,000.
- Refunds above ₹5,000 require manager approval.
- Only damaged or defective orders are eligible.

### Three scenarios

**1. Allowed**

₹3,500 damaged-order refund → **ALLOWED** → mock refund executes → evidence generated.

**2. Blocked**

₹7,500 damaged-order refund → **BLOCKED** → refund is not executed.

**3. Direct API attack**

A request attempts to call the execution endpoint directly with ₹7,500, bypassing the agent. The server applies the same authorization check and blocks it.

The important property is:

```
AI Agent ──> Authorization ──> Execution
                         ^
Direct API Request ──────┘
```

## Architecture

```
Customer Request
      ↓
   AI Agent
      ↓
Proposed Action
      ↓
Parmana Authorization
      ↓
   ┌──┴──┐
 ALLOW BLOCK
   ↓     ↓
Execute  Evidence
   ↓
Execution Evidence
```

## Run locally

Requires Node.js 20+.

```bash
npm install
npm start
```

Open the URL printed by the server.

## Replit

Import the repository into Replit and run:

```bash
npm install
npm start
```

The application binds to `0.0.0.0` and uses the `PORT` environment variable when provided.

## Scope

This is a buildathon MVP, not a production deployment. It intentionally uses an in-memory evidence store, a local JSON policy, a mock refund system, and no authentication or real payment movement.

## Parmana

Parmana is infrastructure for making sure software follows authorized business decisions and produces evidence of what actually happened.
