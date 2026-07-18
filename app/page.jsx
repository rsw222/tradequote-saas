"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tradeKnowledge, trades, urgencies } from "@/lib/knowledgeBase";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const defaultTerms =
  "Quote valid for 14 days. Price includes standard labour and materials listed above. Variations, hidden damage, or additional work will be quoted before proceeding.";

const defaultItems = [
  { id: "line-1", description: "Site inspection and labour", type: "labour", amount: 220 },
  { id: "line-2", description: "Materials allowance", type: "materials", amount: 180 },
  { id: "line-3", description: "Call-out / admin", type: "other", amount: 85 },
];

const jobPhotosBucket = "job_photos";
const jobVoiceBucket = "job_voice_notes";
const maxPhotoFiles = 8;
const maxPhotoSizeBytes = 10 * 1024 * 1024;
const maxVoiceSizeBytes = 25 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const quoteLanguages = [
  { code: "en", label: "English" },
  { code: "zh", label: "Mandarin" },
  { code: "ms", label: "Malay" },
  { code: "it", label: "Italian" },
  { code: "hi", label: "Hindi" },
];

const quoteStatuses = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const taskTypes = [
  { value: "confirm_measurements", label: "Confirm measurements" },
  { value: "prepare_materials", label: "Prepare materials list" },
  { value: "follow_up_quote", label: "Follow up quote" },
  { value: "review_quote_risk", label: "Review quote risk" },
  { value: "translate_quote", label: "Translate quote" },
  { value: "send_customer_message", label: "Send customer message" },
  { value: "ai_review", label: "AI review" },
  { value: "general", label: "General task" },
];

const taskStatuses = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const taskPriorities = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const quoteTranslations = {
  en: {
    amount: "Amount",
    assumptions: "Terms, Assumptions, and Exclusions",
    client: "Client",
    clientNotSet: "Client not set",
    contactNotProvided: "Contact not provided",
    date: "Date",
    estimateDisclaimer:
      "Estimate only. Final price may vary if hidden conditions, access issues, additional scope, or confirmed measurements differ from the information supplied.",
    gst: "GST",
    itemDescription: "Description",
    items: "Items",
    jobPhotos: "Job Photos",
    noItems: "No quote items added yet.",
    noVoice: "No voice transcript captured.",
    notProvided: "Not provided",
    phone: "Phone",
    photosSupplied: "Photos supplied",
    quote: "Quote",
    quoteSummary: "Quote Summary",
    scope: "Scope of Work",
    scopePending: "Scope to be confirmed from client information.",
    site: "Site",
    sitePending: "Site address pending",
    subtotal: "Subtotal",
    terms: "Terms",
    total: "Total",
    type: "Type",
    urgency: "Urgency",
    validFor: "Valid for 14 days unless otherwise noted.",
    voiceNote: "Voice note",
    voiceSiteNotes: "Voice / Site Notes",
  },
  zh: {
    amount: "金额",
    assumptions: "条款、假设和排除事项",
    client: "客户",
    clientNotSet: "未设置客户",
    contactNotProvided: "未提供联系方式",
    date: "日期",
    estimateDisclaimer: "此为估价。如隐藏情况、现场限制、额外范围或确认测量与所提供信息不同，最终价格可能会变化。",
    gst: "GST",
    itemDescription: "说明",
    items: "项目",
    jobPhotos: "工作照片",
    noItems: "尚未添加报价项目。",
    noVoice: "未记录语音文字稿。",
    notProvided: "未提供",
    phone: "电话",
    photosSupplied: "已提供照片",
    quote: "报价",
    quoteSummary: "报价摘要",
    scope: "工作范围",
    scopePending: "工作范围将根据客户信息确认。",
    site: "现场",
    sitePending: "现场地址待确认",
    subtotal: "小计",
    terms: "条款",
    total: "总计",
    type: "类型",
    urgency: "紧急程度",
    validFor: "除非另有说明，报价有效期为14天。",
    voiceNote: "语音备注",
    voiceSiteNotes: "语音/现场备注",
  },
  ms: {
    amount: "Amaun",
    assumptions: "Terma, Andaian dan Pengecualian",
    client: "Pelanggan",
    clientNotSet: "Pelanggan belum ditetapkan",
    contactNotProvided: "Maklumat hubungan tidak diberikan",
    date: "Tarikh",
    estimateDisclaimer:
      "Anggaran sahaja. Harga akhir mungkin berubah jika keadaan tersembunyi, isu akses, skop tambahan atau ukuran disahkan berbeza daripada maklumat yang diberikan.",
    gst: "GST",
    itemDescription: "Penerangan",
    items: "Item",
    jobPhotos: "Foto Kerja",
    noItems: "Tiada item sebut harga ditambah.",
    noVoice: "Tiada transkrip suara dirakam.",
    notProvided: "Tidak diberikan",
    phone: "Telefon",
    photosSupplied: "Foto diberikan",
    quote: "Sebut harga",
    quoteSummary: "Ringkasan Sebut Harga",
    scope: "Skop Kerja",
    scopePending: "Skop akan disahkan berdasarkan maklumat pelanggan.",
    site: "Tapak",
    sitePending: "Alamat tapak belum disahkan",
    subtotal: "Subtotal",
    terms: "Terma",
    total: "Jumlah",
    type: "Jenis",
    urgency: "Keutamaan",
    validFor: "Sebut harga sah selama 14 hari kecuali dinyatakan sebaliknya.",
    voiceNote: "Nota suara",
    voiceSiteNotes: "Nota Suara / Tapak",
  },
  it: {
    amount: "Importo",
    assumptions: "Termini, ipotesi ed esclusioni",
    client: "Cliente",
    clientNotSet: "Cliente non impostato",
    contactNotProvided: "Contatto non fornito",
    date: "Data",
    estimateDisclaimer:
      "Solo stima. Il prezzo finale può variare se condizioni nascoste, problemi di accesso, lavori aggiuntivi o misure confermate differiscono dalle informazioni fornite.",
    gst: "GST",
    itemDescription: "Descrizione",
    items: "Voci",
    jobPhotos: "Foto del lavoro",
    noItems: "Nessuna voce di preventivo aggiunta.",
    noVoice: "Nessuna trascrizione vocale registrata.",
    notProvided: "Non fornito",
    phone: "Telefono",
    photosSupplied: "Foto fornite",
    quote: "Preventivo",
    quoteSummary: "Riepilogo preventivo",
    scope: "Ambito dei lavori",
    scopePending: "Ambito da confermare in base alle informazioni del cliente.",
    site: "Sito",
    sitePending: "Indirizzo del sito in sospeso",
    subtotal: "Subtotale",
    terms: "Termini",
    total: "Totale",
    type: "Tipo",
    urgency: "Urgenza",
    validFor: "Preventivo valido per 14 giorni salvo diversa indicazione.",
    voiceNote: "Nota vocale",
    voiceSiteNotes: "Note vocali / sito",
  },
  hi: {
    amount: "राशि",
    assumptions: "शर्तें, अनुमान और अपवाद",
    client: "ग्राहक",
    clientNotSet: "ग्राहक सेट नहीं है",
    contactNotProvided: "संपर्क विवरण उपलब्ध नहीं है",
    date: "तारीख",
    estimateDisclaimer:
      "यह केवल अनुमान है। यदि छिपी हुई स्थितियां, पहुंच संबंधी समस्याएं, अतिरिक्त कार्य या पुष्टि की गई माप दी गई जानकारी से अलग हों, तो अंतिम कीमत बदल सकती है।",
    gst: "GST",
    itemDescription: "विवरण",
    items: "आइटम",
    jobPhotos: "काम की तस्वीरें",
    noItems: "अभी कोई कोट आइटम नहीं जोड़ा गया है।",
    noVoice: "कोई वॉइस ट्रांसक्रिप्ट रिकॉर्ड नहीं हुई।",
    notProvided: "उपलब्ध नहीं",
    phone: "फोन",
    photosSupplied: "दी गई तस्वीरें",
    quote: "कोट",
    quoteSummary: "कोट सारांश",
    scope: "कार्य का दायरा",
    scopePending: "ग्राहक जानकारी से कार्य का दायरा पुष्टि किया जाएगा।",
    site: "साइट",
    sitePending: "साइट पता लंबित है",
    subtotal: "सबटोटल",
    terms: "शर्तें",
    total: "कुल",
    type: "प्रकार",
    urgency: "तत्कालता",
    validFor: "जब तक अन्यथा न कहा जाए, कोट 14 दिनों के लिए मान्य है।",
    voiceNote: "वॉइस नोट",
    voiceSiteNotes: "वॉइस / साइट नोट्स",
  },
};

