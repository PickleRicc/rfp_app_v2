# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Page components: `[route-name]/page.tsx` (Next.js App Router convention)
- API routes: `[resource]/route.ts` with HTTP method exports
- Client components: PascalCase with `.tsx` extension (e.g., `CompanySelector.tsx`, `AppHeader.tsx`)
- Utility files: camelCase (e.g., `json-extractor.ts`, `paragraph-helper.ts`)
- Context files: `[Context].tsx` (e.g., `CompanyContext.tsx`)

**Functions:**
- Components: PascalCase for both function components and arrow function exports
  - Example: `export default function Home()` or `export default function CompanySelector()`
- API handlers: lowercase HTTP method names (`GET`, `POST`, `PUT`, `DELETE` as exports)
  - Example: `export async function GET(request: NextRequest)`
- Utility/helper functions: camelCase
  - Example: `getCompanyIdFromRequest()`, `generateComplianceMatrix()`, `findRequirementMapping()`
- Event handlers: `handle[Action]` camelCase
  - Example: `handleUpload()`, `handleSelectCompany()`, `handleClickOutside()`

**Variables:**
- State: camelCase for both value and setter
  - Example: `const [isOpen, setIsOpen] = useState(false);`
  - Example: `const [selectedCompanyId, setSelectedCompanyId] = useState(null);`
- Constants (module-level): UPPER_SNAKE_CASE
  - Example: `const STORAGE_KEY = 'rfp_app_selected_company_id';`
  - Example: `const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://localhost:8000';`
  - Example: `const MODEL = 'claude-sonnet-4-5-20250929';`
- Destructured values: camelCase, maintain property names from objects
  - Example: `const { selectedCompany, companies, selectCompany, loading } = useCompany();`

**Types:**
- Interfaces: PascalCase with `Type` suffix when describing component or context data
  - Example: `interface CompanyProfile { ... }`
  - Example: `interface CompanyContextType { ... }`
  - Example: `interface ComplianceEntry { ... }`
- Type aliases: PascalCase
- Database field names: snake_case (map from Supabase database)
  - Example: `company_name`, `cage_code`, `uei_number`, `completeness_score`

## Code Style

**Formatting:**
- Tool: No explicit formatter configured (eslint-config-next used, no `.prettierrc`)
- Spacing: 2 spaces for indentation (observed in files)
- Line length: No strict limit enforced
- String quotes: Single quotes for consistency (observed pattern in codebase)

**Linting:**
- Tool: ESLint 9 with Next.js core web vitals and TypeScript support
- Config: `eslint.config.mjs` (flat config format)
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Key ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

**TypeScript Configuration:**
- Strict mode: Enabled (`"strict": true`)
- Target: ES2017
- Module resolution: bundler
- JSX: react-jsx
- Path aliases: `@/*` maps to root directory `./`

## Import Organization

**Order:**
1. Third-party React/Next.js imports (`react`, `next/...`)
2. Third-party library imports (`@supabase/...`, `@anthropic-ai/...`, etc.)
3. Local imports with path aliases (`@/lib/...`, `@/app/...`)
4. Type imports as needed

**Examples from codebase:**
```typescript
// From app/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';
import Link from 'next/link';

// From app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { inngest } from '@/lib/inngest/client';
```

**Path Aliases:**
- Only alias used: `@/*` pointing to project root
- All local imports use `@/` prefix: `@/lib/...`, `@/app/...`

## Error Handling

**Patterns:**
- API routes: Try-catch wrapper around entire route handler
  - Log errors with `console.error()` including context-specific message
  - Return `NextResponse.json()` with `error` key and HTTP status code
  - Status codes: 400 for validation, 404 for not found, 500 for server errors, 503 for service unavailable

**Example pattern:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('X-Company-Id');
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected' },
        { status: 400 }
      );
    }
    // ... logic
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Context-specific fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- Client components: Try-catch in async functions, throw for state updates
  - Log errors with context: `console.error('Operation description:', error);`
  - Update component state with error object: `setResult({ error: 'Human-readable message' })`

**Example pattern:**
```typescript
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) throw new Error('Failed to fetch data');
  const data = await response.json();
  // ... process data
} catch (error) {
  console.error('Upload error:', error);
  setResult({ error: 'Upload failed' });
}
```

