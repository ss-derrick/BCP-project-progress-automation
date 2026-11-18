// READ-ONLY: list the Add a Parent Company fields. Nothing is submitted.
// See common/explore/addCompanyProbe.ts
import { test } from '@playwright/test';
import * as path from 'node:path';
import { Credentials } from '../../common/config/testConfig';
import { probeAddCompany } from '../../common/explore/addCompanyProbe';

test('probe Add a Parent Company form (FassBayar, read-only)', async ({ page }) => {
  await probeAddCompany(page, {
    portal: 'fassbayar', username: Credentials.username, password: Credentials.password,
    outDir: path.join(__dirname, '..', 'explore-dumps'),
    path: '/company/registerMasterMerchant', name: 'add-parent-company'
  });
});
