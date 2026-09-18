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

  const allowed =
    result.authorization.decision === "AUTHORIZED" ||
    result.authorization.decision === "ALLOW";

  // Step 1: show Parmana's authorization decision first.
  authorization.innerHTML = `
    <div class="decision ${allowed ? "allow" : "block"}">
      ${allowed ? "AUTHORIZED" : result.authorization.decision}
    </div>
    <p><strong>Requested:</strong> ₹${action.amount.toLocaleString("en-IN")}</p>
    <p><strong>Policy:</strong> ${result.authorization.policyVersion || "customer-refund@1.0.0"}</p>
    <p><strong>Reason:</strong> ${result.authorization.reason}</p>
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
  .querySelectorAll("button")
  .forEach(button =>
    button.addEventListener("click", () => runScenario(button))
  );
