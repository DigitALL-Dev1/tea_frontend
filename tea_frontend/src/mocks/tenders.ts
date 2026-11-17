/**
 * Eight sample tenders across the workflow. Approvals are given as "seed decisions";
 * the mock store replays them at start-up so every approval carries the real SHA-256
 * of the content it approved. The FAO tender then receives Amendment No.2, which
 * changes the technical content and voids the affected approvals.
 */
import { sha256Hex } from "@/lib/sha256";
import type {
  AiAnalysis,
  ApprovalGate,
  CostLine,
  ProposalSection,
  Quote,
  Requirement,
  Tender,
  TenderDocument,
} from "@/types";

export interface SeedDecision {
  gate: ApprovalGate;
  approverId: string;
  at: string;
  reason: string;
  bidDecision?: "BID" | "NO_BID";
  subjectId?: string;
}

export interface SeedAmendment {
  at: string;
  title: string;
  detail: string;
  material: boolean;
  document: TenderDocument;
  requirementChanges: { id: string; text: string; exactQuote: string }[];
}

export interface TenderSeed {
  tender: Tender;
  decisions: SeedDecision[];
  amendments?: SeedAmendment[];
}

// ---------- helpers ----------

const BG = "u-bernard";
const KO = "u-kowsalya";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function doc(
  tenderId: string,
  id: string,
  fileName: string,
  source: TenderDocument["source"],
  addedAt: string,
  sizeKb: number,
  scope: TenderDocument["scope"] = "TENDER",
): TenderDocument {
  return {
    id: `${tenderId}-${id}`,
    fileName,
    sha256: sha256Hex(`${tenderId}/${fileName}/${addedAt}`),
    source,
    scope,
    addedAt,
    sizeKb,
  };
}

type ReqTemplate = Omit<Requirement, "id" | "sourceDocumentId"> & { doc: "itb" | "spec" };

function reqs(tenderId: string, list: ReqTemplate[]): Requirement[] {
  return list.map(({ doc: d, ...r }, i) => ({
    ...r,
    id: `${tenderId}-R${String(i + 1).padStart(2, "0")}`,
    sourceDocumentId: `${tenderId}-${d}`,
  }));
}

function sections(
  tenderId: string,
  at: string,
  technicalTitle: string,
  technicalBody: string,
  comments: ProposalSection["comments"] = [],
): ProposalSection[] {
  return [
    {
      id: `${tenderId}-P1`,
      kind: "LEGAL",
      title: "Acceptance of UN General Conditions of Contract",
      body: "GREEN DigitALL Limited confirms acceptance of the UN General Conditions of Contract without reservation, including the provisions on privileges and immunities, anti-fraud and sexual exploitation and abuse. Our company is not on the UN Security Council sanctions list and has no conflict of interest with this procurement.",
      aiAssisted: true,
      updatedAt: at,
      comments: [],
    },
    {
      id: `${tenderId}-P2`,
      kind: "ADMIN",
      title: "Company profile and registration",
      body: "GREEN DigitALL Limited is registered with the Investment Promotion Authority of Papua New Guinea and holds a valid IRC tax clearance. We have delivered ICT and solar projects for public and development partners across the Pacific since 2014, with in-country teams in Port Moresby and Lae.",
      aiAssisted: true,
      updatedAt: at,
      comments: [],
    },
    {
      id: `${tenderId}-P3`,
      kind: "TECHNICAL",
      title: technicalTitle,
      body: technicalBody,
      aiAssisted: true,
      updatedAt: at,
      comments,
    },
    {
      id: `${tenderId}-P4`,
      kind: "TECHNICAL",
      title: "Implementation schedule and warranty",
      body: "Week 1–2: mobilisation and order confirmation. Week 3–8: manufacture and shipping (lead times confirmed by supplier quotes). Week 9–11: delivery, installation and testing. Week 12: handover, training and acceptance. Warranty and support are provided by our in-country team with a 48-hour response commitment.",
      aiAssisted: true,
      updatedAt: at,
      comments: [],
    },
  ];
}

function quote(
  tenderId: string,
  supplierId: string,
  ref: string,
  currency: Quote["currency"],
  fxToUsd: number,
  receivedAt: string,
  validUntil: string,
  leadTimeDays: number,
  lines: [string, string, number, number][],
): Quote {
  return {
    id: `${tenderId}-${ref}`,
    tenderId,
    supplierId,
    reference: ref,
    currency,
    fxToUsd,
    receivedAt,
    validUntil,
    leadTimeDays,
    lines: lines.map(([itemKey, description, quantity, unitPrice]) => ({
      itemKey,
      description,
      quantity,
      unitPrice,
    })),
  };
}

function cost(
  tenderId: string,
  n: number,
  itemKey: string,
  description: string,
  quantity: number,
  unitCostUsd: number,
  source: string,
  quoteId?: string,
): CostLine {
  return {
    id: `${tenderId}-C${n}`,
    itemKey,
    description,
    quantity,
    unitCostUsd,
    source,
    ...(quoteId ? { quoteId } : {}),
  };
}

function ai(
  score: number,
  recommendation: AiAnalysis["recommendation"],
  summary: string,
  reasons: string[],
  risks: string[],
  generatedAt: string,
): AiAnalysis {
  return {
    score,
    recommendation,
    summary,
    reasons,
    risks,
    generatedAt,
    model: "TEA analyst agent v0.4",
  };
}

const STD_RULES = [
  "Submit through the UNGM e-Tendering module only; emailed bids are rejected.",
  "Technical and financial offers in separate files; prices must not appear in the technical offer.",
  "Prices in USD, DAP to the delivery sites listed in Annex A.",
  "Offer validity: 90 days from the deadline.",
  "All forms signed by an authorised signatory and stamped.",
];

// ---------- requirement templates ----------