function translateQuoteLabel(languageCode, key) {
  return quoteTranslations[languageCode]?.[key] || quoteTranslations.en[key] || key;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calculateTotals(lineItems) {
  const totals = lineItems.reduce(
    (acc, item) => {
      acc[item.type] += Number(item.amount || 0);
      return acc;
    },
    { labour: 0, materials: 0, other: 0 },
  );
  const subtotal = totals.labour + totals.materials + totals.other;
  const gst = subtotal * 0.1;
  return { ...totals, gst, grand: subtotal + gst, subtotal };
}

function normalizeBusiness(business, role) {
  if (!business) return null;
  return {
    ...business,
    id: business.id || business.business_id,
    role: role || business.role,
  };
}

function formatPlanPrice(plan) {
  if (!plan) return "$0/mo";
  return `${currency.format(Number(plan.monthly_price_cents || 0) / 100)}/mo`;
}

function getTemplateDescriptionsForOtherTrades(nextTrade) {
  return new Set(
    tradeKnowledge
      .filter((entry) => !entry.trades.includes(nextTrade) && entry.trades.length <= 3)
      .flatMap((entry) => entry.items || [])
      .map((item) => item.description.trim().toLowerCase()),
  );
}

function calculatePaintingMeasurements(measurements) {
  const width = Number(measurements.width || 0);
  const height = Number(measurements.height || 0);
  const surfaceCount = Math.max(1, Number(measurements.surfaceCount || 1));
  const openingsArea = Math.max(0, Number(measurements.openingsArea || 0));
  const coats = Math.max(1, Number(measurements.coats || 1));
  const coverage = Math.max(1, Number(measurements.coverage || 10));
  const labourRate = Math.max(0, Number(measurements.labourRate || 18));
  const paintPrice = Math.max(0, Number(measurements.paintPrice || 24));
  const grossArea = width * height * surfaceCount;
  const paintableArea = Math.max(0, grossArea - openingsArea);
  const coatArea = paintableArea * coats;
  const litres = coatArea / coverage;
  const roundedLitres = Math.ceil(litres * 2) / 2;
  const materialAmount = Math.round(roundedLitres * paintPrice);
  const labourAmount = Math.round(paintableArea * labourRate);
  return { grossArea, paintableArea, coatArea, litres, roundedLitres, materialAmount, labourAmount };
}

function calculateCarpentryMeasurements(measurements) {
  const length = Number(measurements.length || 0);
  const width = Number(measurements.width || 0);
  const wastagePercent = Math.max(0, Number(measurements.wastagePercent || 10));
  const materialRate = Math.max(0, Number(measurements.materialRate || 65));
  const labourRate = Math.max(0, Number(measurements.labourRate || 55));
  const trimAllowance = Math.max(0, Number(measurements.trimAllowance || 120));
  const area = length * width;
  const materialArea = area * (1 + wastagePercent / 100);
  const materialAmount = Math.round(materialArea * materialRate);
  const labourAmount = Math.round(area * labourRate);
  const totalAmount = materialAmount + labourAmount + trimAllowance;
  return { area, materialArea, materialAmount, labourAmount, trimAllowance, totalAmount };
}

export default function QuoteBuilderPage() {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [tradeType, setTradeType] = useState("Plumbing");
  const [urgency, setUrgency] = useState("Standard");
  const [quoteLanguage, setQuoteLanguage] = useState("en");
  const [jobDescription, setJobDescription] = useState("");
  const [terms, setTerms] = useState(defaultTerms);
  const [lineItems, setLineItems] = useState(defaultItems);
  const [paintingMeasurements, setPaintingMeasurements] = useState({
    width: "",
    height: "",
    surfaceCount: 1,
    openingsArea: 0,
    coats: 2,
    coverage: 10,
    labourRate: 18,
    paintPrice: 24,
  });
  const [carpentryMeasurements, setCarpentryMeasurements] = useState({
    length: "",
    width: "",
    wastagePercent: 10,
    materialRate: 65,
    labourRate: 55,
    trimAllowance: 120,
  });
  const [measurementStatus, setMeasurementStatus] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoStatus, setPhotoStatus] = useState("");
  const [savedPhotoUrls, setSavedPhotoUrls] = useState([]);
  const [voiceNote, setVoiceNote] = useState("");
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [savedVoiceUrls, setSavedVoiceUrls] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState("Record an audio note and transcript for the quote.");
  const [isRecording, setIsRecording] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [latestAssistance, setLatestAssistance] = useState(null);
  const [scopeCheckResult, setScopeCheckResult] = useState(null);
  const [scopeCheckStatus, setScopeCheckStatus] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [copyLabel, setCopyLabel] = useState("Copy quote");
  const [copyPromptLabel, setCopyPromptLabel] = useState("Copy AI prompt");
  const [clientSaveStatus, setClientSaveStatus] = useState("");
  const [savedClients, setSavedClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [quoteSaveStatus, setQuoteSaveStatus] = useState("");
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentQuoteId, setCurrentQuoteId] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState("draft");
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [session, setSession] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [businessStatus, setBusinessStatus] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [billingPlans, setBillingPlans] = useState([]);
  const [businessSubscription, setBusinessSubscription] = useState(null);
  const [billingEntitlements, setBillingEntitlements] = useState(null);
  const [billingUsage, setBillingUsage] = useState({});
  const [billingStatus, setBillingStatus] = useState("");
  const [savedTasks, setSavedTasks] = useState([]);
  const [taskStatus, setTaskStatus] = useState("");
  const [taskDraftType, setTaskDraftType] = useState("confirm_measurements");
  const [taskDraftPriority, setTaskDraftPriority] = useState("normal");
  const [hermesStatus, setHermesStatus] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("ok");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const recognitionRef = useRef(null);
  const [quoteNumber, setQuoteNumber] = useState("QT-0001");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);

  const totals = useMemo(() => calculateTotals(lineItems), [lineItems]);
  const paintingEstimate = useMemo(() => calculatePaintingMeasurements(paintingMeasurements), [paintingMeasurements]);
  const carpentryEstimate = useMemo(() => calculateCarpentryMeasurements(carpentryMeasurements), [carpentryMeasurements]);
  const q = (key) => translateQuoteLabel(quoteLanguage, key);
  const onboardingSteps = [
    {
      key: "account",
      label: "Sign in",
      done: Boolean(session?.user),
      hint: "Use email and password before saving secure quote data.",
    },
    {
      key: "business",
      label: "Business",
      done: Boolean(activeBusiness?.id),
      hint: "Create or select the business workspace.",
    },
    {
      key: "client",
      label: "Client",
      done: Boolean(activeClient?.client_id || clientName.trim()),
      hint: "Add the customer name and contact details.",
    },
    {
      key: "scope",
      label: "Job scope",
      done: Boolean(jobDescription.trim()),
      hint: "Describe the job, then add photos or voice notes.",
    },
    {
      key: "quote",
      label: "Save quote",
      done: Boolean(currentQuoteId),
      hint: "Save the quote to unlock history and follow-ups.",
    },
  ];
  const nextOnboardingStep = onboardingSteps.find((step) => !step.done);

  const photoPreviews = useMemo(
    () =>
      photos.map((photo) => ({
        name: photo.name,
        url: URL.createObjectURL(photo),
      })),
    [photos],
  );

  useEffect(() => {
    return () => photoPreviews.forEach((photo) => URL.revokeObjectURL(photo.url));
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    };
  }, [voiceUrl]);

  useEffect(() => {
    setQuoteNumber(`QT-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Voice transcription is not supported in this browser. You can still type notes.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";
    recognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      setVoiceNote(transcript);
    });
    recognition.addEventListener("end", () => {
      setIsRecording(false);
      setVoiceStatus("Recording stopped.");
    });
    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Speech recognition can throw if it was never started.
      }
      stopAudioStream();
    };
  }, []);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    resetLegacyServiceWorker();
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    async function resetLegacyServiceWorker() {
      if (!("serviceWorker" in navigator)) return;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
      } catch {
        // Cache cleanup should never block the app UI.
      }
    }
  }, []);

  useEffect(() => {
    runLocalAssistance(false);
    loadSavedClients();
    loadAuthSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthStatus(nextSession?.user?.email ? `Signed in as ${nextSession.user.email}` : "Signed out.");
      loadBusinesses(nextSession);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getJobCorpus() {
    return [
      tradeType,
      urgency,
      jobDescription,
      voiceNote,
      photos.map((photo) => photo.name).join(" "),
      lineItems.map((item) => `${item.description} ${item.type}`).join(" "),
    ].join(" ");
  }

  function retrieveKnowledge() {
    const corpus = getJobCorpus().toLowerCase();
    const tokens = new Set(tokenize(corpus));

    return tradeKnowledge
      .map((entry) => {
        const tradeMatch = entry.trades.includes(tradeType);
        const keywordScore = entry.keywords.reduce((score, keyword) => {
          const normalized = keyword.toLowerCase();
          return score + (corpus.includes(normalized) || tokens.has(normalized) ? 3 : 0);
        }, 0);
        const urgencyScore = urgency.toLowerCase() !== "standard" && entry.id === "pricing-urgent" ? 4 : 0;
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
    if (!siteAddress.trim()) questions.add("Confirm the site address and access details.");
    if (!jobDescription.trim()) questions.add("Ask the client for a clear description of the issue and expected outcome.");
    if (photos.length === 0) questions.add("Ask for photos of the problem area, access path, and any visible damage.");
    if (!voiceNote) questions.add("Capture a voice note from the tradie after inspection to preserve site observations.");
    matches.forEach((match) => match.checks.forEach((check) => questions.add(check)));
    return Array.from(questions).slice(0, 7);
  }

  function buildSuggestedItems(matches) {
    const existing = new Set(lineItems.map((item) => item.description.trim().toLowerCase()));
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
      `Trade: ${tradeType}`,
      `Urgency: ${urgency}`,
      `Client request: ${jobDescription.trim() || "Not provided"}`,
      `Voice note: ${voiceNote || "Not provided"}`,
      `Photos supplied: ${photos.length}`,
      `Existing quote items: ${lineItems.map((item) => `${item.description} ${currency.format(Number(item.amount || 0))}`).join("; ")}`,
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

  function runLocalAssistance(updateOutput = true) {
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

    const assistance = { matches, questions, suggestions, prompt, output };
    setLatestAssistance(assistance);
    if (updateOutput) setAiOutput(output);
    return assistance;
  }

  async function runAiAssistance() {
    const assistance = runLocalAssistance(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
        },
        body: JSON.stringify({ business_id: activeBusiness?.id, prompt: assistance.prompt }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setAiOutput(`${assistance.output}\n\nAI API notice:\n- ${data.error || "AI request was blocked."}`);
        return;
      }

      const data = await response.json();
      if (data.provider === "local-rag-only") return;

      setAiOutput(
        [
          "LLM response",
          "",
          data.text || "The LLM returned no recommendation.",
          "",
          "Local RAG context used:",
          assistance.matches.map((match) => `- ${match.title}`).join("\n") || "- None",
        ].join("\n"),
      );
    } catch {
      // The local RAG output remains available if the backend is unavailable.
    }
  }

  async function runScopeCheck() {
    if (!activeBusiness?.id) {
      setScopeCheckStatus("Create or select a business before running AI Scope Check.");
      return;
    }

    setScopeCheckStatus("Running AI Scope Check...");

    try {
      const data = await postJsonApi("/api/ai/scope-check", {
        business_id: activeBusiness.id,
        job_id: currentJobId,
        quote_id: currentQuoteId,
        client_name: clientName,
        site_address: siteAddress,
        trade_type: tradeType,
        urgency,
        description: jobDescription,
        voice_note: voiceNote,
        measurements: buildMeasurementPayload(),
        photo_count: photos.length + savedPhotoUrls.length,
        photo_names: [...photos.map((photo) => photo.name), ...savedPhotoUrls.map((photo) => photo.name)],
        line_items: lineItems.map((item) => ({
          description: item.description,
          type: item.type,
          amount: Number(item.amount || 0),
        })),
      });
      setScopeCheckResult(data);
      setAiOutput(data.text || "");
      setScopeCheckStatus(`AI Scope Check saved. Confidence ${Math.round(Number(data.confidence || 0) * 100)}%.`);
    } catch (error) {
      setScopeCheckStatus(error.message);
    }
  }

  function applyScopeCheckItems() {
    const suggestions = scopeCheckResult?.quote_suggestions || [];
    if (!suggestions.length) {
      setScopeCheckStatus("No AI quote items to apply yet.");
      return;
    }

    const existing = new Set(lineItems.map((item) => item.description.trim().toLowerCase()));
    const nextItems = suggestions
      .filter((item) => item.description && !existing.has(item.description.trim().toLowerCase()))
      .map((item) => ({
        id: createId(),
        description: item.description,
        type: ["labour", "materials", "other"].includes(item.item_type) ? item.item_type : "other",
        amount: Number(item.amount || item.unit_price || 0),
      }));

    if (!nextItems.length) {
      setScopeCheckStatus("AI quote items are already in the quote.");
      return;
    }

    setLineItems((items) => [...items, ...nextItems]);
    setScopeCheckStatus(`${nextItems.length} AI quote item${nextItems.length === 1 ? "" : "s"} applied.`);
  }

  async function getAccessToken() {
    if (!supabase) return "";
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    return currentSession?.access_token || "";
  }

  async function postJsonApi(path, payload) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function getJsonApi(path) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function postFormApi(path, formData) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function applySuggestedItems() {
    const assistance = runLocalAssistance(false);
    setLineItems((items) => {
      const existing = new Set(items.map((item) => item.description.trim().toLowerCase()));
      const nextItems = assistance.suggestions
        .filter((item) => item.description && !existing.has(item.description.trim().toLowerCase()))
        .map((item) => ({
          id: createId(),
          description: item.description,
          type: item.type,
          amount: item.amount,
        }));
      return [...items, ...nextItems];
    });
  }

  function handleTradeChange(nextTrade) {
    setTradeType(nextTrade);
    setLatestAssistance(null);
    setScopeCheckResult(null);
    setAiOutput("");
    setScopeCheckStatus(`Trade changed to ${nextTrade}. Re-run Scope check for trade-specific suggestions.`);

    const otherTradeTemplates = getTemplateDescriptionsForOtherTrades(nextTrade);
    setLineItems((items) => items.filter((item) => !otherTradeTemplates.has(item.description.trim().toLowerCase())));
  }

  function updatePaintingMeasurement(field, value) {
    setPaintingMeasurements((measurements) => ({ ...measurements, [field]: value }));
  }

  function updateCarpentryMeasurement(field, value) {
    setCarpentryMeasurements((measurements) => ({ ...measurements, [field]: value }));
  }

  function buildMeasurementPayload() {
    if (tradeType === "Painting") {
      return {
        trade: "Painting",
        ...paintingMeasurements,
        gross_area_sqm: Number(paintingEstimate.grossArea.toFixed(2)),
        paintable_area_sqm: Number(paintingEstimate.paintableArea.toFixed(2)),
        coat_area_sqm: Number(paintingEstimate.coatArea.toFixed(2)),
        paint_litres: Number(paintingEstimate.roundedLitres.toFixed(2)),
      };
    }

    if (tradeType === "Carpentry") {
      return {
        trade: "Carpentry",
        ...carpentryMeasurements,
        area_sqm: Number(carpentryEstimate.area.toFixed(2)),
        material_area_sqm: Number(carpentryEstimate.materialArea.toFixed(2)),
        material_amount: carpentryEstimate.materialAmount,
        labour_amount: carpentryEstimate.labourAmount,
        trim_allowance: carpentryEstimate.trimAllowance,
      };
    }

    return null;
  }

  function applyPaintingEstimate() {
    if (tradeType !== "Painting") {
      setMeasurementStatus("Select Painting before applying the paint estimate.");
      return;
    }

    if (!paintingEstimate.paintableArea) {
      setMeasurementStatus("Add wall width and height before applying a paint estimate.");
      return;
    }

    const estimateItems = [
      {
        description: `Painting labour - ${paintingEstimate.paintableArea.toFixed(1)} sqm`,
        type: "labour",
        amount: paintingEstimate.labourAmount,
      },
      {
        description: `Paint allowance - ${paintingEstimate.roundedLitres.toFixed(1)} L`,
        type: "materials",
        amount: paintingEstimate.materialAmount,
      },
    ];

    setLineItems((items) => {
      const blocked = new Set(["painting labour", "paint allowance"]);
      const keptItems = items.filter((item) => ![...blocked].some((prefix) => item.description.trim().toLowerCase().startsWith(prefix)));
      return [...keptItems, ...estimateItems.map((item) => ({ ...item, id: createId() }))];
    });
    setMeasurementStatus(`${paintingEstimate.paintableArea.toFixed(1)} sqm and ${paintingEstimate.roundedLitres.toFixed(1)} L paint estimate applied.`);
  }

  function applyCarpentryEstimate() {
    if (tradeType !== "Carpentry") {
      setMeasurementStatus("Select Carpentry before applying the carpentry estimate.");
      return;
    }

    if (!carpentryEstimate.area) {
      setMeasurementStatus("Add length and width before applying a carpentry estimate.");
      return;
    }

    const estimateItems = [
      {
        description: `Carpentry installation labour - ${carpentryEstimate.area.toFixed(1)} sqm`,
        type: "labour",
        amount: carpentryEstimate.labourAmount,
      },
      {
        description: `Timber/flooring materials - ${carpentryEstimate.materialArea.toFixed(1)} sqm incl. wastage`,
        type: "materials",
        amount: carpentryEstimate.materialAmount,
      },
      {
        description: "Trims, fixings, and consumables allowance",
        type: "materials",
        amount: carpentryEstimate.trimAllowance,
      },
    ];

    setLineItems((items) => {
      const blocked = new Set(["carpentry installation labour", "timber/flooring materials", "trims, fixings"]);
      const keptItems = items.filter((item) => ![...blocked].some((prefix) => item.description.trim().toLowerCase().startsWith(prefix)));
      return [...keptItems, ...estimateItems.map((item) => ({ ...item, id: createId() }))];
    });
    setMeasurementStatus(`${carpentryEstimate.area.toFixed(1)} sqm carpentry/flooring estimate applied.`);
  }

  function addLineItem() {
    setLineItems((items) => [...items, { id: createId(), description: "", type: "labour", amount: 0 }]);
  }

  function updateLineItem(id, field, value) {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeLineItem(id) {
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  function stopAudioStream() {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }

  function getAudioMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
    return options.find((option) => MediaRecorder.isTypeSupported(option)) || "";
  }

  async function toggleVoiceRecording() {
    const recognition = recognitionRef.current;

    if (isRecording) {
      try {
        recognition?.stop();
      } catch {
        // Speech recognition can throw if already stopped.
      }
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("Audio recording is not supported in this browser. You can still type notes.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setVoiceStatus(`Microphone access failed: ${error.message}`);
      return;
    }

    const mimeType = getAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    audioChunksRef.current = [];
    audioStreamRef.current = stream;
    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    });

    recorder.addEventListener("stop", () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
      if (audioBlob.size > maxVoiceSizeBytes) {
        setVoiceBlob(null);
        setVoiceUrl("");
        stopAudioStream();
        setIsRecording(false);
        setVoiceStatus("Voice recording is larger than 25 MB. Record a shorter site note.");
        return;
      }
      setVoiceBlob(audioBlob);
      setVoiceUrl(URL.createObjectURL(audioBlob));
      stopAudioStream();
      setIsRecording(false);
      setVoiceStatus(`Voice recording captured (${Math.max(1, Math.round(audioBlob.size / 1024))} KB).`);
    });

    setVoiceNote("");
    setVoiceBlob(null);
    setSavedVoiceUrls([]);
    if (voiceUrl) {
      URL.revokeObjectURL(voiceUrl);
      setVoiceUrl("");
    }

    try {
      recognition?.start();
    } catch {
      // Audio recording still works if browser speech recognition is unavailable or already active.
    }

    recorder.start();
    setIsRecording(true);
    setVoiceStatus("Recording voice note...");
  }

  function buildQuoteText() {
    const lines = lineItems
      .filter((item) => item.description.trim() || Number(item.amount) > 0)
      .map((item) => `- ${item.description || "Quote item"} (${item.type}): ${currency.format(Number(item.amount || 0))}`)
      .join("\n");

    return [
      `${quoteNumber} - ${tradeType} ${q("quote")}`,
      "",
      `${q("client")}: ${clientName.trim() || q("notProvided")}`,
      `${q("phone")}: ${clientPhone.trim() || q("notProvided")}`,
      `${q("site")}: ${siteAddress.trim() || q("notProvided")}`,
      `${q("urgency")}: ${urgency}`,
      "",
      `${q("scope")}:`,
      jobDescription.trim() || q("scopePending"),
      "",
      voiceNote ? `${q("voiceNote")}:\n${voiceNote}\n` : "",
      `${q("photosSupplied")}: ${photos.length}`,
      "",
      `${q("items")}:`,
      lines || `- ${q("noItems")}`,
      "",
      `${q("subtotal")}: ${currency.format(totals.subtotal)}`,
      `${q("gst")}: ${currency.format(totals.gst)}`,
      `${q("total")}: ${currency.format(totals.grand)}`,
      "",
      `${q("terms")}:`,
      terms.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copyQuote() {
    const text = generatedQuote || buildQuoteText();
    await navigator.clipboard.writeText(text);
    setGeneratedQuote(text);
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy quote"), 1400);
  }

  function exportQuotePdf() {
    const printablePhotos = [
      ...savedPhotoUrls.filter((photo) => photo.url),
      ...photoPreviews,
    ];
    const printableItems = lineItems.filter((item) => item.description.trim() || Number(item.amount || 0) > 0);
    const quoteDate = new Date().toLocaleDateString("en-AU");
    const business = activeBusiness || {};
    const businessContact = [business.email, business.phone, business.address].filter(Boolean).join(" | ");
    const clientContact = [clientPhone, clientEmail].filter(Boolean).join(" | ");
    const itemRows = printableItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.description || "Quote item")}</td>
            <td>${escapeHtml(item.type)}</td>
            <td class="amount">${escapeHtml(currency.format(Number(item.amount || 0)))}</td>
          </tr>
        `,
      )
      .join("");
    const photoGrid = printablePhotos.length
      ? `
        <section>
          <h2>${escapeHtml(q("jobPhotos"))}</h2>
          <div class="photos">
            ${printablePhotos
              .map(
                (photo) => `
                  <figure>
                    <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" />
                    <figcaption>${escapeHtml(photo.name)}</figcaption>
                  </figure>
                `,
              )
              .join("")}
          </div>
        </section>
      `
      : "";
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(quoteNumber)} ${escapeHtml(q("quote"))}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; color: #10201e; font-family: Arial, sans-serif; line-height: 1.45; }
            header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #10201e; padding-bottom: 18px; margin-bottom: 24px; }
            h1, h2, h3, p { margin-top: 0; }
            h1 { font-size: 28px; margin-bottom: 8px; }
            h2 { font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #d7e0de; padding-bottom: 6px; }
            section { margin: 0 0 22px; break-inside: avoid; }
            .muted { color: #60706c; }
            .quote-meta { text-align: right; min-width: 180px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
            .box { border: 1px solid #d7e0de; border-radius: 8px; padding: 14px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e5ecea; text-align: left; vertical-align: top; }
            th { background: #f4f8f7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
            .amount { text-align: right; white-space: nowrap; }
            .totals { margin-left: auto; width: min(320px, 100%); }
            .totals div { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e5ecea; }
            .grand { font-size: 20px; font-weight: 700; }
            .photos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            figure { margin: 0; border: 1px solid #d7e0de; border-radius: 8px; padding: 8px; break-inside: avoid; }
            img { width: 100%; max-height: 280px; object-fit: cover; border-radius: 6px; display: block; }
            figcaption { margin-top: 6px; font-size: 12px; color: #60706c; overflow-wrap: anywhere; }
            .notes { white-space: pre-wrap; }
            footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #d7e0de; font-size: 12px; color: #60706c; }
            @media print {
              body { padding: 18mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="position:fixed;right:20px;top:20px;padding:10px 14px;border:0;border-radius:6px;background:#10201e;color:white;font-weight:700;">Print / Save PDF</button>
          <header>
            <div>
              <h1>${escapeHtml(business.name || "TradeQuote")}</h1>
              <p class="muted">${escapeHtml(businessContact || "Business contact details to be confirmed")}</p>
            </div>
            <div class="quote-meta">
              <h1>${escapeHtml(quoteNumber)}</h1>
              <p class="muted">${escapeHtml(quoteDate)}</p>
              <p><strong>${escapeHtml(tradeType)}</strong> | ${escapeHtml(urgency)}</p>
            </div>
          </header>

          <section class="grid">
            <div class="box">
              <h2>${escapeHtml(q("client"))}</h2>
              <p><strong>${escapeHtml(clientName || q("clientNotSet"))}</strong></p>
              <p class="muted">${escapeHtml(clientContact || q("contactNotProvided"))}</p>
              <p>${escapeHtml(siteAddress || q("sitePending"))}</p>
            </div>
            <div class="box">
              <h2>${escapeHtml(q("quoteSummary"))}</h2>
              <p>Status: Draft</p>
              <p>${escapeHtml(q("validFor"))}</p>
              <p>All amounts are AUD and include GST where shown.</p>
            </div>
          </section>

          <section>
            <h2>${escapeHtml(q("scope"))}</h2>
            <p class="notes">${escapeHtml(jobDescription || q("scopePending"))}</p>
          </section>

          <section>
            <h2>${escapeHtml(q("items"))}</h2>
            <table>
              <thead>
                <tr><th>${escapeHtml(q("itemDescription"))}</th><th>${escapeHtml(q("type"))}</th><th class="amount">${escapeHtml(q("amount"))}</th></tr>
              </thead>
              <tbody>${itemRows || `<tr><td colspan="3">${escapeHtml(q("noItems"))}</td></tr>`}</tbody>
            </table>
          </section>

          <section class="totals">
            <div><span>${escapeHtml(q("subtotal"))}</span><strong>${escapeHtml(currency.format(totals.subtotal))}</strong></div>
            <div><span>${escapeHtml(q("gst"))}</span><strong>${escapeHtml(currency.format(totals.gst))}</strong></div>
            <div class="grand"><span>${escapeHtml(q("total"))}</span><strong>${escapeHtml(currency.format(totals.grand))}</strong></div>
          </section>

          ${photoGrid}

          <section>
            <h2>${escapeHtml(q("voiceSiteNotes"))}</h2>
            <p class="notes">${escapeHtml(voiceNote || q("noVoice"))}</p>
          </section>

          <section>
            <h2>${escapeHtml(q("assumptions"))}</h2>
            <p class="notes">${escapeHtml(terms || defaultTerms)}</p>
          </section>

          <footer>
            ${escapeHtml(q("estimateDisclaimer"))}
          </footer>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setQuoteSaveStatus("Could not open PDF preview. Allow pop-ups for this app, then try again.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  async function copyAiPrompt() {
    const assistance = latestAssistance || runLocalAssistance(false);
    await navigator.clipboard.writeText(assistance.prompt);
    setCopyPromptLabel("Copied");
    setTimeout(() => setCopyPromptLabel("Copy AI prompt"), 1400);
  }

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function loadAuthSession() {
    if (!supabase) {
      setAuthStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      setAuthStatus(`Could not load auth session: ${error.message}`);
      return;
    }

    setSession(currentSession);
    setAuthStatus(currentSession?.user?.email ? `Signed in as ${currentSession.user.email}` : "Signed out.");
    await loadBusinesses(currentSession);
  }

  async function signUp() {
    if (!supabase) {
      setAuthStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthStatus("Enter an email and a password with at least 6 characters.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setAuthStatus(`Could not sign up: ${error.message}`);
      return;
    }

    setSession(data.session);
    setAuthStatus(data.session ? `Signed in as ${data.user?.email}` : "Sign-up created. Check email confirmation settings in Supabase if login is not immediate.");
    if (data.session) await loadBusinesses(data.session);
  }

  async function signIn() {
    if (!supabase) {
      setAuthStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setAuthStatus(`Could not sign in: ${error.message}`);
      return;
    }

    setSession(data.session);
    setAuthStatus(`Signed in as ${data.user.email}`);
    await loadBusinesses(data.session);
  }

  async function signOut() {
    if (!supabase) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error && !error.message.toLowerCase().includes("session")) {
        setAuthStatus(`Could not sign out: ${error.message}`);
        return;
      }
    } catch (error) {
      if (!String(error?.message || "").toLowerCase().includes("session")) {
        setAuthStatus(`Could not sign out: ${error.message}`);
        return;
      }
    }

    setSession(null);
    setAuthStatus("Signed out.");
    setBusinesses([]);
    setActiveBusiness(null);
    setSavedClients([]);
    setSavedQuotes([]);
  }

  async function loadBusinesses(currentSession = session) {
    if (!supabase || !currentSession?.user) {
      setBusinessStatus("Sign in to load or create a business.");
      return;
    }

    const { data: memberships, error } = await supabase
      .from("business_members")
      .select("role, businesses(*)")
      .eq("user_id", currentSession.user.id);

    if (error) {
      setBusinessStatus(`Could not load businesses: ${error.message}`);
      return;
    }

    const loadedBusinesses = (memberships || []).map((membership) => normalizeBusiness(membership.businesses, membership.role)).filter(Boolean);

    setBusinesses(loadedBusinesses);
    setActiveBusiness((current) => current || loadedBusinesses[0] || null);
    setBusinessStatus(loadedBusinesses.length ? "Business loaded." : "No business yet. Create one below.");

    if (loadedBusinesses[0]) {
      await loadSavedClients(loadedBusinesses[0].id);
      await loadQuoteHistory(loadedBusinesses[0].id);
      await loadBillingSummary(loadedBusinesses[0].id);
    }
  }

  async function createBusiness() {
    if (!supabase || !session?.user) {
      setBusinessStatus("Sign in before creating a business.");
      return;
    }

    if (!businessName.trim()) {
      setBusinessStatus("Enter a business name.");
      return;
    }

    const existingBusiness = businesses.find((business) => business.name?.trim().toLowerCase() === businessName.trim().toLowerCase());
    if (existingBusiness) {
      setActiveBusiness(existingBusiness);
      setBusinessStatus("Existing business selected.");
      await loadSavedClients(existingBusiness.id);
      return;
    }

    const { data: matchingBusinesses, error: matchError } = await supabase.from("businesses").select("*").eq("name", businessName.trim()).limit(1);
    if (matchError) {
      setBusinessStatus(`Could not check existing businesses: ${matchError.message}`);
      return;
    }

    let business = matchingBusinesses?.[0];
    if (!business) {
      const { data: newBusiness, error: businessError } = await supabase
        .from("businesses")
        .insert({
          name: businessName.trim(),
          owner_user_id: session.user.id,
        })
        .select()
        .single();

      if (businessError) {
        setBusinessStatus(`Could not create business: ${businessError.message}`);
        return;
      }

      business = newBusiness;
    }

    const normalizedBusiness = normalizeBusiness(business, "owner");

    const { error: membershipError } = await supabase.from("business_members").upsert({
      business_id: normalizedBusiness.id,
      user_id: session.user.id,
      role: "owner",
    }, {
      onConflict: "business_id,user_id",
    });

    if (membershipError) {
      setBusinessStatus(`Business created, but membership failed: ${membershipError.message}`);
      return;
    }

    setBusinessName("");
    setActiveBusiness(normalizedBusiness);
    setBusinesses((items) => [normalizedBusiness, ...items.filter((item) => item.id !== normalizedBusiness.id)]);
    setBusinessStatus("Business created and selected.");
    await loadSavedClients(normalizedBusiness.id);
    await loadQuoteHistory(normalizedBusiness.id);
    await loadBillingSummary(normalizedBusiness.id);
  }

  async function loadBillingSummary(businessId = activeBusiness?.id) {
    if (!businessId) {
      setBillingPlans([]);
      setBusinessSubscription(null);
      setBillingEntitlements(null);
      setBillingUsage({});
      setBillingStatus("Select a business to load billing.");
      return;
    }

    try {
      const data = await getJsonApi(`/api/billing/summary?${new URLSearchParams({ business_id: businessId }).toString()}`);
      setBillingPlans(data.plans || []);
      setBusinessSubscription(data.subscription || null);
      setBillingEntitlements(data.entitlements || null);
      setBillingUsage(data.usage || {});
      setBillingStatus(data.entitlements ? `${data.entitlements.name} plan loaded.` : "No paid subscription yet.");
    } catch (error) {
      setBillingStatus(error.message);
    }
  }

  async function startCheckout(planCode) {
    if (!activeBusiness?.id) {
      setBillingStatus("Select a business before choosing a plan.");
      return;
    }

    setBillingStatus("Starting checkout...");

    try {
      const data = await postJsonApi("/api/billing/checkout", {
        business_id: activeBusiness.id,
        plan_code: planCode,
      });

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setBillingStatus("Checkout did not return a redirect URL.");
    } catch (error) {
      setBillingStatus(error.message);
    }
  }

  async function loadSavedClients(businessId = activeBusiness?.id) {
    if (!supabase) {
      setClientSaveStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    let query = supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(6);
    if (businessId) query = query.eq("business_id", businessId);

    const { data, error } = await query;

    if (error) {
      setClientSaveStatus(`Could not load clients: ${error.message}`);
      return;
    }

    setSavedClients(data || []);
    setClientSaveStatus(isSupabaseConfigured ? "Supabase connected." : "");
  }

  async function loadQuoteHistory(businessId = activeBusiness?.id) {
    if (!supabase) {
      setHistoryStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    if (!businessId) {
      setSavedQuotes([]);
      setHistoryStatus("Select a business to load quote history.");
      return;
    }

    setHistoryStatus("Loading quote history...");

    const { data: quotes, error: quotesError } = await supabase
      .from("quotes")
      .select("quote_id,business_id,job_id,client_id,quote_number,subtotal,gst,total,terms,status,created_at,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(8);

    if (quotesError) {
      setHistoryStatus(`Could not load quote history: ${quotesError.message}`);
      return;
    }

    const quoteRows = quotes || [];
    const jobIds = [...new Set(quoteRows.map((quote) => quote.job_id).filter(Boolean))];
    const clientIds = [...new Set(quoteRows.map((quote) => quote.client_id).filter(Boolean))];
    const quoteIds = [...new Set(quoteRows.map((quote) => quote.quote_id).filter(Boolean))];

    const [jobsResult, clientsResult, itemsResult, photosResult, voiceResult] = await Promise.all([
      jobIds.length ? supabase.from("jobs").select("*").in("job_id", jobIds) : Promise.resolve({ data: [], error: null }),
      clientIds.length ? supabase.from("clients").select("*").in("client_id", clientIds) : Promise.resolve({ data: [], error: null }),
      quoteIds.length ? supabase.from("quote_items").select("*").in("quote_id", quoteIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
      jobIds.length ? supabase.from("job_photos").select("*").in("job_id", jobIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
      jobIds.length ? supabase.from("job_voice_notes").select("*").in("job_id", jobIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ]);

    const historyError = [jobsResult.error, clientsResult.error, itemsResult.error, photosResult.error, voiceResult.error].filter(Boolean)[0];
    if (historyError) {
      setHistoryStatus(`Quote history partly blocked: ${historyError.message}`);
    }

    const jobsById = new Map((jobsResult.data || []).map((job) => [job.job_id, job]));
    const clientsById = new Map((clientsResult.data || []).map((client) => [client.client_id, client]));
    const itemsByQuoteId = new Map();
    const photosByJobId = new Map();
    const voiceByJobId = new Map();

    (itemsResult.data || []).forEach((item) => {
      const items = itemsByQuoteId.get(item.quote_id) || [];
      items.push(item);
      itemsByQuoteId.set(item.quote_id, items);
    });

    (photosResult.data || []).forEach((photo) => {
      const photosForJob = photosByJobId.get(photo.job_id) || [];
      photosForJob.push(photo);
      photosByJobId.set(photo.job_id, photosForJob);
    });

    (voiceResult.data || []).forEach((voice) => {
      const voiceForJob = voiceByJobId.get(voice.job_id) || [];
      voiceForJob.push(voice);
      voiceByJobId.set(voice.job_id, voiceForJob);
    });

    const enrichedQuotes = await Promise.all(quoteRows.map(async (quote) => ({
      ...quote,
      job: jobsById.get(quote.job_id) || null,
      client: clientsById.get(quote.client_id) || null,
      items: itemsByQuoteId.get(quote.quote_id) || [],
      photoRecords: photosByJobId.get(quote.job_id) || [],
      voiceRecords: voiceByJobId.get(quote.job_id) || [],
      signedPhotoUrls: await createSignedPhotoUrls(photosByJobId.get(quote.job_id) || []),
      signedVoiceUrls: await createSignedVoiceUrls(voiceByJobId.get(quote.job_id) || []),
    })));

    setSavedQuotes(enrichedQuotes);
    if (!historyError) setHistoryStatus(enrichedQuotes.length ? `${enrichedQuotes.length} saved quote${enrichedQuotes.length === 1 ? "" : "s"} loaded.` : "No saved quotes yet.");
  }

  async function loadAgentTasks(businessId = activeBusiness?.id, jobId = currentJobId, quoteId = currentQuoteId) {
    if (!businessId) {
      setSavedTasks([]);
      setTaskStatus("Select a business to load tasks.");
      return;
    }

    try {
      const params = new URLSearchParams({ business_id: businessId });
      if (jobId) params.set("job_id", jobId);
      if (quoteId) params.set("quote_id", quoteId);
      const data = await getJsonApi(`/api/agent-tasks?${params.toString()}`);
      setSavedTasks(data.tasks || []);
      setTaskStatus(data.tasks?.length ? `${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"} loaded.` : "No tasks for this quote yet.");
    } catch (error) {
      setTaskStatus(error.message);
    }
  }

  async function createAgentTask(taskType = taskDraftType) {
    if (!activeBusiness?.id) {
      setTaskStatus("Create or select a business before adding tasks.");
      return;
    }

    if (!currentJobId || !currentQuoteId) {
      setTaskStatus("Save the quote before adding tasks so the task can link to the job.");
      return;
    }

    const task = taskTypes.find((item) => item.value === taskType) || taskTypes[taskTypes.length - 1];
    const description = [
      `${task.label} for ${quoteNumber}.`,
      clientName.trim() ? `Client: ${clientName.trim()}.` : "",
      tradeType ? `Trade: ${tradeType}.` : "",
      urgency ? `Urgency: ${urgency}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    setTaskStatus("Creating task...");

    try {
      await postJsonApi("/api/agent-tasks", {
        business_id: activeBusiness.id,
        job_id: currentJobId,
        quote_id: currentQuoteId,
        task_type: task.value,
        title: task.label,
        description,
        priority: taskDraftPriority,
      });
      await loadAgentTasks(activeBusiness.id, currentJobId, currentQuoteId);
      setTaskStatus(`${task.label} task created.`);
    } catch (error) {
      setTaskStatus(error.message);
    }
  }

  async function updateAgentTaskStatus(agentTaskId, nextStatus) {
    if (!activeBusiness?.id) {
      setTaskStatus("Select a business before updating tasks.");
      return;
    }

    try {
      const data = await postJsonApi("/api/agent-tasks/status", {
        business_id: activeBusiness.id,
        agent_task_id: agentTaskId,
        status: nextStatus,
      });
      setSavedTasks((tasks) => tasks.map((task) => (task.agent_task_id === agentTaskId ? data.task : task)));
      setTaskStatus(`Task marked as ${taskStatuses.find((status) => status.value === nextStatus)?.label || nextStatus}.`);
    } catch (error) {
      setTaskStatus(error.message);
    }
  }

  async function assignTaskToHermes(agentTaskId) {
    if (!activeBusiness?.id) {
      setHermesStatus("Select a business before assigning tasks.");
      return;
    }

    setHermesStatus("Sending task to Hermes...");

    try {
      const data = await postJsonApi("/api/hermes/assign", {
        business_id: activeBusiness.id,
        agent_task_id: agentTaskId,
      });
      if (data.task) {
        setSavedTasks((tasks) => tasks.map((task) => (task.agent_task_id === agentTaskId ? data.task : task)));
      }
      setHermesStatus("Task sent to Hermes.");
    } catch (error) {
      setHermesStatus(error.message);
    }
  }

  async function sendPilotFeedback() {
    if (!activeBusiness?.id) {
      setFeedbackStatus("Select a business before sending feedback.");
      return;
    }

    if (!feedbackMessage.trim()) {
      setFeedbackStatus("Add a note before sending feedback.");
      return;
    }

    setFeedbackStatus("Sending feedback...");

    try {
      await postJsonApi("/api/feedback", {
        business_id: activeBusiness.id,
        job_id: currentJobId,
        quote_id: currentQuoteId,
        rating: feedbackRating,
        message: feedbackMessage,
        page_path: window.location.pathname,
        user_agent: navigator.userAgent,
        client_name: clientName,
        trade_type: tradeType,
        quote_number: quoteNumber,
      });
      setFeedbackMessage("");
      setFeedbackStatus("Feedback sent. Thank you.");
    } catch (error) {
      setFeedbackStatus(error.message);
    }
  }

  async function createSignedPhotoUrls(photoRecords) {
    if (!photoRecords.length) return [];

    const signedUrls = await Promise.all(
      photoRecords.map(async (photo) => {
        const { data, error } = await supabase.storage.from(jobPhotosBucket).createSignedUrl(photo.storage_path, 60 * 60);
        if (error) {
          return {
            name: photo.file_name || "Saved photo",
            path: photo.storage_path,
            url: "",
            error: error.message,
          };
        }

        return {
          name: photo.file_name || "Saved photo",
          path: photo.storage_path,
          url: data?.signedUrl || "",
          error: "",
        };
      }),
    );

    return signedUrls;
  }

  async function createSignedVoiceUrls(voiceRecords) {
    if (!voiceRecords.length) return [];

    const signedUrls = await Promise.all(
      voiceRecords.map(async (voice) => {
        if (!voice.storage_path) {
          return {
            name: voice.file_name || "Voice transcript",
            transcript: voice.transcript || "",
            path: "",
            url: "",
            error: "",
          };
        }

        const { data, error } = await supabase.storage.from(jobVoiceBucket).createSignedUrl(voice.storage_path, 60 * 60);
        if (error) {
          return {
            name: voice.file_name || "Voice note",
            transcript: voice.transcript || "",
            path: voice.storage_path,
            url: "",
            error: error.message,
          };
        }

        return {
          name: voice.file_name || "Voice note",
          transcript: voice.transcript || "",
          path: voice.storage_path,
          url: data?.signedUrl || "",
          error: "",
        };
      }),
    );

    return signedUrls;
  }

  async function saveClientToSupabase() {
    const client = await saveClientRecord();
    if (client) {
      setSavedClients((clients) => [client, ...clients.filter((item) => item.client_id !== client.client_id)].slice(0, 6));
      setActiveClient(client);
      setClientSaveStatus("Client saved to Supabase.");
    }
  }

  function openSavedQuote(savedQuote) {
    const client = savedQuote.client || {};
    const job = savedQuote.job || {};
    const nextJobId = savedQuote.job_id || job.job_id || null;
    const nextQuoteId = savedQuote.quote_id || null;
    const items = savedQuote.items?.length
      ? savedQuote.items.map((item) => ({
          id: item.quote_item_id || createId(),
          description: item.description || "",
          type: item.item_type || item.type || "other",
          amount: Number(item.amount || 0),
      }))
      : defaultItems.map((item) => ({ ...item, id: createId() }));

    setCurrentJobId(nextJobId);
    setCurrentQuoteId(nextQuoteId);
    setQuoteNumber(savedQuote.quote_number || `QT-${String(Math.floor(Math.random() * 9000) + 1000)}`);
    setQuoteStatus(savedQuote.status || "draft");
    setActiveClient(client.client_id ? client : null);
    setClientName(client.name || "");
    setClientPhone(client.phone || "");
    setClientEmail(client.email || "");
    setSiteAddress(client.address || client.site_address || "");
    setTradeType(job.trade_type || tradeType);
    setUrgency(job.urgency || "Standard");
    setJobDescription(job.description || client.notes || "");
    setTerms(savedQuote.terms || defaultTerms);
    setLineItems(items);
    setPhotos([]);
    setSavedPhotoUrls(savedQuote.signedPhotoUrls || []);
    setVoiceBlob(null);
    setVoiceUrl("");
    setSavedVoiceUrls(savedQuote.signedVoiceUrls || []);
    setVoiceNote(savedQuote.voiceRecords?.[0]?.transcript || job.voice_note || "");
    setPhotoStatus(
      savedQuote.photoRecords?.length
        ? `${savedQuote.photoRecords.length} saved photo${savedQuote.photoRecords.length === 1 ? "" : "s"} attached. Add new photos to replace them on next save.`
        : "",
    );
    setVoiceStatus(
      savedQuote.voiceRecords?.length
        ? `${savedQuote.voiceRecords.length} saved voice note${savedQuote.voiceRecords.length === 1 ? "" : "s"} attached.`
        : "No saved voice note attached."
    );
    setGeneratedQuote("");
    setQuoteSaveStatus(`Loaded ${savedQuote.quote_number || "saved quote"} for editing.`);
    loadAgentTasks(activeBusiness?.id, nextJobId, nextQuoteId);
  }

  async function saveClientRecord() {
    if (!supabase) {
      setClientSaveStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return null;
    }

    if (!clientName.trim()) {
      setClientSaveStatus("Add a client name before saving.");
      return null;
    }

    if (!activeBusiness?.id) {
      setClientSaveStatus("Create or select a business before saving clients.");
      return null;
    }

    const payload = {
      business_id: activeBusiness.id,
      client_id: activeClient?.client_id,
      name: clientName.trim(),
      phone: clientPhone.trim() || null,
      email: clientEmail.trim() || null,
      address: siteAddress.trim() || null,
      notes: jobDescription.trim() || null,
    };

    try {
      const data = await postJsonApi("/api/clients/save", payload);
      return data.client;
    } catch (error) {
      setClientSaveStatus(error.message);
      return null;
    }
  }

  async function saveQuoteToSupabase() {
    if (!supabase) {
      setQuoteSaveStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    if (!activeBusiness?.id) {
      setQuoteSaveStatus("Create or select a business before saving a quote.");
      return;
    }

    setQuoteSaveStatus("Saving quote...");

    if (!activeClient && !clientName.trim()) {
      setQuoteSaveStatus("Save or enter a client before saving the quote.");
      return;
    }

    let saved;
    try {
      saved = await postJsonApi("/api/quotes/save", {
        business_id: activeBusiness.id,
        job_id: currentJobId,
        quote_id: currentQuoteId,
        client: activeClient?.client_id
          ? { client_id: activeClient.client_id }
          : {
              name: clientName.trim(),
              phone: clientPhone.trim(),
              email: clientEmail.trim(),
              address: siteAddress.trim(),
              notes: jobDescription.trim(),
            },
        trade_type: tradeType,
        urgency,
        description: jobDescription.trim(),
        quote_number: quoteNumber,
        subtotal: totals.subtotal,
        gst: totals.gst,
        total: totals.grand,
        terms: terms.trim(),
        status: quoteStatus,
        line_items: lineItems.map((item) => ({
          description: item.description,
          type: item.type,
          amount: Number(item.amount || 0),
        })),
      });
    } catch (error) {
      setQuoteSaveStatus(error.message);
      return;
    }

    const { client, job, quote } = saved;

    setCurrentJobId(job.job_id);
    setCurrentQuoteId(quote.quote_id);
    setActiveClient(client);
    setSavedClients((clients) => [client, ...clients.filter((item) => item.client_id !== client.client_id)].slice(0, 6));

    const photoResult = await saveJobPhotos(job.job_id);
    const voiceResult = await saveJobVoiceRecording(job.job_id);

    setGeneratedQuote(buildQuoteText());
    await loadQuoteHistory(activeBusiness.id);
    await loadAgentTasks(activeBusiness.id, job.job_id, quote.quote_id);
    setQuoteSaveStatus(
      [
        `${currentQuoteId ? "Quote updated" : "Quote saved"}: ${quote.quote_number || quote.quote_id}`,
        photoResult.savedCount ? `${photoResult.savedCount} photo${photoResult.savedCount === 1 ? "" : "s"} saved.` : "",
        voiceResult.savedCount ? "Voice note saved." : "",
        photoResult.errorMessage ? `Photo save issue: ${photoResult.errorMessage}` : "",
        voiceResult.errorMessage ? `Voice save issue: ${voiceResult.errorMessage}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function handlePhotosSelected(event) {
    const selectedPhotos = Array.from(event.target.files || []);
    const acceptedPhotos = [];
    const rejectedMessages = [];

    selectedPhotos.slice(0, maxPhotoFiles).forEach((photo) => {
      if (!photo.type.startsWith("image/") || (allowedPhotoTypes.size && !allowedPhotoTypes.has(photo.type))) {
        rejectedMessages.push(`${photo.name} is not a supported image type.`);
        return;
      }

      if (photo.size > maxPhotoSizeBytes) {
        rejectedMessages.push(`${photo.name} is larger than 10 MB.`);
        return;
      }

      acceptedPhotos.push(photo);
    });

    if (selectedPhotos.length > maxPhotoFiles) {
      rejectedMessages.push(`Only ${maxPhotoFiles} photos can be uploaded per quote.`);
    }

    setPhotos(acceptedPhotos);
    if (acceptedPhotos.length) setSavedPhotoUrls([]);
    setPhotoStatus(
      acceptedPhotos.length
        ? `${acceptedPhotos.length} photo${acceptedPhotos.length === 1 ? "" : "s"} selected: ${acceptedPhotos
            .map((photo) => photo.name)
            .join(", ")}${rejectedMessages.length ? ` ${rejectedMessages.join(" ")}` : ""}`
        : rejectedMessages.join(" ") || "No photos selected.",
    );
    event.target.value = "";
  }

  async function saveJobPhotos(jobId) {
    if (!photos.length) return { savedCount: 0, errorMessage: "No photos were selected." };

    const formData = new FormData();
    formData.append("business_id", activeBusiness.id);
    formData.append("job_id", jobId);
    formData.append("replace_existing", currentJobId ? "true" : "false");
    photos.forEach((photo) => formData.append("photos", photo, photo.name));

    try {
      return await postFormApi("/api/media/job-photos", formData);
    } catch (error) {
      return { savedCount: 0, errorMessage: error.message };
    }
  }

  function getVoiceFileExtension(mimeType) {
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("mpeg")) return "mp3";
    return "webm";
  }

  async function saveJobVoiceRecording(jobId) {
    if (!voiceBlob && !voiceNote.trim()) return { savedCount: 0, errorMessage: "" };

    if (voiceBlob && voiceBlob.size > maxVoiceSizeBytes) {
      return { savedCount: 0, errorMessage: "Voice recording is larger than 25 MB." };
    }

    const formData = new FormData();
    formData.append("business_id", activeBusiness.id);
    formData.append("job_id", jobId);
    formData.append("replace_existing", currentJobId ? "true" : "false");
    formData.append("transcript", voiceNote.trim());
    if (voiceBlob) {
      const extension = getVoiceFileExtension(voiceBlob.type || "");
      formData.append("voice", voiceBlob, `voice-note-${Date.now()}.${extension}`);
    }

    try {
      return await postFormApi("/api/media/job-voice", formData);
    } catch (error) {
      return { savedCount: 0, errorMessage: error.message };
    }
  }

  async function updateQuoteStatus(nextStatus) {
    setQuoteStatus(nextStatus);

    if (!currentQuoteId) {
      setQuoteSaveStatus(`Status set to ${quoteStatuses.find((status) => status.value === nextStatus)?.label || nextStatus}. Save quote to store it.`);
      return;
    }

    if (!supabase) {
      setQuoteSaveStatus("Supabase is not configured. Check .env.local and restart the dev server.");
      return;
    }

    let data;
    try {
      const response = await postJsonApi("/api/quotes/status", {
        quote_id: currentQuoteId,
        business_id: activeBusiness?.id,
        status: nextStatus,
      });
      data = response.quote;
    } catch (error) {
      setQuoteSaveStatus(error.message);
      return;
    }

    setQuoteStatus(data.status || nextStatus);
    if (activeBusiness?.id) await loadQuoteHistory(activeBusiness.id);
    setQuoteSaveStatus(`Quote marked as ${quoteStatuses.find((status) => status.value === nextStatus)?.label || nextStatus}.`);
  }

  function startNewQuote() {
    setCurrentJobId(null);
    setCurrentQuoteId(null);
    setActiveClient(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSiteAddress("");
    setJobDescription("");
    setPhotos([]);
    setSavedPhotoUrls([]);
    setPhotoStatus("");
    setVoiceNote("");
    setVoiceBlob(null);
    setSavedVoiceUrls([]);
    if (voiceUrl) {
      URL.revokeObjectURL(voiceUrl);
      setVoiceUrl("");
    }
    setVoiceStatus("Record an audio note and transcript for the quote.");
    setGeneratedQuote("");
    setQuoteSaveStatus("New quote started.");
    setSavedTasks([]);
    setTaskStatus("Save the new quote before adding follow-up tasks.");
    setQuoteNumber(`QT-${String(Math.floor(Math.random() * 9000) + 1000)}`);
    setQuoteStatus("draft");
    setLineItems(defaultItems.map((item) => ({ ...item, id: createId() })));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TradeQuote</p>
          <h1>Automated quote builder</h1>
        </div>
        <div className="topbar-actions">
          {installPrompt ? (
            <button className="icon-button" type="button" title="Install app" onClick={installApp}>
              Install
            </button>
          ) : null}
        </div>
      </header>

      <section className="onboarding-strip" aria-label="Setup progress">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Pilot workflow</p>
            <h2>{nextOnboardingStep ? `Next: ${nextOnboardingStep.label}` : "Ready to quote"}</h2>
          </div>
          <span>{onboardingSteps.filter((step) => step.done).length}/{onboardingSteps.length}</span>
        </div>
        <p>{nextOnboardingStep?.hint || "The core quote flow is ready. Save, export, and review quote history from the panel below."}</p>
        <div className="onboarding-steps">
          {onboardingSteps.map((step) => (
            <div className={step.done ? "onboarding-step done" : "onboarding-step"} key={step.key}>
              <span>{step.done ? "OK" : ""}</span>
              <strong>{step.label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="quote-grid">
        <form className="panel intake">
          <div className="section-heading">
            <h2>Job details</h2>
            <p>Capture the client request, photos, voice notes, and pricing in one quote.</p>
          </div>

          <div className="auth-panel">
            <div>
              <strong>Account</strong>
              <span>{authStatus || "Sign in before using secured client data."}</span>
            </div>
            <div className="field-pair">
              <label>
                Email
                <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} inputMode="email" autoComplete="email" placeholder="you@example.com" />
              </label>
              <label>
                Password
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Minimum 6 characters"
                />
              </label>
            </div>
            <div className="auth-actions">
              {session ? (
                <button className="secondary-button" type="button" onClick={signOut}>
                  Sign out
                </button>
              ) : (
                <>
                  <button className="primary-button" type="button" onClick={signIn}>
                    Sign in
                  </button>
                  <button className="secondary-button" type="button" onClick={signUp}>
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="data-panel">
            <div>
              <strong>Business</strong>
              <span>{businessStatus || "Create or select the business workspace for this quote."}</span>
            </div>
            <div className="field-pair">
              <label>
                Business name
                <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Smith Plumbing" />
              </label>
              <label>
                Active business
                <select
                  value={activeBusiness?.id || ""}
                  onChange={(event) => {
                    const nextBusiness = businesses.find((business) => business.id === event.target.value) || null;
                    setActiveBusiness(nextBusiness);
                    loadSavedClients(nextBusiness?.id);
                    loadQuoteHistory(nextBusiness?.id);
                    loadBillingSummary(nextBusiness?.id);
                  }}
                >
                  <option value="">No business selected</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button className="primary-button" type="button" onClick={createBusiness}>
                Create business
              </button>
              <button className="secondary-button" type="button" onClick={() => loadBusinesses()}>
                Refresh businesses
              </button>
            </div>
          </div>

          <div className="billing-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">SaaS billing</p>
                <h2>Subscription</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => loadBillingSummary()}>
                Refresh
              </button>
            </div>

            <div className="billing-summary">
              <div>
                <span>Current plan</span>
                <strong>{billingEntitlements?.name || businessSubscription?.subscription_plans?.name || "Free"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{billingEntitlements?.status || businessSubscription?.status || "free"}</strong>
              </div>
              <div>
                <span>Quotes this month</span>
                <strong>
                  {billingUsage.quote_created || 0}
                  {billingEntitlements?.quote_limit_monthly ? ` / ${billingEntitlements.quote_limit_monthly}` : ""}
                </strong>
              </div>
            </div>

            <div className="feature-grid">
              <span className={billingEntitlements?.includes_photos ? "feature-on" : "feature-off"}>Photos</span>
              <span className={billingEntitlements?.includes_voice ? "feature-on" : "feature-off"}>Voice</span>
              <span className={billingEntitlements?.includes_ai ? "feature-on" : "feature-off"}>AI</span>
              <span className={billingEntitlements?.includes_tasks ? "feature-on" : "feature-off"}>Tasks</span>
            </div>

            <span className="status-text">{billingStatus || "Plans load after selecting a business."}</span>

            {billingPlans.length ? (
              <div className="plan-grid">
                {billingPlans.map((plan) => {
                  const isCurrentPlan = businessSubscription?.subscription_plans?.plan_code === plan.plan_code;
                  return (
                    <div className="plan-card" key={plan.subscription_plan_id}>
                      <div>
                        <strong>{plan.name}</strong>
                        <span>{formatPlanPrice(plan)}</span>
                      </div>
                      <p>{plan.description || "Subscription plan"}</p>
                      <small>
                        {plan.quote_limit_monthly ? `${plan.quote_limit_monthly} quotes/month` : "Unlimited quotes"} · {plan.user_limit} user{plan.user_limit === 1 ? "" : "s"}
                      </small>
                      <button className={isCurrentPlan ? "secondary-button" : "primary-button"} type="button" onClick={() => startCheckout(plan.plan_code)} disabled={isCurrentPlan}>
                        {isCurrentPlan ? "Current plan" : "Choose plan"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="feedback-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Pilot feedback</p>
                <h2>Tester notes</h2>
              </div>
            </div>
            <label>
              How did this step feel?
              <select value={feedbackRating} onChange={(event) => setFeedbackRating(event.target.value)}>
                <option value="blocked">Blocked</option>
                <option value="hard">Hard to use</option>
                <option value="ok">OK</option>
                <option value="good">Good</option>
              </select>
            </label>
            <label>
              Note
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={3}
                placeholder="What happened, what was confusing, or what should be improved?"
              />
            </label>
            <div className="actions">
              <button className="primary-button" type="button" onClick={sendPilotFeedback}>
                Send feedback
              </button>
              <button className="secondary-button" type="button" onClick={() => setFeedbackMessage("")}>
                Clear
              </button>
            </div>
            <span className="status-text">{feedbackStatus || "Feedback is saved against the selected business."}</span>
          </div>

          <div className="data-panel">
            <div>
              <strong>Client data</strong>
              <span>{clientSaveStatus || "Ready to connect to Supabase."}</span>
            </div>
            <div className="actions">
              <button className="primary-button" type="button" onClick={saveClientToSupabase}>
                Save client
              </button>
              <button className="secondary-button" type="button" onClick={loadSavedClients}>
                Refresh
              </button>
            </div>
            {savedClients.length ? (
              <div className="saved-client-list">
                {savedClients.map((client) => (
                  <button
                    key={client.client_id || client.id || `${client.name}-${client.phone}`}
                    type="button"
                    className="saved-client"
                    onClick={() => {
                      setClientName(client.name || "");
                      setClientPhone(client.phone || "");
                      setClientEmail(client.email || "");
                      setSiteAddress(client.site_address || client.address || "");
                      setActiveClient(client);
                    }}
                  >
                    <strong>{client.name || "Unnamed client"}</strong>
                    <span>{client.phone || client.email || "No contact saved"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field-pair">
            <label>
              Client name
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} autoComplete="name" placeholder="e.g. Sarah Mitchell" />
            </label>
            <label>
              Phone
              <input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="0400 000 000" />
            </label>
          </div>

          <div className="client-actions-row">
            <button className="primary-button" type="button" onClick={saveClientToSupabase}>
              Save client
            </button>
            <span>{clientSaveStatus || "Enter client details, then save to Supabase."}</span>
          </div>

          <label>
            Email
            <input value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} inputMode="email" autoComplete="email" placeholder="client@example.com" />
          </label>

          <label>
            Site address
            <input value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} autoComplete="street-address" placeholder="12 Example St, Sydney NSW" />
          </label>

          <div className="field-pair">
            <label>
              Trade
              <select value={tradeType} onChange={(event) => handleTradeChange(event.target.value)}>
                {trades.map((trade) => (
                  <option key={trade}>{trade}</option>
                ))}
              </select>
            </label>
            <label>
              Urgency
              <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                {urgencies.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Quote language
            <select value={quoteLanguage} onChange={(event) => setQuoteLanguage(event.target.value)}>
              {quoteLanguages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Client request
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              rows={5}
              placeholder="Describe the issue, required work, access notes, preferred timing..."
            />
          </label>

          <div className="media-row">
            <label className="upload-card">
              <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotosSelected} />
              <span className="media-icon">+</span>
              <strong>Add photos</strong>
              <small>{photoStatus || "Use camera or gallery"}</small>
            </label>
            <div className="voice-card">
              <button className={`voice-button ${isRecording ? "recording" : ""}`} type="button" onClick={toggleVoiceRecording}>
                <span aria-hidden="true">Rec</span>
                <span>{isRecording ? "Stop recording" : "Record voice note"}</span>
              </button>
              <p>{voiceStatus}</p>
              {voiceUrl ? <audio controls src={voiceUrl} /> : null}
              {savedVoiceUrls.map((voice) => (voice.url ? <audio controls key={voice.url} src={voice.url} /> : null))}
            </div>
          </div>

          <div className="photo-preview" aria-live="polite">
            {savedPhotoUrls.map((photo) =>
              photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={photo.url} src={photo.url} alt={photo.name} />
              ) : null,
            )}
            {photoPreviews.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.url} src={photo.url} alt={photo.name} />
            ))}
          </div>

          {tradeType === "Painting" ? (
            <div className="measurement-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Measurements</p>
                  <h2>Paint area</h2>
                </div>
                <button className="secondary-button" type="button" onClick={applyPaintingEstimate}>
                  Apply estimate
                </button>
              </div>
              <div className="measurement-grid">
                <label>
                  Width / length (m)
                  <input value={paintingMeasurements.width} onChange={(event) => updatePaintingMeasurement("width", event.target.value)} type="number" min="0" step="0.1" inputMode="decimal" />
                </label>
                <label>
                  Height (m)
                  <input value={paintingMeasurements.height} onChange={(event) => updatePaintingMeasurement("height", event.target.value)} type="number" min="0" step="0.1" inputMode="decimal" />
                </label>
                <label>
                  Walls/surfaces
                  <input value={paintingMeasurements.surfaceCount} onChange={(event) => updatePaintingMeasurement("surfaceCount", event.target.value)} type="number" min="1" step="1" inputMode="numeric" />
                </label>
                <label>
                  Doors/windows sqm
                  <input value={paintingMeasurements.openingsArea} onChange={(event) => updatePaintingMeasurement("openingsArea", event.target.value)} type="number" min="0" step="0.1" inputMode="decimal" />
                </label>
                <label>
                  Coats
                  <input value={paintingMeasurements.coats} onChange={(event) => updatePaintingMeasurement("coats", event.target.value)} type="number" min="1" step="1" inputMode="numeric" />
                </label>
                <label>
                  Coverage sqm/L
                  <input value={paintingMeasurements.coverage} onChange={(event) => updatePaintingMeasurement("coverage", event.target.value)} type="number" min="1" step="0.5" inputMode="decimal" />
                </label>
              </div>
              <div className="measurement-summary">
                <div>
                  <span>Paintable area</span>
                  <strong>{paintingEstimate.paintableArea.toFixed(2)} sqm</strong>
                </div>
                <div>
                  <span>Coat area</span>
                  <strong>{paintingEstimate.coatArea.toFixed(2)} sqm</strong>
                </div>
                <div>
                  <span>Paint required</span>
                  <strong>{paintingEstimate.roundedLitres.toFixed(1)} L</strong>
                </div>
                <div>
                  <span>Estimate</span>
                  <strong>{currency.format(paintingEstimate.labourAmount + paintingEstimate.materialAmount)}</strong>
                </div>
              </div>
              <span className="status-text">{measurementStatus || "Use confirmed measurements from text, voice, photo notes, or a diagram before final pricing."}</span>
            </div>
          ) : null}

          {tradeType === "Carpentry" ? (
            <div className="measurement-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Measurements</p>
                  <h2>Carpentry area</h2>
                </div>
                <button className="secondary-button" type="button" onClick={applyCarpentryEstimate}>
                  Apply estimate
                </button>
              </div>
              <div className="measurement-grid">
                <label>
                  Length (m)
                  <input value={carpentryMeasurements.length} onChange={(event) => updateCarpentryMeasurement("length", event.target.value)} type="number" min="0" step="0.1" inputMode="decimal" />
                </label>
                <label>
                  Width (m)
                  <input value={carpentryMeasurements.width} onChange={(event) => updateCarpentryMeasurement("width", event.target.value)} type="number" min="0" step="0.1" inputMode="decimal" />
                </label>
                <label>
                  Wastage %
                  <input value={carpentryMeasurements.wastagePercent} onChange={(event) => updateCarpentryMeasurement("wastagePercent", event.target.value)} type="number" min="0" step="1" inputMode="numeric" />
                </label>
                <label>
                  Material $/sqm
                  <input value={carpentryMeasurements.materialRate} onChange={(event) => updateCarpentryMeasurement("materialRate", event.target.value)} type="number" min="0" step="1" inputMode="decimal" />
                </label>
                <label>
                  Labour $/sqm
                  <input value={carpentryMeasurements.labourRate} onChange={(event) => updateCarpentryMeasurement("labourRate", event.target.value)} type="number" min="0" step="1" inputMode="decimal" />
                </label>
                <label>
                  Trims/fixings $
                  <input value={carpentryMeasurements.trimAllowance} onChange={(event) => updateCarpentryMeasurement("trimAllowance", event.target.value)} type="number" min="0" step="1" inputMode="decimal" />
                </label>
              </div>
              <div className="measurement-summary">
                <div>
                  <span>Install area</span>
                  <strong>{carpentryEstimate.area.toFixed(2)} sqm</strong>
                </div>
                <div>
                  <span>Material area</span>
                  <strong>{carpentryEstimate.materialArea.toFixed(2)} sqm</strong>
                </div>
                <div>
                  <span>Materials</span>
                  <strong>{currency.format(carpentryEstimate.materialAmount + carpentryEstimate.trimAllowance)}</strong>
                </div>
                <div>
                  <span>Estimate</span>
                  <strong>{currency.format(carpentryEstimate.totalAmount)}</strong>
                </div>
              </div>
              <span className="status-text">{measurementStatus || "Use this for flooring, decking, wall lining, panels, and similar carpentry area estimates."}</span>
            </div>
          ) : null}

          <div className="section-heading compact">
            <h2>Quote items</h2>
            <button className="secondary-button" type="button" onClick={addLineItem}>
              Add item
            </button>
          </div>

          <div className="line-items">
            {lineItems.map((item) => (
              <div className="line-item" key={item.id}>
                <label>
                  Description
                  <input value={item.description} onChange={(event) => updateLineItem(item.id, "description", event.target.value)} placeholder="Item description" />
                </label>
                <label>
                  Type
                  <select value={item.type} onChange={(event) => updateLineItem(item.id, "type", event.target.value)}>
                    <option value="labour">Labour</option>
                    <option value="materials">Materials</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input value={item.amount} onChange={(event) => updateLineItem(item.id, "amount", Number(event.target.value || 0))} type="number" min="0" step="0.01" />
                </label>
                <button className="remove-item" type="button" title="Remove item" onClick={() => removeLineItem(item.id)}>
                  x
                </button>
              </div>
            ))}
          </div>

          <label>
            Terms and notes
            <textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={4} />
          </label>
        </form>

        <aside className="panel quote-preview" aria-live="polite">
          <div className="preview-header">
            <div>
              <p className="eyebrow">Live quote</p>
              <h2>{quoteNumber}</h2>
            </div>
            <span id="quoteStatus">{quoteStatuses.find((status) => status.value === quoteStatus)?.label || "Draft"}</span>
          </div>

          <div className="client-card">
            <strong>{clientName.trim() || "Client not set"}</strong>
            <span>{siteAddress.trim() || "Site address pending"}</span>
            <span>{`${tradeType} - ${urgency}`}</span>
          </div>

          <div className="ai-assist">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">RAG assistant</p>
                <h2>AI quote check</h2>
              </div>
              <div className="button-pair">
                <button className="primary-button" type="button" onClick={runScopeCheck}>
                  Scope check
                </button>
                <button className="secondary-button" type="button" onClick={runAiAssistance}>
                  Prompt check
                </button>
              </div>
            </div>
            <p className="assist-note">Retrieves trade guidance, checks missing details, and drafts LLM-ready quote advice.</p>
            {scopeCheckResult ? (
              <div className="scope-check-panel">
                <div className="scope-score">
                  <span>Confidence</span>
                  <strong>{Math.round(Number(scopeCheckResult.confidence || 0) * 100)}%</strong>
                </div>
                <div className="scope-list">
                  <strong>Questions</strong>
                  {(scopeCheckResult.questions || []).slice(0, 4).map((item) => (
                    <span key={item.question}>{item.question}</span>
                  ))}
                </div>
                <div className="scope-list">
                  <strong>Materials</strong>
                  {(scopeCheckResult.material_suggestions || []).slice(0, 4).map((item) => (
                    <span key={item.material_name}>
                      {item.material_name}
                      {item.allowance_amount ? ` - ${currency.format(Number(item.allowance_amount))}` : ""}
                    </span>
                  ))}
                </div>
                <div className="scope-list">
                  <strong>Risks</strong>
                  {(scopeCheckResult.risks || []).slice(0, 4).map((risk) => (
                    <span key={risk}>{risk}</span>
                  ))}
                </div>
                <div className="actions">
                  <button className="primary-button" type="button" onClick={applyScopeCheckItems}>
                    Apply AI items
                  </button>
                  <button className="secondary-button" type="button" onClick={runScopeCheck}>
                    Re-run check
                  </button>
                </div>
              </div>
            ) : null}
            <div className="context-list">
              {(latestAssistance?.matches || []).length ? (
                latestAssistance.matches.map((match) => (
                  <div className="context-pill" key={match.id}>
                    <strong>{match.title}</strong>
                    <span>{`Score ${match.score} - ${match.guidance}`}</span>
                  </div>
                ))
              ) : (
                <div className="context-pill">
                  <strong>No guidance found yet</strong>
                  <span>Add more job detail or a voice note.</span>
                </div>
              )}
            </div>
            <div className="actions">
              <button className="secondary-button" type="button" onClick={applySuggestedItems}>
                Apply suggested items
              </button>
              <button className="secondary-button" type="button" onClick={copyAiPrompt}>
                {copyPromptLabel}
              </button>
            </div>
            <span className="status-text">{scopeCheckStatus || "Scope Check saves questions, materials, assumptions, and suggested quote items."}</span>
            <textarea className="ai-output" rows={12} readOnly value={aiOutput} placeholder="AI recommendations will appear here." />
          </div>

          <div className="summary-block">
            <h3>Scope</h3>
            <p>{jobDescription.trim() || "Add the client request to generate a clearer quote scope."}</p>
          </div>

          <div className="summary-block">
            <h3>Voice note</h3>
            <p>{voiceNote || "No voice note captured yet."}</p>
          </div>

          <div className="totals">
            <div>
              <span>Labour</span>
              <strong>{currency.format(totals.labour)}</strong>
            </div>
            <div>
              <span>Materials</span>
              <strong>{currency.format(totals.materials)}</strong>
            </div>
            <div>
              <span>Other</span>
              <strong>{currency.format(totals.other)}</strong>
            </div>
            <div>
              <span>GST</span>
              <strong>{currency.format(totals.gst)}</strong>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{currency.format(totals.grand)}</strong>
            </div>
          </div>

          <div className="actions">
            <button className="primary-button" type="button" onClick={() => setGeneratedQuote(buildQuoteText())}>
              Generate quote text
            </button>
            <button className="secondary-button" type="button" onClick={saveQuoteToSupabase}>
              Save quote
            </button>
          </div>

          <div className="status-panel">
            <label>
              Quote status
              <select value={quoteStatus} onChange={(event) => updateQuoteStatus(event.target.value)}>
                {quoteStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="status-actions">
              <button className="secondary-button" type="button" onClick={() => updateQuoteStatus("sent")}>
                Mark sent
              </button>
              <button className="secondary-button" type="button" onClick={() => updateQuoteStatus("accepted")}>
                Mark accepted
              </button>
              <button className="secondary-button" type="button" onClick={() => updateQuoteStatus("rejected")}>
                Mark rejected
              </button>
            </div>
          </div>

          <div className="task-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2>Follow-ups</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => loadAgentTasks()}>
                Refresh
              </button>
            </div>

            <div className="task-create-row">
              <label>
                Task
                <select value={taskDraftType} onChange={(event) => setTaskDraftType(event.target.value)}>
                  {taskTypes.map((task) => (
                    <option key={task.value} value={task.value}>
                      {task.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={taskDraftPriority} onChange={(event) => setTaskDraftPriority(event.target.value)}>
                  {taskPriorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="button" onClick={() => createAgentTask()}>
                Add task
              </button>
            </div>

            <div className="task-shortcuts">
              {taskTypes.slice(0, 5).map((task) => (
                <button className="secondary-button" type="button" key={task.value} onClick={() => createAgentTask(task.value)}>
                  {task.label}
                </button>
              ))}
            </div>

            <span className="status-text">{taskStatus || "Save or open a quote, then add follow-up tasks."}</span>
            {hermesStatus ? <span className="status-text">{hermesStatus}</span> : null}

            {savedTasks.length ? (
              <div className="task-list">
                {savedTasks.map((task) => (
                  <div className="task-card" key={task.agent_task_id}>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{task.description || taskTypes.find((item) => item.value === task.task_type)?.label || "Task"}</small>
                    </div>
                    <div className="task-meta">
                      <small className={`status-badge status-${task.status || "open"}`}>
                        {taskStatuses.find((status) => status.value === task.status)?.label || "Open"}
                      </small>
                      <small>{taskPriorities.find((priority) => priority.value === task.priority)?.label || "Normal"}</small>
                    </div>
                    <select value={task.status || "open"} onChange={(event) => updateAgentTaskStatus(task.agent_task_id, event.target.value)}>
                      {taskStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button className="secondary-button" type="button" onClick={() => assignTaskToHermes(task.agent_task_id)}>
                      Send Hermes
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="actions">
            <button className="secondary-button" type="button" onClick={copyQuote}>
              {copyLabel}
            </button>
            <button className="secondary-button" type="button" onClick={exportQuotePdf}>
              Export PDF
            </button>
          </div>

          <div className="actions">
            <button className="secondary-button" type="button" onClick={startNewQuote}>
              New quote
            </button>
            <button className="secondary-button" type="button" onClick={() => loadQuoteHistory()}>
              Refresh history
            </button>
          </div>

          <div className="actions">
            <span className="status-text">{quoteSaveStatus || "Save quote writes job, quote, and quote items to Supabase."}</span>
          </div>

          <div className="history-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Saved work</p>
                <h2>Quote history</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => loadQuoteHistory()}>
                Refresh
              </button>
            </div>
            <span className="status-text">{historyStatus || "Saved quotes for the selected business will appear here."}</span>
            {savedQuotes.length ? (
              <div className="history-list">
                {savedQuotes.map((savedQuote) => (
                  <button className="history-card" type="button" key={savedQuote.quote_id} onClick={() => openSavedQuote(savedQuote)}>
                    <span>
                      <strong>{savedQuote.quote_number || "Saved quote"}</strong>
                      <small className={`status-badge status-${savedQuote.status || "draft"}`}>
                        {quoteStatuses.find((status) => status.value === savedQuote.status)?.label || "Draft"}
                      </small>
                      <small>{savedQuote.client?.name || "Client not linked"}</small>
                    </span>
                    <span>
                      <strong>{currency.format(Number(savedQuote.total || 0))}</strong>
                      <small>
                        {savedQuote.signedPhotoUrls?.some((photo) => photo.error)
                          ? "Photo access blocked"
                          : savedQuote.photoRecords?.length
                            ? `${savedQuote.photoRecords.length} photos`
                            : "No photos"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <textarea className="generated-output" rows={10} readOnly value={generatedQuote} placeholder="Generated quote will appear here." />
        </aside>
      </section>

      <nav className="mobile-action-bar" aria-label="Quote actions">
        <button className="secondary-button" type="button" onClick={startNewQuote}>
          New
        </button>
        <button className="primary-button" type="button" onClick={saveQuoteToSupabase}>
          Save
        </button>
        <button className="secondary-button" type="button" onClick={exportQuotePdf}>
          PDF
        </button>
      </nav>
    </main>
  );
}
