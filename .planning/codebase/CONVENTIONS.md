# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- Kebab-case for most files: `stage0-classifier.ts`, `page-tracker.ts`, `content-condenser.ts`
- PascalCase for React components: `CompanySelector.tsx`, `DocumentProgress.tsx`, `AppHeader.tsx`
- Lowercase with hyphens for directories: `lib/generation/docx/`, `lib/inngest/functions/`
- Index files for barrel exports: `lib/generation/pipeline/index.ts` exports all pipeline utilities

**Functions:**
- camelCase for function names: `generateProposalVolume()`, `createFetchWithCompany()`, `getCompanyIdFromRequest()`
- Prefix conventions for specific patterns:
  - `get*` for retrievers: `getServerClient()`, `getNextExhibitNumber()`
  - `create*` for factories: `createFetchWithCompany()`, `createProposalHeader()`
  - `generate*` for generators: `generateProposalVolume()`, `generateOrgChart()`

**Variables:**
- camelCase throughout: `selectedCompanyId`, `logoBuffer`, `filteredCompanies`
- Prefix `is` or `has` for booleans: `isOpen`, `hasError`, `isClient`
- State setters follow `set{Name}` pattern: `setIsOpen()`, `setSelectedCompany()`

**Types & Interfaces:**
- PascalCase for types and interfaces: `CompanyProfile`, `AuthResult`, `ResponseStatus`, `BrandingOptions`
- File location: Type definitions co-located in same file as usage or in dedicated `types.ts` files
  - Example: `lib/supabase/types.ts` for database types, `lib/supabase/company-types.ts` for company-related types
- Union types spelled out with pipes: `DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'`

## Code Style

**Formatting:**
- ESLint with Next.js defaults (eslint-config-next core-web-vitals and typescript)
- Configuration: `eslint.config.mjs` (flat config format, ESLint v9+)
- No Prettier config detected - formatted per eslint rules
- 2-space indentation (observed throughout codebase)

**Linting:**
- ESLint configured with: `eslint.config.mjs`
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Custom ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Run linting: `npm run lint`

**TypeScript:**
- Strict mode enabled: `"strict": true`
- Target: ES2017
- Module resolution: bundler
- JSX: react-jsx (React 19+)
- Path alias configured: `@/*` maps to project root for absolute imports

## Import Organization

**Order:**
1. External packages: `import { NextRequest, NextResponse } from 'next/server'`
2. Type imports: `import type { ClassValue } from 'clsx'`
3. Absolute path imports: `import { getServerClient } from '@/lib/supabase/client'`
4. Relative imports: `import { generateProposalVolume } from './generator'`
5. Type exports after code imports: `import { ..., type PageLimitStatus } from '@/lib/generation/pipeline'`

**Path Aliases:**
- All internal imports use `@/` alias pointing to project root
- Examples: `@/lib/supabase/client`, `@/lib/inngest/functions`, `@/lib/generation/docx/generator`
- Relative imports used only within same feature directory

**Barrel Files:**
- Barrel pattern (re-exports) used in pipeline module: `lib/generation/pipeline/index.ts`
- Collects and re-exports types and functions: `export { PageTracker, ... } from './page-tracker'`
- Simplifies consumer imports: `import { PageTracker, condenseContent } from '@/lib/generation/pipeline'`

## Error Handling

**Patterns:**
- Throw Error with descriptive messages for critical failures
  - Example: `throw new Error('Document not found or has no company association')`
  - Example: `throw new Error('No company selected. Please select a company first.')`
- Try-catch for async operations with error context preservation
  - Example in `lib/context/CompanyContext.tsx`: catches fetch errors and logs with context
