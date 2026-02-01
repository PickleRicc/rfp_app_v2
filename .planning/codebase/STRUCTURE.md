# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
rfp_app_v2/
├── app/                           # Next.js App Router pages and API routes
│   ├── api/                       # API route handlers
│   │   ├── companies/             # Multi-company management endpoints
│   │   ├── company/               # Company profile CRUD endpoints
│   │   ├── documents/             # Document retrieval endpoints
│   │   ├── generate-proposal/     # Proposal generation trigger
│   │   ├── proposals/             # Proposal retrieval and download
│   │   ├── requirements/          # RFP requirement extraction
│   │   ├── results/               # Analysis results retrieval
│   │   ├── upload/                # Document upload and processing
│   │   └── inngest/               # Inngest webhook endpoint
│   ├── components/                # Reusable React components
│   │   ├── AppHeader.tsx          # Top navigation and company selector
│   │   ├── CompanySelector.tsx    # Company dropdown component
│   │   ├── ComplianceTracker.tsx  # Compliance matrix display
│   │   ├── DocumentProgress.tsx   # Processing status component
│   │   └── VolumeViewer.tsx       # Proposal volume viewer
│   ├── company/                   # Company management pages
│   │   ├── profile/               # Company profile editor
│   │   ├── boilerplate/           # Standard text templates
│   │   ├── capabilities/          # Service capabilities management
│   │   ├── certifications/        # Company certifications
│   │   ├── differentiators/       # Competitive advantages
│   │   ├── personnel/             # Team member management
│   │   └── past-performance/      # Historical project records
│   ├── companies/                 # All companies management page
│   ├── documents/                 # Document list and management page
│   ├── proposals/                 # Proposal viewing page
│   ├── results/                   # RFP analysis results page
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Home page (document upload)
│   └── globals.css                # Tailwind CSS + app styles
├── lib/                           # Shared utilities and logic
│   ├── anthropic/                 # Anthropic SDK configuration
│   │   ├── client.ts              # Claude client initialization
│   │   └── json-extractor.ts      # JSON parsing utilities
│   ├── context/                   # React Context for state management
│   │   └── CompanyContext.tsx     # Company selection state
│   ├── generation/                # Proposal and content generation
│   │   ├── compliance/            # Compliance matrix generation
│   │   │   └── matrix-generator.ts
│   │   ├── content/               # Boilerplate and generated content
│   │   │   ├── boilerplate.ts
│   │   │   ├── compliance-language.ts
│   │   │   ├── cross-references.ts
│   │   │   └── win-themes.ts
│   │   ├── docx/                  # DOCX document generation
│   │   │   ├── generator.ts       # Main proposal document builder
│   │   │   ├── paragraph-helper.ts # Formatting utilities
│   │   │   └── styles.ts          # Proposal styling
│   │   ├── exhibits/              # Visual exhibits and charts
│   │   │   ├── exhibit-manager.ts
│   │   │   ├── org-chart.ts
│   │   │   ├── process-diagram.ts
│   │   │   └── timeline.ts
│   │   ├── planning/              # Proposal planning
│   │   │   ├── page-estimator.ts  # Page count prediction
│   │   │   └── section-mapper.ts  # RFP to proposal mapping
│   │   ├── quality/               # Quality assurance
│   │   │   └── validation.ts      # Compliance checking
│   │   ├── templates/             # Proposal section templates
│   │   │   ├── appendix-certifications.ts
│   │   │   ├── appendix-past-performance-detail.ts
│   │   │   ├── appendix-resumes.ts
│   │   │   ├── cover-letter.ts
│   │   │   ├── executive-summary.ts
│   │   │   ├── management-approach.ts
│   │   │   ├── past-performance.ts
│   │   │   ├── resume.ts
│   │   │   ├── technical-approach.ts
│   │   │   └── transition-plan.ts
│   │   └── volumes/               # Multi-volume proposal structure
│   │       ├── compliance-matrix.ts
│   │       ├── management.ts
│   │       └── technical.ts
│   ├── hooks/                     # Custom React hooks
│   │   └── useFetchWithCompany.ts # Fetch with company ID header injection
│   ├── inngest/                   # Inngest event orchestration
│   │   ├── client.ts              # Inngest client initialization
│   │   └── functions/             # Event handlers (processing stages)
│   │       ├── stage0-classifier.ts        # Document type classification
│   │       ├── stage1-rfp-intelligence.ts  # RFP analysis (8 sections)
│   │       └── stage2-response-generator.ts # Proposal generation
│   ├── supabase/                  # Supabase database client
│   │   └── client.ts              # Supabase client factory (anon & service role)
│   ├── templates/                 # Content templates (unused currently)
│   └── api-helpers.ts             # Generic API utilities
├── public/                        # Static assets
├── scripts/                       # Build and utility scripts
├── pdf-service/                   # Python microservice for PDF extraction
│   ├── main.py                    # FastAPI server
│   ├── requirements.txt           # Python dependencies
│   └── README.md                  # Service documentation
├── .planning/                     # Planning and documentation
│   └── codebase/                  # Codebase analysis (this directory)
├── .env                           # Environment variables
├── .env.local                     # Local overrides (git-ignored)
├── .gitignore                     # Git ignore rules
├── package.json                   # NPM dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── next.config.ts                 # Next.js configuration
├── postcss.config.mjs             # PostCSS configuration for Tailwind
├── eslint.config.mjs              # ESLint configuration
└── .next/                         # Build output (git-ignored)
```

## Directory Purposes

**app/**
- Purpose: Next.js App Router structure (React components and API routes)
- Contains: Pages, components, API endpoints, styling
- Key files: `layout.tsx` (root layout), `page.tsx` (home page)

**app/api/**
- Purpose: HTTP endpoint handlers for all backend operations
- Contains: Route handlers using Next.js App Router (POST/GET/PUT/DELETE)
- Key files: `upload/route.ts`, `generate-proposal/route.ts`, `companies/route.ts`

**app/components/**
- Purpose: Reusable React UI components shared across pages
- Contains: Functional components with 'use client' directive
- Key files: `AppHeader.tsx` (navigation), `CompanySelector.tsx` (company dropdown)

**app/company/** and **app/companies/**
- Purpose: Company profile management interface
- Contains: Pages for editing profile, personnel, capabilities, certifications, etc.
- Key files: `profile/page.tsx` (company profile editor), organized by data category

**lib/context/**
- Purpose: Global state management using React Context API
- Contains: Context provider and custom hooks
- Key files: `CompanyContext.tsx` (company selection state)

**lib/generation/**
- Purpose: All proposal and content generation logic
- Contains: DOCX generation, templates, compliance matrices, page planning
- Key files: `docx/generator.ts` (main document builder), `templates/` (section templates)

**lib/inngest/functions/**
- Purpose: Event-driven processing pipeline stages
- Contains: Three stages: classification, analysis, generation
- Key files: `stage0-classifier.ts`, `stage1-rfp-intelligence.ts`, `stage2-response-generator.ts`

**lib/supabase/**
- Purpose: Database client initialization and configuration
- Contains: Supabase SDK client factory with role support
- Key files: `client.ts` (exports supabase and getServerClient())

**lib/anthropic/**
- Purpose: Anthropic Claude API client configuration
- Contains: SDK initialization, model selection, utilities
- Key files: `client.ts` (Claude Sonnet 4.5 configuration)

**pdf-service/**
- Purpose: External Python FastAPI microservice for PDF text extraction
- Contains: Separate Python application (not Node.js)
- Key files: `main.py` (FastAPI server), `requirements.txt`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout with CompanyProvider, AppHeader, Tailwind styles
- `app/page.tsx`: Home page (document upload form, company selection)
- `app/api/inngest/route.ts`: Inngest webhook for event routing

**Configuration:**
- `package.json`: NPM dependencies (React 19, Next 16, Supabase, Anthropic, Inngest, docx)
- `tsconfig.json`: TypeScript config with `@/*` path alias
- `next.config.ts`: Next.js configuration
- `.env`: Environment variables (Supabase URL/keys, Anthropic API key, PDF service URL)

**Core Logic:**
- `lib/inngest/functions/stage0-classifier.ts`: Document type classification
- `lib/inngest/functions/stage1-rfp-intelligence.ts`: RFP section extraction
- `lib/inngest/functions/stage2-response-generator.ts`: Proposal generation
- `lib/generation/docx/generator.ts`: DOCX document builder
- `lib/context/CompanyContext.tsx`: Global company selection state

**API Routes:**
- `app/api/upload/route.ts`: Document upload (triggers stage0)
- `app/api/companies/route.ts`: Get all companies
- `app/api/company/*/route.ts`: Company profile CRUD endpoints
- `app/api/documents/route.ts`: Get documents for selected company
- `app/api/generate-proposal/route.ts`: Trigger stage2 proposal generation
- `app/api/proposals/[id]/download/route.ts`: Download generated proposal

**Testing:**
- No test files detected (no .test.ts, .spec.ts files)
- No jest.config or vitest.config found

## Naming Conventions

**Files:**
- Route handlers: `route.ts` (Next.js API routes)
- Pages: `page.tsx` (Next.js page components)
- Components: PascalCase (e.g., `AppHeader.tsx`, `CompanySelector.tsx`)
- Utilities/helpers: camelCase (e.g., `client.ts`, `api-helpers.ts`)
- Directories: lowercase with hyphens (e.g., `past-performance`, `api-helpers`)

**Functions:**
- React components: PascalCase (e.g., `AppHeader`, `DocumentProgress`)
- Utility functions: camelCase (e.g., `formatFileSize`, `fetchWithCompany`)
- Constants: UPPER_SNAKE_CASE (e.g., `PDF_SERVICE_URL`, `MODEL`)
- Event names: kebab-case with dot notation (e.g., `document.uploaded`, `response.generate`)

**Variables:**
- State: camelCase (e.g., `selectedCompany`, `documentId`, `filterType`)
- Types/Interfaces: PascalCase (e.g., `DocumentStatus`, `CompanyProfile`, `SectionResult`)
- Database columns: snake_case (e.g., `company_name`, `document_type`, `created_at`)

**Types:**
- Union types for statuses: `type DocumentStatus = 'pending' | 'processing' | 'completed' | ...`
- Interfaces for objects: `interface CompanyProfile { id: string; ... }`
- React component props: `interface ComponentProps { label: string; color: string; }`

## Where to Add New Code

**New RFP Analysis Feature:**
- Logic: `lib/inngest/functions/` (new stage function if needed, or extend stage1)
- API endpoint: `app/api/[feature-name]/route.ts`
- UI: New page in `app/documents/` or `app/results/`
- Tests: Co-located `[feature].test.ts` next to implementation (currently missing)

**New Company Data Section:**
- Form page: `app/company/[section-name]/page.tsx`
- API: `app/api/company/[section-name]/route.ts` for CRUD
- State: Extend CompanyContext if needed, otherwise use API fetching
- Database: Add table to Supabase schema, update types

**New Proposal Section/Template:**
- Template: `lib/generation/templates/[section-name].ts` (export function)
- Generator: Integrate into `lib/generation/docx/generator.ts` in section array
- Style: Add to `lib/generation/docx/styles.ts` if custom formatting needed
- Content: Boilerplate from `lib/generation/content/` as needed

**New Exhibit Type:**
- Manager: `lib/generation/exhibits/[type]-exhibit.ts`
- Generator: Add to `lib/generation/exhibits/exhibit-manager.ts`
- Mermaid/visual: Use Mermaid CLI for chart generation

**New Utility/Helper:**
- Library: `lib/[domain]/[utility].ts`
- Custom hooks: `lib/hooks/use[Feature].ts`
- API helpers: Add to `lib/api-helpers.ts` or create `lib/api/[feature].ts`

## Special Directories

**public/**
- Purpose: Static assets (images, fonts, favicon)
- Generated: No
- Committed: Yes (versioned in Git)

**.next/**
- Purpose: Next.js build output (compiled pages, static assets, webpack cache)
- Generated: Yes (created by `npm run build`)
- Committed: No (.gitignored)

**node_modules/**
- Purpose: NPM package installations
- Generated: Yes (created by `npm install`)
- Committed: No (.gitignored)

**pdf-service/**
- Purpose: Standalone Python microservice for PDF text extraction
- Generated: No (source code)
- Committed: Yes (separate from Node.js app)
- Runtime: Requires Python 3.8+, FastAPI, dependencies from requirements.txt
- Start: `cd pdf-service && python main.py` (listens on localhost:8000)

**.planning/**
- Purpose: GSD planning and codebase analysis documents
- Generated: No (created by GSD tools)
- Committed: Yes (reference documentation)

---

*Structure analysis: 2026-02-01*
