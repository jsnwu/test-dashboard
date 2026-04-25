import {useMemo} from 'react'
import {TestResult} from 'test-dashboard-core'
import {FilterKey} from '../constants'

const EMPTY_FLAKY_IDS: ReadonlySet<string> = new Set()

function parseSearchTerms(searchQuery: string): string[] {
    return (searchQuery || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
}

function testMatchesTerms(t: TestResult, terms: string[]): boolean {
    if (terms.length === 0) return true

    const name = (t.name || '').toLowerCase()
    const filePath = (t.filePath || '').toLowerCase()
    const error = (t.errorMessage || '').toLowerCase()

    return terms.every((term) => {
        // Tag term: only look in title/path (where tags live)
        if (term.startsWith('@')) {
            return name.includes(term) || filePath.includes(term)
        }

        // Normal term: match broadly (name/path/error)
        return name.includes(term) || filePath.includes(term) || error.includes(term)
    })
}

export interface UseTestFiltersProps {
    tests: TestResult[]
    filter: FilterKey
    searchQuery: string
    /** Test IDs flagged as flaky by the server (same rules as the Dashboard flaky card). */
    flakyTestIds?: ReadonlySet<string>
}

export interface UseTestFiltersReturn {
    filteredTests: TestResult[]
    counts: {
        all: number
        passed: number
        failed: number
        skipped: number
        pending: number
        flaky: number
    }
}

export function useTestFilters({
    tests,
    filter,
    searchQuery,
    flakyTestIds = EMPTY_FLAKY_IDS,
}: UseTestFiltersProps): UseTestFiltersReturn {
    const terms = useMemo(() => parseSearchTerms(searchQuery), [searchQuery])

    const termScopedTests = useMemo(
        () => tests.filter((t) => testMatchesTerms(t, terms)),
        [tests, terms]
    )

    const filteredTests = useMemo(() => {
        return termScopedTests.filter((test) => {
            if (filter === 'flaky') {
                const isFlaky = flakyTestIds.has(test.testId)
                return isFlaky
            }

            // Handle other filters (all, passed, failed, skipped, pending)
            const statusMatch = filter === 'all' || test.status === filter
            return statusMatch
        })
    }, [termScopedTests, filter, flakyTestIds])

    const counts = useMemo(
        () => ({
            all: termScopedTests.length,
            passed: termScopedTests.filter((t) => t.status === 'passed').length,
            failed: termScopedTests.filter((t) => t.status === 'failed').length,
            skipped: termScopedTests.filter((t) => t.status === 'skipped').length,
            pending: termScopedTests.filter((t) => t.status === 'pending').length,
            flaky: termScopedTests.filter((t) => flakyTestIds.has(t.testId)).length,
        }),
        [termScopedTests, flakyTestIds]
    )

    return {filteredTests, counts}
}