- API routes return NextResponse.json() with status codes:
  - 400 for validation failures: `NextResponse.json({ error: '...' }, { status: 400 })`
  - 401 for unauthorized: `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
  - 403 for forbidden: `NextResponse.json({ error: '...' }, { status: 403 })`
  - 404 for not found: `NextResponse.json({ error: '...' }, { status: 404 })`
- Auth helper wraps errors: `getAuth()` returns null values, `requireStaffOrResponse()` throws/returns NextResponse
- Inngest functions log errors to database via `processing_logs` table

**Error Types:**
- String errors thrown directly (not Error objects always wrapped)
- Error instanceof checks: `e instanceof Error ? e.message : 'Unauthorized'`

## Logging

**Framework:** console methods (no logging library)

**Patterns:**
- Development: Emoji prefixes for visual scanning
  - `console.log('🔑 Initializing Anthropic client...')`
  - `console.log('✅ Anthropic client initialized...')`
  - `console.warn('⚠️  No sections found in content')`
  - `console.error('Error generating appendices:', error)`
- Used in: `lib/anthropic/client.ts`, `lib/generation/docx/generator.ts`, `lib/generation/docx/images.ts`
- Context passed: Include relevant data in logs for debugging
  - Example: `console.log('📝 generateSections called with:', { volumeType, ... })`
- Levels used: `console.log()`, `console.warn()`, `console.error()`
- Note: Logging appears development-focused (emoji use suggests debugging aid, not production)

## Comments

**When to Comment:**
- JSDoc blocks for exported functions, especially with complex signatures
- File-level comments explaining module purpose
- Inline comments for non-obvious logic or algorithm explanations
- Mark future work: `// TODO: Could implement smart range detection (3.1-3.5)`

**JSDoc/TSDoc:**
- Function documentation format (example from `lib/api-helpers.ts`):
  ```typescript
  /**
   * Extracts the company_id from request headers
   * Returns the company_id or throws an error response
   */
  export function getCompanyIdFromRequest(request: NextRequest): string
  ```
- Parameters and return types documented
- Module docstrings at file top: `lib/generation/pipeline/index.ts` demonstrates pattern
- Used selectively - not every function requires docs

## Function Design

**Size:**
- Functions sized to fit single responsibility (Stage-2 response generator is exception at ~800 lines)
- Typical utility functions: 5-50 lines
- Complex generation functions: 100-300 lines with step.run() async subdivisions

**Parameters:**
- Named parameters over positional for complex operations
- Example: `generateProposalVolume(volumeType: string, content: any, companyProfile: any, ...)`
- `any` type used for flexible content handling (indicates area for improvement)

**Return Values:**
- Explicit return types for public functions
- Promise<> for async operations
- Type unions for multiple outcomes: `AuthResult | NextResponse`
- Objects returned with typed fields: `{ docxBuffer: Buffer, pdfBuffer: Buffer | null }`

## Module Design

**Exports:**
- Named exports for functions and types
- Default exports rarely used (only in templates: `lib/templates/rfp-response-template.ts`)
- Specific named exports preferred for clarity

**Barrel Files:**
- Used to aggregate related exports
- Example: `lib/generation/pipeline/index.ts` groups pipeline functionality
- Reduces import path verbosity for consumers
- Re-exports with type annotations: `export { PageTracker, ... type PageLimitStatus }`

**Organizational Pattern:**
- Organized by feature/domain:
  - `lib/generation/` - document generation
  - `lib/inngest/functions/` - async workflow stages
  - `lib/supabase/` - database clients and types
  - `app/api/` - API route handlers
  - `app/components/` - React components
  - `lib/context/` - React context providers
- Functions grouped by concern (parsing, formatting, persistence)

## Async & Promises

**Patterns:**
- Async/await throughout (not raw Promise chains)
- Inngest step.run() for async composition: `await step.run('fetch-data', async () => { ... })`
- Promise.all() for parallel operations: `await Promise.all([...queries])`
- Error handling at each step for fault isolation

## React Component Conventions

**Patterns:**
- Functional components with hooks exclusively
- Client-side boundary marked: `'use client'` at top of component file
- Server components (no marker) in app/ routes
- Prop types via interface: `CompanyProfile` interface in CompanyContext.tsx
- Event handlers: `handleClickOutside`, `handleSelectCompany` naming pattern
- State management via Context API (CompanyContext) for company selection
- Refs for DOM access: `const dropdownRef = useRef<HTMLDivElement>(null)`

---

*Convention analysis: 2026-02-23*
