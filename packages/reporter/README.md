# playwright-dashboard-reporter

Official Playwright reporter for [Test Dashboard](https://github.com/jsnwu/test-dashboard) - a full-stack testing dashboard with real-time monitoring, one-click reruns, and comprehensive test reporting.

## Features

- 🔄 Real-time test execution monitoring via WebSocket
- ⚡ **NEW in v1.0.1:** Live progress tracking with currently running tests
- 📊 Comprehensive test result tracking with execution history
- 📎 Automatic attachment management (videos, screenshots, traces)
- 🔍 Enhanced error reporting with code context and line highlighting
- 🎯 Stable test ID generation for reliable test tracking
- ⏱️ **NEW in v1.0.1:** Time estimates (elapsed and remaining)
- 🏗️ Built-in diagnostics and health checks
- 🚀 Zero configuration - works out of the box

## Installation

```bash
npm install --save-dev playwright-dashboard-reporter
```

## Quick Start

### 1. Set Environment Variable

```bash
# .env
DASHBOARD_API_URL=http://localhost:3001
```

### 2. Start Dashboard Server

```bash
# Clone dashboard repository
git clone https://github.com/jsnwu/test-dashboard.git
cd test-dashboard

# Install and start
npm install
npm run dev
```

The dashboard will be available at:

- 🌐 Web UI: http://localhost:3000
- 🔌 API: http://localhost:3001

Results will appear in your Dashboard automatically! 🎉

## Configuration Options

```typescript
interface DashboardReporterOptions {
    /** Dashboard API base URL (default: http://localhost:3001) */
    apiBaseUrl?: string
    /** Human-readable run title in the dashboard (`test_runs.run_name`) */
    runName?: string
    /** Stored on the run as `metadata.project` for dashboard filtering */
    project?: string
    silent?: boolean // Reserved
    timeout?: number // Reserved
}
```

Use in `playwright.config.ts`:

```typescript
reporter: [
    [
        'playwright-dashboard-reporter',
        {apiBaseUrl: 'http://localhost:3001', runName: 'CI main', project: 'chromium'},
    ],
]
```

## Environment Variables

The reporter supports the following environment variables:

````bash
# Required: Dashboard API endpoint
DASHBOARD_API_URL=http://localhost:3001

# Optional: run display name and project bucket (same as reporter options)
DASHBOARD_RUN_NAME=nightly-staging
DASHBOARD_PROJECT=my-app

## Dashboard Features

When using this reporter, you get access to:

- ✅ **Real-time Test Monitoring** - Watch tests execute live
- ⚡ **Live Progress Tracking** (v1.0.1+) - See which tests are running right now with time estimates
- 🔄 **One-Click Reruns** - Rerun failed tests instantly
- 📈 **Flaky Test Detection** - Identify unstable tests automatically
- 📊 **Timeline Visualization** - View execution trends over time
- 🎥 **Attachment Viewer** - Watch videos, view screenshots, analyze traces
- 📜 **Execution History** - Track all test runs with complete data
- 🔍 **Test Discovery** - Automatically detect all available tests
- 🎯 **Detailed Reporting** - Enhanced error messages with code context

### 🆕 Progress Tracking (v1.0.1+)

The reporter now sends real-time progress updates to the dashboard:

```
🧪 Running Tests              − ✕
━━━━━━━━━━━━━━━━━━━━━━━━━━━ 43%
6 of 14 tests                 43%

✅ Passed: 5        ❌ Failed: 0
⏭️ Skipped: 1       ⏸️ Pending: 8

Currently Running:
🔄 API - Link Budget Item
   e2e/tests/api/api.test.ts
🔄 API - Create Contract
   e2e/tests/api/api.test.ts

⏱️ Elapsed: 3s   Est. remaining: ~4s
```

**Features:**
- See exactly which tests are running
- Track passed/failed/skipped/pending counts in real-time
- Get time estimates for test completion
- Floating panel that can be minimized
- Auto-hides after test completion

**How it works:**
The reporter uses Playwright's `onTestBegin()` and `onTestEnd()` lifecycle hooks to send progress updates to the dashboard via WebSocket. No configuration needed - it works automatically!

## Troubleshooting

### Reporter Not Sending Data

**Symptom:** Tests run but no data appears in Dashboard

**Solution:**

1. Verify Dashboard server is running:
    ```bash
    curl http://localhost:3001/api/health
    ```
2. Check `DASHBOARD_API_URL` environment variable:
    ```bash
    echo $DASHBOARD_API_URL
    ```
3. Run diagnostics:
    ```bash
    curl http://localhost:3001/api/tests/diagnostics
    ```

## API Compatibility

This reporter is compatible with:

- Dashboard API version: **1.x and above**
- Playwright version: **1.40.0 and above**
- Node.js version: **18.0.0 and above**

## Changelog

### v1.0.1 (October 2025)

**New Features:**
- ⚡ Real-time progress tracking with currently running tests
- ⏱️ Time estimates (elapsed and remaining)
- 📊 Live statistics (passed/failed/skipped/pending)
- 🎨 FloatingProgressPanel UI component

**Technical Changes:**
- Added `onTestBegin()` lifecycle hook
- New API endpoint: `POST /api/tests/test-start`
- Enhanced WebSocket event: `test:progress`
- Improved error handling for network failures

**Documentation:**
- Added [Progress Tracking Guide](https://github.com/jsnwu/test-dashboard/blob/main/docs/features/PROGRESS_TRACKING.md)
- Updated API documentation

### v1.0.0 (September 2025)

Initial release with core features:
- Real-time test execution monitoring
- Comprehensive test result tracking
- Automatic attachment management
- Enhanced error reporting
- Stable test ID generation

## Development

For Dashboard developers working on the reporter package:

```bash
cd packages/reporter
npm run build      # Build distribution
npm run dev        # Watch mode (auto-rebuild)
npm run type-check # TypeScript validation
```

## Support

- 📚 [Documentation](https://github.com/jsnwu/test-dashboard/tree/main/docs)
- 🐛 [Report Issues](https://github.com/jsnwu/test-dashboard/issues)
- 💬 [Discussions](https://github.com/jsnwu/test-dashboard/discussions)

## License

MIT © test-dashboard contributors

---

**Made with ❤️ for the Playwright community**
````
