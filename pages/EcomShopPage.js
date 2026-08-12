// Page object for the ecom shopping flow: search, add to cart, place order.
//
// Confirmed via manual DevTools inspection on /searched-products:
// - Each product card has its own "ADD TO CART" button directly in the
//   results list (no need to open a product detail page first).
// - Some cards instead show "ITEM ON ORDER" (likely out of stock / already
//   in cart) - we skip those and pick the first genuine "ADD TO CART".

class EcomShopPage {
  constructor(page) {
    this.page = page;
  }

  async searchProduct(query) {
    const searchBox = this.page
      .getByPlaceholder(/search products/i)
      .or(this.page.getByRole("searchbox"))
      .first();
    await searchBox.waitFor({ state: "visible", timeout: 15_000 });
    await searchBox.fill(query);
    await searchBox.press("Enter");

    // Wait for the results page to load.
    await this.page.waitForURL(/searched-products/i, { timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  /**
   * Adds a product to cart, then VERIFIES it's a normal purchasable item
   * (shows "PRICE DETAILS" / "CHECKOUT" in the cart) rather than a
   * B2B lead-type item (shows "ITEM ON ORDER DETAILS" / "Submit Lead" -
   * a completely different, incompatible flow). If the wrong type is
   * added, it's removed and the next candidate is tried instead.
   */
  async addFirstAvailableToCart(maxAttempts = 8) {
    let buttons = this.page.getByRole("button", { name: /^add to cart$/i });
    let visible = await buttons
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!visible) {
      await this.page.reload();
      await this.page.waitForTimeout(1_500);
      buttons = this.page.getByRole("button", { name: /^add to cart$/i });
      await buttons.first().waitFor({ state: "visible", timeout: 15_000 });
    }

    const count = await buttons.count();
    const attempts = Math.min(count, maxAttempts);

    for (let i = 0; i < attempts; i++) {
      const button = buttons.nth(i);
      const card = button.locator(
        "xpath=ancestor::div[contains(@class,'sc-ckeRpf') or contains(@class,'sc-fkyzQK')][1]"
      );
      const productName = await card
        .locator("img")
        .first()
        .getAttribute("alt")
        .catch(() => null);

      await button.click();
      await this.page.waitForTimeout(1_000);
      await this.openCart();
      // Give the cart panel a moment to fully render (PRICE DETAILS vs
      // ITEM ON ORDER DETAILS) before checking which type it is - checking
      // too early can miss the "Submit Lead" panel and false-negative.
      await this.page.waitForTimeout(1_500);

      const isLeadFlow = await this.page
        .getByText(/submit lead|item on order details/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!isLeadFlow) {
        return productName; // Correct product type - done.
      }

      // Wrong type (B2B lead item) - remove it and try the next candidate.
      const deleteIcon = this.page.getByLabel("Delete Item").first();
      if (await deleteIcon.count()) {
        await deleteIcon.click().catch(() => {});
        await this.page.waitForTimeout(500);
      }

      await this.page.goBack();
      await this.page.waitForTimeout(1_000);
      buttons = this.page.getByRole("button", { name: /^add to cart$/i });
    }

    throw new Error(
      `Tried ${attempts} product(s) but all were lead-type items, not normal purchasable products.`
    );
  }

  /**
   * Alternative path: click a product's image to open its detail page
   * (URL like /categories/products/details/130/Oil%20Filter), which has
   * its own "Add to Cart" button plus extra info (Part Code, availability).
   * Useful for tests that need to check detail-page content before buying.
   */
  async openFirstProductDetails() {
    const productImage = this.page.locator('img[alt]').first();
    await productImage.waitFor({ state: "visible", timeout: 15_000 });
    await productImage.click();
    await this.page.waitForURL(/\/products\/details\//i, { timeout: 15_000 });
  }

  /** Removes every item currently in the cart, so tests start from a clean state. */
  async clearCart() {
    await this.page.goto(process.env.ECOM_BASE_URL + "cart");
    await this.page.waitForTimeout(500);

    for (let i = 0; i < 10; i++) {
      const isEmpty = await this.page
        .getByText(/cart is empty/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (isEmpty) break;

      const deleteIcon = this.page.getByLabel("Delete Item").first();
      const count = await deleteIcon.count();
      if (!count) break;

      try {
        await deleteIcon.click({ timeout: 5_000 });
      } catch (err) {
        // React can re-render and detach this element mid-click - that's
        // fine, just re-check the loop; either it worked or we retry.
      }
      await this.page.waitForTimeout(500);
    }
  }

  async openCart() {
    // The cart icon is an <img src="/assets/CartIcon-....svg"> with no
    // accessible name, wrapped in a plain clickable <div>.
    const cartIcon = this.page.locator('img[src*="CartIcon"]').first();
    await cartIcon.waitFor({ state: "visible", timeout: 15_000 });
    try {
      await cartIcon.click({ timeout: 10_000 });
    } catch (err) {
      // Occasionally times out on a stability check despite being visible -
      // a plain forced click resolves it.
      await cartIcon.click({ force: true });
    }
    await this.page.waitForURL(/\/cart/i, { timeout: 15_000 }).catch(() => {});
  }

  /** Returns the number of items in the cart, parsed from the "(N) Item" text. */
  async getCartItemCount() {
    const orderHeader = this.page.getByText(/\(\d+\)\s*item/i).first();
    const text = await orderHeader.innerText().catch(() => "");
    const match = text.match(/\((\d+)\)/);
    return match ? Number(match[1]) : 0;
  }

  /**
   * Ensures a delivery address is selected before checkout. Handles two
   * distinct states seen on this site:
   *   1. "No Address Found" - no address exists yet, fill the full form.
   *   2. "No Address is Selected" - an address already exists (e.g. from a
   *      prior test run) but isn't picked as default; select it instead.
   * Safe to call even if an address is already selected - does nothing then.
   */
  async addAddressIfMissing(address = {}) {
    // Let the cart page finish loading first - the "No Address Found"
    // banner can flicker briefly during load even when an address is
    // already selected, before settling to the real state.
    await this.page.waitForTimeout(1_500);

    const notFoundBanner = this.page.getByText(/no address found/i).first();
    const notSelectedBanner = this.page.getByText(/no address is selected/i).first();

    const notFound = await notFoundBanner.isVisible().catch(() => false);
    if (notFound) {
      await this.page.getByText(/add address/i).first().click();
      await this.page.waitForURL(/add-new-address/i, { timeout: 15_000 }).catch(() => {});

      const defaults = {
        "first name": "Auto",
        "last name": "Test",
        "phone number": process.env.ECOM_PHONE || "9999999999",
        "building no": "123",
        ...address,
      };

      for (const [placeholder, value] of Object.entries(defaults)) {
        const input = this.page.getByPlaceholder(new RegExp(placeholder, "i")).first();
        if (await input.count()) {
          await input.fill(String(value));
        }
      }

      const submitButton = this.page.getByRole("button", { name: /^submit$/i });
      await submitButton.waitFor({ state: "visible", timeout: 10_000 });
      await this.page.waitForTimeout(500);
      await submitButton.click();
      return;
    }

    const notSelected = await notSelectedBanner.isVisible().catch(() => false);
    if (notSelected) {
      await this.page.getByText(/select address/i).first().click();
      await this.page.waitForTimeout(1_000);

      // A list of saved addresses should appear - pick the first one, via
      // whichever pattern matches: a radio button, or clicking the address
      // text/card itself.
      const radioOption = this.page.getByRole("radio").first();
      if (await radioOption.count()) {
        await radioOption.click();
      } else {
        await this.page.getByText(/auto test|faridabad/i).first().click();
      }

      const confirmButton = this.page
        .getByText(/deliver here|confirm|use this address|select$/i)
        .first();
      if (await confirmButton.count()) {
        await confirmButton.click();
      }
    }
  }

  /**
   * Completes payment using Cashfree's official TEST simulator
   * (payments-test.cashfree.com), which explicitly states "no actual
   * debit occurs" - safe to fully automate, unlike a real payment gateway.
   * Selects Net Banking -> first available bank -> reads the dynamic OTP
   * shown on screen -> selects SUCCESS -> submits -> confirms success.
   */
  async completeTestPayment() {
    await this.page.getByText(/^net banking$/i).first().click();
    await this.page.waitForTimeout(1_000);

    // Any bank works for testing - pick the first one in the list.
    const firstBank = this.page
      .locator("text=/State Bank Of India|Punjab National Bank|Kotak Mahindra Bank|ICICI Bank|HDFC Bank|Axis Bank/i")
      .first();
    await firstBank.waitFor({ state: "visible", timeout: 10_000 });
    await firstBank.click();

    // "Proceed to Pay" opens the Cashfree simulator in a new popup window.
    const [simulatorPage] = await Promise.all([
      this.page.context().waitForEvent("page", { timeout: 15_000 }),
      this.page.getByText(/proceed to pay/i).first().click(),
    ]);
    await simulatorPage.waitForLoadState();

    // The simulator displays a dynamic OTP directly on screen, e.g.
    // "Please enter the OTP - 111000". Read it rather than hardcoding,
    // since it may differ per transaction.
    const otpLine = await simulatorPage
      .getByText(/enter the otp/i)
      .first()
      .innerText();
    const otpMatch = otpLine.match(/(\d{4,6})/);
    const otp = otpMatch ? otpMatch[1] : "111000";

    await simulatorPage.getByPlaceholder(/enter otp/i).fill(otp);
    await simulatorPage.getByText(/^success$/i).first().click();
    await simulatorPage.getByRole("button", { name: /^submit$/i }).click();

    // Confirm the "Payment Successful" message appears (shown on the main
    // page/modal after the simulator's own success confirmation).
    await this.page
      .getByText(/payment successful/i)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
  }

  async proceedToCheckout() {
    const checkoutButton = this.page.getByText(/^checkout$/i).first();
    await checkoutButton.waitFor({ state: "visible", timeout: 15_000 });
    try {
      await checkoutButton.click({ timeout: 10_000 });
    } catch (err) {
      await checkoutButton.click({ force: true });
    }
  }

  /**
   * Clicks Pay Now and confirms the real Cashfree payment gateway opens.
   * IMPORTANT: this deliberately stops here. Pay Now opens a genuine
   * third-party payment gateway (Cashfree) - not a UAT-bypassed mock like
   * OTP was. We never select a payment method or submit real payment
   * details; reaching the gateway successfully IS the test's success
   * condition.
   */
  async placeOrder() {
    // The checkout page fires a getOptimizedQuote API call that can fail
    // (500 error) and briefly destabilize the page while it settles - give
    // it a moment before looking for the button.
    await this.page.waitForTimeout(2_000);

    const placeOrderButton = this.page
      .getByText(/place order|confirm order|pay now/i)
      .first();
    await placeOrderButton.waitFor({ state: "visible", timeout: 20_000 });
    try {
      await placeOrderButton.click({ timeout: 10_000 });
    } catch (err) {
      await placeOrderButton.click({ force: true });
    }

    // Confirm the payment gateway opened - this is the finish line for
    // this test. Do NOT interact with anything inside the gateway.
    await this.page
      .getByText(/payment options for|secured by cashfree/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }
}

module.exports = { EcomShopPage };