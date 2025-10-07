import { BaseRepository } from './base.repository';
import { MealPlan, Meal, NutritionalInfo } from '../types';

export class MealPlanRepository extends BaseRepository<MealPlan> {
  protected tableName = 'meal_plans';

  async findByUserId(userId: number, startDate?: string, endDate?: string, limit: number = 50, offset: number = 0): Promise<MealPlan[]> {
    let query = `
      SELECT * FROM meal_plans
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (startDate && endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<MealPlan>(query, params);
  }

  async findByDate(userId: number, date: string): Promise<MealPlan | null> {
    const query = 'SELECT * FROM meal_plans WHERE user_id = ? AND date = ?';
    const row = await this.db.get<MealPlan>(query, [userId, date]);
    return row || null;
  }

  async findBetweenDates(userId: number, startDate: string, endDate: string): Promise<MealPlan[]> {
    const query = `
      SELECT * FROM meal_plans
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `;
    return this.db.all<MealPlan>(query, [userId, startDate, endDate]);
  }

  async createOrUpdateMealPlan(mealPlan: Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const query = `
      INSERT OR REPLACE INTO meal_plans (
        user_id, date, breakfast, lunch, dinner, snack, total_nutrition, cultural_compliance_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      mealPlan.user_id,
      mealPlan.date,
      JSON.stringify(mealPlan.breakfast),
      JSON.stringify(mealPlan.lunch),
      JSON.stringify(mealPlan.dinner),
      JSON.stringify(mealPlan.snack),
      JSON.stringify(mealPlan.total_nutrition),
      mealPlan.cultural_compliance_score
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  async updateMeal(userId: number, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', meal: Meal): Promise<boolean> {
    // First get the current meal plan
    const existingPlan = await this.findByDate(userId, date);
    if (!existingPlan) {
      return false;
    }

    // Update the specific meal
    const updatedMeals = { ...existingPlan };
    updatedMeals[mealType] = meal;

    // Recalculate total nutrition
    const newNutrition = await this.calculateTotalNutrition(updatedMeals);

    const query = `
      UPDATE meal_plans
      SET ${mealType} = ?, total_nutrition = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND date = ?
    `;

    const result = await this.db.run(query, [
      JSON.stringify(meal),
      JSON.stringify(newNutrition),
      userId,
      date
    ]);

    return (result.changes || 0) > 0;
  }

  async deleteMealPlan(userId: number, date: string): Promise<boolean> {
    const query = 'DELETE FROM meal_plans WHERE user_id = ? AND date = ?';
    const result = await this.db.run(query, [userId, date]);

    return (result.changes || 0) > 0;
  }

  async batchCreateMealPlans(mealPlans: Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    await this.db.beginTransaction();

    try {
      for (const mealPlan of mealPlans) {
        await this.createOrUpdateMealPlan(mealPlan);
      }
      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  async getMealPlanStats(userId: number, startDate?: string, endDate?: string): Promise<{
    totalMealPlans: number;
    avgComplianceScore: number;
    totalNutrition: NutritionalInfo;
    mealDistribution: { [key: string]: number };
  }> {
    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];

    if (startDate && endDate) {
      whereClause += ' AND date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const statsQuery = `
      SELECT
        COUNT(*) as totalMealPlans,
        AVG(cultural_compliance_score) as avgComplianceScore,
        SUM(
          CASE WHEN breakfast IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN lunch IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN dinner IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN snack IS NOT NULL THEN 1 ELSE 0 END
        ) as totalMeals
      FROM meal_plans
      ${whereClause}
    `;

    const stats = await this.db.get(statsQuery, params);

    // Get meal distribution
    const distributionQuery = `
      SELECT
        SUM(CASE WHEN breakfast IS NOT NULL THEN 1 ELSE 0 END) as breakfast_count,
        SUM(CASE WHEN lunch IS NOT NULL THEN 1 ELSE 0 END) as lunch_count,
        SUM(CASE WHEN dinner IS NOT NULL THEN 1 ELSE 0 END) as dinner_count,
        SUM(CASE WHEN snack IS NOT NULL THEN 1 ELSE 0 END) as snack_count
      FROM meal_plans
      ${whereClause}
    `;

    const distribution = await this.db.get(distributionQuery, params);

    // Get average nutrition
    const nutritionQuery = `
      SELECT
        AVG(json_extract(total_nutrition, '$.calories')) as avg_calories,
        AVG(json_extract(total_nutrition, '$.protein_g')) as avg_protein,
        AVG(json_extract(total_nutrition, '$.carbs_g')) as avg_carbs,
        AVG(json_extract(total_nutrition, '$.fat_g')) as avg_fat,
        AVG(json_extract(total_nutrition, '$.fiber_g')) as avg_fiber
      FROM meal_plans
      ${whereClause}
    `;

    const nutrition = await this.db.get(nutritionQuery, params);

    return {
      totalMealPlans: stats?.totalMealPlans || 0,
      avgComplianceScore: stats?.avgComplianceScore || 0,
      totalNutrition: {
        calories: Math.round((nutrition?.avg_calories || 0) * (stats?.totalMealPlans || 1)),
        protein_g: Math.round((nutrition?.avg_protein || 0) * (stats?.totalMealPlans || 1) * 10) / 10,
        carbs_g: Math.round((nutrition?.avg_carbs || 0) * (stats?.totalMealPlans || 1) * 10) / 10,
        fat_g: Math.round((nutrition?.avg_fat || 0) * (stats?.totalMealPlans || 1) * 10) / 10,
        fiber_g: Math.round((nutrition?.avg_fiber || 0) * (stats?.totalMealPlans || 1) * 10) / 10,
        sugar_g: 0,
        sodium_mg: 0
      },
      mealDistribution: {
        breakfast: distribution?.breakfast_count || 0,
        lunch: distribution?.lunch_count || 0,
        dinner: distribution?.dinner_count || 0,
        snack: distribution?.snack_count || 0
      }
    };
  }

  async findMealPatterns(userId: number, days: number = 30): Promise<Array<{ recipe_id: number; count: number; frequency: string }>> {
    const query = `
      WITH meal_data AS (
        SELECT
          json_extract(breakfast, '$.recipe_id') as recipe_id
        FROM meal_plans
        WHERE user_id = ? AND date >= date('now', '-${days} days') AND breakfast IS NOT NULL
        UNION ALL
        SELECT json_extract(lunch, '$.recipe_id')
        FROM meal_plans
        WHERE user_id = ? AND date >= date('now', '-${days} days') AND lunch IS NOT NULL
        UNION ALL
        SELECT json_extract(dinner, '$.recipe_id')
        FROM meal_plans
        WHERE user_id = ? AND date >= date('now', '-${days} days') AND dinner IS NOT NULL
        UNION ALL
        SELECT json_extract(snack, '$.recipe_id')
        FROM meal_plans
        WHERE user_id = ? AND date >= date('now', '-${days} days') AND snack IS NOT NULL
      )
      SELECT
        CAST(recipe_id AS INTEGER) as recipe_id,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / ?, 2) as frequency
      FROM meal_data
      WHERE recipe_id IS NOT NULL
      GROUP BY recipe_id
      ORDER BY count DESC
      LIMIT 10
    `;

    return this.db.all(query, [userId, userId, userId, userId, days]);
  }

  private async calculateTotalNutrition(_mealPlan: Partial<MealPlan>): Promise<NutritionalInfo> {
    // This would typically involve fetching recipe nutritional info and calculating totals
    // For now, return a default. In a real implementation, this would aggregate from recipes
    return {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0
    };
  }

  async getUserMealHistory(userId: number, limit: number = 100): Promise<Array<{
    date: string;
    meal_type: string;
    recipe_id: number;
    rating: number;
    feedback: string;
  }>> {
    const query = `
      SELECT
        mph.meal_date as date,
        mph.meal_type,
        mph.recipe_id,
        mph.rating,
        mph.feedback
      FROM meal_plan_history mph
      WHERE mph.user_id = ? AND mph.rating IS NOT NULL
      ORDER BY mph.created_at DESC
      LIMIT ?
    `;
    return this.db.all(query, [userId, limit]);
  }
}