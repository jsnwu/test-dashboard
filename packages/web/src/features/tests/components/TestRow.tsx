import React, {useState, useEffect} from 'react'
import {TestResult} from 'test-dashboard-core'
import {StatusBadge, LoadingSpinner, Badge} from '@shared/components'
import {formatDuration, formatLastRun, parseTestNameTags} from '../utils'
import {useTestsStore} from '../store/testsStore'
import {LinkifiedText} from '@/components/atoms/LinkifiedText'
import {truncateText} from '@/utils/linkify.util'
import {useNoteImages} from '../hooks/useNoteImages'
import {parseNoteContent} from '@/utils/noteContent.util'
import {createProtectedFileURL} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'
import {NoteImage} from 'test-dashboard-core'

export interface TestRowProps {
    test: TestResult
    selected: boolean
    onSelect: (test: TestResult) => void
}

export function TestRow({test, selected, onSelect}: TestRowProps) {
    const {activeProgress} = useTestsStore()

    // Load note images for this test
    const {images: noteImages} = useNoteImages(
        test.note?.content ? test.testId : null,
        !!test.note?.content
    )

    // Find if this test is currently running in the active progress
    const runningInfo = activeProgress?.runningTests.find((t) => t.testId === test.testId)

    const isRunning = !!runningInfo

    const {displayName, tags} = parseTestNameTags(test.name || '')

    // Parse note content to extract images
    const noteParts = test.note?.content ? parseNoteContent(test.note.content, noteImages) : []

    return (
        <tr
            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                isRunning
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500 animate-pulse'
                    : selected
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : ''
            }`}
            onClick={() => onSelect(test)}>
            <td className="w-24 shrink-0 py-3 px-2 md:px-4 align-top">
                {isRunning ? (
                    <Badge variant="info" size="md">
                        <LoadingSpinner size="sm" className="mr-1" />
                        <span className="hidden sm:inline">Running...</span>
                        <span className="sm:hidden">Run</span>
                    </Badge>
                ) : (
                    <StatusBadge status={test.status as any} />
                )}
            </td>
            <td className="min-w-0 py-3 px-3 md:px-6 align-top">
                <div className="font-medium text-gray-900 dark:text-white text-sm md:text-base break-words">
                    {displayName ? displayName : tags.length > 0 ? '—' : test.name || ''}
                </div>
                {/* On mobile, show duration inline under name */}
                <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDuration(test.duration)}
                </div>
                {!runningInfo && test.errorMessage && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2 break-words">
                        {test.errorMessage}
                    </div>
                )}
                {!runningInfo && test.note?.content && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-full flex items-center gap-1 flex-wrap">
                        <span>💬</span>
                        {noteParts.map((part, index) => {
                            if (part.type === 'image' && part.image) {
                                return (
                                    <NoteImageMiniThumbnail
                                        key={`img-${part.imageId}-${index}`}
                                        image={part.image}
                                    />
                                )
                            }
                            // Show all text parts, but truncate each one
                            if (part.type === 'text' && part.content.trim()) {
                                return (
                                    <LinkifiedText
                                        key={`text-${index}`}
                                        text={truncateText(part.content, 50)}
                                        className="truncate"
                                    />
                                )
                            }
                            return null
                        })}
                    </div>
                )}
            </td>
            <td className="w-36 shrink-0 py-3 px-2 md:px-3 align-top">
                {tags.length > 0 ? (
                    <div className="flex flex-wrap content-start gap-1">
                        {tags.map((tag) => (
                            <Badge key={tag} variant="neutral" size="sm" className="font-mono">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                )}
            </td>
            <td className="w-20 shrink-0 py-3 px-2 md:px-4 align-top text-sm tabular-nums text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                {formatDuration(test.duration)}
            </td>
            <td className="w-36 shrink-0 py-3 px-2 md:px-4 align-top text-xs leading-snug text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                {formatLastRun(test)}
            </td>
        </tr>
    )
}

// Small thumbnail component for table rows (16x16px)
function NoteImageMiniThumbnail({image}: {image: NoteImage}) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        const loadImage = async () => {
            try {
                const url = await createProtectedFileURL(image.url, config.api.serverUrl)
                if (isMounted) {
                    setImageUrl(url)
                    setLoading(false)
                }
            } catch {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadImage()

        return () => {
            isMounted = false
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl)
            }
        }
    }, [image.url])

    if (loading || !imageUrl) {
        return (
            <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600" />
        )
    }

    return (
        <img
            src={imageUrl}
            alt=""
            className="inline-block w-4 h-4 rounded border border-gray-300 dark:border-gray-600 object-cover"
            style={{verticalAlign: 'middle'}}
            onClick={(e) => e.stopPropagation()}
        />
    )
}
