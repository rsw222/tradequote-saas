import { tradeKnowledge } from "@/lib/knowledgeBase";
import { getAuthenticatedSupabase, jsonError, limitText, recordUsageEvent } from "../../_shared";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function getCorpus(input) {
  return [
    input.trade_type,
    input.urgency,
    input.client_name,
    input.site_address,
    input.description,
    input.voice_note,
    input.measurements ? JSON.stringify(input.measurements) : "",
    ...(input.photo_names || []),
    ...(input.line_items || []).map((item) => `${item.description} ${item.type}`),
  ].join(" ");
}

function retrieveKnowledge(input) {
  const corpus = getCorpus(input).toLowerCase();
  const tokens = new Set(tokenize(corpus));
  const tradeType = input.trade_type || "Other";
  const urgency = String(input.urgency || "Standard").toLowerCase();

  return tradeKnowledge
    .map((entry) => {
      const tradeMatch = entry.trades.includes(tradeType);
      const keywordScore = entry.keywords.reduce((score, keyword) => {
        const normalized = keyword.toLowerCase();
        return score + (corpus.includes(normalized) || tokens.has(normalized) ? 3 : 0);
      }, 0);
      const urgencyScore = urgency !== "standard" && entry.id === "pricing-urgent" ? 4 : 0;
      const universalScore = entry.trades.length > 3 ? 1 : 0;
      return { ...entry, score: (tradeMatch ? 5 : -3) + keywordScore + urgencyScore + universalScore };
    })
    .filter((entry) => entry.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function question(question, reason, priority = "normal") {
  return { question, reason, priority };
}

function buildQuestions(input, matches) {
  const questions = [];
  const hasMeasurementArea = Number(input.measurements?.paintable_area_sqm || input.measurements?.area_sqm || input.measurements?.floor_area_sqm || 0) > 0;
  if (!input.site_address) questions.push(question("Confirm the site address and site access details.", "Site access can change labour time, parking, materials movement, and safety requirements.", "high"));
  if (!input.description) questions.push(question("Ask for a clearer description of the expected outcome.", "The quote needs a defined scope before materials and labour can be priced.", "high"));
  if (!input.voice_note) questions.push(question("Capture a short voice note from the site inspection.", "Voice notes preserve details that are easy to miss when quoting later."));
  if (!input.photo_count) questions.push(question("Upload photos of the work area, access path, and any visible damage.", "Photos improve scope confidence and reduce hidden-condition risk.", "high"));
  if (!hasMeasurementArea && !/\b(mm|cm|m|metre|meter|sqm|m2|length|width|height|size|measure)\b/i.test(getCorpus(input))) {
    questions.push(question("Confirm approximate measurements or dimensions.", "Materials and labour allowances are only rough until key measurements are known.", "high"));
  }
  if (!/\b(supply|install|repair|replace|remove|labour only|labor only)\b/i.test(getCorpus(input))) {
    questions.push(question("Confirm whether this is supply-and-install, repair, replacement, or labour only.", "Scope type affects materials, warranty, exclusions, and price."));
  }

  matches.forEach((match) => {
    match.checks.forEach((check) => questions.push(question(check, match.guidance)));
  });

  const seen = new Set();
  return questions
    .filter((item) => {
      const key = item.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function buildQuoteSuggestions(input, matches) {
  const existing = new Set((input.line_items || []).map((item) => String(item.description || "").trim().toLowerCase()));
  const suggestions = [];

  matches.forEach((match) => {
    match.items.forEach((item) => {
      if (!existing.has(item.description.toLowerCase()) && !suggestions.some((suggestion) => suggestion.description === item.description)) {
        suggestions.push({
          suggestion_type: "quote_item",
          description: item.description,
          item_type: item.type,
          quantity: 1,
          unit: "allowance",
          unit_price: item.amount,
          amount: item.amount,
          confidence: 0.72,
          reason: match.guidance,
        });
      }
    });
  });

  if (input.trade_type === "Painting" && Number(input.measurements?.paintable_area_sqm || 0) > 0) {
    const area = Number(input.measurements.paintable_area_sqm);
    const litres = Number(input.measurements.paint_litres || 0);
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: `Painting labour - ${area.toFixed(1)} sqm`,
      item_type: "labour",
      quantity: area,
      unit: "sqm",
      unit_price: 18,
      amount: Math.round(area * 18),
      confidence: 0.78,
      reason: "Calculated from confirmed painting measurements supplied in the quote form.",
    });
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: `Paint allowance - ${litres.toFixed(1)} L`,
      item_type: "materials",
      quantity: litres,
      unit: "litre",
      unit_price: 24,
      amount: Math.round(litres * 24),
      confidence: 0.74,
      reason: "Calculated from paintable area, number of coats, and coverage rate.",
    });
  }

  if (input.trade_type === "Carpentry" && Number(input.measurements?.area_sqm || 0) > 0) {
    const area = Number(input.measurements.area_sqm);
    const materialArea = Number(input.measurements.material_area_sqm || area);
    const materialAmount = Number(input.measurements.material_amount || Math.round(materialArea * 65));
    const labourAmount = Number(input.measurements.labour_amount || Math.round(area * 55));
    const trimAllowance = Number(input.measurements.trim_allowance || 0);
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: `Carpentry installation labour - ${area.toFixed(1)} sqm`,
      item_type: "labour",
      quantity: area,
      unit: "sqm",
      unit_price: 55,
      amount: labourAmount,
      confidence: 0.76,
      reason: "Calculated from confirmed carpentry/flooring area supplied in the quote form.",
    });
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: `Timber/flooring materials - ${materialArea.toFixed(1)} sqm incl. wastage`,
      item_type: "materials",
      quantity: materialArea,
      unit: "sqm",
      unit_price: materialArea ? Math.round(materialAmount / materialArea) : 65,
      amount: materialAmount,
      confidence: 0.72,
      reason: "Calculated from area, wastage percentage, and material rate.",
    });
    if (trimAllowance > 0) {
      suggestions.unshift({
        suggestion_type: "quote_item",
        description: "Trims, fixings, and consumables allowance",
        item_type: "materials",
        quantity: 1,
        unit: "allowance",
        unit_price: trimAllowance,
        amount: trimAllowance,
        confidence: 0.68,
        reason: "Allowance from the carpentry measurement calculator.",
      });
    }
  }

  if (input.trade_type === "HVAC" && Number(input.measurements?.floor_area_sqm || 0) > 0) {
    const capacityKw = Number(input.measurements.indicative_capacity_kw || 0);
    const installAmount = Number(input.measurements.install_amount || 850);
    const materialsAllowance = Number(input.measurements.materials_allowance || 320);
    const commissioningAmount = Number(input.measurements.commissioning_amount || 140);
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: `HVAC install labour - indicative ${capacityKw.toFixed(1)} kW room`,
      item_type: "labour",
      quantity: 1,
      unit: "allowance",
      unit_price: installAmount,
      amount: installAmount,
      confidence: 0.62,
      reason: "Calculated from room floor area and install complexity. Confirm heat load and unit selection before final pricing.",
    });
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: "HVAC pipework, mounting, and consumables allowance",
      item_type: "materials",
      quantity: 1,
      unit: "allowance",
      unit_price: materialsAllowance,
      amount: materialsAllowance,
      confidence: 0.6,
      reason: "Allowance from HVAC room sizing calculator.",
    });
    suggestions.unshift({
      suggestion_type: "quote_item",
      description: "HVAC commissioning and handover",
      item_type: "labour",
      quantity: 1,
      unit: "allowance",
      unit_price: commissioningAmount,
      amount: commissioningAmount,
      confidence: 0.66,
      reason: "Standard commissioning allowance after installation.",
    });
  }

  if (!suggestions.some((item) => item.description.toLowerCase().includes("contingency"))) {
    suggestions.push({
      suggestion_type: "risk_allowance",
      description: "Hidden conditions / variation allowance",
      item_type: "other",
      quantity: 1,
      unit: "allowance",
      unit_price: 120,
      amount: 120,
      confidence: 0.55,
      reason: "Use only if site access, measurements, or hidden conditions are not fully confirmed.",
    });
  }

  return suggestions.slice(0, 8);
}

