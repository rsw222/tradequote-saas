import { createClient } from "@supabase/supabase-js";

export const apiLimits = {
  maxPhotoFiles: 8,
  maxPhotoSizeBytes: 10 * 1024 * 1024,
  maxVoiceSizeBytes: 25 * 1024 * 1024,
  maxQuoteItems: 80,
  maxTextLength: 5000,
};

export const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const rateLimitWindowMs = 60 * 1000;
const rateLimitStore = globalThis.tradeQuoteRateLimitStore || new Map();
globalThis.tradeQuoteRateLimitStore = rateLimitStore;

export function sanitizeFileName(fileName) {
  return String(fileName || "file")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function limitText(value, fallback = null) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.slice(0, apiLimits.maxTextLength);
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export function getMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

const freeEntitlements = {
  plan_code: "free",
  name: "Free",
  status: "free",
  quote_limit_monthly: 5,
  user_limit: 1,
  includes_photos: true,
  includes_voice: true,
  includes_ai: false,
  includes_tasks: false,
  includes_team: false,
};

export async function getBusinessEntitlements(supabase, businessId) {
  const monthStart = getMonthStartIso();
  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("business_id", businessId)
    .maybeSingle();

  const hasActiveSubscription = ["trialing", "active"].includes(subscription?.status);
  const plan = hasActiveSubscription && subscription?.subscription_plans ? subscription.subscription_plans : freeEntitlements;

  const { data: usageEvents, error: usageError } = await supabase
    .from("usage_events")
    .select("event_type,quantity")
    .eq("business_id", businessId)
    .gte("created_at", monthStart);

  if (usageError) {
    return {
      entitlements: { ...freeEntitlements },
      subscription,
      usage: {},
      monthStart,
      error: usageError,
    };
  }

  const usage = (usageEvents || []).reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + Number(event.quantity || 1);
    return acc;
  }, {});

  return {
    entitlements: {
      plan_code: plan.plan_code,
      name: plan.name,
      status: subscription?.status || "free",
      quote_limit_monthly: plan.quote_limit_monthly,
      user_limit: plan.user_limit,
      includes_photos: Boolean(plan.includes_photos),
      includes_voice: Boolean(plan.includes_voice),
      includes_ai: Boolean(plan.includes_ai),
      includes_tasks: Boolean(plan.includes_tasks),
      includes_team: Boolean(plan.includes_team),
    },
    subscription,
    usage,
    monthStart,
  };
}

export async function assertBusinessFeature(supabase, businessId, feature) {
  const { entitlements, usage, error } = await getBusinessEntitlements(supabase, businessId);
  if (error) return { error: jsonError(`Could not check plan limits: ${error.message}`, 400), entitlements, usage };

  if (feature === "quotes" && entitlements.quote_limit_monthly !== null && entitlements.quote_limit_monthly !== undefined) {
    const usedQuotes = Number(usage.quote_created || 0);
    if (usedQuotes >= Number(entitlements.quote_limit_monthly)) {
      return {
        error: jsonError(`${entitlements.name} plan includes ${entitlements.quote_limit_monthly} quotes per month. Upgrade to create more quotes.`, 402),
        entitlements,
        usage,
      };
    }
  }

  const featureMap = {
    photos: "includes_photos",
    voice: "includes_voice",
    ai: "includes_ai",
    tasks: "includes_tasks",
    team: "includes_team",
  };

  const flag = featureMap[feature];
  if (flag && !entitlements[flag]) {
    return {
      error: jsonError(`${feature[0].toUpperCase()}${feature.slice(1)} is not included in the ${entitlements.name} plan. Upgrade to unlock it.`, 402),
      entitlements,
      usage,
    };
  }

  return { entitlements, usage };
}

export async function recordUsageEvent(supabase, { businessId, userId, eventType, jobId = null, quoteId = null, quantity = 1, metadata = {} }) {
  if (!businessId || !eventType) return;
  await supabase.from("usage_events").insert({
    business_id: businessId,
    user_id: userId || null,
    event_type: eventType,
    event_source: "app",
    job_id: jobId,
    quote_id: quoteId,
    quantity,
    metadata,
  });
}

export async function getAuthenticatedSupabase(request, maxRequestsPerWindow = 30) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonError("Supabase is not configured.", 500) };
  }

  if (!token) {
    return { error: jsonError("Sign in before making changes.", 401) };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return { error: jsonError("Invalid or expired session.", 401) };
  }

  const key = `${user.id}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
  } else {
    current.count += 1;
    if (current.count > maxRequestsPerWindow) {
      return { error: jsonError("Too many requests. Wait a minute and try again.", 429) };
    }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { supabase, user };
}
