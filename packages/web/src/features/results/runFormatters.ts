import type {TestRun} from 'test-dashboard-core'

export function formatRunTitle(run: TestRun) {
    return (run.runName || '').trim() || run.id
}

export function formatRunDateTime(iso?: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})
}

export function formatRunDurationMs(ms?: number | null, status?: TestRun['status']): string {
    if (status === 'running' && (ms == null || ms <= 0)) {
        return 'Running…'
    }
    if (ms == null || ms < 0) return '—'
    if (ms < 1000) return `${ms} ms`
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const sec = s % 60
    if (m < 60) return `${m}m ${sec}s`
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}h ${min}m ${sec}s`
}
