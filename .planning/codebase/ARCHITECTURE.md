# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Event-Driven Multi-Stage Processing with Tiered Application Architecture

**Key Characteristics:**
- **Client-Server:** Next.js 16 full-stack framework (React frontend + Node.js API routes)
- **Workflow Engine:** Inngest-based event-driven task scheduling for document processing
- **Database:** Supabase (PostgreSQL) for persistent storage and state management
- **AI Integration:** Anthropic Claude API for document classification, analysis, and proposal generation
- **Async Processing:** Multi-stage pipeline (Stage 0 classifier → Stage 1 RFP analyzer → Stage 2 proposal generator)
- **Context-Based State:** React Context API for company selection shared across app

## Layers

**Presentation Layer (Client-Side UI):**
- Purpose: User-facing React components, page routing, form handling, real-time polling
- Location: `app/` directory (pages, components)
- Contains: Page components (`page.tsx`), shared UI components (`app/components/`), client-side hooks
- Depends on: Context API for state, fetch API to backend
- Used by: Browser/user interaction

**API Layer (Server-Side Routes):**
- Purpose: HTTP endpoints for document uploads, data CRUD, company management, proposal generation
- Location: `app/api/` directory (route handlers)
- Contains: POST/GET route handlers using Next.js App Router
- Depends on: Supabase client, Inngest, Anthropic SDK, file processing services
- Used by: Frontend, external services (webhooks), Inngest functions

**State Management Layer:**
- Purpose: Global application state for multi-company context
- Location: `lib/context/CompanyContext.tsx`
- Contains: Company selection, company list caching, localStorage persistence
- Depends on: API endpoints for company data
- Used by: All client-side pages and components

**Processing Layer (Inngest Functions):**
- Purpose: Asynchronous event-driven document processing pipeline
- Location: `lib/inngest/functions/` directory
- Contains: Three-stage processing functions (stage0-classifier, stage1-rfp-intelligence, stage2-response-generator)
- Depends on: Inngest client, Anthropic API, Supabase for data persistence
- Used by: API layer (via event trigger), next stage in pipeline

**Generation Layer (Proposal & Content):**
- Purpose: Generate professional proposal documents, templates, and exhibits
- Location: `lib/generation/` directory (compliance, content, docx, exhibits, planning, quality, templates, volumes)
- Contains: DOCX generation, template engines, boilerplate content, compliance matrices, page estimation
- Depends on: `docx` library for Word document generation, company profile data, RFP requirements
- Used by: Stage 2 response generator, proposal endpoints

**Integration Layer (External Services):**
- Purpose: Client initialization and configuration for external services
- Location: `lib/anthropic/`, `lib/supabase/`
- Contains: Anthropic SDK client, Supabase client factory
- Depends on: Environment variables for API keys and URLs
- Used by: Processing layer, API routes

**Data Access Layer:**
- Purpose: Database schema interface and queries
- Location: Supabase database (accessed via SDK)
- Contains: Tables for documents, company profiles, processing logs, results, proposals
- Depends on: Supabase configuration (URL, keys)
- Used by: All backend code (API routes, Inngest functions)

## Data Flow

**Document Upload and Analysis Flow:**

1. **Upload Phase** (`app/api/upload/route.ts`):
   - User selects RFP document and clicks upload
   - Frontend sends POST to `/api/upload` with company ID header
   - Backend extracts file content (PDF via Python service or text parsing)
   - Document record created in `documents` table with status=pending
   - Inngest event `document.uploaded` triggered with documentId and fileContent

2. **Stage 0: Classification** (`lib/inngest/functions/stage0-classifier.ts`):
   - Inngest function listens for `document.uploaded` event
   - Claude classifies document type (rfp, proposal, contract, other)
   - Result stored in `documents` table with document_type
   - Processing log created
   - If RFP, triggers next stage

3. **Stage 1: RFP Intelligence** (`lib/inngest/functions/stage1-rfp-intelligence.ts`):
   - Analyzes RFP content for 8 key sections
   - Extracts requirements, deadlines, evaluation criteria
   - Stores section results in `analysis_results` table
   - Updates document status to completed

4. **Stage 2: Proposal Generation** (`lib/inngest/functions/stage2-response-generator.ts`):
   - Triggered by `/api/generate-proposal` endpoint
   - Retrieves RFP analysis and company profile
   - Generates multi-volume proposal using generation layer
   - Creates DOCX files and stores proposal metadata
   - Updates document status to proposal_ready

5. **Results Display** (`app/results/[id]/page.tsx`):
   - Frontend polls `/api/results/{documentId}` for completion
   - Displays extracted sections, key requirements
   - Offers proposal generation action
   - Links to `/proposals/{documentId}` when ready

