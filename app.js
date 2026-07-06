const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const state = {
  lineItems: [],
  photos: [],
  voiceNote: "",
  quoteNumber: `QT-${String(Math.floor(Math.random() * 9000) + 1000)}`,
};

const els = {
  form: document.querySelector("#quoteForm"),
  clientName: document.querySelector("#clientName"),
  clientPhone: document.querySelector("#clientPhone"),
  siteAddress: document.querySelector("#siteAddress"),
  tradeType: document.querySelector("#tradeType"),
  urgency: document.querySelector("#urgency"),
  jobDescription: document.querySelector("#jobDescription"),
  photoInput: document.querySelector("#photoInput"),
  photoPreview: document.querySelector("#photoPreview"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceButtonText: document.querySelector("#voiceButtonText"),
  voiceStatus: document.querySelector("#voiceStatus"),
  lineItems: document.querySelector("#lineItems"),
  addLineItem: document.querySelector("#addLineItem"),
  terms: document.querySelector("#terms"),
  quoteNumber: document.querySelector("#quoteNumber"),
  quoteStatus: document.querySelector("#quoteStatus"),
  previewClient: document.querySelector("#previewClient"),
  previewAddress: document.querySelector("#previewAddress"),
  previewTrade: document.querySelector("#previewTrade"),
  previewScope: document.querySelector("#previewScope"),
  previewVoice: document.querySelector("#previewVoice"),
  labourTotal: document.querySelector("#labourTotal"),
  materialsTotal: document.querySelector("#materialsTotal"),
  otherTotal: document.querySelector("#otherTotal"),
  gstTotal: document.querySelector("#gstTotal"),
  grandTotal: document.querySelector("#grandTotal"),
  generateButton: document.querySelector("#generateButton"),
  copyButton: document.querySelector("#copyButton"),
  generatedQuote: document.querySelector("#generatedQuote"),
  installButton: document.querySelector("#installButton"),
  aiAssistButton: document.querySelector("#aiAssistButton"),
  retrievedContext: document.querySelector("#retrievedContext"),
  applySuggestionsButton: document.querySelector("#applySuggestionsButton"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  aiOutput: document.querySelector("#aiOutput"),
};

let deferredInstallPrompt = null;
let recognition = null;
let isRecording = false;
let latestAssistance = null;

function createDefaultItems() {
  state.lineItems = [
    { id: crypto.randomUUID(), description: "Site inspection and labour", type: "labour", amount: 220 },
    { id: crypto.randomUUID(), description: "Materials allowance", type: "materials", amount: 180 },
    { id: crypto.randomUUID(), description: "Call-out / admin", type: "other", amount: 85 },
  ];
}

function renderLineItems() {
  els.lineItems.innerHTML = "";

  state.lineItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "line-item";
    row.innerHTML = `
      <label>
        Description
        <input data-field="description" value="${escapeHtml(item.description)}" placeholder="Item description">
      </label>
      <label>
        Type
        <select data-field="type">
          <option value="labour">Labour</option>
          <option value="materials">Materials</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Amount
        <input data-field="amount" type="number" min="0" step="0.01" value="${Number(item.amount || 0)}">
      </label>
      <button class="remove-item" type="button" title="Remove item">x</button>
    `;

    row.querySelector("select").value = item.type;
    row.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const value = input.dataset.field === "amount" ? Number(input.value || 0) : input.value;
        item[input.dataset.field] = value;
        updatePreview();
      });
    });

    row.querySelector(".remove-item").addEventListener("click", () => {
      state.lineItems = state.lineItems.filter((lineItem) => lineItem.id !== item.id);
      renderLineItems();
      updatePreview();
    });

    els.lineItems.append(row);
  });
}

function addLineItem() {
  state.lineItems.push({
    id: crypto.randomUUID(),
    description: "",
    type: "labour",
    amount: 0,
  });
  renderLineItems();
}

function calculateTotals() {
  const totals = state.lineItems.reduce(
    (acc, item) => {
      acc[item.type] += Number(item.amount || 0);
      return acc;
    },
    { labour: 0, materials: 0, other: 0 },
  );
  const subtotal = totals.labour + totals.materials + totals.other;
  const gst = subtotal * 0.1;
  return { ...totals, gst, grand: subtotal + gst };
}

