import {BaseRepository} from './base.repository'
import {TestRunData} from '../types/database.types'
import {IRunRepository} from '../types/service.types'

export class RunRepository extends BaseRepository implements IRunRepository {
    async createTestRun(runData: TestRunData): Promise<string> {
        await this.dbManager.createTestRun(runData)
        return runData.id
    }

    async updateTestRun(runId: string, updates: Partial<TestRunData>): Promise<void> {
        return this.dbManager.updateTestRun(runId, updates)
    }

    async getTestRun(runId: string): Promise<TestRunData | null> {
        const row = await this.queryOne<any>('SELECT * FROM test_runs WHERE id = ?', [runId])

        if (!row) return null

        return {
            id: row.id,
            runName: row.run_name ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status,
            totalTests: row.total_tests,
            passedTests: row.passed_tests,
            failedTests: row.failed_tests,
            skippedTests: row.skipped_tests,
            duration: row.duration,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }
    }

    async getStats(project?: string): Promise<any> {
        return this.dbManager.getStats(project)
    }

    /**
     * Distinct non-empty `metadata.project` values from `test_runs` (reporter / API tags),
     * for dashboard filters beyond Playwright config project names.
     */
    async getDistinctRunProjectTags(): Promise<string[]> {
        const rows = await this.queryAll<{p: string | null}>(
            `
            SELECT DISTINCT json_extract(metadata, '$.project') AS p
            FROM test_runs
            WHERE json_extract(metadata, '$.project') IS NOT NULL
              AND trim(cast(json_extract(metadata, '$.project') AS text)) != ''
            ORDER BY p ASC
            `
        )
        return rows
            .map((r) => r.p)
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
    }

    async getDistinctRunTargetEnvTags(): Promise<string[]> {
        const rows = await this.queryAll<{e: string | null}>(
            `
            SELECT DISTINCT json_extract(metadata, '$.targetEnv') AS e
            FROM test_runs
            WHERE json_extract(metadata, '$.targetEnv') IS NOT NULL
              AND trim(cast(json_extract(metadata, '$.targetEnv') AS text)) != ''
            ORDER BY e ASC
            `
        )
        return rows
            .map((r) => r.e)
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
    }

    async getProjectTagSummaries(): Promise<
        Array<{project: string; runCount: number; executionCount: number; lastRunAt: string | null}>
    > {
        const rows = await this.queryAll<{
            project: string
            runCount: number
            executionCount: number
            lastRunAt: string | null
        }>(
            `
            WITH tagged_runs AS (
              SELECT
                id,
                created_at,
                json_extract(metadata, '$.project') AS project
              FROM test_runs
              WHERE json_extract(metadata, '$.project') IS NOT NULL
                AND trim(cast(json_extract(metadata, '$.project') AS text)) != ''
            ),
            run_stats AS (
              SELECT
                project,
                COUNT(*) AS runCount,
                MAX(created_at) AS lastRunAt
              FROM tagged_runs
              GROUP BY project
            ),
            execution_stats AS (
              SELECT
                tr.project AS project,
                COUNT(res.id) AS executionCount
              FROM tagged_runs tr
              LEFT JOIN test_results res ON res.run_id = tr.id
              GROUP BY tr.project
            )
            SELECT
              rs.project AS project,
              rs.runCount AS runCount,
              COALESCE(es.executionCount, 0) AS executionCount,
              rs.lastRunAt AS lastRunAt
            FROM run_stats rs
            LEFT JOIN execution_stats es ON es.project = rs.project
            ORDER BY rs.project ASC
            `
        )
        return rows.map((r) => ({
            project: r.project,
            runCount: Number(r.runCount) || 0,
            executionCount: Number(r.executionCount) || 0,
            lastRunAt: r.lastRunAt ?? null,
        }))
    }

    async deleteRunsByProjectTag(projectTag: string): Promise<number> {
        const result = await this.dbManager.execute(
            `
            DELETE FROM test_runs
            WHERE json_extract(metadata, '$.project') = ?
            `,
            [projectTag]
        )
        return result.changes || 0
    }

    async getTargetEnvSummaries(): Promise<
        Array<{targetEnv: string; runCount: number; executionCount: number; lastRunAt: string | null}>
    > {
        const rows = await this.queryAll<{
            targetEnv: string
            runCount: number
            executionCount: number
            lastRunAt: string | null
        }>(
            `
            WITH tagged_runs AS (
              SELECT
                id,
                created_at,
                json_extract(metadata, '$.targetEnv') AS targetEnv
              FROM test_runs
              WHERE json_extract(metadata, '$.targetEnv') IS NOT NULL
                AND trim(cast(json_extract(metadata, '$.targetEnv') AS text)) != ''
            ),
            run_stats AS (
              SELECT
                targetEnv,
                COUNT(*) AS runCount,
                MAX(created_at) AS lastRunAt
              FROM tagged_runs
              GROUP BY targetEnv
            ),
            execution_stats AS (
              SELECT
                tr.targetEnv AS targetEnv,
                COUNT(res.id) AS executionCount
              FROM tagged_runs tr
              LEFT JOIN test_results res ON res.run_id = tr.id
              GROUP BY tr.targetEnv
            )
            SELECT
              rs.targetEnv AS targetEnv,
              rs.runCount AS runCount,
              COALESCE(es.executionCount, 0) AS executionCount,
              rs.lastRunAt AS lastRunAt
            FROM run_stats rs
            LEFT JOIN execution_stats es ON es.targetEnv = rs.targetEnv
            ORDER BY rs.targetEnv ASC
            `
        )
        return rows.map((r) => ({
            targetEnv: r.targetEnv,
            runCount: Number(r.runCount) || 0,
            executionCount: Number(r.executionCount) || 0,
            lastRunAt: r.lastRunAt ?? null,
        }))
    }

    async deleteRunsByTargetEnv(targetEnv: string): Promise<number> {
        const result = await this.dbManager.execute(
            `
            DELETE FROM test_runs
            WHERE json_extract(metadata, '$.targetEnv') = ?
            `,
            [targetEnv]
        )
        return result.changes || 0
    }

    async deleteTestRun(runId: string): Promise<void> {
        await this.execute('DELETE FROM test_runs WHERE id = ?', [runId])
    }

    async getAllTestRuns(
        limit: number = 50,
        project?: string,
        targetEnv?: string
    ): Promise<TestRunData[]> {
        let sql = 'SELECT * FROM test_runs'
        const params: unknown[] = []
        const conditions: string[] = []

        if (project) {
            conditions.push(`json_extract(metadata, '$.project') = ?`)
            params.push(project)
        }
        if (targetEnv) {
            conditions.push(`json_extract(metadata, '$.targetEnv') = ?`)
            params.push(targetEnv)
        }
        if (conditions.length) {
            sql += ` WHERE ${conditions.join(' AND ')}`
        }

        sql += ' ORDER BY created_at DESC LIMIT ?'
        params.push(limit)

        const rows = await this.queryAll<any>(sql, params)

        return rows.map((row) => ({
            id: row.id,
            runName: row.run_name ?? null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status,
            totalTests: row.total_tests,
            passedTests: row.passed_tests,
            failedTests: row.failed_tests,
            skippedTests: row.skipped_tests,
            duration: row.duration,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }))
    }
}
