import {create} from 'zustand'
import {devtools} from 'zustand/middleware'
import {TestResult, TestRun, TestProgress} from 'test-dashboard-core'
import {authGet, authDelete} from '@features/authentication/utils/authFetch'

interface TestsState {
    tests: TestResult[]
    runs: TestRun[]
    isLoading: boolean
    error: string | null
    lastUpdated: Date | null
    selectedExecutionId: string | null
    activeProgress: TestProgress | null

    // Computed function
    getIsAnyTestRunning: () => boolean

    // Actions
    fetchTests: () => Promise<void>
    fetchRuns: () => Promise<void>
    deleteRun: (runId: string) => Promise<void>
    deleteTest: (testId: string) => Promise<void>
    deleteExecution: (testId: string, executionId: string) => Promise<void>
    clearError: () => void
    checkAndRestoreActiveStates: () => Promise<void>
    selectExecution: (executionId: string | null) => void
    updateProgress: (progress: TestProgress) => void
    clearProgress: () => void
}

import {config} from '@config/environment.config'

const API_BASE_URL = config.api.baseUrl

function getSelectedProjectFromUrl(): string | undefined {
    try {
        const params = new URLSearchParams(window.location.search)
        const project = params.get('project')
        return project ? project : undefined
    } catch {
        return undefined
    }
}

function getSelectedTargetEnvFromUrl(): string | undefined {
    try {
        const params = new URLSearchParams(window.location.search)
        const env = params.get('env')
        return env ? env : undefined
    } catch {
        return undefined
    }
}

export const useTestsStore = create<TestsState>()(
    devtools(
        (set, get) => ({
            tests: [],
            runs: [],
            isLoading: false,
            error: null,
            lastUpdated: null,
            selectedExecutionId: null,
            activeProgress: null,

            // Computed function
            getIsAnyTestRunning: () => {
                const state = get()
                return !!state.activeProgress?.runningTests?.length
            },

            fetchTests: async () => {
                try {
                    const currentState = get()
                    // Только устанавливаем isLoading если никакие другие операции не выполняются
                    const shouldSetLoading = !currentState.activeProgress?.runningTests?.length

                    if (shouldSetLoading) {
                        set({isLoading: true, error: null})
                    } else {
                        set({error: null})
                    }

                    const project = getSelectedProjectFromUrl()
                    const targetEnv = getSelectedTargetEnvFromUrl()
                    const q = new URLSearchParams({limit: '200'})
                    if (project) q.set('project', project)
                    if (targetEnv) q.set('targetEnv', targetEnv)
                    const response = await authGet(`${API_BASE_URL}/tests?${q.toString()}`)
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }

                    const data = await response.json()

                    if (data.success && Array.isArray(data.data)) {
                        set({
                            tests: data.data,
                            isLoading: shouldSetLoading ? false : currentState.isLoading,
                            lastUpdated: new Date(),
                        })
                    } else {
                        throw new Error('Invalid response format')
                    }
                } catch (error) {
                    console.error('Error fetching tests:', error)
                    const currentState = get()
                    set({
                        error: error instanceof Error ? error.message : 'Failed to fetch tests',
                        // Только сбрасываем isLoading если мы его устанавливали
                        isLoading: !currentState.activeProgress?.runningTests?.length
                            ? false
                            : currentState.isLoading,
                    })
                }
            },

            fetchRuns: async () => {
                try {
                    const project = getSelectedProjectFromUrl()
                    const targetEnv = getSelectedTargetEnvFromUrl()
                    const rq = new URLSearchParams()
                    if (project) rq.set('project', project)
                    if (targetEnv) rq.set('targetEnv', targetEnv)
                    const runsQs = rq.toString()
                    const response = await authGet(
                        `${API_BASE_URL}/runs${runsQs ? `?${runsQs}` : ''}`
                    )
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }

                    const data = await response.json()

                    if (data.success && Array.isArray(data.data)) {
                        set({runs: data.data})
                    } else {
                        throw new Error('Invalid response format')
                    }
                } catch (error) {
                    console.error('Error fetching runs:', error)
                    set({
                        error: error instanceof Error ? error.message : 'Failed to fetch runs',
                    })
                }
            },

            deleteRun: async (runId: string) => {
                try {
                    set({error: null})

                    const response = await authDelete(
                        `${API_BASE_URL}/runs/${encodeURIComponent(runId)}`
                    )

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }

                    const data = await response.json()

                    if (data.success) {
                        await get().fetchRuns()
                        await get().fetchTests()
                    } else {
                        throw new Error(data.message || 'Failed to delete run')
                    }
                } catch (error) {
                    console.error('Error deleting run:', error)
                    set({
                        error: error instanceof Error ? error.message : 'Failed to delete run',
                    })
                    throw error
                }
            },

            deleteTest: async (testId: string) => {
                try {
                    set({error: null})

                    const response = await authDelete(`${API_BASE_URL}/tests/${testId}`)

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }

                    const data = await response.json()

                    if (data.success) {
                        // Refresh tests list after deletion
                        await get().fetchTests()
                    } else {
                        throw new Error(data.message || 'Failed to delete test')
                    }
                } catch (error) {
                    console.error('Error deleting test:', error)
                    set({
                        error: error instanceof Error ? error.message : 'Failed to delete test',
                    })
                    throw error
                }
            },

            deleteExecution: async (testId: string, executionId: string) => {
                try {
                    set({error: null})

                    const response = await authDelete(
                        `${API_BASE_URL}/tests/${testId}/executions/${executionId}`
                    )

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }

                    const data = await response.json()

                    if (data.success) {
                        // Refresh tests list after deletion to update the latest execution
                        await get().fetchTests()
                    } else {
                        throw new Error(data.message || 'Failed to delete execution')
                    }
                } catch (error) {
                    console.error('Error deleting execution:', error)
                    set({
                        error:
                            error instanceof Error ? error.message : 'Failed to delete execution',
                    })
                    throw error
                }
            },

            clearError: () => set({error: null}),

            checkAndRestoreActiveStates: async () => {
                // This function is now simplified since state restoration
                // is handled by WebSocket connection:status event
            },

            selectExecution: (executionId: string | null) => {
                set({selectedExecutionId: executionId})
            },

            updateProgress: (progress: TestProgress) => {
                set({activeProgress: progress})
            },

            clearProgress: () => {
                set({activeProgress: null})
            },
        }),
        {
            name: 'tests-store',
        }
    )
)
