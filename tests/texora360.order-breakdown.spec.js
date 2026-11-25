import path from 'path';
import { test, expect } from '@playwright/test';

// Style ID used in the URL: #/cost_details/<STYLE_ID>/all_cs
const STYLE_ID = 1;

// Image file name inside tests/test-image
const PO_SHEET_IMAGE = 'po-sheet.png';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

test.use({ actionTimeout: 20000 });

test('Order Breakdown: add PO with valid data (positive)', async ({ page }) => {
  test.setTimeout(300000);

  // ---------- 1. Open the app and enable Flutter accessibility ----------
  await page.goto('/');
  await page
    .locator('flt-semantics-placeholder')
    .waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelector('flt-semantics-placeholder')?.click();
  });

  // ---------- 2. Login ----------
  const emailInput = page
    .locator('input[aria-label="Email"]')
    .or(page.locator('flt-semantics input').first())
    .first();
  try {
    await emailInput.waitFor({ state: 'attached', timeout: 8000 });
  } catch {
    // Flutter creates the text inputs only after the first focus
    await page.keyboard.press('Tab');
    await emailInput.waitFor({ state: 'attached', timeout: 15000 });
  }
  await emailInput.focus();
  await emailInput.fill('meem@alistlimited.com');
  await emailInput.press('Tab');
  await page.waitForTimeout(200);

  const passwordInput = page
    .locator('input[aria-label="Password"]')
    .or(page.locator('flt-semantics input').nth(1))
    .first();
  await passwordInput.waitFor({ state: 'attached', timeout: 20000 });
  await passwordInput.focus();
  await passwordInput.fill('');
  await passwordInput.pressSequentially('123456', { delay: 50 });

  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 60000 });

  // ---------- 3. Go directly to the Style Cost Sheet page ----------
  await page.evaluate((id) => {
    window.location.hash = `#/cost_details/${id}/all_cs`;
  }, STYLE_ID);

  const orderGroup = page.getByRole('group', { name: 'Order Breakdown', exact: true });
  await orderGroup.waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(2000);

  // ---------- 4. Random positive test data ----------
  const poNumber = `PO-${Date.now()}`;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pcdDay = Math.floor(Math.random() * 27) + 1; 
  const shipDay = pcdDay + 1;                         

  // ---------- 5. Click the + icon to open the Add Order Breakdown form ----------
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).first();

  const headerButtons = orderGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])'
  );
  const smallIdx = await headerButtons.evaluateAll((els) =>
    els
      .slice(0, 3)
      .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.width < 70 && x.r.height < 70)
      .map((x) => x.i)
  );
  await headerButtons.nth(smallIdx.length > 0 ? smallIdx[0] : 0).click({ force: true });
  await expect(dialog).toBeAttached({ timeout: 10000 });

  const dialogButtons = dialog.locator('flt-semantics[role="button"]');
  const inputByLabel = (label) =>
    dialog
      .locator('flt-semantics', { hasText: new RegExp(`^${label}$`) })
      .first()
      .locator('xpath=following::input[1]');

  const typeInto = async (label, value) => {
    const input = inputByLabel(label);
    await input.focus();
    await input.fill('');
    await input.pressSequentially(String(value), { delay: 30 });
  };

  const calendarButtonFor = async (label) => {
    const box = await inputByLabel(label).boundingBox();
    const n = await dialogButtons.count();
    let bestIdx = -1;
    let bestDist = Infinity;
    if (box) {
      for (let i = 0; i < n; i++) {
        const b = await dialogButtons.nth(i).boundingBox();
        if (!b || b.width > 80) continue; // upload buttons are wide, calendar icons are small
        const cy = b.y + b.height / 2;
        if (cy < box.y - 15 || cy > box.y + box.height + 15) continue; // must be on the same line
        const dist = Math.abs(b.x + b.width / 2 - (box.x + box.width));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }
    return bestIdx >= 0
      ? dialogButtons.nth(bestIdx)
      : inputByLabel(label).locator('xpath=following::flt-semantics[@role="button"][1]');
  };

  const pickDate = async (label, y, m, d) => {
    const calendarBtn = await calendarButtonFor(label);
    await calendarBtn.click({ force: true });
    await page
      .getByRole('button', { name: new RegExp(`${MONTHS[m - 1]} ${d}, ${y}`) })
      .click();
    await page.getByRole('button', { name: 'OK' }).click();
  };

  // Upload button: the smallest button that covers the label's position
  const uploadButtonFor = async (text) => {
    const label = dialog
      .locator('flt-semantics', { hasText: new RegExp(`^${text}$`) })
      .first();
    const lb = await label.boundingBox();
    const n = await dialogButtons.count();
    let bestIdx = -1;
    let bestArea = Infinity;
    if (lb) {
      const cx = lb.x + lb.width / 2;
      const cy = lb.y + lb.height / 2;
      for (let i = 0; i < n; i++) {
        const b = await dialogButtons.nth(i).boundingBox();
        if (!b) continue;
        if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
          const area = b.width * b.height;
          if (area < bestArea) {
            bestArea = area;
            bestIdx = i;
          }
        }
      }
    }
    return bestIdx >= 0
      ? dialogButtons.nth(bestIdx)
      : label.locator('xpath=preceding::flt-semantics[@role="button"][1]');
  };

  // ---------- 6. Fill the form ----------
  await typeInto('PO', poNumber);
  await typeInto('Colors', 'Red');
  await typeInto('Qty', '100');
  await pickDate('PCD Date', year, month, pcdDay);
  await pickDate('Shipment Date', year, month, shipDay);

  // Upload the PO sheet image
  const poSheetBtn = await uploadButtonFor('PO Sheet');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    poSheetBtn.click({ force: true }),
  ]);
  await fileChooser.setFiles(path.resolve('tests', 'test-image', PO_SHEET_IMAGE));
  await page.waitForTimeout(6000);

  // ---------- 7. Submit ----------
  await dialog.getByRole('button', { name: 'Submit' }).click();

  // ---------- 8. Verify the new PO row appears in the table ----------
  await expect(
    page.locator('flt-semantics', { hasText: poNumber }).first()
  ).toBeAttached({ timeout: 15000 });
});