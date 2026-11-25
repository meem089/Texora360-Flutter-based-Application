import { test, expect } from '@playwright/test';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

test('Texora360 local - Merchandiser creates a new Style order', async ({ page }) => {
       test.setTimeout(180000);
  // ---------- 1. Open local app & enable Flutter accessibility ----------
  await page.goto('/');
  await page
    .locator('flt-semantics-placeholder')
    .waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelector('flt-semantics-placeholder')?.click();
  });

  // ---------- 2. Login ----------
  const emailLocator = page
    .locator('input[aria-label="Email"]')
    .or(page.locator('flt-semantics input').first())
    .first();
  try {
    await emailLocator.waitFor({ state: 'attached', timeout: 8000 });
  } catch {
    await page.keyboard.press('Tab');
    await emailLocator.waitFor({ state: 'attached', timeout: 15000 });
  }
  await emailLocator.focus();
  await emailLocator.fill('meem@alistlimited.com');

  await emailLocator.press('Tab');
  await page.waitForTimeout(200);
  const passwordLocator = page
    .locator('input[aria-label="Password"]')
    .or(page.locator('flt-semantics input').nth(1))
    .first();
  await passwordLocator.waitFor({ state: 'attached', timeout: 20000 });
  await passwordLocator.focus();
  await passwordLocator.fill('');
  await passwordLocator.pressSequentially('123456', { delay: 50 });

  await page.getByRole('button', { name: 'Login' }).click();
     await expect(page).toHaveURL(/#\/dashboard/, { timeout: 60000 });
  // ---------- 3. Open "Style Information" dialog ----------
     const newOrderBtn = page.getByRole('button', { name: 'New Order', exact: true });
   await newOrderBtn.waitFor({ state: 'attached', timeout: 60000 });
   await page.waitForTimeout(3000);
   await page.screenshot({ path: 'dashboard-debug.png' });
   await newOrderBtn.click({ force: true, timeout: 15000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeAttached();
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

  const selectDropdown = async (groupName, optionText) => {
    await dialog.getByRole('group', { name: groupName }).click();
    const option = page
      .getByRole('menuitem', { name: optionText, exact: true })
      .or(page.getByRole('option', { name: optionText, exact: true }))
      .or(page.getByRole('button', { name: optionText, exact: true }))
      .first();
    await option.click();
  };
  const pickDate = async (label, year, month, day) => {
    const calendarBtn = inputByLabel(label).locator(
      'xpath=following::flt-semantics[@role="button"][1]'
    );
    await calendarBtn.click();
    await page
      .getByRole('button', { name: new RegExp(`${MONTHS[month - 1]} ${day}, ${year}`) })
      .click();
    await page.getByRole('button', { name: 'OK' }).click();
  };

  // ---------- 4. Fill the form ----------
  await selectDropdown('Select Buyer', 'Test Buyer');

  await typeInto('Style', 's');
  await typeInto('Season', 's');
  await typeInto('Item Description', 'd');
  await typeInto('Planned Line', '3');

  await pickDate('PO Receive Date', 2026, 10, 13);
  await pickDate('PCD Date', 2026, 10, 8);
  await pickDate('Shipment Date', 2026, 10, 9);

  await typeInto('Additional Eff%', '4.4');
  await typeInto('Buying%', '5.8');
  await typeInto('Commercial%', '4.3');
  await typeInto('FOB', '33');
  await typeInto('Sales Contract Number', '444444');

  await selectDropdown('Pack', '1');
  await selectDropdown('Payment Terms','LC at Sight');

  // ---------- 5. Submit ----------
  await dialog.getByRole('button', { name: 'Add New' }).click();
// ---------- 6. Verify Style Cost Sheet opened with our data ----------
  await expect(page).toHaveURL(/#\/cost_details\/\d+\/dashboard/, {timeout: 15000 });
  for (const text of ['Test Buyer', 'LC at Sight', '444444']) {
    await expect(
      page.locator('flt-semantics', { hasText: text }).first()
    ).toBeAttached();
  }
});