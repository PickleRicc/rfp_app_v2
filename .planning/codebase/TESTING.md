# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Status:** Not configured

No test runner is currently configured in this project. The `package.json` contains no testing dependencies (Jest, Vitest, Cypress, Playwright, etc.).

**Recommendation:** For this Next.js application with complex business logic (proposal generation, document analysis, compliance matrix generation), implementing testing is critical. Suggested approach:
- **Unit/Integration tests:** Vitest (lighter than Jest, great ESM support)
- **E2E tests:** Playwright (modern, cross-browser)
- **Component testing:** Testing Library with Vitest

## Current State

**Test files:** Zero test files exist in the project
- No `*.test.ts` or `*.test.tsx` files in `app/`
- No `*.test.ts` or `*.test.tsx` files in `lib/`
- No test configuration files (`jest.config.js`, `vitest.config.js`, etc.)
- No test scripts in `package.json`

## Areas Requiring Test Coverage

The following areas have complex logic and currently zero test coverage:

### High Priority (Business-Critical)

**Document Analysis & Extraction:**
- Location: `app/api/upload/route.ts`
- Files: Handles PDF extraction via external service, fallback to raw text, document creation
- Tests needed: PDF service integration, error handling, fallback behavior, file type validation

**Compliance Matrix Generation:**
- Location: `lib/generation/compliance/matrix-generator.ts`
- Files: Complex Excel generation with requirement mapping, formatting, styling
- Tests needed: Matrix generation logic, requirement mapping, cell styling, error cases

**Proposal Generation:**
- Location: `app/api/generate-proposal/route.ts` and related proposal generation libs
- Files: Multi-volume document generation, content compilation, file output
- Tests needed: Volume generation, content assembly, template population, file format validation

**Company Context & State Management:**
- Location: `lib/context/CompanyContext.tsx`
- Tests needed: Provider initialization, company selection, localStorage persistence, context hooks

### Medium Priority

**API Route Handlers:**
- Multiple routes in `app/api/company/*/route.ts`
- Pattern: GET/POST/PUT/DELETE handlers with Supabase operations
- Tests needed: Company ID validation, request/response formatting, error handling, database interactions

**Content Generation:**
- Location: `lib/generation/content/`
- Files: boilerplate.ts, compliance-language.ts, cross-references.ts, win-themes.ts
- Tests needed: Content generation logic, template rendering, reference linking

**Utilities:**
- Location: `lib/` helper files
- Files: json-extractor.ts, page-estimator.ts, validation.ts
- Tests needed: Parsing logic, validation rules, page estimation algorithms

### Lower Priority

**UI Components:**
- Location: `app/components/`
- Files: AppHeader.tsx, CompanySelector.tsx, DocumentProgress.tsx
- Tests needed: Rendering, user interactions, state updates (once test framework is set up)

## Recommended Testing Strategy

### 1. Setup Phase

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @types/vitest
npm install -D playwright @playwright/test
```

### 2. Configuration Files

**vitest.config.ts** - Unit/integration testing
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**playwright.config.ts** - E2E testing
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### 3. Test Directory Structure

```
rfp_app_v2/
├── lib/
│   ├── anthropic/
│   │   ├── client.ts
│   │   └── __tests__/
│   │       └── json-extractor.test.ts
│   ├── generation/
│   │   ├── compliance/
│   │   │   ├── matrix-generator.ts
│   │   │   └── __tests__/
│   │   │       └── matrix-generator.test.ts
│   │   └── content/
│   │       └── __tests__/
│   │           └── boilerplate.test.ts
│   └── __tests__/
│       └── api-helpers.test.ts
├── app/
│   ├── api/
│   │   ├── upload/
│   │   │   ├── route.ts
│   │   │   └── __tests__/
│   │   │       └── route.test.ts
│   │   └── company/
│   │       └── __tests__/
│   │           └── handlers.test.ts
│   └── components/
│       ├── CompanySelector.tsx
│       └── __tests__/
│           └── CompanySelector.test.tsx
├── e2e/
│   ├── upload-rfp.spec.ts
│   ├── company-management.spec.ts
│   └── proposal-generation.spec.ts
```

## Mocking Strategy

**External Dependencies to Mock:**
- Supabase client: Use `vi.mock('@/lib/supabase/client')`
- Anthropic API: Use `vi.mock('@anthropic-ai/sdk')`
- File system operations: Mock fs for file upload tests
- External PDF service: Mock fetch calls to PDF_SERVICE_URL
- Inngest: Mock job queue triggers

**Example mocking pattern:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client');

describe('Company API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch companies successfully', async () => {
    const mockData = [
      { id: '1', company_name: 'Test Corp', cage_code: 'ABC123' }
    ];

    (getServerClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      })
    });

    // Test implementation
  });
});
```

