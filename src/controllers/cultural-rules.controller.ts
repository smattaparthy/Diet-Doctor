import { Request, Response } from 'express';
import { CulturalRulesService } from '../services/cultural-rules.service';
import { CulturalRule, User, Dosha } from '../types';
import { ValidationError } from '../utils/errors';

export class CulturalRulesController {
  private culturalRulesService: CulturalRulesService;

  constructor() {
    this.culturalRulesService = new CulturalRulesService();
  }

  getAllRules = async (req: Request, res: Response) => {
    try {
      const { type, severity, applicability, ingredient } = req.query;

      let rules: CulturalRule[] = [];

      if (type) {
        rules = await this.culturalRulesService.getCulturalRulesByType(
          type as 'religious' | 'dietary' | 'cultural' | 'ayurvedic'
        );
      } else {
        rules = await this.culturalRulesService.getAllCulturalRules();
      }

      // Filter by other parameters
      if (severity) {
        rules = rules.filter(rule => rule.severity === severity);
      }

      if (applicability) {
        rules = rules.filter(rule =>
          rule.applicability.some(app => app.includes(applicability as string))
        );
      }

      if (ingredient) {
        rules = rules.filter(rule =>
          rule.forbidden_ingredients.some(ing => ing.includes(ingredient as string))
        );
      }

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      console.error('Get cultural rules error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cultural rules',
        code: 'GET_RULES_ERROR'
      });
    }
  };

  validateRecipe = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { recipeId } = req.params;

      const user: User = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        cuisine_preferences: req.user.cuisine_preferences,
        dietary_restrictions: req.user.dietary_restrictions,
        dosha: req.user.dosha as Dosha | null,
        cultural_background: req.user.cultural_background,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at
      };

      const validation = await this.culturalRulesService.validateRecipeForUser(
        parseInt(recipeId),
        user
      );

      return res.json({
        success: true,
        data: validation,
        message: validation.isCompliant
          ? 'Recipe complies with your dietary and cultural restrictions'
          : `Recipe has ${validation.violations.length} compliance issues`
      });
    } catch (error) {
      console.error('Validate recipe error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate recipe',
        code: 'VALIDATE_RECIPE_ERROR'
      });
    }
  };

  validateIngredient = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { ingredient } = req.body;

      if (!ingredient) {
        throw new ValidationError('Ingredient is required');
      }

      const user: User = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        cuisine_preferences: req.user.cuisine_preferences,
        dietary_restrictions: req.user.dietary_restrictions,
        dosha: req.user.dosha as Dosha | null,
        cultural_background: req.user.cultural_background,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at
      };

      const validation = await this.culturalRulesService.validateIngredientForUser(
        ingredient,
        user
      );

      return res.json({
        success: true,
        data: validation,
        message: validation.isAllowed
          ? 'Ingredient is allowed for your dietary profile'
          : `Ingredient violates ${validation.violations.length} dietary restrictions`
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Validate ingredient error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate ingredient',
        code: 'VALIDATE_INGREDIENT_ERROR'
      });
    }
  };

  getSubstitutions = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { ingredient } = req.query;

      if (!ingredient) {
        throw new ValidationError('Ingredient is required');
      }

      const user: User = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        cuisine_preferences: req.user.cuisine_preferences,
        dietary_restrictions: req.user.dietary_restrictions,
        dosha: req.user.dosha as Dosha | null,
        cultural_background: req.user.cultural_background,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at
      };

      const substitutions = await this.culturalRulesService.suggestSubstitutions(
        ingredient as string,
        user
      );

      return res.json({
        success: true,
        data: substitutions,
        message: substitutions.length > 0
          ? `Found ${substitutions.length} substitution options`
          : 'No substitutions needed or available'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Get substitutions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get substitutions',
        code: 'GET_SUBSTITUTIONS_ERROR'
      });
    }
  };

  getAyurvedicRecommendations = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const user: User = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        cuisine_preferences: req.user.cuisine_preferences,
        dietary_restrictions: req.user.dietary_restrictions,
        dosha: req.user.dosha as Dosha | null,
        cultural_background: req.user.cultural_background,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at
      };

      const recommendations = await this.culturalRulesService.getAyurvedicRecommendations(user);

      return res.json({
        success: true,
        data: recommendations,
        message: `Ayurvedic recommendations for ${recommendations.dosha} dosha`
      });
    } catch (error) {
      console.error('Get Ayurvedic recommendations error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get Ayurvedic recommendations',
        code: 'GET_AYURVEDIC_RECOMMENDATIONS_ERROR'
      });
    }
  };

  getHinduDietaryGuidance = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const user: User = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        cuisine_preferences: req.user.cuisine_preferences,
        dietary_restrictions: req.user.dietary_restrictions,
        dosha: req.user.dosha as Dosha | null,
        cultural_background: req.user.cultural_background,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at
      };

      const guidance = await this.culturalRulesService.getHinduDietaryGuidance(user);

      return res.json({
        success: true,
        data: guidance,
        message: 'Hindu dietary guidance and principles'
      });
    } catch (error) {
      console.error('Get Hindu dietary guidance error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get Hindu dietary guidance',
        code: 'GET_HINDU_GUIDANCE_ERROR'
      });
    }
  };

  createRule = async (req: Request, res: Response) => {
    try {
      const ruleData = req.body;

      const ruleId = await this.culturalRulesService.createCulturalRule(ruleData);

      // Get created rule
      const createdRule = await this.culturalRulesService.getAllCulturalRules()
        .then(rules => rules.find(r => r.id === ruleId));

      res.status(201).json({
        success: true,
        data: createdRule,
        message: 'Cultural rule created successfully'
      });
    } catch (error) {
      console.error('Create rule error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create cultural rule',
        code: 'CREATE_RULE_ERROR'
      });
    }
  };

  updateRule = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const success = await this.culturalRulesService.updateCulturalRule(
        parseInt(id),
        updateData
      );

      if (success) {
        // Get updated rule
        const updatedRule = await this.culturalRulesService.getAllCulturalRules()
          .then(rules => rules.find(r => r.id === parseInt(id)));

        if (updatedRule) {
          return res.json({
            success: true,
            data: updatedRule,
            message: 'Cultural rule updated successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update cultural rule',
        code: 'UPDATE_RULE_ERROR'
      });
    } catch (error) {
      console.error('Update rule error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update cultural rule',
        code: 'UPDATE_RULE_ERROR'
      });
    }
  };

  deleteRule = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = await this.culturalRulesService.deleteCulturalRule(parseInt(id));

      res.json({
        success: success,
        message: success ? 'Cultural rule deleted successfully' : 'Cultural rule not found'
      });
    } catch (error) {
      console.error('Delete rule error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete cultural rule',
        code: 'DELETE_RULE_ERROR'
      });
    }
  };

  getForbiddenIngredients = async (_req: Request, res: Response) => {
    try {
      const { CulturalRulesRepository } = await import('../repositories/cultural-rules.repository');
      const rulesRepo = new CulturalRulesRepository();

      const forbiddenIngredients = await rulesRepo.getAllForbiddenIngredients();

      res.json({
        success: true,
        data: forbiddenIngredients,
        message: `Found ${forbiddenIngredients.length} forbidden ingredients across all cultural rules`
      });
    } catch (error) {
      console.error('Get forbidden ingredients error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get forbidden ingredients',
        code: 'GET_FORBIDDEN_INGREDIENTS_ERROR'
      });
    }
  };

  getRuleStatistics = async (_req: Request, res: Response) => {
    try {
      const { CulturalRulesRepository } = await import('../repositories/cultural-rules.repository');
      const rulesRepo = new CulturalRulesRepository();

      const stats = await rulesRepo.getRuleStatistics();

      res.json({
        success: true,
        data: stats,
        message: 'Cultural rules database statistics'
      });
    } catch (error) {
      console.error('Get rule statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rule statistics',
        code: 'GET_RULE_STATS_ERROR'
      });
    }
  };
}