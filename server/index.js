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
    const authorization = await authorizeWithParmana(action);
    // The execution boundary is fail-closed: only an explicit APPROVE from Parmana
    // can reach the execution function. Every other response is preserved as-is
    // and prevents execution.
    if (authorization.decision !== "APPROVE" || authorization.remoteStatus !== 200) {
      const remoteStatus = authorization.remoteStatus ?? null;
      const isPolicyRejection =
        authorization.decision === "REJECT" ||
        remoteStatus === 403 ||
        authorization.remoteResponse?.code === "POLICY_DENIED";
      const isDispatchFailure = remoteStatus !== null && remoteStatus >= 500;

      const evidence = recordEvidence({
        decisionId: authorization.transactionId,
        action,
        policyVersion: authorization.policyVersion || "customer-refund@1.0.0",
        parmanaDecision: authorization.decision ?? null,
        reason: authorization.reason,
        authorizationStatus: isPolicyRejection
          ? "POLICY_REJECTED"
          : isDispatchFailure
            ? "DISPATCH_FAILED"
            : "NO_DECISION_RETURNED",
        executionStatus: "NOT_EXECUTED",
        parmanaExecution: {
          status: remoteStatus,
          completed: true,
          response: authorization.remoteResponse
        },
        source: "REAL_PARMANA_API"
      });

      // Preserve the fact that this was a downstream Parmana response,
      // rather than turning a 500 into a synthetic policy BLOCK.
      const httpStatus = isPolicyRejection ? 403 : isDispatchFailure ? 502 : 403;
      return res.status(httpStatus).json({ authorization, evidence });
    }
    const execution = executeRefund(action);
    const evidence = recordEvidence({
      decisionId: authorization.transactionId, action,
      policyVersion: authorization.policyVersion || "customer-refund@1.0.0",
      parmanaDecision: authorization.decision ?? null,
      reason: authorization.reason,
      executionStatus: execution.status, executionId: execution.executionId,
      parmanaExecution: { status: authorization.remoteStatus, completed: true, response: authorization.remoteResponse },
      source: "REAL_PARMANA_API"
    });
    return res.json({ authorization, execution, evidence });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PARMANA_API_ERROR";
    const evidence = recordEvidence({ action, parmanaDecision: null, reason, authorizationStatus: "PARMANA_API_ERROR", executionStatus: "NOT_EXECUTED", parmanaExecution: { status: null, completed: false }, source: "REAL_PARMANA_API" });
    return res.status(500).json({ authorization: { decision: null, reason, source: "REAL_PARMANA_API" }, evidence });
  }
});
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(root, "client", "index.html"))
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Parmana Agent Guard running on port ${port}`);
});
