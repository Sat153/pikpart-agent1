require("dotenv").config();
const { test, expect } = require("@playwright/test");
const { EcomLoginPage } = require("../pages/EcomLoginPage");
const { EcomShopPage } = require("../pages/EcomShopPage");

const PHONE = process.env.ECOM_PHONE;
const OTP = process.env.ECOM_OTP;

// Broad search term - safe to use now that addFirstAvailableToCart()
// automatically detects and skips any lead-type ("Submit Lead") products
// it encounters, trying the next candidate instead.
const SEARCH_TERM = process.env.ECOM_SEARCH_TERM || "filter";

// IMPORTANT: logs in ONCE for this whole file, not once per test.
// Logging in triggers a real OTP request to a real phone number - running
// that on every single test (via beforeEach) means every re-run of this
// file sends multiple real OTP messages. test.describe.serial + beforeAll
// shares one login across all 3 tests instead.
test.describe.serial("ecom shopping flow", () => {
  let page;
  let shop;

  test.beforeAll(async ({ browser }) => {
    test.skip(!PHONE || !OTP, "Set ECOM_PHONE and ECOM_OTP in .env first");
    page = await browser.newPage();
    await page.goto(process.env.ECOM_BASE_URL);
    const login = new EcomLoginPage(page);
    await login.login(PHONE, OTP);
    shop = new EcomShopPage(page);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test("search returns results", async () => {
    await shop.searchProduct(SEARCH_TERM);
    const url = page.url();
    expect(url.toLowerCase()).toContain("search");
  });

  test("add a product to cart", async () => {
    const productName = await shop.addFirstAvailableToCart();
    console.log(`Added to cart: ${productName}`);

    await shop.openCart();
    const itemCount = await shop.getCartItemCount();
    expect(itemCount).toBeGreaterThan(0);
  });

  test("place an order end to end", async () => {
    await shop.openCart();
    await shop.addAddressIfMissing();
    await shop.proceedToCheckout();
    await shop.placeOrder();

    // "Pay Now" opens Cashfree's real payment gateway UI, but the actual
    // transaction runs through Cashfree's official TEST simulator
    // (payments-test.cashfree.com), which explicitly states no real debit
    // occurs - safe to complete fully, unlike a live payment.
    await shop.completeTestPayment();

    const paymentSuccessful = await page
      .getByText(/payment successful/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(paymentSuccessful).toBeTruthy();
  });
});