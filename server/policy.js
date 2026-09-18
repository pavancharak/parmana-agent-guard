import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const policyPath = path.join(root, "policies", "refund-policy.json");

export function loadPolicy() {
  return JSON.parse(fs.readFileSync(policyPath, "utf8"));
}

export function evaluatePolicy(action, policy) {
  if (action.action !== "refund") return { decision: "BLOCK", reason: "ACTION_NOT_SUPPORTED" };
  if (!Number.isFinite(action.amount) || action.amount <= 0) return { decision: "BLOCK", reason: "INVALID_AMOUNT" };
  if (!policy.allowedReasons.includes(String(action.reason).toLowerCase())) {
    return { decision: "BLOCK", reason: "REFUND_REASON_NOT_ELIGIBLE" };
  }
  if (action.amount > policy.automaticRefundLimit) {
    return { decision: "BLOCK", reason: "AMOUNT_EXCEEDS_AUTHORIZED_LIMIT" };
  }
  return { decision: "ALLOW", reason: "WITHIN_POLICY" };
}
