import path from 'path';
import fs from 'fs';
import { test, expect } from '@playwright/test';

const STYLE_ID = 1;
const TRIM_IMAGE = 'stitching-trim.jpg';
const IMAGE_PATH = path.resolve('tests', 'test-image', TRIM_IMAGE);

test.use({ actionTimeout: 20000 });

test('Stitching Trim: add trim with valid data (positive)', async ({ page }) => {
  test.setTimeout(300000);

  // 1. Open app and enable Flutter accessibility
  await page.goto('/');

  await page.locator('flt-semantics-placeholder').waitFor({
    state: 'attached',
    timeout: 60000,
  });

  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.querySelector('flt-semantics-placeholder')?.click();
  });

  // 2. Login
  const email = page
    .locator('input[aria-label="Email"]')
    .or(page.locator('flt-semantics input').first())
    .first();

  try {
    await email.waitFor({ state: 'attached', timeout: 8000 });
  } catch {
    await page.keyboard.press('Tab');
    await email.waitFor({ state: 'attached', timeout: 15000 });
  }

  await email.focus();
  await email.fill('meem@alistlimited.com');
  await email.press('Tab');

  const password = page
    .locator('input[aria-label="Password"]')
    .or(page.locator('flt-semantics input').nth(1))
    .first();

  await password.waitFor({ state: 'attached', timeout: 20000 });
  await password.focus();
  await password.fill('');
  await password.pressSequentially('123456', { delay: 50 });

  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/dashboard/, {
    timeout: 60000,
  });

  // 3. Open Style Cost Sheet
  await page.evaluate((id) => {
    window.location.hash = `#/cost_details/${id}/all_cs`;
  }, STYLE_ID);

  const trimGroup = page
    .getByRole('group', { name: /^Stitching Trim\b/ })
    .first();

  await trimGroup.waitFor({
    state: 'attached',
    timeout: 60000,
  });

  await page.waitForTimeout(2000);

  // 4. Label helper
  const label = (text) => {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return page
      .locator('flt-semantics')
      .filter({
        hasText: new RegExp(`^\\s*${escaped}\\s*$`),
      })
      .last();
  };

  // Find the nearest input to a label using screen coordinates
  const inputFor = async (fieldName) => {
    const labelLocator = label(fieldName);

    await labelLocator.waitFor({
      state: 'attached',
      timeout: 15000,
    });

    const labelBox = await labelLocator.boundingBox();

    if (!labelBox) {
      throw new Error(`Label "${fieldName}" is not visible.`);
    }

    const centerX = labelBox.x + labelBox.width / 2;
    const centerY = labelBox.y + labelBox.height / 2;

    const inputs = page.locator(
      'input[data-semantics-role="text-field"], flt-semantics input'
    );

    let bestInput = null;
    let bestScore = Infinity;

    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();

      if (!box) continue;

      const inputCenterX = box.x + box.width / 2;
      const inputCenterY = box.y + box.height / 2;

      const dx = Math.abs(inputCenterX - centerX);
      const dy = Math.abs(inputCenterY - centerY);

      const score = dx + dy * 1.5;

      if (score < bestScore) {
        bestScore = score;
        bestInput = input;
      }
    }

    if (!bestInput) {
      throw new Error(`No visible input found for "${fieldName}".`);
    }

    return bestInput;
  };

  const typeInto = async (fieldName, value) => {
    const input = await inputFor(fieldName);

    await input.scrollIntoViewIfNeeded();
    await input.click({ force: true });
    await input.fill('');
    await input.pressSequentially(String(value), { delay: 30 });

    await expect(input).toHaveValue(String(value), {
      timeout: 10000,
    });

    console.log(`${fieldName}: ${value}`);
  };

  // 5. Dropdown helpers
  const closePopup = async () => {
    await page.waitForTimeout(400);

    const searchBox = page.getByRole('textbox', {
      name: 'Search...',
    });

    if (await searchBox.count()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  };

  const selectOption = async (name, options) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const dropdown = page
      .getByRole('group', {
        name: new RegExp(`^${escapedName}\\s*\\*?$`),
      })
      .last();

    await dropdown.waitFor({
      state: 'attached',
      timeout: 15000,
    });

    await dropdown.click({ force: true });
    await page.waitForTimeout(700);

    for (const option of options) {
      const optionButton = page
        .getByRole('button', {
          name: option,
          exact: true,
        })
        .last();

      if (await optionButton.count()) {
        await optionButton.click({ force: true });

        console.log(`${name}: ${option}`);

        await closePopup();
        return;
      }
    }

    throw new Error(`No matching option found in "${name}" dropdown.`);
  };

  // 6. Open Stitching Trim form
  const addButton = trimGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])[1]'
  );

  await addButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const addBox = await addButton.boundingBox();

  if (!addBox) {
    throw new Error('Could not locate the Stitching Trim add button.');
  }

  const addX =
    addBox.width < 100 && addBox.x < 640
      ? addBox.x + addBox.width / 2
      : 161;

  await page.mouse.click(addX, addBox.y + addBox.height / 2);

  await expect(label('Description')).toBeAttached({
    timeout: 15000,
  });

  // 7. Fill form fields
  const itemName = `Button ${String(Date.now()).slice(-6)}`;

  await typeInto('Item', itemName);
  await typeInto('Description', 'Metal button 20L');

  await selectOption('Source', ['Nominated', 'Non Nominated']);

  await typeInto('GSM', '100');
  await typeInto('Consumption', '1.2');
  await typeInto('Price', '0.5');

  // Wastage label is exactly "Wastage(%)" in the accessibility snapshot.
  // Locate the input directly below that label.
  const wastageLabel = page
    .locator('flt-semantics')
    .filter({ hasText: /^Wastage\(%\)$/ })
    .last();

  await wastageLabel.waitFor({
    state: 'attached',
    timeout: 15000,
  });

  const wastageBox = await wastageLabel.boundingBox();

  if (!wastageBox) {
    throw new Error('Wastage(%) label is not visible.');
  }

  const allInputs = page.locator(
    'input[data-semantics-role="text-field"], flt-semantics input'
  );

  let wastageInput = null;
  let closestDistance = Infinity;

  for (let i = 0; i < await allInputs.count(); i++) {
    const input = allInputs.nth(i);
    const box = await input.boundingBox();

    if (!box) continue;

    const inputCenterX = box.x + box.width / 2;
    const labelCenterX = wastageBox.x + wastageBox.width / 2;
    const dx = Math.abs(inputCenterX - labelCenterX);
    const dy = box.y - (wastageBox.y + wastageBox.height);

    // The Wastage textbox is below the label in the right-hand column.
    if (dx < 100 && dy >= -5 && dy < 100) {
      const distance = dx + Math.abs(dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        wastageInput = input;
      }
    }
  }

  if (!wastageInput) {
    throw new Error('Could not locate the Wastage(%) input.');
  }

  await wastageInput.scrollIntoViewIfNeeded();
  await wastageInput.click({ force: true });
  await wastageInput.fill('5');

  await expect(wastageInput).toHaveValue('5', {
    timeout: 10000,
  });

  console.log('Wastage(%): 5');

  await selectOption('UM', ['PC', 'Yard', 'Meter', 'Kilogram']);
  await closePopup();

  // 8. Upload image
  if (!fs.existsSync(IMAGE_PATH)) {
    throw new Error(`Image file not found: ${IMAGE_PATH}`);
  }

  let imageUploaded = false;

  const fileInputs = page.locator('input[type="file"]');

  // First attempt: use an existing file input directly.
  for (let i = 0; i < await fileInputs.count(); i++) {
    try {
      await fileInputs.nth(i).setInputFiles(IMAGE_PATH, {
        timeout: 4000,
      });

      imageUploaded = true;
      console.log(`Image selected: ${TRIM_IMAGE}`);
      break;
    } catch {
      // Try another input or the upload button.
    }
  }

  // Fallback: click Upload Images and wait for the file chooser.
  if (!imageUploaded) {
    const uploadLabel = label('Upload Images');

    await uploadLabel.waitFor({
      state: 'attached',
      timeout: 10000,
    });

    await uploadLabel.scrollIntoViewIfNeeded();

    const uploadBox = await uploadLabel.boundingBox();

    if (!uploadBox) {
      throw new Error('Upload Images label is not visible.');
    }

    const x = uploadBox.x + uploadBox.width / 2;
    const y = uploadBox.y + uploadBox.height / 2;

    const targets = [
      { x, y },
      { x, y: y - 50 },
      { x, y: y - 90 },
    ];

    for (const target of targets) {
      const chooserPromise = page
        .waitForEvent('filechooser', { timeout: 5000 })
        .catch(() => null);

      await page.mouse.click(target.x, Math.max(5, target.y));

      const chooser = await chooserPromise;

      if (chooser) {
        await chooser.setFiles(IMAGE_PATH);
        imageUploaded = true;
        console.log(`Image selected: ${TRIM_IMAGE}`);
        break;
      }

      const currentInputs = page.locator('input[type="file"]');

      if (await currentInputs.count()) {
        try {
          await currentInputs.first().setInputFiles(IMAGE_PATH);
          imageUploaded = true;
          console.log(`Image selected: ${TRIM_IMAGE}`);
          break;
        } catch {
          // Continue to the next target.
        }
      }
    }
  }

  if (!imageUploaded) {
    await page.screenshot({
      path: 'upload-debug.png',
      fullPage: true,
    });

    throw new Error(
      'Image upload failed. Check upload-debug.png to inspect the upload control.'
    );
  }

  await page.waitForTimeout(3000);

  // 9. Submit and verify
  await page
    .getByRole('button', {
      name: 'Add New',
      exact: true,
    })
    .last()
    .click();

  await expect(
    page.locator('flt-semantics').filter({
      hasText: itemName,
    }).first()
  ).toBeAttached({
    timeout: 20000,
  });

  console.log(`Stitching Trim saved successfully: ${itemName}`);
});