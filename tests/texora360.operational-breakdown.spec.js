import { test, expect } from '@playwright/test';

// Style ID used in the URL: #/cost_details/<STYLE_ID>/all_cs
const STYLE_ID = 1;

test.use({ actionTimeout: 20000 });

test('Operational Breakdown: add item with valid data (positive)', async ({ page }) => {
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

  const operationalGroup = page.getByRole('group', { name: 'Operational Breakdown' });
  await operationalGroup.waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(2000);

  // ---------- 4. Test data ----------
  const itemName = `Sleeve Attach ${String(Date.now()).slice(-6)}`;

  // ---------- 5. Click the + icon to open the Add Operational Breakdown form ----------
  // The + icon has no accessibility node, so it is clicked by position.
  // It is on the same row as the collapse arrow (the only button in the header)
  // and about 266px from the left edge of the section.
  const collapseArrow = operationalGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])[1]'
  );
  await collapseArrow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const groupBox = await operationalGroup.boundingBox();
  const arrowBox = await collapseArrow.boundingBox();
  await page.mouse.click(groupBox.x + 266, arrowBox.y + arrowBox.height / 2);

  // The form is detected by its first field label (the form has no dialog role)
  const labelNode = (label) =>
    page.locator('flt-semantics', { hasText: new RegExp(`^${label}$`) }).last();
  await expect(labelNode('ItemName')).toBeAttached({ timeout: 10000 });

  // ---------- Helpers ----------
  const inputByLabel = (label) => labelNode(label).locator('xpath=following::input[1]');

  const typeInto = async (label, value) => {
    const input = inputByLabel(label);
    await input.focus();
    await input.fill('');
    await input.pressSequentially(String(value), { delay: 30 });
  };

  // ---------- 6. Fill the form ----------
  await typeInto('ItemName', itemName);
  await typeInto('SMV', '1.5');
  await typeInto('Mc/Line', '10');

  // ---------- 7. Submit ----------
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  // ---------- 8. Verify the new item appears in the Operational Breakdown table ----------
  await expect(
    page.locator('flt-semantics', { hasText: itemName }).first()
  ).toBeAttached({ timeout: 15000 });
});