// Trusted business context fixture for the Phinite + Parmana demo.
//
// This simulates an upstream business system supplying authorization signals.
// The AI agent does not generate, infer, or modify these values.

export function getTrustedBusinessContext() {
  return {
    refundEligible: true,
    managerApproved: true,
    fraudCheckPassed: true
  };
}
