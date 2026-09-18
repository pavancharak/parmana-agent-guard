const agent = document.querySelector("#agent");
const authorization = document.querySelector("#authorization");
const evidence = document.querySelector("#evidence");

async function runScenario(button) {
  const action = { action: "refund", amount: Number(button.dataset.amount), reason: "damaged" };
  agent.textContent = JSON.stringify({
    proposal: action,
    path: button.classList.contains("attack") ? "DIRECT_API_REQUEST" : "AI_AGENT"
  }, null, 2);
  authorization.textContent = "Checking policy...";

  const response = await fetch("/api/execute", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action)
  });
  const result = await response.json();
  const allowed = result.authorization.decision === "AUTHORIZED" || result.authorization.decision === "ALLOW";

  authorization.innerHTML = `
    <div class="decision ${allowed ? "allow" : "block"}">${allowed ? "AUTHORIZED" : result.authorization.decision}</div>
    <p><strong>Requested:</strong> ₹${action.amount.toLocaleString("en-IN")}</p>
    <p><strong>Policy:</strong> ${result.authorization.policyVersion}</p>
    <p><strong>Reason:</strong> ${result.authorization.reason}</p>
  `;
  // Always render the evidence returned by this execution.
  // Refresh from the server as well so the panel cannot remain stale.
  const latestEvidence = await fetch("/api/evidence", {
    cache: "no-store"
  }).then(r => r.json()).catch(() => [result.evidence]);

  evidence.textContent = JSON.stringify(
    latestEvidence[0] || result.evidence,
    null,
    2
  );
}

document.querySelectorAll("button").forEach(button => button.addEventListener("click", () => runScenario(button)));
