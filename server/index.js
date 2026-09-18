import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "./policy.js";
import { executeRefund } from "./execute.js";
import { getEvidence, recordEvidence } from "./evidence.js";
import { authorizeWithParmana } from "./parmana.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store");
  }
  next();
});
app.use(express.static(path.join(root, "client"), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.set("Cache-Control", "no-store")
}));

app.get("/api/policy", (_req, res) => res.json(loadPolicy()));
app.get("/api/evidence", (_req, res) => res.json(getEvidence()));

app.post("/api/execute", async (req, res) => {
  const action = req.body;

  try {
    const policy = loadPolicy();
    const remoteAuthorization = await authorizeWithParmana(action);
    const policyDecision = evaluatePolicy(action, policy);

    if (policyDecision.decision === "BLOCK") {
      const evidence = recordEvidence({
        decisionId: remoteAuthorization.transactionId,
        action,
        policyVersion: "customer-refund@1.0.0",
        decision: "BLOCK",
        reason: policyDecision.reason,
        ruleId: policyDecision.ruleId,
        executionStatus: "NOT_EXECUTED",
        parmanaExecution: {
          status: remoteAuthorization.remoteStatus,
          completed: true,
          response: remoteAuthorization.remoteResponse
        },
        source: "REAL_PARMANA_API"
      });

      return res.status(403).json({
        authorization: {
          ...remoteAuthorization,
          decision: "BLOCK",
          reason: policyDecision.reason,
          ruleId: policyDecision.ruleId
        },
        evidence
      });
    }

    const execution = executeRefund(action);
    const evidence = recordEvidence({
      decisionId: remoteAuthorization.transactionId,
      action,
      policyVersion: "customer-refund@1.0.0",
      decision: "ALLOW",
      reason: policyDecision.reason,
      ruleId: policyDecision.ruleId,
      executionStatus: execution.status,
      executionId: execution.executionId,
      parmanaExecution: {
        status: remoteAuthorization.remoteStatus,
        completed: true,
        response: remoteAuthorization.remoteResponse
      },
      source: "REAL_PARMANA_API"
    });

    return res.json({
      authorization: {
        ...remoteAuthorization,
        decision: "ALLOW",
        reason: policyDecision.reason,
        ruleId: policyDecision.ruleId
      },
      execution,
      evidence
    });
  } catch (error) {
    const evidence = recordEvidence({
      action,
      decision: "BLOCK",
      reason: error instanceof Error ? error.message : "PARMANA_API_ERROR",
      executionStatus: "NOT_EXECUTED",
      parmanaExecution: {
        status: null,
        completed: false
      },
      source: "REAL_PARMANA_API"
    });

    return res.status(500).json({
      authorization: {
        decision: "BLOCK",
        reason: error instanceof Error ? error.message : "PARMANA_API_ERROR",
        source: "REAL_PARMANA_API"
      },
      evidence
    });
  }
});
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(root, "client", "index.html"))
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Parmana Agent Guard running on port ${port}`);
});
