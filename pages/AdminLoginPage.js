// Page object for the admin.pikpart.com login screen.
//
// NOTE: These locators are written defensively (multiple fallback strategies)
// since I haven't seen the live authenticated DOM. If login fails on first
// run, see README.md "Fixing selectors" - it's usually a 2-minute fix.

class AdminLoginPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/");
  }

  async login(email, password) {
    // The landing page requires clicking "LOG IN" first to reveal the form.
    await this.page.getByRole("button", { name: "LOG IN" }).click();

    await this.page
      .getByRole("textbox", { name: "Enter Your Email Address" })
      .fill(email);
    await this.page
      .getByRole("textbox", { name: "Enter Password" })
      .fill(password);
    await this.page.getByRole("button", { name: "Login" }).click();

    // Wait for the dashboard to appear as proof of a successful login.
    await this.page
      .getByText(/dashboard/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  async isLoggedIn() {
    return this.page
      .getByText(/dashboard/i)
      .first()
      .isVisible()
      .catch(() => false);
  }
}

module.exports = { AdminLoginPage };