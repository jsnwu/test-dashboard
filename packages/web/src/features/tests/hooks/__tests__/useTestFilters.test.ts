import {renderHook} from '@testing-library/react'
import {describe, it, expect} from 'vitest'
import {useTestFilters} from '../useTestFilters'
import {TestResult} from 'test-dashboard-core'

const createMockTest = (
    id: string,
    status: 'passed' | 'failed' | 'skipped' | 'pending',
    name: string,
    hasNote: boolean = false
): TestResult => ({
    id,
    testId: `test-${id}`,
    name,
    filePath: `/path/to/${name}.spec.ts`,
    status,
    duration: 100,
    timestamp: new Date().toISOString(),
    runId: 'run-1',
    ...(hasNote && {
        note: {
            testId: `test-${id}`,
            content: 'This is a test note',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    }),
})

describe('useTestFilters', () => {
    const mockTests: TestResult[] = [
        createMockTest('1', 'passed', 'Test 1', true),
        createMockTest('2', 'failed', 'Test 2', false),
        createMockTest('3', 'passed', 'Test 3', false),
        createMockTest('4', 'skipped', 'Test 4', true),
        createMockTest('5', 'pending', 'Test 5', false),
        createMockTest('6', 'failed', 'Test 6', true),
    ]

    describe('Filter by status', () => {
        it('should return all tests when filter is "all"', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(6)
        })

        it('should filter passed tests', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'passed', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(2)
            expect(result.current.filteredTests.every((t) => t.status === 'passed')).toBe(true)
        })

        it('should filter failed tests', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'failed', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(2)
            expect(result.current.filteredTests.every((t) => t.status === 'failed')).toBe(true)
        })

        it('should filter skipped tests', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'skipped', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].status).toBe('skipped')
        })

        it('should filter pending tests', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'pending', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].status).toBe('pending')
        })
    })

    describe('Filter by flaky', () => {
        it('should filter tests whose testId is in flakyTestIds', () => {
            const flakyTestIds = new Set(['test-1', 'test-4', 'test-6'])
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'flaky', searchQuery: '', flakyTestIds})
            )

            expect(result.current.filteredTests).toHaveLength(3)
            expect(result.current.filteredTests.map((t) => t.testId).sort()).toEqual([
                'test-1',
                'test-4',
                'test-6',
            ])
        })

        it('should combine flaky filter with search query', () => {
            const flakyTestIds = new Set(['test-1', 'test-2', 'test-6'])
            const {result} = renderHook(() =>
                useTestFilters({
                    tests: mockTests,
                    filter: 'flaky',
                    searchQuery: 'Test 1',
                    flakyTestIds,
                })
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toBe('Test 1')
        })

        it('should return no tests when flaky set is empty', () => {
            const {result} = renderHook(() =>
                useTestFilters({
                    tests: mockTests,
                    filter: 'flaky',
                    searchQuery: '',
                    flakyTestIds: new Set(),
                })
            )

            expect(result.current.filteredTests).toHaveLength(0)
        })
    })

    describe('Search functionality', () => {
        it('should filter by test name', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: 'Test 1'})
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toBe('Test 1')
        })

        it('should filter by file path', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: 'Test 2.spec'})
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toBe('Test 2')
        })

        it('should be case insensitive', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: 'test 3'})
            )

            expect(result.current.filteredTests).toHaveLength(1)
        })

        it('should combine filter and search', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'passed', searchQuery: 'Test 1'})
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toBe('Test 1')
            expect(result.current.filteredTests[0].status).toBe('passed')
        })
    })

    describe('Counts', () => {
        it('should correctly count all test statuses', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: ''})
            )

            expect(result.current.counts).toEqual({
                all: 6,
                passed: 2,
                failed: 2,
                skipped: 1,
                pending: 1,
                flaky: 0,
            })
        })

        it('should count tests that appear in flakyTestIds', () => {
            const flakyTestIds = new Set(['test-2', 'test-6'])
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: '', flakyTestIds})
            )

            expect(result.current.counts.flaky).toBe(2)
        })

        it('should update flaky count when tests change', () => {
            const flakyTestIds = new Set(['test-7'])
            const {result, rerender} = renderHook(
                ({tests}) => useTestFilters({tests, filter: 'all', searchQuery: '', flakyTestIds}),
                {initialProps: {tests: mockTests}}
            )

            expect(result.current.counts.flaky).toBe(0)

            const newTests = [...mockTests, createMockTest('7', 'passed', 'Test 7', false)]
            rerender({tests: newTests})

            expect(result.current.counts.flaky).toBe(1)
        })
    })

    describe('Edge cases', () => {
        it('should handle empty test array', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: [], filter: 'all', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(0)
            expect(result.current.counts.all).toBe(0)
            expect(result.current.counts.flaky).toBe(0)
        })

        it('should handle flaky filter when no tests match flaky ids', () => {
            const testsWithoutFlaky: TestResult[] = [
                createMockTest('1', 'passed', 'Test 1', false),
                createMockTest('2', 'failed', 'Test 2', false),
            ]

            const {result} = renderHook(() =>
                useTestFilters({
                    tests: testsWithoutFlaky,
                    filter: 'flaky',
                    searchQuery: '',
                    flakyTestIds: new Set(['test-other']),
                })
            )

            expect(result.current.filteredTests).toHaveLength(0)
            expect(result.current.counts.flaky).toBe(0)
        })

        it('should handle empty search query', () => {
            const {result} = renderHook(() =>
                useTestFilters({tests: mockTests, filter: 'all', searchQuery: ''})
            )

            expect(result.current.filteredTests).toHaveLength(6)
        })
    })

    describe('Comma-separated search terms (name + @tags)', () => {
        const tagTests: TestResult[] = [
            createMockTest('1', 'passed', 'Login @staging flow', false),
            createMockTest('2', 'passed', 'Login @prod flow', false),
            createMockTest('3', 'passed', 'Other test', false),
        ]

        it('matches @tag term', () => {
            const {result} = renderHook(() =>
                useTestFilters({
                    tests: tagTests,
                    filter: 'all',
                    searchQuery: '@staging',
                })
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toContain('@staging')
        })

        it('matches multiple terms using AND semantics', () => {
            const {result} = renderHook(() =>
                useTestFilters({
                    tests: tagTests,
                    filter: 'all',
                    searchQuery: 'login, @prod',
                })
            )

            expect(result.current.filteredTests).toHaveLength(1)
            expect(result.current.filteredTests[0].name).toContain('@prod')
        })
    })
})
