import { Recipe, UserProfile, ConstraintRule } from '../types';
import { DatabaseConnection } from '../database/connection';

const db = DatabaseConnection.getInstance();

/**
 * Constraint Engine
 * Validates recipes against user dietary, religious, and Ayurvedic constraints
 */

export interface ValidationResult {
  valid: boolean;
  score: number;
  violations: string[];
}

export class ConstraintEngine {
  private rules: Map<string, ConstraintRule> = new Map();
  private rulesLoaded: Promise<void>;

  constructor() {
    this.rulesLoaded = this.loadRules();
  }

  /**
   * Load constraint rules from database
   */
  private async loadRules(): Promise<void> {
    const sql = 'SELECT * FROM constraint_rules WHERE 1=1';
    const rules = await db.all<ConstraintRule>(sql);

    for (const rule of rules) {
      this.rules.set(rule.name, rule);
    }
    console.log(`ConstraintEngine: Loaded ${this.rules.size} rules`);
  }

  /**
   * Ensure rules are loaded before validation
   */
  private async ensureRulesLoaded(): Promise<void> {
    await this.rulesLoaded;
  }

  /**
   * Validate recipe against user constraints
   */
  async validateRecipe(recipe: Recipe, user: UserProfile): Promise<ValidationResult> {
    await this.ensureRulesLoaded();
    const applicableRules = this.getRulesForUser(user);
    const results: Array<{
      passed: boolean;
      weight: number;
      type: string;
      ruleName: string;
    }> = [];

    const violations: string[] = [];

    for (const rule of applicableRules) {
      const passed = this.executeValidator(rule, recipe, user);

      results.push({
        passed,
        weight: rule.weight,
        type: rule.type,
        ruleName: rule.name
      });

      if (!passed) {
        if (rule.type === 'HARD_RULE') {
          violations.push(`${rule.name}: ${rule.description}`);
        }
      }
    }

    // HARD_RULE failures = invalid recipe
    const hardRuleFailures = results.filter(r =>
      r.type === 'HARD_RULE' && !r.passed
    );

    if (hardRuleFailures.length > 0) {
      return {
        valid: false,
        score: 0,
        violations
      };
    }

    // Score based on PREFERENCE and SOFT_RULE compliance
    const softResults = results.filter(r => r.type !== 'HARD_RULE');

    if (softResults.length === 0) {
      return { valid: true, score: 1.0, violations: [] };
    }

    const score = softResults.reduce((acc, r) =>
      acc + (r.passed ? r.weight : 0), 0
    ) / softResults.reduce((acc, r) => acc + r.weight, 0);

    return {
      valid: true,
      score,
      violations: []
    };
  }

  /**
   * Get rules applicable to user
   */
  private getRulesForUser(user: UserProfile): ConstraintRule[] {
    const applicable: ConstraintRule[] = [];

    for (const rule of this.rules.values()) {
      const applicability = JSON.parse(rule.applicability);

      // Check if rule applies to this user
      if (this.isRuleApplicable(applicability, user)) {
        applicable.push(rule);
      }
    }

    return applicable;
  }