const SOLAR_REQS: ReqTemplate[] = [
  {
    doc: "spec",
    text: "PV modules: Tier-1 monocrystalline, at least 400 Wp, IEC 61215 / IEC 61730 certified",
    page: 6,
    exactQuote:
      "PV modules shall be Tier-1 monocrystalline with a minimum rated power of 400 Wp, certified to IEC 61215 and IEC 61730.",
    quoteVerified: true,
    mandatory: true,
    response: "450 Wp monocrystalline modules, IEC 61215/61730 certified",
    evidence: "Module datasheet and IEC certificates (Annex T3)",
    status: "MET",
  },
  {
    doc: "spec",
    text: "Battery storage: LiFePO4, at least 6,000 cycles at 80% depth of discharge",
    page: 8,
    exactQuote:
      "Battery banks shall use lithium iron phosphate (LiFePO4) chemistry rated for not less than 6,000 cycles at 80% DoD.",
    quoteVerified: true,
    mandatory: true,
    response: "LiFePO4 48 V banks rated 6,500 cycles at 80% DoD",
    evidence: "Battery datasheet (Annex T4)",
    status: "MET",
  },
  {
    doc: "itb",
    text: "Installation and commissioning within 90 days of contract signature",
    page: 12,
    exactQuote:
      "The Contractor shall complete installation and commissioning at all sites within ninety (90) calendar days of contract signature.",
    quoteVerified: true,
    mandatory: true,
    response: "84-day plan; depends on supplier lead time",
    evidence: "Implementation schedule (Section P4)",
    status: "UNKNOWN",
  },
  {
    doc: "itb",
    text: "Two completed projects of similar scope in the last five years",
    page: 15,
    exactQuote:
      "Bidders shall provide evidence of at least two (2) contracts of similar nature and complexity completed within the last five (5) years.",
    quoteVerified: true,
    mandatory: true,
    response: "Lae health centre solar (2024) confirmed; second reference requested",
    evidence: "One reference letter attached; second pending",
    status: "GAP",
  },
  {
    doc: "spec",
    text: "Five-year warranty with in-country after-sales support",
    page: 19,
    exactQuote:
      "A comprehensive warranty of five (5) years with after-sales support available in country.",
    quoteVerified: false,
    mandatory: false,
    response: "5-year warranty through local service partner",
    evidence: "Warranty statement (draft)",
    status: "UNKNOWN",
  },
];

const ICT_REQS: ReqTemplate[] = [
  {
    doc: "spec",
    text: "Laptops: Intel Core i5 (13th gen) or equivalent, 16 GB RAM, 512 GB SSD, 14-inch display",
    page: 4,
    exactQuote:
      'Laptop computers: processor Intel Core i5 13th generation or equivalent, 16 GB RAM, 512 GB SSD, 14" FHD display.',
    quoteVerified: true,
    mandatory: true,
    response: "Offered model meets or exceeds every line",
    evidence: "Compliance sheet and datasheet (Annex T1)",
    status: "MET",
  },
  {
    doc: "spec",
    text: "Rugged tablets, 10-inch, with protective case and 3-year battery warranty",
    page: 5,
    exactQuote:
      "10-inch tablets supplied with rugged protective case; battery warranty not less than three (3) years.",
    quoteVerified: true,
    mandatory: true,
    response: '10.1" tablet with MIL-STD case',
    evidence: "Datasheet (Annex T2)",
    status: "MET",
  },
  {
    doc: "itb",
    text: "Manufacturer authorisation letter for the offered brands",
    page: 11,
    exactQuote:
      "Bidders who are not manufacturers shall submit a Manufacturer's Authorization Form (Section 6).",
    quoteVerified: true,
    mandatory: true,
    response: "Requested from distributor",
    evidence: "Not yet received",
    status: "GAP",
  },
  {
    doc: "itb",
    text: "Delivery to all listed sites within 60 days",
    page: 9,
    exactQuote:
      "Goods shall be delivered to the consignees listed in Annex A within sixty (60) days of PO issuance.",
    quoteVerified: true,
    mandatory: true,
    response: "45-day delivery confirmed by supplier",
    evidence: "Supplier lead-time confirmation",
    status: "MET",
  },
  {
    doc: "spec",
    text: "Three-year on-site warranty",
    page: 7,
    exactQuote: "All equipment shall carry a minimum three (3) year on-site warranty.",
    quoteVerified: false,
    mandatory: false,
    response: "3-year warranty, on-site in capital cities",
    evidence: "Warranty terms (draft)",
    status: "UNKNOWN",
  },
];

const NETWORK_REQS: ReqTemplate[] = [
  {
    doc: "spec",
    text: "Managed Layer-3 core switches with 10G SFP+ uplinks, redundant power",
    page: 3,
    exactQuote:
      "Core switches shall be managed Layer 3 with a minimum of 4 x 10G SFP+ uplinks and redundant PSUs.",
    quoteVerified: true,
    mandatory: true,
    response: "Offered core switch has 8 x 10G SFP+ and dual PSU",
    evidence: "Datasheet (Annex N1)",
    status: "MET",
  },
  {
    doc: "spec",
    text: "Wi-Fi 6 access points, centrally managed",
    page: 4,
    exactQuote:
      "Wireless access points shall support IEEE 802.11ax (Wi-Fi 6) and central cloud or controller management.",
    quoteVerified: true,
    mandatory: true,
    response: "Wi-Fi 6 APs with cloud controller",
    evidence: "Datasheet (Annex N2)",
    status: "MET",
  },
  {
    doc: "itb",
    text: "At least two certified network engineers (CCNP or equivalent)",
    page: 13,
    exactQuote:
      "The bidder shall propose not less than two (2) engineers holding CCNP or equivalent certification.",
    quoteVerified: true,
    mandatory: true,
    response: "Michael Tom (CCNP); second engineer to be confirmed",
    evidence: "CV attached for one engineer",
    status: "GAP",
  },
  {
    doc: "spec",
    text: "Site survey before installation and as-built documentation",
    page: 10,
    exactQuote:
      "AI-extracted: the contractor shall carry out a site survey and provide as-built drawings.",
    quoteVerified: false,
    mandatory: false,
    response: "Survey planned in week 1",
    evidence: "—",
    status: "UNKNOWN",
  },
];

const TRAINING_REQS: ReqTemplate[] = [
  {
    doc: "spec",
    text: "Curriculum covering digital health information systems (DHIS2) and basic ICT",
    page: 3,
    exactQuote:
      "The training programme shall cover DHIS2 data entry and reporting and foundational ICT skills.",
    quoteVerified: true,
    mandatory: true,
    response: "8-module curriculum outline drafted",
    evidence: "Curriculum outline",
    status: "MET",
  },
  {
    doc: "itb",
    text: "Lead trainers with at least five years of experience",
    page: 8,
    exactQuote:
      "Lead trainers shall have a minimum of five (5) years' experience delivering adult ICT training.",
    quoteVerified: true,
    mandatory: true,
    response: "Two trainers identified",
    evidence: "CVs pending",
    status: "UNKNOWN",
  },
  {
    doc: "spec",
    text: "Delivery in four provinces with materials in English and Tok Pisin",
    page: 5,
    exactQuote: "AI-extracted: materials shall be available in English and Tok Pisin.",
    quoteVerified: false,
    mandatory: true,
    response: "Translation partner required",
    evidence: "—",
    status: "UNKNOWN",
  },
];

// ---------- tenders ----------

