import { Recipe, UserHealthProfile, HealthGoalMapping } from '../types';

/**
 * PreferenceScoringService
 *
 * Implements preference and health goals scoring (60% weight combined):
 * - Cuisine preference matching (30% weight)
 * - Spice level compatibility (10% weight)
 * - Cooking time preferences (10% weight)
 * - Health goals alignment (10% weight)
 *
 * Story 3.3: Preference & Health Goals Scoring
 */
export class PreferenceScoringService {
  // Health goal mappings to Ayurvedic principles
  private healthGoalMappings: HealthGoalMapping[] = [
    {
      goal: 'weight-management',
      beneficialTastes: ['pungent', 'bitter', 'astringent'],
      beneficialQualities: ['light', 'dry', 'warm'],
      doshaRecommendations: ['decrease-kapha']
    },
    {
      goal: 'digestion',
      beneficialTastes: ['sweet', 'sour', 'salty'],
      beneficialQualities: ['warm', 'moist'],
      doshaRecommendations: ['balance-vata', 'support-agni']
    },
    {
      goal: 'energy',
      beneficialTastes: ['sweet', 'salty'],
      beneficialQualities: ['heavy', 'moist', 'warm'],
      doshaRecommendations: ['decrease-vata', 'increase-kapha']
    },
    {
      goal: 'stress-reduction',
      beneficialTastes: ['sweet', 'sour'],
      beneficialQualities: ['heavy', 'moist', 'cooling'],
      doshaRecommendations: ['decrease-vata', 'decrease-pitta']
    },
    {
      goal: 'inflammation',
      beneficialTastes: ['sweet', 'bitter', 'astringent'],
      beneficialQualities: ['cooling', 'dry'],
      doshaRecommendations: ['decrease-pitta']
    },
    {
      goal: 'immunity',
      beneficialTastes: ['sweet', 'sour', 'salty'],
      beneficialQualities: ['warm', 'heavy'],
      doshaRecommendations: ['balance-all']
    }
  ];

  /**
   * Calculate combined preference score (30% weight)
   * Includes cuisine matching, spice level, and cooking time
   */
  calculatePreferenceScore(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    let totalScore = 0;
    const explanationParts: string[] = [];

    // Cuisine preference (70% of preference score = 21% of total)
    const cuisineScore = this.scoreCuisineMatch(recipe, userProfile);
    totalScore += cuisineScore.score * 0.7;
    if (cuisineScore.explanation) {
      explanationParts.push(cuisineScore.explanation);
    }

    // Spice level (15% of preference score = 4.5% of total)
    const spiceScore = this.scoreSpiceLevel(recipe, userProfile);
    totalScore += spiceScore.score * 0.15;
    if (spiceScore.explanation) {
      explanationParts.push(spiceScore.explanation);
    }

    // Cooking time (15% of preference score = 4.5% of total)
    const timeScore = this.scoreCookingTime(recipe, userProfile);
    totalScore += timeScore.score * 0.15;
    if (timeScore.explanation) {
      explanationParts.push(timeScore.explanation);
    }

    const explanation = explanationParts.join('; ');

    return { score: Math.round(totalScore), explanation };
  }

  /**
   * Calculate health goals alignment score (30% weight)
   */
  calculateHealthScore(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    if (!userProfile.health_concerns || userProfile.health_concerns.length === 0) {
      return {
        score: 100,
        explanation: 'No specific health goals specified'
      };
    }

    let totalScore = 0;
    const explanationParts: string[] = [];

    for (const concern of userProfile.health_concerns) {
      const concernMapping = this.healthGoalMappings.find(
        mapping => mapping.goal === concern.toLowerCase()
      );

      if (concernMapping) {
        const score = this.scoreHealthGoalAlignment(recipe, concernMapping);
        totalScore += score.score;
        explanationParts.push(score.explanation);
      }
    }

    // Average score across all health concerns
    const avgScore = userProfile.health_concerns.length > 0
      ? totalScore / userProfile.health_concerns.length
      : 100;

    const explanation = explanationParts.length > 0
      ? explanationParts.join('; ')
      : 'Neutral health goal alignment';

    return { score: Math.round(avgScore), explanation };
  }

