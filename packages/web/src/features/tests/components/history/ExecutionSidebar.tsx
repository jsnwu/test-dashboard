import {TestResult} from 'test-dashboard-core'
import {ExecutionItem} from './ExecutionItem'

export interface ExecutionSidebarProps {
    executions: TestResult[]
    currentExecutionId: string
    onSelectExecution: (executionId: string) => void
    onDeleteExecution: (executionId: string) => void
    testId: string
    loading?: boolean
    error?: string
    /** Clears selection to return to the latest run; link only shows when current ≠ latest. */
    onBackToLatest?: () => void
}

export function ExecutionSidebar({
    executions,
    currentExecutionId,
    onSelectExecution,
    onDeleteExecution,
    testId: _testId,
    loading,
    error,
    onBackToLatest,
}: ExecutionSidebarProps) {
    const latestExecutionId = executions[0]?.id
    const showBackToLatest =
        Boolean(onBackToLatest) &&
        Boolean(latestExecutionId) &&
        currentExecutionId !== latestExecutionId

    return (
        <div className="w-80 h-full min-h-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 z-10">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                        Execution History
                    </h3>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
                            {executions.length}{' '}
                            {executions.length === 1 ? 'execution' : 'executions'}
                        </p>
                        {showBackToLatest && (
                            <button
                                type="button"
                                onClick={onBackToLatest}
                                className="flex-shrink-0 whitespace-nowrap text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                                ← Back to latest
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400" />
                    </div>
                )}

                {error && (
                    <div className="text-center py-8 px-2">
                        <p className="text-xs text-danger-600 dark:text-danger-400">
                            Error loading history: {error}
                        </p>
                    </div>
                )}

                {!loading && !error && executions.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">No execution history</p>
                    </div>
                )}

                {!loading && !error && executions.length > 0 && (
                    <div className="space-y-2">
                        {executions.map((execution, index) => (
                            <ExecutionItem
                                key={execution.id}
                                execution={execution}
                                isCurrent={execution.id === currentExecutionId}
                                isLatest={index === 0}
                                onSelect={onSelectExecution}
                                onDelete={onDeleteExecution}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