/** 1. FAO — G2 again after Amendment No.2 voided approvals. Deadline in 2 days. */
function fao(): TenderSeed {
  const id = "t-fao-138792";
  const t0 = "2026-11-02T06:10:00Z";
  const drafted = "2026-11-06T04:00:00Z";
  const quotes = [
    quote(
      id,
      "s-zambezi",
      "ZSW-Q-2211",
      "USD",
      1,
      "2026-11-08T08:00:00Z",
      "2026-11-20T00:00:00Z",
      21,
      [
        ["pv", "PV modules 450 Wp", 48, 182],
        ["batt", "LiFePO4 battery bank 10 kWh", 12, 1480],
        ["inv", "Hybrid inverter 8 kW", 4, 2090],
        ["cold", "Solar cold room unit 6 m³", 2, 9800],
        ["bos", "Mounting and balance of system (lot)", 1, 4300],
      ],
    ),
    quote(
      id,
      "s-southern",
      "SCE-7781",
      "AUD",
      0.65,
      "2026-11-07T23:00:00Z",
      "2026-11-17T00:00:00Z",
      35,
      [
        ["pv", "PV modules 440 Wp", 48, 270],
        ["batt", "LiFePO4 battery bank 10 kWh", 12, 2150],
        ["inv", "Hybrid inverter 8 kW", 4, 3300],
        ["cold", "Solar cold room unit 6 m³", 2, 14900],
        ["bos", "Mounting and balance of system (lot)", 1, 6100],
      ],
    ),
  ];
  const q = quotes[0]!.id;
  const tender: Tender = {
    id,
    title: "Supply, installation and commissioning of solar-powered cold storage units",
    agency: "FAO",
    procurementType: "Invitation to Bid",
    category: "Solar",
    reference: "2026/FRETH/FRZIM/138792",
    country: "Zimbabwe",
    location: "Harare and Masvingo",
    deadlineNotice: "18-Nov-2026 16:00 (GMT 2.00)",
    ungmUrl: "https://www.ungm.org/Public/Notice/138792",
    source: "UNGM_API",
    discoveredAt: t0,
    submissionRules: STD_RULES,
    description:
      "FAO Zimbabwe requires the supply, installation and commissioning of two solar-powered cold storage units with battery storage, including training of operators and a five-year warranty.",
    estimatedValueUsd: 110000,
    stage: "G5_RELEASE",
    ownerId: KO,
    backupOwnerId: BG,
    preparedById: "u-michael",
    ai: ai(
      78,
      "BID",
      "Strong technical fit with our solar cold-chain experience. Delivery is outside the Pacific, so logistics and local installation partner are the main risks.",
      [
        "Scope matches two completed solar cold-chain projects (2024, 2025)",
        "Estimated value USD 110k is inside our target range",
        "Local installation partner (Zambezi Solar Works) has quoted",
      ],
      ["Country outside core market", "Short preparation window after Amendment No.2"],
      "2026-11-02T06:40:00Z",
    ),
    requirements: reqs(id, SOLAR_REQS),
    documents: [
      doc(id, "itb", "ITB_138792_Instructions.pdf", "UNGM_NOTICE", t0, 1840),
      doc(id, "spec", "Annex_B_Technical_Specifications.pdf", "UNGM_NOTICE", t0, 920),
      doc(id, "price", "Annex_C_Price_Schedule.xlsx", "UNGM_NOTICE", t0, 64),
      doc(
        id,
        "amd1",
        "Amendment_No1_Submission_Address.pdf",
        "AMENDMENT",
        "2026-11-05T09:00:00Z",
        110,
      ),
      doc(id, "tp", "GREEN_Technical_Offer_v3.pdf", "INTERNAL", drafted, 2310, "PACKAGE"),
      doc(
        id,
        "fp",
        "GREEN_Financial_Offer_v2.xlsx",
        "INTERNAL",
        "2026-11-10T03:00:00Z",
        58,
        "PACKAGE",
      ),
    ],
    timeline: [
      {
        id: `${id}-T1`,
        kind: "AMENDMENT",
        at: "2026-11-05T09:00:00Z",
        title: "Amendment No.1",
        detail:
          "Corrected the UNGM e-Tendering submission address. No change to scope or deadline.",
        material: false,
        documentId: `${id}-amd1`,
      },
      {
        id: `${id}-T2`,
        kind: "CLARIFICATION_QUESTION",
        at: "2026-11-07T02:00:00Z",
        title: "Question sent: battery chemistry",
        detail:
          "Asked whether LiFePO4 is mandatory or whether other lithium chemistries are acceptable.",
        material: false,
      },
      {
        id: `${id}-T3`,
        kind: "CLARIFICATION_ANSWER",
        at: "2026-11-09T11:30:00Z",
        title: "FAO answer: LiFePO4 required",
        detail: "FAO confirmed that only LiFePO4 batteries are acceptable.",
        material: false,
      },
    ],
    proposal: sections(
      id,
      drafted,
      "Technical approach: solar cold storage",
      "We will supply two 6 m³ solar cold rooms, each powered by a 10.8 kWp PV array, 60 kWh LiFePO4 storage and hybrid inverters sized for 3 days of autonomy. Installation is led by GREEN engineers with our partner Zambezi Solar Works, followed by commissioning tests and operator training at each site.",
      [
        {
          id: `${id}-c1`,
          authorId: KO,
          authorName: "Kowsalya",
          at: "2026-11-07T03:10:00Z",
          text: "Please state the days of autonomy calculation in an annex.",
        },
      ],
    ),
    rfqs: [
      {
        id: `${id}-rfq1`,
        tenderId: id,
        supplierId: "s-zambezi",
        status: "RESPONDED",
        sentAt: "2026-11-03T05:00:00Z",
        dueAt: "2026-11-08T12:00:00Z",
      },
      {
        id: `${id}-rfq2`,
        tenderId: id,
        supplierId: "s-southern",
        status: "RESPONDED",
        sentAt: "2026-11-03T05:00:00Z",
        dueAt: "2026-11-08T12:00:00Z",
      },
    ],
    quotes,
    costing: {
      lines: [
        cost(id, 1, "pv", "PV modules 450 Wp", 48, 182, "ZSW-Q-2211", q),
        cost(id, 2, "batt", "LiFePO4 battery bank 10 kWh", 12, 1480, "ZSW-Q-2211", q),
        cost(id, 3, "inv", "Hybrid inverter 8 kW", 4, 2090, "ZSW-Q-2211", q),
        cost(id, 4, "cold", "Solar cold room unit 6 m³", 2, 9800, "ZSW-Q-2211", q),
        cost(id, 5, "bos", "Mounting and balance of system", 1, 4300, "ZSW-Q-2211", q),
        cost(
          id,
          6,
          "freight",
          "Freight Durban → Harare and insurance",
          1,
          6200,
          "Freight estimate · Transworld 08-Nov",
        ),
        cost(
          id,
          7,
          "install",
          "Installation, commissioning and training",
          1,
          7800,
          "GREEN labour estimate (12 days × 2 engineers)",
        ),
        cost(id, 8, "cont", "Contingency (5%)", 1, 3300, "Policy: 5% of direct cost"),
      ],
      priceUsd: 101500,
    },
    emails: [
      {
        id: `${id}-E1`,
        tenderId: id,
        kind: "CLARIFICATION",
        to: "procurement-zw@fao.example",
        subject: "2026/FRETH/FRZIM/138792 – Clarification: battery chemistry",
        body: "Dear FAO Procurement,\n\nCould you confirm whether LiFePO4 is the only acceptable battery chemistry under Annex B, clause 4.2?\n\nKind regards,\nGREEN DigitALL",
        aiDrafted: true,
        status: "SENT",
        createdAt: "2026-11-06T22:00:00Z",
        sentAt: "2026-11-07T02:00:00Z",
      },
    ],
    approvals: [],
  };
  return {
    tender,
    decisions: [
      {
        gate: "SR",
        approverId: KO,
        at: "2026-11-02T22:00:00Z",
        reason: "AI summary checked against the ITB; scope and value are correct.",
      },
      {
        gate: "G1",
        approverId: BG,
        at: "2026-11-03T01:30:00Z",
        reason: "Good fit with our cold-chain references. Proceed.",
        bidDecision: "BID",
      },
      {
        gate: "GC",
        approverId: BG,
        at: "2026-11-07T01:45:00Z",
        reason: "Clear question, approved to send.",
        subjectId: `${id}-E1`,
      },
      {
        gate: "G2",
        approverId: KO,
        at: "2026-11-09T05:00:00Z",
        reason: "Technical offer matches Annex B. One reference gap accepted as non-blocking.",
      },
      {
        gate: "G3",
        approverId: BG,
        at: "2026-11-10T04:00:00Z",
        reason: "Price agreed at USD 101,500 (25.1% margin).",
      },
      {
        gate: "G4",
        approverId: KO,
        at: "2026-11-12T06:00:00Z",
        reason: "Package complete and consistent; forms signed.",
      },
    ],
    amendments: [
      {
        at: "2026-11-14T13:20:00Z",
        title: "Amendment No.2",
        detail:
          "Annex B revised: cold room capacity increased from 6 m³ to 8 m³ and battery autonomy from 3 to 4 days. Deadline unchanged.",
        material: true,
        document: doc(
          id,
          "amd2",
          "Amendment_No2_Revised_Annex_B.pdf",
          "AMENDMENT",
          "2026-11-14T13:20:00Z",
          760,
        ),
        requirementChanges: [
          {
            id: `${id}-R02`,
            text: "Battery storage: LiFePO4, at least 6,000 cycles at 80% DoD, 4 days of autonomy",
            exactQuote:
              "Battery banks shall use LiFePO4 chemistry rated for not less than 6,000 cycles at 80% DoD and sized for four (4) days of autonomy.",
          },
        ],
      },
    ],
  };
}