function getJobCorpus() {
  return [
    els.tradeType.value,
    els.urgency.value,
    els.jobDescription.value,
    state.voiceNote,
    state.photos.map((photo) => photo.name).join(" "),
    state.lineItems.map((item) => `${item.description} ${item.type}`).join(" "),
  ].join(" ");
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function retrieveKnowledge() {
  const trade = els.tradeType.value;
  const urgency = els.urgency.value.toLowerCase();
  const corpus = getJobCorpus().toLowerCase();
  const tokens = new Set(tokenize(corpus));

  return (window.TRADE_KNOWLEDGE || [])
    .map((entry) => {
      const tradeMatch = entry.trades.includes(trade);
      const keywordScore = entry.keywords.reduce((score, keyword) => {
        const normalized = keyword.toLowerCase();
        return score + (corpus.includes(normalized) || tokens.has(normalized) ? 3 : 0);
      }, 0);
      const urgencyScore = urgency !== "standard" && entry.id === "pricing-urgent" ? 4 : 0;
      const universalScore = entry.trades.length > 3 ? 1 : 0;
      const score = (tradeMatch ? 5 : -3) + keywordScore + urgencyScore + universalScore;
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildMissingQuestions(matches) {
  const questions = new Set();
  const description = els.jobDescription.value.trim();

  if (!els.siteAddress.value.trim()) questions.add("Confirm the site address and access details.");
  if (!description) questions.add("Ask the client for a clear description of the issue and expected outcome.");
  if (state.photos.length === 0) questions.add("Ask for photos of the problem area, access path, and any visible damage.");
  if (!state.voiceNote) questions.add("Capture a voice note from the tradie after inspection to preserve site observations.");

  matches.forEach((match) => match.checks.forEach((check) => questions.add(check)));
  return Array.from(questions).slice(0, 7);
}

function buildSuggestedItems(matches) {
  const existing = new Set(state.lineItems.map((item) => item.description.trim().toLowerCase()));
  const suggestions = [];

  matches.forEach((match) => {
    match.items.forEach((item) => {
      if (!existing.has(item.description.toLowerCase()) && !suggestions.some((suggestion) => suggestion.description === item.description)) {
        suggestions.push({ ...item, source: match.title });
      }
    });
  });

  return suggestions.slice(0, 8);
}

function buildAiPrompt(matches, questions, suggestions) {
  const context = matches.map((match) => `- ${match.title}: ${match.guidance}`).join("\n");
  const suggestedItems = suggestions
    .map((item) => `- ${item.description} (${item.type}) ${currency.format(item.amount)} from ${item.source}`)
    .join("\n");

  return [
    "You are an expert Australian trade quoting assistant. Use only the provided job information and retrieved quoting guidance.",
    "",
    "Job information:",
    `Trade: ${els.tradeType.value}`,
    `Urgency: ${els.urgency.value}`,
    `Client request: ${els.jobDescription.value.trim() || "Not provided"}`,
    `Voice note: ${state.voiceNote || "Not provided"}`,
    `Photos supplied: ${state.photos.length}`,
    `Existing quote items: ${state.lineItems.map((item) => `${item.description} ${currency.format(Number(item.amount || 0))}`).join("; ")}`,
    "",
    "Retrieved guidance:",
    context || "- No matching guidance retrieved.",
    "",
    "Suggested quote items:",
    suggestedItems || "- No suggested items.",
    "",
    "Missing information to ask:",
    questions.map((question) => `- ${question}`).join("\n"),
    "",
    "Return: scope summary, recommended quote line items, exclusions/variation notes, client questions, and confidence/risk level.",
  ].join("\n");
}

function generateAiAssistance() {
  const matches = retrieveKnowledge();
  const questions = buildMissingQuestions(matches);
  const suggestions = buildSuggestedItems(matches);
  const prompt = buildAiPrompt(matches, questions, suggestions);
  const riskLevel = questions.length > 4 ? "Medium to high" : "Low to medium";
  const output = [
    "AI quote recommendations",
    "",
    `Risk level: ${riskLevel}`,
    `Retrieved references: ${matches.length}`,
    "",
    "Recommended quote items:",
    suggestions.length
      ? suggestions.map((item) => `- ${item.description}: ${currency.format(item.amount)} (${item.type})`).join("\n")
      : "- Current quote items look sufficient for the information provided.",
    "",
    "Client questions / checks:",
    questions.map((question) => `- ${question}`).join("\n"),
    "",
    "Scope and terms advice:",
    matches.length
      ? matches.map((match) => `- ${match.guidance}`).join("\n")
      : "- Add more job detail, photos, or a voice note so the assistant can retrieve better guidance.",
    "",
    "LLM prompt prepared:",
    prompt,
  ].join("\n");

  latestAssistance = { matches, questions, suggestions, prompt, output };
  renderRetrievedContext(matches);
  els.aiOutput.value = output;
}

function renderRetrievedContext(matches) {
  els.retrievedContext.innerHTML = "";

  if (!matches.length) {
    els.retrievedContext.innerHTML = '<div class="context-pill"><strong>No guidance found yet</strong><span>Add more job detail or a voice note.</span></div>';
    return;
  }

  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "context-pill";
    item.innerHTML = `<strong>${escapeHtml(match.title)}</strong><span>Score ${match.score} - ${escapeHtml(match.guidance)}</span>`;
    els.retrievedContext.append(item);
  });
}

function applySuggestedItems() {
  if (!latestAssistance) generateAiAssistance();
  latestAssistance.suggestions.forEach((item) => {
    state.lineItems.push({
      id: crypto.randomUUID(),
      description: item.description,
      type: item.type,
      amount: item.amount,
    });
  });
  renderLineItems();
  updatePreview();
  generateAiAssistance();
}

async function requestServerLlm() {
  if (!latestAssistance) generateAiAssistance();

  try {
    const response = await fetch("/api/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: latestAssistance.prompt }),
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data.provider === "local-rag-only") return;

    els.aiOutput.value = [
      "LLM response",
      "",
      data.text || "The LLM returned no recommendation.",
      "",
      "Local RAG context used:",
      latestAssistance.matches.map((match) => `- ${match.title}`).join("\n") || "- None",
    ].join("\n");
  } catch {
    // Static preview servers do not provide the LLM endpoint.
  }
}

function updatePreview() {
  const totals = calculateTotals();
  const scope = els.jobDescription.value.trim();

  els.quoteNumber.textContent = state.quoteNumber;
  els.previewClient.textContent = els.clientName.value.trim() || "Client not set";
  els.previewAddress.textContent = els.siteAddress.value.trim() || "Site address pending";
  els.previewTrade.textContent = `${els.tradeType.value} - ${els.urgency.value}`;
  els.previewScope.textContent = scope || "Add the client request to generate a clearer quote scope.";
  els.previewVoice.textContent = state.voiceNote || "No voice note captured yet.";
  els.labourTotal.textContent = currency.format(totals.labour);
  els.materialsTotal.textContent = currency.format(totals.materials);
  els.otherTotal.textContent = currency.format(totals.other);
  els.gstTotal.textContent = currency.format(totals.gst);
  els.grandTotal.textContent = currency.format(totals.grand);
  els.quoteStatus.textContent = totals.grand > 0 ? "Ready" : "Draft";
}

function renderPhotos(files) {
  state.photos = Array.from(files);
  els.photoPreview.innerHTML = "";

  state.photos.forEach((file) => {
    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
    els.photoPreview.append(img);
  });
}

function buildQuoteText() {
  const totals = calculateTotals();
  const lines = state.lineItems
    .filter((item) => item.description.trim() || Number(item.amount) > 0)
    .map((item) => `- ${item.description || "Quote item"} (${item.type}): ${currency.format(Number(item.amount || 0))}`)
    .join("\n");

  return [
    `${state.quoteNumber} - ${els.tradeType.value} quote`,
    "",
    `Client: ${els.clientName.value.trim() || "Not provided"}`,
    `Phone: ${els.clientPhone.value.trim() || "Not provided"}`,
    `Site: ${els.siteAddress.value.trim() || "Not provided"}`,
    `Urgency: ${els.urgency.value}`,
    "",
    "Scope of work:",
    els.jobDescription.value.trim() || "Scope to be confirmed from client information.",
    "",
    state.voiceNote ? `Voice note:\n${state.voiceNote}\n` : "",
    `Photos supplied: ${state.photos.length}`,
    "",
    "Items:",
    lines || "- No quote items added yet.",
    "",
    `Subtotal: ${currency.format(totals.labour + totals.materials + totals.other)}`,
    `GST: ${currency.format(totals.gst)}`,
    `Total: ${currency.format(totals.grand)}`,
    "",
    "Terms:",
    els.terms.value.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    els.voiceButton.disabled = true;
    els.voiceStatus.textContent = "Voice transcription is not supported in this browser. You can still type notes.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-AU";

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(" ")
      .trim();
    state.voiceNote = transcript;
    updatePreview();
  });

  recognition.addEventListener("end", () => {
    isRecording = false;
    els.voiceButton.classList.remove("recording");
    els.voiceButtonText.textContent = "Record voice note";
    els.voiceStatus.textContent = state.voiceNote ? "Voice note captured." : "Recording stopped.";
  });
}

function toggleVoiceRecording() {
  if (!recognition) return;

  if (isRecording) {
    recognition.stop();
    return;
  }

  state.voiceNote = "";
  recognition.start();
  isRecording = true;
  els.voiceButton.classList.add("recording");
  els.voiceButtonText.textContent = "Stop recording";
  els.voiceStatus.textContent = "Listening...";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
}

els.form.addEventListener("input", updatePreview);
els.addLineItem.addEventListener("click", addLineItem);
els.photoInput.addEventListener("change", (event) => renderPhotos(event.target.files));
els.voiceButton.addEventListener("click", toggleVoiceRecording);
els.generateButton.addEventListener("click", () => {
  els.generatedQuote.value = buildQuoteText();
});
els.copyButton.addEventListener("click", async () => {
  const text = els.generatedQuote.value || buildQuoteText();
  await navigator.clipboard.writeText(text);
  els.generatedQuote.value = text;
  els.copyButton.textContent = "Copied";
  setTimeout(() => {
    els.copyButton.textContent = "Copy quote";
  }, 1400);
});
els.aiAssistButton.addEventListener("click", generateAiAssistance);
els.aiAssistButton.addEventListener("click", requestServerLlm);
els.applySuggestionsButton.addEventListener("click", applySuggestedItems);
els.copyPromptButton.addEventListener("click", async () => {
  if (!latestAssistance) generateAiAssistance();
  await navigator.clipboard.writeText(latestAssistance.prompt);
  els.copyPromptButton.textContent = "Copied";
  setTimeout(() => {
    els.copyPromptButton.textContent = "Copy AI prompt";
  }, 1400);
});
els.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installButton.hidden = true;
});

createDefaultItems();
renderLineItems();
setupSpeechRecognition();
registerPwa();
updatePreview();
generateAiAssistance();
