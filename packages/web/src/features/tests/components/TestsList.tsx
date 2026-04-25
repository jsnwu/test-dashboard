import {useState, useEffect, useLayoutEffect, useRef, useMemo} from 'react'
import {useLocation, useNavigate, useSearchParams} from 'react-router-dom'
import {TestResult} from 'test-dashboard-core'
import {LoadingSpinner} from '@shared/components'
import {authGet} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'
import {useTestsStore} from '../store/testsStore'
import {useTestFilters} from '../hooks'
import {FilterKey, FILTER_OPTIONS} from '../constants'
// import {TestsListHeader} from './TestsListHeader'
import {TestsListFilters} from './TestsListFilters'
import {TestsContent} from './TestsContent'
import {TestDetailModal} from './testDetail'
import {useFlakyTests} from '@features/dashboard'

export interface TestsListProps {
    onTestSelect: (test: TestResult) => void
    selectedTest: TestResult | null
    loading: boolean
}

export default function TestsList({onTestSelect, selectedTest, loading}: TestsListProps) {
    const {tests, error, selectExecution} = useTestsStore()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const fromResults = searchParams.get('from') === 'results'
    const [searchQuery, setSearchQuery] = useState('')
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [detailModalTest, setDetailModalTest] = useState<TestResult | null>(null)
    const lastProcessedUrlKeyRef = useRef<string | null>(null)

    // Initialize filter from URL or default to 'all'
    const getInitialFilter = (): FilterKey => {
        const raw = searchParams.get('filter')
        const filterParam = raw === 'noted' ? 'flaky' : raw
        if (filterParam) {
            const validFilter = FILTER_OPTIONS.find((opt) => opt.key === filterParam)
            if (validFilter) {
                return validFilter.key as FilterKey
            }
        }
        return 'all'
    }

    const [filter, setFilter] = useState<FilterKey>(getInitialFilter)

    const {data: flakyTests = []} = useFlakyTests()
    const flakyTestIds = useMemo(() => new Set(flakyTests.map((f) => f.testId)), [flakyTests])

    const {filteredTests, counts} = useTestFilters({
        tests,
        filter,
        searchQuery,
        flakyTestIds,
    })

    // Sync filter with URL parameter changes
    useEffect(() => {
        const raw = searchParams.get('filter')
        const filterParam = raw === 'noted' ? 'flaky' : raw
        const validFilter = FILTER_OPTIONS.find((opt) => opt.key === filterParam)

        if (validFilter && validFilter.key !== filter) {
            setFilter(validFilter.key as FilterKey)
        } else if (!filterParam && filter !== 'all') {
            setFilter('all')
        }
    }, [searchParams, filter])

    // Deep link: /tests?testId=… opens latest execution; /tests?testId=…&executionId=… opens that run's execution.
    // useLayoutEffect so Results→test handoff opens the modal before paint (same timing as openRun on Results).
    useLayoutEffect(() => {
        const testId = searchParams.get('testId')
        const executionId = searchParams.get('executionId')
        const urlKey = `${testId ?? ''}|${executionId ?? ''}`

        if (urlKey === '|') {
            lastProcessedUrlKeyRef.current = null
            return
        }

        if (lastProcessedUrlKeyRef.current === urlKey) {
            return
        }

        const stripTestParams = () => {
            const params = new URLSearchParams(searchParams)
            params.delete('testId')
            params.delete('executionId')
            params.delete('from')
            params.delete('returnRun')
            setSearchParams(params, {replace: true})
            lastProcessedUrlKeyRef.current = null
        }

        if (executionId) {
            const handoff = (location.state as {runDetailHandoff?: TestResult} | null)
                ?.runDetailHandoff
            const handoffOk = Boolean(
                handoff && handoff.id === executionId && (!testId || handoff.testId === testId)
            )

            if (handoffOk && handoff) {
                selectExecution(executionId)
                setDetailModalTest(handoff)
                setDetailModalOpen(true)
                onTestSelect(handoff)
                lastProcessedUrlKeyRef.current = urlKey
                navigate(
                    {pathname: location.pathname, search: location.search},
                    {replace: true, state: {}}
                )
            }

            let cancelled = false
            void (async () => {
                try {
                    const response = await authGet(
                        `${config.api.baseUrl}/tests/${encodeURIComponent(executionId)}`
                    )
                    if (!response.ok) {
                        if (!cancelled) stripTestParams()
                        return
                    }
                    const data = await response.json()
                    if (!data.success || !data.data) {
                        if (!cancelled) stripTestParams()
                        return
                    }
                    if (cancelled) return

                    const test = data.data as TestResult
                    selectExecution(executionId)
                    setDetailModalTest(test)
                    setDetailModalOpen(true)
                    onTestSelect(test)
                    lastProcessedUrlKeyRef.current = urlKey
                } catch {
                    if (!cancelled) stripTestParams()
                }
            })()

            return () => {
                cancelled = true
            }
        }

        if (testId && tests.length > 0) {
            const test = tests.find((t) => t.testId === testId)
            if (test) {
                selectExecution(null)
                setDetailModalTest(test)
                setDetailModalOpen(true)
                onTestSelect(test)
                lastProcessedUrlKeyRef.current = urlKey
            } else {
                stripTestParams()
            }
        }
        // Intentionally omit `location` / `location.state` from deps: after a handoff we call
        // `navigate(..., { replace: true, state: {} })` without changing the query string; if
        // this effect re-ran, the async cleanup would cancel the refresh fetch.
    }, [searchParams, tests, onTestSelect, setSearchParams, selectExecution, navigate])

    const openTestDetail = (test: TestResult) => {
        setDetailModalTest(test)
        setDetailModalOpen(true)
        onTestSelect(test)

        // Update URL with testId + execution while preserving filter / project / results context
        const params = new URLSearchParams(searchParams)
        params.set('testId', test.testId)
        params.set('executionId', test.id)
        if (params.get('from') !== 'results') {
            params.delete('returnRun')
        }
        setSearchParams(params, {replace: false})
    }

    const closeTestDetail = () => {
        setDetailModalOpen(false)
        setDetailModalTest(null)
        selectExecution(null)

        // Remove test params from URL while preserving filter / project
        const params = new URLSearchParams(searchParams)
        params.delete('testId')
        params.delete('executionId')
        params.delete('from')
        params.delete('returnRun')
        setSearchParams(params, {replace: false})
    }

    const handleBackToResults = () => {
        const params = new URLSearchParams()
        const project = searchParams.get('project')
        if (project) {
            params.set('project', project)
        }
        const returnRun = searchParams.get('returnRun')
        if (returnRun) {
            params.set('openRun', returnRun)
        }
        const qs = params.toString()
        navigate(qs ? `/results?${qs}` : '/results')
    }

    if (loading && tests.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tests</h1>
                </div>

                <div className="card">
                    <div className="card-content">
                        <div className="text-center py-12">
                            <LoadingSpinner size="lg" className="mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">Loading tests...</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tests</h1>

                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                Error loading tests
                            </h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const handleFilterChange = (newFilter: FilterKey) => {
        setFilter(newFilter)

        // Update URL with new filter
        const params = new URLSearchParams(searchParams)
        if (newFilter === 'all') {
            params.delete('filter')
        } else {
            params.set('filter', newFilter)
        }
        setSearchParams(params, {replace: true})
    }

    return (
        <div className="space-y-6">
            {/* <TestsListHeader testsCount={filteredTests.length} /> */}
            <TestsListFilters
                filter={filter}
                onFilterChange={handleFilterChange}
                counts={counts}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            <TestsContent
                tests={filteredTests}
                selectedTest={selectedTest}
                onTestSelect={openTestDetail}
                searchQuery={searchQuery}
                filter={filter}
            />

            <TestDetailModal
                test={detailModalTest}
                isOpen={detailModalOpen}
                onClose={closeTestDetail}
                onBackToResults={fromResults ? handleBackToResults : undefined}
            />
        </div>
    )
}