function buildMaterialSuggestions(input, matches) {
  const materialSuggestions = [];
  const corpus = getCorpus(input).toLowerCase();
  const generic = {
    Plumbing: ["Replacement fittings", "Pipe/flex connector allowance", "Sealants and consumables"],
    Electrical: ["Switch/outlet parts allowance", "Cable and terminals allowance", "Testing labels and consumables"],
    Carpentry: ["Timber allowance", "Hardware and fixings", "Adhesive/filler consumables"],
    Builder: ["Framing/material allowance", "Fixings and sealants", "Waste disposal allowance"],
    "Engineering / Fabrication": ["Steel/aluminium material allowance", "Welding consumables", "Fasteners and finishing allowance"],
    HVAC: ["Ducting or pipework allowance", "Mounting hardware", "Sealants and commissioning consumables"],
    Painting: ["Paint allowance", "Patching compound", "Masking and protection materials"],
    Roofing: ["Flashing/sealant allowance", "Fixings", "Access and safety allowance"],
    Landscaping: ["Soil/mulch/turf allowance", "Delivery allowance", "Green waste removal"],
  };

  if (input.trade_type === "Painting" && Number(input.measurements?.paint_litres || 0) > 0) {
    materialSuggestions.push({
      material_name: "Paint",
      quantity: Number(input.measurements.paint_litres),
      unit: "litre",
      allowance_amount: Math.round(Number(input.measurements.paint_litres) * 24),
      confidence: 0.78,
      reason: "Calculated from paintable area, coats, and paint coverage.",
    });
  }

  if (input.trade_type === "Carpentry" && Number(input.measurements?.material_area_sqm || 0) > 0) {
    materialSuggestions.push({
      material_name: "Timber/flooring/decking material",
      quantity: Number(input.measurements.material_area_sqm),
      unit: "sqm",
      allowance_amount: Number(input.measurements.material_amount || 0),
      confidence: 0.74,
      reason: "Calculated from install area plus wastage.",
    });
    if (Number(input.measurements.trim_allowance || 0) > 0) {
      materialSuggestions.push({
        material_name: "Trims, fixings, and consumables",
        quantity: 1,
        unit: "allowance",
        allowance_amount: Number(input.measurements.trim_allowance),
        confidence: 0.68,
        reason: "Allowance from the carpentry measurement calculator.",
      });
    }
  }

  if (input.trade_type === "HVAC" && Number(input.measurements?.floor_area_sqm || 0) > 0) {
    materialSuggestions.push({
      material_name: "Indicative HVAC capacity",
      quantity: Number(input.measurements.indicative_capacity_kw || 0),
      unit: "kW",
      allowance_amount: null,
      confidence: 0.58,
      reason: "Indicative sizing from room area. Confirm heat load, insulation, glazing, orientation, and equipment selection.",
    });
    materialSuggestions.push({
      material_name: "Pipework, mounting, and consumables",
      quantity: 1,
      unit: "allowance",
      allowance_amount: Number(input.measurements.materials_allowance || 0),
      confidence: 0.62,
      reason: "Allowance from HVAC room sizing calculator.",
    });
  }

  (generic[input.trade_type] || ["Materials allowance", "Fixings and consumables", "Waste/disposal allowance"]).forEach((name, index) => {
    materialSuggestions.push({
      material_name: name,
      quantity: null,
      unit: "allowance",
      allowance_amount: index === 0 ? 180 : 90,
      confidence: corpus.includes(name.toLowerCase().split(" ")[0]) ? 0.7 : 0.5,
      reason: "Starter material allowance generated from trade type and job scope. Confirm quantities before final pricing.",
    });
  });

  matches.forEach((match) => {
    if (match.guidance.toLowerCase().includes("materials") && !materialSuggestions.some((item) => item.material_name === "Trade-specific material allowance")) {
      materialSuggestions.push({
        material_name: "Trade-specific material allowance",
        quantity: null,
        unit: "allowance",
        allowance_amount: 160,
        confidence: 0.62,
        reason: match.guidance,
      });
    }
  });

  return materialSuggestions.slice(0, 6);
}

