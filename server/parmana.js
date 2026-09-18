import crypto from "node:crypto";

const baseUrl = process.env.PARMANA_API_URL || "https://parmana-api-real.vercel.app";

function buildTransaction(action) {
  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();

  return {
    businessTransactionId: transactionId,
    metadata: { businessTransactionId: transactionId },
    authority: {
      authorityId: "authority-agent-guard",
      authorityType: "SERVICE",
      principalId: "demo",
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
      refundEligible: true,
      managerApproved: action.amount <= 5000,
      fraudCheckPassed: true,
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

  const body = await response.json().catch(() => ({}));

  if (response.ok) {
    return {
      decision: "ALLOW",
      reason: "PARMANA_APPROVED",
      source: "REAL_PARMANA_API",
      transactionId: transaction.businessTransactionId,
      remoteStatus: response.status,
      remoteResponse: body
    };
  }

  if (response.status === 403) {
    return {
      decision: "BLOCK",
      reason: body.code === "POLICY_DENIED" ? "PARMANA_POLICY_DENIED" : "PARMANA_REQUEST_DENIED",
      source: "REAL_PARMANA_API",
      transactionId: transaction.businessTransactionId,
      remoteStatus: response.status,
      remoteResponse: body
    };
  }

  return {
    decision: "REMOTE_APPROVAL_REACHED",
    reason: "PARMANA_REACHED_EXECUTION_DISPATCH",
    source: "REAL_PARMANA_API",
    transactionId: transaction.businessTransactionId,
    remoteStatus: response.status,
    remoteResponse: body
  };
}
