import {Fragment, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import type {TestResult, TestRun} from 'test-dashboard-core'
import {Badge, Button, SearchInput} from '@shared/components'
import {
    FilterButtonGroup,
    ModalBackdrop,
    ConfirmationDialog,
    type FilterOption,
} from '@shared/components/molecules'
import {
    acquireModalBodyScrollLock,
    releaseModalBodyScrollLock,
} from '@shared/utils/modalBodyScrollLock'
import {FilterKey} from '@features/tests/constants'
import {useTestGroups} from '@features/tests/hooks'
import {useTestsStore} from '@features/tests/store/testsStore'
import {parseTestNameTags} from '@features/tests/utils'
import {openAttachmentInNewWindow, openTraceViewer} from '@features/tests/utils/attachmentHelpers'
import {formatRunDateTime, formatRunDurationMs, formatRunTitle} from './runFormatters'

export interface RunDetailModalProps {
    run: TestRun | null
    isOpen: boolean
    onClose: () => void
    loading: boolean
    error: string | null
    runTests: TestResult[] | null
    filteredTests: TestResult[]
    searchQuery: string
    onSearchChange: (query: string) => void
    resultFilter: FilterKey
    onResultFilterChange: (value: FilterKey) => void
    resultFilterOptions: FilterOption[]
    onTestRowClick: (test: TestResult) => void
}

function RunDetailModalTestRow({
    test: t,
    onTestRowClick,
}: {
    test: TestResult
    onTestRowClick: (test: TestResult) => void
}) {
    const {displayName, tags} = parseTestNameTags(t.name || '')
    const title = displayName ? displayName : tags.length > 0 ? '—' : t.name || ''
    const trace = (t.attachments || []).find((a) => a.type === 'trace')
    const video = (t.attachments || []).find((a) => a.type === 'video')
    const screenshot = (t.attachments || []).find((a) => a.type === 'screenshot')

    return (
        <tr
            role="button"
            tabIndex={0}
            aria-label={`Open test: ${t.name}`}
            className="border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => onTestRowClick(t)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onTestRowClick(t)
                }
            }}>
            <td className="py-2.5 px-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {t.status === 'passed'
                    ? '✅ passed'
                    : t.status === 'failed'
                      ? '❌ failed'
                      : t.status === 'skipped'
                        ? '⏭️ skipped'
                        : t.status}
            </td>
            <td className="py-2.5 px-3 text-sm text-gray-900 dark:text-white">{title}</td>
            <td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">
                {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <Badge key={tag} variant="neutral" size="sm" className="font-mono">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                )}
            </td>
            <td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {trace || video || screenshot ? (
                    <div className="flex items-center gap-2">
                        {screenshot && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    openAttachmentInNewWindow(screenshot as any, () => {})
                                }}
                                className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                title="View screenshot">
                                Screenshot
                            </button>
                        )}
                        {video && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    openAttachmentInNewWindow(video as any, () => {})
                                }}
                                className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                title="Open video in a new tab">
                                Video
                            </button>
                        )}
                        {trace && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    openTraceViewer(trace as any, () => {})
                                }}
                                className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                                title="Open in Playwright Trace Viewer">
                                Trace
                            </button>
                        )}
                    </div>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                )}
            </td>
        </tr>
    )
}

