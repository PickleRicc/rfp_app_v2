# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**AI/Content Generation:**
- Anthropic Claude API - AI-powered RFP analysis and response generation
  - SDK: `@anthropic-ai/sdk` 0.71.2
  - Auth: `ANTHROPIC_API_KEY` (environment variable)
  - Client: `lib/anthropic/client.ts`
  - Model: claude-sonnet-4-5-20250929
  - Uses: RFP intelligence analysis, proposal response generation, content enhancement

**Job Orchestration:**
- Inngest - Background job and workflow orchestration
  - SDK: `inngest` 3.49.3
  - Client: `lib/inngest/client.ts`
  - Webhook endpoint: `POST /api/inngest` (handles Inngest signing)
  - Functions:
    - `documentClassifier` - Stage 0: RFP document classification
    - `rfpIntelligenceAnalyzer` - Stage 1: Extract RFP requirements and structure
    - `rfpResponseGenerator` - Stage 2: Generate proposal responses
  - Event triggering: `document.uploaded` event triggered after file upload

**Document Processing:**
- Python PDF Extraction Microservice (external)
  - Endpoint: `PDF_SERVICE_URL` environment variable (default: http://localhost:8000)
  - Route: `POST /extract-text`
  - Used by: `app/api/upload/route.ts`
  - Returns: `{ text: string, pages: number, character_count: number }`
  - Fallback: Raw file reading if service unavailable (degraded mode)

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
  - Service role: `SUPABASE_SERVICE_ROLE_KEY` (private, server-only)
  - Client: `@supabase/supabase-js` 2.91.1
  - SSR support: `@supabase/ssr` 0.8.0
  - Auth: Supabase built-in authentication (JWT-based sessions)
  - Tables include:
    - `documents` - Uploaded RFP documents
    - `rfp_responses` - Generated proposal responses
    - `proposal_volumes` - Individual proposal sections
    - `company_profiles` - Company information and branding
    - `section_results` - RFP requirement extraction results
    - `processing_logs` - Job execution logs

**File Storage:**
- Local filesystem (development)
  - Documents stored at `/uploads/{filename}`
  - Generated DOCX files and compliance matrices stored on disk
  - ZIP archives created in memory for downloads
- Production: Likely Supabase Storage or similar cloud bucket (implementation not visible)

**Caching:**
- None detected - Redis or similar not in use

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Implementation: JWT-based session tokens stored in HTTP-only cookies
  - Auth flow: `middleware.ts` enforces authentication on protected routes
  - Scopes: Two user types managed via database lookup:
    - Staff users: Access internal dashboard (`/`, `/documents`, `/company`, `/proposals`)
    - Client users: Access portal (`/portal`) - linked via `company_profiles.client_user_id`
  - Session management: Cookies handled by Supabase SSR adapter
  - Middleware path: `middleware.ts` (excludes Inngest webhook at `/api/inngest`)
  - Callback route: `GET /auth/callback` - Supabase OAuth redirect

## Monitoring & Observability

**Error Tracking:**
- None detected - no Sentry, Rollbar, or similar

**Logs:**
- Console-based logging (development)
  - Examples: `console.log()`, `console.error()`, `console.warn()`
  - Used extensively in Inngest functions and API routes
- Structured logging likely via Inngest functions (captures job execution)

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from Next.js framework and typical deployment pattern)
- Alternative: Self-hosted Node.js environment

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or similar visible

## Environment Configuration

**Required env vars (production):**

Public (safe to expose in `NEXT_PUBLIC_*`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public key
- `NEXT_PUBLIC_APP_URL` - Application base URL for redirects

Private (server-only, .env.local):
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key for server-side operations
- `ANTHROPIC_API_KEY` - Claude API key
- `PDF_SERVICE_URL` - PDF extraction service URL (default: http://localhost:8000)

**Secrets location:**
- Local development: `.env.local` file (git-ignored)
- Production: Environment variables set in deployment platform (Vercel, etc.)
- Not committed to repository

## Webhooks & Callbacks

**Incoming:**
- `POST /api/inngest` - Inngest webhook for job execution
  - Expects: Inngest-signed requests with function events
  - Excludes: Authentication required (Inngest uses signing key)
  - Handled by: `inngest/next` middleware

**Outgoing:**
- Supabase Auth callbacks: `GET /auth/callback`
  - Receives: OAuth provider redirect with auth code
  - Not a true webhook - handled as part of OAuth flow

**Event Publishing:**
- Inngest events triggered from:
  - `app/api/upload/route.ts` - `document.uploaded` event after file upload
  - `app/api/generate-proposal/route.ts` - Proposal generation trigger

## API Endpoints (Internal)

**Document Management:**
- `POST /api/upload` - Upload RFP document
  - Auth: Staff required
  - Triggers: Inngest document classifier workflow
  - Returns: Document ID and status

- `GET /api/documents/[id]/progress` - Poll document processing progress

- `GET /api/documents/[id]/cancel` - Cancel processing job

**Proposal Generation:**
- `POST /api/generate-proposal` - Start proposal generation
  - Auth: Staff required
  - Triggers: Inngest response generator workflow

- `GET /api/proposals/[id]/download` - Download proposal package
  - Auth: Staff required
  - Returns: ZIP file with all volumes and compliance matrix
  - Uses: archiver to create ZIP streams
  - Files included: proposal volumes (DOCX), compliance matrix (XLSX)

**Company Profile:**
- `GET /api/company/profile` - Company branding and metadata
- `POST/PUT /api/company/profile` - Update company profile
- Related endpoints: boilerplate, capabilities, certifications, differentiators, personnel, past-performance

**Authentication:**
- `GET /api/auth/me` - Current user info and company context

---

*Integration audit: 2026-02-23*