**Company Context Flow:**

1. CompanyProvider loads companies from `/api/companies` on mount
2. Selected company ID persisted to localStorage
3. Company header and selectors reference useCompany hook
4. Company ID passed to backend via X-Company-Id header
5. All requests filtered by company (documents, analysis, proposals)

**State Management:**

- **Client-Side:** React Context holds selectedCompanyId, selectedCompany, companies list
- **Persistence:** localStorage stores selected company ID between sessions
- **Server-Side:** Supabase single source of truth for all persistent data
- **Async State:** Document status polled every 3 seconds during processing

## Key Abstractions

**DocumentProcessor:**
- Purpose: Abstracts multi-stage asynchronous document processing
- Examples: `stage0-classifier.ts`, `stage1-rfp-intelligence.ts`, `stage2-response-generator.ts`
- Pattern: Inngest functions with step.run() for retry-safe operations

**ProposalGenerator:**
- Purpose: Encapsulates DOCX generation for professional proposals
- Examples: `lib/generation/docx/generator.ts`, template files in `lib/generation/templates/`
- Pattern: Modular template functions (executive-summary, technical-approach, etc.)

**CompanyContext:**
- Purpose: Global multi-company state without prop drilling
- Examples: `lib/context/CompanyContext.tsx`, `useCompany()` hook
- Pattern: React Context + Custom Hook for type-safe access

**Supabase Client Factory:**
- Purpose: Provides anon and service role clients with correct authentication
- Examples: `lib/supabase/client.ts` (supabase, getServerClient)
- Pattern: Factory exports for different auth levels

## Entry Points

**Web Application:**
- Location: `app/page.tsx`
- Triggers: Browser navigation to /
- Responsibilities: Document upload form, company selection validation, processing feedback

**Documents Page:**
- Location: `app/documents/page.tsx`
- Triggers: Navigation to /documents
- Responsibilities: List documents for selected company, filter by type/status, polling for updates

**Company Management:**
- Location: `app/company/profile/page.tsx` and related pages
- Triggers: Navigation to /company/* routes
- Responsibilities: CRUD operations for company profile, personnel, capabilities, certifications

**API: Document Upload:**
- Location: `app/api/upload/route.ts`
- Triggers: POST /api/upload with file and company ID
- Responsibilities: File extraction, document creation, Inngest event emission

**API: Proposal Generation:**
- Location: `app/api/generate-proposal/route.ts`
- Triggers: POST /api/generate-proposal with documentId
- Responsibilities: Validation, Inngest event trigger, status update

**Inngest Webhook:**
- Location: `app/api/inngest/route.ts`
- Triggers: POST from Inngest service
- Responsibilities: Routes events to registered function handlers

## Error Handling

**Strategy:** Try-catch blocks with user-facing error messages and logging

**Patterns:**

- **Upload Errors:** Document creation fails → return NextResponse.json with error status 500
- **PDF Service Errors:** Falls back to raw text extraction with warning log
- **Database Errors:** Logged to console, generic error returned to user
- **Inngest Failures:** Automatic retry logic built into step.run() operations
- **Frontend Errors:** Alert dialogs for user-triggered actions, error state in component
- **API Validation:** Status checks (response.ok) with descriptive error messages

**Logging:**
- Console logging for debugging (emoji prefixes for status indication)
- Processing logs stored in `processing_logs` table via Inngest steps
- No centralized error tracking system (direct to console)

## Cross-Cutting Concerns

**Authentication:**
- No user authentication; company selection acts as logical isolation
- Supabase service role used server-side for admin operations
- Company ID header required for document operations

**Authorization:**
- Company-scoped data access via X-Company-Id header
- Server validates company ID matches selected company
- No fine-grained permission system

**Validation:**
- Frontend: Form validation via HTML5 and React state
- Backend: Required field checks (companyId, documentId, file presence)
- Database: Foreign key constraints via Supabase schema

**Caching:**
- Client-side: Company list cached in React state, refreshed on demand
- Server-side: No persistent caching layer (fresh queries each request)
- Browser localStorage: Company selection ID persisted

**PDF Processing:**
- External Python microservice (`PDF_SERVICE_URL` env var)
- Async extraction via /extract-text endpoint
- Character and page count tracking

**Document Processing Pipeline:**
- Inngest handles orchestration, retries, error recovery
- Status tracked in documents table (pending → processing → completed/failed)
- Each stage creates processing_logs entries for audit trail

---

*Architecture analysis: 2026-02-01*
