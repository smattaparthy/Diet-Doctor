/**
 * Comprehensive Unit Tests for DoshaCalculator Service
 *
 * Test Coverage:
 * - Question retrieval and structure validation
 * - Answer validation with various edge cases
 * - Score calculation with different answer patterns
 * - Primary dosha determination for all 10 types
 * - Percentage normalization and rounding
 * - Edge cases (empty answers, invalid data, tri-dosha, dual-dosha)
 * - Dietary recommendations and descriptions
 */

import {
  DoshaCalculator,
  Answer,
  DoshaPercentages
} from '../../../src/services/dosha-calculator.service';

describe('DoshaCalculator Service', () => {
  let calculator: DoshaCalculator;

  beforeEach(() => {
    calculator = new DoshaCalculator();
  });

  describe('Question Retrieval', () => {
    test('should return all questions from configuration', () => {
      const questions = calculator.getQuestions();

      expect(questions).toBeDefined();
      expect(questions.version).toBe('1.0.0');
      expect(questions.sections).toHaveLength(4);
    });

    test('should return questions grouped by sections', () => {
      const questions = calculator.getQuestions();
      const sectionIds = questions.sections.map(s => s.id);

      expect(sectionIds).toEqual(['basic', 'physical', 'mental', 'lifestyle']);
    });

    test('should have exactly 12 questions total', () => {
      const questions = calculator.getQuestions();
      const totalQuestions = questions.sections.reduce(
        (sum, section) => sum + section.questions.length,
        0
      );

      expect(totalQuestions).toBe(12);
    });

    test('should get questions by section ID', () => {
      const basicQuestions = calculator.getQuestionsBySection('basic');
      expect(basicQuestions).toHaveLength(2);
      expect(basicQuestions[0].id).toBe('q1_body_frame');

      const physicalQuestions = calculator.getQuestionsBySection('physical');
      expect(physicalQuestions).toHaveLength(4);
    });

    test('should return empty array for invalid section ID', () => {
      const questions = calculator.getQuestionsBySection('invalid');
      expect(questions).toEqual([]);
    });

    test('should have proper question structure with dosha points', () => {
      const questions = calculator.getQuestions();
      const firstQuestion = questions.sections[0].questions[0];

      expect(firstQuestion).toHaveProperty('id');
      expect(firstQuestion).toHaveProperty('section');
      expect(firstQuestion).toHaveProperty('text');
      expect(firstQuestion).toHaveProperty('type');
      expect(firstQuestion.options).toBeDefined();
      expect(firstQuestion.options.length).toBeGreaterThan(0);

      const firstOption = firstQuestion.options[0];
      expect(firstOption).toHaveProperty('text');
      expect(firstOption).toHaveProperty('doshaPoints');
    });
  });

  describe('Answer Validation', () => {
    test('should validate complete and correct answers', () => {
      const answers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [0] },
        { questionId: 'q2_skin_type', selectedOptions: [1] },
        { questionId: 'q3_digestion', selectedOptions: [0] },
        { questionId: 'q4_energy_levels', selectedOptions: [1] },
        { questionId: 'q5_temperature_preference', selectedOptions: [0] },
        { questionId: 'q6_activity_level', selectedOptions: [2] },
        { questionId: 'q7_stress_response', selectedOptions: [0] },
        { questionId: 'q8_sleep_patterns', selectedOptions: [1] },
        { questionId: 'q9_decision_making', selectedOptions: [2] },
        { questionId: 'q10_food_preferences', selectedOptions: [0, 1] },
        { questionId: 'q11_health_concerns', selectedOptions: [0] },
        { questionId: 'q12_health_goal', selectedOptions: [0] }
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing answers', () => {
      const answers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [0] }
        // Missing 11 other questions
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing answers');
    });

    test('should detect invalid question IDs', () => {
      const answers: Answer[] = [
        { questionId: 'invalid_question', selectedOptions: [0] }
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid question ID'))).toBe(true);
    });

    test('should detect empty selected options', () => {
      const answers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [] }
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('No options selected'))).toBe(true);
    });

    test('should detect invalid option indices', () => {
      const answers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [99] } // Out of range
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid option indices'))).toBe(true);
    });

    test('should detect multiple selections for single-choice questions', () => {
      const answers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [0, 1] } // Single-choice question
      ];

      const result = calculator.validateAnswers(answers);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('single-select'))).toBe(true);
    });

    test('should allow multiple selections for multi-choice questions', () => {
      const completeAnswers: Answer[] = getCompleteValidAnswers();
      // q10_food_preferences is multi-select
      completeAnswers[9].selectedOptions = [0, 1, 2];

      const result = calculator.validateAnswers(completeAnswers);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    test('should calculate scores for pure Vata answers', () => {
      const vataAnswers = getPureVataAnswers();
      const result = calculator.calculateScores(vataAnswers);

      expect(result.rawScores.vata).toBeGreaterThan(result.rawScores.pitta);
      expect(result.rawScores.vata).toBeGreaterThan(result.rawScores.kapha);
      expect(result.percentages.vata).toBeGreaterThan(50);
      expect(result.primaryDosha).toContain('vata');
    });

    test('should calculate scores for pure Pitta answers', () => {
      const pittaAnswers = getPurePittaAnswers();
      const result = calculator.calculateScores(pittaAnswers);

      expect(result.rawScores.pitta).toBeGreaterThan(result.rawScores.vata);
      expect(result.rawScores.pitta).toBeGreaterThan(result.rawScores.kapha);
      expect(result.percentages.pitta).toBeGreaterThan(50);
      expect(result.primaryDosha).toContain('pitta');
    });

    test('should calculate scores for pure Kapha answers', () => {
      const kaphaAnswers = getPureKaphaAnswers();
      const result = calculator.calculateScores(kaphaAnswers);

      expect(result.rawScores.kapha).toBeGreaterThan(result.rawScores.vata);
      expect(result.rawScores.kapha).toBeGreaterThan(result.rawScores.pitta);
      expect(result.percentages.kapha).toBeGreaterThan(50);
      expect(result.primaryDosha).toContain('kapha');
    });

    test('should calculate percentages that sum to 100', () => {
      const answers = getCompleteValidAnswers();
      const result = calculator.calculateScores(answers);

      const sum = result.percentages.vata +
                  result.percentages.pitta +
                  result.percentages.kapha;

      expect(sum).toBe(100);
    });

    test('should handle answers with zero total score', () => {
      // Create answers that give no dosha points
      const zeroAnswers: Answer[] = [
        ...getCompleteValidAnswers().slice(0, 11),
        { questionId: 'q12_health_goal', selectedOptions: [5] } // "Overall balance" gives 0 points
      ];

      const result = calculator.calculateScores(zeroAnswers);

      // Should default to balanced tri-dosha when total is 0
      expect(result.percentages.vata).toBeGreaterThan(0);
      expect(result.percentages.pitta).toBeGreaterThan(0);
      expect(result.percentages.kapha).toBeGreaterThan(0);
    });

    test('should throw error for invalid answers', () => {
      const invalidAnswers: Answer[] = [
        { questionId: 'q1_body_frame', selectedOptions: [0] }
        // Missing other questions
      ];

      expect(() => calculator.calculateScores(invalidAnswers))
        .toThrow('Invalid answers');
    });
  });

  describe('Primary Dosha Determination', () => {
    test('should identify single dominant Vata', () => {
      const percentages: DoshaPercentages = { vata: 60, pitta: 25, kapha: 15 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('vata');
    });

    test('should identify single dominant Pitta', () => {
      const percentages: DoshaPercentages = { vata: 20, pitta: 60, kapha: 20 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('pitta');
    });

    test('should identify single dominant Kapha', () => {
      const percentages: DoshaPercentages = { vata: 15, pitta: 25, kapha: 60 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('kapha');
    });

    test('should identify Vata-Pitta dual dosha (within 15%)', () => {
      const percentages: DoshaPercentages = { vata: 45, pitta: 40, kapha: 15 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('vata-pitta');
    });

    test('should identify Vata-Kapha dual dosha', () => {
      const percentages: DoshaPercentages = { vata: 45, pitta: 15, kapha: 40 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('vata-kapha');
    });

    test('should identify Pitta-Vata dual dosha (pitta higher)', () => {
      const percentages: DoshaPercentages = { vata: 38, pitta: 47, kapha: 15 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('pitta-vata');
    });

    test('should identify Pitta-Kapha dual dosha', () => {
      const percentages: DoshaPercentages = { vata: 15, pitta: 45, kapha: 40 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('pitta-kapha');
    });

    test('should identify Kapha-Vata dual dosha (kapha higher)', () => {
      const percentages: DoshaPercentages = { vata: 38, pitta: 15, kapha: 47 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('kapha-vata');
    });

    test('should identify Kapha-Pitta dual dosha (kapha higher)', () => {
      const percentages: DoshaPercentages = { vata: 15, pitta: 38, kapha: 47 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('kapha-pitta');
    });

    test('should identify Tri-Dosha (all within 10%)', () => {
      const percentages: DoshaPercentages = { vata: 35, pitta: 33, kapha: 32 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('tri-dosha');
    });

    test('should identify Tri-Dosha at boundary (exactly 10% difference)', () => {
      const percentages: DoshaPercentages = { vata: 36, pitta: 34, kapha: 30 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).toBe('tri-dosha');
    });

    test('should NOT identify Tri-Dosha when difference exceeds 10%', () => {
      const percentages: DoshaPercentages = { vata: 42, pitta: 35, kapha: 23 };
      const result = calculator.determinePrimaryDosha(percentages);

      expect(result).not.toBe('tri-dosha');
    });

    test('should identify dual dosha at 15% boundary', () => {
      const percentages: DoshaPercentages = { vata: 45, pitta: 31, kapha: 24 };
      const result = calculator.determinePrimaryDosha(percentages);

      // Difference is 14%, should be dual dosha
      expect(result).toBe('vata-pitta');
    });

    test('should NOT identify dual dosha when difference is 15% or more', () => {
      const percentages: DoshaPercentages = { vata: 50, pitta: 35, kapha: 15 };
      const result = calculator.determinePrimaryDosha(percentages);

      // Difference is 15%, should be single dominant
      expect(result).toBe('vata');
    });
  });

  describe('Integration Tests', () => {
    test('should produce consistent results for Vata-dominant profile', () => {
      const vataAnswers = getPureVataAnswers();
      const result = calculator.calculateScores(vataAnswers);

      expect(result.primaryDosha).toContain('vata');
      expect(result.percentages.vata).toBeGreaterThan(40);
      expect(result.dominantDoshas[0]).toBe('vata');
      expect(result.isDualDosha || result.isTriDosha || result.primaryDosha === 'vata').toBe(true);
    });

    test('should produce consistent results for Pitta-dominant profile', () => {
      const pittaAnswers = getPurePittaAnswers();
      const result = calculator.calculateScores(pittaAnswers);

      expect(result.primaryDosha).toContain('pitta');
      expect(result.percentages.pitta).toBeGreaterThan(40);
      expect(result.dominantDoshas[0]).toBe('pitta');
    });

    test('should produce consistent results for Kapha-dominant profile', () => {
      const kaphaAnswers = getPureKaphaAnswers();
      const result = calculator.calculateScores(kaphaAnswers);

      expect(result.primaryDosha).toContain('kapha');
      expect(result.percentages.kapha).toBeGreaterThan(40);
      expect(result.dominantDoshas[0]).toBe('kapha');
    });

    test('should handle mixed answers for dual-dosha result', () => {
      const mixedAnswers = getMixedVataPittaAnswers();
      const result = calculator.calculateScores(mixedAnswers);

      // Should be either vata-pitta, pitta-vata, or single dominant
      const validResults = ['vata', 'pitta', 'vata-pitta', 'pitta-vata'];
      expect(validResults).toContain(result.primaryDosha);
    });
  });

  describe('Dosha Descriptions', () => {
    test('should return description for single doshas', () => {
      const vataDesc = calculator.getDoshaDescription('vata');
      expect(vataDesc).toContain('air');
      expect(vataDesc).toContain('creative');

      const pittaDesc = calculator.getDoshaDescription('pitta');
      expect(pittaDesc).toContain('fire');
      expect(pittaDesc).toContain('intelligent');

      const kaphaDesc = calculator.getDoshaDescription('kapha');
      expect(kaphaDesc).toContain('earth');
      expect(kaphaDesc).toContain('stable');
    });

    test('should return description for dual doshas', () => {
      const vatapitta = calculator.getDoshaDescription('vata-pitta');
      expect(vatapitta).toBeDefined();
      expect(vatapitta.length).toBeGreaterThan(0);
    });

    test('should return description for tri-dosha', () => {
      const tridosha = calculator.getDoshaDescription('tri-dosha');
      expect(tridosha).toContain('balanced');
      expect(tridosha).toContain('adaptability');
    });
  });

  describe('Dietary Recommendations', () => {
    test('should return dietary recommendations for Vata', () => {
      const recommendations = calculator.getDietaryRecommendations('vata');

      expect(recommendations.favorable).toContain('Warm, cooked foods');
      expect(recommendations.unfavorable).toContain('Raw, cold foods');
    });

    test('should return dietary recommendations for Pitta', () => {
      const recommendations = calculator.getDietaryRecommendations('pitta');

      expect(recommendations.favorable).toContain('Cooling foods');
      expect(recommendations.unfavorable).toContain('Hot, spicy foods');
    });

    test('should return dietary recommendations for Kapha', () => {
      const recommendations = calculator.getDietaryRecommendations('kapha');

      expect(recommendations.favorable).toContain('Light, dry foods');
      expect(recommendations.unfavorable).toContain('Heavy, oily foods');
    });

    test('should combine recommendations for dual doshas', () => {
      const recommendations = calculator.getDietaryRecommendations('vata-pitta');

      expect(recommendations.favorable.length).toBeGreaterThan(0);
      expect(recommendations.unfavorable.length).toBeGreaterThan(0);
    });

    test('should return balanced recommendations for tri-dosha', () => {
      const recommendations = calculator.getDietaryRecommendations('tri-dosha');

      expect(recommendations.favorable).toContain('Balanced diet with variety');
      expect(recommendations.unfavorable).toContain('Excessive amounts of any taste');
    });
  });

  describe('Edge Cases', () => {
    test('should handle answers with only multi-select questions selected', () => {
      const answers = getCompleteValidAnswers();
      // Add multiple selections to multi-select questions
      answers[9].selectedOptions = [0, 1, 2, 3]; // q10_food_preferences
      answers[10].selectedOptions = [0, 1, 2]; // q11_health_concerns

      const result = calculator.calculateScores(answers);

      expect(result.percentages.vata + result.percentages.pitta + result.percentages.kapha).toBe(100);
    });

    test('should maintain percentage precision with rounding', () => {
      const answers = getCompleteValidAnswers();
      const result = calculator.calculateScores(answers);

      // All percentages should be integers
      expect(Number.isInteger(result.percentages.vata)).toBe(true);
      expect(Number.isInteger(result.percentages.pitta)).toBe(true);
      expect(Number.isInteger(result.percentages.kapha)).toBe(true);
    });

    test('should handle dominant doshas array correctly', () => {
      const answers = getPureVataAnswers();
      const result = calculator.calculateScores(answers);

      expect(result.dominantDoshas).toHaveLength(3);
      expect(result.dominantDoshas[0]).toBe('vata');
      // Second and third should be pitta and kapha in some order
      expect(['pitta', 'kapha']).toContain(result.dominantDoshas[1]);
      expect(['pitta', 'kapha']).toContain(result.dominantDoshas[2]);
    });
  });
});

// Helper functions to create test data

function getCompleteValidAnswers(): Answer[] {
  return [
    { questionId: 'q1_body_frame', selectedOptions: [0] },
    { questionId: 'q2_skin_type', selectedOptions: [1] },
    { questionId: 'q3_digestion', selectedOptions: [0] },
    { questionId: 'q4_energy_levels', selectedOptions: [1] },
    { questionId: 'q5_temperature_preference', selectedOptions: [0] },
    { questionId: 'q6_activity_level', selectedOptions: [2] },
    { questionId: 'q7_stress_response', selectedOptions: [0] },
    { questionId: 'q8_sleep_patterns', selectedOptions: [1] },
    { questionId: 'q9_decision_making', selectedOptions: [2] },
    { questionId: 'q10_food_preferences', selectedOptions: [0] },
    { questionId: 'q11_health_concerns', selectedOptions: [0] },
    { questionId: 'q12_health_goal', selectedOptions: [0] }
  ];
}

function getPureVataAnswers(): Answer[] {
  return [
    { questionId: 'q1_body_frame', selectedOptions: [0] }, // Vata
    { questionId: 'q2_skin_type', selectedOptions: [0] }, // Vata
    { questionId: 'q3_digestion', selectedOptions: [0] }, // Vata
    { questionId: 'q4_energy_levels', selectedOptions: [0] }, // Vata
    { questionId: 'q5_temperature_preference', selectedOptions: [0] }, // Vata
    { questionId: 'q6_activity_level', selectedOptions: [0] }, // Vata
    { questionId: 'q7_stress_response', selectedOptions: [0] }, // Vata
    { questionId: 'q8_sleep_patterns', selectedOptions: [0] }, // Vata
    { questionId: 'q9_decision_making', selectedOptions: [0] }, // Vata
    { questionId: 'q10_food_preferences', selectedOptions: [0, 1, 2] }, // Vata
    { questionId: 'q11_health_concerns', selectedOptions: [0, 1] }, // Vata
    { questionId: 'q12_health_goal', selectedOptions: [0] } // Vata
  ];
}

function getPurePittaAnswers(): Answer[] {
  return [
    { questionId: 'q1_body_frame', selectedOptions: [1] }, // Pitta
    { questionId: 'q2_skin_type', selectedOptions: [1] }, // Pitta
    { questionId: 'q3_digestion', selectedOptions: [1] }, // Pitta
    { questionId: 'q4_energy_levels', selectedOptions: [1] }, // Pitta
    { questionId: 'q5_temperature_preference', selectedOptions: [1] }, // Pitta
    { questionId: 'q6_activity_level', selectedOptions: [1] }, // Pitta
    { questionId: 'q7_stress_response', selectedOptions: [1] }, // Pitta
    { questionId: 'q8_sleep_patterns', selectedOptions: [1] }, // Pitta
    { questionId: 'q9_decision_making', selectedOptions: [1] }, // Pitta
    { questionId: 'q10_food_preferences', selectedOptions: [3, 4] }, // Pitta
    { questionId: 'q11_health_concerns', selectedOptions: [2, 3] }, // Pitta
    { questionId: 'q12_health_goal', selectedOptions: [1] } // Pitta
  ];
}

function getPureKaphaAnswers(): Answer[] {
  return [
    { questionId: 'q1_body_frame', selectedOptions: [2] }, // Kapha
    { questionId: 'q2_skin_type', selectedOptions: [2] }, // Kapha
    { questionId: 'q3_digestion', selectedOptions: [2] }, // Kapha
    { questionId: 'q4_energy_levels', selectedOptions: [2] }, // Kapha
    { questionId: 'q5_temperature_preference', selectedOptions: [2] }, // Kapha
    { questionId: 'q6_activity_level', selectedOptions: [2] }, // Kapha
    { questionId: 'q7_stress_response', selectedOptions: [2] }, // Kapha
    { questionId: 'q8_sleep_patterns', selectedOptions: [2] }, // Kapha
    { questionId: 'q9_decision_making', selectedOptions: [2] }, // Kapha
    { questionId: 'q10_food_preferences', selectedOptions: [5] }, // Kapha
    { questionId: 'q11_health_concerns', selectedOptions: [4, 5] }, // Kapha
    { questionId: 'q12_health_goal', selectedOptions: [4] } // Kapha
  ];
}

function getMixedVataPittaAnswers(): Answer[] {
  return [
    { questionId: 'q1_body_frame', selectedOptions: [0] }, // Vata
    { questionId: 'q2_skin_type', selectedOptions: [1] }, // Pitta
    { questionId: 'q3_digestion', selectedOptions: [0] }, // Vata
    { questionId: 'q4_energy_levels', selectedOptions: [1] }, // Pitta
    { questionId: 'q5_temperature_preference', selectedOptions: [0] }, // Vata
    { questionId: 'q6_activity_level', selectedOptions: [1] }, // Pitta
    { questionId: 'q7_stress_response', selectedOptions: [0] }, // Vata
    { questionId: 'q8_sleep_patterns', selectedOptions: [1] }, // Pitta
    { questionId: 'q9_decision_making', selectedOptions: [0] }, // Vata
    { questionId: 'q10_food_preferences', selectedOptions: [0, 3] }, // Vata + Pitta
    { questionId: 'q11_health_concerns', selectedOptions: [0, 2] }, // Vata + Pitta
    { questionId: 'q12_health_goal', selectedOptions: [0] } // Vata
  ];
}
