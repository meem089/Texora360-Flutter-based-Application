import path from 'path';
import fs from 'fs';
import { test, expect } from '@playwright/test';

const STYLE_ID = 1;

const IMAGE_DIR = path.resolve('tests', 'test-image');
const IMAGE_FILE = fs
  .readdirSync(IMAGE_DIR)
  .find((file) => path.parse(file).name.toLowerCase().replace(/[-_ ]/g, '') === 'packingadd');
const IMAGE_PATH = IMAGE_FILE ? path.join(IMAGE_DIR, IMAGE_FILE) : '';

// Random data helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min, max) => Number((Math.random() * (max - min) + min).toFixed(2));
const pick = (list) => list[randomInt(0, list.length - 1)];
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

test.use({ actionTimeout: 20000 });

test('Packing: add packing item with random valid data (positive)', async ({ page }) => {
  test.setTimeout(300000);

  if (!IMAGE_PATH) {
    throw new Error('Image packing-add.* was not found in tests/test-image');
  }

  // 1. Open app and enable Flutter accessibility
  await page.goto('/');
  await page.locator('flt-semantics-placeholder').waitFor({ state: 'attached', timeout: 60000 });
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
  await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });

  // 3. Open Style Cost Sheet
  await page.evaluate((id) => {
    window.location.hash = `#/cost_details/${id}/all_cs`;
  }, STYLE_ID);

  const packingGroup = page.getByRole('group', { name: /^Packing\b/ }).first();
  await packingGroup.waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(2000);

  const label = (text) => {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return page
      .locator('flt-semantics')
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) })
      .last();
  };

  const inputFor = async (fieldName) => {
    const labelLocator = label(fieldName);
    await labelLocator.waitFor({ state: 'attached', timeout: 15000 });

    const labelBox = await labelLocator.boundingBox();
    if (!labelBox) {
      throw new Error(`Label "${fieldName}" is not visible.`);
    }

    const centerX = labelBox.x + labelBox.width / 2;
    const centerY = labelBox.y + labelBox.height / 2;
    const inputs = page.locator('input[data-semantics-role="text-field"], flt-semantics input');

    let bestInput = null;
    let bestScore = Infinity;
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();
      if (!box) continue;

      const dx = Math.abs(box.x + box.width / 2 - centerX);
      const dy = Math.abs(box.y + box.height / 2 - centerY);
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

  const typeValue = async (input, fieldName, value) => {
    await input.scrollIntoViewIfNeeded();
    await input.click({ force: true });
    await input.fill('');
    await input.pressSequentially(String(value), { delay: 30 });
    await expect(input).toHaveValue(String(value), { timeout: 10000 });
    console.log(`${fieldName}: ${value}`);
  };

  const typeInto = async (fieldName, value) => {
    await typeValue(await inputFor(fieldName), fieldName, value);
  };


  const typeWastage = async (value) => {
    const wastageLabel = label('Wastage(%)');
    await wastageLabel.waitFor({ state: 'attached', timeout: 15000 });

    const wastageBox = await wastageLabel.boundingBox();
    if (!wastageBox) {
      throw new Error('Wastage(%) label is not visible.');
    }

    const inputs = page.locator('input[data-semantics-role="text-field"], flt-semantics input');
    let wastageInput = null;
    let closestDistance = Infinity;
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();
      if (!box) continue;

      const dx = Math.abs(box.x + box.width / 2 - (wastageBox.x + wastageBox.width / 2));
      const dy = box.y - (wastageBox.y + wastageBox.height);
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
    await typeValue(wastageInput, 'Wastage(%)', value);
  };

  // 5. Dropdown helpers
  const closePopup = async () => {
    await page.waitForTimeout(400);
    if (await page.getByRole('textbox', { name: 'Search...' }).count()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  };

  // Opens the dropdown, then clicks the first option name that exists
  const selectOption = async (name, options) => {
    const dropdown = page
      .getByRole('group', { name: new RegExp(`^${name}\\s*\\*?$`) })
      .last();
    await dropdown.waitFor({ state: 'attached', timeout: 15000 });
    await dropdown.click({ force: true });
    await page.waitForTimeout(700);

    for (const option of options) {
      const optionButton = page.getByRole('button', { name: option, exact: true }).last();
      if (await optionButton.count()) {
        await optionButton.click({ force: true });
        console.log(`${name}: ${option}`);
        await closePopup();
        return;
      }
    }
    throw new Error(`No matching option found in "${name}" dropdown.`);
  };

  const addButton = packingGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])[1]'
  );
  await addButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const addBox = await addButton.boundingBox();
  if (!addBox) {
    throw new Error('Could not locate the Packing add button.');
  }

  const addX = addBox.width < 100 && addBox.x < 640 ? addBox.x + addBox.width / 2 : 118;
  await page.mouse.click(addX, addBox.y + addBox.height / 2);
  await expect(label('Description')).toBeAttached({ timeout: 15000 });

  const itemName = `${pick(['Carton', 'Poly Bag', 'Hang Tag', 'Price Tag', 'Sticker'])} ${randomInt(10000, 99999)}`;

  await typeInto('Item', itemName);
  await typeInto('Description', `Packing material ${randomInt(100, 999)}`);
  await selectOption('Source', shuffle(['Nominated', 'Non Nominated']));
  await typeInto('GSM', randomInt(80, 400));
  await typeInto('Consumption', randomDecimal(0.5, 5));
  await typeInto('Price', randomDecimal(0.1, 9.9));
  await typeWastage(randomInt(1, 10));
  await selectOption('UM', shuffle(['PC', 'Yard', 'Meter', 'Kilogram']));
  await closePopup();


  let imageUploaded = false;
  const fileInputs = page.locator('input[type="file"]');


  for (let i = 0; i < (await fileInputs.count()); i++) {
    try {
      await fileInputs.nth(i).setInputFiles(IMAGE_PATH, { timeout: 4000 });
      imageUploaded = true;
      console.log(`Image selected: ${IMAGE_FILE}`);
      break;
    } catch {
 
    }
  }

  if (!imageUploaded) {
    const uploadLabel = label('Upload Images');
    await uploadLabel.waitFor({ state: 'attached', timeout: 10000 });
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
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
      await page.mouse.click(target.x, Math.max(5, target.y));
      const chooser = await chooserPromise;

      if (chooser) {
        await chooser.setFiles(IMAGE_PATH);
        imageUploaded = true;
        console.log(`Image selected: ${IMAGE_FILE}`);
        break;
      }

      const currentInputs = page.locator('input[type="file"]');
      if (await currentInputs.count()) {
        try {
          await currentInputs.first().setInputFiles(IMAGE_PATH);
          imageUploaded = true;
          console.log(`Image selected: ${IMAGE_FILE}`);
          break;
        } catch {

        }
      }
    }
  }

  if (!imageUploaded) {
    await page.screenshot({ path: 'upload-debug.png', fullPage: true });
    throw new Error('Image upload failed. Check upload-debug.png to inspect the upload control.');
  }

  await page.waitForTimeout(3000);


  await page.getByRole('button', { name: 'Add New', exact: true }).last().click();

  await expect(
    page.locator('flt-semantics').filter({ hasText: itemName }).first()
  ).toBeAttached({ timeout: 20000 });

  console.log(`Packing saved successfully: ${itemName}`);
});