import {useEffect, useMemo, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {Button} from '@shared/components'
import {authFetch} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'
import {SettingsSection} from './SettingsSection'

type ProjectSummary = {
    project: string
    runCount: number
    executionCount: number
    lastRunAt: string | null
}

export function SettingsProjectsSection() {
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [projects, setProjects] = useState<ProjectSummary[]>([])

    const navigate = useNavigate()
    const location = useLocation()

    const selectedProject = useMemo(
        () => new URLSearchParams(location.search).get('project') || '',
        [location.search]
    )

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await authFetch(`${config.api.baseUrl}/settings/projects`)
            if (!res.ok) {
                throw new Error(`Request failed (${res.status})`)
            }
            const json = await res.json()
            setProjects(Array.isArray(json?.data) ? json.data : [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load projects')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const deleteProject = async (project: string) => {
        const ok = confirm(
            `⚠️ Delete project "${project}" and ALL related runs, results, attachments, and notes?\n\nThis cannot be undone.`
        )
        if (!ok) return

        setDeleting(project)
        setError(null)
        try {
            const res = await authFetch(
                `${config.api.baseUrl}/settings/projects/${encodeURIComponent(project)}`,
                {method: 'DELETE'}
            )
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || `Delete failed (${res.status})`)
            }

            // If user currently filters by this project, clear it.
            if (selectedProject === project) {
                const params = new URLSearchParams(location.search)
                params.delete('project')
                const qs = params.toString()
                navigate(qs ? `${location.pathname}?${qs}` : location.pathname)
            }

            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete project')
        } finally {
            setDeleting(null)
        }
    }

    return (
        <SettingsSection
            title="Projects"
            description="Manage project tags stored on runs (metadata.project). Admin only.">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {projects.length} project{projects.length === 1 ? '' : 's'}
                    </p>
                    <Button variant="secondary" onClick={load} loading={loading} disabled={loading}>
                        Refresh
                    </Button>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                        {error}
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                            <tr className="text-left text-gray-600 dark:text-gray-300">
                                <th className="px-3 py-2 font-medium">Project</th>
                                <th className="px-3 py-2 font-medium">Runs</th>
                                <th className="px-3 py-2 font-medium">Executions</th>
                                <th className="px-3 py-2 font-medium">Last run</th>
                                <th className="px-3 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-gray-500 dark:text-gray-400">
                                        No project tags found.
                                    </td>
                                </tr>
                            ) : (
                                projects.map((p) => (
                                    <tr
                                        key={p.project}
                                        className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                            {p.project}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {p.runCount}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {p.executionCount}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {p.lastRunAt ? new Date(p.lastRunAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                loading={deleting === p.project}
                                                disabled={!!deleting}
                                                onClick={() => deleteProject(p.project)}>
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsSection>
    )
}

