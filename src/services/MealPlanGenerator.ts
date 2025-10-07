import { Recipe, UserProfile, WeeklyMealPlan, MealPlanItem } from '../types';
import { constraintEngine } from './ConstraintEngine';
import { recipeScorer, RecipeScorer, PlanContext } from './RecipeScorer';
import { DatabaseConnection } from '../database/connection';

const db = DatabaseConnection.getInstance();

/**
 * Meal Plan Generator
 * Generates optimized weekly meal plans based on user preferences
 */

export interface MealPlanRequest {
  userId: number;
  startDate: Date;
  daysCount: number;
  mealsPerDay: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack?: boolean;
  };
  servings: number;
  preferences?: {
    maxPrepTime?: number;
    varietyLevel?: 'low' | 'medium' | 'high';
    retailerPrefs?: string[];
  };
}

export class MealPlanGenerator {
  /**
   * Generate a complete meal plan
   */
  async generate(request: MealPlanRequest): Promise<WeeklyMealPlan> {
    const user = await this.getUserProfile(request.userId);
    const eligibleRecipes = await this.getEligibleRecipes(user);

    if (eligibleRecipes.length < 7) {
      throw new Error('Insufficient eligible recipes to generate meal plan');
    }

    // Calculate end date
    const endDate = new Date(request.startDate);
    endDate.setDate(endDate.getDate() + request.daysCount - 1);

    // Create meal plan structure
    const mealPlan: WeeklyMealPlan = {
      user_id: request.userId,
      start_date: this.formatDate(request.startDate),
      end_date: this.formatDate(endDate),
      name: `Meal Plan ${this.formatDate(request.startDate)}`,
      status: 'draft',
      preferences: JSON.stringify(request),
      balance_metrics: '',
      items: []
    };

    // Track recently used recipes
    const recentRecipes: Recipe[] = [];

    // Generate meals day by day
    for (let day = 0; day < request.daysCount; day++) {
      const currentDate = new Date(request.startDate);
      currentDate.setDate(currentDate.getDate() + day);

      const dayMeals = await this.generateDayMeals(
        currentDate,
        request.mealsPerDay,
        eligibleRecipes,
        user,
        recentRecipes,
        request.servings
      );

      mealPlan.items.push(...dayMeals);

      // Add to recent recipes (keep last 7 meals)
      dayMeals.forEach(meal => {
        const recipe = eligibleRecipes.find(r => r.id === meal.recipe_id);
        if (recipe) {
          recentRecipes.push(recipe);
        }
      });

      if (recentRecipes.length > 7) {
        recentRecipes.splice(0, recentRecipes.length - 7);
      }
    }

    return mealPlan;
  }

  /**
   * Generate meals for a single day
   */
  private async generateDayMeals(
    date: Date,
    mealsPerDay: MealPlanRequest['mealsPerDay'],
    recipePool: Recipe[],
    user: UserProfile,
    recentRecipes: Recipe[],
    servings: number
  ): Promise<MealPlanItem[]> {
    const dayMeals: MealPlanItem[] = [];
    const mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = [];

    if (mealsPerDay.breakfast) mealTypes.push('breakfast');
    if (mealsPerDay.lunch) mealTypes.push('lunch');
    if (mealsPerDay.dinner) mealTypes.push('dinner');
    if (mealsPerDay.snack) mealTypes.push('snack');

    for (const mealType of mealTypes) {
      const context: PlanContext = {
        recentRecipes: [...recentRecipes],
        currentSeason: RecipeScorer.getCurrentSeason(date),
        dayOfWeek: date.getDay(),
        mealType
      };

      const recipe = this.selectRecipe(recipePool, user, context);

      if (!recipe) {
        throw new Error(`No suitable recipe found for ${mealType} on ${this.formatDate(date)}`);
      }

      const scoreBreakdown = recipeScorer.scoreRecipe(recipe, user, context);

      dayMeals.push({
        date: this.formatDate(date),
        meal_type: mealType,
        recipe_id: recipe.id!,
        servings,
        score_breakdown: JSON.stringify(scoreBreakdown),
        completed: false
      });

      // Add to recent for within-day variety
      recentRecipes.push(recipe);
    }

    return dayMeals;
  }

  /**
   * Select best recipe for given context
   */
  private selectRecipe(
    pool: Recipe[],
    user: UserProfile,
    context: PlanContext
  ): Recipe | null {
    // Score all recipes
    const allScored = pool.map(recipe => ({
      recipe,
      score: recipeScorer.scoreRecipe(recipe, user, context)
    }));

    // Log scoring for debugging
    const topScores = allScored
      .sort((a, b) => b.score.totalScore - a.score.totalScore)
      .slice(0, 3);

    console.log(`Recipe scoring for ${context.mealType}: Top 3 scores = ${topScores.map(s => s.score.totalScore.toFixed(2)).join(', ')}`);

    const scored = allScored
      .filter(item => item.score.totalScore > 0.4) // Minimum threshold
      .sort((a, b) => b.score.totalScore - a.score.totalScore);

    if (scored.length === 0) {
      console.log(`No recipes above 0.4 threshold for ${context.mealType}`);
      return null;
    }

    // Top 20% randomization to avoid monotony
    const topTierSize = Math.max(3, Math.ceil(scored.length * 0.2));
    const topTier = scored.slice(0, topTierSize);
    const selected = topTier[Math.floor(Math.random() * topTier.length)];

    return selected.recipe;
  }

