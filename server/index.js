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
    if (authorization.decision === "BLOCK") {
      const evidence = recordEvidence({
        decisionId: authorization.transactionId, action,
        policyVersion: authorization.policyVersion || "customer-refund@1.0.0",
        decision: "BLOCK", reason: authorization.reason,
        executionStatus: "NOT_EXECUTED",
        parmanaExecution: { status: authorization.remoteStatus, completed: true, response: authorization.remoteResponse },
        source: "REAL_PARMANA_API"
      });
      return res.status(403).json({ authorization, evidence });
    }
    const execution = executeRefund(action);
    const evidence = recordEvidence({
      decisionId: authorization.transactionId, action,
      policyVersion: authorization.policyVersion || "customer-refund@1.0.0",
      decision: authorization.decision, reason: authorization.reason,
      executionStatus: execution.status, executionId: execution.executionId,
      parmanaExecution: { status: authorization.remoteStatus, completed: true, response: authorization.remoteResponse },
      source: "REAL_PARMANA_API"
    });
    return res.json({ authorization, execution, evidence });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PARMANA_API_ERROR";
    const evidence = recordEvidence({ action, decision: "BLOCK", reason, executionStatus: "NOT_EXECUTED", parmanaExecution: { status: null, completed: false }, source: "REAL_PARMANA_API" });
    return res.status(500).json({ authorization: { decision: "BLOCK", reason, source: "REAL_PARMANA_API" }, evidence });
  }
});
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(root, "client", "index.html"))
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Parmana Agent Guard running on port ${port}`);
});
