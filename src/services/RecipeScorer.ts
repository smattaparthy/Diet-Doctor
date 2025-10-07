import { Recipe, UserProfile } from '../types';

/**
 * Recipe Scoring System
 * Scores recipes based on user preferences and context
 */

export interface RecipeScore {
  culturalMatch: number;
  doshaBalance: number;
  varietyBonus: number;
  seasonalBonus: number;
  retailerAvailability: number;
  prepTimeScore: number;
  totalScore: number;
}

export interface PlanContext {
  recentRecipes: Recipe[];
  currentSeason: string;
  dayOfWeek: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export class RecipeScorer {
  private readonly weights = {
    culturalMatch: 0.25,
    doshaBalance: 0.20,
    varietyBonus: 0.20,
    seasonalBonus: 0.10,
    retailerAvailability: 0.15,
    prepTimeScore: 0.10
  };

  /**
   * Score a recipe for the given user and context
   */
  scoreRecipe(
    recipe: Recipe,
    user: UserProfile,
    context: PlanContext
  ): RecipeScore {
    const scores = {
      culturalMatch: this.calculateCulturalMatch(recipe, user),
      doshaBalance: this.calculateDoshaBalance(recipe, user),
      varietyBonus: this.calculateVariety(recipe, context.recentRecipes),
      seasonalBonus: this.calculateSeasonality(recipe, context.currentSeason),
      retailerAvailability: this.calculateRetailerMatch(recipe, user),
      prepTimeScore: this.calculatePrepTimeScore(recipe, context.mealType)
    };

    // Validate all scores are numbers
    Object.entries(scores).forEach(([key, value]) => {
      if (isNaN(value)) {
        console.warn(`RecipeScorer: ${key} returned NaN for recipe ${recipe.title}`);
        (scores as any)[key] = 0.5; // Default fallback
      }
    });

    const totalScore = Object.entries(scores).reduce(
      (sum, [key, value]) => {
        const weight = this.weights[key as keyof typeof this.weights];
        return sum + value * weight;
      },
      0
    );

    return { ...scores, totalScore };
  }

  /**
   * Calculate cultural match score
   */
  private calculateCulturalMatch(recipe: Recipe, user: UserProfile): number {
    const preferredCuisines = typeof user.cuisine_preferences === 'string'
      ? JSON.parse(user.cuisine_preferences)
      : user.cuisine_preferences;

    // Exact match = 1.0
    if (preferredCuisines.includes(recipe.cuisine_type)) {
      return 1.0;
    }

    // Fusion/compatible cuisines
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      Indian: { Mediterranean: 0.6, Mexican: 0.4 },
      Mediterranean: { Indian: 0.6, Mexican: 0.5 },
      Mexican: { Mediterranean: 0.5, Indian: 0.4 }
    };

    const crossScore = preferredCuisines.reduce((max: number, pref: string) => {
      const score = compatibilityMatrix[pref]?.[recipe.cuisine_type] || 0;
      return Math.max(max, score);
    }, 0);

    return crossScore;
  }

  /**
   * Calculate dosha balance score (Ayurvedic)
   */
  private calculateDoshaBalance(recipe: Recipe, user: UserProfile): number {
    if (!user.dosha) {
      return 1.0; // No dosha preference, full score
    }

    const doshaAttributes: Record<string, {
      favorable: string[];
      unfavorable: string[];
    }> = {
      vata: {
        favorable: ['warm', 'cooked', 'sweet', 'salty', 'sour', 'moist', 'grounding', 'heavy'],
        unfavorable: ['cold', 'raw', 'bitter', 'astringent', 'dry', 'light']
      },
      pitta: {
        favorable: ['cool', 'sweet', 'bitter', 'astringent', 'mild', 'cooling'],
        unfavorable: ['hot', 'spicy', 'sour', 'salty', 'oily', 'pungent']
      },
      kapha: {
        favorable: ['light', 'dry', 'pungent', 'bitter', 'astringent', 'warm'],
        unfavorable: ['heavy', 'sweet', 'salty', 'sour', 'oily', 'cold']
      }
    };

    const ayurvedicInfo = typeof recipe.ayurvedic_info === 'string'
      ? JSON.parse(recipe.ayurvedic_info)
      : recipe.ayurvedic_info;
    const recipeAttributes = ayurvedicInfo.attributes || [];
    const doshaKey = user.dosha?.toLowerCase() || '';
    const { favorable, unfavorable } = doshaAttributes[doshaKey] || { favorable: [], unfavorable: [] };

    if (favorable.length === 0) {
      // Unknown dosha, return neutral score
      return 0.5;
    }

    const favorableCount = recipeAttributes.filter((attr: string) =>
      favorable.includes(attr)
    ).length;

    const unfavorableCount = recipeAttributes.filter((attr: string) =>
      unfavorable.includes(attr)
    ).length;

    // Score: (favorable - unfavorable) / total_possible
    // Normalize to 0-1 range
    const rawScore = (favorableCount - unfavorableCount) / favorable.length;
    const normalizedScore = Math.max(0, Math.min(1, (rawScore + 1) / 2));

    return normalizedScore;
  }

