# ClicklessAI — RFP Proposal Generator

An AI-powered platform that takes federal government solicitation packages, extracts every compliance requirement, collects company-specific data through a structured intake process, and generates complete, multi-volume DOCX proposal responses ready for submission.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript (strict), Tailwind CSS 4 |
| UI Components | Radix UI primitives, Lucide icons |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI/LLM | Anthropic Claude Sonnet 4.5 |
| Background Jobs | Inngest (event-driven function pipeline) |
| DOCX Generation | `docx` npm library |
| PDF Extraction | Python FastAPI microservice (pypdf) |

## Pipeline

```
1. UPLOAD         Upload solicitation documents (PDF, DOCX, XLSX, TXT)
2. CLASSIFY       AI classifies each document into 11 types
3. RECONCILE      AI reconciles amendments, detects templates
4. EXTRACT        9 compliance extraction passes (Section L/M, SOW, etc.)
5. DATA CALL      Dynamic form generated from extractions — user fills bid-specific data
6. GENERATE       AI generates per-volume DOCX with company branding + optional diagrams
7. DOWNLOAD       Download volume DOCX files + compliance matrix
```

## Key Pages

| Page | Purpose |
|---|---|
| `/solicitations` | Landing page — all solicitations |
| `/solicitations/new` | Upload a new solicitation package |
| `/solicitations/[id]` | 6-tab workspace: Documents, Reconciliation, Compliance, Templates, Data Call, Draft |
| `/companies` | List and switch between companies |
| `/company/profile` | Company identity, contacts, brand colors |
| `/company/*` | Tier 1 data: boilerplate, capabilities, certifications, differentiators, past performance, personnel |

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run all migration SQL files in `/supabase_tables/` in order

### 3. Configure Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

### 4. Run

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Inngest dev server
npx inngest-cli@latest dev

# Terminal 3: PDF extraction service (optional, for PDF uploads)
cd pdf-service && python -m uvicorn main:app --port 8000
```

Open [http://localhost:3000](http://localhost:3000)

## Documentation

Detailed documentation in `/docs/`:

1. **[What This App Is](docs/1-WHAT-THIS-APP-IS.md)** — Architecture, two-tier data model, pipeline overview
2. **[Data Calls and Storage](docs/2-DATA-CALLS-AND-STORAGE.md)** — Database schema, data flow, state management
3. **[RFP Extraction Flow](docs/3-RFP-EXTRACTION-FLOW.md)** — Classification, reconciliation, 9 extraction passes
4. **[Content Generation](docs/4-CONTENT-GENERATION.md)** — Prompt assembly, DOCX styling, color palette, diagram embedding
