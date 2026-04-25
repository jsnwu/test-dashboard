import {TestResult} from 'test-dashboard-core'
import {TestRow} from './TestRow'

export interface TestsTableProps {
    tests: TestResult[]
    selectedTest: TestResult | null
    onTestSelect: (test: TestResult) => void
    showFilePath?: boolean
}

export function TestsTable({
    tests,
    selectedTest,
    onTestSelect,
    showFilePath = false,
}: TestsTableProps) {
    return (
        <div className="overflow-x-clip sm:overflow-x-auto">
            {/* table-fixed + fixed non-name columns so Tags line up across file-group cards */}
            <table className="w-full table-fixed">
                <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <th className="w-24 shrink-0 text-left py-3 px-2 md:px-4 text-xs font-medium text-gray-600 dark:text-gray-400">
                            Status
                        </th>
                        <th className="min-w-0 text-left py-3 px-3 md:px-6 text-xs font-medium text-gray-600 dark:text-gray-400">
                            Test Name
                        </th>
                        <th className="w-36 shrink-0 text-left py-3 px-2 md:px-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                            Tags
                        </th>
                        {showFilePath && (
                            <th className="hidden w-36 shrink-0 text-left py-3 px-2 md:px-4 text-xs font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                                File Path
                            </th>
                        )}
                        <th className="w-20 shrink-0 text-left py-3 px-2 md:px-4 text-xs font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                            Duration
                        </th>
                        <th className="w-36 shrink-0 text-left py-3 px-2 md:px-4 text-xs font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                            Last Run
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map((test) => (
                        <TestRow
                            key={test.id}
                            test={test}
                            selected={selectedTest?.id === test.id}
                            onSelect={onTestSelect}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}
