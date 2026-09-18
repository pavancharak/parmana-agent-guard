import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const policyPath = path.join(root, "policies", "refund-policy.json");

export function loadPolicy() {
  return JSON.parse(fs.readFileSync(policyPath, "utf8"));
}

export function evaluatePolicy(action, policy) {
  if (action.action !== "refund") {
    return { decision: "BLOCK", reason: "ACTION_NOT_SUPPORTED" };
  }

  if (!Number.isFinite(action.amount) || action.amount <= 0) {
    return { decision: "BLOCK", reason: "INVALID_AMOUNT" };
  }

  const signals = {
    refundEligible: action.refundEligible === true,
    managerApproved: action.managerApproved === true,
    fraudCheckPassed: action.fraudCheckPassed === true,
    refundAmount: action.amount
  };

  if (signals.refundAmount > 10000) {
    return {
      decision: "BLOCK",
      reason: "REFUND_AMOUNT_EXCEEDS_POLICY_LIMIT",
      ruleId: "reject-excessive-refund"
    };
  }

  if (!signals.fraudCheckPassed) {
    return {
      decision: "BLOCK",
      reason: "FRAUD_CHECK_FAILED",
      ruleId: "reject-fraud-check"
    };
  }

  if (
    signals.refundEligible &&
    signals.managerApproved &&
    signals.fraudCheckPassed &&
    signals.refundAmount <= 10000
  ) {
    return {
      decision: "ALLOW",
      reason: "POLICY_CONDITIONS_SATISFIED",
      ruleId: "approve-refund"
    };
  }

  if (!signals.managerApproved) {
    return {
      decision: "BLOCK",
      reason: "MANAGER_APPROVAL_REQUIRED",
      ruleId: "reject-default"
    };
  }

  return {
    decision: "BLOCK",
    reason: "POLICY_CONDITION_NOT_SATISFIED",
    ruleId: "reject-default"
  };
}
