import { test as base, expect } from '../../common/fixtures/base';

// Fassbayar-only page fixtures: screens that exist only on Fassbayar.
// (Shared pages - loginPage, consolePage, homePage - come from common.)
// Fassbayar tests: import { test, expect } from '../fixtures/pages'
//
// Add one like this:
//   import { SomeFassbayarPage } from '../pages/SomeFassbayarPage';
//   type FassbayarPages = { someFassbayarPage: SomeFassbayarPage };
//   someFassbayarPage: async ({ page }, use) => { await use(new SomeFassbayarPage(page)); },

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type FassbayarPages = {};

export const test = base.extend<FassbayarPages>({});

export { expect };
