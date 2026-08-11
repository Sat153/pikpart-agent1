require("dotenv").config();
const { test, expect } = require("@playwright/test");
const { MerchantLoginPage } = require("../pages/MerchantLoginPage");

const PHONE = process.env.MERCHANT_PHONE;
const OTP = process.env.MERCHANT_OTP;

test("merchant login - phone + OTP reaches dashboard", async ({ page }) => {
  test.skip(!PHONE || !OTP, "Set MERCHANT_PHONE and MERCHANT_OTP in .env first");

  await page.goto(process.env.MERCHANT_BASE_URL);
  const login = new MerchantLoginPage(page);
  await login.login(PHONE, OTP);

  const dashboardVisible = await page.getByText(/dashboard/i).first().isVisible();
  expect(dashboardVisible).toBeTruthy();
});