export function RunDetailModal({
    run,
    isOpen,
    onClose,
    loading,
    error,
    runTests,
    filteredTests,
    searchQuery,
    onSearchChange,
    resultFilter,
    onResultFilterChange,
    resultFilterOptions,
    onTestRowClick,
}: RunDetailModalProps) {
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [collapsedGroupPaths, setCollapsedGroupPaths] = useState<ReadonlySet<string>>(
        () => new Set()
    )
    const skipOnlyDefaultAppliedRunIdRef = useRef<string | undefined>(undefined)
    const deleteRun = useTestsStore((s) => s.deleteRun)
    const queryClient = useQueryClient()
    const groupedTests = useTestGroups(filteredTests)

    useEffect(() => {
        setShowDeleteConfirmation(false)
    }, [run?.id])

    useEffect(() => {
        skipOnlyDefaultAppliedRunIdRef.current = undefined
    }, [run?.id])

    useEffect(() => {
        if (!run?.id || groupedTests.length === 0) return
        if (skipOnlyDefaultAppliedRunIdRef.current === run.id) return
        skipOnlyDefaultAppliedRunIdRef.current = run.id

        const skipOnlyCollapsed = new Set<string>()
        for (const g of groupedTests) {
            if (g.total > 0 && g.skipped === g.total) {
                skipOnlyCollapsed.add(g.filePath)
            }
        }
        setCollapsedGroupPaths(skipOnlyCollapsed)
    }, [run?.id, groupedTests])

    useLayoutEffect(() => {
        if (!isOpen) return
        acquireModalBodyScrollLock()
        return () => {
            releaseModalBodyScrollLock()
        }
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    const handleDeleteClick = () => setShowDeleteConfirmation(true)
    const handleDeleteCancel = () => setShowDeleteConfirmation(false)

    const handleDeleteConfirm = async () => {
        if (!run) return
        try {
            setIsDeleting(true)
            await deleteRun(run.id)
            queryClient.invalidateQueries({queryKey: ['storage-stats']})
            setShowDeleteConfirmation(false)
            onClose()
        } catch {
            // Store already set error; keep dialog open so user can retry or cancel
        } finally {
            setIsDeleting(false)
        }
    }

    const toggleGroupCollapsed = (filePath: string) => {
        setCollapsedGroupPaths((prev) => {
            const next = new Set(prev)
            if (next.has(filePath)) {
                next.delete(filePath)
            } else {
                next.add(filePath)
            }
            return next
        })
    }

    if (!isOpen) return null

    if (!run) {
        return (
            <div className="fixed inset-0 z-50 overflow-hidden">
                <div className="flex min-h-screen items-center justify-center p-0 md:p-4">
                    <ModalBackdrop onClick={onClose} blur="none" />
                    <div className="relative bg-white dark:bg-gray-800 md:rounded-lg shadow-xl max-w-7xl w-full h-screen md:h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 md:p-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                Loading run…
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                                aria-label="Close">
                                <svg
                                    className="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                            Resolving run…
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const summaryFailed = run.failedTests > 0
    const runLabel = formatRunTitle(run)

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="flex min-h-screen items-center justify-center p-0 md:p-4">
                <ModalBackdrop onClick={onClose} blur="none" />

                <div
                    className="relative bg-white dark:bg-gray-800 md:rounded-lg shadow-xl max-w-7xl w-full h-screen md:h-[90vh] flex flex-col overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="run-detail-title">
                    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                            summaryFailed
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                        }`}>
                                        {summaryFailed ? 'Has failures' : 'All passed'}
                                    </span>
                                    <h2
                                        id="run-detail-title"
                                        className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
                                        {runLabel}
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                                    {run.id}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                    <span>{formatRunDateTime(run.createdAt)}</span>
                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                    <span>{formatRunDurationMs(run.duration, run.status)}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={handleDeleteClick}
                                    className="hidden md:inline-flex">
                                    Delete run
                                </Button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                                    aria-label="Close">
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 md:p-5">
                        {loading && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
                                Loading results…
                            </div>
                        )}
                        {error && (
                            <div className="text-sm text-danger-600 dark:text-danger-400 py-4">
                                {error}
                            </div>
                        )}

                        {!loading && !error && runTests && (
                            <div className="flex flex-col flex-1 min-h-0 gap-3">
                                <div className="min-w-0 max-w-full flex-shrink-0">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="sm:flex-1 sm:max-w-md">
                                            <SearchInput
                                                value={searchQuery}
                                                onChange={(e) => onSearchChange(e.target.value)}
                                                placeholder="Search tests... (e.g. login, @smoke)"
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <FilterButtonGroup
                                                value={resultFilter}
                                                onChange={(value) =>
                                                    onResultFilterChange(value as FilterKey)
                                                }
                                                options={resultFilterOptions}
                                                className="w-fit max-w-full flex-wrap justify-end"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700">
                                            <tr>
                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 w-24">
                                                    Status
                                                </th>
                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                                                    Test
                                                </th>
                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 w-40">
                                                    Tags
                                                </th>
                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 w-44">
                                                    Artifacts
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {runTests.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={4}
                                                        className="py-8 px-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                                        No tests in this run.
                                                    </td>
                                                </tr>
                                            ) : filteredTests.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={4}
                                                        className="py-8 px-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                                        No tests match this filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                groupedTests.map((group) => {
                                                    const expanded = !collapsedGroupPaths.has(
                                                        group.filePath
                                                    )
                                                    return (
                                                        <Fragment key={group.filePath}>
                                                            <tr
                                                                className="bg-gray-100 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200/80 dark:hover:bg-gray-700/80 transition-colors"
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-expanded={expanded}
                                                                aria-label={`${expanded ? 'Collapse' : 'Expand'} file group: ${group.filePath}`}
                                                                onClick={() =>
                                                                    toggleGroupCollapsed(
                                                                        group.filePath
                                                                    )
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (
                                                                        e.key === 'Enter' ||
                                                                        e.key === ' '
                                                                    ) {
                                                                        e.preventDefault()
                                                                        toggleGroupCollapsed(
                                                                            group.filePath
                                                                        )
                                                                    }
                                                                }}>
                                                                <td
                                                                    colSpan={4}
                                                                    className="py-2.5 px-3 text-xs text-gray-800 dark:text-gray-200">
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                                                                                {expanded
                                                                                    ? '▼'
                                                                                    : '▶'}
                                                                            </span>
                                                                            <span className="font-medium font-mono truncate">
                                                                                {group.filePath}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400 sm:justify-end pl-5 sm:pl-0">
                                                                            <span>
                                                                                {group.total} test
                                                                                {group.total !== 1
                                                                                    ? 's'
                                                                                    : ''}
                                                                            </span>
                                                                            {group.passed > 0 && (
                                                                                <span className="text-success-600 dark:text-success-400">
                                                                                    ✅{' '}
                                                                                    {group.passed}
                                                                                </span>
                                                                            )}
                                                                            {group.failed > 0 && (
                                                                                <span className="text-danger-600 dark:text-danger-400">
                                                                                    ❌{' '}
                                                                                    {group.failed}
                                                                                </span>
                                                                            )}
                                                                            {group.skipped > 0 && (
                                                                                <span className="text-warning-600 dark:text-warning-400">
                                                                                    ⏭️{' '}
                                                                                    {group.skipped}
                                                                                </span>
                                                                            )}
                                                                            {group.pending > 0 && (
                                                                                <span className="text-blue-600 dark:text-blue-400">
                                                                                    ⏸️{' '}
                                                                                    {group.pending}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {expanded &&
                                                                group.tests.map((t) => (
                                                                    <RunDetailModalTestRow
                                                                        key={t.id}
                                                                        test={t}
                                                                        onTestRowClick={
                                                                            onTestRowClick
                                                                        }
                                                                    />
                                                                ))}
                                                        </Fragment>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ConfirmationDialog
                    isOpen={showDeleteConfirmation}
                    title="Delete run"
                    description={`Are you sure you want to delete this run (${runLabel})? All results and attachments for this run will be permanently removed. This action cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    variant="danger"
                    isLoading={isDeleting}
                    onConfirm={handleDeleteConfirm}
                    onCancel={handleDeleteCancel}
                />
            </div>
        </div>
    )
}
