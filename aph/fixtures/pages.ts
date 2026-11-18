import { test as base, expect } from '../../common/fixtures/base';

// APH-only page fixtures: screens that exist only on Aeon Payment Hub.
// (Shared pages - loginPage, consolePage, homePage - come from common.)
// APH tests: import { test, expect } from '../fixtures/pages'
//
// Add one like this:
//   import { SomeAphPage } from '../pages/SomeAphPage';
//   type AphPages = { someAphPage: SomeAphPage };
//   someAphPage: async ({ page }, use) => { await use(new SomeAphPage(page)); },

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type AphPages = {};

export const test = base.extend<AphPages>({});

export { expect };