  /**
   * Score cuisine preference matching
   */
  private scoreCuisineMatch(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    if (!userProfile.cuisine_preferences || userProfile.cuisine_preferences.length === 0) {
      return { score: 100, explanation: '' };
    }

    const recipeCuisine = recipe.cuisine_type.toLowerCase();
    const userPreferences = userProfile.cuisine_preferences.map(c => c.toLowerCase());

    // Exact match - full score
    if (userPreferences.includes(recipeCuisine)) {
      return {
        score: 100,
        explanation: `Matches preferred cuisine: ${recipe.cuisine_type}`
      };
    }

    // Related cuisines - partial score
    const relatedCuisines = this.getRelatedCuisines(recipeCuisine);
    const hasRelatedMatch = userPreferences.some(pref =>
      relatedCuisines.includes(pref)
    );

    if (hasRelatedMatch) {
      return {
        score: 70,
        explanation: `Related to preferred cuisine (${recipe.cuisine_type})`
      };
    }

    // No match - lower score but not zero (variety is good)
    return {
      score: 40,
      explanation: `Different cuisine for variety (${recipe.cuisine_type})`
    };
  }

  /**
   * Get related cuisines for broader matching
   */
  private getRelatedCuisines(cuisine: string): string[] {
    const cuisineGroups: Record<string, string[]> = {
      north_indian: ['punjabi', 'mughlai', 'rajasthani'],
      south_indian: ['tamil', 'kerala', 'telugu', 'karnataka'],
      punjabi: ['north_indian', 'mughlai'],
      gujarati: ['north_indian', 'rajasthani'],
      bengali: ['east_indian'],
      mediterranean: ['greek', 'italian', 'spanish'],
      mexican: ['tex_mex', 'latin_american'],
      chinese: ['asian', 'thai', 'japanese'],
      thai: ['asian', 'chinese', 'vietnamese'],
      japanese: ['asian', 'chinese']
    };

    return cuisineGroups[cuisine.toLowerCase()] || [];
  }

  /**
   * Score spice level compatibility
   */
  private scoreSpiceLevel(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    const userPreference = userProfile.spice_level || 'medium';

    // Infer recipe spice level from tags or cuisine
    const recipeSpiceLevel = this.inferRecipeSpiceLevel(recipe);

    if (userPreference === recipeSpiceLevel) {
      return {
        score: 100,
        explanation: `Matches ${userPreference} spice preference`
      };
    }

    // Tolerance for one level difference
    const spiceLevels = ['mild', 'medium', 'hot'];
    const userIndex = spiceLevels.indexOf(userPreference);
    const recipeIndex = spiceLevels.indexOf(recipeSpiceLevel);

    if (Math.abs(userIndex - recipeIndex) === 1) {
      return {
        score: 70,
        explanation: `Slightly ${recipeSpiceLevel} than preference`
      };
    }

    return {
      score: 40,
      explanation: `${recipeSpiceLevel} (different from ${userPreference} preference)`
    };
  }

