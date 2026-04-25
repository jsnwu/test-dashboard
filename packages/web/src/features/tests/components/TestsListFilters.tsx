import {FilterButtonGroup, SearchInput} from '@shared/components'
import {FilterKey, FILTER_OPTIONS} from '../constants'

export interface TestsListFiltersProps {
    filter: FilterKey
    onFilterChange: (filter: FilterKey) => void
    counts: {
        all: number
        passed: number
        failed: number
        skipped: number
        pending: number
        flaky: number
    }
    searchQuery: string
    onSearchChange: (query: string) => void
    onExpandAll?: () => void
    onCollapseAll?: () => void
}

export function TestsListFilters({
    filter,
    onFilterChange,
    counts,
    searchQuery,
    onSearchChange,
    onExpandAll,
    onCollapseAll,
}: TestsListFiltersProps) {
    const filterOptions = FILTER_OPTIONS.map((option) => ({
        ...option,
        count: counts[option.key as keyof typeof counts],
    }))

    return (
        <div className="space-y-3">
            <div className="space-y-3">
                {/* Row 1: count + expand/collapse */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                        {onExpandAll && onCollapseAll && (
                            <div className="hidden sm:flex space-x-2">
                                <button
                                    onClick={onExpandAll}
                                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    Expand All
                                </button>
                                <button
                                    onClick={onCollapseAll}
                                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    Collapse All
                                </button>
                            </div>
                        )}
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                            Tests
                        </h1>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400 text-right flex-shrink-0">
                        <div>
                            {counts.all} test{counts.all !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>

                {/* Row 2: search left + filter buttons right (Results-style) */}
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-6">
                    <div className="flex w-full min-w-0 justify-start">
                        <SearchInput
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search tests... (e.g. login, @smoke)"
                            className="w-full md:w-96 max-w-md"
                        />
                    </div>

                    <div className="flex w-full justify-end overflow-x-auto overscroll-x-contain pb-1 lg:w-auto lg:pb-0 lg:justify-self-end">
                        <FilterButtonGroup
                            value={filter}
                            onChange={(value) => onFilterChange(value as FilterKey)}
                            options={filterOptions}
                            className="min-w-max"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
