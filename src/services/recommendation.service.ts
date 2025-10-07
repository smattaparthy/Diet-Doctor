import {
  Recipe,
  UserHealthProfile,
  ScoredRecipe,
  RecipeScore,
  RecommendationOptions,
  RecommendationResult,
  CuisineType
} from '../types';
import { RecipeRepository, UserHealthProfileRepository } from '../repositories';
import { RecipeFilterService } from './recipe-filter.service';
import { DoshaScoringService } from './dosha-scoring.service';
import { PreferenceScoringService } from './preference-scoring.service';

/**
 * RecommendationService
 *
 * Main service that orchestrates the complete recommendation pipeline:
 * 1. Fetch user health profile
 * 2. Apply hard constraint filtering
 * 3. Calculate dosha score (40% weight)
 * 4. Calculate preference score (30% weight)
 * 5. Calculate health goals score (30% weight)
 * 6. Sort by combined score
 * 7. Cache results for performance
 * 8. Generate explanations
 *
 * Story 3.4: Recommendation Service
 */
export class RecommendationService {
  private recipeRepo: RecipeRepository;
  private profileRepo: UserHealthProfileRepository;
  private filterService: RecipeFilterService;
  private doshaScoring: DoshaScoringService;
  private preferenceScoring: PreferenceScoringService;

