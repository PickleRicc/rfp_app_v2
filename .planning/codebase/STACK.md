# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.x - Used across all application code, APIs, and library utilities
- JavaScript - Build configuration and tooling

**Secondary:**
- Python - External PDF extraction microservice (separate from Node.js app)
- SQL - Supabase database queries and migrations

## Runtime

**Environment:**
- Node.js 20+ (Next.js 16.1.4 requirement)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.4 - Full-stack React framework for app/api routes and server rendering
- React 19.2.3 - UI component framework
- React DOM 19.2.3 - React rendering for web

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework with PostCSS
- PostCSS 4.x (via `@tailwindcss/postcss`) - CSS transformation

**Testing:**
- Not detected - No test framework configured (jest, vitest, etc.)

**Build/Dev:**
- ESLint 9 - Code linting with Next.js config
- TypeScript compiler - Type checking and compilation

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.91.1 - PostgreSQL database client and auth
- `@anthropic-ai/sdk` 0.71.2 - Claude AI API for proposal content generation
- `inngest` 3.49.3 - Workflow orchestration and job queue
- `docx` 9.5.1 - Generate .docx (Word) proposal documents programmatically
- `exceljs` 4.4.0 - Generate .xlsx compliance matrix spreadsheets
- `archiver` 7.0.1 - Create ZIP archives for proposal downloads
- `@mermaid-js/mermaid-cli` 11.12.0 - Render Mermaid diagrams (org charts, process flows) to PNG/SVG

**Infrastructure:**
- `pdf-parse` 2.4.5 - Parse PDF text (fallback, primary: Python service)
- `dotenv` 17.2.3 - Load environment variables from .env files
- `@types/archiver` 7.0.0 - TypeScript definitions for archiver

## Configuration

**Environment:**
- `.env` - Contains secrets (Supabase keys, Anthropic API key, Inngest keys)
- `.env.local` - Local development overrides
- Environment variables required:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key (sent to browser)
  - `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin key (never exposed to client)
  - `ANTHROPIC_API_KEY` - Claude API credentials
  - `INNGEST_EVENT_KEY` - Inngest event signing
  - `INNGEST_SIGNING_KEY` - Inngest webhook verification
  - `PDF_SERVICE_URL` (optional) - External Python PDF extraction service, defaults to `http://localhost:8000`

**Build:**
- `tsconfig.json` - TypeScript compiler settings with path alias `@/*` mapping to project root
- `next.config.ts` - Next.js build configuration (minimal)
- `eslint.config.mjs` - ESLint rules via flat config format
- `postcss.config.mjs` - PostCSS plugins for Tailwind

## Platform Requirements

**Development:**
- Node.js 20+
- npm or yarn
- Mermaid CLI (installed via npm, requires graphviz for rendering)
- Optional: Python 3.x with PDF extraction service running locally

**Production:**
- Vercel (assumed deployment target based on Next.js conventions)
- Supabase instance (cloud PostgreSQL)
- Anthropic API access
- Inngest cloud/self-hosted
- Optional: External Python PDF extraction service

## External Service Integration Points

**Supabase (Database + Auth):**
- Hosted PostgreSQL database
- Real-time subscriptions capability
- Auth system (not currently used for user login)
- Storage buckets (referenced but implementation details in integration doc)

**Anthropic (AI/LLM):**
- Claude Sonnet 4.5 (latest model: `claude-sonnet-4-5-20250929`)
- Used for proposal content generation, compliance analysis, gap detection

**Inngest (Workflow Engine):**
- Event-driven job processing
- Three-stage RFP analysis pipeline:
  - Stage 0: Document classification
  - Stage 1: RFP intelligence extraction
  - Stage 2: Proposal response generation

**Mermaid Diagram Rendering:**
- Converts Mermaid DSL to PNG/SVG
- Used for org charts and process diagrams in proposals
- Requires CLI execution via `child_process`

**PDF Extraction (External Service):**
- Python microservice at `PDF_SERVICE_URL` (default: `http://localhost:8000`)
- Endpoint: `/extract-text` (POST with file)
- Falls back to raw text if unavailable
- Returns: `{ text: string, pages: number, character_count: number }`

---

*Stack analysis: 2026-02-01*
