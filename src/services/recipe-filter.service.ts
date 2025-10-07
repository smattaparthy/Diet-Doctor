import { Recipe, FilterConstraints, UserHealthProfile } from '../types';

/**
 * RecipeFilterService
 *
 * Implements hard constraint filtering for recipes based on:
 * - Allergens (complete exclusion)
 * - Dietary restrictions (vegetarian, vegan, no-beef, etc.)
 * - Cultural/religious restrictions
 * - Optional time constraints
 *
 * Story 3.1: Hard Constraint Filtering
 */
export class RecipeFilterService {
  /**
   * Filter recipes based on user health profile hard constraints
   * Returns only recipes that pass ALL hard constraints
   */
  filterRecipes(
    recipes: Recipe[],
    userProfile: UserHealthProfile
  ): { validRecipes: Recipe[]; filteredCount: number; filterReasons: Map<number, string[]> } {
    const constraints = this.buildConstraints(userProfile);
    const filterReasons = new Map<number, string[]>();
    let filteredCount = 0;

    const validRecipes = recipes.filter(recipe => {
      const reasons = this.getFilterReasons(recipe, constraints);

      if (reasons.length > 0) {
        filterReasons.set(recipe.id, reasons);
        filteredCount++;
        return false;
      }

      return true;
    });

    return { validRecipes, filteredCount, filterReasons };
  }

  /**
   * Check if a single recipe passes all hard constraints
   */
  passesConstraints(recipe: Recipe, userProfile: UserHealthProfile): boolean {
    const constraints = this.buildConstraints(userProfile);
    const reasons = this.getFilterReasons(recipe, constraints);
    return reasons.length === 0;
  }

  /**
   * Build filter constraints from user health profile
   */
  private buildConstraints(userProfile: UserHealthProfile): FilterConstraints {
    return {
      allergens: userProfile.allergies || [],
      dietaryRestrictions: userProfile.dietary_restrictions || [],
      culturalRestrictions: this.extractCulturalRestrictions(userProfile.dietary_restrictions || [])
    };
  }

  /**
   * Extract cultural restrictions from dietary restrictions
   * e.g., 'no-beef' -> cultural restriction
   */
  private extractCulturalRestrictions(dietaryRestrictions: string[]): string[] {
    const culturalKeywords = ['no-beef', 'no-pork', 'hindu', 'muslim', 'kosher', 'halal'];
    return dietaryRestrictions.filter(restriction =>
      culturalKeywords.some(keyword => restriction.toLowerCase().includes(keyword))
    );
  }

  /**
   * Get all reasons why a recipe should be filtered out
   * Returns empty array if recipe passes all constraints
   */
  private getFilterReasons(recipe: Recipe, constraints: FilterConstraints): string[] {
    const reasons: string[] = [];

    // Check allergens (HARD CONSTRAINT - must be 0% match)
    const allergenViolations = this.checkAllergens(recipe, constraints.allergens);
    if (allergenViolations.length > 0) {
      reasons.push(...allergenViolations);
    }

    // Check dietary restrictions
    const dietaryViolations = this.checkDietaryRestrictions(recipe, constraints.dietaryRestrictions);
    if (dietaryViolations.length > 0) {
      reasons.push(...dietaryViolations);
    }

    // Check cultural restrictions
    const culturalViolations = this.checkCulturalRestrictions(recipe, constraints.culturalRestrictions);
    if (culturalViolations.length > 0) {
      reasons.push(...culturalViolations);
    }

    return reasons;
  }

  /**
   * Check if recipe contains any user allergens
   * Returns array of allergen violations
   */
  private checkAllergens(recipe: Recipe, allergens: string[]): string[] {
    const violations: string[] = [];

    if (!allergens || allergens.length === 0) {
      return violations;
    }

    const ingredientNames = recipe.ingredients.map(ing =>
      (ing.name || '').toLowerCase()
    );
    const recipeDescription = (recipe.description || '').toLowerCase();
    const recipeTags = (recipe.tags || []).map(tag => tag.toLowerCase());

    for (const allergen of allergens) {
      const allergenLower = allergen.toLowerCase();

      // Check ingredients
      if (ingredientNames.some(name => this.containsAllergen(name, allergenLower))) {
        violations.push(`Contains allergen: ${allergen}`);
        continue;
      }

      // Check description
      if (this.containsAllergen(recipeDescription, allergenLower)) {
        violations.push(`May contain allergen (description): ${allergen}`);
        continue;
      }

      // Check tags
      if (recipeTags.some(tag => this.containsAllergen(tag, allergenLower))) {
        violations.push(`Tagged with allergen: ${allergen}`);
      }
    }

    return violations;
  }