function buildAssumptions(input, questions) {
  const assumptions = [
    "Final price may change if confirmed measurements, access, or hidden site conditions differ from supplied information.",
    "Materials are estimated as allowances until supplier costs and quantities are confirmed.",
  ];
  if (!input.photo_count) assumptions.push("No photos were available for visual scope confirmation.");
  if (!input.voice_note) assumptions.push("No voice/site note was available for inspection context.");
  if (input.trade_type === "Painting" && Number(input.measurements?.paintable_area_sqm || 0) > 0) {
    assumptions.push(`Painting estimate is based on ${Number(input.measurements.paintable_area_sqm).toFixed(1)} sqm paintable area and ${Number(input.measurements.paint_litres || 0).toFixed(1)} L paint allowance.`);
  }
  if (input.trade_type === "Carpentry" && Number(input.measurements?.area_sqm || 0) > 0) {
    assumptions.push(`Carpentry estimate is based on ${Number(input.measurements.area_sqm).toFixed(1)} sqm install area and ${Number(input.measurements.material_area_sqm || 0).toFixed(1)} sqm material allowance including wastage.`);
  }
  if (input.trade_type === "HVAC" && Number(input.measurements?.floor_area_sqm || 0) > 0) {
    assumptions.push(`HVAC estimate is based on ${Number(input.measurements.floor_area_sqm).toFixed(1)} sqm / ${Number(input.measurements.room_volume_m3 || 0).toFixed(1)} m3 room size and indicative ${Number(input.measurements.indicative_capacity_kw || 0).toFixed(1)} kW guidance.`);
    assumptions.push("HVAC capacity is indicative only and should be confirmed against insulation, glazing, aspect, climate, heat load, and selected unit specifications.");
  }
  if (questions.some((item) => item.priority === "high")) assumptions.push("High-priority missing information should be answered before sending a final quote.");
  return [...new Set(assumptions)];
}

