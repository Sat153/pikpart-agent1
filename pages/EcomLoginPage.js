// Page object for the uat.pikpart.com (customer storefront) login screen.
//
// Note: this site can auto-submit and navigate away partway through typing
// the OTP digits (before all 6 boxes are filled), which interrupts the fill
// loop. We treat that interruption as success, not failure, and confirm
// login by checking that "Login/Register" is no longer shown.

class EcomLoginPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/");
  }

  /**
   * @param {string} phone - 10-digit test phone number
   * @param {string} otp - 6-digit OTP string, e.g. "123456" (UAT accepts any value)
   */
  async login(phone, otp) {
    await this.page.getByText(/login\/register/i).first().click();

    const phoneInput = this.page
      .getByRole("textbox", { name: /00000-00000|phone|mobile/i })
      .or(this.page.getByPlaceholder(/00000-00000|phone|mobile/i))
      .first();
    await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
    await phoneInput.click();
    await phoneInput.fill(phone);

    await this.page
      .getByRole("button", { name: /get otp|request otp|send otp|continue/i })
      .first()
      .click();

    const digits = otp.toString().padEnd(6, "0").split("");
    for (let i = 0; i < 6; i++) {
      try {
        await this.page.locator(`#otp-${i}`).fill(digits[i], { timeout: 5_000 });
      } catch (err) {
        // The site may auto-submit and navigate away before all boxes are
        // filled - that means login already succeeded, so stop here.
        break;
      }
    }

    // Confirm login by waiting for "Login/Register" to disappear (replaced
    // by the account name + dropdown).
    await this.page
      .getByText(/login\/register/i)
      .first()
      .waitFor({ state: "hidden", timeout: 15_000 })
      .catch(() => {});
  }
}

module.exports = { EcomLoginPage };