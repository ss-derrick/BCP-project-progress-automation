import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Timeouts } from '../../portals.config';

// Portal home (/console) + top menu
export class HomePage extends BasePage {
  readonly allCompaniesMenu = this.page.locator('a[href="/company"]').first();
  readonly addCompanyLink = this.page.locator('a[href="/company/register"]');

  // Top menu "All Companies" (Company Summary list)
  async openAllCompanies(): Promise<void> {
    await this.allCompaniesMenu.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.failIfLoggedOut();
  }

  // Top menu "All Companies" > "Add a Company"
  async openAddCompany(): Promise<void> {
    await this.allCompaniesMenu.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.failIfLoggedOut();
    await this.pause();
    await this.addCompanyLink.filter({ visible: true }).first().click();
    await this.page.waitForURL(/\/company\/register/, { timeout: Timeouts.pageLoad });
    await expect(this.page.locator('#businessName')).toBeVisible();
    await this.captureScreen('Add a Company - empty form');
  }

  // ---------- Home (/console): header, Quicklinks panel, Daily Transaction Snapshot ----------
  readonly header = this.page.locator('.loginInfo').first();          // greeting, clock, last login
  readonly lastLogin = this.page.locator('#lastLogin');
  readonly topMenuLinks = this.page.locator('#topNavi a');
  readonly panelBoxes = this.page.locator('.quicklinkBox');           // title in .top, links in .mid2L
  readonly snapshot = this.page.locator('#dailyTxnBar');              // Fassbayar only
  readonly snapshotAsOf = this.page.locator('#dailyTxnBar .asOfDateTime');
  readonly snapshotTotal = this.page.locator('#dailyTxnBar .dailyTotalAmount');
  readonly snapshotLegend = this.page.locator('#dailyTxnBar .legendTitle');
  readonly snapshotChart = this.page.locator('#sparkline canvas');
  readonly snapshotViewDetails = this.page.locator('#dailyTxnBar a').filter({ hasText: /^\s*View Details\s*$/ });

  async openHome(): Promise<void> {
    await this.page.goto('/console');
    await this.page.waitForLoadState('load');
    await this.failIfLoggedOut();
    await this.captureStep('Home');
  }

  // Quicklinks panel as shown: [{ title, links: [{ text, href }] }]
  async panels(): Promise<{ title: string; links: { text: string; href: string }[] }[]> {
    return this.panelBoxes.evaluateAll((boxes) => boxes.map((b) => ({
      // first block of the box = its title; innerText keeps the line break of a two-line title as a space
      title: ((b.firstElementChild as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      links: Array.from(b.querySelectorAll('a')).map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') ?? '' }))
    })));
  }

  // Snapshot slice amounts as the page holds them (the chart's sliceLabels: Settled, Unsettled, Voided)
  async snapshotAmounts(): Promise<Record<'Settled' | 'Unsettled' | 'Voided', number>> {
    const labels = await this.page.evaluate(() => {
      const js = Array.from(document.scripts).map((s) => s.textContent ?? '').find((t) => /sliceLabels|sparkline\(/.test(t)) ?? '';
      const m = js.match(/sliceLabels\s*=\s*\[([^\]]*)\]/) ?? js.match(/sparkline\(\s*\[([^\]]*)\]/);
      return m ? m[1].split(',').map((x) => x.replace(/['"\s]/g, '')) : [];
    });
    const n = (v: string | undefined) => Number((v ?? '').replace(/,/g, '')) || 0;
    return { Settled: n(labels[0]), Unsettled: n(labels[1]), Voided: n(labels[2]) };
  }

  // The portal allows one session per user: a login elsewhere (another
  // worker, a person using the same account) sends this one back to login.
  async failIfLoggedOut(): Promise<void> {
    expect(
      this.page.url(),
      'Session was logged out - the same user probably logged in elsewhere ' +
      '(another test worker or a person). Run with --workers=1.'
    ).not.toMatch(/\/auth\/login/);
  }
}
