import { Recipe, UserHealthProfile, DoshaCompatibility } from '../types';

/**
 * DoshaScoringService
 *
 * Implements dosha-based compatibility scoring algorithm (40% weight)
 * based on user's vikriti (current state) and recipe's dosha effects.
 *
 * Scoring Logic:
 * - Base score: 100
 * - If dosha is elevated (>50%) in vikriti:
 *   - Recipe increases elevated dosha: -30 points
 *   - Recipe decreases elevated dosha: +20 points
 * - Neutral effects: 0 points
 *
 * Story 3.2: Dosha-Based Scoring Algorithm
 */
export class DoshaScoringService {
  /**
   * Calculate dosha compatibility score for a recipe
   * Returns score 0-100 and explanation
   */
  calculateDoshaScore(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): { score: number; explanation: string } {
    let score = 100;
    const explanationParts: string[] = [];

    // Get user's current dosha state (vikriti)
    const vikriti = {
      vata: userProfile.vikriti_vata,
      pitta: userProfile.vikriti_pitta,
      kapha: userProfile.vikriti_kapha
    };

    // Get recipe's dosha effects
    const recipeEffects = this.getRecipeDoshaEffects(recipe);

    // Evaluate each dosha
    for (const dosha of ['vata', 'pitta', 'kapha'] as const) {
      const doshaScore = vikriti[dosha];
      const recipeEffect = recipeEffects[dosha];

      if (doshaScore > 50) {
        // Dosha is elevated - needs balancing
        if (recipeEffect === 'increase') {
          score -= 30;
          explanationParts.push(
            `Penalized: increases ${dosha} (currently elevated at ${doshaScore}%)`
          );
        } else if (recipeEffect === 'decrease') {
          score += 20;
          explanationParts.push(
            `Boosted: decreases ${dosha} (currently elevated at ${doshaScore}%)`
          );
        } else {
          explanationParts.push(
            `Neutral effect on ${dosha} (currently elevated at ${doshaScore}%)`
          );
        }
      } else {
        // Dosha is balanced or low
        if (recipeEffect === 'decrease' && doshaScore < 30) {
          // Don't further decrease already low dosha
          score -= 10;
          explanationParts.push(
            `Slight penalty: decreases ${dosha} (already low at ${doshaScore}%)`
          );
        } else if (recipeEffect === 'increase' && doshaScore < 30) {
          // Boosting low dosha is beneficial
          score += 10;
          explanationParts.push(
            `Slight boost: increases ${dosha} (low at ${doshaScore}%)`
          );
        }
      }
    }

    // Clamp score to 0-100 range
    score = Math.max(0, Math.min(100, score));

    const explanation = explanationParts.length > 0
      ? explanationParts.join('; ')
      : 'Neutral dosha effects for current constitution';

    return { score, explanation };
  }

  /**
   * Extract dosha effects from recipe
   * Maps database columns (dosha_vata, dosha_pitta, dosha_kapha) to effects
   */
  private getRecipeDoshaEffects(recipe: Recipe): DoshaCompatibility {
    // Type assertion to access database column names
    const recipeRow = recipe as any;

    return {
      vata: this.normalizeDoshaEffect(recipeRow.dosha_vata),
      pitta: this.normalizeDoshaEffect(recipeRow.dosha_pitta),
      kapha: this.normalizeDoshaEffect(recipeRow.dosha_kapha)
    };
  }

  /**
   * Normalize dosha effect string to enum value
   * Handles variations like 'increases', 'increase', 'balances', etc.
   */
  private normalizeDoshaEffect(effect: string | null | undefined): 'increase' | 'decrease' | 'neutral' {
    if (!effect) {
      return 'neutral';
    }

    const effectLower = effect.toLowerCase();

    if (effectLower.includes('increase') || effectLower.includes('aggravate') || effectLower.includes('raise')) {
      return 'increase';
    }

    if (effectLower.includes('decrease') || effectLower.includes('reduce') || effectLower.includes('pacif') || effectLower.includes('balance')) {
      return 'decrease';
    }

    return 'neutral';
  }

  /**
   * Get elevated doshas from user profile
   * Returns array of dosha names where score > 50%
   */
  getElevatedDoshas(userProfile: UserHealthProfile): string[] {
    const elevated: string[] = [];

    if (userProfile.vikriti_vata > 50) {
      elevated.push('vata');
    }
    if (userProfile.vikriti_pitta > 50) {
      elevated.push('pitta');
    }
    if (userProfile.vikriti_kapha > 50) {
      elevated.push('kapha');
    }

    return elevated;
  }

