import { Request, Response } from 'express';
import { UserRepository } from '../repositories';
import { DoshaCalculator, DoshaCalculationResult } from '../services/dosha-calculator.service';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * HealthProfileController
 *
 * Handles health profile management and Ayurvedic dosha assessment endpoints.
 *
 * Endpoints:
 * - POST /api/v1/users/health-profile - Create/update health profile
 * - GET /api/v1/users/health-profile - Get current health profile
 * - POST /api/v1/users/dosha-assessment - Submit questionnaire and calculate dosha
 * - GET /api/v1/users/dosha-assessment/questions - Get questionnaire questions
 */
export class HealthProfileController {
  private userRepo: UserRepository;
  private doshaCalculator: DoshaCalculator;

  constructor() {
    this.userRepo = new UserRepository();
    this.doshaCalculator = new DoshaCalculator();
  }

  /**
   * GET /api/v1/users/dosha-assessment/questions
   * Get all questionnaire questions for dosha assessment
   */
  getQuestions = async (_req: Request, res: Response) => {
    try {
      const questions = this.doshaCalculator.getQuestions();

      return res.json({
        success: true,
        data: questions
      });
    } catch (error) {
      console.error('Get questions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve questions',
        code: 'GET_QUESTIONS_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/users/dosha-assessment
   * Submit questionnaire answers and calculate dosha scores
   *
   * Body: { answers: Answer[] }
   * Supports both formats for selectedOptions:
   *   - Numeric indices: [0, 1, 2]
   *   - Text values: ["option text 1", "option text 2"]
   *
   * Returns: Dosha calculation results + saves to user profile
   */
  submitDoshaAssessment = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { answers } = req.body;

      if (!answers || !Array.isArray(answers)) {
        throw new ValidationError('Answers must be an array');
      }

      // Normalize answers to support both text values and numeric indices
      const normalizedAnswers = this.normalizeAnswerFormat(answers);

      // Validate and calculate dosha scores
      const validation = this.doshaCalculator.validateAnswers(normalizedAnswers);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid questionnaire answers',
          code: 'INVALID_ANSWERS',
          details: validation.errors
        });
      }

      // Calculate dosha scores
      const result: DoshaCalculationResult = this.doshaCalculator.calculateScores(normalizedAnswers);

      // Update user profile with primary dosha
      const updateSuccess = await this.userRepo.updateProfile(req.user.id, {
        dosha: result.primaryDosha as any
      });

      if (!updateSuccess) {
        console.warn(`Failed to update user ${req.user.id} dosha profile`);
      }

      // Get dosha description and recommendations
      const description = this.doshaCalculator.getDoshaDescription(result.primaryDosha);
      const dietaryRecommendations = this.doshaCalculator.getDietaryRecommendations(result.primaryDosha);

