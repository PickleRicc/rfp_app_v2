# ClicklessAI RFP Tool — What This App Is and What It Does

## Identity

- **Product Name:** ClicklessAI — RFP Proposal Generator
- **Package Name:** `rfp_app_v2`
- **Built For:** Impyrian (a government IT contractor)
- **Target Users:** Federal government contractors who respond to RFPs (Requests for Proposal)
- **Current Milestone:** v2.0 Production Readiness

## What It Does (One Sentence)

ClicklessAI is an AI-powered platform that takes a federal government solicitation package (RFPs, amendments, Q&A documents, pricing templates), extracts every compliance requirement from it, collects company-specific data through a structured intake process, and then generates complete, multi-volume DOCX proposal responses ready for submission.

## The Problem It Solves

Responding to federal RFPs is extraordinarily time-consuming. A single solicitation can contain hundreds of pages across multiple documents (base RFP, amendments, Q&A responses, wage determinations, DD254 forms). Proposal teams must:

1. Read and cross-reference every document to find what's required
2. Track which amendments supersede which sections
3. Extract evaluation criteria, page limits, formatting rules, required volumes
4. Map company capabilities to each requirement
5. Write compliant, evaluator-friendly proposal volumes
6. Ensure every "shall" statement is addressed with specific compliance language

ClicklessAI automates the entire pipeline — from document upload to finished DOCX files.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript (strict), Tailwind CSS 4 |
| UI Components | Radix UI primitives, Lucide icons |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI/LLM | Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| Background Jobs | Inngest (event-driven function pipeline) |
| DOCX Generation | `docx` npm library |
| Excel Generation | ExcelJS |
| PDF Extraction | Python FastAPI microservice (pypdf) |
| ZIP Packaging | archiver + JSZip |

## Two User Roles

### Staff Users (Internal Team)
- Full access to the staff application
- Can manage multiple companies
- Upload solicitations, run extraction, trigger generation
- Access all routes: `/`, `/documents`, `/company/*`, `/solicitations/*`, `/proposals/*`, `/results/*`

### Client Users (Paying Customers)
- Access the self-service portal at `/portal/*`
- Linked to exactly one company via `company_profiles.client_user_id`
- Complete their own onboarding: company profile, boilerplate, capabilities, certifications, differentiators, past performance, personnel
- Cannot access staff routes

The middleware enforces role-based routing — clients hitting staff paths are redirected to `/portal`, and vice versa.

## The Two-Tier Data Architecture

This is the central design principle of v2.0:

### Tier 1 — Enterprise Foundation (Static, Reusable)
Company data that stays the same across all bids:
- **Corporate Identity:** Company name, CAGE code, UEI, SAM registration, headquarters, POC
- **Vehicles & Certifications:** Contract vehicles (GSA, SEWP, CIO-SP3), certifications (8(a), HUBZone, SDVOSB), NAICS codes, facility clearances
- **Capabilities & Positioning:** Service areas, tools & technologies, methodologies, value propositions, competitive advantages, innovations, boilerplate library
- **Past Performance:** Historical contracts with CPARS ratings, achievements, client POCs
- **Personnel:** Employee roster with education, work history, clearances, proposed roles

A completeness score is calculated (weighted across 3 sections: Corporate Identity 35pts, Vehicles & Certs 25pts, Capabilities 40pts). Tier 1 must be complete before proposal generation is allowed.

### Tier 2 — Per-Bid Data Call (Dynamic, RFP-Specific)
Data collected for each specific solicitation:
- **Opportunity Details:** Prime/sub/teaming, contract type, set-aside
- **Past Performance References:** Which contracts to cite for this bid (count driven by RFP requirements)
- **Key Personnel:** Who to propose for each required position (positions driven by RFP requirements)
- **Technical Approach:** Approach narrative, tools, staffing model, assumptions, risks
- **Compliance Verification:** Certifications, clearances, attachments required by this specific RFP

The Tier 2 form schema is dynamically generated from AI extraction results — the fields, counts, and requirements match exactly what the RFP asks for.

## The Full Pipeline (End to End)