  // Simple in-memory cache
  private cache: Map<string, { data: RecommendationResult; timestamp: number }>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.recipeRepo = new RecipeRepository();
    this.profileRepo = new UserHealthProfileRepository();
    this.filterService = new RecipeFilterService();
    this.doshaScoring = new DoshaScoringService();
    this.preferenceScoring = new PreferenceScoringService();
    this.cache = new Map();
  }

  /**
   * Get personalized recipe recommendations for a user
   * Main entry point for the recommendation system
   */
  async getRecommendations(
    userId: number,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult> {
    const {
      limit = 20,
      cuisineFilter,
      minScore = 0,
      includePenalizedRecipes = false
    } = options;

    // Check cache first
    const cacheKey = this.getCacheKey(userId, options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch user health profile
    const userProfile = await this.profileRepo.findByUserId(userId);
    if (!userProfile) {
      throw new Error(`User health profile not found for user ${userId}`);
    }

    // Fetch all recipes
    let allRecipes = await this.recipeRepo.findAll(1000, 0); // Get large batch

    // Apply cuisine filter if provided
    if (cuisineFilter && cuisineFilter.length > 0) {
      allRecipes = allRecipes.filter(recipe =>
        cuisineFilter.includes(recipe.cuisine_type)
      );
    }

    const totalEvaluated = allRecipes.length;

    // Step 1: Hard constraint filtering
    const { validRecipes, filteredCount } = this.filterService.filterRecipes(
      allRecipes,
      userProfile
    );

    // Step 2: Score all valid recipes
    const scoredRecipes = validRecipes.map(recipe => {
      const score = this.calculateRecipeScore(recipe, userProfile);
      return {
        ...recipe,
        score
      };
    });

    // Step 3: Filter by minimum score
    let finalRecipes = scoredRecipes.filter(r => r.score.totalScore >= minScore);

    // Step 4: Optionally filter out penalized recipes
    if (!includePenalizedRecipes) {
      finalRecipes = finalRecipes.filter(r => r.score.doshaScore >= 50);
    }

    // Step 5: Sort by total score (descending)
    finalRecipes.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // Step 6: Limit results
    const limitedRecipes = finalRecipes.slice(0, limit);

    // Build result
    const result: RecommendationResult = {
      recipes: limitedRecipes,
      userProfile,
      metadata: {
        totalEvaluated,
        filteredOut: filteredCount,
        recommendationCount: limitedRecipes.length,
        cacheHit: false,
        generatedAt: new Date().toISOString()
      }
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Calculate combined score for a recipe
   * Combines dosha (40%), preference (30%), and health (30%) scores
   */
  private calculateRecipeScore(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): RecipeScore {
    // Calculate dosha score (40% weight)
    const doshaResult = this.doshaScoring.calculateDoshaScore(recipe, userProfile);

    // Calculate preference and health scores (30% each)
    const prefResult = this.preferenceScoring.calculateCombinedScore(recipe, userProfile);

    // Combined total score with weights:
    // 40% dosha + 30% preference + 30% health = 100%
    const totalScore = Math.round(
      doshaResult.score * 0.4 +
      prefResult.preferenceScore * 0.3 +
      prefResult.healthScore * 0.3
    );

    // Generate explanation
    const explanation = this.generateExplanation(
      doshaResult.score,
      prefResult.preferenceScore,
      prefResult.healthScore,
      doshaResult.explanation,
      prefResult.explanation
    );

    return {
      recipeId: recipe.id,
      totalScore,
      doshaScore: doshaResult.score,
      preferenceScore: prefResult.preferenceScore,
      healthScore: prefResult.healthScore,
      explanation
    };
  }

  /**
   * Generate human-readable explanation for recommendation
   */
  private generateExplanation(
    doshaScore: number,
    preferenceScore: number,
    healthScore: number,
    doshaExplanation: string,
    prefExplanation: string
  ): string {
    const parts: string[] = [];

    // Lead with the strongest factor
    const scores = [
      { name: 'dosha compatibility', score: doshaScore, explanation: doshaExplanation },
      { name: 'preferences', score: preferenceScore, explanation: prefExplanation },
      { name: 'health goals', score: healthScore, explanation: prefExplanation }
    ].sort((a, b) => b.score - a.score);

    const topFactor = scores[0];

    if (topFactor.score >= 80) {
      parts.push(`Excellent ${topFactor.name} (${topFactor.score}%)`);
    } else if (topFactor.score >= 60) {
      parts.push(`Good ${topFactor.name} (${topFactor.score}%)`);
    } else {
      parts.push(`Moderate ${topFactor.name} (${topFactor.score}%)`);
    }

    // Add dosha specifics if notable
    if (doshaScore >= 80) {
      parts.push('Strongly balances your dosha');
    } else if (doshaScore < 50) {
      parts.push('May slightly aggravate dosha');
    }

    // Add preference specifics if notable
    if (preferenceScore >= 80) {
      parts.push('Matches your taste preferences');
    }

    return parts.join('. ') + '.';
  }

  /**
   * Get recommendations with detailed analysis
   * Includes additional insights about dosha balance and preferences
   */
  async getDetailedRecommendations(
    userId: number,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult & {
    insights: {
      doshaBalance: string[];
      dietaryTips: string[];
      seasonalGuidance?: { dominantDosha: string; balancingFoods: string[] };
    };
  }> {
    const basicResult = await this.getRecommendations(userId, options);

    // Get user profile
    const userProfile = basicResult.userProfile;

    // Generate insights
    const balancingRecommendations = this.doshaScoring.getBalancingRecommendations(userProfile);
    const dietaryTips = this.preferenceScoring.getDietaryTips(userProfile);

    // Determine current season (simplified)
    const currentSeason = this.getCurrentSeason();
    const seasonalGuidance = this.doshaScoring.getSeasonalDoshaGuidance(currentSeason);

    return {
      ...basicResult,
      insights: {
        doshaBalance: balancingRecommendations.recommendations,
        dietaryTips,
        seasonalGuidance
      }
    };
  }

  /**
   * Get recipes that balance specific dosha
   * Useful for users who know they need to balance a particular dosha
   */
  async getRecipesForDoshaBalance(
    userId: number,
    targetDosha: 'vata' | 'pitta' | 'kapha',
    limit: number = 20
  ): Promise<ScoredRecipe[]> {
    const userProfile = await this.profileRepo.findByUserId(userId);
    if (!userProfile) {
      throw new Error(`User health profile not found for user ${userId}`);
    }

    // Get all recipes
    const allRecipes = await this.recipeRepo.findAll(1000, 0);

    // Filter by hard constraints
    const { validRecipes } = this.filterService.filterRecipes(allRecipes, userProfile);

    // Filter to recipes that decrease the target dosha
    const balancingRecipes = validRecipes.filter(recipe => {
      const recipeRow = recipe as any;
      const doshaEffect = recipeRow[`dosha_${targetDosha}`];
      return doshaEffect && doshaEffect.toLowerCase().includes('decrease');
    });

    // Score and sort
    const scoredRecipes = balancingRecipes
      .map(recipe => ({
        ...recipe,
        score: this.calculateRecipeScore(recipe, userProfile)
      }))
      .sort((a, b) => b.score.totalScore - a.score.totalScore)
      .slice(0, limit);

    return scoredRecipes;
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(userId?: number): void {
    if (userId) {
      // Clear only entries for this user
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`user-${userId}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Generate cache key from user ID and options
   */
  private getCacheKey(userId: number, options: RecommendationOptions): string {
    const optionsStr = JSON.stringify({
      limit: options.limit || 20,
      cuisine: options.cuisineFilter || null,
      minScore: options.minScore || 0,
      includePenalized: options.includePenalizedRecipes || false
    });
    return `user-${userId}-${optionsStr}`;
  }

  /**
   * Get result from cache if not expired
   */
  private getFromCache(key: string): RecommendationResult | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      // Expired
      this.cache.delete(key);
      return null;
    }

    // Mark as cache hit
    return {
      ...cached.data,
      metadata: {
        ...cached.data.metadata,
        cacheHit: true
      }
    };
  }

  /**
   * Store result in cache
   */
  private setCache(key: string, data: RecommendationResult): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Periodically clean old cache entries
    if (this.cache.size > 100) {
      this.cleanOldCacheEntries();
    }
  }

  /**
   * Remove expired cache entries
   */
  private cleanOldCacheEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get current season (simplified implementation)
   * In production, this should use user's location and actual date
   */
  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' | 'monsoon' {
    const month = new Date().getMonth(); // 0-11

    if (month >= 2 && month <= 4) return 'spring';  // Mar-May
    if (month >= 5 && month <= 7) return 'summer';  // Jun-Aug
    if (month >= 8 && month <= 10) return 'autumn'; // Sep-Nov
    return 'winter'; // Dec-Feb
  }

  /**
   * Get statistics about recommendation performance
   */
  getCacheStats(): {
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const now = Date.now();
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const value of this.cache.values()) {
      if (oldest === null || value.timestamp < oldest) {
        oldest = value.timestamp;
      }
      if (newest === null || value.timestamp > newest) {
        newest = value.timestamp;
      }
    }

    return {
      totalEntries: this.cache.size,
      oldestEntry: oldest ? now - oldest : null,
      newestEntry: newest ? now - newest : null
    };
  }
}
