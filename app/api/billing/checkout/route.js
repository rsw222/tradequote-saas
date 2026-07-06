import { getAuthenticatedSupabase, jsonError } from "../../_shared";

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 12);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid checkout payload.");
  if (!body.business_id || !body.plan_code) return jsonError("Business and plan are required.");

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:4173";

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("plan_code", body.plan_code)
    .eq("is_active", true)
    .single();

  if (planError) return jsonError(`Could not load plan: ${planError.message}`, 400);

  if (!stripeSecretKey || !plan.stripe_price_id) {
    return jsonError(
      "Stripe is not configured yet. Add STRIPE_SECRET_KEY and each plan's stripe_price_id before checkout can start.",
      501,
    );
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": plan.stripe_price_id,
      "line_items[0][quantity]": "1",
      "metadata[business_id]": body.business_id,
      "metadata[plan_code]": plan.plan_code,
      "metadata[user_id]": user.id,
      client_reference_id: body.business_id,
      customer_email: user.email || "",
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancelled`,
    }),
  });

  const data = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok) return jsonError(data.error?.message || "Stripe checkout failed.", 502);

  return Response.json({
    checkout_url: data.url,
    checkout_session_id: data.id,
  });
}
