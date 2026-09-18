# Parmana Agent Guard

> **AI can propose. Real Parmana authorizes. Execution only happens after authorization.**

A focused buildathon MVP showing an AI agent proposing a customer refund while the **real Parmana API** evaluates the action against the deployed `customer-refund@1.0.0` policy.

## Real Parmana flow

```
AI Agent
   |
   | refund proposal
   v
Agent Guard
   |
   | BusinessTransaction
   v
REAL PARMANA API
   |
   | customer-refund@1.0.0
   v
ALLOW / BLOCK
   |
   +---- BLOCK ----> No execution
   |
   +---- ALLOW ----> Mock refund execution
                       |
                       v
                    Evidence
```

The important boundary is that the local demo no longer makes the authorization decision itself. Parmana does.

## Demo scenarios

**1. Allowed**

₹3,500 damaged-order refund → sent to real Parmana → policy approval → mock execution → evidence.

**2. Blocked**

₹7,500 damaged-order refund → sent to real Parmana → policy rejection → no execution.

**3. Direct API attack**

A request attempts to call Agent Guard directly with ₹7,500. The request still goes through the real Parmana authorization boundary before any local execution.

## Setup

Create a local `.env` file:

```env
PORT=3000
PARMANA_API_URL=https://parmana-api-real.vercel.app
PARMANA_API_KEY=your_parmana_demo_key
```

Install and run:

```bash
npm install
npm start
```

Open:

```
http://localhost:3000
```

## Important

The API key is a secret. Do not commit `.env` or paste the key into GitHub.

The real Parmana API expects a `BusinessTransaction` with:

- a real UUID `businessTransactionId`
- `authorityType: SERVICE`
- `principalId: demo` for the demo key
- policy `customer-refund@1.0.0`
- bound `refundAmount` matching `intent.parameters.amount`

The deployed API is documented in the main Parmana repository's `LIVE-API-GUIDE.md`.

## Scope

This is a buildathon MVP. Parmana authorization is real; the final refund connector remains a mock execution so the demo does not move real customer money.

That separation is deliberate:

**Parmana proves whether the action is authorized. The execution adapter performs the authorized action.**
