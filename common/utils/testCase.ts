import type { TestDetails } from '@playwright/test';

// Test case metadata shown in the Test Execution Report
export interface TestCaseMeta {
  id: string;                              // e.g. 'TC-FASSBAYAR-001', 'TC-APH-001'
  module: string;                          // groups rows in "Coverage by module"
  priority: 'High' | 'Medium' | 'Low';
}

// Attach report metadata to a test:
//   test('Title', testCase({ id, module, priority }), async (...) => { ... })
export function testCase(meta: TestCaseMeta): TestDetails {
  return {
    annotation: [
      { type: 'id', description: meta.id },
      { type: 'module', description: meta.module },
      { type: 'priority', description: meta.priority }
    ]
  };
}