function buildRisks(input, questions) {
  const risks = [];
  if (!input.site_address) risks.push("Access and travel risk");
  if (!input.photo_count) risks.push("Visual scope not confirmed");
  if (questions.some((item) => item.question.toLowerCase().includes("measurement"))) risks.push("Measurement uncertainty");
  if (String(input.urgency || "").toLowerCase() !== "standard") risks.push("Urgent scheduling risk");
  return risks.length ? risks : ["Normal quoting risk"];
}

function buildDiagram(input) {
  return {
    diagram_type: "scope_sketch",
    title: `${input.trade_type || "Trade"} scope sketch`,
    description: "Starter diagram placeholder. Add confirmed measurements to generate a more complete diagram.",
    diagram_data: {
      version: 1,
      nodes: [
        { id: "site", label: input.site_address || "Site", type: "location" },
        { id: "work_area", label: input.description ? "Work area from job notes" : "Work area pending", type: "scope" },
        { id: "materials", label: "Materials allowance", type: "materials" },
      ],
      edges: [
        { from: "site", to: "work_area", label: "access" },
        { from: "work_area", to: "materials", label: "requires" },
      ],
    },
  };
}

export async function POST(request) {
  const { supabase, user, error } = await getAuthenticatedSupabase(request, 15);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid AI scope payload.");
  if (!body.business_id) return jsonError("Business is required.");

  const input = {
    business_id: body.business_id,
    job_id: body.job_id || null,
    quote_id: body.quote_id || null,
    client_name: limitText(body.client_name),
    site_address: limitText(body.site_address),
    trade_type: limitText(body.trade_type, "Other"),
    urgency: limitText(body.urgency, "Standard"),
    description: limitText(body.description),
    voice_note: limitText(body.voice_note),
    measurements: body.measurements && typeof body.measurements === "object" ? body.measurements : null,
    photo_count: Number(body.photo_count || 0),
    photo_names: Array.isArray(body.photo_names) ? body.photo_names.map((name) => limitText(name)).filter(Boolean).slice(0, 20) : [],
    line_items: Array.isArray(body.line_items) ? body.line_items.slice(0, 80) : [],
  };

  const matches = retrieveKnowledge(input);
  const questions = buildQuestions(input, matches);
  const quoteSuggestions = buildQuoteSuggestions(input, matches);
  const materialSuggestions = buildMaterialSuggestions(input, matches);
  const assumptions = buildAssumptions(input, questions);
  const risks = buildRisks(input, questions);
  const diagram = buildDiagram(input);
  const confidence = Math.max(0.35, Math.min(0.9, 0.82 - questions.filter((item) => item.priority === "high").length * 0.11 - questions.length * 0.025));
  const summary = [
    `${input.trade_type} ${input.urgency}`.trim(),
    input.client_name ? `for ${input.client_name}` : "",
    input.description ? `: ${input.description}` : "- scope needs more detail.",
  ]
    .filter(Boolean)
    .join(" ");

  const outputSnapshot = {
    matches: matches.map((match) => ({ id: match.id, title: match.title, score: match.score, guidance: match.guidance })),
    questions,
    quote_suggestions: quoteSuggestions,
    material_suggestions: materialSuggestions,
    assumptions,
    risks,
    diagram,
  };

  const { data: run, error: runError } = await supabase
    .from("ai_runs")
    .insert({
      business_id: input.business_id,
      job_id: input.job_id,
      quote_id: input.quote_id,
      user_id: user.id,
      run_type: "scope_check",
      status: "completed",
      confidence,
      summary,
      missing_info: questions,
      assumptions,
      risks,
      model_provider: "local-rules",
      model_name: "tradequote-scope-check-v1",
      input_snapshot: input,
      output_snapshot: outputSnapshot,
    })
    .select()
    .single();

  if (runError) return jsonError(`Could not save AI run: ${runError.message}`, 400);

  const aiRunId = run.ai_run_id;

  const [questionResult, quoteResult, materialResult, assumptionResult, diagramResult] = await Promise.all([
    questions.length
      ? supabase.from("ai_questions").insert(
          questions.map((item) => ({
            ai_run_id: aiRunId,
            business_id: input.business_id,
            job_id: input.job_id,
            quote_id: input.quote_id,
            question: item.question,
            reason: item.reason,
            priority: item.priority,
          })),
        )
      : Promise.resolve({ error: null }),
    quoteSuggestions.length
      ? supabase.from("ai_quote_suggestions").insert(
          quoteSuggestions.map((item) => ({
            ai_run_id: aiRunId,
            business_id: input.business_id,
            job_id: input.job_id,
            quote_id: input.quote_id,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
    materialSuggestions.length
      ? supabase.from("ai_material_suggestions").insert(
          materialSuggestions.map((item) => ({
            ai_run_id: aiRunId,
            business_id: input.business_id,
            job_id: input.job_id,
            quote_id: input.quote_id,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
    assumptions.length
      ? supabase.from("quote_assumptions").insert(
          assumptions.map((assumption) => ({
            ai_run_id: aiRunId,
            business_id: input.business_id,
            job_id: input.job_id,
            quote_id: input.quote_id,
            assumption,
            risk_level: risks.length > 2 ? "high" : "medium",
          })),
        )
      : Promise.resolve({ error: null }),
    supabase.from("ai_diagrams").insert({
      ai_run_id: aiRunId,
      business_id: input.business_id,
      job_id: input.job_id,
      quote_id: input.quote_id,
      ...diagram,
    }),
  ]);

  const insertError = [questionResult.error, quoteResult.error, materialResult.error, assumptionResult.error, diagramResult.error].find(Boolean);
  if (insertError) return jsonError(`AI run saved, but suggestion details failed: ${insertError.message}`, 400);

  await recordUsageEvent(supabase, {
    businessId: input.business_id,
    userId: user.id,
    eventType: "ai_scope_check",
    jobId: input.job_id,
    quoteId: input.quote_id,
    metadata: {
      provider: "local-rules",
      confidence,
      question_count: questions.length,
      quote_suggestion_count: quoteSuggestions.length,
    },
  });

  return Response.json({
    ai_run: run,
    summary,
    confidence,
    questions,
    quote_suggestions: quoteSuggestions,
    material_suggestions: materialSuggestions,
    assumptions,
    risks,
    diagram,
    text: [
      "AI Scope Check",
      "",
      `Summary: ${summary}`,
      `Confidence: ${Math.round(confidence * 100)}%`,
      "",
      "Questions to answer:",
      questions.length ? questions.map((item) => `- ${item.question}`).join("\n") : "- No critical questions found.",
      "",
      "Suggested quote items:",
      quoteSuggestions.map((item) => `- ${item.description}: ${currency.format(Number(item.amount || 0))}`).join("\n"),
      "",
      "Suggested materials:",
      materialSuggestions.map((item) => `- ${item.material_name}: ${item.allowance_amount ? currency.format(Number(item.allowance_amount)) : "Confirm quantity"}`).join("\n"),
      "",
      "Risks and assumptions:",
      [...risks, ...assumptions].map((item) => `- ${item}`).join("\n"),
    ].join("\n"),
  });
}
