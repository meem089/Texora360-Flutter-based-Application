import { test, expect } from '@playwright/test';

const STYLE_ID = 1;

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomDecimal = (min, max) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

const pick = (list) => list[randomInt(0, list.length - 1)];

const shuffle = (list) =>
  [...list].sort(() => Math.random() - 0.5);

test.use({ actionTimeout: 20000 });

test('Other Charge: add item with random valid data (positive)', async ({ page }) => {
  test.setTimeout(300000);

  await page.goto('/');

  await page.locator('flt-semantics-placeholder').waitFor({
    state: 'attached',
    timeout: 60000,
  });

  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.querySelector('flt-semantics-placeholder')?.click();
  });

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

  await page.evaluate((id) => {
    window.location.hash = `#/cost_details/${id}/all_cs`;
  }, STYLE_ID);

  await page.waitForTimeout(2000);

  const otherChargeGroup = page
    .getByRole('group', { name: /^Other Charge\b/ })
    .first();

  await otherChargeGroup.waitFor({
    state: 'attached',
    timeout: 60000,
  });

  const label = (text) => {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return page
      .locator('flt-semantics')
      .filter({
        hasText: new RegExp(`^\\s*${escaped}\\s*$`),
      })
      .last();
  };

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

      const dx = Math.abs(
        box.x + box.width / 2 - centerX
      );

      const dy = Math.abs(
        box.y + box.height / 2 - centerY
      );

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
    const textValue = String(value);

    await input.scrollIntoViewIfNeeded();
    await input.click({ force: true });
    await input.fill('');
    await input.pressSequentially(textValue, { delay: 30 });

    await expect(input).toHaveValue(textValue, {
      timeout: 10000,
    });

    console.log(`${fieldName}: ${textValue}`);
  };

  const typeInto = async (fieldName, value) => {
    await typeValue(await inputFor(fieldName), fieldName, value);
  };

  const typeWastage = async (value) => {
    const wastageLabel = page
      .locator('flt-semantics')
      .filter({ hasText: /Wastage\s*\(\s*%\s*\)/i })
      .last();

    await wastageLabel.waitFor({
      state: 'attached',
      timeout: 15000,
    });

    const wastageBox = await wastageLabel.boundingBox();

    if (!wastageBox) {
      throw new Error('Wastage (%) label is not visible.');
    }

    const inputs = page.locator(
      'input[data-semantics-role="text-field"], flt-semantics input'
    );

    let wastageInput = null;
    let closestDistance = Infinity;

    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();

      if (!box) continue;

      const dx = Math.abs(
        box.x + box.width / 2 -
        (wastageBox.x + wastageBox.width / 2)
      );

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
      throw new Error('Could not locate the Wastage (%) input.');
    }

    await typeValue(wastageInput, 'Wastage (%)', value);
  };

  const closePopup = async () => {
    await page.waitForTimeout(400);

    if (
      await page.getByRole('textbox', { name: 'Search...' }).count()
    ) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  };

  const selectOption = async (name, options) => {
    const dropdown = page
      .getByRole('group', {
        name: new RegExp(`^${name}\\s*\\*?$`),
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
        .getByRole('button', { name: option, exact: true })
        .last();

      if (await optionButton.count()) {
        await optionButton.click({ force: true });

        console.log(`${name}: ${option}`);

        await closePopup();
        return;
      }
    }

    throw new Error(
      `No matching option found in "${name}" dropdown.`
    );
  };

  const addButton = otherChargeGroup.locator(
    'xpath=(descendant::flt-semantics[@role="button"] | following::flt-semantics[@role="button"])[1]'
  );

  await addButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const addBox = await addButton.boundingBox();

  if (!addBox) {
    throw new Error('Could not locate the Other Charge add button.');
  }

  const addX =
    addBox.width < 100 && addBox.x < 640
      ? addBox.x + addBox.width / 2
      : 118;

  await page.mouse.click(
    addX,
    addBox.y + addBox.height / 2
  );

  await expect(
    page.getByText('Add Other Charge', { exact: true })
  ).toBeAttached({ timeout: 15000 });

  const itemTypeName =
    `${pick(['Transport', 'Handling', 'Inspection', 'Service', 'Miscellaneous'])} ${randomInt(1000, 9999)}`;

  await typeInto('Item Type', itemTypeName);

  await typeInto(
    'Description',
    `Other charge ${randomInt(100, 999)}`
  );

  await selectOption(
    'Source',
    shuffle(['Nominated', 'Non Nominated'])
  );

  await typeInto('Comsumption', randomDecimal(0.5, 5));

  await typeInto('Price', randomDecimal(0.1, 9.9));

  await typeWastage(randomInt(1, 10));

  await selectOption(
    'UM',
    shuffle(['PC', 'Yard', 'Meter', 'Kilogram'])
  );

  await closePopup();
  await page.waitForTimeout(1000);

  await page
    .getByRole('button', { name: 'Add New', exact: true })
    .last()
    .click();

  await expect(
    page.locator('flt-semantics').filter({
      hasText: itemTypeName,
    }).first()
  ).toBeAttached({
    timeout: 20000,
  });

  console.log(`Other Charge saved successfully: ${itemTypeName}`);
});