import { Request, Response } from 'express';
import { mealPlanGenerator } from '../services/MealPlanGenerator';
import { ApiResponse, WeeklyMealPlan } from '../types';
import { DatabaseConnection } from '../database/connection';

const db = DatabaseConnection.getInstance();

/**
 * Meal Plan Controller
 * Handles HTTP requests for meal plan generation and management
 */

export class MealPlanController {
  /**
   * POST /api/v1/meal-plans/generate
   * Generate a new meal plan
   */
  async generateMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        startDate,
        daysCount,
        mealsPerDay,
        servings,
        preferences
      } = req.body;

      // Validation
      if (!userId || !startDate || !daysCount || !mealsPerDay || !servings) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, startDate, daysCount, mealsPerDay, servings'
        } as ApiResponse);
        return;
      }

      // Parse start date
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid startDate format. Use YYYY-MM-DD'
        } as ApiResponse);
        return;
      }

      // Generate meal plan
      const mealPlan = await mealPlanGenerator.generate({
        userId,
        startDate: start,
        daysCount,
        mealsPerDay,
        servings,
        preferences
      });

      // Calculate balance metrics
      const balanceMetrics = await this.calculateBalanceMetrics(mealPlan);
      mealPlan.balance_metrics = JSON.stringify(balanceMetrics);

      // Save to database
      const mealPlanId = await mealPlanGenerator.saveMealPlan(mealPlan);

      // Fetch complete meal plan with ID
      const savedMealPlan = await mealPlanGenerator.getMealPlan(mealPlanId);

      // Fetch recipe details
      const recipeIds = savedMealPlan!.items.map(item => item.recipe_id);
      const recipes = await this.getRecipesByIds(recipeIds);

      res.status(201).json({
        success: true,
        data: {
          mealPlan: savedMealPlan,
          balanceMetrics,
          recipeDetails: recipes
        },
        message: 'Meal plan generated successfully'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error generating meal plan:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate meal plan'
      } as ApiResponse);
    }
  }

  /**
   * GET /api/v1/meal-plans/:id
   * Get meal plan by ID
   */
  async getMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const mealPlan = await mealPlanGenerator.getMealPlan(parseInt(id));

      if (!mealPlan) {
        res.status(404).json({
          success: false,
          error: 'Meal plan not found'
        } as ApiResponse);
        return;
      }

      // Fetch recipe details
      const recipeIds = mealPlan.items.map(item => item.recipe_id);
      const recipes = await this.getRecipesByIds(recipeIds);

      res.status(200).json({
        success: true,
        data: {
          mealPlan,
          recipeDetails: recipes
        }
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error fetching meal plan:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch meal plan'
      } as ApiResponse);
    }
  }

  /**
   * GET /api/v1/meal-plans/user/:userId
   * Get all meal plans for a user
   */
  async getUserMealPlans(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.query;

      const mealPlans = await mealPlanGenerator.getUserMealPlans(
        parseInt(userId),
        status as string | undefined
      );

      res.status(200).json({
        success: true,
        data: mealPlans
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error fetching user meal plans:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch meal plans'
      } as ApiResponse);
    }
  }

  /**
   * PUT /api/v1/meal-plans/:id/status
   * Update meal plan status
   */
  async updateMealPlanStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'archived', 'draft'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: active, archived, or draft'
        } as ApiResponse);
        return;
      }

      await mealPlanGenerator.updateMealPlanStatus(parseInt(id), status);

      res.status(200).json({
        success: true,
        message: 'Meal plan status updated'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error updating meal plan status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update status'
      } as ApiResponse);
    }
  }

  /**
   * DELETE /api/v1/meal-plans/:id
   * Delete meal plan
   */
  async deleteMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await mealPlanGenerator.deleteMealPlan(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Meal plan deleted'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error deleting meal plan:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete meal plan'
      } as ApiResponse);
    }
  }

  /**
   * PUT /api/v1/meal-plans/items/:itemId/recipe
   * Swap recipe in meal plan item
   */
  async swapRecipe(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const { newRecipeId } = req.body;

      if (!newRecipeId) {
        res.status(400).json({
          success: false,
          error: 'Missing newRecipeId'
        } as ApiResponse);
        return;
      }

      await mealPlanGenerator.swapRecipe(parseInt(itemId), newRecipeId);

      res.status(200).json({
        success: true,
        message: 'Recipe swapped successfully'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error swapping recipe:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to swap recipe'
      } as ApiResponse);
    }
  }

  /**
   * PUT /api/v1/meal-plans/items/:itemId/complete
   * Mark meal as completed
   */
  async completeMeal(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      await mealPlanGenerator.completeMeal(parseInt(itemId));

      res.status(200).json({
        success: true,
        message: 'Meal marked as completed'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error completing meal:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete meal'
      } as ApiResponse);
    }
  }

  /**
   * Helper: Calculate balance metrics for a meal plan
   */
  private async calculateBalanceMetrics(mealPlan: WeeklyMealPlan): Promise<any> {
    const recipeIds = mealPlan.items.map(item => item.recipe_id);
    const recipes = await this.getRecipesByIds(recipeIds);

    // Protein variety
    const proteinTypes = new Set(recipes.map(r => r.protein_type));
    const proteinVariety = Math.min(1, proteinTypes.size / 4);

    // Cooking method variety
    const cookingMethods = new Set(recipes.map(r => r.cooking_method));
    const cookingMethodVariety = Math.min(1, cookingMethods.size / 3);

    // Dosha balance (average of all score breakdowns)
    let totalDoshaScore = 0;
    let doshaCount = 0;

    for (const item of mealPlan.items) {
      if (item.score_breakdown) {
        const scoreBreakdown = JSON.parse(item.score_breakdown);
        if (scoreBreakdown.doshaBalance !== undefined) {
          totalDoshaScore += scoreBreakdown.doshaBalance;
          doshaCount++;
        }
      }
    }

    const doshaBalance = doshaCount > 0 ? totalDoshaScore / doshaCount : 0.5;

    // Cultural authenticity
    let totalCulturalScore = 0;
    let culturalCount = 0;

    for (const item of mealPlan.items) {
      if (item.score_breakdown) {
        const scoreBreakdown = JSON.parse(item.score_breakdown);
        if (scoreBreakdown.culturalMatch !== undefined) {
          totalCulturalScore += scoreBreakdown.culturalMatch;
          culturalCount++;
        }
      }
    }

    const culturalAuthenticity = culturalCount > 0 ? totalCulturalScore / culturalCount : 0.5;

    // Nutritional balance (simplified - check calorie distribution)
    const totalNutrition = recipes.reduce((acc, r) => {
      const nutrition = JSON.parse(r.nutritional_info);
      return {
        calories: acc.calories + nutrition.calories,
        protein_g: acc.protein_g + nutrition.protein_g,
        carbs_g: acc.carbs_g + nutrition.carbs_g,
        fat_g: acc.fat_g + nutrition.fat_g
      };
    }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    const avgCalories = totalNutrition.calories / recipes.length;
    const nutritionalBalance = avgCalories >= 300 && avgCalories <= 600 ? 1.0 : 0.7;

    return {
      proteinVariety,
      cookingMethodVariety,
      doshaBalance,
      culturalAuthenticity,
      nutritionalBalance
    };
  }

  /**
   * Helper: Get recipes by IDs
   */
  private async getRecipesByIds(ids: number[]): Promise<any[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM recipes WHERE id IN (${placeholders})`;

    return await db.all(sql, ids);
  }
}

// Export singleton instance
export const mealPlanController = new MealPlanController();
