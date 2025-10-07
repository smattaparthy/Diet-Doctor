import { Request, Response } from 'express';
import { MealPlanRepository, RecipeRepository } from '../repositories';
import { CulturalRulesService } from '../services/cultural-rules.service';
import { MealPlan, MealPlanRow, RecipeRow, GenerateMealPlanRequest, Meal, NutritionalInfo, User, Dosha } from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';

export class MealPlanController {
  private mealPlanRepo: MealPlanRepository;
  private recipeRepo: RecipeRepository;
  private culturalRulesService: CulturalRulesService;

  constructor() {
    this.mealPlanRepo = new MealPlanRepository();
    this.recipeRepo = new RecipeRepository();
    this.culturalRulesService = new CulturalRulesService();
  }

  generateMealPlan = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const request: GenerateMealPlanRequest = req.body;

      // Validate date range
      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);
      if (endDate < startDate) {
        throw new ValidationError('End date must be after start date');
      }

      // Calculate all dates in the range
      const dates: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const generatedMealPlans: MealPlan[] = [];

      for (const date of dates) {
        const meals: Partial<MealPlan> = {
          user_id: req.user.id,
          date
        };

        let totalNutrition: NutritionalInfo = {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          sugar_g: 0,
          sodium_mg: 0
        };

        let complianceScore = 100;

        // Generate meals based on preferences
        if (request.meal_preferences.breakfast) {
          const breakfast = await this.generateMeal(req.user, 'breakfast', request);
          if (breakfast) {
            meals.breakfast = breakfast;
            totalNutrition = await this.addNutrition(totalNutrition, breakfast.recipe_id, breakfast.serving_size);
          }
        }

        if (request.meal_preferences.lunch) {
          const lunch = await this.generateMeal(req.user, 'lunch', request);
          if (lunch) {
            meals.lunch = lunch;
            totalNutrition = await this.addNutrition(totalNutrition, lunch.recipe_id, lunch.serving_size);
          }
        }

        if (request.meal_preferences.dinner) {
          const dinner = await this.generateMeal(req.user, 'dinner', request);
          if (dinner) {
            meals.dinner = dinner;
            totalNutrition = await this.addNutrition(totalNutrition, dinner.recipe_id, dinner.serving_size);
          }
        }

        if (request.meal_preferences.snack) {
          const snack = await this.generateMeal(req.user, 'snack', request);
          if (snack) {
            meals.snack = snack;
            totalNutrition = await this.addNutrition(totalNutrition, snack.recipe_id, snack.serving_size);
          }
        }

        // Calculate compliance score
        const mealIds = [
          meals.breakfast?.recipe_id,
          meals.lunch?.recipe_id,
          meals.dinner?.recipe_id,
          meals.snack?.recipe_id
        ].filter(Boolean) as number[];

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

        for (const recipeId of mealIds) {
          const validation = await this.culturalRulesService.validateRecipeForUser(recipeId, user);
          complianceScore = Math.min(complianceScore, validation.complianceScore);
        }

        meals.total_nutrition = totalNutrition;
        meals.cultural_compliance_score = complianceScore;

        const mealPlanId = await this.mealPlanRepo.createOrUpdateMealPlan(meals as Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>);
        const createdMealPlan = await this.mealPlanRepo.findById(mealPlanId);

        if (createdMealPlan) {
          generatedMealPlans.push(createdMealPlan);
        }
      }

      return res.status(201).json({
        success: true,
        data: generatedMealPlans,
        message: `Generated meal plan for ${dates.length} days`
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Generate meal plan error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate meal plan',
        code: 'MEAL_PLAN_GENERATION_ERROR'
      });
    }
  };

  getMealPlans = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { start_date, end_date, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const mealPlans = await this.mealPlanRepo.findByUserId(
        req.user.id,
        start_date as string,
        end_date as string,
        parseInt(limit as string),
        offset
      );

      // Get total count for pagination
      let total = 0;
      if (start_date && end_date) {
        const allPlans = await this.mealPlanRepo.findByUserId(req.user.id, start_date as string, end_date as string, 1000, 0);
        total = allPlans.length;
      } else {
        const allPlans = await this.mealPlanRepo.findByUserId(req.user.id);
        total = allPlans.length;
      }

      const parsedPlans: MealPlan[] = mealPlans.map(planRow => {
        const row = planRow as unknown as MealPlanRow;
        return {
          ...row,
          breakfast: row.breakfast ? JSON.parse(row.breakfast) : undefined,
          lunch: row.lunch ? JSON.parse(row.lunch) : undefined,
          dinner: row.dinner ? JSON.parse(row.dinner) : undefined,
          snack: row.snack ? JSON.parse(row.snack) : undefined,
          total_nutrition: JSON.parse(row.total_nutrition)
        };
      });

      return res.json({
        success: true,
        data: parsedPlans,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          total_pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Get meal plans error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal plans',
        code: 'GET_MEAL_PLANS_ERROR'
      });
    }
  };

  getMealPlanByDate = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { date } = req.params;

      const mealPlan = await this.mealPlanRepo.findByDate(req.user.id, date);
      if (!mealPlan) {
        return res.status(404).json({
          success: false,
          error: 'Meal plan not found for this date',
          code: 'MEAL_PLAN_NOT_FOUND'
        });
      }

      // Get recipe details for each meal
      const enrichedPlan = await this.enrichMealPlan(mealPlan);

      return res.json({
        success: true,
        data: enrichedPlan
      });
    } catch (error) {
      console.error('Get meal plan by date error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal plan',
        code: 'GET_MEAL_PLAN_ERROR'
      });
    }
  };

  updateMeal = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { date } = req.params;
      const { meal_type, recipe_id, serving_size, notes, substitutions } = req.body;

      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal_type)) {
        throw new ValidationError('Invalid meal type');
      }

      // Verify meal plan exists
      const existingPlan = await this.mealPlanRepo.findByDate(req.user.id, date);
      if (!existingPlan) {
        return res.status(404).json({
          success: false,
          error: 'Meal plan not found for this date',
          code: 'MEAL_PLAN_NOT_FOUND'
        });
      }

      // Verify recipe exists and is compliant
      const recipe = await this.recipeRepo.findById(recipe_id);
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      // Parse user data to ensure dosha is correct type
      const userForValidation: User = {
        ...req.user,
        dosha: req.user.dosha as Dosha | null
      };
      const validation = await this.culturalRulesService.validateRecipeForUser(recipe_id, userForValidation);
      if (!validation.isCompliant) {
        return res.status(422).json({
          success: false,
          error: 'Recipe violates dietary restrictions',
          code: 'CULTURAL_COMPLIANCE_VIOLATION',
          details: validation.violations
        });
      }

      const meal: Meal = {
        recipe_id,
        serving_size,
        notes,
        substitutions
      };

      const success = await this.mealPlanRepo.updateMeal(req.user.id, date, meal_type, meal);

      if (success) {
        // Get updated meal plan
        const updatedPlan = await this.mealPlanRepo.findByDate(req.user.id, date);
        if (updatedPlan) {
          const enrichedPlan = await this.enrichMealPlan(updatedPlan);
          return res.json({
            success: true,
            data: enrichedPlan,
            message: 'Meal updated successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update meal',
        code: 'UPDATE_MEAL_ERROR'
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Update meal error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update meal',
        code: 'UPDATE_MEAL_ERROR'
      });
    }
  };

  deleteMealPlan = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { date } = req.params;

      const success = await this.mealPlanRepo.deleteMealPlan(req.user.id, date);

      return res.json({
        success: success,
        message: success ? 'Meal plan deleted successfully' : 'Meal plan not found'
      });
    } catch (error) {
      console.error('Delete meal plan error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete meal plan',
        code: 'DELETE_MEAL_PLAN_ERROR'
      });
    }
  };

  getMealPlanStats = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { start_date, end_date } = req.query;

      const stats = await this.mealPlanRepo.getMealPlanStats(
        req.user.id,
        start_date as string,
        end_date as string
      );

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get meal plan stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal plan statistics',
        code: 'GET_STATS_ERROR'
      });
    }
  };

  private async generateMeal(user: any, mealType: string, request: GenerateMealPlanRequest): Promise<Meal | null> {
    // Simple meal generation logic - in production, this would be more sophisticated
    let whereClause = '1=1';
    const params: any[] = [];

    // Filter by cuisine preferences
    if (request.cuisine_preferences && request.cuisine_preferences.length > 0) {
      const cuisineConditions = request.cuisine_preferences.map(() => 'cuisine_type = ?').join(' OR ');
      whereClause += ` AND (${cuisineConditions})`;
      params.push(...request.cuisine_preferences);
    }

    // Filter by prep time
    if (request.max_prep_time) {
      whereClause += ' AND prep_time_minutes <= ?';
      params.push(request.max_prep_time);
    }

    // Get random recipe matching criteria
    const recipes = await this.recipeRepo.executeQuery(`
      SELECT * FROM recipes
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT 1
    `, params);

    if (recipes.length === 0) return null;

    // Check cultural compliance
    const validation = await this.culturalRulesService.validateRecipeForUser(recipes[0].id, user);
    if (!validation.isCompliant) {
      // Try to find alternative
      return this.generateMeal(user, mealType, request); // Recursive call
    }

    return {
      recipe_id: recipes[0].id,
      serving_size: 1,
      notes: '',
      substitutions: []
    };
  }

  private async addNutrition(current: NutritionalInfo, recipeId: number, servingSize: number): Promise<NutritionalInfo> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) return current;

    const recipeRow = recipe as unknown as RecipeRow;
    const nutrition: NutritionalInfo = JSON.parse(recipeRow.nutritional_info);
    const multiplier = servingSize;

    return {
      calories: current.calories + (nutrition.calories * multiplier),
      protein_g: current.protein_g + (nutrition.protein_g * multiplier),
      carbs_g: current.carbs_g + (nutrition.carbs_g * multiplier),
      fat_g: current.fat_g + (nutrition.fat_g * multiplier),
      fiber_g: current.fiber_g + (nutrition.fiber_g * multiplier),
      sugar_g: current.sugar_g + (nutrition.sugar_g * multiplier),
      sodium_mg: current.sodium_mg + (nutrition.sodium_mg * multiplier)
    };
  }

  private async enrichMealPlan(mealPlan: MealPlan): Promise<any> {
    const enriched: any = { ...mealPlan };

    // Enrich each meal with recipe details
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      const meal = mealPlan[mealType as keyof Pick<MealPlan, 'breakfast' | 'lunch' | 'dinner' | 'snack'>];
      if (meal) {
        const recipe = await this.recipeRepo.findById(meal.recipe_id);
        if (recipe) {
          const recipeRow = recipe as unknown as RecipeRow;
          enriched[mealType] = {
            ...meal,
            recipe: {
              ...recipeRow,
              ingredients: JSON.parse(recipeRow.ingredients),
              ayurvedic_info: JSON.parse(recipeRow.ayurvedic_info)
            }
          };
        }
      }
    }

    return enriched;
  }
}