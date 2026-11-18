// READ-ONLY: list the Add a Company fields and what each Service Provider
// (host) offers. Nothing is submitted. See common/explore/addCompanyProbe.ts
//   npm run explore:fassbayar -- explore/fassbayar/addCompanyProbe.spec.ts
import { test } from '@playwright/test';
import * as path from 'node:path';
import { Credentials } from '../../common/config/testConfig';
import { probeAddCompany } from '../../common/explore/addCompanyProbe';

test('probe Add a Company form (FassBayar, read-only)', async ({ page }) => {
  await probeAddCompany(page, {
    portal: 'fassbayar', username: Credentials.username, password: Credentials.password,
    outDir: path.join(__dirname, '..', 'explore-dumps')
  });
});
