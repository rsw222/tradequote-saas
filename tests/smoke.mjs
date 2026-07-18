const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const marker = ok ? "PASS" : "FAIL";
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ""}`);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function expectStatus(name, path, expectedStatus, options = {}) {
  try {
    const response = await request(path, options);
    record(name, response.status === expectedStatus, `expected ${expectedStatus}, got ${response.status}`);
    return response;
  } catch (error) {
    record(name, false, error.message);
    return null;
  }
}

const home = await expectStatus("Home page loads", "/", 200);

if (home) {
  const requiredHeaders = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ];

  for (const header of requiredHeaders) {
    record(`Security header: ${header}`, Boolean(home.headers.get(header)));
  }
}

await expectStatus("Job Applier route removed", "/job-applier", 404);

const jsonPost = {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
};

await expectStatus("Clients API blocks unauthenticated writes", "/api/clients/save", 401, jsonPost);
await expectStatus("Quotes API blocks unauthenticated writes", "/api/quotes/save", 401, jsonPost);
await expectStatus("Quote status API blocks unauthenticated writes", "/api/quotes/status", 401, jsonPost);
await expectStatus("Billing summary API blocks unauthenticated reads", "/api/billing/summary?business_id=00000000-0000-0000-0000-000000000000", 401);
await expectStatus("Billing checkout API blocks unauthenticated writes", "/api/billing/checkout", 401, jsonPost);
await expectStatus("Agent tasks API blocks unauthenticated reads", "/api/agent-tasks?business_id=00000000-0000-0000-0000-000000000000", 401);
await expectStatus("Agent tasks API blocks unauthenticated writes", "/api/agent-tasks", 401, jsonPost);
await expectStatus("Agent task status API blocks unauthenticated writes", "/api/agent-tasks/status", 401, jsonPost);
await expectStatus("Hermes assignment API blocks unauthenticated writes", "/api/hermes/assign", 401, jsonPost);
await expectStatus("AI API blocks unauthenticated use", "/api/ai-assist", 401, jsonPost);
await expectStatus("AI scope check API blocks unauthenticated use", "/api/ai/scope-check", 401, jsonPost);
await expectStatus("Feedback API blocks unauthenticated writes", "/api/feedback", 401, jsonPost);

await expectStatus("Photo API blocks unauthenticated uploads", "/api/media/job-photos", 401, {
  method: "POST",
  body: new FormData(),
});

await expectStatus("Voice API blocks unauthenticated uploads", "/api/media/job-voice", 401, {
  method: "POST",
  body: new FormData(),
});

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error(`\n${failed.length} smoke test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} smoke tests passed.`);
