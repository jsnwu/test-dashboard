# `@test-dashboard/playwright-dashboard-reporter`

In-repo fork of [`playwright-dashboard-reporter`](https://www.npmjs.com/package/playwright-dashboard-reporter) with **`runName`** and **`project`** support (Playwright tuple options plus `DASHBOARD_RUN_NAME` / `DASHBOARD_PROJECT` env) so runs show a title and aggregate under the dashboard **Project** filter.

The published npm package does not expose these fields; this copy lives at the **test-dashboard** repo root next to `packages/`. **`packages/reporter`** is kept in sync for publishing `playwright-dashboard-reporter` from the monorepo.

## Install

From the **test-dashboard** repo root:

```bash
npm install file:./playwright-dashboard-reporter
```

Package name: **`@test-dashboard/playwright-dashboard-reporter`**.

## Playwright config

```ts
// playwright.config.ts
export default defineConfig({
    reporter: [
        [
            '@test-dashboard/playwright-dashboard-reporter',
            {
                apiBaseUrl: 'http://localhost:3001',
                runName: 'nightly staging',
                project: 'my-playwright-project',
            },
        ],
    ],
})
```

## Environment variables (optional)

| Variable              | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `DASHBOARD_API_URL`   | API base URL (no `/api` suffix).                                          |
| `DASHBOARD_RUN_NAME`  | Human-readable run title (`test_runs.run_name`).                          |
| `DASHBOARD_PROJECT`   | Value stored as `metadata.project` on the run (dashboard project filter). |
| `RUN_ID` / `RERUN_ID` | Fixed run id when the dashboard spawns the worker.                        |
| `RERUN_MODE`          | `'true'` for rerun process type.                                          |

Reporter options override env when both are set.

## Build

```bash
cd playwright-dashboard-reporter && npm install && npm run build
```

(Or from repo root: `npm install && npm run build` inside this directory.)

Upstream behaviour and API otherwise match the published [`playwright-dashboard-reporter`](https://www.npmjs.com/package/playwright-dashboard-reporter) package.