**What to Mock:**
- External service calls (PDF service, Anthropic API, Supabase)
- File system operations
- Environment variables
- Async operations to test error paths

**What NOT to Mock:**
- Next.js built-ins (NextResponse, NextRequest) - test actual behavior
- Local utility functions - test with actual implementations
- Context providers in component tests - test with actual context
- Type/interface definitions

## Test File Organization

**File location:** Co-located in `__tests__/` subdirectory next to source files

**File naming:** `[source-name].test.ts` or `[source-name].test.tsx`

**Example structure:**

```typescript
// lib/generation/compliance/__tests__/matrix-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateComplianceMatrix } from '../matrix-generator';

describe('generateComplianceMatrix', () => {
  describe('matrix generation', () => {
    it('should generate compliance matrix with requirements', () => {
      // Test
    });

    it('should map requirements to volumes', () => {
      // Test
    });
  });

  describe('styling and formatting', () => {
    it('should apply header styles', () => {
      // Test
    });

    it('should color code status cells', () => {
      // Test
    });
  });

  describe('error handling', () => {
    it('should handle empty requirements', () => {
      // Test
    });
  });
});
```

## Test Structure Pattern

**Suite organization:**
- Group related tests using nested `describe()` blocks
- Use descriptive test names starting with "should"
- One assertion or logical group per test

**Setup and Teardown:**
- Use `beforeEach()` to reset mocks and state
- Use `afterEach()` if resources need cleanup
- Use `beforeAll()` for expensive setup (e.g., test database)

**Fixtures and Test Data:**

Create a `__tests__/fixtures/` directory for reusable test data:

```typescript
// lib/__tests__/fixtures/companies.ts
export const mockCompanyProfile = {
  id: '123',
  company_name: 'Acme Corporation',
  legal_name: 'Acme Corp Inc.',
  cage_code: 'ABC123',
  uei_number: 'UEI12345678',
  elevator_pitch: 'Leading provider of RFP solutions',
  completeness_score: 85
};

export const mockRequirements = [
  {
    requirement_number: 'REQ-1',
    source_section: 'Section 3.1',
    requirement_text: 'System must support multi-user access',
    compliance_status: 'Compliant'
  }
];
```

## Async Testing Pattern

```typescript
it('should handle async operations', async () => {
  const promise = fetchCompanies();

  expect(promise).resolves.toEqual(expectedData);
  // or
  await expect(promise).resolves.toEqual(expectedData);
});

it('should handle async errors', async () => {
  await expect(
    uploadFile(invalidFile)
  ).rejects.toThrow('Invalid file type');
});
```

## Error Testing Pattern

```typescript
it('should validate company ID header', async () => {
  const response = await POST(mockRequest);

  expect(response.status).toBe(400);
  const json = await response.json();
  expect(json.error).toContain('No company selected');
});

it('should return 500 on database error', async () => {
  mockSupabase.from.mockRejectedValue(new Error('Connection failed'));

  const response = await GET(mockRequest);

  expect(response.status).toBe(500);
  expect(response.json()).resolves.toEqual({
    error: 'Internal server error'
  });
});
```

## Coverage Goals

**Target coverage:** Aim for:
- **Critical business logic:** 100% (compliance matrix, proposal generation, document analysis)
- **API handlers:** 85%+ (both happy path and error cases)
- **Utilities:** 80%+
- **Components:** 70%+ (focus on interaction logic, less on presentation)
- **Overall:** 75%+

**View coverage:**
```bash
vitest run --coverage
```

## Recommended Test Priorities

### Phase 1 (Critical)
1. `lib/generation/compliance/matrix-generator.ts` - Business logic, no external deps
2. `lib/api-helpers.ts` - Small, isolated, high reuse
3. `app/api/upload/route.ts` - Core feature, complex error handling

### Phase 2 (High Value)
4. `lib/context/CompanyContext.tsx` - State management
5. `lib/generation/content/` files - Content generation logic
6. Company API endpoints (`app/api/company/*/route.ts`)

### Phase 3 (Medium)
7. Components with complex interaction logic
8. Document analysis and requirement parsing
9. Proposal volume generation

## CI/CD Integration

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run test:coverage
      - run: npm run test:e2e
```

---

*Testing analysis: 2026-02-01*

**Note:** This project currently has zero test infrastructure. Implementation should begin with Phase 1 critical tests before adding new features.
