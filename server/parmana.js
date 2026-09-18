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
      refundEligible: true,
      // Manager approval is an explicit business signal for the demo.
      // It is not derived from the refund amount.
      managerApproved: action.managerApproved === true,
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

  let persistedRecord = null;

  // /execute can fail after Parmana has evaluated policy and created its
  // trust record. Recover that authoritative record so the UI can show the
  // actual policy outcome instead of treating an empty dispatch response as
  // "no decision".
  if (!response.ok && response.status >= 500) {
    try {
      const recordResponse = await fetch(
        baseUrl + "/trust-records/" + transaction.businessTransactionId,
        {
          headers: {
            Authorization: `Bearer ${process.env.PARMANA_API_KEY}`
          }
        }
      );
      if (recordResponse.ok) {
        persistedRecord = await recordResponse.json().catch(() => null);
      }
    } catch {
      persistedRecord = null;
    }
  }

  const persistedDecision =
    persistedRecord?.authorization
      ? "APPROVE"
      : persistedRecord?.transaction?.status === "REJECTED"
        ? "REJECT"
        : null;

  const persistedReason =
    persistedRecord?.transaction?.status === "REJECTED"
      ? "Parmana recorded the Business Transaction as REJECTED."
      : null;

  return {
    decision: body.decision ?? persistedDecision,
    reason: body.reason ?? body.message ?? body.code ?? persistedReason,
    decisionSource: body.decision
      ? "PARMANA_EXECUTE_RESPONSE"
      : persistedDecision
        ? "PARMANA_TRUST_RECORD"
        : null,
    policyVersion,
    source: "REAL_PARMANA_API",
    transactionId: transaction.businessTransactionId,
    remoteStatus: response.status,
    remoteResponse: body,
    transaction,
    trustRecord: persistedRecord
  };
}
