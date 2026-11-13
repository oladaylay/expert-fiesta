// === Payment configuration ===
// Replace with your real Paystack PUBLIC key (Settings -> API Keys & Webhooks on paystack.com).
// Test keys start with "pk_test_", live keys with "pk_live_". Never put a SECRET key in this file
// — this code runs in the customer's browser, so only the public key belongs here.
const PAYSTACK_PUBLIC_KEY = "pk_test_cc91814187da856b3664148476c79aaf9dbe1bfe";

function isPaystackConfigured() {
  return typeof PAYSTACK_PUBLIC_KEY === "string" && !PAYSTACK_PUBLIC_KEY.includes("REPLACE");
}

function formatNaira(amount) {
  return "₦" + Math.round(amount).toLocaleString("en-NG");
}
