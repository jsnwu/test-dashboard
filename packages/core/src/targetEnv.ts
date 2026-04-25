export type DashboardTargetEnv = 'local' | 'staging' | 'prod'

/**
 * Normalize target env for reporter / dashboard metadata (`metadata.targetEnv`).
 * Accepts `local`, `staging`, `prod`; empty or `all` means unset. Other values are ignored.
 */
export function parseDashboardTargetEnv(
    value: string | undefined | null
): DashboardTargetEnv | undefined {
    if (value == null) return undefined
    const v = String(value).trim().toLowerCase()
    if (!v || v === 'all') return undefined
    if (v === 'local' || v === 'staging' || v === 'prod') return v
    return undefined
}
