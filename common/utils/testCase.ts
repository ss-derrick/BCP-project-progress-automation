import type { TestDetails } from '@playwright/test';

// Test case metadata shown in the Test Execution Report
export interface TestCaseMeta {
  id: string;                              // e.g. 'TC-APH-001'
  module: string;                          // groups rows in "Coverage by module"
  priority: 'High' | 'Medium' | 'Low';
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
    annotation: [
      { type: 'id', description: meta.id },
      { type: 'module', description: meta.module },
      { type: 'priority', description: meta.priority },
      ...(meta.gaps ?? []).map((g) => ({ type: 'gap', description: JSON.stringify(g) })),
      ...(meta.manual ?? []).map((m) => ({ type: 'human-action', description: JSON.stringify(m) }))
    ]
  };
}