  /**
   * Get eligible recipes for user
   */
  private async getEligibleRecipes(user: UserProfile): Promise<Recipe[]> {
    const allRecipes = await db.all<Recipe>('SELECT * FROM recipes') as Recipe[];

    // Filter by constraint validation
    const eligibleRecipes: Recipe[] = [];
    for (const recipe of allRecipes) {
      const validation = await constraintEngine.validateRecipe(recipe, user);
      if (validation.valid) {
        eligibleRecipes.push(recipe);
      }
    }

    console.log(`MealPlanGenerator: Found ${eligibleRecipes.length}/${allRecipes.length} eligible recipes for user ${user.id}`);
    return eligibleRecipes;
  }

  /**
   * Get user profile
   */
  private async getUserProfile(userId: number): Promise<UserProfile> {
    const user = await db.get<UserProfile>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return user;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Save meal plan to database
   */
  async saveMealPlan(mealPlan: WeeklyMealPlan): Promise<number> {
    const planSql = `
      INSERT INTO weekly_meal_plans (
        user_id, start_date, end_date, name, status, preferences, balance_metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.run(
      planSql,
      [
        mealPlan.user_id,
        mealPlan.start_date,
        mealPlan.end_date,
        mealPlan.name,
        mealPlan.status,
        mealPlan.preferences,
        mealPlan.balance_metrics
      ]
    );

    const weeklyPlanId = result.lastID;

    // Insert meal plan items
    const itemSql = `
      INSERT INTO meal_plan_items (
        weekly_plan_id, date, meal_type, recipe_id, servings,
        score_breakdown, completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of mealPlan.items) {
      await db.run(
        itemSql,
        [
          weeklyPlanId,
          item.date,
          item.meal_type,
          item.recipe_id,
          item.servings,
          item.score_breakdown,
          item.completed ? 1 : 0
        ]
      );
    }

    return weeklyPlanId;
  }

  /**
   * Get meal plan by ID
   */
  async getMealPlan(id: number): Promise<WeeklyMealPlan | null> {
    const plan = await db.get<any>(
      'SELECT * FROM weekly_meal_plans WHERE id = ?',
      [id]
    );

    if (!plan) {
      return null;
    }

    const items = await db.all<MealPlanItem>(
      'SELECT * FROM meal_plan_items WHERE weekly_plan_id = ? ORDER BY date, meal_type',
      [id]
    );

    return {
      id: plan.id,
      user_id: plan.user_id,
      start_date: plan.start_date,
      end_date: plan.end_date,
      name: plan.name,
      status: plan.status,
      preferences: plan.preferences,
      balance_metrics: plan.balance_metrics,
      items: items as MealPlanItem[]
    };
  }

  /**
   * Get user's meal plans
   */
  async getUserMealPlans(userId: number, status?: string): Promise<WeeklyMealPlan[]> {
    let sql = 'SELECT * FROM weekly_meal_plans WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY start_date DESC';

    const plans = await db.all<any>(sql, params);

    // Load items for each plan
    const plansWithItems = await Promise.all(
      plans.map(async (plan: any) => {
        const items = await db.all<MealPlanItem>(
          'SELECT * FROM meal_plan_items WHERE weekly_plan_id = ? ORDER BY date, meal_type',
          [plan.id]
        );

        return {
          id: plan.id,
          user_id: plan.user_id,
          start_date: plan.start_date,
          end_date: plan.end_date,
          name: plan.name,
          status: plan.status,
          preferences: plan.preferences,
          balance_metrics: plan.balance_metrics,
          items: items as MealPlanItem[]
        };
      })
    );

    return plansWithItems;
  }

  /**
   * Update meal plan status
   */
  async updateMealPlanStatus(id: number, status: string): Promise<void> {
    await db.run(
      'UPDATE weekly_meal_plans SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  /**
   * Delete meal plan
   */
  async deleteMealPlan(id: number): Promise<void> {
    // Cascade delete will handle meal_plan_items
    await db.run('DELETE FROM weekly_meal_plans WHERE id = ?', [id]);
  }

  /**
   * Swap recipe in meal plan item
   */
  async swapRecipe(itemId: number, newRecipeId: number): Promise<void> {
    await db.run(
      'UPDATE meal_plan_items SET recipe_id = ? WHERE id = ?',
      [newRecipeId, itemId]
    );
  }

  /**
   * Mark meal as completed
   */
  async completeMeal(itemId: number): Promise<void> {
    await db.run(
      'UPDATE meal_plan_items SET completed = 1 WHERE id = ?',
      [itemId]
    );
  }
}

// Export singleton instance
export const mealPlanGenerator = new MealPlanGenerator();