/** 2. UNDP PNG — Costing done, waiting for CEO G3. Margin under 25%. */
function undpPng(): TenderSeed {
  const id = "t-undp-png-044";
  const t0 = "2026-11-04T23:00:00Z";
  const drafted = "2026-11-08T02:00:00Z";
  const quotes = [
    quote(
      id,
      "s-kumul",
      "KSS-0938",
      "PGK",
      0.25,
      "2026-11-10T01:00:00Z",
      "2026-12-10T00:00:00Z",
      28,
      [
        ["pv", "PV modules 450 Wp", 64, 690],
        ["batt", "LiFePO4 battery 5 kWh", 32, 5200],
        ["inv", "Off-grid inverter 5 kW", 8, 7400],
        ["bos", "Mounting, cabling and protection (lot)", 8, 6100],
      ],
    ),
    quote(
      id,
      "s-southern",
      "SCE-7802",
      "AUD",
      0.65,
      "2026-11-11T00:00:00Z",
      "2026-11-21T00:00:00Z",
      42,
      [
        ["pv", "PV modules 440 Wp", 64, 255],
        ["batt", "LiFePO4 battery 5 kWh", 32, 1890],
        ["inv", "Off-grid inverter 5 kW", 8, 2700],
        ["bos", "Mounting, cabling and protection (lot)", 8, 2250],
      ],
    ),
  ];
  const q = quotes[0]!.id;
  const tender: Tender = {
    id,
    title: "Solar PV systems for rural health centres, Eastern Highlands",
    agency: "UNDP",
    procurementType: "Request for Proposal",
    category: "Solar",
    reference: "UNDP-PNG-RFP-2026-044",
    country: "Papua New Guinea",
    location: "Eastern Highlands Province",
    deadlineNotice: "24-Nov-2026 17:00 (GMT 10.00)",
    ungmUrl: "https://www.ungm.org/Public/Notice/241044",
    source: "UNGM_API",
    discoveredAt: t0,
    submissionRules: STD_RULES,
    description:
      "Design, supply and installation of solar PV systems with battery storage for eight rural health centres in Eastern Highlands Province, including two years of maintenance.",
    estimatedValueUsd: 130000,
    stage: "COSTING_G3",
    ownerId: BG,
    backupOwnerId: KO,
    preparedById: "u-grace",
    ai: ai(
      88,
      "BID",
      "Core market, strong references with UNDP PNG and local supplier coverage. Preparation time is adequate.",
      [
        "In-country delivery; installation teams already in Goroka",
        "Two similar UNDP solar contracts completed (2023, 2025)",
        "Local supplier Kumul Solar quoted in PGK with 28-day lead time",
      ],
      ["Road access to two sites in wet season"],
      "2026-11-05T00:10:00Z",
    ),
    requirements: reqs(id, SOLAR_REQS).map((r) =>
      r.status === "GAP"
        ? {
            ...r,
            status: "MET",
            response: "Two UNDP solar references attached",
            evidence: "Reference letters 2023, 2025",
          }
        : r,
    ),
    documents: [
      doc(id, "itb", "RFP_UNDP-PNG-2026-044.pdf", "UNGM_NOTICE", t0, 1420),
      doc(id, "spec", "ToR_Solar_Health_Centres.pdf", "UNGM_NOTICE", t0, 780),
      doc(id, "tp", "GREEN_Technical_Proposal.pdf", "INTERNAL", drafted, 1980, "PACKAGE"),
    ],
    timeline: [],
    proposal: sections(
      id,
      drafted,
      "Technical approach: health centre solar systems",
      "Each health centre receives a 3.6 kWp PV array, 20 kWh LiFePO4 storage and a 5 kW off-grid inverter, sized for the vaccine fridge, lighting and clinic equipment with two days of autonomy. Our Goroka team installs, commissions and maintains the systems for two years.",
    ),
    rfqs: [
      {
        id: `${id}-rfq1`,
        tenderId: id,
        supplierId: "s-kumul",
        status: "RESPONDED",
        sentAt: "2026-11-06T00:00:00Z",
        dueAt: "2026-11-11T00:00:00Z",
      },
      {
        id: `${id}-rfq2`,
        tenderId: id,
        supplierId: "s-southern",
        status: "RESPONDED",
        sentAt: "2026-11-06T00:00:00Z",
        dueAt: "2026-11-11T00:00:00Z",
      },
    ],
    quotes,
    costing: {
      lines: [
        cost(id, 1, "pv", "PV modules 450 Wp", 64, 172.5, "KSS-0938 (PGK 690 @ 0.25)", q),
        cost(id, 2, "batt", "LiFePO4 battery 5 kWh", 32, 1300, "KSS-0938 (PGK 5,200 @ 0.25)", q),
        cost(id, 3, "inv", "Off-grid inverter 5 kW", 8, 1850, "KSS-0938 (PGK 7,400 @ 0.25)", q),
        cost(
          id,
          4,
          "bos",
          "Mounting, cabling and protection",
          8,
          1525,
          "KSS-0938 (PGK 6,100 @ 0.25)",
          q,
        ),
        cost(
          id,
          5,
          "freight",
          "Road freight Lae → sites",
          1,
          4200,
          "Freight estimate · Mapai 10-Nov",
        ),
        cost(id, 6, "install", "Installation and commissioning", 8, 1150, "GREEN labour estimate"),
        cost(id, 7, "maint", "Two-year maintenance (4 visits)", 1, 6400, "GREEN service estimate"),
      ],
      priceUsd: 127500,
    },
    emails: [],
    approvals: [],
  };
  return {
    tender,
    decisions: [
      { gate: "SR", approverId: KO, at: "2026-11-05T21:00:00Z", reason: "Summary is accurate." },
      {
        gate: "G1",
        approverId: BG,
        at: "2026-11-06T00:00:00Z",
        reason: "Core market and strong UNDP relationship.",
        bidDecision: "BID",
      },
      {
        gate: "G2",
        approverId: KO,
        at: "2026-11-12T03:00:00Z",
        reason: "All mandatory requirements met.",
      },
    ],
  };
}

