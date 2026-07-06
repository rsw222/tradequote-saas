import { apiLimits, assertBusinessFeature, getAuthenticatedSupabase, jsonError, limitText, recordUsageEvent } from "../../_shared";

function numberOrZero(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 25);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid quote payload.");

  const businessId = body.business_id;
  if (!businessId) return jsonError("Business is required.");

  if (!body.quote_id) {
    const { error: entitlementError } = await assertBusinessFeature(supabase, businessId, "quotes");
    if (entitlementError) return entitlementError;
  }

  const clientInput = body.client || {};
  const clientId = clientInput.client_id;
  if (!clientId && !limitText(clientInput.name)) return jsonError("Client name is required.");

  let client = null;
  if (clientId) {
    const { data, error: clientError } = await supabase.from("clients").select("*").eq("client_id", clientId).eq("business_id", businessId).single();
    if (clientError) return jsonError(`Could not load client: ${clientError.message}`, 400);
    client = data;
  } else {
    const { data, error: clientError } = await supabase
      .from("clients")
      .insert({
        business_id: businessId,
        name: limitText(clientInput.name),
        phone: limitText(clientInput.phone),
        email: limitText(clientInput.email),
        address: limitText(clientInput.address),
        notes: limitText(clientInput.notes),
      })
      .select()
      .single();
    if (clientError) return jsonError(`Could not save client: ${clientError.message}`, 400);
    client = data;
  }

  const jobPayload = {
    business_id: businessId,
    client_id: client.client_id,
    trade_type: limitText(body.trade_type, "Other"),
    urgency: limitText(body.urgency, "Standard"),
    description: limitText(body.description),
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  const jobRequest = body.job_id
    ? supabase.from("jobs").update(jobPayload).eq("job_id", body.job_id).eq("business_id", businessId).select().single()
    : supabase.from("jobs").insert(jobPayload).select().single();

  const { data: job, error: jobError } = await jobRequest;
  if (jobError) return jsonError(`Could not save job: ${jobError.message}`, 400);

  const allowedStatuses = new Set(["draft", "sent", "accepted", "rejected", "expired"]);
  const quoteStatus = allowedStatuses.has(body.status) ? body.status : "draft";
  const quotePayload = {
    business_id: businessId,
    job_id: job.job_id,
    client_id: client.client_id,
    quote_number: limitText(body.quote_number, `QT-${Date.now()}`),
    subtotal: numberOrZero(body.subtotal),
    gst: numberOrZero(body.gst),
    total: numberOrZero(body.total),
    terms: limitText(body.terms),
    status: quoteStatus,
    updated_at: new Date().toISOString(),
  };

  const quoteRequest = body.quote_id
    ? supabase.from("quotes").update(quotePayload).eq("quote_id", body.quote_id).eq("business_id", businessId).select().single()
    : supabase.from("quotes").insert(quotePayload).select().single();

  const { data: quote, error: quoteError } = await quoteRequest;
  if (quoteError) return jsonError(`Could not save quote: ${quoteError.message}`, 400);

  const lineItems = Array.isArray(body.line_items) ? body.line_items.slice(0, apiLimits.maxQuoteItems) : [];
  const quoteItemsPayload = lineItems
    .filter((item) => limitText(item.description) || numberOrZero(item.amount) > 0)
    .map((item) => ({
      quote_id: quote.quote_id,
      description: limitText(item.description, "Quote item"),
      item_type: ["labour", "materials", "other"].includes(item.type) ? item.type : "other",
      amount: numberOrZero(item.amount),
    }));

  if (body.quote_id) {
    const { error: deleteItemsError } = await supabase.from("quote_items").delete().eq("quote_id", quote.quote_id);
    if (deleteItemsError) return jsonError(`Quote saved, but old items could not be replaced: ${deleteItemsError.message}`, 400);
  }

  if (quoteItemsPayload.length) {
    const { error: itemsError } = await supabase.from("quote_items").insert(quoteItemsPayload);
    if (itemsError) return jsonError(`Quote saved, but items failed: ${itemsError.message}`, 400);
  }

  await recordUsageEvent(supabase, {
    businessId,
    userId: user.id,
    eventType: body.quote_id ? "quote_updated" : "quote_created",
    jobId: job.job_id,
    quoteId: quote.quote_id,
    metadata: {
      quote_number: quote.quote_number,
      total: quote.total,
    },
  });

  return Response.json({ client, job, quote });
}
