import { DoshaScoringService } from '../../../src/services/dosha-scoring.service';
import { Recipe, UserHealthProfile, CuisineType } from '../../../src/types';

describe('DoshaScoringService', () => {
  let doshaScoring: DoshaScoringService;
  let baseRecipe: Recipe;

  beforeEach(() => {
    doshaScoring = new DoshaScoringService();

    // Base recipe template
    baseRecipe = {
      id: 1,
      cuisine_type: CuisineType.NORTH_INDIAN,
      title: 'Test Recipe',
      description: 'Test',
      ingredients: [],
      instructions: [],
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
  });

  describe('Dosha Score Calculation', () => {
    it('should penalize recipes that increase elevated dosha', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 60, // Elevated
        vikriti_pitta: 20,
        vikriti_kapha: 20
      });

      const recipeRow = {
        ...baseRecipe,
        dosha_vata: 'increase' // Aggravates elevated vata
      } as any;

      const { score, explanation } = doshaScoring.calculateDoshaScore(recipeRow, profile);

      // Base 100 - 30 penalty = 70
      expect(score).toBe(70);
      expect(explanation).toContain('Penalized');
      expect(explanation).toContain('vata');
    });

    it('should boost recipes that decrease elevated dosha', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 70, // Elevated
        vikriti_pitta: 15,
        vikriti_kapha: 15
      });

      const recipeRow = {
        ...baseRecipe,
        dosha_vata: 'decrease' // Balances elevated vata
      } as any;

      const { score, explanation } = doshaScoring.calculateDoshaScore(recipeRow, profile);

      // Base 100 + 20 boost = 120
      expect(score).toBe(120);
      expect(explanation).toContain('Boosted');
      expect(explanation).toContain('decrease');
    });

    it('should handle neutral dosha effects', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 60,
        vikriti_pitta: 20,
        vikriti_kapha: 20
      });

      const recipeRow = {
        ...baseRecipe,
        dosha_vata: 'neutral',
        dosha_pitta: 'neutral',
        dosha_kapha: 'neutral'
      } as any;

      const { score } = doshaScoring.calculateDoshaScore(recipeRow, profile);

      // Should stay at base 100
      expect(score).toBe(100);
    });

    it('should handle multiple dosha elevations', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 55,  // Slightly elevated
        vikriti_pitta: 60, // Elevated
        vikriti_kapha: 15
      });

      const recipeRow = {
        ...baseRecipe,
        dosha_vata: 'decrease',  // +20
        dosha_pitta: 'decrease', // +20
        dosha_kapha: 'neutral'   // 0
      } as any;

      const { score } = doshaScoring.calculateDoshaScore(recipeRow, profile);

      // Base 100 + 20 + 20 = 140
      expect(score).toBe(140);
    });

    it('should clamp score to 0-100 range', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 70,
        vikriti_pitta: 65,
        vikriti_kapha: 60
      });

      const worseningRecipe = {
        ...baseRecipe,
        dosha_vata: 'increase',
        dosha_pitta: 'increase',
        dosha_kapha: 'increase'
      } as any;

      const { score } = doshaScoring.calculateDoshaScore(worseningRecipe, profile);

      // Should not go below 0
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Elevated Dosha Detection', () => {
    it('should identify elevated doshas (>50%)', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 65,
        vikriti_pitta: 45,
        vikriti_kapha: 20
      });

      const elevated = doshaScoring.getElevatedDoshas(profile);

      expect(elevated).toHaveLength(1);
      expect(elevated).toContain('vata');
    });

    it('should identify multiple elevated doshas', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 55,
        vikriti_pitta: 60,
        vikriti_kapha: 15
      });

      const elevated = doshaScoring.getElevatedDoshas(profile);

      expect(elevated).toHaveLength(2);
      expect(elevated).toContain('vata');
      expect(elevated).toContain('pitta');
    });

    it('should return empty array if no doshas elevated', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 40,
        vikriti_pitta: 35,
        vikriti_kapha: 25
      });

      const elevated = doshaScoring.getElevatedDoshas(profile);

      expect(elevated).toHaveLength(0);
    });
  });

  describe('Balancing Recipe Detection', () => {
    it('should identify recipe as balancing if it decreases elevated dosha', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 70,
        vikriti_pitta: 15,
        vikriti_kapha: 15
      });

      const balancingRecipe = {
        ...baseRecipe,
        dosha_vata: 'decrease'
      } as any;

      const isBalancing = doshaScoring.isBalancingRecipe(balancingRecipe, profile);

      expect(isBalancing).toBe(true);
    });

    it('should not consider recipe balancing if it increases elevated dosha', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_pitta: 65,
        vikriti_vata: 20,
        vikriti_kapha: 15
      });

      const aggravatingRecipe = {
        ...baseRecipe,
        dosha_pitta: 'increase'
      } as any;

      const isBalancing = doshaScoring.isBalancingRecipe(aggravatingRecipe, profile);

      expect(isBalancing).toBe(false);
    });

    it('should consider neutral recipes as acceptable', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_kapha: 60,
        vikriti_vata: 20,
        vikriti_pitta: 20
      });

      const neutralRecipe = {
        ...baseRecipe,
        dosha_kapha: 'neutral'
      } as any;

      const isBalancing = doshaScoring.isBalancingRecipe(neutralRecipe, profile);

      expect(isBalancing).toBe(true);
    });
  });

  describe('Balancing Recommendations', () => {
    it('should provide vata-balancing recommendations', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 70,
        vikriti_pitta: 15,
        vikriti_kapha: 15
      });

      const { primaryImbalance, recommendations } = doshaScoring.getBalancingRecommendations(profile);

      expect(primaryImbalance).toBe('vata');
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.toLowerCase().includes('warm'))).toBe(true);
    });

    it('should provide pitta-balancing recommendations', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_pitta: 65,
        vikriti_vata: 20,
        vikriti_kapha: 15
      });

      const { primaryImbalance, recommendations } = doshaScoring.getBalancingRecommendations(profile);

      expect(primaryImbalance).toBe('pitta');
      expect(recommendations.some(r => r.toLowerCase().includes('cooling'))).toBe(true);
    });

    it('should provide kapha-balancing recommendations', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_kapha: 60,
        vikriti_vata: 20,
        vikriti_pitta: 20
      });

      const { primaryImbalance, recommendations } = doshaScoring.getBalancingRecommendations(profile);

      expect(primaryImbalance).toBe('kapha');
      expect(recommendations.some(r => r.toLowerCase().includes('light'))).toBe(true);
    });

    it('should indicate balance when no dosha is elevated', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 35,
        vikriti_pitta: 33,
        vikriti_kapha: 32
      });

      const { primaryImbalance } = doshaScoring.getBalancingRecommendations(profile);

      expect(primaryImbalance).toBeNull();
    });
  });

  describe('Seasonal Guidance', () => {
    it('should provide summer (pitta) season guidance', () => {
      const guidance = doshaScoring.getSeasonalDoshaGuidance('summer');

      expect(guidance.dominantDosha).toBe('pitta');
      expect(guidance.balancingFoods.some(f => f.toLowerCase().includes('cooling'))).toBe(true);
    });

    it('should provide winter (kapha) season guidance', () => {
      const guidance = doshaScoring.getSeasonalDoshaGuidance('winter');

      expect(guidance.dominantDosha).toBe('kapha');
      expect(guidance.balancingFoods.some(f => f.toLowerCase().includes('warming'))).toBe(true);
    });

    it('should provide autumn (vata) season guidance', () => {
      const guidance = doshaScoring.getSeasonalDoshaGuidance('autumn');

      expect(guidance.dominantDosha).toBe('vata');
      expect(guidance.balancingFoods.length).toBeGreaterThan(0);
    });
  });

  describe('Detailed Compatibility Analysis', () => {
    it('should provide comprehensive dosha compatibility analysis', () => {
      const profile: UserHealthProfile = createProfile({
        vikriti_vata: 65,
        vikriti_pitta: 20,
        vikriti_kapha: 15
      });

      const recipe = {
        ...baseRecipe,
        dosha_vata: 'decrease',
        dosha_pitta: 'neutral',
        dosha_kapha: 'neutral'
      } as any;

      const analysis = doshaScoring.analyzeDoshaCompatibility(recipe, profile);

      expect(analysis.score).toBeGreaterThan(100); // Boosted
      expect(analysis.isBalancing).toBe(true);
      expect(analysis.elevatedDoshas).toContain('vata');
      expect(analysis.recipeEffects.vata).toBe('decrease');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to create user profile with custom vikriti scores
function createProfile(vikriti: { vikriti_vata: number; vikriti_pitta: number; vikriti_kapha: number }): UserHealthProfile {
  return {
    user_id: 1,
    prakriti_vata: 33,
    prakriti_pitta: 33,
    prakriti_kapha: 34,
    ...vikriti,
    primary_dosha: 'vata',
    allergies: [],
    dietary_restrictions: [],
    health_concerns: [],
    cuisine_preferences: [],
    spice_level: 'medium',
    activity_level: 'moderate',
    stress_level: 'moderate',
    sleep_quality: 'fair'
  };
}
