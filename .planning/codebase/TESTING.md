# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Runner:**
- Not detected - No test framework configured
- No jest.config.ts, vitest.config.ts, or testing library dependencies in package.json
- No test files in source directories (only node_modules contain tests from dependencies)

**Assertion Library:**
- Not detected - No testing framework installed

**Run Commands:**
- No test scripts in package.json
- Available scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`

## Test File Organization

**Location:**
- No test files present in codebase
- Test files would typically follow Next.js convention:
  - Co-located: `lib/utils.test.ts` next to `lib/utils.ts`
  - Or separate: `__tests__/` directories (pattern not yet established)

**Naming:**
- Not established - Recommended pattern would be `*.test.ts` or `*.spec.ts`

**Structure:**
- To be determined on test implementation

## Test Structure

**Suite Organization:**
- Not established in codebase

**Patterns:**
- Not established - Would require implementing test framework first

## Mocking

**Framework:**
- Not currently in use

**Patterns:**
- Would require test framework implementation

**What to Mock:**
- To be determined during test implementation

**What NOT to Mock:**
- To be determined during test implementation

## Fixtures and Factories

**Test Data:**
- Not established

**Location:**
- To be determined on test implementation

## Coverage

**Requirements:**
- Not enforced - No coverage targets specified

**View Coverage:**
- Not configured

## Test Types

**Unit Tests:**
- Not implemented
- Recommended for: utility functions, generation functions, formatting functions
- Examples of candidates:
  - `lib/utils.ts` - cn() utility function
  - `lib/generation/pipeline/content-condenser.ts` - content condensing logic
  - `lib/generation/quality/validation.ts` - validation rules
  - `lib/api-helpers.ts` - request header extraction

**Integration Tests:**
- Not implemented
- Recommended for:
  - API routes with database interactions
  - Inngest function workflows (stage0, stage1, stage2)
  - Company context provider with localStorage

**E2E Tests:**
- Not configured
- No test runner for E2E scenarios

## Current Testing Approach

**Manual Testing:**
- Console logging used for debugging (emoji-prefixed logs)
- Error handling in place but not covered by automated tests
- Inngest provides workflow monitoring via dashboard

**Database Testing:**
- Supabase operations directly tested via live database
- No mock database layer
- No transaction rollback for test isolation

## Development Testing Practices Observed

**Error Path Verification:**
- Functions throw descriptive errors: `throw new Error('Document not found...')`
- API routes return proper HTTP status codes for validation
- Try-catch blocks in place for critical operations

**Type Safety:**
- TypeScript strict mode enabled: provides compile-time verification
- Interfaces and types well-defined (lib/supabase/types.ts, lib/supabase/company-types.ts)
- Type checking catches many potential bugs before runtime

**Browser DevTools:**
- React DevTools for component debugging (CompanyContext provider)
- Network tab for API testing (request/response verification)
- Console for emoji-prefixed debug logs

## Recommended Testing Implementation Path

**Phase 1: Unit Tests**
- Framework: Vitest (lightweight, Vite-native, fast)
- Files to test first:
  - `lib/utils.ts` (basic utility)
  - `lib/api-helpers.ts` (request handling)
  - `lib/generation/pipeline/content-condenser.ts` (complex logic)

**Phase 2: Component Tests**
- Add: @testing-library/react, @testing-library/user-event
- Test components:
  - `app/components/CompanySelector.tsx` (user interactions)
  - `app/components/DocumentProgress.tsx` (state updates)
  - `lib/context/CompanyContext.tsx` (context provider)

**Phase 3: Integration Tests**
- Test API routes with mocked Supabase
- Add: @supabase/ssr mocking support
- Focus on:
  - `app/api/generate-proposal/route.ts`
  - `app/api/company/*/route.ts` handlers
  - Authentication flows

**Phase 4: E2E Tests**
- Framework: Playwright or Cypress
- Test complete workflows:
  - Document upload → analysis → proposal generation
  - Company profile creation → document management

---

*Testing analysis: 2026-02-23*

## Note on Test Absence

This codebase prioritizes development velocity and manual testing currently. No automated test infrastructure exists. This represents **technical debt** that should be addressed as codebase complexity grows, particularly for:
- API route reliability (document processing, company management)
- Generation pipeline correctness (proposal volume generation)
- Component state management (company selection, progress tracking)

See CONCERNS.md for test coverage gaps.
