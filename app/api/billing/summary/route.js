import { getAuthenticatedSupabase, getBusinessEntitlements, jsonError } from "../../_shared";

export async function GET(request) {
  const { supabase, error } = await getAuthenticatedSupabase(request, 40);
  if (error) return error;

  const url = new URL(request.url);
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return jsonError("Business is required.");

  const [{ data: plans, error: plansError }, entitlementResult] = await Promise.all([
    supabase.from("subscription_plans").select("*").eq("is_active", true).order("monthly_price_cents", { ascending: true }),
    getBusinessEntitlements(supabase, businessId),
  ]);

  if (plansError) return jsonError(`Could not load plans: ${plansError.message}`, 400);
  if (entitlementResult.error) return jsonError(`Could not load usage: ${entitlementResult.error.message}`, 400);

  return Response.json({
    plans: plans || [],
    subscription: entitlementResult.subscription,
    entitlements: entitlementResult.entitlements,
    usage: entitlementResult.usage,
    month_start: entitlementResult.monthStart,
  });
}
