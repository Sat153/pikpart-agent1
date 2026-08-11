require("dotenv").config();
const { test, expect } = require("@playwright/test");
const { EcomLoginPage } = require("../pages/EcomLoginPage");
const { EcomShopPage } = require("../pages/EcomShopPage");

const PHONE = process.env.ECOM_PHONE;
const OTP = process.env.ECOM_OTP;

// A generic search term likely to return results on an auto-parts site.
const SEARCH_TERM = process.env.ECOM_SEARCH_TERM || "oil filter";

test.beforeEach(async ({ page }) => {
  test.skip(!PHONE || !OTP, "Set ECOM_PHONE and ECOM_OTP in .env first");
  await page.goto(process.env.ECOM_BASE_URL);
  const login = new EcomLoginPage(page);
  await login.login(PHONE, OTP);
});

test("search returns results", async ({ page }) => {
  const shop = new EcomShopPage(page);
  await shop.searchProduct(SEARCH_TERM);

  // Loose check: the URL or page content should reflect the search happened.
  const url = page.url();
  expect(url.toLowerCase()).toContain("search");
});

test("add a product to cart", async ({ page }) => {
  const shop = new EcomShopPage(page);
  await shop.searchProduct(SEARCH_TERM);
  const productName = await shop.addFirstAvailableToCart();
  console.log(`Added to cart: ${productName}`);

  await shop.openCart();
  const itemCount = await shop.getCartItemCount();
  expect(itemCount).toBeGreaterThan(0);
});

test("place an order end to end", async ({ page }) => {
  const shop = new EcomShopPage(page);
  await shop.searchProduct(SEARCH_TERM);
  await shop.addFirstAvailableToCart();
  await shop.openCart();
  await shop.addAddressIfMissing();
  await shop.proceedToCheckout();
  await shop.placeOrder();

  // Loose check for an order-confirmation signal.
  const confirmed = await page
    .getByText(/order (placed|confirmed|successful)/i)
    .first()
    .isVisible()
    .catch(() => false);
  expect(confirmed).toBeTruthy();
});