      return res.json({
        success: true,
        data: {
          ...result,
          description,
          dietaryRecommendations
        },
        message: 'Dosha assessment completed successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Dosha assessment error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process dosha assessment',
        code: 'ASSESSMENT_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/users/health-profile
   * Get current user's health profile including dosha information
   */
  getHealthProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const user = await this.userRepo.findById(req.user.id);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Build health profile response
      const healthProfile = {
        dosha: user.dosha,
        cuisinePreferences: user.cuisine_preferences,
        dietaryRestrictions: user.dietary_restrictions,
        culturalBackground: user.cultural_background
      };

      // Add dosha description if dosha exists
      let doshaInfo = null;
      if (user.dosha) {
        doshaInfo = {
          primaryDosha: user.dosha,
          description: this.doshaCalculator.getDoshaDescription(user.dosha as any),
          dietaryRecommendations: this.doshaCalculator.getDietaryRecommendations(user.dosha as any)
        };
      }

      return res.json({
        success: true,
        data: {
          profile: healthProfile,
          doshaInfo
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Get health profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve health profile',
        code: 'PROFILE_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/users/health-profile
   * Create or update user health profile
   *
   * Body: {
   *   cuisinePreferences?: string[],
   *   dietaryRestrictions?: DietaryRestriction[],
   *   culturalBackground?: string
   * }
   */
  updateHealthProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const {
        cuisinePreferences,
        dietaryRestrictions,
        culturalBackground
      } = req.body;

      // Build update data
      const updateData: any = {};
      if (cuisinePreferences !== undefined) {
        updateData.cuisine_preferences = cuisinePreferences;
      }
      if (dietaryRestrictions !== undefined) {
        updateData.dietary_restrictions = dietaryRestrictions;
      }
      if (culturalBackground !== undefined) {
        updateData.cultural_background = culturalBackground;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No update data provided',
          code: 'NO_UPDATE_DATA'
        });
      }

      const success = await this.userRepo.updateProfile(req.user.id, updateData);
      if (!success) {
        throw new Error('Failed to update health profile');
      }

      // Get updated user
      const updatedUser = await this.userRepo.findById(req.user.id);
      if (!updatedUser) {
        throw new NotFoundError('User');
      }

      const healthProfile = {
        dosha: updatedUser.dosha,
        cuisinePreferences: updatedUser.cuisine_preferences,
        dietaryRestrictions: updatedUser.dietary_restrictions,
        culturalBackground: updatedUser.cultural_background
      };

      return res.json({
        success: true,
        data: healthProfile,
        message: 'Health profile updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Update health profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update health profile',
        code: 'UPDATE_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/users/dosha-balance
   * Get current dosha balance status and recommendations
   */
  getDoshaBalance = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const user = await this.userRepo.findById(req.user.id);
      if (!user) {
        throw new NotFoundError('User');
      }

      if (!user.dosha) {
        return res.status(404).json({
          success: false,
          error: 'No dosha assessment found. Please complete the health assessment first.',
          code: 'NO_DOSHA_ASSESSMENT'
        });
      }

      const doshaInfo = {
        primaryDosha: user.dosha,
        description: this.doshaCalculator.getDoshaDescription(user.dosha as any),
        dietaryRecommendations: this.doshaCalculator.getDietaryRecommendations(user.dosha as any),
        balanceStatus: this.getBalanceStatus(user.dosha)
      };

      return res.json({
        success: true,
        data: doshaInfo
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Get dosha balance error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve dosha balance',
        code: 'BALANCE_ERROR'
      });
    }
  };

  /**
   * Helper: Normalize answer format to support both text values and numeric indices
   *
   * Accepts selectedOptions as either:
   *   - Numeric indices: [0, 1]
   *   - Text values: ["option text 1", "option text 2"]
   *
   * Returns normalized answers with numeric indices
   */
  private normalizeAnswerFormat(answers: any[]): any[] {
    const questions = this.doshaCalculator.getQuestions();
    const questionMap = new Map<string, any>();

    // Build question lookup map
    questions.sections.forEach(section => {
      section.questions.forEach(q => {
        questionMap.set(q.id, q);
      });
    });

    return answers.map(answer => {
      const { questionId, selectedOptions } = answer;

      // If already numeric indices, return as is
      if (selectedOptions.every((opt: any) => typeof opt === 'number')) {
        return answer;
      }

      // Convert text values to indices
      const question = questionMap.get(questionId);
      if (!question) {
        throw new ValidationError(
          `Invalid question ID: ${questionId}. ` +
          `Example valid format: {"questionId": "q1_body_frame", "selectedOptions": [0]} or ` +
          `{"questionId": "q1_body_frame", "selectedOptions": ["Slim/thin, hard to gain weight"]}`
        );
      }

      const normalizedIndices: number[] = [];
      const invalidTexts: string[] = [];

      for (const optionValue of selectedOptions) {
        if (typeof optionValue === 'number') {
          // Mixed format - keep numeric as is
          normalizedIndices.push(optionValue);
        } else if (typeof optionValue === 'string') {
          // Find matching option by text (case-insensitive, trimmed)
          const normalizedText = optionValue.trim().toLowerCase();
          const optionIndex = question.options.findIndex((opt: any) =>
            opt.text.trim().toLowerCase() === normalizedText
          );

          if (optionIndex === -1) {
            invalidTexts.push(optionValue);
          } else {
            normalizedIndices.push(optionIndex);
          }
        } else {
          throw new ValidationError(
            `Invalid option type for question ${questionId}. ` +
            `Expected number or string, got ${typeof optionValue}. ` +
            `Example: {"selectedOptions": [0]} or {"selectedOptions": ["option text"]}`
          );
        }
      }

      // Report invalid text values with helpful error
      if (invalidTexts.length > 0) {
        const validOptions = question.options.map((opt: any, idx: number) =>
          `  [${idx}] "${opt.text}"`
        ).join('\n');

        throw new ValidationError(
          `Invalid option text(s) for question ${questionId}: ${invalidTexts.map(t => `"${t}"`).join(', ')}.\n` +
          `Valid options are:\n${validOptions}\n\n` +
          `You can use either indices (e.g., [0, 1]) or exact text matches (e.g., ["${question.options[0]?.text}"])`
        );
      }

      return {
        ...answer,
        selectedOptions: normalizedIndices
      };
    });
  }

  /**
   * Helper: Get balance status based on dosha type
   */
  private getBalanceStatus(dosha: string): {
    status: 'balanced' | 'needs_attention';
    tips: string[];
  } {
    // Simplified balance status - in real app would track user interactions
    const isTridosha = dosha === 'tri-dosha' || dosha === 'tridosha';

    return {
      status: isTridosha ? 'balanced' : 'needs_attention',
      tips: isTridosha
        ? ['Maintain variety in your diet', 'Continue balanced eating patterns']
        : [
            'Follow dosha-specific dietary recommendations',
            'Track how different foods affect your energy and digestion',
            'Consider seasonal adjustments to your diet'
          ]
    };
  }
}