- Supabase operations: Check for `error` return value from destructured response
  - Pattern: `const { data, error } = await supabase.from(...)`
  - Check error and log immediately

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- `console.error()` - for error conditions with context
  - Format: `console.error('[Context] specific operation:', error);`
  - Example: `console.error('Capabilities fetch error:', error);`
- `console.log()` - for informational messages (observed in client.ts)
  - Example: `console.log('🔑 Initializing Anthropic client...');`
  - Emoji prefixes used for visual scanning: 🔑 (config), ✅ (success), ❌ (failure), 📄 (document), etc.
- `console.warn()` - for degradation warnings
  - Example: `console.warn('⚠️ Using raw file content as fallback - AI may not process it correctly');`

**When to log:**
- Errors: Always log the error object
- Significant operations: Log start of long operations (PDF extraction, proposal generation)
- Fallback behavior: Log when using alternative code paths
- Client-side: Minimal logging to console for debugging

## Comments

**When to Comment:**
- Above complex logic or non-obvious algorithms
- JSDoc blocks for exported functions and interfaces
- Inline comments for "why" not "what" (code already shows what)
- React component layout comments for major sections (observed in CompanySelector.tsx)

**JSDoc/TSDoc:**
- Used for public API functions and utilities
- Format: Multi-line /** */ blocks
- Include purpose, parameters (if complex), return value
- Example from `lib/api-helpers.ts`:
  ```typescript
  /**
   * Extracts the company_id from request headers
   * Returns the company_id or throws an error response
   */
  export function getCompanyIdFromRequest(request: NextRequest): string
  ```

- Framework Part references in JSDoc for context
  - Example: `/** Compliance Matrix Generator (Framework Part 2.3) */`

**Inline Comments:**
- Used sparingly for non-obvious business logic
- Explain intent, not implementation
- Example: `// If company not found in list, clear selection`

## Function Design

**Size:** No strict size limits observed, but functions tend to be:
- Page components: 150-200 lines (including JSX)
- API handlers: 50-100 lines per method
- Utility functions: 20-80 lines
- Business logic generators: 100-250+ lines (complex operations)

**Parameters:**
- API handlers: Receive `NextRequest` object
- Components: Destructure props inline or use `{ children }` pattern
- Helper functions: Pass data objects rather than multiple primitives
- Avoid optional parameters; use defaults in function body

**Return Values:**
- API handlers: Always return `NextResponse.json()` or throw
- Components: Return JSX
- Utilities: Return typed data or Promise-wrapped data
- Async operations: Return Promise with explicit type annotation

## Module Design

**Exports:**
- Default export for page components: `export default function Page() {}`
- Named exports for utilities and contexts: `export function helper() {}`, `export const anthropic = ...`
- Context exports both Provider and hook: `export function CompanyProvider() {}` and `export function useCompany() {}`

**Barrel Files:**
- Not observed in codebase; each file imported individually
- Example: `import { useCompany } from '@/lib/context/CompanyContext'` (direct import)

**File Organization:**
- One component per file
- One context per file (Provider + hook in same file)
- Utility/helper functions grouped by domain (all database helpers in one file, all generation helpers in another)
- API routes follow Next.js convention: one route handler per `route.ts` file

## Client vs Server Code

**'use client' directive:**
- Applied to components that use browser APIs or React hooks (useState, useRef, useContext, useEffect)
- Example files: `app/page.tsx`, `app/components/CompanySelector.tsx`, `app/components/AppHeader.tsx`
- Server components (no directive): API routes and layout files unless they use hooks

**Server Client Pattern:**
- Supabase client initialized with `getServerClient()` in server-side code
- Returns authenticated client for API route handlers

## Tailwind CSS Usage

**Pattern:** Inline class strings using className attribute
- Example: `className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-300 rounded-lg"`
- Responsive prefixes: `sm:`, `md:`, `lg:` used for breakpoints
- State prefixes: `hover:`, `focus:`, `disabled:` used for interactive states
- Dynamic classes: Conditional className strings using template literals
  - Example: `` className={`w-full px-4 py-3 text-left ... ${selectedCompany?.id === company.id ? 'bg-blue-50' : ''}`} ``

---

*Convention analysis: 2026-02-01*