  /**
   * Check if rule is applicable to user
   */
  private isRuleApplicable(applicability: string[], user: UserProfile): boolean {
    // Global rules apply to everyone
    if (applicability.includes('all')) {
      return true;
    }

    // Check cultural background
    if (applicability.includes(user.cultural_background)) {
      return true;
    }

    // Check dietary restrictions
    const dietaryRestrictions = typeof user.dietary_restrictions === 'string'
      ? JSON.parse(user.dietary_restrictions)
      : user.dietary_restrictions;
    for (const restriction of dietaryRestrictions) {
      if (applicability.includes(restriction)) {
        return true;
      }
    }

    // Check dosha
    if (user.dosha && applicability.includes(user.dosha)) {
      return true;
    }

    // Check cuisine preferences
    const cuisinePrefs = typeof user.cuisine_preferences === 'string'
      ? JSON.parse(user.cuisine_preferences)
      : user.cuisine_preferences;
    for (const cuisine of cuisinePrefs) {
      if (applicability.includes(cuisine)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Execute validator function for a rule
   */
  private executeValidator(
    rule: ConstraintRule,
    recipe: Recipe,
    user: UserProfile
  ): boolean {
    switch (rule.validator_function) {
      case 'validateNoBeef':
        return this.validateNoBeef(recipe);

      case 'validateNoRedMeat':
        return this.validateNoRedMeat(recipe);

      case 'validateVegetarian':
        return this.validateVegetarian(recipe);

      case 'validateVegan':
        return this.validateVegan(recipe);

      case 'validateDoshaBalance':
        return this.validateDoshaBalance(recipe, user, rule);

      case 'validateIndianSpices':
        return this.validateIndianSpices(recipe);

      case 'validateMediterraneanIngredients':
        return this.validateMediterraneanIngredients(recipe);

      case 'validateMexicanIngredients':
        return this.validateMexicanIngredients(recipe);

      default:
        console.warn(`Unknown validator: ${rule.validator_function}`);
        return true;
    }
  }

  /**
   * Validator: No beef
   */
  private validateNoBeef(recipe: Recipe): boolean {
    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const forbiddenIngredients = ['beef', 'cow'];

    return !ingredients.some((ing: any) =>
      forbiddenIngredients.some(forbidden =>
        ing.name.toLowerCase().includes(forbidden)
      )
    );
  }

  /**
   * Validator: No red meat (global)
   */
  private validateNoRedMeat(recipe: Recipe): boolean {
    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const forbiddenIngredients = ['beef', 'lamb', 'pork', 'veal', 'goat'];

    return !ingredients.some((ing: any) =>
      forbiddenIngredients.some(forbidden =>
        ing.name.toLowerCase().includes(forbidden)
      )
    );
  }

  /**
   * Validator: Vegetarian
   */
  private validateVegetarian(recipe: Recipe): boolean {
    const tags = typeof recipe.tags === 'string'
      ? (recipe.tags ? JSON.parse(recipe.tags) : [])
      : (recipe.tags || []);

    // Check if explicitly tagged as vegetarian
    if (tags.includes('vegetarian') || tags.includes('vegan')) {
      return true;
    }

    // Check protein type
    const nonVegProteins = ['chicken', 'fish', 'seafood'];
    if (recipe.protein_type && nonVegProteins.includes(recipe.protein_type)) {
      return false;
    }

    // Check ingredients for meat/fish
    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const meatKeywords = ['chicken', 'fish', 'meat', 'poultry', 'seafood', 'prawn', 'shrimp'];

    return !ingredients.some((ing: any) =>
      meatKeywords.some(keyword =>
        ing.name.toLowerCase().includes(keyword)
      )
    );
  }

  /**
   * Validator: Vegan
   */
  private validateVegan(recipe: Recipe): boolean {
    const tags = typeof recipe.tags === 'string'
      ? (recipe.tags ? JSON.parse(recipe.tags) : [])
      : (recipe.tags || []);

    // Check if explicitly tagged as vegan
    if (tags.includes('vegan')) {
      return true;
    }

    // Must first be vegetarian
    if (!this.validateVegetarian(recipe)) {
      return false;
    }

    // Check for dairy and eggs
    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const animalProducts = ['milk', 'cream', 'yogurt', 'ghee', 'butter', 'cheese', 'paneer', 'egg', 'honey'];

    return !ingredients.some((ing: any) =>
      animalProducts.some(product =>
        ing.name.toLowerCase().includes(product)
      )
    );
  }

  /**
   * Validator: Dosha balance (Ayurvedic)
   */
  private validateDoshaBalance(
    recipe: Recipe,
    user: UserProfile,
    rule: ConstraintRule
  ): boolean {
    if (!user.dosha) {
      return true; // No dosha preference
    }

    const ayurvedicInfo = typeof recipe.ayurvedic_info === 'string'
      ? JSON.parse(recipe.ayurvedic_info)
      : recipe.ayurvedic_info;
    const recipeAttributes = ayurvedicInfo.attributes || [];

    const favorableAttributes = typeof rule.favorable_attributes === 'string'
      ? JSON.parse(rule.favorable_attributes || '[]')
      : (rule.favorable_attributes || []);
    const unfavorableAttributes = typeof rule.unfavorable_attributes === 'string'
      ? JSON.parse(rule.unfavorable_attributes || '[]')
      : (rule.unfavorable_attributes || []);

    // Count favorable matches
    const favorableCount = recipeAttributes.filter((attr: string) =>
      favorableAttributes.includes(attr)
    ).length;

    // Count unfavorable matches
    const unfavorableCount = recipeAttributes.filter((attr: string) =>
      unfavorableAttributes.includes(attr)
    ).length;

    // Recipe is acceptable if it has more favorable than unfavorable attributes
    // or if it has at least some favorable attributes
    return favorableCount >= unfavorableCount || favorableCount > 0;
  }

  /**
   * Validator: Indian spices
   */
  private validateIndianSpices(recipe: Recipe): boolean {
    // Only applies to Indian cuisine - check using string values
    const cuisineType = String(recipe.cuisine_type).toLowerCase();
    if (!cuisineType.includes('indian')) {
      return true;
    }

    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const requiredSpices = ['cumin', 'turmeric', 'coriander'];

    // Recipe should have at least one traditional spice
    return ingredients.some((ing: any) =>
      requiredSpices.some(spice =>
        ing.name.toLowerCase().includes(spice)
      )
    );
  }

  /**
   * Validator: Mediterranean ingredients
   */
  private validateMediterraneanIngredients(recipe: Recipe): boolean {
    const cuisineType = String(recipe.cuisine_type).toLowerCase();
    if (!cuisineType.includes('mediterranean')) {
      return true;
    }

    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;

    // Should use olive oil
    return ingredients.some((ing: any) =>
      ing.name.toLowerCase().includes('olive oil')
    );
  }

  /**
   * Validator: Mexican ingredients
   */
  private validateMexicanIngredients(recipe: Recipe): boolean {
    const cuisineType = String(recipe.cuisine_type).toLowerCase();
    if (!cuisineType.includes('mexican')) {
      return true;
    }

    const ingredients = typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients;
    const traditionalIngredients = ['corn', 'chili', 'lime', 'cilantro', 'cumin'];

    // Should have at least one traditional ingredient
    return ingredients.some((ing: any) =>
      traditionalIngredients.some(traditional =>
        ing.name.toLowerCase().includes(traditional)
      )
    );
  }

  /**
   * Get all loaded rules
   */
  getRules(): ConstraintRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Reload rules from database
   */
  async reload(): Promise<void> {
    this.rules.clear();
    await this.loadRules();
  }
}

// Export singleton instance
export const constraintEngine = new ConstraintEngine();
