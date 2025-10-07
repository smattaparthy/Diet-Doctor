import { BaseRepository } from './base.repository';
import { Recipe, CuisineType, Dosha } from '../types';

export class RecipeRepository extends BaseRepository<Recipe> {
  protected tableName = 'recipes';

  async executeQuery(query: string, params: any[]): Promise<Recipe[]> {
    return this.db.all<Recipe>(query, params);
  }

  async findByCuisineType(cuisineType: CuisineType, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE cuisine_type = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [cuisineType, limit, offset]);
  }

  async findByAyurvedicDosha(dosha: Dosha, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE json_extract(ayurvedic_info, '$.dominantDosha') LIKE '%' || ? || '%'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [`%"${dosha}"%`, limit, offset]);
  }

  async findByDifficulty(difficulty: 'easy' | 'medium' | 'hard', limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE difficulty = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [difficulty, limit, offset]);
  }

  async findByPrepTime(maxPrepTime: number, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE prep_time_minutes <= ?
      ORDER BY prep_time_minutes ASC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [maxPrepTime, limit, offset]);
  }

  async searchRecipes(searchTerm: string, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE (title LIKE ? OR description LIKE ? OR cultural_notes LIKE ?)
      ORDER BY
        CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ? OFFSET ?
    `;
    const likePattern = `%${searchTerm}%`;
    return this.db.all<Recipe>(query, [
      likePattern, likePattern, likePattern, likePattern, limit, offset
    ]);
  }

  async findByIngredients(ingredients: string[], limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    // Build WHERE clause for ingredient search
    const ingredientConditions = ingredients.map(() => 'json_extract(ingredients, "$[*].name") LIKE ?').join(' OR ');
    const query = `
      SELECT * FROM recipes
      WHERE (${ingredientConditions})
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const params: any[] = ingredients.map(ing => `%${ing}%`);
    params.push(limit.toString(), offset.toString());

    return this.db.all<Recipe>(query, params);
  }

  async findSeasonalRecipes(season: 'spring' | 'summer' | 'monsoon' | 'autumn' | 'winter', limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT * FROM recipes
      WHERE json_extract(ayurvedic_info, '$.seasonal_recommendation') LIKE '%' || ? || '%'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [`%"${season}"%`, limit, offset]);
  }

  async findUserFavorites(userId: number, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const query = `
      SELECT r.* FROM recipes r
      INNER JOIN user_recipe_favorites urf ON r.id = urf.recipe_id
      WHERE urf.user_id = ?
      ORDER BY urf.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<Recipe>(query, [userId, limit, offset]);
  }

  async addToFavorites(userId: number, recipeId: number): Promise<boolean> {
    const query = `
      INSERT OR IGNORE INTO user_recipe_favorites (user_id, recipe_id)
      VALUES (?, ?)
    `;
    const result = await this.db.run(query, [userId, recipeId]);
    return (result.changes || 0) > 0;
  }

  async removeFromFavorites(userId: number, recipeId: number): Promise<boolean> {
    const query = 'DELETE FROM user_recipe_favorites WHERE user_id = ? AND recipe_id = ?';
    const result = await this.db.run(query, [userId, recipeId]);
    return (result.changes || 0) > 0;
  }

  async isFavorite(userId: number, recipeId: number): Promise<boolean> {
    const query = 'SELECT 1 FROM user_recipe_favorites WHERE user_id = ? AND recipe_id = ? LIMIT 1';
    const row = await this.db.get(query, [userId, recipeId]);
    return !!row;
  }

  async updateRecipeRating(userId: number, recipeId: number, rating: number, feedback?: string): Promise<boolean> {
    const query = `
      INSERT OR REPLACE INTO meal_plan_history (user_id, recipe_id, meal_date, meal_type, rating, feedback)
      VALUES (?, ?, date('now'), 'rated', ?, ?)
    `;
    const result = await this.db.run(query, [userId, recipeId, rating, feedback]);
    return (result.changes || 0) > 0;
  }

  async getRecipeAverageRating(recipeId: number): Promise<{ averageRating: number; totalRatings: number }> {
    const query = `
      SELECT AVG(rating) as averageRating, COUNT(*) as totalRatings
      FROM meal_plan_history
      WHERE recipe_id = ? AND rating IS NOT NULL
    `;
    const result = await this.db.get(query, [recipeId]);
    return {
      averageRating: result?.averageRating || 0,
      totalRatings: result?.totalRatings || 0
    };
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const query = `
      INSERT INTO recipes (
        cuisine_type, title, description, ingredients, instructions,
        prep_time_minutes, cook_time_minutes, servings, difficulty,
        cultural_notes, ayurvedic_info, nutritional_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      recipe.cuisine_type,
      recipe.title,
      recipe.description,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.instructions),
      recipe.prep_time_minutes,
      recipe.cook_time_minutes,
      recipe.servings,
      recipe.difficulty,
      recipe.cultural_notes,
      JSON.stringify(recipe.ayurvedic_info),
      JSON.stringify(recipe.nutritional_info)
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }
}