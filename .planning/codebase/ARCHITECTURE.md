# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Multi-stage pipeline with layered separation between frontend (Next.js), API routes, asynchronous job processing (Inngest), generation services (lib), and database (Supabase).

**Key Characteristics:**
- Server/client component split (React 19 with Next.js 16)
- Event-driven background processing using Inngest for document analysis and proposal generation
- Three-stage processing pipeline: classification → intelligence extraction → response generation
- Modular generation system with separate concerns for DOCX output, exhibits, compliance, and content
- Context-based state management for multi-company support
- Header-based authentication and company context propagation

## Layers

**Presentation Layer (Frontend):**
- Purpose: Interactive UI for uploading documents, managing companies, viewing results
- Location: `app/` (top-level pages and components)
- Contains: React/Next.js pages, client components, UI library, upload handling
- Depends on: Context providers, API routes, utilities
- Used by: End users (staff and client portal users)

**API Route Layer:**
- Purpose: HTTP endpoints for document upload, proposal generation, data fetching, webhooks
- Location: `app/api/` (route handlers)
- Contains: POST/GET/PATCH/DELETE handlers, authentication checks, business logic orchestration
- Depends on: Supabase client, Inngest, generation services
- Used by: Frontend, external systems, Inngest webhook triggers

**Job Processing Layer (Inngest):**
- Purpose: Asynchronous processing of document analysis and proposal generation
- Location: `lib/inngest/functions/`
- Contains: Three stage functions (classifier, intelligence analyzer, response generator)
- Depends on: Anthropic SDK, Supabase, generation libraries
- Used by: API routes via `inngest.send()` event trigger

**Generation Services Layer:**
- Purpose: Business logic for generating proposal documents, compliance matrices, exhibits
- Location: `lib/generation/` (organized by subsystem)
- Contains: DOCX generation, exhibit rendering, content condensing, compliance analysis, page tracking
- Depends on: Document libraries (docx, exceljs, jszip), Anthropic for AI analysis
- Used by: Stage 2 (response generator) Inngest function, result APIs

**Data Layer:**
- Purpose: Database schema and client abstraction
- Location: `lib/supabase/` and database tables
- Contains: Supabase client configuration, schema (documents, company_profiles, rfp_requirements, etc.)
- Depends on: Supabase JavaScript SDK, environment variables
- Used by: All other layers for data persistence

**Context/State Layer:**
- Purpose: Client-side state management for company selection, user session
- Location: `lib/context/` and `lib/hooks/`
- Contains: CompanyContext with localStorage persistence
- Depends on: React Context API
- Used by: Frontend components for company selection propagation

**Authentication Layer:**
- Purpose: Session management, role-based access control (staff vs. client)
- Location: `lib/auth.ts`
- Contains: Auth result types, staff/client requirement checks, company resolution
- Depends on: Supabase auth, Supabase client for company lookup
- Used by: API routes, server components

## Data Flow

**Document Upload to Proposal Flow:**

1. **Upload Phase** (`POST /api/upload`)
   - Frontend sends file + X-Company-Id header
   - PDF extraction via Python microservice (`/extract-text`)
   - Document record created in Supabase with `status: 'pending'`
   - `document.uploaded` event sent to Inngest

2. **Stage 0: Classification** (`stage-0-document-classifier`)
   - Inngest function receives `document.uploaded` event
   - Anthropic analyzes document to classify as RFP/proposal/contract/other
   - Document type stored, status updated to `processing`
   - Logs written to `processing_logs` table
   - If RFP detected: sends `document.classified` event for Stage 1

3. **Stage 1: RFP Intelligence** (`stage-1-rfp-intelligence`)
   - Inngest function receives `document.classified` event
   - Anthropic analyzes 8 key sections (Executive Summary, Project Scope, etc.)
   - Requirements extracted and stored in `rfp_requirements` table
   - Analysis results stored per-section
   - Document status updated to `completed`

4. **Proposal Generation Trigger** (`POST /api/generate-proposal`)
   - Frontend/user clicks Generate button on completed RFP
   - Document status validated (must be `completed` or `proposal_ready`)
   - `response.generate` event sent to Inngest
   - Document status updated to `generating_proposal`

5. **Stage 2: Response Generation** (`stage-2-response-generator`)
   - Inngest function receives `response.generate` event
   - Fetches all company data, extracted requirements, volume structure
   - Generates 4 volumes (technical, management, past-performance, price):
     - Each volume created with DOCX output
     - PDF conversion attempted (non-blocking)
     - Stored with volume record in database
   - Generates compliance matrix (requirements-to-responses mapping)
   - Creates exhibits (org charts, timelines, graphics)
   - Page tracking and outline generation during assembly
   - Document status updated to `proposal_ready`
   - Results accessible via `/api/proposals/[documentId]`

**State Management:**

