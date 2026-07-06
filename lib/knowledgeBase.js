const allTrades = [
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Builder",
  "Engineering / Fabrication",
  "HVAC",
  "Landscaping",
  "Painting",
  "Roofing",
  "General maintenance",
  "Other",
];

export const tradeKnowledge = [
  {
    id: "pricing-callout",
    title: "Call-out, inspection, and admin",
    trades: allTrades,
    keywords: ["call out", "callout", "inspection", "quote", "travel", "diagnose", "assessment", "admin"],
    guidance:
      "Include a call-out or inspection line when travel, diagnosis, site access, client communication, or quote preparation is required.",
    items: [{ description: "Call-out, site inspection, and quote preparation", type: "other", amount: 95 }],
    checks: ["Confirm site access, parking, strata/body corporate requirements, and whether the client needs an urgent attendance window."],
  },
  {
    id: "pricing-urgent",
    title: "Urgent and after-hours loading",
    trades: allTrades,
    keywords: ["urgent", "emergency", "after hours", "tonight", "weekend", "asap", "same day", "leak", "no power"],
    guidance:
      "Urgent or after-hours work should include a loading because scheduling pressure, supplier access, and risk are higher.",
    items: [{ description: "Urgency / scheduling loading", type: "labour", amount: 120 }],
    checks: ["Ask whether the job is safety critical and whether temporary make-safe work is acceptable before permanent repair."],
  },
  {
    id: "plumbing-leak",
    title: "Plumbing leak repair",
    trades: ["Plumbing"],
    keywords: ["leak", "burst", "tap", "pipe", "water", "toilet", "vanity", "sink", "shower", "drain"],
    guidance:
      "For leaks, quote diagnosis separately from repair materials. Allow for isolation, testing, replacement fittings, sealant, and cleanup.",
    items: [
      { description: "Leak diagnosis and isolation", type: "labour", amount: 180 },
      { description: "Replacement fittings and consumables allowance", type: "materials", amount: 140 },
      { description: "Pressure test and cleanup", type: "labour", amount: 90 },
    ],
    checks: ["Ask for photos of the leak source, water damage, access panels, pipe material, and whether water can be isolated."],
  },
  {
    id: "electrical-fault",
    title: "Electrical fault finding",
    trades: ["Electrical"],
    keywords: ["power", "switch", "light", "breaker", "safety switch", "rcd", "outlet", "sparking", "tripping"],
    guidance:
      "Fault finding should include testing time and a clear exclusion for hidden wiring defects until inspection is complete.",
    items: [
      { description: "Electrical fault finding and test", type: "labour", amount: 220 },
      { description: "Switch/outlet parts allowance", type: "materials", amount: 85 },
    ],
    checks: ["Confirm whether power is currently off, whether there is burning smell or sparking, and whether the switchboard is accessible."],
  },
  {
    id: "carpentry-repair",
    title: "Carpentry repair and install",
    trades: ["Carpentry"],
    keywords: ["door", "deck", "frame", "skirting", "timber", "hinge", "lock", "rot", "cabinet", "shelf"],
    guidance:
      "Carpentry quotes should separate labour, hardware, timber/material allowance, and finishing if painting or staining is required.",
    items: [
      { description: "Carpentry repair labour", type: "labour", amount: 260 },
      { description: "Timber, hardware, and fixings allowance", type: "materials", amount: 160 },
    ],
    checks: ["Ask for measurements, material preference, finish requirements, and photos of any rot or structural damage."],
  },
  {
    id: "painting-interior",
    title: "Painting preparation and coats",
    trades: ["Painting"],
    keywords: ["paint", "wall", "ceiling", "room", "patch", "prep", "coat", "stain", "mould"],
    guidance:
      "Painting work should include surface preparation, patching, number of coats, paint supply, masking, protection, and cleanup.",
    items: [
      { description: "Surface preparation and masking", type: "labour", amount: 220 },
      { description: "Paint and consumables allowance", type: "materials", amount: 180 },
      { description: "Painting labour - two coat allowance", type: "labour", amount: 420 },
    ],
    checks: ["Ask for room size, ceiling height, current wall condition, paint colour, sheen, and whether furniture must be moved."],
  },
  {
    id: "roofing-water",
    title: "Roof leak and gutter work",
    trades: ["Roofing"],
    keywords: ["roof", "gutter", "flashing", "tile", "metal", "downpipe", "water ingress", "ceiling stain"],
    guidance:
      "Roofing quotes need access and safety allowances. Separate inspection, make-safe, materials, and repair work.",
    items: [
      { description: "Roof access and leak inspection", type: "labour", amount: 240 },
      { description: "Roofing materials and sealants allowance", type: "materials", amount: 190 },
      { description: "Access and safety allowance", type: "other", amount: 120 },
    ],
    checks: ["Ask for roof type, pitch, number of storeys, access constraints, and photos of ceiling stains or gutter damage."],
  },
  {
    id: "landscaping-small",
    title: "Landscaping labour and disposal",
    trades: ["Landscaping"],
    keywords: ["garden", "soil", "mulch", "turf", "plants", "retaining", "paving", "green waste", "cleanup"],
    guidance:
      "Landscaping quotes should include labour, material delivery, green waste removal, access limits, and weather assumptions.",
    items: [
      { description: "Landscaping labour allowance", type: "labour", amount: 360 },
      { description: "Materials and delivery allowance", type: "materials", amount: 260 },
      { description: "Green waste removal", type: "other", amount: 120 },
    ],
    checks: ["Ask for area size, access width, slope, waste volume, preferred materials, and whether irrigation is present."],
  },
  {
    id: "risk-hidden-work",
    title: "Hidden conditions and variations",
    trades: allTrades,
    keywords: ["hidden", "damage", "behind", "inside wall", "under", "access", "unknown", "old", "asbestos", "mould"],
    guidance:
      "When hidden conditions are possible, include a variation clause and quote only the visible/known scope.",
    items: [],
    checks: ["Add a note that hidden damage, asbestos, mould, non-compliant wiring/plumbing, or inaccessible areas may require a revised quote."],
  },
];

export const trades = allTrades;
export const urgencies = ["Standard", "Urgent", "After hours"];
