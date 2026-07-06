import { allowedPhotoTypes, apiLimits, assertBusinessFeature, getAuthenticatedSupabase, jsonError, recordUsageEvent, sanitizeFileName } from "../../_shared";

const jobPhotosBucket = "job_photos";

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 20);
  if (error) return error;

  const formData = await request.formData();
  const businessId = formData.get("business_id");
  const jobId = formData.get("job_id");
  const replaceExisting = formData.get("replace_existing") === "true";
  const files = formData.getAll("photos").filter((file) => file && typeof file === "object" && "size" in file);

  if (!businessId || !jobId) return jsonError("Business and job are required.");
  if (!files.length) return Response.json({ savedCount: 0 });

  const { error: entitlementError } = await assertBusinessFeature(supabase, businessId, "photos");
  if (entitlementError) return entitlementError;

  if (files.length > apiLimits.maxPhotoFiles) return jsonError(`Only ${apiLimits.maxPhotoFiles} photos can be uploaded per quote.`, 413);

  if (replaceExisting) {
    const { error: deleteError } = await supabase.from("job_photos").delete().eq("job_id", jobId).eq("business_id", businessId);
    if (deleteError) return jsonError(`Could not replace old photos: ${deleteError.message}`, 400);
  }

  const rows = [];

  for (const [index, file] of files.entries()) {
    if (!file.type?.startsWith("image/") || !allowedPhotoTypes.has(file.type)) {
      return jsonError(`${file.name} is not a supported image type.`, 415);
    }

    if (file.size > apiLimits.maxPhotoSizeBytes) {
      return jsonError(`${file.name} is larger than 10 MB.`, 413);
    }

    const fileName = sanitizeFileName(file.name);
    const storagePath = `${businessId}/${jobId}/${Date.now()}-${index}-${fileName}`;
    const { error: uploadError } = await supabase.storage.from(jobPhotosBucket).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) return jsonError(`Photo upload failed: ${uploadError.message}`, 400);

    rows.push({
      business_id: businessId,
      job_id: jobId,
      file_name: file.name,
      storage_path: storagePath,
    });
  }

  const { error: insertError } = await supabase.from("job_photos").insert(rows);
  if (insertError) return jsonError(`Photo metadata failed: ${insertError.message}`, 400);

  await recordUsageEvent(supabase, {
    businessId,
    userId: user.id,
    eventType: "photo_uploaded",
    jobId,
    quantity: rows.length,
  });

  return Response.json({ savedCount: rows.length });
}