```
1. UPLOAD         Staff uploads solicitation documents (PDF, DOCX, XLSX, TXT)
                  ↓
2. CLASSIFY       AI classifies each document into 11 types
                  (base_rfp, amendment, sow_pws, qa_response, pricing_template, etc.)
                  ↓
3. RECONCILE      AI compares amendments against base RFP
                  Detects superseded sections, new requirements, modified scope
                  Detects fillable template fields in pricing forms
                  ↓
4. EXTRACT        AI runs 9 compliance extraction passes:
                  Section L (submission instructions), Section M (evaluation criteria),
                  Admin Data, Rating Scales, SOW/PWS, Cost/Price,
                  Past Performance, Key Personnel, Security Requirements
                  ↓
5. DATA CALL      Dynamic form generated from extractions
                  User fills in opportunity-specific data (Tier 2)
                  ↓
6. GENERATE       AI generates per-volume proposal content
                  Assembles prompts from Tier 1 + Tier 2 + Compliance Extractions
                  Outputs DOCX files with professional formatting
                  ↓
7. DOWNLOAD       User downloads volume DOCX files + compliance matrix
```

Each pipeline step runs as an Inngest background function, chained via events. Steps are error-isolated — a failure in one extraction category does not block others.

## Key Pages and What They Do

| Page | Purpose |
|---|---|
| `/` (Home) | Upload RFP documents, see company context |
| `/companies` | List and switch between companies |
| `/company/profile` | Edit company identity (CAGE, UEI, SAM, contacts) |
| `/company/boilerplate` | Manage reusable text blocks |
| `/company/capabilities` | Define service areas |
| `/company/certifications` | Track certifications |
| `/company/differentiators` | Win themes and competitive advantages |
| `/company/past-performance` | Historical contract records |
| `/company/personnel` | Employee roster and resumes |
| `/solicitations` | All solicitations for the selected company |
| `/solicitations/new` | Upload a new solicitation package |
| `/solicitations/[id]` | 6-tab solicitation workspace: Documents, Reconciliation, Compliance, Templates, Data Call, Draft |

## API Surface

- **18 company data endpoints** — CRUD for profile, boilerplate, capabilities, certifications, differentiators, past performance, personnel
- **12 solicitation pipeline endpoints** — upload, documents, reconciliation, compliance, data call, draft generation
- **7 legacy document endpoints** — the v1 single-document pipeline (still functional)
- **1 Inngest webhook** — receives background job events
- **1 auth callback** — Supabase OAuth
- **1 portal endpoint** — client document access

## Background Job Functions (Inngest)

| Function | Trigger | Purpose |
|---|---|---|
| `solicitationDocumentClassifier` | Document uploaded | Classify into 11 types |
| `solicitationReconciler` | All docs classified | Reconcile amendments, detect templates |
| `solicitationComplianceExtractor` | Reconciliation complete | 9 extraction passes |
| `proposalDraftGenerator` | Draft triggered | Generate DOCX per volume |
| `documentClassifier` (legacy) | Document uploaded | Classify single doc |
| `rfpIntelligenceAnalyzer` (legacy) | Document classified | Extract 8 sections + requirements |
| `rfpResponseGenerator` (legacy) | Generation triggered | Generate 4-volume proposal |

## What Makes This Different

1. **Function-based extraction, not label-based:** The AI searches for content by purpose (signal keywords like "page limits", "evaluation factors", "shall provide") rather than looking for fixed headers like "Section L". This handles the full spectrum of federal procurement vehicles (FAR 15, SeaPort NxG, GSA Schedule, FAR 12/13, Army TORs).

2. **Three-tier prompt assembly:** Every generated volume draws from company knowledge (Tier 1), opportunity-specific data (Tier 2), AND the AI-extracted RFP structure (Phase 7 compliance extractions).

3. **User overrides preserved:** If a user manually edits an extraction result, re-running extraction will never overwrite their edit.

4. **Compliance language enforcement:** The system forces specific patterns like "[Company] will [verb from requirement]" to create evaluator-friendly, directly compliant responses.

5. **Professional DOCX output:** Complete Word documents with hierarchical numbering, headers/footers, cover pages, table of contents, requirement boxes, win theme callout boxes, and a compliance matrix.
