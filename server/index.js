import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "./policy.js";
import { authorize } from "./authorize.js";
import { executeRefund } from "./execute.js";
import { getEvidence, recordEvidence } from "./evidence.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

app.use(express.json());
app.use(express.static(path.join(root, "client")));

app.get("/api/policy", (_req, res) => res.json(loadPolicy()));
app.get("/api/evidence", (_req, res) => res.json(getEvidence()));

app.post("/api/execute", (req, res) => {
  const action = req.body;
  const policy = loadPolicy();
  const authorization = authorize(action, policy);

  if (authorization.decision === "BLOCK") {
    const evidence = recordEvidence({
      decisionId: authorization.decisionId,
      action,
      policyVersion: authorization.policyVersion,
      decision: authorization.decision,
      reason: authorization.reason,
      executionStatus: "NOT_EXECUTED"
    });
    return res.status(403).json({ authorization, evidence });
  }

  const execution = executeRefund(action);
  const evidence = recordEvidence({
    decisionId: authorization.decisionId,
    action,
    policyVersion: authorization.policyVersion,
    decision: authorization.decision,
    reason: authorization.reason,
    executionStatus: execution.status,
    executionId: execution.executionId
  });
  return res.json({ authorization, execution, evidence });
});

app.get("*", (_req, res) => res.sendFile(path.join(root, "client", "index.html")));

app.listen(port, "0.0.0.0", () => {
  console.log(`Parmana Agent Guard running on port ${port}`);
});