/** 3. UNICEF Fiji — G4 final QA; package prepared by Kowsalya, so she cannot approve it. */
function unicefFiji(): TenderSeed {
  const id = "t-unicef-fji-019";
  const t0 = "2026-11-03T21:00:00Z";
  const drafted = "2026-11-07T01:00:00Z";
  const quotes = [
    quote(
      id,
      "s-melanesia",
      "MID-55120",
      "FJD",
      0.44,
      "2026-11-09T22:00:00Z",
      "2026-12-05T00:00:00Z",
      30,
      [
        ["laptop", "Laptop i5 / 16 GB / 512 GB", 120, 1780],
        ["tablet", 'Rugged 10" tablet', 200, 690],
        ["cart", "Charging cart (30 bays)", 10, 2600],
      ],
    ),
    quote(
      id,
      "s-coral",
      "CSN-Q-4471",
      "USD",
      1,
      "2026-11-10T02:00:00Z",
      "2026-11-30T00:00:00Z",
      45,
      [
        ["laptop", "Laptop i5 / 16 GB / 512 GB", 120, 812],
        ["tablet", 'Rugged 10" tablet', 200, 298],
        ["cart", "Charging cart (30 bays)", 10, 1240],
      ],
    ),
  ];
  const q = quotes[0]!.id;
  const tender: Tender = {
    id,
    title: "ICT equipment for primary schools (laptops, tablets and charging carts)",
    agency: "UNICEF",
    procurementType: "Invitation to Bid",
    category: "ICT equipment",
    reference: "LRFQ-2026-9187019",
    country: "Fiji",
    location: "Suva and Western Division",
    deadlineNotice: "28-Nov-2026 16:00 (GMT 12.00)",
    ungmUrl: "https://www.ungm.org/Public/Notice/239019",
    source: "UNGM_API",
    discoveredAt: t0,
    submissionRules: STD_RULES,
    description:
      "Supply and delivery of 120 laptops, 200 rugged tablets and 10 charging carts to primary schools in Suva and the Western Division.",
    estimatedValueUsd: 180000,
    stage: "G4_FINAL_QA",
    ownerId: KO,
    backupOwnerId: "u-grace",
    preparedById: KO,
    ai: ai(
      81,
      "BID",
      "Standard goods supply with a reliable Fiji distributor. Price competition is expected to be strong.",
      [
        "Simple goods supply; low delivery risk",
        "Distributor in Suva already quoted",
        "UNICEF Pacific is a repeat client",
      ],
      [
        "Thin margins expected on commodity hardware",
        "Manufacturer authorisation letter still missing",
      ],
      "2026-11-03T21:30:00Z",
    ),
    requirements: reqs(id, ICT_REQS),
    documents: [
      doc(id, "itb", "ITB_LRFQ-2026-9187019.pdf", "UNGM_NOTICE", t0, 1210),
      doc(id, "spec", "Technical_Specifications_ICT.pdf", "UNGM_NOTICE", t0, 430),
      doc(id, "tp", "GREEN_Technical_Bid_UNICEF.pdf", "INTERNAL", drafted, 1650, "PACKAGE"),
      doc(
        id,
        "fp",
        "GREEN_Price_Schedule_UNICEF.xlsx",
        "INTERNAL",
        "2026-11-12T01:00:00Z",
        44,
        "PACKAGE",
      ),
    ],
    timeline: [
      {
        id: `${id}-T1`,
        kind: "CLARIFICATION_ANSWER",
        at: "2026-11-08T03:00:00Z",
        title: "UNICEF clarification No.1 (all bidders)",
        detail: "Equivalent processors are accepted if benchmark scores are equal or higher.",
        material: false,
      },
    ],
    proposal: sections(
      id,
      drafted,
      "Technical offer: education devices",
      "We offer business-grade laptops and rugged education tablets, imaged with UNICEF's standard learning apps before shipping. Charging carts allow secure overnight charging of 30 devices. All items are delivered DAP to schools with asset tags and a delivery note signed by the head teacher.",
    ),
    rfqs: [
      {
        id: `${id}-rfq1`,
        tenderId: id,
        supplierId: "s-melanesia",
        status: "RESPONDED",
        sentAt: "2026-11-05T00:00:00Z",
        dueAt: "2026-11-10T00:00:00Z",
      },
      {
        id: `${id}-rfq2`,
        tenderId: id,
        supplierId: "s-coral",
        status: "RESPONDED",
        sentAt: "2026-11-05T00:00:00Z",
        dueAt: "2026-11-10T00:00:00Z",
      },
    ],
    quotes,
    costing: {
      lines: [
        cost(
          id,
          1,
          "laptop",
          "Laptop i5 / 16 GB / 512 GB",
          120,
          783.2,
          "MID-55120 (FJD 1,780 @ 0.44)",
          q,
        ),
        cost(id, 2, "tablet", 'Rugged 10" tablet', 200, 303.6, "MID-55120 (FJD 690 @ 0.44)", q),
        cost(id, 3, "cart", "Charging cart (30 bays)", 10, 1144, "MID-55120 (FJD 2,600 @ 0.44)", q),
        cost(id, 4, "freight", "Delivery to 18 schools", 1, 5400, "Distributor delivery quote"),
        cost(id, 5, "imaging", "Device imaging and asset tagging", 320, 9, "GREEN labour estimate"),
      ],
      priceUsd: 236000,
    },
    emails: [],
    approvals: [],
  };
  return {
    tender,
    decisions: [
      { gate: "SR", approverId: KO, at: "2026-11-04T01:00:00Z", reason: "Summary accurate." },
      {
        gate: "G1",
        approverId: BG,
        at: "2026-11-04T03:00:00Z",
        reason: "Repeat client; go.",
        bidDecision: "BID",
      },
      {
        gate: "G2",
        approverId: KO,
        at: "2026-11-10T22:00:00Z",
        reason: "Specifications met; MAF to follow.",
      },
      {
        gate: "G3",
        approverId: BG,
        at: "2026-11-12T00:30:00Z",
        reason: "Competitive price with 26% margin.",
      },
    ],
  };
}

