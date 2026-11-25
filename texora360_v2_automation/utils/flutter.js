const { expect } = require('@playwright/test');

async function enableA11y(page) {
  const placeholder = page.locator('flt-semantics-placeholder');
  if ((await placeholder.count()) > 0) {
    await placeholder.evaluate((el) => el.click());
  }
  await page.getByRole('button', { name: 'Buyer List', exact: true }).waitFor({
    state: 'attached',
    timeout: 60000,
  });
}

async function fillField(page, name, value, index = 0) {
  const field = page.getByRole('textbox', { name }).nth(index);
  await expect(field, `Textbox "${name}" not found`).toBeVisible({ timeout: 5000 });
  await field.click({ force: true });
  await field.fill(String(value));
}

async function selectOption(page, dropdown, option, opts = {}) {
  const { triggerExact = false, optionExact = false, role = 'button' } = opts;
  const trigger = typeof dropdown === 'string'
    ? page.getByRole('button', { name: dropdown, exact: triggerExact }).first()
    : dropdown;
  const label = typeof dropdown === 'string' ? dropdown : 'custom dropdown';
  await expect(trigger, `Dropdown "${label}" not found`).toBeVisible({ timeout: 5000 });
  await trigger.click({ force: true });
  const item = page.getByRole(role, { name: option, exact: optionExact }).last();
  await expect(item, `Option "${option}" not found`).toBeVisible({ timeout: 5000 });
  await item.click({ force: true });
}

async function selectByText(page, triggerText, option, opts = {}) {
  const { optionExact = false, role = 'menuitem' } = opts;
  const trigger = page.getByText(triggerText, { exact: false }).first();
  await expect(trigger, `Dropdown "${triggerText}" not found`).toBeVisible({ timeout: 5000 });
  await trigger.click({ force: true });
  const item = page.getByRole(role, { name: option, exact: optionExact }).last();
  await expect(item, `Option "${option}" not found`).toBeVisible({ timeout: 5000 });
  await item.click({ force: true });
}

async function upload(page, trigger, filePath) {
  await expect(trigger, 'Upload button not found').toBeVisible({ timeout: 5000 });
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    trigger.click({ force: true }),
  ]);
  await chooser.setFiles(filePath);
}

module.exports = { enableA11y, fillField, selectOption, selectByText, upload };