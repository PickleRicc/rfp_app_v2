# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
rfp_app_v2/
├── app/                          # Next.js 16 app directory (frontend + API routes)
│   ├── layout.tsx                # Root layout with ConditionalStaffLayout wrapper
│   ├── page.tsx                  # Home page - RFP upload form
│   ├── api/                      # API routes (route handlers)
│   │   ├── upload/
│   │   ├── generate-proposal/
│   │   ├── documents/
│   │   ├── proposals/
│   │   ├── download/
│   │   ├── results/
│   │   ├── requirements/
│   │   ├── company/              # Company data CRUD endpoints
│   │   ├── companies/            # List companies endpoint
│   │   ├── auth/                 # Auth endpoints (me, callbacks)
│   │   ├── inngest/              # Inngest webhook endpoint
│   │   └── portal/               # Portal-specific API endpoints
│   ├── auth/                     # Auth flow pages (login, callback)
│   ├── companies/                # Companies list and management
│   ├── company/                  # Company details pages
│   │   ├── profile/
│   │   ├── personnel/
│   │   ├── past-performance/
│   │   ├── capabilities/
│   │   ├── certifications/
│   │   ├── boilerplate/
│   │   └── differentiators/
│   ├── components/               # React components
│   │   ├── ui/                   # Radix UI primitives (button, input, select, etc.)
│   │   ├── layout/               # Layout components (header, sidebar wrappers)
│   │   ├── upload/               # Upload section component
│   │   ├── dashboard/            # Stat cards and dashboard components
│   │   ├── AppHeader.tsx         # Navigation header
│   │   ├── CompanySelector.tsx   # Company dropdown
│   │   └── [others].tsx          # Feature components
│   ├── documents/                # Documents list page
│   ├── proposals/                # Proposal viewing pages
│   ├── results/                  # Analysis results viewing pages
│   ├── login/                    # Login page
│   ├── portal/                   # Client portal (separate auth flow)
│   │   ├── (portal)/             # Portal route group
│   │   │   └── onboarding/       # Company data entry forms
│   │   ├── layout.tsx            # Portal-specific layout
│   │   └── login/                # Portal login
│   └── globals.css               # Global styles (Tailwind)
│
├── lib/                          # Business logic and utilities
│   ├── generation/               # Proposal/document generation system
│   │   ├── pipeline/             # Post-processing pipeline (page tracking, condensing, PDF)
│   │   │   ├── index.ts          # Exports all pipeline utilities
│   │   │   ├── page-tracker.ts   # Page limit enforcement + auto-condense
│   │   │   ├── content-condenser.ts # Reduce content to fit constraints
│   │   │   ├── pdf-converter.ts  # DOCX to PDF conversion
│   │   │   ├── outline-generator.ts # Generate hierarchical structure
│   │   │   ├── docx-page-counter.ts # Count pages in DOCX files
│   │   │   ├── package-builder.ts  # Assemble ZIP packages
│   │   │   ├── checklist-generator.ts # Quality checklist
│   │   │   └── temp-files.ts     # Temporary file management
│   │   ├── docx/                 # DOCX generation (Microsoft Word)
│   │   │   ├── generator.ts      # Main DOCX builder
│   │   │   ├── styles.ts         # Styling (fonts, colors)
│   │   │   ├── headers-footers.ts # Header/footer templates
│   │   │   ├── paragraph-helper.ts # Paragraph utilities
│   │   │   ├── numbering.ts      # Automatic numbering
│   │   │   ├── toc.ts            # Table of contents
│   │   │   ├── images.ts         # Image insertion
│   │   │   └── [helpers].ts      # Other DOCX utilities
│   │   ├── volumes/              # Volume-specific generators
│   │   │   ├── technical.ts      # Technical volume
│   │   │   ├── management.ts     # Management volume
│   │   │   ├── past-performance.ts # Past performance volume
│   │   │   └── price.ts          # Price volume
│   │   ├── exhibits/             # Visual exhibits
│   │   │   ├── exhibit-manager.ts # Central exhibit coordination
│   │   │   ├── org-chart.ts      # Organizational chart
│   │   │   ├── timeline.ts       # Gantt chart / timeline
│   │   │   ├── process-diagram.ts # Process flows
│   │   │   ├── branding.ts       # Logo and brand integration
│   │   │   └── render.ts         # Mermaid rendering
│   │   ├── compliance/           # Compliance management
│   │   │   └── matrix-generator.ts # Requirements-to-response mapping
│   │   ├── content/              # Content generation helpers
│   │   │   ├── boilerplate.ts    # Standard language templates
│   │   │   ├── compliance-language.ts # Compliance-specific phrasing
│   │   │   ├── win-themes.ts     # Competitive win statements
│   │   │   ├── heading-enhancer.ts # Title/heading generation
│   │   │   └── cross-references.ts # Section cross-reference linking
│   │   ├── planning/             # Planning and analysis
│   │   │   ├── page-estimator.ts # Page allocation calculator
│   │   │   ├── section-mapper.ts # Map requirements to sections
│   │   │   └── [others].ts       # Planning utilities
│   │   ├── templates/            # Document templates
│   │   │   ├── cover-letter.ts   # Cover letter template
│   │   │   ├── appendix-*.ts     # Various appendices
│   │   │   └── [others].ts       # Additional templates
│   │   ├── quality/              # Quality assurance
│   │   │   └── validation.ts     # Document validation
│   │   └── [other-dirs]/         # Other generation subsystems
│   │
│   ├── inngest/                  # Event-driven job processing (Inngest)
│   │   ├── client.ts             # Inngest SDK initialization
│   │   └── functions/            # Inngest workflow functions
│   │       ├── stage0-classifier.ts # Document classification
│   │       ├── stage1-rfp-intelligence.ts # RFP analysis
│   │       └── stage2-response-generator.ts # Proposal generation
│   │
│   ├── context/                  # React Context for state
│   │   └── CompanyContext.tsx    # Company selection context
│   │
│   ├── supabase/                 # Database client and config
│   │   ├── client.ts             # Supabase client instance
│   │   └── server.ts             # Server-side Supabase client
│   │
│   ├── anthropic/                # Anthropic AI SDK integration
│   │   ├── client.ts             # Anthropic client + model config
│   │   └── json-extractor.ts     # JSON response parsing utilities
│   │
│   ├── hooks/                    # Custom React hooks
│   │   └── [hook-files].ts       # Hook implementations
│   │
│   ├── auth.ts                   # Authentication helpers
│   │   - getAuth()               # Resolve current auth session
│   │   - requireStaffOrResponse() # Enforce staff access
│   │   - requireClientOrResponse() # Enforce client access
│   │   - requireStaff()          # Throw on non-staff
│   │   - requireClient()         # Throw on non-client
│   │   - getCompanyIdOrResponse() # Resolve company context from header
│   │
│   ├── api-helpers.ts            # API utility functions
│   └── utils.ts                  # General utilities (cn(), formatting, etc.)
│
├── public/                       # Static assets (logos, images)
├── scripts/                      # Utility scripts (seeding, migrations)
├── supabase_tables/              # Database schema SQL files
├── pdf-service/                  # Python microservice for PDF extraction
│   ├── main.py                   # FastAPI server
│   └── [dependencies]/           # Python requirements
│
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── next.config.js                # Next.js configuration
└── [config files]                # ESLint, PostCSS, etc.
```

## Directory Purposes

**`app/`** - Next.js app directory
- Purpose: Frontend pages and API routes in single directory structure
- Contains: React components, page templates, route handlers
- Key files: `layout.tsx` (root wrapper), `page.tsx` (home), `api/` (routes)

**`app/api/`** - API route handlers
- Purpose: REST endpoints for frontend and external systems
- Pattern: `[resource]/route.ts` and `[resource]/[id]/route.ts` for CRUD
- Auth: Checked via `requireStaffOrResponse()` or `requireClientOrResponse()`
- Company context: Via `X-Company-Id` header or derived from auth

**`app/components/ui/`** - UI component library
- Purpose: Radix UI primitives with Tailwind styling
- Contains: Button, Input, Select, Dropdown, Badge, Progress, etc.
- Pattern: Compound components with `asChild` polymorphism

**`app/company/` and `app/portal/(portal)/onboarding/`** - Data entry forms
- Purpose: Staff management interface (app/company) and client self-service (portal onboarding)
- Structure: Each subdirectory corresponds to a company data type
- Examples: `profile/`, `personnel/`, `past-performance/`, `certifications/`

**`lib/generation/`** - Proposal generation system
- Purpose: Modular generation of DOCX documents, exhibits, compliance matrices
- Organization: By concern (pipeline, docx, volumes, exhibits, compliance, content)
- Dependency: Each subsystem is independently testable

**`lib/generation/pipeline/`** - Post-processing pipeline
- Purpose: Enforce page limits, condense content, convert to PDF, assemble packages
- Entry: Called during Stage 2 response generation
- Output: Page allocation metadata, outline structure, final DOCX/PDF buffers

**`lib/generation/volumes/`** - Volume generators
- Purpose: Generate content for each proposal volume (technical, management, etc.)
- Input: Company data, RFP requirements, templates
- Output: DOCX document buffer + metadata
- Pattern: Each volume calls DOCX generator with volume-specific sections

**`lib/inngest/functions/`** - Asynchronous workflows
- Purpose: Event-driven background processing
- Stage 0: Classify document type
- Stage 1: Extract RFP intelligence (8 sections)
- Stage 2: Generate proposal (volumes, compliance, exhibits)
- Error handling: Logged to `processing_logs` table

**`lib/context/`** - React Context providers
- Purpose: Client-side state management
- Current: CompanyContext (selected company ID, company list, selection functions)
- Pattern: Provider wraps app in root layout, useCompany() hook provides context

**`lib/supabase/`** - Database client
- Purpose: Supabase JavaScript SDK instances
- Files: `client.ts` (server-side), `server.ts` (SSR-safe)
- Usage: Imported throughout for database operations

**`lib/auth.ts`** - Authentication utilities
- Purpose: Session resolution, role enforcement, company context extraction
- Functions:
  - `getAuth()`: Returns userId, email, isClient flag, companyId
  - `requireStaffOrResponse()`: API-safe version that returns NextResponse on failure
  - `requireStaff()`: Throws on non-staff
  - `getCompanyIdOrResponse()`: Resolves company from header (staff) or auth (client)

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout with root provider wrapper
- `app/page.tsx`: Home page (upload form)
- `app/api/inngest/route.ts`: Inngest webhook receiver

**Configuration:**
- `tsconfig.json`: TypeScript paths (@ = src root)
- `next.config.js`: Next.js configuration (image optimization, etc.)
- `tailwind.config.ts`: Tailwind CSS with custom theme colors
- `package.json`: Dependencies (Next.js 16, React 19, Supabase, Inngest, docx, etc.)

**Core Logic:**
- `lib/inngest/functions/stage2-response-generator.ts`: Main proposal generation orchestrator
- `lib/generation/docx/generator.ts`: DOCX document builder
- `lib/generation/compliance/matrix-generator.ts`: Requirements mapping
- `lib/generation/pipeline/page-tracker.ts`: Page limit enforcement

**API Routes (Key):**
- `app/api/upload/route.ts`: Accept document, trigger Stage 0
- `app/api/generate-proposal/route.ts`: Trigger Stage 2 for RFP
- `app/api/proposals/[documentId]/route.ts`: Fetch proposal details
- `app/api/download/[proposalId]/route.ts`: Download package

**Frontend Pages:**
- `app/page.tsx`: Upload interface
- `app/documents/page.tsx`: Document list with status tracking
- `app/proposals/[id]/page.tsx`: Proposal viewer + download
- `app/results/[id]/page.tsx`: Analysis results detail
- `app/company/profile/page.tsx`: Company profile editor
- `app/companies/page.tsx`: Manage all companies

**Testing:**
- No test files detected in current structure (tests/ or *.test.ts files not present)
- Suggestion: Add `__tests__/` or `*.test.ts` alongside implementation files

## Naming Conventions

**Files:**
- Pages: `page.tsx` for route handlers, `layout.tsx` for layouts
- Components: PascalCase filename matches export (e.g., `CompanySelector.tsx` exports `CompanySelector`)
- Utilities: camelCase (e.g., `api-helpers.ts`, `json-extractor.ts`)
- API routes: `route.ts` (Next.js convention)
- Styles: Global `globals.css`, component-scoped via className

**Directories:**
- Feature/domain: kebab-case (e.g., `past-performance`, `org-chart`)
- Route groups: `(groupname)` syntax for Next.js logical grouping
- Dynamic routes: `[param]` for dynamic segments (e.g., `[id]`)
- Private API: `_private` prefix (not currently used, but Next.js convention)

**Functions & Variables:**
- React components: PascalCase (e.g., `CompanyProvider`, `UploadSection`)
- Utility functions: camelCase (e.g., `extractJSON`, `formatFileSize`)
- Types/Interfaces: PascalCase (e.g., `CompanyProfile`, `DocumentStatus`)
- Constants: UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`, `PAGE_CONSTANTS`)