/** 4. UNOPS Solomon Islands — AI drafting; two emails waiting for GC. */
function unopsSol(): TenderSeed {
  const id = "t-unops-sol-071";
  const t0 = "2026-11-10T22:00:00Z";
  const tender: Tender = {
    id,
    title: "Network infrastructure upgrade (LAN, Wi-Fi and core switching) for government offices",
    agency: "UNOPS",
    procurementType: "Request for Quotation",
    category: "Network",
    reference: "RFQ/2026/58071",
    country: "Solomon Islands",
    location: "Honiara",
    deadlineNotice: "04-Dec-2026 12:00 (GMT 11.00)",
    ungmUrl: "https://www.ungm.org/Public/Notice/258071",
    source: "UNGM_API",
    discoveredAt: t0,
    submissionRules: STD_RULES,
    description:
      "Upgrade of the LAN and Wi-Fi in three government buildings in Honiara: core and access switching, Wi-Fi 6 access points, structured cabling and two years of support.",
    estimatedValueUsd: 140000,
    stage: "AI_DRAFTING",
    ownerId: "u-michael",
    backupOwnerId: KO,
    ai: ai(
      72,
      "CLARIFY",
      "Good technical fit, but the cabling scope is unclear (number of drops not stated). Recommend bidding after a clarification.",
      [
        "Network design and Wi-Fi 6 are core skills",
        "Honiara partner available",
        "Value fits our range",
      ],
      ["Cabling quantities missing from BoQ", "Second CCNP engineer needed"],
      "2026-11-11T00:00:00Z",
    ),
    requirements: reqs(id, NETWORK_REQS),
    documents: [
      doc(id, "itb", "RFQ_2026_58071.pdf", "UNGM_NOTICE", t0, 980),
      doc(id, "spec", "Annex_A_Network_Specifications.pdf", "UNGM_NOTICE", t0, 640),
    ],
    timeline: [],
    proposal: [],
    rfqs: [
      {
        id: `${id}-rfq1`,
        tenderId: id,
        supplierId: "s-honiara",
        status: "RESPONDED",
        sentAt: "2026-11-12T01:00:00Z",
        dueAt: "2026-11-19T00:00:00Z",
      },
      {
        id: `${id}-rfq2`,
        tenderId: id,
        supplierId: "s-coral",
        status: "DRAFT",
        dueAt: "2026-11-23T00:00:00Z",
        emailId: `${id}-E2`,
      },
    ],
    quotes: [
      quote(
        id,
        "s-honiara",
        "HTT-301",
        "SBD",
        0.12,
        "2026-11-15T03:00:00Z",
        "2026-12-15T00:00:00Z",
        35,
        [
          ["core", "L3 core switch 24 x 10G", 3, 74000],
          ["access", "Access switch 48p PoE+", 12, 21500],
          ["ap", "Wi-Fi 6 access point", 45, 5900],
          ["cabling", "Cat6A cabling (per drop)", 300, 1250],
        ],
      ),
    ],
    costing: { lines: [] },
    emails: [
      {
        id: `${id}-E1`,
        tenderId: id,
        kind: "CLARIFICATION",
        to: "rfq.sbop@unops.example",
        subject: "RFQ/2026/58071 – Clarification on cabling quantities",
        body: "Dear UNOPS Procurement,\n\nAnnex A does not state the number of network drops per building. Could you share the expected number of Cat6A drops for each of the three buildings, or confirm that bidders should propose quantities after a site survey?\n\nKind regards,\nGREEN DigitALL",
        aiDrafted: true,
        status: "PENDING_APPROVAL",
        createdAt: hoursAgo(20),
      },
      {
        id: `${id}-E2`,
        tenderId: id,
        kind: "RFQ",
        to: "quotes@coralsea.example",
        subject: "Request for quotation – Honiara LAN and Wi-Fi upgrade",
        body: "Dear Coral Sea Networks,\n\nPlease quote for 3 L3 core switches (24 x 10G), 12 access switches (48 port PoE+) and 45 Wi-Fi 6 access points, delivered to Honiara, with validity of at least 90 days.\n\nKind regards,\nGREEN DigitALL",
        aiDrafted: true,
        status: "PENDING_APPROVAL",
        createdAt: hoursAgo(6),
        supplierId: "s-coral",
      },
    ],
    approvals: [],
  };
  return {
    tender,
    decisions: [
      {
        gate: "SR",
        approverId: KO,
        at: "2026-11-11T22:00:00Z",
        reason: "Agree with CLARIFY; question on cabling to be sent.",
      },
      {
        gate: "G1",
        approverId: BG,
        at: "2026-11-12T00:15:00Z",
        reason:
          "Bid, but send the cabling clarification first. AI said CLARIFY; we have enough to start drafting.",
        bidDecision: "BID",
      },
    ],
  };
}

