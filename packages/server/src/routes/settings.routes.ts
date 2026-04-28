import {Router} from 'express'
import {SettingsController} from '../controllers/settings.controller'
import {ServiceContainer} from '../middleware/service-injection.middleware'
import {createAuthMiddleware, requireAdmin, requireJWT} from '../middleware/auth.middleware'

export function createSettingsRoutes(container: ServiceContainer): Router {
    const router = Router()
    const settingsController = new SettingsController(container.settingsService, container.testService)
    const authMiddleware = createAuthMiddleware(container.authService)

    router.use(authMiddleware, requireJWT())

    router.get('/test-execution', settingsController.getTestExecutionSettings)
    router.put('/test-execution/project', settingsController.updateGlobalPlaywrightProject)

    // Admin-only project management (project tags stored on runs)
    router.get('/projects', requireAdmin(), settingsController.getProjectTagSummaries)
    router.delete('/projects/:project', requireAdmin(), settingsController.deleteProjectTag)

    // Admin-only target env management (targetEnv stored on runs)
    router.get('/target-envs', requireAdmin(), settingsController.getTargetEnvSummaries)
    router.delete('/target-envs/:env', requireAdmin(), settingsController.deleteTargetEnv)

    return router
}