  /**
   * Get balancing recommendations for user's dosha state
   */
  getBalancingRecommendations(userProfile: UserHealthProfile): {
    primaryImbalance: string | null;
    recommendations: string[];
  } {
    const vikriti = {
      vata: userProfile.vikriti_vata,
      pitta: userProfile.vikriti_pitta,
      kapha: userProfile.vikriti_kapha
    };

    // Find most elevated dosha
    const sorted = Object.entries(vikriti).sort((a, b) => b[1] - a[1]);
    const primaryDosha = sorted[0][0];
    const primaryScore = sorted[0][1];

    if (primaryScore <= 50) {
      return {
        primaryImbalance: null,
        recommendations: ['Your doshas appear balanced. Focus on maintaining equilibrium.']
      };
    }

    const recommendations: string[] = [];

    switch (primaryDosha) {
      case 'vata':
        recommendations.push(
          'Choose warm, cooked foods over cold/raw foods',
          'Favor sweet, sour, and salty tastes',
          'Include healthy fats and oils',
          'Avoid excessive pungent, bitter, and astringent tastes'
        );
        break;

      case 'pitta':
        recommendations.push(
          'Choose cooling foods and avoid spicy/hot foods',
          'Favor sweet, bitter, and astringent tastes',
          'Include cooling vegetables and dairy',
          'Avoid excessive sour, salty, and pungent tastes'
        );
        break;

      case 'kapha':
        recommendations.push(
          'Choose light, dry, and warm foods',
          'Favor pungent, bitter, and astringent tastes',
          'Include spices and warming herbs',
          'Avoid excessive sweet, sour, and salty tastes',
          'Reduce heavy, oily, and fried foods'
        );
        break;
    }

    return {
      primaryImbalance: primaryDosha,
      recommendations
    };
  }

  /**
   * Determine if recipe is beneficial for user's dosha balance
   * Returns true if recipe helps balance elevated doshas
   */
  isBalancingRecipe(recipe: Recipe, userProfile: UserHealthProfile): boolean {
    const elevatedDoshas = this.getElevatedDoshas(userProfile);

    if (elevatedDoshas.length === 0) {
      // No imbalance - any recipe is fine
      return true;
    }

    const recipeEffects = this.getRecipeDoshaEffects(recipe);

    // Check if recipe decreases at least one elevated dosha
    for (const dosha of elevatedDoshas) {
      if (recipeEffects[dosha as keyof DoshaCompatibility] === 'decrease') {
        return true;
      }
    }

    // Check if recipe increases elevated doshas (not balancing)
    for (const dosha of elevatedDoshas) {
      if (recipeEffects[dosha as keyof DoshaCompatibility] === 'increase') {
        return false;
      }
    }

    // Neutral effects are acceptable
    return true;
  }

  /**
   * Get detailed dosha analysis for a recipe
   */
  analyzeDoshaCompatibility(
    recipe: Recipe,
    userProfile: UserHealthProfile
  ): {
    score: number;
    isBalancing: boolean;
    elevatedDoshas: string[];
    recipeEffects: DoshaCompatibility;
    recommendations: string[];
  } {
    const { score, explanation } = this.calculateDoshaScore(recipe, userProfile);
    const elevatedDoshas = this.getElevatedDoshas(userProfile);
    const recipeEffects = this.getRecipeDoshaEffects(recipe);
    const isBalancing = this.isBalancingRecipe(recipe, userProfile);
    const { recommendations } = this.getBalancingRecommendations(userProfile);

    return {
      score,
      isBalancing,
      elevatedDoshas,
      recipeEffects,
      recommendations: [explanation, ...recommendations]
    };
  }

  /**
   * Get seasonal dosha recommendations
   * Different seasons tend to elevate different doshas
   */
  getSeasonalDoshaGuidance(season: 'spring' | 'summer' | 'autumn' | 'winter' | 'monsoon'): {
    dominantDosha: string;
    balancingFoods: string[];
  } {
    const seasonalMap = {
      spring: {
        dominantDosha: 'kapha',
        balancingFoods: ['Light, dry foods', 'Bitter and astringent vegetables', 'Warming spices']
      },
      summer: {
        dominantDosha: 'pitta',
        balancingFoods: ['Cooling foods', 'Sweet fruits', 'Hydrating vegetables', 'Coconut']
      },
      monsoon: {
        dominantDosha: 'vata',
        balancingFoods: ['Warm soups', 'Cooked vegetables', 'Ginger tea', 'Easily digestible foods']
      },
      autumn: {
        dominantDosha: 'vata',
        balancingFoods: ['Warm, moist foods', 'Root vegetables', 'Healthy fats', 'Sweet fruits']
      },
      winter: {
        dominantDosha: 'kapha',
        balancingFoods: ['Warming foods', 'Spices', 'Hot beverages', 'Cooked grains']
      }
    };

    return seasonalMap[season] || seasonalMap.autumn;
  }
}
