const agent = document.querySelector("#agent");
const authorization = document.querySelector("#authorization");
const evidence = document.querySelector("#evidence");

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function runScenario(button) {
  const action = {
    action: "refund",
    amount: Number(button.dataset.amount),
    reason: "damaged"
  };

  agent.textContent = JSON.stringify({
    proposal: action,
    path: button.classList.contains("attack")
      ? "DIRECT_API_REQUEST"
      : "AI_AGENT"
  }, null, 2);

  // Evidence must follow the authorization decision.
  authorization.textContent = "Checking Parmana authorization...";
  evidence.textContent = JSON.stringify({
    status: "WAITING_FOR_AUTHORIZATION"
  }, null, 2);

  const response = await fetch("/api/execute", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action)
  });

  const result = await response.json();

  const remote = result.authorization.remoteResponse || {};

  // Step 1: show exactly what Parmana returned. The UI does not invent
  // an authorization decision when the API did not provide one.
  authorization.innerHTML = `
    <div class="decision ${result.authorization.decision === "APPROVE" ? "allow" : "block"}">
      PARMANA RESPONSE
    </div>
    <p><strong>Parmana HTTP:</strong> ${result.authorization.remoteStatus ?? "N/A"}</p>
    <p><strong>Requested:</strong> ₹${action.amount.toLocaleString("en-IN")}</p>
    <p><strong>Policy:</strong> ${result.authorization.policyVersion || "customer-refund@1.0.0"}</p>
    <p><strong>Parmana decision field:</strong> ${result.authorization.decision ?? "not returned"}</p>
    <p><strong>Parmana reason field:</strong> ${result.authorization.reason ?? "not returned"}</p>
    <details open>
      <summary>Exact Parmana API response</summary>
      <pre>${JSON.stringify(remote, null, 2)}</pre>
    </details>
  `;

  // Let the browser paint the authorization result before evidence appears.
  await nextPaint();
  await new Promise(resolve => setTimeout(resolve, 250));

  // Step 2: show the evidence produced after the authorization/execution result.
  evidence.textContent = JSON.stringify(
    result.evidence,
    null,
    2
  );
}

document
  .querySelectorAll(".buttons button")
  .forEach(button =>
    button.addEventListener("click", () => runScenario(button))
  );


const policyToggle = document.querySelector("#policy-toggle");
const policyPanel = document.querySelector("#policy-panel");
const policySummary = document.querySelector("#policy-summary");
const policyJson = document.querySelector("#policy-json");

policyToggle.addEventListener("click", async () => {
  const opening = policyPanel.hidden;
  policyPanel.hidden = !opening;
  policyToggle.textContent = opening ? "Hide Current Policy" : "View Current Policy";

  if (!opening || policySummary.dataset.loaded) return;

  try {
    const response = await fetch("/api/policy", { cache: "no-store" });
    if (!response.ok) throw new Error(`Policy request failed: ${response.status}`);

    const policy = await response.json();
    const rules = Array.isArray(policy.rules) ? policy.rules : [];
    const approveRule = rules.find(rule => rule.id === "approve-refund");
    const amountCondition = approveRule?.condition?.all?.find(
      condition => condition.fact === "refundAmount" && condition.operator === "lte"
    );
    const maximumRefund = amountCondition?.value;
    const conditions = approveRule?.condition?.all || [];

    policySummary.innerHTML = `
      <div class="policy-grid">
        <div><strong>Policy</strong><span>${policy.policyId || "customer-refund"}@${policy.policyVersion || "1.0.0"}</span></div>
        <div><strong>Schema</strong><span>${policy.schemaVersion || "Not specified"}</span></div>
        <div><strong>Maximum authorized refund</strong><span>₹${Number(maximumRefund).toLocaleString("en-IN")}</span></div>
        <div><strong>Required conditions</strong><span>${conditions.length}</span></div>
        <div><strong>Decision rules</strong><span>${rules.length}</span></div>
      </div>
      <div class="policy-section">
        <h3>Authorization conditions</h3>
        <ul>${conditions.map(condition => `<li>${condition}</li>`).join("")}</ul>
      </div>
      <div class="policy-section">
        <h3>Decision rules</h3>
        <ul>${rules.map(rule => `<li><strong>${rule.id}</strong> — ${rule.outcome}: ${rule.reason}</li>`).join("")}</ul>
      </div>
    `;

    policyJson.textContent = JSON.stringify(policy, null, 2);
    policySummary.dataset.loaded = "true";
  } catch (error) {
    policySummary.textContent = "Unable to load current policy.";
    policyJson.textContent = String(error);
  }
});