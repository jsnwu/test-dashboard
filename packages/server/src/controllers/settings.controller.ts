import {Response} from 'express'
import {SettingsService} from '../services/settings.service'
import {TestService} from '../services/test.service'
import {ResponseHelper} from '../utils/response.helper'
import {Logger} from '../utils/logger.util'
import {ServiceRequest} from '../types/api.types'

export class SettingsController {
    constructor(
        private settingsService: SettingsService,
        private testService: TestService
    ) {}

    getTestExecutionSettings = async (_req: ServiceRequest, res: Response): Promise<Response> => {
        try {
            const settings = await this.settingsService.getTestExecutionSettings()
            return ResponseHelper.success(res, settings)
        } catch (error) {
            Logger.error('Error getting test execution settings', error)
            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to get test execution settings',
                500
            )
        }
    }

    updateGlobalPlaywrightProject = async (
        req: ServiceRequest,
        res: Response
    ): Promise<Response> => {
        try {
            const {project} = req.body

            if (typeof project !== 'string') {
                return ResponseHelper.badRequest(res, 'Project must be a string')
            }

            const settings = await this.settingsService.setGlobalPlaywrightProject(project)
            return ResponseHelper.success(res, settings)
        } catch (error) {
            Logger.error('Error updating global Playwright project', error)

            if (error instanceof Error && error.message.startsWith('Unknown Playwright project:')) {
                return ResponseHelper.badRequest(res, error.message)
            }

            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to update global Playwright project',
                500
            )
        }
    }

    // GET /api/settings/projects - Project tag summaries (admin)
    getProjectTagSummaries = async (_req: ServiceRequest, res: Response): Promise<Response> => {
        try {
            const projects = await this.testService.getProjectTagSummaries()
            return ResponseHelper.success(res, projects, undefined, projects.length)
        } catch (error) {
            Logger.error('Error fetching project tag summaries', error)
            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to fetch project tag summaries',
                500
            )
        }
    }

    // DELETE /api/settings/projects/:project - Delete all data for project tag (admin)
    deleteProjectTag = async (req: ServiceRequest, res: Response): Promise<Response> => {
        try {
            const project = decodeURIComponent(req.params.project || '').trim()
            if (!project) {
                return ResponseHelper.badRequest(res, 'Project tag is required')
            }

            const result = await this.testService.deleteProjectTag(project)
            return ResponseHelper.success(res, result)
        } catch (error) {
            Logger.error('Error deleting project data', error)
            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to delete project data',
                500
            )
        }
    }

    // GET /api/settings/target-envs - Target env summaries (admin)
    getTargetEnvSummaries = async (_req: ServiceRequest, res: Response): Promise<Response> => {
        try {
            const envs = await this.testService.getTargetEnvSummaries()
            return ResponseHelper.success(res, envs, undefined, envs.length)
        } catch (error) {
            Logger.error('Error fetching target env summaries', error)
            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to fetch target env summaries',
                500
            )
        }
    }

    // DELETE /api/settings/target-envs/:env - Delete all data for target env (admin)
    deleteTargetEnv = async (req: ServiceRequest, res: Response): Promise<Response> => {
        try {
            const env = decodeURIComponent(req.params.env || '').trim()
            if (!env) {
                return ResponseHelper.badRequest(res, 'Target env is required')
            }

            const result = await this.testService.deleteTargetEnv(env)
            return ResponseHelper.success(res, result)
        } catch (error) {
            Logger.error('Error deleting target env data', error)
            return ResponseHelper.error(
                res,
                error instanceof Error ? error.message : 'Unknown error',
                'Failed to delete target env data',
                500
            )
        }
    }
}
