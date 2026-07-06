import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.REGRESSION_BASE_URL || "http://127.0.0.1:4173";
const checks = [];

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  const content = readFileSync(".env.local", "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

function skip(message) {
  console.log(`SKIP ${message}`);
  process.exit(0);
}

async function request(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function expectStatus(name, path, token, expectedStatuses, options = {}) {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  try {
    const response = await request(path, token, options);
    const body = await response.json().catch(() => ({}));
    record(name, expected.includes(response.status), `expected ${expected.join("/")}, got ${response.status}${body.error ? ` (${body.error})` : ""}`);
    return { response, body };
  } catch (error) {
    record(name, false, error.message);
    return { response: null, body: {} };
  }
}

function makePngFile() {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return new File([bytes], `regression-${Date.now()}.png`, { type: "image/png" });
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) skip("Supabase env vars are missing.");
if (!email || !password) {
  skip("Add E2E_TEST_EMAIL and E2E_TEST_PASSWORD to .env.local to run signed-in regression tests.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const signIn = await supabase.auth.signInWithPassword({ email, password });

if (signIn.error || !signIn.data.session) {
  record("Sign in with test user", false, signIn.error?.message || "No session returned.");
  process.exit(1);
}

record("Sign in with test user", true, email);

const token = signIn.data.session.access_token;
const userId = signIn.data.user.id;

let business = null;
const memberships = await supabase
  .from("business_members")
  .select("role, businesses(*)")
  .eq("user_id", userId)
  .limit(1);

if (memberships.error) {
  record("Load test business membership", false, memberships.error.message);
  process.exit(1);
}

business = memberships.data?.[0]?.businesses || null;

if (!business) {
  const businessName = `TradeQuote Regression ${new Date().toISOString()}`;
  const createdBusiness = await supabase
    .from("businesses")
    .insert({ name: businessName, owner_user_id: userId })
    .select()
    .single();

  if (createdBusiness.error) {
    record("Create regression business", false, createdBusiness.error.message);
    process.exit(1);
  }

  const membership = await supabase.from("business_members").upsert(
    {
      business_id: createdBusiness.data.business_id,
      user_id: userId,
      role: "owner",
    },
    { onConflict: "business_id,user_id" },
  );

  if (membership.error) {
    record("Create regression business membership", false, membership.error.message);
    process.exit(1);
  }

  business = createdBusiness.data;
  record("Create regression business", true, business.name);
} else {
  record("Load test business", true, business.name || business.business_id);
}

const businessId = business.business_id || business.id;
const billing = await expectStatus("Load billing summary", `/api/billing/summary?business_id=${businessId}`, token, 200);
const entitlements = billing.body.entitlements || {};

const clientPayload = {
  business_id: businessId,
  name: `Regression Client ${Date.now()}`,
  phone: "0400000000",
  email: "regression@example.com",
  address: "1 Test Street, Sydney NSW",
  notes: "Regression client record.",
};

const clientResult = await expectStatus("Save client through API", "/api/clients/save", token, 200, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(clientPayload),
});

const client = clientResult.body.client;
if (!client?.client_id) {
  record("Client ID returned", false, "Cannot continue quote regression without client_id.");
} else {
  record("Client ID returned", true, client.client_id);
}

let quote = null;
let job = null;

if (client?.client_id) {
  const quotePayload = {
    business_id: businessId,
    client: { client_id: client.client_id },
    trade_type: "Plumbing",
    urgency: "Standard",
    description: "Regression quote for SaaS entitlement testing.",
    quote_number: `REG-${Date.now()}`,
    subtotal: 100,
    gst: 10,
    total: 110,
    terms: "Regression test quote.",
    status: "draft",
    line_items: [{ description: "Regression labour", type: "labour", amount: 100 }],
  };

  const quoteResult = await expectStatus("Save quote or enforce quote limit", "/api/quotes/save", token, [200, 402], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(quotePayload),
  });

  if (quoteResult.response?.status === 200) {
    quote = quoteResult.body.quote;
    job = quoteResult.body.job;
    record("Quote and job IDs returned", Boolean(quote?.quote_id && job?.job_id), `${quote?.quote_id || "no quote"} / ${job?.job_id || "no job"}`);
  } else {
    record("Quote limit enforcement", true, quoteResult.body.error || "Plan limit enforced.");
  }
}

if (quote?.quote_id && job?.job_id) {
  await expectStatus("Update quote status", "/api/quotes/status", token, 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ business_id: businessId, quote_id: quote.quote_id, status: "sent" }),
  });

  const photoForm = new FormData();
  photoForm.set("business_id", businessId);
  photoForm.set("job_id", job.job_id);
  photoForm.set("replace_existing", "false");
  photoForm.append("photos", makePngFile());
  await expectStatus("Upload photo or enforce photo entitlement", "/api/media/job-photos", token, entitlements.includes_photos ? 200 : 402, {
    method: "POST",
    body: photoForm,
  });

  const voiceForm = new FormData();
  voiceForm.set("business_id", businessId);
  voiceForm.set("job_id", job.job_id);
  voiceForm.set("replace_existing", "false");
  voiceForm.set("transcript", "Regression voice transcript only.");
  await expectStatus("Upload voice transcript or enforce voice entitlement", "/api/media/job-voice", token, entitlements.includes_voice ? 200 : 402, {
    method: "POST",
    body: voiceForm,
  });

  await expectStatus("Create task or enforce task entitlement", "/api/agent-tasks", token, entitlements.includes_tasks ? 200 : 402, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      business_id: businessId,
      job_id: job.job_id,
      quote_id: quote.quote_id,
      task_type: "confirm_measurements",
      title: "Regression confirm measurements",
      priority: "normal",
    }),
  });

  await expectStatus("Run AI or enforce AI entitlement", "/api/ai-assist", token, entitlements.includes_ai ? 200 : 402, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      business_id: businessId,
      prompt: "Regression AI prompt. Summarise the quote risk in one sentence.",
    }),
  });
}

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error(`\n${failed.length} signed-in regression test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} signed-in regression checks passed.`);
