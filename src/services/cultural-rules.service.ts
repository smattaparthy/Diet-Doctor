import { CulturalRulesRepository, RecipeRepository } from '../repositories';
import { CulturalRule, Recipe, User } from '../types';

export class CulturalRulesService {
  private rulesRepo: CulturalRulesRepository;
  private recipeRepo: RecipeRepository;

  constructor() {
    this.rulesRepo = new CulturalRulesRepository();
    this.recipeRepo = new RecipeRepository();
  }

  async validateRecipeForUser(recipeId: number, user: User): Promise<{
    isCompliant: boolean;
    violations: Array<{
      ruleId: number;
      ruleName: string;
      severity: 'strict' | 'moderate' | 'mild';
      violation: string;
      ingredient?: string;
    }>;
    complianceScore: number;
  }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const relevantRules = await this.rulesRepo.getRulesForDietaryProfile(
      user.cuisine_preferences,
      user.dietary_restrictions.map((dr: any) => dr.restriction),
      user.dosha || undefined
    );

    const violations = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const rule of relevantRules) {
      const ruleScore = this.getSeverityScore(rule.severity);
      maxScore += Math.max(1, ruleScore);

      const recipeIngredients = recipe.ingredients.map(ing => ing.name.toLowerCase());

      // Check forbidden ingredients
      for (const forbiddenIngredient of rule.forbidden_ingredients) {
        const lowerForbidden = forbiddenIngredient.toLowerCase();
        const matchingIngredients = recipeIngredients.filter(ing =>
          ing.includes(lowerForbidden) || lowerForbidden.includes(ing)
        );

        for (const matchingIngredient of matchingIngredients) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            violation: `Contains forbidden ingredient: ${matchingIngredient}`,
            ingredient: matchingIngredient
          });

          totalScore += ruleScore;
        }
      }

      // Check conditional restrictions
      for (const conditional of rule.conditional_restrictions) {
        if (this.evaluateCondition(conditional.condition, recipe, user)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            violation: conditional.restriction
          });
          totalScore += ruleScore;
        }
      }
    }

    const isCompliant = !violations.some(v => v.severity === 'strict');
    const complianceScore = maxScore > 0 ? Math.max(0, (1 - totalScore / maxScore) * 100) : 100;

    return {
      isCompliant,
      violations,
      complianceScore
    };
  }

  async validateIngredientForUser(ingredient: string, user: User): Promise<{
    isAllowed: boolean;
    violations: Array<{
      ruleId: number;
      ruleName: string;
      violation: string;
      severity: 'strict' | 'moderate' | 'mild';
    }>;
  }> {
    const relevantRules = await this.rulesRepo.getRulesForDietaryProfile(
      user.cuisine_preferences,
      user.dietary_restrictions.map((dr: any) => dr.restriction),
      user.dosha || undefined
    );

    const violations = [];
    const lowerIngredient = ingredient.toLowerCase();

    for (const rule of relevantRules) {
      // Check if ingredient is forbidden
      const isForbidden = rule.forbidden_ingredients.some(forbidden => {
        const lowerForbidden = forbidden.toLowerCase();
        return lowerIngredient.includes(lowerForbidden) || lowerForbidden.includes(lowerIngredient);
      });

      if (isForbidden) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          violation: `Forbidden ingredient for your dietary restrictions`,
          severity: rule.severity
        });
      }
    }

    return {
      isAllowed: !violations.some(v => v.severity === 'strict'),
      violations
    };
  }

  async suggestSubstitutions(ingredient: string, user: User): Promise<Array<{
    ingredient: string;
    reason: string;
    culturalContext: string;
  }>> {
    const validation = await this.validateIngredientForUser(ingredient, user);
    if (validation.isAllowed) {
      return [];
    }

    // Common substitutions based on cultural dietary restrictions
    const substitutions: { [key: string]: Array<{ ingredient: string; reason: string; culturalContext: string }> } = {
      'beef': [
        { ingredient: 'paneer', reason: 'Dairy-based protein alternative', culturalContext: 'Widely used in Indian cuisine' },
        { ingredient: 'tofu', reason: 'Plant-based protein', culturalContext: 'Modern vegetarian alternative' },
        { ingredient: 'lentils', reason: 'Legume-based protein', culturalContext: 'Traditional Indian protein source' }
      ],
      'pork': [
        { ingredient: 'chicken', reason: 'Poultry alternative', culturalContext: 'Acceptable protein source' },
        { ingredient: 'paneer', reason: 'Dairy-based protein', culturalContext: 'Vegetarian option' }
      ],
      'eggs': [
        { ingredient: 'flax eggs', reason: 'Plant-based egg substitute', culturalContext: 'Vegan baking alternative' },
        { ingredient: 'chickpea flour', reason: 'Binding agent alternative', culturalContext: 'Traditional Indian cooking' }
      ]
    };

    const lowerIngredient = ingredient.toLowerCase();
    for (const [key, subs] of Object.entries(substitutions)) {
      if (lowerIngredient.includes(key)) {
        return subs;
      }
    }

    // Generic suggestions based on ingredient type
    if (ingredient.toLowerCase().includes('meat')) {
      return [
        { ingredient: 'mushrooms', reason: 'Meaty texture', culturalContext: 'Vegetarian umami flavor' },
        { ingredient: 'jackfruit', reason: 'Meat texture', culturalContext: 'Authentic alternative in many dishes' },
        { ingredient: 'soy chunks', reason: 'High protein', culturalContext: 'Popular meat substitute' }
      ];
    }

    return [];
  }

  async getAyurvedicRecommendations(user: User): Promise<{
    dosha: string;
    recommendations: {
      foods_to_favorite: string[];
      foods_to_limit: string[];
      seasonal_recommendations: string[];
      lifestyle_tips: string[];
    };
  }> {
    const userDosha = user.dosha || 'vata'; // Default to vata if not specified

    const doshaRecommendations = {
      vata: {
        foods_to_favorite: ['warm soups', 'root vegetables', 'ghee', 'basmati rice', 'mung beans'],
        foods_to_limit: ['raw foods', 'cold drinks', 'caffeine', 'sugar', 'excess beans'],
        seasonal_recommendations: ['heavier foods in winter', 'lighter foods in summer', 'warming spices'],
        lifestyle_tips: ['regular meal times', 'warm foods', 'routine', 'self-care practices']
      },
      pitta: {
        foods_to_favorite: ['cool cucumber', 'coconut', 'sweet fruits', 'basmati rice', 'ghee'],
        foods_to_limit: ['spicy foods', 'fermented foods', 'sour foods', 'excess salt', 'alcohol'],
        seasonal_recommendations: ['light foods in summer', 'cooler preparations', 'sweet tastes'],
        lifestyle_tips: ['avoid overheating', 'moderate exercise', 'stress management', 'adequate rest']
      },
      kapha: {
        foods_to_favorite: ['light grains', 'spices', 'honey', 'vegetables', 'legumes'],
        foods_to_limit: ['heavy foods', 'dairy', 'sweet foods', 'excess salt', 'cold drinks'],
        seasonal_recommendations: ['stimulating foods', 'dry foods', 'warm preparations'],
        lifestyle_tips: ['regular exercise', 'variety in routine', 'early mornings', 'detox practices']
      },
      tridosha: {
        foods_to_favorite: ['balanced meals', 'seasonal vegetables', 'moderate spices', 'whole grains'],
        foods_to_limit: ['extreme tastes', 'processed foods', 'excess of any one food group'],
        seasonal_recommendations: ['eat seasonally', 'listen to body needs', 'moderate everything'],
        lifestyle_tips: ['balanced approach', 'mindful eating', 'regular routines', 'stress awareness']
      }
    };

    return {
      dosha: userDosha,
      recommendations: doshaRecommendations[userDosha as keyof typeof doshaRecommendations] || doshaRecommendations.vata
    };
  }

  async getHinduDietaryGuidance(_user: User): Promise<{
    principles: Array<{
      principle: string;
      explanation: string;
      practical_tips: string[];
    }>;
    forbidden_items: string[];
    recommended_foods: string[];
  }> {
    return {
      principles: [
        {
          principle: 'Ahimsa (Non-violence)',
          explanation: 'Avoid causing harm to living beings',
          practical_tips: ['Choose vegetarian options', 'Avoid beef consumption', 'Consider egg-free options']
        },
        {
          principle: 'Purity of Food',
          explanation: 'Food affects consciousness and spiritual well-being',
          practical_tips: ['Choose sattvic foods', 'Avoid tamasic (heavy) foods', 'Prefer fresh preparation']
        },
        {
          principle: 'Offerings and Gratitude',
          explanation: 'Food is considered sacred and should be offered',
          practical_tips: ['Prepare food with positive mindset', 'Offer gratitude before eating', 'Avoid wasting food']
        }
      ],
      forbidden_items: ['beef', 'pork', 'alcohol', 'onions', 'garlic', 'mushrooms'],
      recommended_foods: ['lentils', 'rice', 'vegetables', 'dairy', 'fruits', 'nuts', 'ghee']
    };
  }

  private evaluateCondition(condition: string, recipe: Recipe, user: User): boolean {
    // Simple condition evaluator - in production, this would be more sophisticated
    const lowerCondition = condition.toLowerCase();

    // User-based conditions
    if (lowerCondition.includes('user.dosha') && user.dosha) {
      return lowerCondition.includes(user.dosha.toLowerCase());
    }

    // Recipe-based conditions
    if (lowerCondition.includes('recipe.difficulty')) {
      return lowerCondition.includes(recipe.difficulty.toLowerCase());
    }

    if (lowerCondition.includes('recipe.cuisine')) {
      return lowerCondition.includes(recipe.cuisine_type.toLowerCase());
    }

    return false;
  }

  private getSeverityScore(severity: 'strict' | 'moderate' | 'mild'): number {
    switch (severity) {
      case 'strict': return 3;
      case 'moderate': return 2;
      case 'mild': return 1;
      default: return 1;
    }
  }

  async createCulturalRule(rule: Omit<CulturalRule, 'id'>): Promise<number> {
    return this.rulesRepo.createRule(rule);
  }

  async getAllCulturalRules(): Promise<CulturalRule[]> {
    return this.rulesRepo.findAll();
  }

  async getCulturalRulesByType(type: 'religious' | 'dietary' | 'cultural' | 'ayurvedic'): Promise<CulturalRule[]> {
    return this.rulesRepo.findByType(type);
  }

  async updateCulturalRule(ruleId: number, rule: Partial<CulturalRule>): Promise<boolean> {
    return this.rulesRepo.updateRule(ruleId, rule);
  }

  async deleteCulturalRule(ruleId: number): Promise<boolean> {
    return this.rulesRepo.delete(ruleId);
  }
}