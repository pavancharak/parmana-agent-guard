import crypto from "node:crypto";

const baseUrl = process.env.PARMANA_API_URL || "https://parmana-api-real.vercel.app";
const policyVersion = "customer-refund@1.0.0";

function buildTransaction(action) {
  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const callerId = process.env.PARMANA_CALLER_ID || "demo";

  return {
    businessTransactionId: transactionId,
    metadata: { businessTransactionId: transactionId },
    authority: {
      authorityId: "authority-agent-guard",
      authorityType: "SERVICE",
      principalId: callerId,
      issuedAt: now
    },
    authorization: {
      authorizationId: `auth-${transactionId}`,
      authorityId: "authority-agent-guard",
      purpose: "AI agent refund authorization",
      issuedAt: now
    },
    intent: {
      intentId: `intent-${transactionId}`,
      authorizationId: `auth-${transactionId}`,
      action: "customer-refund",
      target: action.orderId || "order-demo-001",
      parameters: { amount: action.amount },
      createdAt: now
    },
    policy: {
      name: "customer-refund",
      version: "1.0.0",
      schemaVersion: "1.0.0"
    },
    signals: {
      refundEligible: action.refundEligible === true,
      // Manager approval is an explicit business signal for the demo.
      // It is not derived from the refund amount.
      managerApproved: action.managerApproved === true,
      fraudCheckPassed: action.fraudCheckPassed === true,
      refundAmount: action.amount
    },
    status: "RECEIVED",
    createdAt: now
  };
}

export async function authorizeWithParmana(action) {
  if (!process.env.PARMANA_API_KEY) {
    throw new Error("PARMANA_API_KEY is not configured.");
  }

  const transaction = buildTransaction(action);

  const response = await fetch(`${baseUrl}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PARMANA_API_KEY}`
    },
    body: JSON.stringify(transaction)
  });

  // Preserve the raw upstream response. Parmana/Vercel can return a
  // non-JSON or empty body on a 500; converting that to {} hides what
  // actually came back from Parmana.
  const rawResponse = await response.text();
  let body = {};
  if (rawResponse.trim()) {
    try {
      body = JSON.parse(rawResponse);
    } catch {
      body = { raw: rawResponse };
    }
  }

  const policyDenied =
    response.status === 403 || body.code === "POLICY_DENIED";

  // A 403 POLICY_DENIED is Parmana's documented policy rejection response.
  // For approved requests, /execute can return a dispatch 500 without
  // returning the decision in the HTTP body. Do not invent APPROVE in that case.
  return {
    decision: body.decision ?? (policyDenied ? "REJECT" : null),
    reason:
      body.reason ??
      body.error ??
      body.message ??
      body.code ??
      null,
    decisionSource: body.decision
      ? "PARMANA_EXECUTE_RESPONSE"
      : policyDenied
        ? "PARMANA_EXECUTE_RESPONSE"
        : null,
    policyVersion,
    source: "REAL_PARMANA_API",
    transactionId: transaction.businessTransactionId,
    remoteStatus: response.status,
    remoteResponse: body,
    transaction
  };
}
