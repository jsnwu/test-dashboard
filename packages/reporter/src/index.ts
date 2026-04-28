import {
    FullConfig,
    FullResult,
    Reporter,
    Suite,
    TestCase,
    TestResult,
} from '@playwright/test/reporter'

import * as path from 'path'
import * as fs from 'fs'
import {v4 as uuidv4} from 'uuid'
import * as dotenv from 'dotenv'
import {parseDashboardTargetEnv, type DashboardTargetEnv} from 'test-dashboard-core'
dotenv.config()

/** Playwright reporter tuple options: `['playwright-dashboard-reporter', { ... }]` */
export interface DashboardReporterOptions {
    /** Dashboard API base URL (no `/api` suffix). */
    apiBaseUrl?: string
    /** Human-readable run title in the dashboard. Env: `DASHBOARD_RUN_NAME` */
    runName?: string
    /** Stored on the run as `metadata.project` for dashboard filtering. Env: `DASHBOARD_PROJECT` */
    project?: string
    /**
     * Target deployment env stored on runs/results as `metadata.targetEnv` (same role as `project`).
     * Env: `DASHBOARD_TARGET_ENV`. Does not filter which tests execute.
     */
    targetEnv?: string
    /** Suppress reporter console output (reserved). */
    silent?: boolean
    /** API request timeout in ms (reserved). */
    timeout?: number
    /**
     * Upload video content bytes to the dashboard server via
     * `POST /api/tests/:id/attachments/upload`.
     *
     * Default: `false`. Env: `DASHBOARD_UPLOAD_VIDEO=true`
     */
    uploadVideo?: boolean
    /**
     * Upload trace content bytes to the dashboard server via
     * `POST /api/tests/:id/attachments/upload`.
     *
     * Default: `false`. Env: `DASHBOARD_UPLOAD_TRACE=true`
     */
    uploadTrace?: boolean
    /**
     * Backwards-compatible switch (if set, enables both `uploadVideo` and `uploadTrace`).
     * Env: `DASHBOARD_UPLOAD_ATTACHMENTS=true`
     */
    uploadAttachments?: boolean
}

function normalizeTestPath(filePath: string): string {
    const prefixesToRemove = ['e2e/tests/', 'e2e\\tests\\', 'tests/', 'tests\\', 'e2e/', 'e2e\\']
    for (const prefix of prefixesToRemove) {
        if (filePath.startsWith(prefix)) {
            return filePath.substring(prefix.length)
        }
    }
    return filePath
}

interface TestStep {
    title: string
    category: string
    duration: number
    startTime: Date
    error?: string
}

type ConsoleEntryType = 'stdout' | 'stderr'

interface ConsoleEntry {
    type: ConsoleEntryType
    text: string
    timestamp: string
}

interface DashboardTestResult {
    id: string
    testId: string
    runId: string
    name: string
    filePath: string
    status: 'passed' | 'failed' | 'skipped' | 'timedOut'
    duration: number
    timestamp: string
    errorMessage?: string
    errorStack?: string
    attachments: Array<{
        name: string
        path: string
        contentType: string
    }>
    metadata?: {
        project?: string
        targetEnv?: string
        steps?: TestStep[]
        console?: {
            entries: ConsoleEntry[]
            truncated?: boolean
        }
    }
}

interface DashboardTestRun {
    id: string
    runName?: string | null
    status: 'running' | 'completed' | 'failed'
    timestamp: string
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    duration: number
}

interface ProcessStartData {
    runId: string
    type: 'run-all' | 'run-group' | 'rerun'
    totalTests?: number
    filePath?: string
    testId?: string
    originalTestId?: string
}

interface ProcessEndData {
    runId: string
    status: 'completed' | 'failed' | 'interrupted'
    results?: {
        passed: number
        failed: number
        skipped: number
        duration: number
    } | null
}

