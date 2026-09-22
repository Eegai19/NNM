# Browser smoke tests

These scripts drive a real browser against a **running** stack and are not part
of `npm test` (which runs the Vitest unit and component suites offline).

## Prerequisites

1. Backend on `http://127.0.0.1:8000`, seeded with demo data:

   ```bash
   cd backend
   python -m scripts.seed --demo
   uvicorn app.main:app --port 8000
   ```

2. Frontend dev server on `http://127.0.0.1:5173`:

   ```bash
   cd frontend
   npm run dev
   ```

3. Playwright's Chromium available. `npm install` brings the `playwright`
   package; download the browser once with `npx playwright install chromium`.

## Running

```bash
npm run e2e
```

- `smoke.mjs` signs in as the TPM and walks every page, checking the data that
  renders, dark mode, global search and the 390px mobile layout.
- `rules.mjs` verifies the two rules that matter most: an activity cannot move
  to **Completed** until a log is uploaded, and an engineer is read-only on
  nodes they are not assigned to while retaining write access on nodes they are.

Screenshots land in `e2e/screenshots/` (gitignored). Override the destination
with `NNM_E2E_OUT=/some/path`.

Both scripts assume the seeded demo accounts: `admin` / `Admin@123` and
`eegai` / `Nokia@123`.
