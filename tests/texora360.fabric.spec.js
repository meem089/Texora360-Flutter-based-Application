import path from 'path';
import { test, expect } from '@playwright/test';

const STYLE_ID = 1;
const TRIM_IMAGE = 'stitching-trim.jpg'; // inside tests/test-image

test.use({ actionTimeout: 20000 });

test('Stitching Trim: add trim with valid data (positive)', async ({ page }) => {
  test.setTimeout(300000);

  // Force the app to use a normal <input type="file">, which Playwright can fill
  await page.addInitScript(() => {
    delete window.showOpenFilePicker;
  });

  // Fill the file chooser whenever it opens (at any time during the test)
  let imageSelected = false;
  page.on('filechooser', async (chooser) => {
    await chooser.setFiles(path.resolve('tests', 'test-image', TRIM_IMAGE));
    imageSelected = true;
  });

  await page.goto('/');
  await page.locator('flt-semantics-placeholder').waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelector('flt-semantics-placeholder')?.click();
  });

  // Login
  const emailInput = page
    .locator('input[aria-label="Email"]')
    .or(page.locator('flt-semantics input').first())
    .first();
  try {
    await emailInput.waitFor({ state: 'attached', timeout: 6000 });
  } catch {
    await page.keyboard.press('Tab');
    await emailInput.waitFor({ state: 'attached', timeout: 7000 });
  }
  await emailInput.fill('meem@alistlimited.com');
  await emailInput.press('Tab');

  const passwordInput = page
    .locator('input[aria-label="Password"]')
    .or(page.locator('flt-semantics input').nth(1))
    .first();
  await passwordInput.waitFor({ state: 'attached', timeout: 20000 });
  await passwordInput.fill('');
  await passwordInput.pressSequentially('123456', { delay: 50 });

  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });

  // Go to the Style Cost Sheet page
  await page.evaluate((id) => {
    window.location.hash = `#/cost_details/${id}/all_cs`;
  }, STYLE_ID);

  const trimGroup = page.getByRole('group', { name: /^Stitching Trim\b/ }).first();
  await trimGroup.waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(2000);

  const itemName = `Button ${String(Date.now()).slice(-5)}`;

  // Helpers
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const labelNode = (fieldName) =>
    page.locator('flt-semantics').filter({
      hasText: new RegExp(`^${escapeRegex(fieldName)}$`),
    }).last();

  // The text field that sits just below the label on screen
  const inputByLabel = async (fieldName) => {
    const label = labelNode(fieldName);
    await label.waitFor({ state: 'attached', timeout: 15000 });
    const labelBox = await label.boundingBox();
    const inputs = page.locator('input[data-semantics-role="text-field"]');

    let bestInput = null;
    let bestDistance = Infinity;
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();
      if (!box) continue;
      const horizontalDifference = Math.abs(box.x - labelBox.x);
      const verticalDifference = box.y - (labelBox.y + labelBox.height);
      if (
        horizontalDifference < 50 &&
        verticalDifference >= -8 &&
        verticalDifference < 65 &&
        verticalDifference < bestDistance
      ) {
        bestInput = input;
        bestDistance = verticalDifference;
      }
    }
    if (!bestInput) {
      throw new Error(`Input not found for: ${fieldName}`);
    }
    return bestInput;
  };

  const typeInto = async (fieldName, value) => {
    const input = await inputByLabel(fieldName);
    const text = String(value);
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await input.fill(text);
    await expect(input).toHaveValue(text, { timeout: 5000 });
  };

  const selectDropdown = async (fieldName, optionText) => {
    await page
      .getByRole('group', { name: new RegExp(`^${escapeRegex(fieldName)}\\s*\\*?$`) })
      .last()
      .click({ force: true });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: optionText, exact: true }).last().click({ force: true });
  };

  // Click the + icon (the only button in the section header)
  const headerButton = trimGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])[1]'
  );
  await headerButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const buttonBox = await headerButton.boundingBox();
  const centerX = buttonBox.x + buttonBox.width / 2;
  const centerY = buttonBox.y + buttonBox.height / 2;
  const candidates =
    buttonBox.width < 100 && centerX < 640
      ? [[centerX, centerY]]
      : [[161, centerY], [156, centerY], [166, centerY]];

  let opened = false;
  for (const [x, y] of candidates) {
    await page.mouse.click(x, y);
    try {
      await labelNode('Description').waitFor({ state: 'attached', timeout: 4000 });
      opened = true;
      break;
    } catch {
      // try the next position
    }
  }
  expect(opened, 'Add Stitching Trim form did not open.').toBeTruthy();

  // Fill the form
  await typeInto('Item', itemName);
  await typeInto('Description', 'Metal button 20L');
  await selectDropdown('Source', 'Nominated');
  await typeInto('GSM', '100');
  await typeInto('Consumption', '1.2');
  await typeInto('Price', '0.5');
  await typeInto('Wastage(%)', '5');
  await selectDropdown('UM', 'Yard');

  // Upload the image: click the smallest button that covers the "Upload Images" label
  const uploadLabel = labelNode('Upload Images');
  const uploadBox = await uploadLabel.boundingBox();
  const labelCenterX = uploadBox.x + uploadBox.width / 2;
  const labelCenterY = uploadBox.y + uploadBox.height / 2;

  const buttons = page.locator('flt-semantics[role="button"]');
  let uploadButton = null;
  let smallestArea = Infinity;
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    const box = await button.boundingBox();
    if (!box) continue;
    const containsLabel =
      labelCenterX >= box.x &&
      labelCenterX <= box.x + box.width &&
      labelCenterY >= box.y &&
      labelCenterY <= box.y + box.height;
    if (containsLabel && box.width * box.height < smallestArea) {
      smallestArea = box.width * box.height;
      uploadButton = button;
    }
  }
  if (!uploadButton) {
    uploadButton = uploadLabel.locator('xpath=preceding::flt-semantics[@role="button"][1]');
  }

  await uploadButton.click({ force: true });
  await expect.poll(() => imageSelected, { timeout: 30000 }).toBe(true);
  await page.waitForTimeout(3000);

  // Submit
  await page.getByRole('button', { name: 'Add New', exact: true }).last().click();

  // Report a validation error from the app, if any
  const alert = page.getByRole('alertdialog');
  if ((await alert.count()) > 0 && (await alert.first().isVisible())) {
    throw new Error(`fabric was not saved: ${await alert.first().innerText()}`);
  }

  // Verify the saved item
  await expect(page.getByText(itemName, { exact: false }).first()).toBeAttached({ timeout: 20000 });
});