  /**
   * Calculate variety bonus
   */
  private calculateVariety(recipe: Recipe, recentRecipes: Recipe[]): number {
    if (recentRecipes.length === 0) {
      return 1.0;
    }

    // Penalize repetition of same recipe
    if (recentRecipes.some(r => r.id === recipe.id)) {
      return 0;
    }

    // Penalize similar protein sources
    const proteinSources = recentRecipes.map(r => r.protein_type);
    const sameProtein = proteinSources.includes(recipe.protein_type);

    // Penalize similar cooking methods
    const cookingMethods = recentRecipes.map(r => r.cooking_method);
    const sameMethod = cookingMethods.includes(recipe.cooking_method);

    let varietyScore = 1.0;

    if (sameProtein) {
      varietyScore -= 0.3;
    }

    if (sameMethod) {
      varietyScore -= 0.2;
    }

    // Bonus for completely different cuisine
    const recentCuisines = recentRecipes.map(r => r.cuisine_type);
    if (!recentCuisines.includes(recipe.cuisine_type)) {
      varietyScore += 0.1;
    }

    return Math.max(0, Math.min(1, varietyScore));
  }

  /**
   * Calculate seasonality score
   */
  private calculateSeasonality(recipe: Recipe, currentSeason: string): number {
    const seasonalTags = typeof recipe.seasonal_tags === 'string'
      ? JSON.parse(recipe.seasonal_tags || '[]')
      : recipe.seasonal_tags || [];

    // Year-round recipes always score well
    if (seasonalTags.includes('year-round')) {
      return 0.8;
    }

    // Perfect seasonal match
    if (seasonalTags.includes(currentSeason)) {
      return 1.0;
    }

    // Partial match for adjacent seasons
    const seasonAdjacency: Record<string, string[]> = {
      winter: ['fall', 'spring'],
      spring: ['winter', 'summer'],
      summer: ['spring', 'fall'],
      fall: ['summer', 'winter']
    };

    const adjacentSeasons = seasonAdjacency[currentSeason] || [];
    if (seasonalTags.some((tag: string) => adjacentSeasons.includes(tag))) {
      return 0.6;
    }

    // No seasonal match
    return 0.3;
  }

  /**
   * Calculate retailer availability match
   */
  private calculateRetailerMatch(recipe: Recipe, user: UserProfile): number {
    // For now, simplified scoring based on cuisine-retailer affinity
    // In production, this would check actual product catalog

    // Handle missing retailer_prefs field
    if (!user.retailer_prefs || user.retailer_prefs.length === 0) {
      return 0.8; // Default score when no preference specified
    }

    const cuisineRetailerAffinity: Record<string, Record<string, number>> = {
      Indian: {
        'Patel Brothers': 1.0,
        'Trader Joes': 0.7,
        'Costco': 0.6,
        'Walmart': 0.5
      },
      Mediterranean: {
        'Trader Joes': 1.0,
        'Costco': 0.8,
        'Walmart': 0.7,
        'Patel Brothers': 0.4
      },
      Mexican: {
        'Walmart': 1.0,
        'Costco': 0.9,
        'Trader Joes': 0.8,
        'Patel Brothers': 0.3
      }
    };

    const affinityScores = user.retailer_prefs.map((retailer: string) =>
      cuisineRetailerAffinity[recipe.cuisine_type]?.[retailer] || 0.5
    );

    // Return highest affinity score, with fallback
    return affinityScores.length > 0 ? Math.max(...affinityScores) : 0.5;
  }

  /**
   * Calculate prep time score based on meal type
   */
  private calculatePrepTimeScore(recipe: Recipe, mealType: string): number {
    const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

    // Preferred times by meal type
    const preferredTimes: Record<string, { ideal: number; max: number }> = {
      breakfast: { ideal: 20, max: 40 },
      lunch: { ideal: 30, max: 60 },
      dinner: { ideal: 45, max: 90 },
      snack: { ideal: 15, max: 30 }
    };

    const { ideal, max } = preferredTimes[mealType] || { ideal: 30, max: 60 };

    // Perfect score at ideal time
    if (totalTime <= ideal) {
      return 1.0;
    }

    // Linear decay to max time
    if (totalTime <= max) {
      return 1.0 - ((totalTime - ideal) / (max - ideal)) * 0.5;
    }

    // Penalty for over max time
    return 0.5 * Math.exp(-(totalTime - max) / 30);
  }

  /**
   * Get current season based on date
   */
  static getCurrentSeason(date: Date): string {
    const month = date.getMonth() + 1; // 1-12

    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }
}

// Export singleton instance
export const recipeScorer = new RecipeScorer();
