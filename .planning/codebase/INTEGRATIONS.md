# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**Large Language Models:**
- Anthropic Claude API - Content generation, compliance analysis, RFP intelligence extraction
  - SDK: `@anthropic-ai/sdk` 0.71.2
  - Auth: `ANTHROPIC_API_KEY` (API key via environment variable)
  - Model: `claude-sonnet-4-5-20250929` (defined in `lib/anthropic/client.ts`)
  - Usage: Proposal content templates, gap analysis, compliance statement generation

**Workflow Orchestration:**
- Inngest - Asynchronous job processing and event coordination
  - SDK: `inngest` 3.49.3
  - Auth: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (environment variables)
  - App ID: `rfp-analyzer`
  - Functions hosted at: `app/api/inngest/route.ts` (serves Stage 0, 1, 2 functions)
  - Three-stage pipeline:
    - `documentClassifier` - Classify uploaded RFP documents
    - `rfpIntelligenceAnalyzer` - Extract requirements and intelligence
    - `rfpResponseGenerator` - Generate proposal content

**Diagram Rendering:**
- Mermaid CLI - Converts Mermaid diagrams to images
  - SDK: `@mermaid-js/mermaid-cli` 11.12.0
  - Execution: Via `child_process.exec()` in Node.js
  - Output formats: PNG/SVG
  - Usage: Organizational charts (`lib/generation/exhibits/org-chart.ts`), process diagrams (`lib/generation/exhibits/process-diagram.ts`)
  - Temporary file storage: System temp directory with `.mmd` and image files

**PDF Text Extraction:**
- Python Microservice (External)
  - Endpoint: `${PDF_SERVICE_URL}/extract-text` (configured via `process.env.PDF_SERVICE_URL`, default: `http://localhost:8000`)
  - Transport: HTTP POST with multipart form data
  - Response: `{ text: string, pages: number, character_count: number }`
  - Fallback: If service unavailable, uses `file.text()` raw fallback (degraded quality)
  - Error handling: TypeError on connection failure returns 503 with helpful message directing to `pdf-service/README.md`

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Provider: Supabase (ykjayxpcxmelrjibpjxh.supabase.co)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (public) + `SUPABASE_SERVICE_ROLE_KEY` (admin)
  - Client: `@supabase/supabase-js` 2.91.1
  - Tables referenced:
    - `documents` - RFP/proposal documents with `company_id`
    - `rfp_responses` - Generated proposal responses with `compliance_matrix_url`
    - `proposal_volumes` - Individual proposal volumes with `docx_url`, `volume_type`, `response_id`
    - `companies` - Company profiles and settings
    - Additional tables for personnel, capabilities, certifications, boilerplate, past performance, differentiators, etc.

**File Storage:**
- Supabase Storage (implied via URL references)
  - Stores: Generated .docx proposal volumes, .xlsx compliance matrices
  - Access: Via `docx_url`, `compliance_matrix_url` fields in database

**Local File System:**
- Temporary files for Mermaid diagram generation in system temp directory
- PDF extraction service would write locally (external to Node app)

**Caching:**
- Redis/Memcache: Not detected
- In-memory: Inngest handles request caching for workflow state

## Authentication & Identity

**Auth Provider:**
- Custom authentication (no third-party auth detected)
- Supabase Auth capability available but not implemented for user login
- Multi-tenant isolation: `company_id` used as isolation key in requests (via `X-Company-Id` header in `app/api/documents/route.ts`, etc.)
- Server-side admin operations use service role key directly

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or error tracking service

**Logs:**
- Console logging only
  - Debug logs: Anthropic client initialization (`lib/anthropic/client.ts`)
  - Debug logs: PDF extraction with metrics (`app/api/upload/route.ts`)
  - Error logs: Scattered throughout with `console.error()`
  - No centralized logging service (ELK, DataDog, CloudWatch)

## CI/CD & Deployment

**Hosting:**
- Assumed: Vercel (Next.js native platform)
- Could also be: Self-hosted Node.js server, AWS Lambda, Docker

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other pipeline configured
- ESLint available for pre-commit linting but not enforced

## Environment Configuration

**Required env vars (Critical):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public, safe to expose)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key (safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin key (SECRET, never expose)
- `ANTHROPIC_API_KEY` - Claude API key (SECRET)
- `INNGEST_EVENT_KEY` - Inngest event key (SECRET)
- `INNGEST_SIGNING_KEY` - Inngest signing key (SECRET)

**Optional env vars:**
- `PDF_SERVICE_URL` - External PDF extraction service URL (defaults to `http://localhost:8000`)

**Secrets location:**
- Development: `.env` and `.env.local` files (git-ignored)
- Production: Environment variables set in hosting platform (Vercel, Docker, etc.)
- Current state: `.env` file contains live secrets (security concern - should be rotated)

## Webhooks & Callbacks

**Incoming:**
- Inngest webhooks at `app/api/inngest/route.ts` (HTTP GET/POST/PUT)
  - Receives workflow triggers and state updates from Inngest cloud/self-hosted
  - Serves three event-driven functions

**Outgoing:**
- None detected - No notifications to external services, Slack, email, webhooks

## Document Processing Pipeline

**File Format Support:**
- Input: PDF, text files
- Output: .docx (proposals), .xlsx (compliance matrix), .zip (download bundle)
- Libraries:
  - `docx` 9.5.1 - Generate Word documents with formatting, tables, headers/footers
  - `exceljs` 4.4.0 - Generate Excel spreadsheets for compliance matrix
  - `archiver` 7.0.1 - Create ZIP archives for multi-file downloads
  - `pdf-parse` 2.4.5 - PDF text extraction (fallback)
  - Mermaid CLI - Diagram rendering for exhibits

## API Routes Using Integrations

| Route | Integration | Purpose |
|-------|-------------|---------|
| `POST /api/upload` | Anthropic, Inngest, Supabase, PDF Service | Upload RFP, extract text, trigger analysis pipeline |
| `POST /api/generate-proposal` | Anthropic, Inngest, Supabase | Trigger proposal generation |
| `GET /api/proposals/[id]/download` | Supabase Storage, archiver | Download proposal + compliance matrix as ZIP |
| `GET /api/inngest` | Inngest | Webhook handler for workflow events |
| `GET /api/documents` | Supabase | Fetch company documents |
| `GET/POST /api/company/*` | Supabase | Manage company profile, personnel, capabilities, etc. |

---

*Integration audit: 2026-02-01*
