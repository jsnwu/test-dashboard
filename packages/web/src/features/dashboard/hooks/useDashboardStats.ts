import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {authFetch} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'

export interface DashboardStats {
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    successRate: number
    totalRuns: number
    recentRuns: any[]
}

async function fetchDashboardStats(project: string | null): Promise<DashboardStats> {
    const url = `${config.api.baseUrl}/runs/stats${project ? `?project=${encodeURIComponent(project)}` : ''}`

    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats')
    }
    const result = await response.json()
    return result.data
}

export function useDashboardStats() {
    const [searchParams] = useSearchParams()
    const project = searchParams.get('project')

    return useQuery({
        queryKey: ['dashboard-stats', project ?? ''],
        queryFn: () => fetchDashboardStats(project),
        refetchInterval: 30000,
    })
}
