import type { TestDetails } from '@playwright/test';

// Test categories (since 20 Nov 2026). A test can be in more than one.
// Every test is always in "Full" (a run with no --grep), so Full is not a tag.
//   suite: ['smoke']  ->  Playwright tag @smoke  ->  npx playwright test --grep "@smoke"
// The report shows them in its "Category" column (common/reporters/executionReport.ts).
export const SUITES = ['smoke'] as const;  // next: 'regression'
export type SuiteName = typeof SUITES[number];

// Test case metadata shown in the Test Execution Report
export interface TestCaseMeta {
  id: string;                              // e.g. 'TC-APH-001'
  module: string;                          // groups rows in "Coverage by module"
  priority: 'High' | 'Medium' | 'Low';
  suite?: SuiteName[];                     // test categories, e.g. ['smoke']; none = Full only
  // What this test deliberately does NOT cover -> "Open Gaps / Limitations"
  gaps?: { description: string; impact: string }[];
  // What must be tested by hand instead -> "Human Action Required"
  manual?: { title: string; reason: string; handling: string }[];
}

// Attach report metadata to a test:
//   test('Title', testCase({ id, module, priority }), async (...) => { ... })
// The report builds its Human Action / Gaps tables from gaps + manual and
// from what happens in the run (common/reporters/reportNotes.ts).
export function testCase(meta: TestCaseMeta): TestDetails {
  return {
    tag: (meta.suite ?? []).map((s) => `@${s}`),
    annotation: [
      { type: 'id', description: meta.id },
      { type: 'module', description: meta.module },
      { type: 'priority', description: meta.priority },
      ...(meta.gaps ?? []).map((g) => ({ type: 'gap', description: JSON.stringify(g) })),
      ...(meta.manual ?? []).map((m) => ({ type: 'human-action', description: JSON.stringify(m) }))
    ]
  };
}
