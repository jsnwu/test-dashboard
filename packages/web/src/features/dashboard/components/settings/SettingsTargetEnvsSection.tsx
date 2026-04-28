import {useEffect, useMemo, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {Button} from '@shared/components'
import {authFetch} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'
import {SettingsSection} from './SettingsSection'

type TargetEnvSummary = {
    targetEnv: string
    runCount: number
    executionCount: number
    lastRunAt: string | null
}

export function SettingsTargetEnvsSection() {
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [envs, setEnvs] = useState<TargetEnvSummary[]>([])

    const navigate = useNavigate()
    const location = useLocation()

    const selectedEnv = useMemo(
        () => new URLSearchParams(location.search).get('env') || '',
        [location.search]
    )

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await authFetch(`${config.api.baseUrl}/settings/target-envs`)
            if (!res.ok) throw new Error(`Request failed (${res.status})`)
            const json = await res.json()
            setEnvs(Array.isArray(json?.data) ? json.data : [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load target envs')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const deleteEnv = async (env: string) => {
        const ok = confirm(
            `⚠️ Delete target env "${env}" and ALL related runs, results, attachments, and notes?\n\nThis cannot be undone.`
        )
        if (!ok) return

        setDeleting(env)
        setError(null)
        try {
            const res = await authFetch(
                `${config.api.baseUrl}/settings/target-envs/${encodeURIComponent(env)}`,
                {method: 'DELETE'}
            )
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || `Delete failed (${res.status})`)
            }

            if (selectedEnv === env) {
                const params = new URLSearchParams(location.search)
                params.delete('env')
                const qs = params.toString()
                navigate(qs ? `${location.pathname}?${qs}` : location.pathname)
            }

            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete target env')
        } finally {
            setDeleting(null)
        }
    }

    return (
        <SettingsSection
            title="Target environments"
            description="Manage target env tags stored on runs (metadata.targetEnv). Admin only.">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {envs.length} env{envs.length === 1 ? '' : 's'}
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
                                <th className="px-3 py-2 font-medium">Env</th>
                                <th className="px-3 py-2 font-medium">Runs</th>
                                <th className="px-3 py-2 font-medium">Executions</th>
                                <th className="px-3 py-2 font-medium">Last run</th>
                                <th className="px-3 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {envs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-3 py-4 text-gray-500 dark:text-gray-400">
                                        No target env tags found.
                                    </td>
                                </tr>
                            ) : (
                                envs.map((e) => (
                                    <tr
                                        key={e.targetEnv}
                                        className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                            {e.targetEnv}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {e.runCount}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {e.executionCount}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                                            {e.lastRunAt ? new Date(e.lastRunAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                loading={deleting === e.targetEnv}
                                                disabled={!!deleting}
                                                onClick={() => deleteEnv(e.targetEnv)}>
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

