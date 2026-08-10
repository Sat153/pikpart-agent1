require("dotenv").config();
const { test, expect } = require("@playwright/test");
const { AdminLoginPage } = require("../pages/AdminLoginPage");
const { RetailerPage } = require("../pages/RetailerPage");

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

function uniqueRetailerName() {
  return `AutoTest Retailer ${Date.now()}`;
}

test.beforeEach(async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");
  const login = new AdminLoginPage(page);
  await login.goto();
  await login.login(EMAIL, PASSWORD);
});

test("retailer creation - valid data lands in Approval Pending", async ({ page }) => {
  const retailer = new RetailerPage(page);
  const before = await retailer.getDashboardCounts();

  await retailer.openRetailerList();
  const name = await retailer.createRetailer({
    name: uniqueRetailerName(),
    phone: "9999999999",
    email: `autotest+${Date.now()}@example.com`,
  });

  await page.goto("/"); // back to dashboard to re-read counters
  const after = await retailer.getDashboardCounts();

  expect(after.pending).toBeGreaterThan(before.pending ?? 0);
  console.log(`Created retailer "${name}" - pending count ${before.pending} -> ${after.pending}`);
});

test("retailer creation - missing required field shows validation error", async ({ page }) => {
  const retailer = new RetailerPage(page);
  await retailer.openRetailerList();

  await page.getByRole("button", { name: /add|create|new retailer/i }).first().click();
  // Deliberately leave all fields blank and try to submit.
  await page.getByRole("button", { name: /save|submit|create/i }).first().click();

  const errorVisible = await page
    .getByText(/required|please enter|this field/i)
    .first()
    .isVisible()
    .catch(() => false);

  expect(errorVisible).toBeTruthy();
});

test("retailer approval flow moves record from pending to approved", async ({ page }) => {
  const retailer = new RetailerPage(page);
  await retailer.openRetailerList();

  const name = await retailer.createRetailer({
    name: uniqueRetailerName(),
    phone: "9999999998",
    email: `autotest+${Date.now()}@example.com`,
  });

  const before = await retailer.getDashboardCounts();
  await retailer.approveRetailer(name);

  await page.goto("/");
  const after = await retailer.getDashboardCounts();

  expect(after.approved).toBeGreaterThan(before.approved ?? 0);
});

test("retailer rejection flow moves record from pending to rejected", async ({ page }) => {
  const retailer = new RetailerPage(page);
  await retailer.openRetailerList();

  const name = await retailer.createRetailer({
    name: uniqueRetailerName(),
    phone: "9999999997",
    email: `autotest+${Date.now()}@example.com`,
  });

  const before = await retailer.getDashboardCounts();
  await retailer.rejectRetailer(name);

  await page.goto("/");
  const after = await retailer.getDashboardCounts();

  expect(after.rejected).toBeGreaterThan(before.rejected ?? 0);
});

test("lead creation - new lead is saved", async ({ page }) => {
  const retailer = new RetailerPage(page);
  await retailer.createLead({
    name: `AutoTest Lead ${Date.now()}`,
    phone: "9999999996",
  });

  const savedConfirmation = await page
    .getByText(/success|saved|created/i)
    .first()
    .isVisible()
    .catch(() => false);

  expect(savedConfirmation).toBeTruthy();
});
