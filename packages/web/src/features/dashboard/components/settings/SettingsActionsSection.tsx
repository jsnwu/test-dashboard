import {Button} from '@shared/components'
import {config} from '@config/environment.config'
import {useDashboardActions} from '../../hooks'
import {SettingsSection} from './SettingsSection'

export function SettingsActionsSection() {
    const {clearingData, clearAllData} = useDashboardActions()

    return (
        <SettingsSection title="Actions" description="Common tasks and operations">
            <div className="space-y-3">
                <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => window.open(`${config.api.baseUrl}/health`, '_blank')}>
                    🩺 Check API Health
                </Button>

                <Button
                    variant="danger"
                    fullWidth
                    loading={clearingData}
                    disabled={clearingData}
                    onClick={clearAllData}>
                    {clearingData ? 'Clearing...' : '🗑️ Clear All Data'}
                </Button>
            </div>
        </SettingsSection>
    )
}
