# Agent 1 — Sales / Admin test automation

Automates retailer creation, approval, rejection, and lead creation on
`uatadmin.pikpart.com`, using Playwright.

## Setup (one-time)

1. Install [Node.js](https://nodejs.org) v18 or later if you don't have it.
   Check with: `node -v`

2. Open this folder in VS Code (or any terminal), then run:
   ```
   npm install
   npx playwright install chromium
   ```

3. Copy `.env.example` to `.env` and fill in your real test credentials:
   ```
   cp .env.example .env
   ```
   Then open `.env` and replace the placeholder values. **Never share this
   file or paste its contents into a chat.**

## Running the tests

```
npm test              # runs headless, fast
npm run test:headed   # watch it click through the browser
npm run report         # opens the HTML report after a run
```

## Fixing selectors (read this if a test fails on first run)

I wrote the page objects (`pages/AdminLoginPage.js`, `pages/RetailerPage.js`)
using resilient, best-guess locators (labels, placeholders, button text)
since I haven't seen the live authenticated screens myself. There's a good
chance one or two won't match your exact UI on the first try — that's
normal and quick to fix:

1. Run `npm run codegen` — this opens a real browser and records your clicks
   as working Playwright code while you manually click through the flow
   (e.g. click "Add Retailer", fill the form, hit save).
2. Copy the locator Codegen generated for the field/button that failed.
3. Paste that exact locator into the matching spot in `pages/RetailerPage.js`
   or `pages/AdminLoginPage.js`.

If you'd rather not do this yourself, run the failing test with
`npm run test:headed`, note which step it stopped on (the HTML report also
shows a screenshot of that moment), and share that with me — I'll adjust
the selector for you.

## What's included

| File | Purpose |
|---|---|
| `pages/AdminLoginPage.js` | Logs in with email/password |
| `pages/RetailerPage.js` | Create/approve/reject retailer, create lead, read dashboard counts |
| `tests/agent1-retailer.spec.js` | The 5 test cases: valid creation, invalid creation, approval, rejection, lead creation |
| `playwright.config.js` | Points at `uatadmin.pikpart.com`, screenshots + video on failure |

## Next steps

Once this is passing reliably, we build Agent 2 (Merchant/Seller) the same
way, then Agent 3 (Ecom), then the Orchestrator that chains all three.
