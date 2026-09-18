export function executeRefund(action) {
  return {
    executionId: "REF-" + String(action.amount) + "-" + String(action.reason).toLowerCase(),
    status: "EXECUTED",
    message: `Mock refund of ₹${action.amount.toLocaleString("en-IN")} executed.`
  };
}
