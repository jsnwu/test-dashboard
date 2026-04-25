import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'
import {TestGroupHeader} from '../TestGroupHeader'
import type {TestGroupData} from '../../hooks/useTestGroups'

describe('TestGroupHeader', () => {
    const mockGroup: TestGroupData = {
        filePath: 'e2e/tests/auth.spec.ts',
        tests: [
            {
                id: '1',
                testId: 'test-1',
                name: 'Login Test',
                filePath: 'e2e/tests/auth.spec.ts',
                status: 'failed',
                duration: 100,
                runId: 'run-1',
                timestamp: '2025-01-01T00:00:00Z',
            },
            {
                id: '2',
                testId: 'test-2',
                name: 'Logout Test',
                filePath: 'e2e/tests/auth.spec.ts',
                status: 'failed',
                duration: 150,
                runId: 'run-1',
                timestamp: '2025-01-01T00:00:00Z',
            },
        ],
        total: 2,
        passed: 0,
        failed: 2,
        skipped: 0,
        pending: 0,
    }

    it('renders group file path and counts', () => {
        render(<TestGroupHeader group={mockGroup} expanded={true} onToggle={() => {}} />)

        expect(screen.getByText('e2e/tests/auth.spec.ts')).toBeInTheDocument()
        expect(screen.getByText('2 tests')).toBeInTheDocument()
        expect(screen.getByText('❌ 2')).toBeInTheDocument()
    })
})
