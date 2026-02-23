# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.x - All application code, strict mode enabled
- TSX (React) - UI components and page layouts
- JavaScript - Configuration files and build processes

**Secondary:**
- Python - External PDF extraction microservice (not part of main codebase)

## Runtime

**Environment:**
- Node.js (version specified via package.json, likely 18+)

**Package Manager:**
- npm 10.x+
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.4 - Full-stack React framework with App Router
- React 19.2.3 - UI library
- React DOM 19.2.3 - React rendering

**UI Components & Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- Radix UI - Headless component library
  - `@radix-ui/react-dropdown-menu` 2.1.4 - Dropdown components
  - `@radix-ui/react-progress` 1.1.1 - Progress indicators
  - `@radix-ui/react-select` 2.1.4 - Select dropdowns
  - `@radix-ui/react-slot` 1.1.1 - Primitive slot component
- Lucide React 0.454.0 - Icon library
- CVA (class-variance-authority) 0.7.1 - Type-safe CSS composition
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.3.1 - Merge Tailwind classes safely

**Document Generation:**
- docx 9.5.1 - DOCX (Microsoft Word) file generation
- ExcelJS 4.4.0 - Excel workbook generation for compliance matrices
- archiver 7.0.1 - ZIP file creation for package downloads
- JSZip 3.10.1 - ZIP file reading/parsing in JavaScript
- Mermaid CLI 11.12.0 - Diagram generation from text

**Testing:**
- eslint 9.x - Linting
- eslint-config-next 16.1.4 - Next.js ESLint configuration

**Build/Dev:**
- PostCSS 4.x - CSS processing (via tailwindcss plugin)
- TypeScript compiler - Built into Next.js

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk 0.71.2 - Claude AI API client for content generation
  - Used in: `lib/anthropic/client.ts`
  - Model: claude-sonnet-4-5-20250929

- @supabase/supabase-js 2.91.1 - Supabase client for database operations
  - Used in: `lib/supabase/client.ts`

- @supabase/ssr 0.8.0 - Server-side rendering for Supabase auth
  - Used in: `lib/supabase/server.ts`, `middleware.ts`

- inngest 3.49.3 - Background job orchestration
  - Used in: `lib/inngest/client.ts`, `app/api/inngest/route.ts`
  - Three main functions: document classifier, RFP intelligence analyzer, response generator

**Infrastructure:**
- pdf-parse 2.4.5 - PDF text extraction (optional - external service preferred)
  - Note: Deployment uses Python microservice instead (`PDF_SERVICE_URL`)

- libreoffice-convert 1.8.1 - Document format conversion
  - Format conversion capability for generated documents

- tmp 0.2.5 - Temporary file management
  - Used for working with generated files during processing

- dotenv 17.2.3 - Environment variable loading
  - Used for development configuration

## Configuration

**Environment:**
Configuration via environment variables (.env file - not committed):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (private, server-only)
- `ANTHROPIC_API_KEY` - Claude API key (private, server-only)
- `PDF_SERVICE_URL` - Python PDF extraction service endpoint (default: http://localhost:8000)
- `NEXT_PUBLIC_APP_URL` - Application URL for redirects
- `NODE_ENV` - Environment (development/production)

**Build:**
- `tsconfig.json` - TypeScript compilation settings
  - Target: ES2017
  - Module: ESNext
  - JSX: react-jsx
  - Path alias: `@/*` maps to root directory
  - Strict mode: enabled

- `next.config.ts` - Next.js configuration (currently minimal)

- `postcss.config.mjs` - PostCSS configuration
  - Uses @tailwindcss/postcss plugin

- `.eslintrc` - ESLint configuration (implicit via eslint-config-next)

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from TypeScript and Next.js 16 requirements)
- npm 10+
- Python 3.8+ (only for PDF extraction microservice, optional)

**Production:**
- Node.js runtime for Next.js deployment
- External Supabase PostgreSQL database
- Inngest cloud account for job orchestration
- Anthropic API access for Claude models
- PDF extraction microservice (Python-based) or compatible alternative

**Deployment Targets:**
- Vercel (optimized for Next.js)
- Self-hosted Node.js compatible platform
- Docker containerization (Dockerfile not present in main repo)

---

*Stack analysis: 2026-02-23*
