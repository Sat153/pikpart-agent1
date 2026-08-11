require("dotenv").config();
const { test, expect } = require("@playwright/test");
const { EcomLoginPage } = require("../pages/EcomLoginPage");

const PHONE = process.env.ECOM_PHONE;
const OTP = process.env.ECOM_OTP;

test("ecom login - phone + OTP reaches logged-in state", async ({ page }) => {
  test.skip(!PHONE || !OTP, "Set ECOM_PHONE and ECOM_OTP in .env first");

  await page.goto(process.env.ECOM_BASE_URL);
  const login = new EcomLoginPage(page);
  await login.login(PHONE, OTP);

  // Success = "Login/Register" is gone (replaced by account name + dropdown).
  const stillShowsLoginButton = await page
    .getByText(/login\/register/i)
    .first()
    .isVisible()
    .catch(() => false);

  expect(stillShowsLoginButton).toBeFalsy();
});