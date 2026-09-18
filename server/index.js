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
app.use(express.static(path.join(root, "client")));

app.get("/api/policy", (_req, res) => res.json(loadPolicy()));
app.get("/api/evidence", (_req, res) => res.json(getEvidence()));

app.post("/api/execute", async (req, res) => {
  const action = req.body;

  try {
    const authorization = await authorizeWithParmana(action);

    if (authorization.decision !== "ALLOW") {
      const evidence = recordEvidence({
        decisionId: authorization.transactionId,
        action,
        policyVersion: "customer-refund@1.0.0",
        decision: authorization.decision,
        reason: authorization.reason,
        executionStatus: "NOT_EXECUTED",
        source: "REAL_PARMANA_API"
      });

      return res.status(authorization.decision === "BLOCK" ? 403 : 502)
        .json({ authorization, evidence });
    }

    const execution = executeRefund(action);
    const evidence = recordEvidence({
      decisionId: authorization.transactionId,
      action,
      policyVersion: "customer-refund@1.0.0",
      decision: authorization.decision,
      reason: authorization.reason,
      executionStatus: execution.status,
      executionId: execution.executionId,
      source: "REAL_PARMANA_API"
    });

    return res.json({ authorization, execution, evidence });
  } catch (error) {
    const evidence = recordEvidence({
      action,
      decision: "BLOCK",
      reason: error instanceof Error ? error.message : "PARMANA_API_ERROR",
      executionStatus: "NOT_EXECUTED",
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