**Imports:**
- Path aliases: `@/` prefix for absolute imports from project root
- Example: `import { useCompany } from '@/lib/context/CompanyContext'`

## Where to Add New Code

**New Feature (Multi-file enhancement):**
- Primary code: `lib/generation/[feature]/` subdirectory
- API route: `app/api/[feature]/route.ts`
- Frontend page: `app/[feature]/page.tsx`
- Tests: `__tests__/[feature].test.ts` (create directory if adding first tests)
- Example: Adding new exhibit type → `lib/generation/exhibits/[new-type].ts` + export from exhibit-manager.ts

**New Component/Module:**
- Reusable component: `app/components/[category]/[ComponentName].tsx`
- Feature component: Co-locate near usage (e.g., upload widget in `app/components/upload/`)
- Example: New stat card → `app/components/dashboard/stat-card.tsx`

**New API Endpoint:**
- Pattern: `app/api/[resource]/route.ts` for collection, `app/api/[resource]/[id]/route.ts` for item
- Auth check: Top of handler via `requireStaffOrResponse()` or `requireClientOrResponse()`
- Company context: Extract via `request.headers.get('X-Company-Id')` or auth
- Example: GET `/api/proposals` → `app/api/proposals/route.ts`

**Utilities:**
- Shared helpers: `lib/[concern].ts` if standalone, or `lib/[module]/[utility].ts` if module-specific
- Type definitions: Co-locate with usage, extract to `lib/types.ts` if shared across 3+ files
- Example: New formatting function → `lib/utils.ts` (append to existing)

