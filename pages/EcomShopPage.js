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

  /** Clicks "ADD TO CART" on the first available product in the results list. */
  async addFirstAvailableToCart() {
    const addToCartButton = this.page
      .getByRole("button", { name: /^add to cart$/i })
      .first();
    await addToCartButton.waitFor({ state: "visible", timeout: 15_000 });

    // Grab the product name from the same card, for logging/assertions.
    const card = addToCartButton.locator(
      "xpath=ancestor::div[contains(@class,'sc-ckeRpf') or contains(@class,'sc-fkyzQK')][1]"
    );
    const productName = await card
      .locator("img")
      .first()
      .getAttribute("alt")
      .catch(() => null);

    await addToCartButton.click();
    return productName;
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
   * If the cart shows "No Address Found", this adds a dummy test address so
   * checkout isn't blocked. Safe to call even if an address already exists -
   * it does nothing in that case.
   */
  async addAddressIfMissing(address = {}) {
    const noAddressBanner = this.page.getByText(/no address found/i).first();
    const missing = await noAddressBanner.isVisible().catch(() => false);
    if (!missing) return;

    await this.page.getByRole("button", { name: /add address/i }).first().click();

    const defaults = {
      name: "Auto Test",
      phone: process.env.ECOM_PHONE || "9999999999",
      pincode: "560001",
      addressLine: "123 Test Street",
      city: "Bengaluru",
      state: "Karnataka",
      ...address,
    };

    for (const [field, value] of Object.entries(defaults)) {
      const input = this.page
        .getByLabel(new RegExp(field, "i"))
        .or(this.page.getByPlaceholder(new RegExp(field, "i")))
        .first();
      if (await input.count()) {
        await input.fill(String(value));
      }
    }

    await this.page.getByRole("button", { name: /save|submit|add/i }).last().click();
  }

  async proceedToCheckout() {
    const checkoutButton = this.page
      .getByRole("button", { name: /checkout|proceed/i })
      .or(this.page.getByRole("link", { name: /checkout|proceed/i }))
      .first();
    await checkoutButton.waitFor({ state: "visible", timeout: 15_000 });
    await checkoutButton.click();
  }

  async placeOrder() {
    const placeOrderButton = this.page
      .getByRole("button", { name: /place order|confirm order|pay now/i })
      .first();
    await placeOrderButton.waitFor({ state: "visible", timeout: 15_000 });
    await placeOrderButton.click();
  }
}

module.exports = { EcomShopPage };