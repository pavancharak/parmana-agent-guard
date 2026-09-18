import crypto from "node:crypto";
import { evaluatePolicy } from "./policy.js";

export function authorize(action, policy) {
  const result = evaluatePolicy(action, policy);
  const decisionId = "DEC-" + crypto.createHash("sha256")
    .update(JSON.stringify({ action, policyVersion: policy.policyVersion }))
    .digest("hex").slice(0, 12);

  return { decisionId, ...result, policyVersion: policy.policyVersion };
}