  /**
   * Check if text contains an allergen with fuzzy matching
   */
  private containsAllergen(text: string, allergen: string): boolean {
    // Direct match
    if (text.includes(allergen)) {
      return true;
    }

    // Common allergen synonyms
    const allergenMap: Record<string, string[]> = {
      'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ghee', 'paneer', 'curd'],
      'nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'peanut'],
      'shellfish': ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam'],
      'fish': ['salmon', 'tuna', 'cod', 'mackerel', 'sardine', 'tilapia'],
      'eggs': ['egg', 'omelette', 'scrambled'],
      'soy': ['tofu', 'tempeh', 'soy sauce', 'edamame'],
      'gluten': ['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'noodle']
    };

    const synonyms = allergenMap[allergen] || [];
    return synonyms.some(synonym => text.includes(synonym));
  }

  /**
   * Check dietary restrictions (vegetarian, vegan, etc.)
   */
  private checkDietaryRestrictions(recipe: Recipe, restrictions: string[]): string[] {
    const violations: string[] = [];

    if (!restrictions || restrictions.length === 0) {
      return violations;
    }

    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();

      // Vegetarian check
      if (restrictionLower.includes('vegetarian')) {
        if (this.containsMeat(recipe)) {
          violations.push('Contains meat (vegetarian restriction)');
        }
      }

      // Vegan check
      if (restrictionLower.includes('vegan')) {
        if (this.containsMeat(recipe) || this.containsAnimalProducts(recipe)) {
          violations.push('Contains animal products (vegan restriction)');
        }
      }

      // Gluten-free check
      if (restrictionLower.includes('gluten-free') || restrictionLower.includes('gluten free')) {
        if (this.containsGluten(recipe)) {
          violations.push('Contains gluten');
        }
      }
    }

    return violations;
  }

  /**
   * Check cultural/religious restrictions
   */
  private checkCulturalRestrictions(recipe: Recipe, restrictions: string[]): string[] {
    const violations: string[] = [];

    if (!restrictions || restrictions.length === 0) {
      return violations;
    }

    const ingredientText = recipe.ingredients
      .map(ing => (ing.name || '').toLowerCase())
      .join(' ');

    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();

      // No beef (Hindu restriction)
      if (restrictionLower.includes('no-beef') || restrictionLower.includes('hindu')) {
        if (ingredientText.includes('beef') || ingredientText.includes('veal')) {
          violations.push('Contains beef (Hindu restriction)');
        }
      }

      // No pork (Muslim/Jewish restriction)
      if (restrictionLower.includes('no-pork') || restrictionLower.includes('halal') || restrictionLower.includes('kosher')) {
        if (ingredientText.includes('pork') || ingredientText.includes('ham') || ingredientText.includes('bacon')) {
          violations.push('Contains pork (Halal/Kosher restriction)');
        }
      }

      // Halal (additional restrictions)
      if (restrictionLower.includes('halal')) {
        if (ingredientText.includes('alcohol') || ingredientText.includes('wine') || ingredientText.includes('beer')) {
          violations.push('Contains alcohol (Halal restriction)');
        }
      }
    }

    return violations;
  }

  /**
   * Check if recipe contains meat ingredients
   */
  private containsMeat(recipe: Recipe): boolean {
    const meatKeywords = [
      'chicken', 'turkey', 'duck', 'lamb', 'mutton', 'beef', 'pork',
      'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'crab', 'lobster',
      'meat', 'poultry', 'seafood'
    ];

    const ingredientText = recipe.ingredients
      .map(ing => (ing.name || '').toLowerCase())
      .join(' ');

    return meatKeywords.some(keyword => ingredientText.includes(keyword));
  }

  /**
   * Check if recipe contains animal products
   */
  private containsAnimalProducts(recipe: Recipe): boolean {
    const animalProducts = [
      'milk', 'yogurt', 'cheese', 'butter', 'cream', 'ghee', 'paneer', 'curd',
      'egg', 'honey'
    ];

    const ingredientText = recipe.ingredients
      .map(ing => (ing.name || '').toLowerCase())
      .join(' ');

    return animalProducts.some(product => ingredientText.includes(product));
  }

  /**
   * Check if recipe contains gluten
   */
  private containsGluten(recipe: Recipe): boolean {
    const glutenKeywords = [
      'wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'noodle',
      'semolina', 'couscous', 'bulgur', 'farina'
    ];

    const ingredientText = recipe.ingredients
      .map(ing => (ing.name || '').toLowerCase())
      .join(' ');

    return glutenKeywords.some(keyword => ingredientText.includes(keyword));
  }

  /**
   * Get statistics about filtering results
   */
  getFilteringStats(
    totalRecipes: number,
    validRecipes: number,
    filterReasons: Map<number, string[]>
  ): {
    totalRecipes: number;
    validRecipes: number;
    filteredRecipes: number;
    filterPercentage: number;
    commonReasons: Map<string, number>;
  } {
    const commonReasons = new Map<string, number>();

    // Count common filter reasons
    for (const reasons of filterReasons.values()) {
      for (const reason of reasons) {
        commonReasons.set(reason, (commonReasons.get(reason) || 0) + 1);
      }
    }

    return {
      totalRecipes,
      validRecipes,
      filteredRecipes: totalRecipes - validRecipes,
      filterPercentage: totalRecipes > 0 ? ((totalRecipes - validRecipes) / totalRecipes) * 100 : 0,
      commonReasons
    };
  }
}