/** 5. WHO PNG — waiting for CEO G1. */
function whoPng(): TenderSeed {
  const id = "t-who-png-033";
  const t0 = "2026-11-13T02:00:00Z";
  return {
    tender: {
      id,
      title: "Digital health ICT skills training for provincial health staff",
      agency: "WHO",
      procurementType: "Request for Proposal",
      category: "Training",
      reference: "WHO/PNG/RFP/2026/033",
      country: "Papua New Guinea",
      location: "Lae, Mt Hagen, Kokopo and Port Moresby",
      deadlineNotice: "01-Dec-2026 17:00 (GMT 10.00)",
      ungmUrl: "https://www.ungm.org/Public/Notice/260033",
      source: "UNGM_ALERT_EMAIL",
      discoveredAt: t0,
      submissionRules: STD_RULES,
      description:
        "Design and delivery of DHIS2 and basic ICT training for 160 provincial health staff in four provinces, with training materials in English and Tok Pisin.",
      estimatedValueUsd: 65000,
      stage: "G1_BID_DECISION",
      ownerId: KO,
      backupOwnerId: "u-grace",
      ai: ai(
        74,
        "BID",
        "Training fits our capacity-building services, and all four venues are where we have staff. Tok Pisin materials need a translation partner.",
        [
          "Four provinces with GREEN offices or partners",
          "Repeat WHO PNG relationship",
          "Low equipment cost; mostly labour",
        ],
        ["Tok Pisin translation partner not yet identified", "Trainer CVs need updating"],
        "2026-11-13T02:30:00Z",
      ),
      requirements: reqs(id, TRAINING_REQS),
      documents: [
        doc(id, "itb", "WHO_RFP_2026_033.pdf", "UNGM_ALERT", t0, 860),
        doc(id, "spec", "ToR_Digital_Health_Training.pdf", "UNGM_ALERT", t0, 340),
      ],
      timeline: [],
      proposal: [],
      rfqs: [],
      quotes: [],
      costing: { lines: [] },
      emails: [],
      approvals: [],
    },
    decisions: [
      {
        gate: "SR",
        approverId: KO,
        at: "2026-11-14T00:00:00Z",
        reason: "Summary correct; translation risk noted.",
      },
    ],
  };
}

/** 6. UNDP Solomon Islands — AI says NO BID; waiting for Kowsalya's summary review. Short deadline. */
function undpSol(): TenderSeed {
  const id = "t-undp-sol-026";
  const t0 = hoursAgo(30);
  return {
    tender: {
      id,
      title: "Solar mini-grid components for island communities, Malaita Province",
      agency: "UNDP",
      procurementType: "Invitation to Bid",
      category: "Solar",
      reference: "UNDP-SLB-ITB-2026-026",
      country: "Solomon Islands",
      location: "Malaita Province",
      deadlineNotice: "20-Nov-2026 14:00 (GMT 11.00)",
      ungmUrl: "https://www.ungm.org/Public/Notice/262026",
      source: "UNGM_API",
      discoveredAt: t0,
      submissionRules: [...STD_RULES, "Bid security of USD 5,000 (bank guarantee) required."],
      description:
        "Supply of PV, battery and power-distribution components for three community mini-grids in Malaita Province.",
      estimatedValueUsd: 240000,
      stage: "SUMMARY_REVIEW",
      ownerId: KO,
      backupOwnerId: "u-michael",
      ai: ai(
        41,
        "NO_BID",
        "Only 4 days to prepare, below the 7-day minimum. A USD 5,000 bank guarantee is required and the value is above our usual range.",
        [
          "Preparation time (4 days) is below the 7-day minimum",
          "Bid security bank guarantee needs 5+ working days",
          "Estimated value USD 240k is above our typical range",
        ],
        ["Island shipping logistics", "No mini-grid reference in Solomon Islands"],
        hoursAgo(29),
      ),
      requirements: reqs(id, SOLAR_REQS.slice(0, 3)),
      documents: [
        doc(id, "itb", "ITB_UNDP-SLB-2026-026.pdf", "UNGM_NOTICE", t0, 1530),
        doc(id, "spec", "Section_5_Schedule_of_Requirements.pdf", "UNGM_NOTICE", t0, 710),
      ],
      timeline: [],
      proposal: [],
      rfqs: [],
      quotes: [],
      costing: { lines: [] },
      emails: [],
      approvals: [],
    },
    decisions: [],
  };
}

/** 7. UNOPS Fiji — discovered today from a UNGM alert email; no owner yet. */
function unopsFiji(): TenderSeed {
  const id = "t-unops-fji-058";
  const t0 = hoursAgo(2);
  return {
    tender: {
      id,
      title: "Supply of network switches and wireless access points",
      agency: "UNOPS",
      procurementType: "Request for Quotation",
      category: "Network",
      reference: "RFQ/2026/61058",
      country: "Fiji",
      location: "Lautoka",
      deadlineNotice: "10-Dec-2026 12:00 (GMT 12.00)",
      ungmUrl: "https://www.ungm.org/Public/Notice/261058",
      source: "UNGM_ALERT_EMAIL",
      discoveredAt: t0,
      submissionRules: STD_RULES,
      description:
        "Supply of 20 managed access switches and 60 Wi-Fi 6 access points for a regional hospital in Lautoka.",
      stage: "DISCOVERED",
      requirements: [],
      documents: [doc(id, "itb", "RFQ_2026_61058.pdf", "UNGM_ALERT", t0, 640)],
      timeline: [],
      proposal: [],
      rfqs: [],
      quotes: [],
      costing: { lines: [] },
      emails: [],
      approvals: [],
    },
    decisions: [],
  };
}

