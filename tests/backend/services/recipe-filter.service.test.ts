import { RecipeFilterService } from '../../../src/services/recipe-filter.service';
import { Recipe, UserHealthProfile, CuisineType } from '../../../src/types';

describe('RecipeFilterService', () => {
  let filterService: RecipeFilterService;
  let mockUserProfile: UserHealthProfile;
  let mockRecipes: Recipe[];

  beforeEach(() => {
    filterService = new RecipeFilterService();

    // Mock user profile with various constraints
    mockUserProfile = {
      user_id: 1,
      prakriti_vata: 40,
      prakriti_pitta: 30,
      prakriti_kapha: 30,
      vikriti_vata: 50,
      vikriti_pitta: 30,
      vikriti_kapha: 20,
      primary_dosha: 'vata',
      allergies: ['dairy', 'nuts'],
      dietary_restrictions: ['vegetarian'],
      health_concerns: ['digestion'],
      cuisine_preferences: ['north_indian'],
      spice_level: 'medium',
      activity_level: 'moderate',
      stress_level: 'moderate',
      sleep_quality: 'fair'
    };

    // Mock recipes for testing
    mockRecipes = [
      createMockRecipe(1, 'Chicken Curry', ['chicken', 'tomato', 'onion']),
      createMockRecipe(2, 'Paneer Tikka', ['paneer', 'yogurt', 'spices']),
      createMockRecipe(3, 'Dal Tadka', ['lentils', 'tomato', 'spices']),
      createMockRecipe(4, 'Almond Milk Smoothie', ['almond', 'banana', 'honey']),
      createMockRecipe(5, 'Vegetable Stir Fry', ['broccoli', 'carrot', 'soy sauce'])
    ];
  });

  describe('Hard Constraint Filtering', () => {
    it('should filter out recipes with user allergens', () => {
      const { validRecipes, filteredCount } = filterService.filterRecipes(
        mockRecipes,
        mockUserProfile
      );

      // Should filter out Paneer Tikka (dairy) and Almond Milk Smoothie (nuts)
      expect(validRecipes).toHaveLength(3);
      expect(filteredCount).toBe(2);

      const recipeNames = validRecipes.map(r => r.title);
      expect(recipeNames).not.toContain('Paneer Tikka');
      expect(recipeNames).not.toContain('Almond Milk Smoothie');
    });

    it('should filter out non-vegetarian recipes when vegetarian restriction is set', () => {
      const { validRecipes, filteredCount } = filterService.filterRecipes(
        mockRecipes,
        mockUserProfile
      );

      // Should filter out Chicken Curry
      const recipeNames = validRecipes.map(r => r.title);
      expect(recipeNames).not.toContain('Chicken Curry');
    });

    it('should pass recipes with no allergens or restriction violations', () => {
      const safeRecipe = createMockRecipe(10, 'Simple Rice', ['rice', 'water', 'salt']);

      const { validRecipes } = filterService.filterRecipes(
        [safeRecipe],
        mockUserProfile
      );

      expect(validRecipes).toHaveLength(1);
      expect(validRecipes[0].title).toBe('Simple Rice');
    });
  });

  describe('Allergen Detection', () => {
    it('should detect direct allergen matches', () => {
      const result = filterService.passesConstraints(
        createMockRecipe(1, 'Milk Rice', ['milk', 'rice']),
        mockUserProfile
      );

      expect(result).toBe(false);
    });

    it('should detect allergen synonyms', () => {
      const cheeseRecipe = createMockRecipe(2, 'Cheese Pizza', ['cheese', 'flour']);
      const result = filterService.passesConstraints(cheeseRecipe, mockUserProfile);

      // Cheese is a dairy synonym
      expect(result).toBe(false);
    });

    it('should handle multiple allergens', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        allergies: ['dairy', 'eggs', 'soy']
      };

      const tofuRecipe = createMockRecipe(3, 'Tofu Scramble', ['tofu', 'spices']);
      const result = filterService.passesConstraints(tofuRecipe, profile);

      // Tofu contains soy
      expect(result).toBe(false);
    });
  });

  describe('Dietary Restrictions', () => {
    it('should enforce vegetarian restriction', () => {
      const meatRecipes = [
        createMockRecipe(1, 'Fish Curry', ['fish', 'curry leaves']),
        createMockRecipe(2, 'Lamb Biryani', ['lamb', 'rice'])
      ];

      const { validRecipes } = filterService.filterRecipes(meatRecipes, mockUserProfile);
      expect(validRecipes).toHaveLength(0);
    });

    it('should enforce vegan restriction', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        dietary_restrictions: ['vegan']
      };

      const recipes = [
        createMockRecipe(1, 'Egg Curry', ['egg', 'tomato']),
        createMockRecipe(2, 'Ghee Rice', ['rice', 'ghee']),
        createMockRecipe(3, 'Chickpea Salad', ['chickpea', 'tomato', 'lemon'])
      ];

      const { validRecipes } = filterService.filterRecipes(recipes, profile);

      // Only chickpea salad should pass
      expect(validRecipes).toHaveLength(1);
      expect(validRecipes[0].title).toBe('Chickpea Salad');
    });

    it('should enforce gluten-free restriction', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        dietary_restrictions: ['gluten-free']
      };

      const recipes = [
        createMockRecipe(1, 'Wheat Roti', ['wheat flour', 'water']),
        createMockRecipe(2, 'Rice Bowl', ['rice', 'vegetables'])
      ];

      const { validRecipes } = filterService.filterRecipes(recipes, profile);

      expect(validRecipes).toHaveLength(1);
      expect(validRecipes[0].title).toBe('Rice Bowl');
    });
  });

  describe('Cultural Restrictions', () => {
    it('should enforce no-beef restriction (Hindu)', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        dietary_restrictions: ['no-beef', 'hindu']
      };

      const beefRecipe = createMockRecipe(1, 'Beef Steak', ['beef', 'pepper']);
      const result = filterService.passesConstraints(beefRecipe, profile);

      expect(result).toBe(false);
    });

    it('should enforce no-pork restriction (Halal)', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        dietary_restrictions: ['halal']
      };

      const porkRecipe = createMockRecipe(1, 'Pork Chops', ['pork', 'spices']);
      const result = filterService.passesConstraints(porkRecipe, profile);

      expect(result).toBe(false);
    });
  });

  describe('Filter Statistics', () => {
    it('should provide filtering statistics', () => {
      const { validRecipes, filteredCount, filterReasons } = filterService.filterRecipes(
        mockRecipes,
        mockUserProfile
      );

      const stats = filterService.getFilteringStats(
        mockRecipes.length,
        validRecipes.length,
        filterReasons
      );

      expect(stats.totalRecipes).toBe(mockRecipes.length);
      expect(stats.validRecipes).toBe(validRecipes.length);
      expect(stats.filteredRecipes).toBe(filteredCount);
      expect(stats.filterPercentage).toBeGreaterThan(0);
    });

    it('should track common filter reasons', () => {
      const { validRecipes, filterReasons } = filterService.filterRecipes(
        mockRecipes,
        mockUserProfile
      );

      const stats = filterService.getFilteringStats(
        mockRecipes.length,
        validRecipes.length,
        filterReasons
      );

      expect(stats.commonReasons.size).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty allergen list', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        allergies: []
      };

      const { validRecipes } = filterService.filterRecipes(mockRecipes, profile);
      // Should only filter based on vegetarian restriction
      expect(validRecipes.length).toBeGreaterThan(0);
    });

    it('should handle empty dietary restrictions', () => {
      const profile: UserHealthProfile = {
        ...mockUserProfile,
        dietary_restrictions: [],
        allergies: []
      };

      const { validRecipes } = filterService.filterRecipes(mockRecipes, profile);
      expect(validRecipes).toHaveLength(mockRecipes.length);
    });

    it('should handle recipes with no ingredients', () => {
      const emptyRecipe = createMockRecipe(999, 'Empty Recipe', []);

      const result = filterService.passesConstraints(emptyRecipe, mockUserProfile);
      expect(result).toBe(true); // No violations if no ingredients
    });
  });
});

// Helper function to create mock recipes
function createMockRecipe(id: number, title: string, ingredientNames: string[]): Recipe {
  return {
    id,
    cuisine_type: CuisineType.NORTH_INDIAN,
    title,
    description: `Test recipe: ${title}`,
    ingredients: ingredientNames.map(name => ({
      name,
      quantity: '1',
      unit: 'cup',
      optional: false
    })),
    instructions: ['Step 1', 'Step 2'],
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    servings: 4,
    difficulty: 'easy',
    cultural_notes: '',
    ayurvedic_info: {
      dominant_dosha: ['vata'],
      taste_profile: ['sweet'],
      energy: 'neutral',
      effect_on_doshas: {
        vata: 'neutral',
        pitta: 'neutral',
        kapha: 'neutral'
      },
      seasonal_recommendation: ['summer'],
      contraindications: []
    },
    nutritional_info: {
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      fiber_g: 5,
      sugar_g: 5,
      sodium_mg: 300
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