class PlaywrightDashboardReporter implements Reporter {
    private runId: string
    private results: DashboardTestResult[] = []
    private startTime: number = 0
    private apiBaseUrl: string
    private readonly runName?: string
    private readonly project?: string
    private readonly targetEnv?: DashboardTargetEnv
    private readonly uploadVideoEnabled: boolean
    private readonly uploadTraceEnabled: boolean
    private readonly consoleEntriesByResult = new WeakMap<TestResult, ConsoleEntry[]>()
    private readonly consoleWasTruncatedByResult = new WeakMap<TestResult, boolean>()
    private static readonly MAX_CONSOLE_LINES = 500
    private static readonly MAX_CONSOLE_CHARS = 200_000

    constructor(options: DashboardReporterOptions = {}) {
        let baseUrl = options.apiBaseUrl || process.env.DASHBOARD_API_URL || 'http://localhost:3001'

        // Remove trailing /api if present (for backward compatibility)
        if (baseUrl.endsWith('/api')) {
            baseUrl = baseUrl.slice(0, -4)
        }

        this.apiBaseUrl = baseUrl

        // Use RUN_ID from environment if provided by dashboard, otherwise generate new one
        this.runId = process.env.RUN_ID || process.env.RERUN_ID || uuidv4()

        const rn = options.runName ?? process.env.DASHBOARD_RUN_NAME
        this.runName = typeof rn === 'string' && rn.trim() !== '' ? rn.trim() : undefined
        const pj = options.project ?? process.env.DASHBOARD_PROJECT
        this.project = typeof pj === 'string' && pj.trim() !== '' ? pj.trim() : undefined
        const te = options.targetEnv ?? process.env.DASHBOARD_TARGET_ENV
        this.targetEnv = parseDashboardTargetEnv(te)

        const legacyUploadAll =
            options.uploadAttachments ?? process.env.DASHBOARD_UPLOAD_ATTACHMENTS === 'true'

        this.uploadVideoEnabled =
            options.uploadVideo ??
            (legacyUploadAll ? true : process.env.DASHBOARD_UPLOAD_VIDEO === 'true')
        this.uploadTraceEnabled =
            options.uploadTrace ??
            (legacyUploadAll ? true : process.env.DASHBOARD_UPLOAD_TRACE === 'true')

        console.log(`🎭 Playwright Dashboard Reporter initialized (Run ID: ${this.runId})`)
        console.log(`🌐 API Base URL: ${this.apiBaseUrl}`)
        if (this.runName) {
            console.log(`📝 Run name: ${this.runName}`)
        }
        if (this.project) {
            console.log(`📁 Project tag: ${this.project}`)
        }
        if (this.targetEnv) {
            console.log(`🎯 Target env tag: ${this.targetEnv}`)
        }
        if (this.uploadVideoEnabled || this.uploadTraceEnabled) {
            console.log(
                `📎 Upload content: video=${this.uploadVideoEnabled ? 'on' : 'off'} trace=${
                    this.uploadTraceEnabled ? 'on' : 'off'
                }`
            )
        }

        if (!this.apiBaseUrl || this.apiBaseUrl === 'undefined') {
            console.warn(
                `⚠️  Dashboard API URL not configured! Using fallback: http://localhost:3001`
            )
            this.apiBaseUrl = 'http://localhost:3001'
        }

        // Setup cleanup handlers for unexpected termination
        this.setupCleanupHandlers()
    }

    onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
        this.captureConsoleChunk('stdout', chunk, test, result)
    }

    onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
        this.captureConsoleChunk('stderr', chunk, test, result)
    }

    async onBegin(_config: FullConfig, suite: Suite) {
        this.startTime = Date.now()
        const totalTests = suite.allTests().length

        await this.registerRunAtStart(totalTests)

        const processType = process.env.RERUN_MODE === 'true' ? 'rerun' : 'run-all'

        // Notify dashboard that process is starting
        await this.notifyProcessStart({
            runId: this.runId,
            type: processType,
            totalTests,
        })

        console.log(`🚀 Starting test run with ${totalTests} tests`)
    }

    onTestBegin(test: TestCase) {
        const testId = this.generateStableTestId(test)
        // Normalize path for consistent file path display
        const filePath = normalizeTestPath(path.relative(process.cwd(), test.location.file))

        // Notify dashboard that test is starting
        this.notifyTestStart({
            testId,
            name: test.title,
            filePath,
        })

        console.log(`▶️  Starting: ${test.title}`)
    }

    async onTestEnd(test: TestCase, result: TestResult) {
        const testId = this.generateStableTestId(test)
        // Normalize path for consistent file path display
        const filePath = normalizeTestPath(path.relative(process.cwd(), test.location.file))

        // Create enhanced error message with code context like in original Playwright report
        let enhancedErrorMessage = result.error?.stack || result.error?.message
        if (result.status === 'failed' && result.error) {
            enhancedErrorMessage = this.createEnhancedErrorMessage(test, result.error)
        }

        // Capture test steps from Playwright
        const steps: TestStep[] = result.steps
            ? result.steps.map((step) => ({
                  title: step.title,
                  category: step.category,
                  duration: step.duration,
                  startTime: step.startTime,
                  error: step.error?.message,
              }))
            : []

        const consoleEntries = this.consoleEntriesByResult.get(result) || []
        const consoleTruncated = this.consoleWasTruncatedByResult.get(result) || false

        const uploadables = this.getUploadableAttachments(result.attachments)

        const testResult: DashboardTestResult = {
            id: uuidv4(),
            testId,
            runId: this.runId,
            name: test.title,
            filePath: filePath,
            status: this.mapStatus(result.status),
            duration: result.duration,
            timestamp: new Date().toISOString(),
            errorMessage: enhancedErrorMessage,
            errorStack: result.error?.stack,
            attachments: this.processAttachments(result.attachments),
            metadata: {
                ...(this.project ? {project: this.project} : {}),
                ...(this.targetEnv ? {targetEnv: this.targetEnv} : {}),
                steps: steps.length > 0 ? steps : undefined,
                console:
                    consoleEntries.length > 0
                        ? {entries: consoleEntries, truncated: consoleTruncated || undefined}
                        : undefined,
            },
        }

        this.results.push(testResult)

        // Send result to dashboard API
        await this.sendTestResult(testResult)
        if (uploadables.length > 0) {
            await this.uploadAttachmentsForTestResult(testResult.id, uploadables)
        }

        console.log(
            `${this.getStatusIcon(testResult.status)} ${testResult.name} (${testResult.duration}ms)`
        )
    }

    private captureConsoleChunk(
        type: ConsoleEntryType,
        chunk: string | Buffer,
        _test?: TestCase,
        result?: TestResult
    ) {
        // We only store per-test output when Playwright provides the TestResult object.
        // Global output (no result) is ignored to avoid polluting individual test logs.
        if (!result) return

        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
        if (!text) return

        const entries = this.consoleEntriesByResult.get(result) || []
        const lines = text.split(/\r?\n/)

        // Preserve trailing newline behavior: split() drops the delimiter; re-add '\n' for all but last line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line === '' && i === lines.length - 1) continue

            const entryText = i < lines.length - 1 ? `${line}\n` : line
            entries.push({
                type,
                text: entryText,
                timestamp: new Date().toISOString(),
            })
        }

        // Trim by line count
        let truncated = false
        while (entries.length > PlaywrightDashboardReporter.MAX_CONSOLE_LINES) {
            entries.shift()
            truncated = true
        }

        // Trim by total size
        let totalChars = entries.reduce((acc, e) => acc + e.text.length, 0)
        while (totalChars > PlaywrightDashboardReporter.MAX_CONSOLE_CHARS && entries.length > 0) {
            const removed = entries.shift()!
            totalChars -= removed.text.length
            truncated = true
        }

        this.consoleEntriesByResult.set(result, entries)
        if (truncated) this.consoleWasTruncatedByResult.set(result, true)
    }

    async onEnd(result: FullResult) {
        const duration = Date.now() - this.startTime
        const passed = this.results.filter((r) => r.status === 'passed').length
        const failed = this.results.filter((r) => r.status === 'failed').length
        const skipped = this.results.filter((r) => r.status === 'skipped').length

        console.log(`\n⏳ Waiting for all test results to be sent to dashboard...`)

        await new Promise((resolve) => setTimeout(resolve, 1000))

        console.log(`✅ All test results should be processed by dashboard now`)

        // Update test run
        await this.updateTestRun({
            id: this.runId,
            ...(this.runName ? {runName: this.runName} : {}),
            status: result.status === 'passed' ? 'completed' : 'failed',
            timestamp: new Date().toISOString(),
            totalTests: this.results.length,
            passedTests: passed,
            failedTests: failed,
            skippedTests: skipped,
            duration,
        })

        // Notify dashboard that process is ending
        console.log('🔄 Sending process end notification...')
        await this.notifyProcessEnd({
            runId: this.runId,
            status: result.status === 'passed' ? 'completed' : 'failed',
            results: {
                passed,
                failed,
                skipped,
                duration,
            },
        })

        console.log(`\n📊 Test run completed:`)
        console.log(`   ✅ Passed: ${passed}`)
        console.log(`   ❌ Failed: ${failed}`)
        console.log(`   ⏭️  Skipped: ${skipped}`)
        console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(1)}s`)
        console.log(`\n🌐 View results: http://localhost:3000`)
    }

    private generateStableTestId(test: TestCase): string {
        // Generate stable ID based on file path and test title
        const originalPath = path.relative(process.cwd(), test.location.file)

        // Normalize path by removing common test directory prefixes
        // This ensures consistent testId generation across different project structures
        const filePath = normalizeTestPath(originalPath)

        const content = `${filePath}:${test.title}`

        // Simple hash function for stable IDs
        let hash = 0
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash | 0 // Convert to 32-bit integer
        }

        return `test-${Math.abs(hash).toString(36)}`
    }

    private mapStatus(status: string): 'passed' | 'failed' | 'skipped' | 'timedOut' {
        switch (status) {
            case 'passed':
                return 'passed'
            case 'failed':
                return 'failed'
            case 'skipped':
                return 'skipped'
            case 'timedOut':
                return 'timedOut'
            default:
                return 'failed'
        }
    }

    private getUploadableAttachments(
        attachments: TestResult['attachments']
    ): Array<{type: 'trace' | 'video'; name: string; path: string; contentType?: string}> {
        if (!this.uploadVideoEnabled && !this.uploadTraceEnabled) return []

        const out: Array<{
            type: 'trace' | 'video'
            name: string
            path: string
            contentType?: string
        }> = []

        for (const a of attachments || []) {
            const p = a?.path
            const n = a?.name
            if (!p || !n) continue

            const contentType = a?.contentType
            const lowerName = n.toLowerCase()

            const isTrace =
                contentType === 'application/zip' ||
                lowerName.endsWith('.zip') ||
                lowerName.includes('trace')
            const isVideo =
                (contentType && contentType.startsWith('video/')) ||
                lowerName.endsWith('.webm') ||
                lowerName.endsWith('.mp4')

            if (isTrace && this.uploadTraceEnabled) {
                out.push({type: 'trace', name: n, path: p, contentType})
            } else if (isVideo && this.uploadVideoEnabled) {
                out.push({type: 'video', name: n, path: p, contentType})
            }
        }

        return out
    }

    private async uploadAttachmentsForTestResult(
        testResultId: string,
        attachments: Array<{
            type: 'trace' | 'video'
            name: string
            path: string
            contentType?: string
        }>
    ): Promise<void> {
        for (const a of attachments) {
            try {
                if (!fs.existsSync(a.path)) {
                    console.warn(`⚠️  Attachment not found on disk: ${a.path}`)
                    continue
                }

                const buffer = await fs.promises.readFile(a.path)

                // Keep types loose to avoid TS env/lib mismatches in consumers.
                const form: any = new (globalThis as any).FormData()
                form.append('type', a.type)

                const blob: any = new (globalThis as any).Blob([buffer], {
                    type: a.contentType || 'application/octet-stream',
                })
                form.append('file', blob, path.basename(a.path) || a.name)

                const response = await fetch(
                    `${this.apiBaseUrl}/api/tests/${encodeURIComponent(testResultId)}/attachments/upload`,
                    {
                        method: 'POST',
                        body: form,
                    }
                )

                if (!response.ok) {
                    const txt = await response.text().catch(() => '')
                    console.warn(
                        `⚠️  Failed to upload attachment (${a.type}) (${response.status}): ${txt || 'empty body'}`
                    )
                }
            } catch (error) {
                console.warn(`⚠️  Failed to upload attachment (${a.type}): ${error}`)
            }
        }
    }

    private processAttachments(attachments: TestResult['attachments']) {
        return (attachments || []).map((attachment) => {
            const name = attachment?.name || ''
            const contentType = attachment?.contentType || ''
            const filePath = attachment?.path || ''

            const uploadables = this.getUploadableAttachments([attachment] as any)
            const shouldStripPath = uploadables.length > 0

            return {
                name,
                path: shouldStripPath ? '' : filePath,
                contentType,
            }
        })
    }

    private createEnhancedErrorMessage(test: TestCase, error: any): string {
        const originalStack = error.stack || error.message || ''

        // Extract line number from stack trace
        const stackMatch = originalStack.match(/at .*:(\d+):\d+/)
        if (!stackMatch) {
            return originalStack
        }

        const lineNumber = parseInt(stackMatch[1])
        const filePath = test.location.file

        try {
            // Read the actual file content
            const fileContent = fs.readFileSync(filePath, 'utf-8')
            const lines = fileContent.split('\n')

            // Create context lines like in original Playwright report
            const contextLines: string[] = []
            const startLine = Math.max(0, lineNumber - 3)
            const endLine = Math.min(lines.length - 1, lineNumber + 2)

            for (let i = startLine; i <= endLine; i++) {
                const lineNum = i + 1
                const isErrorLine = lineNum === lineNumber
                const prefix = isErrorLine ? '>' : ' '
                const line = lines[i] || ''
                contextLines.push(`${prefix} ${lineNum} |${line}`)
            }

            // Add caret pointer for the error line
            if (lineNumber <= lines.length) {
                const errorLine = lines[lineNumber - 1] || ''
                const caretPosition = this.findCaretPosition(errorLine, error.message)
                if (caretPosition > 0) {
                    const spaces = ' '.repeat(caretPosition + ` ${lineNumber} |`.length)
                    contextLines.splice(
                        contextLines.findIndex((line) => line.startsWith('>')) + 1,
                        0,
                        `     |${spaces}^`
                    )
                }
            }

            // Combine original error message with code context
            const mainErrorLines = originalStack
                .split('\n')
                .filter(
                    (line: any) =>
                        !line.trim().startsWith('at ') ||
                        line.includes(path.relative(process.cwd(), filePath))
                )

            return [
                ...mainErrorLines.slice(0, -1), // Remove the last 'at' line
                '',
                ...contextLines,
                '',
                mainErrorLines[mainErrorLines.length - 1], // Add back the 'at' line
            ].join('\n')
        } catch (err) {
            console.log(err)
            return originalStack
        }
    }

    private findCaretPosition(line: string, errorMessage: string): number {
        // Try to find the position of the error in the line
        // This is a simple heuristic - in real Playwright it's more sophisticated
        if (errorMessage.includes('toBe')) {
            const toBeIndex = line.indexOf('toBe')
            if (toBeIndex !== -1) {
                return toBeIndex + 2 // Position at 'Be'
            }
        }

        // Default to finding 'expect' if present
        const expectIndex = line.indexOf('expect')
        if (expectIndex !== -1) {
            return expectIndex
        }

        return 0
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'passed':
                return '✅'
            case 'failed':
                return '❌'
            case 'skipped':
                return '⏭️'
            case 'timedOut':
                return '⏰'
            default:
                return '❓'
        }
    }

    private async sendTestResult(result: DashboardTestResult) {
        const startTime = Date.now()
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(result),
            })

            const duration = Date.now() - startTime

            if (!response.ok) {
                console.warn(`⚠️  Failed to send test result (${duration}ms): ${response.status}`)
                const responseText = await response.text()
                console.warn(`⚠️  Response: ${responseText}`)
            }
        } catch (error) {
            const duration = Date.now() - startTime
            console.warn(`⚠️  Dashboard API not available (${duration}ms): ${error}`)
        }
    }

    /**
     * Creates the `test_runs` row with `run_name` and `metadata.project` so the dashboard
     * can filter and display the run before the first result is persisted.
     */
    private async registerRunAtStart(totalTests: number): Promise<void> {
        const processType = process.env.RERUN_MODE === 'true' ? 'rerun' : 'run-all'
        const metadata: Record<string, unknown> = {
            type: processType,
            triggeredFrom: 'playwright-reporter',
        }
        if (this.project) {
            metadata.project = this.project
        }
        if (this.targetEnv) {
            metadata.targetEnv = this.targetEnv
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/runs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: this.runId,
                    runName: this.runName ?? null,
                    status: 'running',
                    totalTests,
                    passedTests: 0,
                    failedTests: 0,
                    skippedTests: 0,
                    duration: 0,
                    metadata,
                }),
            })

            if (!response.ok) {
                const responseText = await response.text()
                console.warn(
                    `⚠️  Failed to register test run (${response.status}): ${responseText || 'empty body'}`
                )
            } else {
                console.log(`✅ Test run registered with dashboard: ${this.runId}`)
            }
        } catch (error) {
            console.warn(`⚠️  Test run registration failed: ${error}`)
        }
    }

    private async updateTestRun(run: DashboardTestRun) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/runs/${run.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(run),
            })

            if (!response.ok) {
                console.warn(`⚠️  Failed to update test run: ${response.status}`)
                const responseText = await response.text()
                console.warn(`⚠️  Response: ${responseText}`)
            }
        } catch (error) {
            console.warn(`⚠️  Dashboard API not available: ${error}`)
        }
    }

    private async notifyProcessStart(data: ProcessStartData) {
        try {
            console.log(`📤 Sending process start notification for: ${data.runId}`)
            const response = await fetch(`${this.apiBaseUrl}/api/tests/process-start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                console.warn(`⚠️  Failed to notify process start: ${response.status}`)
                const responseText = await response.text()
                console.warn(`⚠️  Response: ${responseText}`)
            } else {
                console.log(`✅ Process start notification sent successfully: ${data.runId}`)
            }
        } catch (error) {
            console.warn(`⚠️  Process start notification failed: ${error}`)
        }
    }

    private async notifyTestStart(data: {testId: string; name: string; filePath: string}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/tests/test-start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    runId: this.runId,
                    ...data,
                }),
            })

            if (!response.ok) {
                console.warn(`⚠️  Failed to notify test start: ${response.status}`)
            }
        } catch (error) {
            // Silently fail - don't interrupt test execution
            console.warn(`⚠️  Test start notification failed: ${error}`)
        }
    }

    private async notifyProcessEnd(data: ProcessEndData) {
        try {
            console.log(`📤 Sending process end notification for: ${data.runId} (${data.status})`)
            const response = await fetch(`${this.apiBaseUrl}/api/tests/process-end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                console.warn(`⚠️  Failed to notify process end: ${response.status}`)
                const responseText = await response.text()
                console.warn(`⚠️  Response: ${responseText}`)
            } else {
                console.log(
                    `✅ Process end notification sent successfully: ${data.runId} (${data.status})`
                )
            }
        } catch (error) {
            console.warn(`⚠️  Process end notification failed: ${error}`)
        }
    }

    private setupCleanupHandlers() {
        // Handle process termination signals
        process.on('SIGINT', () => this.cleanup('interrupted'))
        process.on('SIGTERM', () => this.cleanup('interrupted'))
        process.on('uncaughtException', () => this.cleanup('interrupted'))
        process.on('unhandledRejection', () => this.cleanup('interrupted'))
    }

    private async cleanup(status: 'interrupted' = 'interrupted') {
        console.log('🧹 Cleaning up reporter...')
        try {
            await this.notifyProcessEnd({
                runId: this.runId,
                status: status,
                results: null,
            })
        } catch (error) {
            console.warn('⚠️  Cleanup notification failed:', error)
        }
    }
}

export default PlaywrightDashboardReporter
