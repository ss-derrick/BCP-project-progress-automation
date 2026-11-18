// READ-ONLY: list the Add a Company fields and what each Service Provider
// (host) offers. Nothing is submitted. See common/explore/addCompanyProbe.ts
//   npm run explore:aph -- explore/aph/addCompanyProbe.explore.ts
import { test } from '@playwright/test';
import * as path from 'node:path';
import { Credentials } from '../../common/config/testConfig';
import { probeAddCompany } from '../../common/explore/addCompanyProbe';

test('probe Add a Company form (APH, read-only)', async ({ page }) => {
  await probeAddCompany(page, {
    portal: 'aph', username: Credentials.username, password: Credentials.password,
    outDir: path.join(__dirname, '..', 'explore-dumps')
  });
});