- **Company Selection:** Stored in CompanyContext (localStorage + React state)
- **Document Status:** Managed in Supabase `documents` table
- **Processing Progress:** Tracked in `processing_logs` table (stage, status, metadata)
- **Generation Output:** Split across `proposal_volumes` (DOCX/PDF), `compliance_matrices`, `exhibits` tables

## Key Abstractions

**Pipeline Components** (`lib/generation/pipeline/`):
- Purpose: Manages proposal generation post-processing
- Examples:
  - `PageTracker`: Enforces page limits per volume
  - `condenseContent`: Reduces content to fit page constraints
  - `generateOutline`: Creates hierarchical structure view
  - `buildPackage`: Assembles all volumes + exhibits into downloadable format
- Pattern: Each component is a pure function or class with clear input/output

**Generation Volumes** (`lib/generation/volumes/`):
- Purpose: Volume-specific content generation
- Examples: `technical.ts`, `management.ts`, `past-performance.ts`, `price.ts`
- Pattern: Each volume has standard structure (sections, subsections, exhibits)

**Compliance Matrix** (`lib/generation/compliance/matrix-generator.ts`):
- Purpose: Maps RFP requirements to proposal sections
- Pattern: Requirement → section response cross-reference, coverage percentage calculation

**Exhibit Rendering** (`lib/generation/exhibits/`):
- Purpose: Generate visual exhibits (org charts, timelines, process diagrams)
- Examples:
  - `org-chart.ts`: Mermaid-based organizational hierarchy
  - `timeline.ts`: Gantt chart generation
  - `branding.ts`: Logo and styling integration
- Pattern: Each exhibit exports to image via Mermaid CLI or library

**DOCX Generation** (`lib/generation/docx/generator.ts`):
- Purpose: Assembles volumes into Microsoft Word documents
- Depends on: `docx` library (DOM-like API)
- Pattern: Builder pattern - successive methods add sections, styling, TOC, headers/footers

## Entry Points

**Frontend Entry Points:**

- `app/page.tsx` (Home - Upload)
  - Renders UploadSection component
  - Triggered by: Browser navigation to `/`
  - Responsibilities: File upload form, progress tracking, redirect to results

- `app/documents/page.tsx` (Documents List)
  - Triggered by: Navigation to `/documents`
  - Responsibilities: List all documents for company, filtering, status monitoring, generate button

- `app/proposals/[id]/page.tsx` (Proposal View)
  - Triggered by: Navigation to `/proposals/[documentId]`
  - Responsibilities: Display generated proposal volumes, download buttons, outline view

- `app/portal/(portal)/onboarding/[section]/page.tsx` (Client Portal Onboarding)
  - Triggered by: Client portal navigation
  - Responsibilities: Company data entry forms (profile, personnel, past-performance, etc.)

**API Entry Points:**

- `POST /api/upload` - Accept file + company context, trigger Stage 0
- `POST /api/generate-proposal` - Trigger Stage 2 for completed RFP
- `GET /api/documents` - List documents (filtered by X-Company-Id header)
- `GET /api/proposals/[documentId]` - Fetch proposal details + volumes
- `GET /api/download/[proposalId]` - Download proposal package as ZIP
- `POST /api/documents/[id]/cancel` - Cancel running job

**Webhook Entry Points:**

- `POST /api/inngest` - Inngest webhook for function execution (handled by Inngest SDK)

## Error Handling

**Strategy:** Multi-layer validation with graceful degradation

**Patterns:**

- **API Layer:** Validation errors return 400-403 with message, server errors return 500
- **Auth Layer:** Failed auth returns 401 (unauthorized), forbidden role returns 403
- **Company Context:** Failed company fetch logs error but app continues with null company
- **PDF Extraction:** Falls back to raw file text if Python service unavailable
- **PDF Generation:** PDF conversion failures logged but don't block proposal (docxOnly = true)
- **Inngest Functions:** Errors logged to `processing_logs` with full metadata, function retries configured per-stage
- **Frontend:** Try-catch blocks with user-facing alert() messages

## Cross-Cutting Concerns

**Logging:**
- Console.log with emoji prefixes (📄, ✅, ❌, 🔍, 📦) for quick scan
- Processing logs stored in Supabase `processing_logs` table (stage, status, metadata)
- Errors include full stack traces in server logs

**Validation:**
- Input validation at API routes (file type, document ID existence, company association)
- Status validation before state transitions (can only generate proposal from completed RFP)
- Header validation (X-Company-Id required for company-scoped endpoints)

**Authentication:**
- Supabase Auth session checks on all API routes
- Header-based company context (`X-Company-Id` for staff, derived from client user for portal)
- Role enforcement (isClient vs. isStaff) via `requireStaffOrResponse()` or `requireClientOrResponse()`

**Company Context Propagation:**
- Frontend: CompanyContext state + localStorage
- API Routes: X-Company-Id header for staff requests
- Database: company_id foreign key on all multi-tenant tables
- Portal: Derived from authenticated user's linked company

---

*Architecture analysis: 2026-02-23*
