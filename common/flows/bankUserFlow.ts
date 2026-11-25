import { expect, type Locator } from '@playwright/test';
import type { AdministratorPage } from '../pages/AdministratorPage';
import { stopBeforeSaving } from '../utils/uatChanges';

// Administrator > Manage Bank Users: find a bank user and suspend / reinstate it.
// Shared by Administrator (bankUsers.spec.ts: ADM-006, ADM-018) and Login (auth.spec.ts: AUTH-006 lockout).

// The Manage Bank Users row of one user (searched by User ID)
export async function bankUserRow(admin: AdministratorPage, user: string): Promise<Locator> {
  await admin.openQuicklink('Manage Bank Users');
  await admin.search(user);
  return admin.rows.filter({ has: admin.page.locator('td:first-child', { hasText: new RegExp(`^\\s*${user}\\s*$`, 'i') }) }).first();
}

// Status column of a bank user ('Active', 'Suspended', ...)
export async function bankUserStatus(admin: AdministratorPage, user: string): Promise<string> {
  const row = await bankUserRow(admin, user);
  return (await row.count()) ? (await row.locator('td').nth(2).innerText()).trim() : '';
}

// Suspend (reason Others) or Reinstate a bank user; Submit saves at once. Checks the new status.
export async function setBankUserAccess(admin: AdministratorPage, user: string, action: 'Suspend' | 'Reinstate', remarks: string): Promise<void> {
  await admin.quicklinkGo(await bankUserRow(admin, user), `${action} Bank User Access`);
  if (action === 'Suspend') await admin.fill({ reason: 'Others' });
  await admin.fillCounted('description', remarks);
  await admin.captureStep(`${action} form for ${user} filled, before Submit`);
  await stopBeforeSaving(admin, `${action} Submit for ${user} (Submit saves at once)`);
  await admin.button('Submit').click();
  await admin.page.waitForLoadState('load');
  await admin.captureStep(`After ${action} Submit for ${user}`);
  const row = await bankUserRow(admin, user);
  await admin.captureStep(`Manage Bank Users: ${user} status after ${action}`);
  await expect(row.locator('td').nth(2)).toHaveText(action === 'Suspend' ? 'Suspended' : 'Active');
}
