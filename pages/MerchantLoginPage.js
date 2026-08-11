// Page object for the merchant.pikpart.com login screen (phone + OTP).
// Selectors confirmed via Codegen against the real site.

class MerchantLoginPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/");
  }

  /**
   * Full login flow: click Login, enter phone, request OTP, fill the 6
   * single-digit OTP boxes, then wait for the seller dashboard to appear.
   * @param {string} phone - 10-digit test phone number
   * @param {string} otp - 6-digit OTP string, e.g. "123456" (UAT accepts any value)
   */
  async login(phone, otp) {
    await this.page.getByText("Login").first().click();

    const phoneInput = this.page.getByRole("textbox", { name: "-00000" });
    await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
    await phoneInput.click();
    await phoneInput.fill(phone);

    await this.page.getByRole("button", { name: "Request OTP" }).click();

    const digits = otp.toString().padEnd(6, "0").split("");
    for (let i = 0; i < 6; i++) {
      await this.page.locator(`#otp-${i}`).fill(digits[i]);
    }

    // Wait for the seller dashboard to appear as proof of a successful login.
    await this.page
      .getByText(/dashboard/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }
}

module.exports = { MerchantLoginPage };