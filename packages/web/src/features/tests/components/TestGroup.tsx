import {useState} from 'react'
import {TestResult} from 'test-dashboard-core'
import {Card} from '@shared/components'
import {TestGroupData} from '../hooks/useTestGroups'
import {TestGroupHeader} from './TestGroupHeader'
import {TestsTable} from './TestsTable'
import {FilterKey} from '../constants'

export interface TestGroupProps {
    group: TestGroupData
    selectedTest: TestResult | null
    onTestSelect: (test: TestResult) => void
    filter?: FilterKey
}

export function TestGroup({group, selectedTest, onTestSelect, filter}: TestGroupProps) {
    const [expanded, setExpanded] = useState(true)

    return (
        <Card padding="none">
            <TestGroupHeader
                group={group}
                expanded={expanded}
                onToggle={() => setExpanded(!expanded)}
                filter={filter}
            />

            {expanded && (
                <TestsTable
                    tests={group.tests}
                    selectedTest={selectedTest}
                    onTestSelect={onTestSelect}
                />
            )}
        </Card>
    )
}