**Generation Subsystem (Most common):**
- New volume type: Add `lib/generation/volumes/[volume-name].ts`
- New exhibit: Add `lib/generation/exhibits/[exhibit-name].ts` + export from `exhibit-manager.ts`
- New content helper: Add `lib/generation/content/[helper-name].ts`
- New template: Add `lib/generation/templates/[template-name].ts`
- Integration in Stage 2: Import and call from `stage2-response-generator.ts`

## Special Directories

**`public/`** - Static assets
- Purpose: Logo, favicon, images served at `/` URL root
- Generated: No
- Committed: Yes

**`.next/`** - Build output
- Purpose: Compiled JavaScript, CSS, page chunks
- Generated: Yes (by `npm run build`)
- Committed: No

**`node_modules/`** - Dependencies
- Purpose: Installed npm packages
- Generated: Yes (by `npm install`)
- Committed: No

**`supabase_tables/`** - Database schema
- Purpose: SQL migration files and schema definitions
- Files: One SQL per major feature/phase
- Usage: Applied manually or via Supabase CLI
- Committed: Yes (schema as code)

**`pdf-service/`** - Python microservice
- Purpose: Runs separately for PDF text extraction
- Entry: `python main.py` in `pdf-service/` directory
- Endpoint: `POST /extract-text` (form-data file)
- Required: Must be running for PDF uploads to work (fallback to raw text if unavailable)
- Committed: Yes

**`.planning/codebase/`** - Architecture documentation
- Purpose: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md
- Generated: No (manually or by GSD agent)
- Committed: Yes (design decisions)

---

*Structure analysis: 2026-02-23*
