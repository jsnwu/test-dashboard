import {useEffect, useLayoutEffect, useMemo, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import {TestResult, type TestRun} from 'test-dashboard-core'
import {authGet} from '@features/authentication/utils/authFetch'
import {useTestsStore} from '@features/tests/store/testsStore'
import {useTestFilters} from '@features/tests/hooks'
import {FILTER_OPTIONS, FilterKey} from '@features/tests/constants'
import {useFlakyTests} from '@features/dashboard'
import {config} from '@config/environment.config'
import {RunDetailModal} from './RunDetailModal'
import {formatRunDateTime, formatRunDurationMs, formatRunTitle} from './runFormatters'
import {FilterButtonGroup, SearchInput} from '@shared/components'

type RunDatePreset = 'all' | 'today' | 'week' | 'month'

const RUN_DATE_PRESET_OPTIONS = [
    {key: 'all' as const, label: 'All time'},
    {key: 'today' as const, label: 'Today'},
    {key: 'week' as const, label: 'This week'},
    {key: 'month' as const, label: 'This month'},
]

function startOfLocalDay(d: Date): Date {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
}

/** Monday 00:00 local time of the week containing `d`. */
function startOfLocalWeekMonday(d: Date): Date {
    const x = startOfLocalDay(d)
    const day = x.getDay()
    const offset = day === 0 ? -6 : 1 - day
    x.setDate(x.getDate() + offset)
    return x
}

function startOfLocalMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function startOfNextLocalDay(d: Date): Date {
    const x = startOfLocalDay(d)
    x.setDate(x.getDate() + 1)
    return x
}

function runMatchesDatePreset(run: TestRun, preset: RunDatePreset, now: Date): boolean {
    if (preset === 'all') return true
    const t = new Date(run.createdAt).getTime()
    if (Number.isNaN(t)) return false
    const nowMs = now.getTime()
    if (t > nowMs) return false
    if (preset === 'today') {
        const start = startOfLocalDay(now).getTime()
        const end = startOfNextLocalDay(now).getTime()
        return t >= start && t < end
    }
    if (preset === 'week') {
        return t >= startOfLocalWeekMonday(now).getTime()
    }
    return t >= startOfLocalMonth(now).getTime()
}

function runMatchesNameQuery(run: TestRun, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const title = formatRunTitle(run).toLowerCase()
    const id = run.id.toLowerCase()
    const name = (run.runName || '').trim().toLowerCase()
    return title.includes(q) || id.includes(q) || name.includes(q)
}

export function ResultsPage() {
    const {runs, fetchRuns} = useTestsStore()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [detailRunId, setDetailRunId] = useState<string | null>(null)
    const [runTests, setRunTests] = useState<TestResult[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultFilter, setResultFilter] = useState<FilterKey>('all')
    const [runTestsSearchQuery, setRunTestsSearchQuery] = useState('')
    const [runDatePreset, setRunDatePreset] = useState<RunDatePreset>('all')
    const [runNameQuery, setRunNameQuery] = useState('')
    const projectFilter = searchParams.get('project') ?? ''
    const targetEnvFilter = searchParams.get('env') ?? ''

    useEffect(() => {
        void fetchRuns()
    }, [fetchRuns, projectFilter, targetEnvFilter])

    /** Re-open run detail modal when returning from Tests (see `openRun` query). */
    const openRunParam = searchParams.get('openRun')
    useLayoutEffect(() => {
        if (!openRunParam) return

        setDetailRunId(openRunParam)
        const next = new URLSearchParams(searchParams)
        next.delete('openRun')
        setSearchParams(next, {replace: true})
    }, [openRunParam, searchParams, setSearchParams])

    useEffect(() => {
        if (!detailRunId) return
        if (!runs.some((r) => r.id === detailRunId)) {
            setDetailRunId(null)
        }
    }, [runs, detailRunId])

    useEffect(() => {
        const load = async () => {
            if (!detailRunId) {
                setRunTests(null)
                return
            }

            try {
                setLoading(true)
                setError(null)
                setRunTests(null)
                const response = await authGet(
                    `${config.api.baseUrl}/tests?runId=${encodeURIComponent(detailRunId)}&limit=500`
                )
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                const data = await response.json()
                if (!data.success || !Array.isArray(data.data)) {
                    throw new Error('Invalid response format')
                }
                setRunTests(data.data)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load run results')
                setRunTests(null)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [detailRunId])

    useEffect(() => {
        setResultFilter('all')
    }, [detailRunId])

    useEffect(() => {
        setRunTestsSearchQuery('')
    }, [detailRunId])

    const {data: flakyTests = []} = useFlakyTests()
    const flakyTestIds = useMemo(() => new Set(flakyTests.map((f) => f.testId)), [flakyTests])

    const {filteredTests, counts} = useTestFilters({
        tests: runTests ?? [],
        filter: resultFilter,
        searchQuery: runTestsSearchQuery,
        flakyTestIds,
    })

    const resultFilterOptions = FILTER_OPTIONS.map((option) => ({
        ...option,
        count: counts[option.key as keyof typeof counts],
    }))

    const filteredRuns = useMemo(() => {
        const now = new Date()
        return runs.filter(
            (r) =>
                runMatchesDatePreset(r, runDatePreset, now) && runMatchesNameQuery(r, runNameQuery)
        )
    }, [runs, runDatePreset, runNameQuery])

    const selectedRun = useMemo(
        () => runs.find((r) => r.id === detailRunId) || null,
        [runs, detailRunId]
    )

    const hasActiveRunFilters = runDatePreset !== 'all' || runNameQuery.trim() !== ''

    const testsDetailHref = (t: TestResult, sourceRunId: string | null) => {
        const params = new URLSearchParams()
        params.set('testId', t.testId)
        params.set('executionId', t.id)
        const project = searchParams.get('project')
        if (project) {
            params.set('project', project)
        }
        params.set('from', 'results')
        if (sourceRunId) {
            params.set('returnRun', sourceRunId)
        }
        return `/tests?${params.toString()}`
    }

    const handleCloseRunModal = () => {
        setDetailRunId(null)
        setRunTests(null)
        setError(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Results</h1>
                <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                    <div>
                        {filteredRuns.length} run{filteredRuns.length === 1 ? '' : 's'}
                        {hasActiveRunFilters && runs.length !== filteredRuns.length
                            ? ` · ${runs.length} total`
                            : ''}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-content p-0">
                    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-6">
                            <div className="flex w-full min-w-0 justify-start">
                                <SearchInput
                                    value={runNameQuery}
                                    onChange={(e) => setRunNameQuery(e.target.value)}
                                    placeholder="Search runs by name or id..."
                                    className="w-full md:w-96 max-w-md"
                                />
                            </div>
                            <div className="flex w-full justify-end overflow-x-auto overscroll-x-contain pb-0.5 lg:w-auto lg:pb-0 lg:justify-self-end">
                                <FilterButtonGroup
                                    value={runDatePreset}
                                    onChange={(v) => setRunDatePreset(v as RunDatePreset)}
                                    options={RUN_DATE_PRESET_OPTIONS}
                                    className="min-w-max"
                                />
                            </div>
                        </div>
                    </div>

                    {runs.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                            No runs found.
                        </div>
                    ) : filteredRuns.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                            No runs match your filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                            <table className="w-full text-sm min-w-[560px]">
                                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                                    <tr>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Name
                                        </th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            Time
                                        </th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            Duration
                                        </th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Total
                                        </th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Passed
                                        </th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Failed
                                        </th>
                                        <th className="text-right py-3 px-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Skipped
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRuns.map((run) => {
                                        const active = run.id === detailRunId
                                        const hasRunName = Boolean((run.runName || '').trim())
                                        const titleLabel = formatRunTitle(run)
                                        const rowTitle = hasRunName
                                            ? `${titleLabel} (${run.id})`
                                            : run.id
                                        return (
                                            <tr
                                                key={run.id}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Open run: ${formatRunTitle(run)}`}
                                                onClick={() => setDetailRunId(run.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault()
                                                        setDetailRunId(run.id)
                                                    }
                                                }}
                                                className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                                                    active
                                                        ? 'bg-primary-50 dark:bg-primary-900/20'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                }`}>
                                                <td
                                                    className={`py-2.5 px-3 max-w-[min(320px,40vw)] ${
                                                        hasRunName
                                                            ? 'text-sm text-gray-900 dark:text-white'
                                                            : 'font-mono text-xs text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    <span
                                                        className="block truncate"
                                                        title={rowTitle}>
                                                        {titleLabel}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                    {formatRunDateTime(run.createdAt)}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                    {formatRunDurationMs(run.duration, run.status)}
                                                </td>
                                                <td className="py-2.5 px-2 text-xs text-right text-gray-700 dark:text-gray-300 tabular-nums">
                                                    {run.totalTests}
                                                </td>
                                                <td className="py-2.5 px-2 text-xs text-right text-green-700 dark:text-green-400 tabular-nums">
                                                    {run.passedTests}
                                                </td>
                                                <td className="py-2.5 px-2 text-xs text-right text-red-700 dark:text-red-400 tabular-nums">
                                                    {run.failedTests}
                                                </td>
                                                <td className="py-2.5 px-3 text-xs text-right text-gray-600 dark:text-gray-400 tabular-nums">
                                                    {run.skippedTests}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <RunDetailModal
                run={selectedRun}
                isOpen={Boolean(detailRunId)}
                onClose={handleCloseRunModal}
                loading={loading}
                error={error}
                runTests={runTests}
                filteredTests={filteredTests}
                searchQuery={runTestsSearchQuery}
                onSearchChange={setRunTestsSearchQuery}
                resultFilter={resultFilter}
                onResultFilterChange={setResultFilter}
                resultFilterOptions={resultFilterOptions}
                onTestRowClick={(t) => {
                    const sourceRunId = selectedRun?.id ?? null
                    // Pass test in location.state so Tests opens the detail modal immediately
                    // (no empty frame while fetching execution by id).
                    navigate(testsDetailHref(t, sourceRunId), {
                        state: {runDetailHandoff: t},
                    })
                }}
            />
        </div>
    )
}
