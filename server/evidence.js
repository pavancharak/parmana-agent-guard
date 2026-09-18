import crypto from "node:crypto";
const evidence = [];

export function recordEvidence(record) {
  const evidenceId = "EVD-" + crypto.createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex").slice(0, 12);
  const item = { evidenceId, ...record };
  evidence.push(item);
  return item;
}

export function getEvidence() {
  return [...evidence].reverse();
}
