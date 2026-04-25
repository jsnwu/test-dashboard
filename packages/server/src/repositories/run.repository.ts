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
