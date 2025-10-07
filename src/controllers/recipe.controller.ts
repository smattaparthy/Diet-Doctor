import { Request, Response } from 'express';
import { RecipeRepository } from '../repositories';
import { Recipe, RecipeRow, CuisineType, Dosha } from '../types';
import { NotFoundError } from '../utils/errors';

export class RecipeController {
  private recipeRepo: RecipeRepository;

  constructor() {
    this.recipeRepo = new RecipeRepository();
  }

  search = async (req: Request, res: Response) => {
    try {
      const {
        searchTerm,
        cuisine_type,
        dosha,
        difficulty,
        max_preptime,
        ingredients,
        page = 1,
        limit = 20
      } = req.query;

      let recipes: Recipe[] = [];
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Search logic based on provided parameters
      if (searchTerm) {
        recipes = await this.recipeRepo.searchRecipes(
          searchTerm as string,
          parseInt(limit as string),
          offset
        );
      } else if (ingredients) {
        const ingredientArray = Array.isArray(ingredients)
          ? ingredients as string[]
          : [ingredients as string];
        recipes = await this.recipeRepo.findByIngredients(
          ingredientArray,
          parseInt(limit as string),
          offset
        );
      } else if (cuisine_type) {
        recipes = await this.recipeRepo.findByCuisineType(
          cuisine_type as CuisineType,
          parseInt(limit as string),
          offset
        );
      } else if (dosha) {
        recipes = await this.recipeRepo.findByAyurvedicDosha(
          dosha as Dosha,
          parseInt(limit as string),
          offset
        );
      } else if (difficulty) {
        recipes = await this.recipeRepo.findByDifficulty(
          difficulty as 'easy' | 'medium' | 'hard',
          parseInt(limit as string),
          offset
        );
      } else if (max_preptime) {
        recipes = await this.recipeRepo.findByPrepTime(
          parseInt(max_preptime as string),
          parseInt(limit as string),
          offset
        );
      } else {
        // Default: get all recipes with pagination
        recipes = await this.recipeRepo.findAll(
          parseInt(limit as string),
          offset
        );
      }

      // Get total count for pagination
      const total = await this.recipeRepo.count();

      return res.json({
        success: true,
        data: recipes.map((recipeRow) => {
          const row = recipeRow as any as RecipeRow;
          const recipe: Recipe = {
            ...row,
            ingredients: JSON.parse(row.ingredients),
            instructions: JSON.parse(row.instructions),
            ayurvedic_info: JSON.parse(row.ayurvedic_info),
            nutritional_info: JSON.parse(row.nutritional_info),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            seasonal_tags: row.seasonal_tags ? JSON.parse(row.seasonal_tags) : undefined
          };
          return recipe;
        }),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          total_pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Recipe search error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search recipes',
        code: 'SEARCH_ERROR'
      });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const recipe = await this.recipeRepo.findById(parseInt(id));
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      // Get rating information
      const ratingInfo = await this.recipeRepo.getRecipeAverageRating(parseInt(id));

      // Check if it's a favorite for authenticated user
      let isFavorite = false;
      if (req.user) {
        isFavorite = await this.recipeRepo.isFavorite(req.user.id, parseInt(id));
      }

      const recipeRow = recipe as any as RecipeRow;

      // Parse JSON fields
      const parsedIngredients = JSON.parse(recipeRow.ingredients);
      const parsedAyurvedicInfo = JSON.parse(recipeRow.ayurvedic_info);
      const parsedNutritionalInfo = JSON.parse(recipeRow.nutritional_info);

      // Generate tags dynamically from recipe data
      const tags: string[] = [];

      // Check if vegetarian (no meat/fish ingredients)
      const meatKeywords = ['chicken', 'fish', 'lamb', 'mutton', 'seafood', 'shrimp', 'prawn'];
      const hasNoMeat = !parsedIngredients.some((ing: any) =>
        meatKeywords.some(meat => (ing.name || ing.item || '').toLowerCase().includes(meat))
      );
      if (hasNoMeat) tags.push('vegetarian');

      // Check if vegan (no animal products)
      const animalProducts = ['yogurt', 'milk', 'ghee', 'butter', 'cheese', 'paneer', 'cream', 'egg'];
      const hasNoAnimalProducts = !parsedIngredients.some((ing: any) =>
        animalProducts.some(animal => (ing.name || ing.item || '').toLowerCase().includes(animal))
      );
      if (hasNoMeat && hasNoAnimalProducts) tags.push('vegan');

      // Add difficulty as tag
      if (recipeRow.difficulty === 'easy') tags.push('beginner-friendly');

      // Add prep time tag
      if (recipeRow.prep_time_minutes + recipeRow.cook_time_minutes <= 30) tags.push('quick');

      // Add cuisine type as tag
      if (recipeRow.cuisine_type) tags.push(recipeRow.cuisine_type.replace(/_/g, '-'));

      const recipeData: Recipe = {
        ...recipeRow,
        ingredients: parsedIngredients,
        instructions: JSON.parse(recipeRow.instructions),
        ayurvedic_info: parsedAyurvedicInfo,
        nutritional_info: parsedNutritionalInfo,
        tags: tags,
        seasonal_tags: recipeRow.seasonal_tags ? JSON.parse(recipeRow.seasonal_tags) : undefined
      };

      return res.json({
        success: true,
        data: {
          ...recipeData,
          rating: ratingInfo,
          is_favorite: isFavorite
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

      console.error('Get recipe error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve recipe',
        code: 'GET_RECIPE_ERROR'
      });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const recipeData = req.body;

      // Validate cultural compliance
      const ingredients = recipeData.ingredients.map((ing: any) => ing.name);
      if (req.user) {
        const culturalValidation = this.validateRecipeCulturalCompliance(
          ingredients,
          req.user.dietary_restrictions,
          req.user.cuisine_preferences
        );
        if (!culturalValidation.isValid) {
          return res.status(422).json({
            success: false,
            error: 'Recipe violates cultural dietary restrictions',
            code: 'CULTURAL_COMPLIANCE_VIOLATION',
            details: culturalValidation.errors
          });
        }
      }

      const recipeId = await this.recipeRepo.createRecipe(recipeData);

      // Get created recipe
      const createdRecipe = await this.recipeRepo.findById(recipeId);
      if (!createdRecipe) {
        throw new Error('Failed to retrieve created recipe');
      }

      const createdRow = createdRecipe as any as RecipeRow;
      const createdData: Recipe = {
        ...createdRow,
        ingredients: JSON.parse(createdRow.ingredients),
        instructions: JSON.parse(createdRow.instructions),
        ayurvedic_info: JSON.parse(createdRow.ayurvedic_info),
        nutritional_info: JSON.parse(createdRow.nutritional_info),
        tags: createdRow.tags ? JSON.parse(createdRow.tags) : undefined,
        seasonal_tags: createdRow.seasonal_tags ? JSON.parse(createdRow.seasonal_tags) : undefined
      };

      return res.status(201).json({
        success: true,
        data: createdData,
        message: 'Recipe created successfully'
      });
    } catch (error) {
      console.error('Create recipe error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create recipe',
        code: 'CREATE_RECIPE_ERROR'
      });
    }
  };

  addToFavorites = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const recipeId = parseInt(id);

      // Check if recipe exists
      const recipe = await this.recipeRepo.findById(recipeId);
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      const success = await this.recipeRepo.addToFavorites(req.user.id, recipeId);

      return res.json({
        success: success,
        message: success ? 'Recipe added to favorites' : 'Recipe already in favorites'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Add to favorites error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to add recipe to favorites',
        code: 'FAVORITE_ERROR'
      });
    }
  };

  removeFromFavorites = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const recipeId = parseInt(id);

      const success = await this.recipeRepo.removeFromFavorites(req.user.id, recipeId);

      return res.json({
        success: success,
        message: success ? 'Recipe removed from favorites' : 'Recipe was not in favorites'
      });
    } catch (error) {
      console.error('Remove from favorites error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove recipe from favorites',
        code: 'UNFAVORITE_ERROR'
      });
    }
  };

  getFavorites = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const recipes = await this.recipeRepo.findUserFavorites(
        req.user.id,
        limit,
        offset
      );

      // Get count of all favorites
      const total = await this.recipeRepo['db'].all<{ count: number }>(`
        SELECT COUNT(*) as count FROM user_recipe_favorites WHERE user_id = ?
      `, [req.user.id]);

      return res.json({
        success: true,
        data: recipes.map((recipeRow) => {
          const row = recipeRow as any as RecipeRow;
          const recipe: Recipe = {
            ...row,
            ingredients: JSON.parse(row.ingredients),
            instructions: JSON.parse(row.instructions),
            ayurvedic_info: JSON.parse(row.ayurvedic_info),
            nutritional_info: JSON.parse(row.nutritional_info),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            seasonal_tags: row.seasonal_tags ? JSON.parse(row.seasonal_tags) : undefined
          };
          return recipe;
        }),
        pagination: {
          page,
          limit,
          total: total[0]?.count || 0,
          total_pages: Math.ceil((total[0]?.count || 0) / limit)
        }
      });
    } catch (error) {
      console.error('Get favorites error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve favorite recipes',
        code: 'GET_FAVORITES_ERROR'
      });
    }
  };

  rateRecipe = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const { rating, feedback } = req.body;

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5',
          code: 'INVALID_RATING'
        });
      }

      const recipeId = parseInt(id);

      // Check if recipe exists
      const recipe = await this.recipeRepo.findById(recipeId);
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      const success = await this.recipeRepo.updateRecipeRating(
        req.user.id,
        recipeId,
        rating,
        feedback
      );

      return res.json({
        success: success,
        message: success ? 'Recipe rated successfully' : 'Failed to rate recipe'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Rate recipe error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to rate recipe',
        code: 'RATE_RECIPE_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/recipes/recommended
   * Get personalized recipe recommendations based on user's health profile
   */
  getRecommendations = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const cuisineFilter = req.query.cuisine as CuisineType | undefined;

      // Get user's dosha for filtering
      const userDosha = req.user.dosha;

      let recipes: Recipe[] = [];

      if (userDosha && userDosha !== 'null') {
        // Get recipes that match user's dosha
        recipes = await this.recipeRepo.findByAyurvedicDosha(
          userDosha as Dosha,
          limit,
          offset
        );
      } else {
        // No dosha profile - use cuisine preferences
        if (req.user.cuisine_preferences && req.user.cuisine_preferences.length > 0) {
          const firstCuisine = req.user.cuisine_preferences[0];
          recipes = await this.recipeRepo.findByCuisineType(
            firstCuisine as CuisineType,
            limit,
            offset
          );
        } else {
          // Fallback to all recipes
          recipes = await this.recipeRepo.findAll(limit, offset);
        }
      }

      // Apply cuisine filter if provided
      if (cuisineFilter) {
        recipes = recipes.filter(r => {
          const row = r as any as RecipeRow;
          return row.cuisine_type === cuisineFilter;
        });
      }

      // Get total count
      const total = recipes.length;

      return res.json({
        success: true,
        data: recipes.map((recipeRow) => {
          const row = recipeRow as any as RecipeRow;
          const recipe: Recipe = {
            ...row,
            ingredients: JSON.parse(row.ingredients),
            instructions: JSON.parse(row.instructions),
            ayurvedic_info: JSON.parse(row.ayurvedic_info),
            nutritional_info: JSON.parse(row.nutritional_info),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            seasonal_tags: row.seasonal_tags ? JSON.parse(row.seasonal_tags) : undefined
          };
          return recipe;
        }),
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        },
        metadata: {
          basedOn: userDosha ? 'dosha_profile' : 'cuisine_preferences',
          dosha: userDosha
        }
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve recommendations',
        code: 'RECOMMENDATIONS_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/recipes/for-dosha/:dosha
   * Get recipes suitable for a specific dosha type
   */
  getRecipesForDosha = async (req: Request, res: Response) => {
    try {
      const { dosha } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate dosha parameter
      const validDoshas = ['vata', 'pitta', 'kapha', 'vata-pitta', 'pitta-kapha', 'vata-kapha', 'tri-dosha', 'tridosha'];
      if (!validDoshas.includes(dosha.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Invalid dosha type. Must be one of: ${validDoshas.join(', ')}`,
          code: 'INVALID_DOSHA'
        });
      }

      const recipes = await this.recipeRepo.findByAyurvedicDosha(
        dosha as Dosha,
        limit,
        offset
      );

      const total = recipes.length;

      return res.json({
        success: true,
        data: recipes.map((recipeRow) => {
          const row = recipeRow as any as RecipeRow;
          const recipe: Recipe = {
            ...row,
            ingredients: JSON.parse(row.ingredients),
            instructions: JSON.parse(row.instructions),
            ayurvedic_info: JSON.parse(row.ayurvedic_info),
            nutritional_info: JSON.parse(row.nutritional_info),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            seasonal_tags: row.seasonal_tags ? JSON.parse(row.seasonal_tags) : undefined
          };
          return recipe;
        }),
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        },
        metadata: {
          dosha: dosha
        }
      });
    } catch (error) {
      console.error('Get recipes for dosha error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve recipes for dosha',
        code: 'DOSHA_RECIPES_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/recipes/:id/feedback
   * Submit rating and feedback for a recipe
   */
  submitFeedback = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const { rating, feedback } = req.body;

      // Validate rating
      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5',
          code: 'INVALID_RATING'
        });
      }

      const recipeId = parseInt(id);

      // Check if recipe exists
      const recipe = await this.recipeRepo.findById(recipeId);
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      // Update recipe rating
      const success = await this.recipeRepo.updateRecipeRating(
        req.user.id,
        recipeId,
        rating,
        feedback || null
      );

      // Track interaction
      await this.trackInteraction(req.user.id, recipeId, 'rate');

      return res.json({
        success: success,
        message: 'Feedback submitted successfully',
        data: {
          recipeId,
          rating,
          feedback
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

      console.error('Submit feedback error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
        code: 'FEEDBACK_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/recipes/:id/interaction
   * Track user interaction with a recipe (view, save, cook)
   */
  trackRecipeInteraction = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const { interactionType } = req.body;

      const validTypes = ['view', 'save', 'cook'];
      if (!validTypes.includes(interactionType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid interaction type. Must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_INTERACTION_TYPE'
        });
      }

      const recipeId = parseInt(id);

      // Check if recipe exists
      const recipe = await this.recipeRepo.findById(recipeId);
      if (!recipe) {
        throw new NotFoundError('Recipe');
      }

      // Track the interaction
      await this.trackInteraction(req.user.id, recipeId, interactionType);

      return res.json({
        success: true,
        message: `${interactionType.charAt(0).toUpperCase() + interactionType.slice(1)} interaction tracked`,
        data: {
          recipeId,
          interactionType,
          timestamp: new Date().toISOString()
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

      console.error('Track interaction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to track interaction',
        code: 'INTERACTION_ERROR'
      });
    }
  };

  /**
   * Helper method to track user-recipe interactions
   */
  private async trackInteraction(userId: number, recipeId: number, interactionType: string): Promise<void> {
    try {
      const query = `
        INSERT INTO user_recipe_interactions (user_id, recipe_id, interaction_type, timestamp)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      await this.recipeRepo['db'].run(query, [userId, recipeId, interactionType]);
    } catch (error) {
      console.error('Failed to track interaction:', error);
      // Don't throw - tracking failures shouldn't break the main operation
    }
  }

  private validateRecipeCulturalCompliance(
    ingredients: string[],
    dietaryRestrictions: any[],
    _cuisinePreferences: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for red meat (Hindu dietary restriction)
    const redMeatIngredients = ['beef', 'pork', 'veal', 'lamb', 'mutton', 'ham', 'baison'];
    for (const ingredient of ingredients) {
      const lowerIngredient = ingredient.toLowerCase();
      if (redMeatIngredients.some(meat => lowerIngredient.includes(meat))) {
        errors.push(`Red meat ingredient "${ingredient}" may violate Hindu dietary restrictions`);
      }
    }

    // Check against user's dietary restrictions
    for (const restriction of dietaryRestrictions) {
      if (restriction.severity === 'strict') {
        if (restriction.type === 'religious' && restriction.restriction.toLowerCase().includes('hindu')) {
          const forbiddenIngredients = ['beef', 'pork'];
          for (const ingredient of ingredients) {
            if (forbiddenIngredients.some(forbidden => ingredient.toLowerCase().includes(forbidden))) {
              errors.push(`Ingredient "${ingredient}" violates Hindu dietary restrictions`);
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}