  /**
   * Infer recipe spice level from ayurvedic info and tags
   */
  private inferRecipeSpiceLevel(recipe: Recipe): 'mild' | 'medium' | 'hot' {
    // Check ayurvedic info for pungent taste (indicates spicy)
    if (recipe.ayurvedic_info?.taste_profile?.includes('pungent')) {
      return 'hot';
    }

    // Check tags
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    if (tags.some(t => t.includes('spicy') || t.includes('hot'))) {
      return 'hot';
    }
    if (tags.some(t => t.includes('mild') || t.includes('gentle'))) {
      return 'mild';
    }

    // Check cuisine type (some cuisines are typically spicier)
    const spicyCuisines = ['mexican', 'thai', 'south_indian', 'punjabi'];
    if (spicyCuisines.includes(recipe.cuisine_type.toLowerCase())) {
      return 'hot';
    }

    const mildCuisines = ['japanese', 'mediterranean'];
    if (mildCuisines.includes(recipe.cuisine_type.toLowerCase())) {
      return 'mild';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Score cooking time preference
   */
  private scoreCookingTime(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

    // Activity level affects time preference
    const activityLevel = userProfile.activity_level || 'moderate';
    const maxPreferredTime = this.getMaxPreferredTime(activityLevel);

    if (totalTime <= maxPreferredTime) {
      return {
        score: 100,
        explanation: `Quick recipe (${totalTime} min)`
      };
    }

    // Gradual penalty for longer times
    const penalty = Math.min(60, ((totalTime - maxPreferredTime) / maxPreferredTime) * 100);

    return {
      score: Math.max(40, 100 - penalty),
      explanation: `Takes ${totalTime} min (above typical preference)`
    };
  }

  /**
   * Get maximum preferred cooking time based on activity level
   */
  private getMaxPreferredTime(activityLevel: string): number {
    const timeMap: Record<string, number> = {
      'very_active': 30,   // Very busy - prefer quick meals
      'active': 45,        // Active - moderate time
      'moderate': 60,      // Moderate - willing to cook
      'light': 75,         // Light activity - more time available
      'sedentary': 90      // Sedentary - plenty of time
    };

    return timeMap[activityLevel] || 60;
  }

  /**
   * Score recipe alignment with specific health goal
   */
  private scoreHealthGoalAlignment(
    recipe: Recipe,
    goalMapping: HealthGoalMapping
  ): { score: number; explanation: string } {
    let score = 100;
    const explanationParts: string[] = [];

    // Check taste alignment
    const recipeTastes = recipe.ayurvedic_info?.taste_profile || [];
    const tasteMatch = recipeTastes.some(taste =>
      goalMapping.beneficialTastes.includes(taste)
    );

    if (tasteMatch) {
      score += 20;
      explanationParts.push(`Contains beneficial tastes for ${goalMapping.goal}`);
    }

    // Check qualities alignment (if available in recipe data)
    const recipeQualities = (recipe as any).qualities || [];
    if (recipeQualities.length > 0) {
      const qualityMatch = recipeQualities.some((quality: string) =>
        goalMapping.beneficialQualities.includes(quality.toLowerCase())
      );

      if (qualityMatch) {
        score += 20;
        explanationParts.push(`Has beneficial qualities for ${goalMapping.goal}`);
      }
    }

    // Check health benefits (if available)
    const recipeRow = recipe as any;
    const healthBenefits = recipeRow.health_benefits
      ? JSON.parse(recipeRow.health_benefits)
      : [];

    if (healthBenefits.length > 0) {
      const benefitMatch = healthBenefits.some((benefit: string) =>
        benefit.toLowerCase().includes(goalMapping.goal)
      );

      if (benefitMatch) {
        score += 30;
        explanationParts.push(`Directly supports ${goalMapping.goal} goal`);
      }
    }

    // Clamp score
    score = Math.min(150, score);

    const explanation = explanationParts.length > 0
      ? explanationParts.join('; ')
      : `Standard support for ${goalMapping.goal}`;

    return { score, explanation };
  }

  /**
   * Calculate combined ranking function
   * Combines preference (30%) and health (30%) scores
   */
  calculateCombinedScore(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): {
    preferenceScore: number;
    healthScore: number;
    combinedScore: number;
    explanation: string;
  } {
    const preference = this.calculatePreferenceScore(recipe, userProfile);
    const health = this.calculateHealthScore(recipe, userProfile);

    // Combined: 30% preference + 30% health = 60% total
    const combinedScore = Math.round(
      preference.score * 0.5 + health.score * 0.5
    );

    const explanation = `Preference: ${preference.explanation}; Health: ${health.explanation}`;

    return {
      preferenceScore: preference.score,
      healthScore: health.score,
      combinedScore,
      explanation
    };
  }

  /**
   * Get personalized dietary tips based on user profile
   */
  getDietaryTips(userProfile: UserHealthProfile): string[] {
    const tips: string[] = [];

    // Activity level tips
    if (userProfile.activity_level === 'very_active' || userProfile.activity_level === 'active') {
      tips.push('Focus on protein-rich meals to support your active lifestyle');
      tips.push('Quick, nutritious meals work best for your schedule');
    }

    // Stress level tips
    if (userProfile.stress_level === 'high') {
      tips.push('Choose calming, grounding foods to reduce stress');
      tips.push('Avoid excessive caffeine and stimulating spices');
    }

    // Sleep quality tips
    if (userProfile.sleep_quality === 'poor' || userProfile.sleep_quality === 'fair') {
      tips.push('Avoid heavy, late-night meals');
      tips.push('Choose warm, easy-to-digest foods in the evening');
    }

    // Health concern specific tips
    if (userProfile.health_concerns?.includes('digestion')) {
      tips.push('Favor warm, cooked foods over raw/cold foods');
      tips.push('Include digestive spices like ginger, cumin, fennel');
    }

    if (userProfile.health_concerns?.includes('weight-management')) {
      tips.push('Choose light, low-fat preparations');
      tips.push('Include plenty of vegetables and lean proteins');
    }

    return tips;
  }
}
