# HR Platform — Playwright Test Suite

## Setup

```bash
# From the project root
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Running the Tests

### Against the live app (recommended)
```bash
ADMIN_EMAIL=ptyle@lucentrenewables.com \
ADMIN_PASSWORD=<your_password> \
MANAGER_PASSWORD=<charles_password> \
EMPLOYEE_PASSWORD=<tomas_password> \
npx playwright test --config=tests/playwright.config.ts
```

### Against local dev server
```bash
# Terminal 1
npm run dev

# Terminal 2
BASE_URL=http://localhost:5000 \
ADMIN_EMAIL=ptyle@lucentrenewables.com \
ADMIN_PASSWORD=<your_password> \
npx playwright test --config=tests/playwright.config.ts
```

### Run only API smoke tests (fast, headless)
```bash
ADMIN_EMAIL=ptyle@lucentrenewables.com \
ADMIN_PASSWORD=<your_password> \
npx playwright test api-smoke --config=tests/playwright.config.ts
```

### View HTML report
```bash
npx playwright show-report tests/playwright-report
```

## Test Files

| File | Coverage |
|------|----------|
| `auth.spec.ts` | Login, logout, rate limiting, accept invite |
| `dashboard.spec.ts` | Dashboard stats, navigation, role-based nav items |
| `leave-requests.spec.ts` | Request form, half-day, date validation, my requests |
| `approvals.spec.ts` | Approve/reject flow, confirmation dialog, remaining days badge |
| `team-calendar.spec.ts` | Calendar render, month nav, holiday colors, employee access |
| `people.spec.ts` | People list, search, invite, allowance edit, on-behalf |
| `settings.spec.ts` | Profile edit, delegation, payroll export |
| `team-overview.spec.ts` | Team overview, year selector |
| `audit-log.spec.ts` | Audit log access, event display |
| `api-smoke.spec.ts` | All API endpoints — auth, security headers, status codes |

## Notes

- Tests marked `test.skip(!ADMIN_PASSWORD, ...)` are skipped if no credentials are provided.
- The `api-smoke.spec.ts` tests run without a browser (pure fetch), making them fast.
- Tests do NOT create or mutate production data (leave requests, etc.) — they are read-only
  except for the rate-limit test (which is permanently skipped).
- Parallel execution is disabled to avoid test interference on the live database.
