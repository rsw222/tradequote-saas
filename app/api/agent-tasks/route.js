import { assertBusinessFeature, getAuthenticatedSupabase, jsonError, limitText, recordUsageEvent } from "../_shared";

const allowedTaskTypes = new Set([
  "general",
  "confirm_measurements",
  "prepare_materials",
  "follow_up_quote",
  "review_quote_risk",
  "translate_quote",
  "send_customer_message",
  "ai_review",
]);

const allowedPriorities = new Set(["low", "normal", "high", "urgent"]);

const taskTitles = {
  general: "General task",
  confirm_measurements: "Confirm measurements",
  prepare_materials: "Prepare materials list",
  follow_up_quote: "Follow up quote",
  review_quote_risk: "Review quote risk",
  translate_quote: "Translate quote",
  send_customer_message: "Send customer message",
  ai_review: "AI review",
};

export async function GET(request) {
  const { supabase, error } = await getAuthenticatedSupabase(request, 40);
  if (error) return error;

  const url = new URL(request.url);
  const businessId = url.searchParams.get("business_id");
  const jobId = url.searchParams.get("job_id");
  const quoteId = url.searchParams.get("quote_id");

  if (!businessId) return jsonError("Business is required.");

  let query = supabase
    .from("agent_tasks")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (jobId) query = query.eq("job_id", jobId);
  if (quoteId) query = query.eq("quote_id", quoteId);

  const { data, error: taskError } = await query;
  if (taskError) return jsonError(`Could not load tasks: ${taskError.message}`, 400);

  return Response.json({ tasks: data || [] });
}

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 30);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid task payload.");
  if (!body.business_id) return jsonError("Business is required.");

  const { error: entitlementError } = await assertBusinessFeature(supabase, body.business_id, "tasks");
  if (entitlementError) return entitlementError;

  const taskType = allowedTaskTypes.has(body.task_type) ? body.task_type : "general";
  const priority = allowedPriorities.has(body.priority) ? body.priority : "normal";
  const title = limitText(body.title, taskTitles[taskType]);
  if (!title) return jsonError("Task title is required.");

  const payload = {
    business_id: body.business_id,
    job_id: body.job_id || null,
    quote_id: body.quote_id || null,
    task_type: taskType,
    title,
    description: limitText(body.description),
    priority,
    status: "open",
    assigned_to_user_id: body.assigned_to_user_id || user.id,
    created_by_user_id: user.id,
  };

  const { data: task, error: taskError } = await supabase.from("agent_tasks").insert(payload).select().single();
  if (taskError) return jsonError(`Could not create task: ${taskError.message}`, 400);

  await supabase.from("agent_activity_log").insert({
    business_id: body.business_id,
    agent_task_id: task.agent_task_id,
    job_id: payload.job_id,
    quote_id: payload.quote_id,
    actor_user_id: user.id,
    actor_type: "user",
    action: "task_created",
    details: {
      task_type: taskType,
      priority,
      title,
    },
  });

  await recordUsageEvent(supabase, {
    businessId: body.business_id,
    userId: user.id,
    eventType: "task_created",
    jobId: payload.job_id,
    quoteId: payload.quote_id,
    metadata: {
      task_type: taskType,
      priority,
    },
  });

  return Response.json({ task });
}
