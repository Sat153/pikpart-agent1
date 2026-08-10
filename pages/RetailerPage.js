// Page object for retailer + lead management inside the Agent module
// (left nav: Agent > ... per your screenshot). Selectors are best-effort -
// see README.md "Fixing selectors" if any locator below doesn't match.

class RetailerPage {
  constructor(page) {
    this.page = page;
  }

  async openRetailerList() {
    // Retailer cards sit directly on the dashboard - no submenu needed.
    await this.page.getByText("Retailer Listing", { exact: true }).click();
  }

  /**
   * Creates a new retailer with the given field values.
   * @param {object} data - e.g. { name, phone, email, gstin, address }
   * @returns {Promise<string>} the retailer's display name, for later lookup
   */
  async createRetailer(data) {
    await this.page.getByRole("button", { name: /add|create|new retailer/i }).first().click();

    for (const [field, value] of Object.entries(data)) {
      const input = this.page
        .getByLabel(new RegExp(field, "i"))
        .or(this.page.getByPlaceholder(new RegExp(field, "i")))
        .first();
      if (await input.count()) {
        await input.fill(String(value));
      }
    }

    await this.page.getByRole("button", { name: /save|submit|create/i }).first().click();
    return data.name;
  }

  /** Finds a retailer row by name in the pending list and approves it. */
  async approveRetailer(name) {
    const row = this.page.getByRole("row", { name: new RegExp(name, "i") });
    await row.getByRole("button", { name: /approve/i }).click();
    await this.page.getByRole("button", { name: /confirm|yes/i }).click().catch(() => {});
  }

  /** Finds a retailer row by name in the pending list and rejects it. */
  async rejectRetailer(name, reason = "Test rejection via automation") {
    const row = this.page.getByRole("row", { name: new RegExp(name, "i") });
    await row.getByRole("button", { name: /reject/i }).click();

    const reasonInput = this.page.getByLabel(/reason/i).or(this.page.getByPlaceholder(/reason/i)).first();
    if (await reasonInput.count()) {
      await reasonInput.fill(reason);
    }
    await this.page.getByRole("button", { name: /confirm|submit|yes/i }).click().catch(() => {});
  }

  /** Reads the three dashboard counters shown on the main Admin dashboard. */
  async getDashboardCounts() {
    async function readCount(page, label) {
      const card = page.getByText(new RegExp(label, "i")).locator("..");
      const text = await card.innerText();
      const match = text.match(/[\d,]+/);
      return match ? Number(match[0].replace(/,/g, "")) : null;
    }
    return {
      pending: await readCount(this.page, "Approval Pending"),
      approved: await readCount(this.page, "Approved Retailer"),
      rejected: await readCount(this.page, "Rejected Retailer"),
    };
  }

  async createLead(data) {
    await this.page.getByRole("link", { name: /sourcing leads/i }).first().click();
    await this.page.getByRole("button", { name: /add|create|new lead/i }).first().click();

    for (const [field, value] of Object.entries(data)) {
      const input = this.page
        .getByLabel(new RegExp(field, "i"))
        .or(this.page.getByPlaceholder(new RegExp(field, "i")))
        .first();
      if (await input.count()) {
        await input.fill(String(value));
      }
    }
    await this.page.getByRole("button", { name: /save|submit|create/i }).first().click();
  }
}

module.exports = { RetailerPage };