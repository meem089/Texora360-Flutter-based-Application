const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const data = require('../data/buyer.json');
const { enableA11y, fillField, selectOption, selectByText, upload } = require('../utils/flutter');

const fixture = (name) => path.resolve(__dirname, '../fixtures', name);
const IMG = fixture(data.files.image);
const PDF = fixture(data.files.document);
const FILE_BTN = 'Select file... Drop files here';

test.use({ viewport: { width: 1600, height: 1400 } });

test('System test: Add Buyer full flow', async ({ page }) => {
  const { general: g, compliance: c, business: b, bank: bk, shipping: sh, audit: au, payment: pm, sample: sm, product: pr } = data;

  await test.step('Login', async () => {
    await page.goto('/auth/login.html');  
    await page.locator('#email').fill(data.login.email);
    await page.locator('#password').fill(data.login.password);
    await page.locator('#submit').click();
    await page.waitForURL('**/index.html*',{ timeout: 30000 });  
  });

  await test.step('Open Buyer List and Add Buyer form', async () => {
    await page.goto('/index.html#/dev/dashboard', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await enableA11y(page);
    const buyerList = page.getByRole('button', { name: 'Buyer List', exact: true });
    await buyerList.evaluate(el => el.click());
    await expect(page.getByRole('button', { name: 'Add Buyer' }), 'Add Buyer button not found').toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Add Buyer' }).click();
    await expect(page.getByRole('textbox', { name: 'Enter buyer name' })).toBeVisible();
  });

  await test.step('General Information', async () => {
    await upload(page, page.getByRole('button', { name: 'Choose File' }), IMG);
    await fillField(page, 'Enter buyer name', g.name);
    await fillField(page, 'Enter contact person name', g.contactPerson);
    await fillField(page, 'Enter buyer email', g.email);
    await fillField(page, 'Enter buyer phone number', g.phone);
    await page.locator('flutter-view').click();
    await fillField(page, 'Add buyer website link', g.website);
    await selectOption(page, 'Select your buyer group', g.group, { optionExact: true });
    await selectOption(page, 'Select buyer country', g.country);
    await selectOption(page, 'Select buyer region', g.region);
    await fillField(page, 'Enter your address here...', g.address);
  });

  await test.step('Compliance and Documents', async () => {
    await selectByText(page, 'Select required certificate', c.standard, { role: 'menuitem' });
    await fillField(page, 'Enter brand name', c.brand);
    await selectByText(page, 'Select buyer label', c.businessModel, { role: 'menuitem' });
    for (let i = 0; i < 6; i++) {
      await upload(page, page.getByRole('button', { name: FILE_BTN }).first(), PDF);
    }
  });

  await test.step('Business Information', async () => {
    await selectOption(page, 'Select buyer business category', b.businessCategory);
    await selectOption(page, 'Select buyer product category', b.productCategory, { optionExact: true });
    await fillField(page, 'Enter annual business turnover', b.annualTurnover);
    await fillField(page, 'Enter annual order quantity', b.annualOrderQty);
  });

  await test.step('Bank Information', async () => {
    await fillField(page, 'Enter bank name', bk.bankName);
    await fillField(page, 'Enter branch name', bk.branch);
    await fillField(page, 'Enter account holder', bk.accountHolder);
    await page.locator('flutter-view').click();
    await fillField(page, 'Enter account number', bk.accountNumber);
    await fillField(page, 'Enter SWIFT code', bk.swift);
    await selectOption(page, 'Select', bk.currency, { triggerExact: true });
  });

  await test.step('Shipping Destination', async () => {
    await selectOption(page, 'Select country', bk.country);
    await fillField(page, 'Enter address', bk.address);
    await selectOption(page, 'Select port', sh.port);
    await selectOption(page, 'Select port', sh.port);
  });

  await test.step('Payment Term and Quality Configuration', async () => {
    await selectOption(page, 'Select method', sh.method);
    await selectOption(page, 'Select trade terms', sh.tradeTerms);
    await selectOption(page, 'Select level', au.level, { optionExact: true });
    await selectOption(page, 'Select authority', au.authority);
  });

  await test.step('Commercial Configuration', async () => {
    await selectOption(page, 'Select insurance company name', au.insuranceCompany);
    await fillField(page, 'Enter insurance limit', au.insuranceLimit);
    await page.getByRole('button', { name: 'Select effective date' }).click({ force: true });
    await page.waitForTimeout(1000);
    fs.writeFileSync('date-picker.txt', await page.locator('body').ariaSnapshot());
    await page.keyboard.press('Escape');
    await fillField(page, 'Enter credit days', pm.creditDays);
    await upload(page, page.getByRole('button', { name: FILE_BTN }).last(), PDF);
    await selectOption(page, 'Select payment terms', pm.paymentTerms);
    await fillField(page, 'Enter commercial and finance', pm.commercialFinance);
    await fillField(page, 'Enter %', pm.percent);
    await fillField(page, 'Enter buying house', pm.buyingHouse);
    await page.locator('flutter-view').click();
    await fillField(page, 'Enter export house', pm.exportHouse);
    await fillField(page, 'Enter buying / sourcing', pm.sourcing);
    await fillField(page, 'Enter FOB value', pm.fobValue);
  });

  await test.step('Sample, Audit and Vendor', async () => {
    await selectOption(page, 'Select type', sm.type);
    await fillField(page, 'Enter qty', sm.qty);
    await fillField(page, 'Enter audit name', sm.auditName);
    await fillField(page, 'Enter annual cost', sm.annualCost1, 0);
    await fillField(page, 'Enter vendor ID', sm.vendorId);
    await fillField(page, 'Enter annual cost', sm.annualCost2, 1);
  });

await test.step('Size List and Materials List', async () => {
    await selectOption(page, 'Select department', pr.department);
    await selectOption(page, 'Select category', pr.category1, { optionExact: true });
    await selectOption(page, 'Select type', pr.type);
    await selectOption(page, 'Select size type', pr.sizeType, { optionExact: true, role: 'group' });
    await page.locator('flutter-view').click();

    await fillField(page, 'Enter department', pr.departmentName);
    await selectOption(page, 'Select category', pr.category);
    await fillField(page, 'Enter sub category', pr.subCategory);
    await fillField(page, 'Enter item', pr.item);
    await fillField(page, 'Enter certificate name', pr.certificate);

    const testReq = page.getByRole('textbox', { name: 'Enter test requirement name' });
    await testReq.evaluate(el => el.click());
    await testReq.fill(String(pr.testRequirement));

    const nomSupplier = page.getByRole('textbox', { name: 'Enter nominated supplier' });
    await nomSupplier.evaluate(el => el.click());
    await nomSupplier.fill(String(pr.nominatedSupplier));
  });

  await test.step('Submit and open created buyer', async () => {
    await page.getByRole('button', { name: 'Add Now' }).click();
    const createdBuyer = page.getByRole('group', { name: new RegExp(g.contactPerson) }).first();
    await expect(createdBuyer, 'Created buyer row not found in the list').toBeVisible({ timeout: 30000 });
    await createdBuyer.click();
  });
});