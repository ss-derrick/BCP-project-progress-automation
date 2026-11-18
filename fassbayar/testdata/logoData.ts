import fs from 'node:fs';
import path from 'node:path';
import { test, Browser } from '@playwright/test';
import { pick, randInt, uniqueTag } from '../../common/utils/random';

// Company logo for "Upload Company Logo".
// By default a NEW random PNG is generated on every run (400x180, the size
// the page recommends), so nobody needs an image file to run the test.
// To upload your own image instead (JPEG or PNG):
//   $env:LOGO_FILE='C:\Users\me\Pictures\logo.png'; npx playwright test tests/uploadCompanyLogo.spec.ts

export interface LogoFile {
  path: string;
  fileName: string;
  label: string;          // text drawn on a generated logo ('' for LOGO_FILE)
}

export const LogoSize = { width: 400, height: 180 } as const;

const COLORS = ['#1b7f5a', '#14477a', '#7a1450', '#a35a00', '#2e5e1e', '#5a2ea3', '#0f6f7f', '#8a1f1f'];

export async function createLogo(browser: Browser): Promise<LogoFile> {
  const own = process.env.LOGO_FILE;
  if (own) {
    if (!fs.existsSync(own)) throw new Error(`LOGO_FILE not found: ${own}`);
    if (!/\.(png|jpe?g)$/i.test(own)) throw new Error(`LOGO_FILE must be a JPEG or PNG: ${own}`);
    return { path: own, fileName: path.basename(own), label: '' };
  }

  const tag = uniqueTag().toUpperCase();
  const label = `QA ${tag}`;
  const [from, to] = [pick(COLORS), pick(COLORS)];
  const fileName = `logo-${tag}.png`;
  const file = test.info().outputPath(fileName);

  // Draw the logo in a throw-away page (own context: does not touch the portal session)
  const page = await browser.newPage({ viewport: { width: LogoSize.width, height: LogoSize.height } });
  try {
    await page.setContent(`
      <div id="logo" style="width:${LogoSize.width}px;height:${LogoSize.height}px;display:flex;
        flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;
        color:#fff;background:linear-gradient(${randInt(0, 360)}deg,${from},${to})">
        <div style="font-size:44px;font-weight:bold;letter-spacing:2px">${label}</div>
        <div style="font-size:16px;opacity:.85">automation test logo</div>
      </div>`);
    await page.locator('#logo').screenshot({ path: file });
  } finally {
    await page.close();
  }

  return { path: file, fileName, label };
}
