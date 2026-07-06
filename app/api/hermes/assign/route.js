import { getAuthenticatedSupabase, jsonError } from "../../_shared";

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 20);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid Hermes assignment payload.");
  if (!body.business_id || !body.agent_task_id) return jsonError("Business and task are required.");

  const hermesUrl = process.env.HERMES_API_URL || process.env.HERMES_WEBHOOK_URL;
  const hermesKey = process.env.HERMES_API_KEY || process.env.HERMES_WEBHOOK_TOKEN;

  const { data: task, error: taskError } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("business_id", body.business_id)
    .eq("agent_task_id", body.agent_task_id)
    .single();

  if (taskError) return jsonError(`Could not load task: ${taskError.message}`, 400);

  const [{ data: business }, { data: job }, { data: quote }] = await Promise.all([
    supabase.from("businesses").select("*").eq("business_id", body.business_id).single(),
    task.job_id ? supabase.from("jobs").select("*").eq("job_id", task.job_id).eq("business_id", body.business_id).single() : Promise.resolve({ data: null }),
    task.quote_id ? supabase.from("quotes").select("*").eq("quote_id", task.quote_id).eq("business_id", body.business_id).single() : Promise.resolve({ data: null }),
  ]);

  let client = null;
  if (quote?.client_id || job?.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("client_id", quote?.client_id || job?.client_id)
      .eq("business_id", body.business_id)
      .single();
    client = data || null;
  }

  const assignment = {
    source: "tradequote",
    assigned_by_user_id: user.id,
    business,
    task,
    job,
    quote,
    client,
  };

  if (!hermesUrl) {
    await supabase.from("agent_activity_log").insert({
      business_id: body.business_id,
      agent_task_id: task.agent_task_id,
      job_id: task.job_id,
      quote_id: task.quote_id,
      actor_user_id: user.id,
      actor_type: "system",
      action: "hermes_assignment_not_configured",
      details: {
        required_env: ["HERMES_API_URL or HERMES_WEBHOOK_URL"],
      },
    });

    return jsonError("Hermes is not configured. Add HERMES_API_URL or HERMES_WEBHOOK_URL to .env.local and restart the server.", 501);
  }

  const response = await fetch(hermesUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(hermesKey ? { Authorization: `Bearer ${hermesKey}` } : {}),
    },
    body: JSON.stringify(assignment),
  });

  const responseText = await response.text();
  let hermesResponse = responseText;
  try {
    hermesResponse = JSON.parse(responseText);
  } catch {
    // Keep plain text response.
  }

  await supabase.from("agent_activity_log").insert({
    business_id: body.business_id,
    agent_task_id: task.agent_task_id,
    job_id: task.job_id,
    quote_id: task.quote_id,
    actor_user_id: user.id,
    actor_type: "external_agent",
    action: response.ok ? "hermes_assignment_sent" : "hermes_assignment_failed",
    details: {
      status: response.status,
      response: hermesResponse,
    },
  });

  if (!response.ok) {
    return jsonError(`Hermes assignment failed: ${responseText || response.statusText}`, 502);
  }

  const { data: updatedTask } = await supabase
    .from("agent_tasks")
    .update({ status: "in_progress" })
    .eq("agent_task_id", task.agent_task_id)
    .eq("business_id", body.business_id)
    .select()
    .single();

  return Response.json({
    task: updatedTask || task,
    hermes: hermesResponse,
  });
}