/** 8. UNICEF PNG — G4 done; waiting for CEO G5 release. */
function unicefPng(): TenderSeed {
  const id = "t-unicef-png-087";
  const t0 = "2026-10-29T23:00:00Z";
  const drafted = "2026-11-03T02:00:00Z";
  const quotes = [
    quote(
      id,
      "s-coral",
      "CSN-Q-4402",
      "USD",
      1,
      "2026-11-04T02:00:00Z",
      "2026-11-22T00:00:00Z",
      30,
      [
        ["laptop", "Laptop i5 / 16 GB / 512 GB", 60, 805],
        ["printer", "A4 laser MFP", 15, 420],
        ["ups", "UPS 1.5 kVA", 15, 260],
      ],
    ),
    quote(
      id,
      "s-melanesia",
      "MID-55003",
      "FJD",
      0.44,
      "2026-11-04T05:00:00Z",
      "2026-12-04T00:00:00Z",
      40,
      [
        ["laptop", "Laptop i5 / 16 GB / 512 GB", 60, 1840],
        ["printer", "A4 laser MFP", 15, 990],
        ["ups", "UPS 1.5 kVA", 15, 610],
      ],
    ),
  ];
  const q = quotes[0]!.id;
  const tender: Tender = {
    id,
    title: "ICT equipment for provincial community offices",
    agency: "UNICEF",
    procurementType: "Request for Quotation",
    category: "ICT equipment",
    reference: "LRFQ-2026-9186087",
    country: "Papua New Guinea",
    location: "Goroka, Kundiawa and Wabag",
    deadlineNotice: "21-Nov-2026 16:00 (GMT 10.00)",
    ungmUrl: "https://www.ungm.org/Public/Notice/237087",
    source: "UNGM_API",
    discoveredAt: t0,
    submissionRules: STD_RULES,
    description:
      "Supply of 60 laptops, 15 multifunction printers and 15 UPS units to three provincial offices.",
    estimatedValueUsd: 95000,
    stage: "G5_RELEASE",
    ownerId: BG,
    backupOwnerId: KO,
    preparedById: "u-grace",
    ai: ai(
      86,
      "BID",
      "Straightforward goods supply in PNG with a known supplier. Good chance of award.",
      [
        "In-country delivery to Highlands offices",
        "Supplier stock available in Port Moresby",
        "Repeat UNICEF PNG client",
      ],
      ["Highlands road freight timing"],
      "2026-10-30T00:00:00Z",
    ),
    requirements: reqs(id, ICT_REQS).map((r) =>
      r.status === "GAP"
        ? {
            ...r,
            status: "MET",
            response: "MAF received from manufacturer",
            evidence: "MAF dated 05-Nov-2026",
          }
        : r.quoteVerified
          ? r
          : { ...r, quoteVerified: true, status: "MET" },
    ),
    documents: [
      doc(id, "itb", "LRFQ-2026-9186087.pdf", "UNGM_NOTICE", t0, 990),
      doc(id, "spec", "Technical_Specifications.pdf", "UNGM_NOTICE", t0, 280),
      doc(id, "tp", "GREEN_Technical_Offer_UNICEF_PNG.pdf", "INTERNAL", drafted, 1340, "PACKAGE"),
      doc(
        id,
        "fp",
        "GREEN_Price_Schedule_UNICEF_PNG.xlsx",
        "INTERNAL",
        "2026-11-07T00:00:00Z",
        39,
        "PACKAGE",
      ),
      doc(
        id,
        "maf",
        "Manufacturer_Authorisation.pdf",
        "SUPPLIER",
        "2026-11-05T00:00:00Z",
        210,
        "PACKAGE",
      ),
    ],
    timeline: [],
    proposal: sections(
      id,
      drafted,
      "Technical offer: office ICT equipment",
      "We offer business-grade laptops, A4 laser multifunction printers and line-interactive UPS units, delivered to Goroka, Kundiawa and Wabag with installation, user set-up and a three-year on-site warranty serviced from our Lae office.",
    ),
    rfqs: [
      {
        id: `${id}-rfq1`,
        tenderId: id,
        supplierId: "s-coral",
        status: "RESPONDED",
        sentAt: "2026-10-31T00:00:00Z",
        dueAt: "2026-11-04T00:00:00Z",
      },
      {
        id: `${id}-rfq2`,
        tenderId: id,
        supplierId: "s-melanesia",
        status: "RESPONDED",
        sentAt: "2026-10-31T00:00:00Z",
        dueAt: "2026-11-04T00:00:00Z",
      },
    ],
    quotes,
    costing: {
      lines: [
        cost(id, 1, "laptop", "Laptop i5 / 16 GB / 512 GB", 60, 805, "CSN-Q-4402", q),
        cost(id, 2, "printer", "A4 laser MFP", 15, 420, "CSN-Q-4402", q),
        cost(id, 3, "ups", "UPS 1.5 kVA", 15, 260, "CSN-Q-4402", q),
        cost(
          id,
          4,
          "freight",
          "Air and road freight to Highlands",
          1,
          3900,
          "Freight estimate · PNG Air Cargo 05-Nov",
        ),
        cost(id, 5, "install", "Set-up and user onboarding", 3, 650, "GREEN labour estimate"),
      ],
      priceUsd: 93500,
    },
    emails: [],
    approvals: [],
  };
  return {
    tender,
    decisions: [
      { gate: "SR", approverId: KO, at: "2026-10-30T21:00:00Z", reason: "Accurate." },
      {
        gate: "G1",
        approverId: BG,
        at: "2026-10-31T00:00:00Z",
        reason: "Proceed.",
        bidDecision: "BID",
      },
      {
        gate: "G2",
        approverId: KO,
        at: "2026-11-06T02:00:00Z",
        reason: "All requirements met, MAF attached.",
      },
      { gate: "G3", approverId: BG, at: "2026-11-07T01:00:00Z", reason: "Margin 31%; approved." },
      {
        gate: "G4",
        approverId: KO,
        at: "2026-11-15T03:00:00Z",
        reason: "Final package checked; prepared by Grace, reviewed by me.",
      },
    ],
  };
}

export function buildTenderSeeds(): TenderSeed[] {
  return [
    fao(),
    undpPng(),
    unicefFiji(),
    unopsSol(),
    whoPng(),
    undpSol(),
    unopsFiji(),
    unicefPng(),
  ];
}

/** Draft rows the AI creates when "AI drafting" completes for a tender with no proposal yet. */
export function aiDraftSections(tender: Tender, at: string): ProposalSection[] {
  return sections(
    tender.id,
    at,
    `Technical approach: ${tender.category.toLowerCase()}`,
    `AI-assisted draft based on ${tender.documents[0]?.fileName ?? "the tender documents"}. GREEN DigitALL will deliver the ${tender.category.toLowerCase()} scope in ${tender.location} with in-country engineers, a tested delivery plan and post-handover support. Review every claim against the requirements matrix before approval.`,
  );
}

/** Requirements the AI extracts when analysis runs on a newly discovered tender. */
export function aiExtractRequirements(tender: Tender): Requirement[] {
  const template =
    tender.category === "Network"
      ? NETWORK_REQS
      : tender.category === "Solar"
        ? SOLAR_REQS
        : ICT_REQS;
  return reqs(tender.id, template).map((r) => ({
    ...r,
    quoteVerified: false,
    status: "UNKNOWN",
    response: "",
    evidence: "",
  }));
}

export function aiAnalysisFor(tender: Tender, at: string): AiAnalysis {
  return ai(
    69,
    "BID",
    `${tender.agency} ${tender.category.toLowerCase()} supply in ${tender.country}. Good match with our product range; partner coverage to confirm.`,
    [
      "Keywords match: network, wireless",
      `${tender.country} is a target country`,
      "Preparation time above minimum",
    ],
    ["No prior contract with this UNOPS office"],
    at,
  );
}
