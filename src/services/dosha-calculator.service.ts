/**
 * DoshaCalculator Service
 *
 * Implements Ayurvedic dosha calculation algorithm based on questionnaire responses.
 * Calculates Vata, Pitta, and Kapha scores and determines primary dosha type.
 *
 * Algorithm Specification:
 * 1. Sum dosha points from all answers
 * 2. Normalize to percentages (0-100)
 * 3. Determine primary dosha type:
 *    - If top 2 doshas within 15%: dual dosha (e.g., "vata-pitta")
 *    - If all 3 doshas within 10%: "tri-dosha"
 *    - Otherwise: single dominant dosha
 *
 * Possible Results: 10 dosha types
 * - Single: vata, pitta, kapha
 * - Dual: vata-pitta, vata-kapha, pitta-vata, pitta-kapha, kapha-vata, kapha-pitta
 * - Balanced: tri-dosha
 */

import doshaQuestions from '../config/dosha-questions.json';

// Type definitions
export interface DoshaPoints {
  vata?: number;
  pitta?: number;
  kapha?: number;
}

export interface QuestionOption {
  text: string;
  doshaPoints: DoshaPoints;
}

export interface Question {
  id: string;
  section: 'basic' | 'physical' | 'mental' | 'lifestyle';
  text: string;
  type: 'single' | 'multi';
  options: QuestionOption[];
}

export interface QuestionSection {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface QuestionnaireConfig {
  version: string;
  description: string;
  sections: QuestionSection[];
}

export interface Answer {
  questionId: string;
  selectedOptions: number[]; // Array of option indices
}

export interface DoshaScores {
  vata: number;
  pitta: number;
  kapha: number;
}

export interface DoshaPercentages {
  vata: number;
  pitta: number;
  kapha: number;
}

export type PrimaryDoshaType =
  | 'vata'
  | 'pitta'
  | 'kapha'
  | 'vata-pitta'
  | 'vata-kapha'
  | 'pitta-vata'
  | 'pitta-kapha'
  | 'kapha-vata'
  | 'kapha-pitta'
  | 'tri-dosha';

export interface DoshaCalculationResult {
  rawScores: DoshaScores;
  percentages: DoshaPercentages;
  primaryDosha: PrimaryDoshaType;
  isDualDosha: boolean;
  isTriDosha: boolean;
  dominantDoshas: string[]; // Array of 1-3 dosha names in order of dominance
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * DoshaCalculator Class
 * Main service for calculating dosha scores and determining constitution type
 */
export class DoshaCalculator {
  private readonly questions: QuestionnaireConfig;

  constructor() {
    this.questions = doshaQuestions as QuestionnaireConfig;
  }

  /**
   * Get all questions for the assessment
   */
  getQuestions(): QuestionnaireConfig {
    return this.questions;
  }

  /**
   * Get questions by section
   */
  getQuestionsBySection(sectionId: string): Question[] {
    const section = this.questions.sections.find(s => s.id === sectionId);
    return section?.questions || [];
  }

  /**
   * Validate questionnaire answers
   * Ensures all required questions are answered and answers are valid
   */
  validateAnswers(answers: Answer[]): ValidationResult {
    const errors: string[] = [];

    // Get all question IDs
    const allQuestionIds = this.questions.sections.flatMap(section =>
      section.questions.map(q => q.id)
    );

    // Check if all questions are answered
    const answeredQuestionIds = new Set(answers.map(a => a.questionId));
    const missingQuestions = allQuestionIds.filter(id => !answeredQuestionIds.has(id));

    if (missingQuestions.length > 0) {
      errors.push(`Missing answers for questions: ${missingQuestions.join(', ')}`);
    }

    // Validate each answer
    for (const answer of answers) {
      // Find the question
      const question = this.findQuestionById(answer.questionId);

      if (!question) {
        errors.push(`Invalid question ID: ${answer.questionId}`);
        continue;
      }

      // Validate option indices
      if (!Array.isArray(answer.selectedOptions) || answer.selectedOptions.length === 0) {
        errors.push(`No options selected for question: ${answer.questionId}`);
        continue;
      }

      // Check if indices are within valid range
      const invalidIndices = answer.selectedOptions.filter(
        idx => idx < 0 || idx >= question.options.length
      );

      if (invalidIndices.length > 0) {
        errors.push(
          `Invalid option indices for question ${answer.questionId}: ${invalidIndices.join(', ')}`
        );
      }

      // Validate single vs multi-select
      if (question.type === 'single' && answer.selectedOptions.length > 1) {
        errors.push(
          `Question ${answer.questionId} is single-select but multiple options were provided`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate dosha scores from questionnaire answers
   * Returns raw scores, percentages, and primary dosha type
   */
  calculateScores(answers: Answer[]): DoshaCalculationResult {
    // Validate answers first
    const validation = this.validateAnswers(answers);
    if (!validation.isValid) {
      throw new Error(`Invalid answers: ${validation.errors.join('; ')}`);
    }

    // Initialize raw scores
    const rawScores: DoshaScores = {
      vata: 0,
      pitta: 0,
      kapha: 0
    };

    // Sum dosha points from all answers
    for (const answer of answers) {
      const question = this.findQuestionById(answer.questionId);
      if (!question) continue;

      for (const optionIndex of answer.selectedOptions) {
        const option = question.options[optionIndex];
        if (!option) continue;

        // Add points for each dosha
        if (option.doshaPoints.vata) {
          rawScores.vata += option.doshaPoints.vata;
        }
        if (option.doshaPoints.pitta) {
          rawScores.pitta += option.doshaPoints.pitta;
        }
        if (option.doshaPoints.kapha) {
          rawScores.kapha += option.doshaPoints.kapha;
        }
      }
    }

    // Calculate percentages
    const percentages = this.normalizeToPercentages(rawScores);

    // Determine primary dosha type
    const primaryDosha = this.determinePrimaryDosha(percentages);

    // Determine if dual or tri-dosha
    const sorted = this.getSortedDoshas(percentages);
    const isDualDosha = this.isDualDosha(percentages);
    const isTriDosha = this.isTriDosha(percentages);

    return {
      rawScores,
      percentages,
      primaryDosha,
      isDualDosha,
      isTriDosha,
      dominantDoshas: sorted.map(([name]) => name)
    };
  }

  /**
   * Normalize raw scores to percentages (0-100)
   */
  private normalizeToPercentages(rawScores: DoshaScores): DoshaPercentages {
    const total = rawScores.vata + rawScores.pitta + rawScores.kapha;

    // Handle edge case where total is 0
    if (total === 0) {
      return {
        vata: 33,
        pitta: 33,
        kapha: 34
      };
    }

    // Calculate percentages and round to integers
    const vata = Math.round((rawScores.vata / total) * 100);
    const pitta = Math.round((rawScores.pitta / total) * 100);
    const kapha = Math.round((rawScores.kapha / total) * 100);

    // Adjust for rounding errors to ensure sum is exactly 100
    const sum = vata + pitta + kapha;
    let adjusted = { vata, pitta, kapha };

    if (sum !== 100) {
      // Find the largest dosha and adjust it
      const sorted = this.getSortedDoshas({ vata, pitta, kapha });
      const largestDosha = sorted[0][0] as keyof DoshaPercentages;
      adjusted[largestDosha] += (100 - sum);
    }

    return adjusted;
  }

  /**
   * Determine primary dosha type based on percentages
   *
   * Logic:
   * - If all 3 doshas within 10%: tri-dosha
   * - If top 2 doshas within 15%: dual dosha (format: higher-lower)
   * - Otherwise: single dominant dosha
   */
  determinePrimaryDosha(percentages: DoshaPercentages): PrimaryDoshaType {
    const sorted = this.getSortedDoshas(percentages);
    const [first, second, third] = sorted;

    // Calculate differences
    const topTwoDiff = first[1] - second[1];
    const maxMinDiff = first[1] - third[1];

    // Check for tri-dosha FIRST (all three within 10% of each other)
    // This means the max - min difference is <= 10
    if (maxMinDiff <= 10) {
      return 'tri-dosha';
    }

    // Check for dual dosha (top two within 15% AND not tri-dosha)
    if (topTwoDiff < 15) {
      // Format as "higher-lower"
      return `${first[0]}-${second[0]}` as PrimaryDoshaType;
    }

    // Single dominant dosha
    return first[0] as PrimaryDoshaType;
  }

  /**
   * Check if constitution is tri-dosha (all three doshas within 10%)
   * Logic: Maximum difference between any two doshas must be ≤ 10%
   */
  private isTriDosha(percentages: DoshaPercentages): boolean {
    const values = Object.values(percentages);
    const max = Math.max(...values);
    const min = Math.min(...values);
    return (max - min) <= 10;
  }

  /**
   * Check if constitution is dual-dosha (top two within 15%)
   */
  private isDualDosha(percentages: DoshaPercentages): boolean {
    const sorted = this.getSortedDoshas(percentages);
    const diff = sorted[0][1] - sorted[1][1];
    return diff < 15;
  }

  /**
   * Get doshas sorted by percentage (descending)
   * Returns array of [doshaName, percentage] tuples
   */
  private getSortedDoshas(percentages: DoshaPercentages): [string, number][] {
    return Object.entries(percentages)
      .sort((a, b) => b[1] - a[1]);
  }

  /**
   * Find a question by its ID
   */
  private findQuestionById(questionId: string): Question | null {
    for (const section of this.questions.sections) {
      const question = section.questions.find(q => q.id === questionId);
      if (question) {
        return question;
      }
    }
    return null;
  }

  /**
   * Get dosha descriptions for user education
   */
  getDoshaDescription(dosha: PrimaryDoshaType): string {
    const descriptions: Record<PrimaryDoshaType, string> = {
      'vata': 'Vata dosha is characterized by qualities of air and space. You tend to be creative, energetic, and quick-thinking, but may experience anxiety, irregular digestion, and sensitivity to cold.',
      'pitta': 'Pitta dosha is characterized by fire and water elements. You tend to be intelligent, focused, and warm, but may experience inflammation, irritability, and sensitivity to heat.',
      'kapha': 'Kapha dosha is characterized by earth and water elements. You tend to be calm, stable, and strong, but may experience sluggishness, weight gain, and congestion.',
      'vata-pitta': 'Vata-Pitta constitution combines qualities of air, space, and fire. You are likely creative and driven, but need balance between activity and cooling practices.',
      'vata-kapha': 'Vata-Kapha constitution combines qualities of air, space, earth, and water. You balance creativity with stability, but may experience fluctuating energy.',
      'pitta-vata': 'Pitta-Vata constitution combines qualities of fire, water, air, and space. You are likely intense and quick-thinking, with strong mental and physical energy.',
      'pitta-kapha': 'Pitta-Kapha constitution combines fire, water, earth. You are likely determined and strong, with good endurance and focus.',
      'kapha-vata': 'Kapha-Vata constitution combines earth, water, air, and space. You balance stability with creativity, though may experience variable energy.',
      'kapha-pitta': 'Kapha-Pitta constitution combines earth, water, and fire. You are likely strong and focused, with good stamina and determination.',
      'tri-dosha': 'Tri-dosha constitution is a balanced combination of Vata, Pitta, and Kapha. You have excellent adaptability and generally good health, but need to maintain balance across all three doshas.'
    };

    return descriptions[dosha] || 'Unknown dosha type';
  }

  /**
   * Get dietary recommendations based on primary dosha
   */
  getDietaryRecommendations(dosha: PrimaryDoshaType): {
    favorable: string[];
    unfavorable: string[];
  } {
    const recommendations: Record<string, { favorable: string[]; unfavorable: string[] }> = {
      'vata': {
        favorable: ['Warm, cooked foods', 'Healthy fats and oils', 'Root vegetables', 'Warming spices (ginger, cinnamon)', 'Sweet, sour, salty tastes'],
        unfavorable: ['Raw, cold foods', 'Dry, light foods', 'Bitter, pungent, astringent tastes', 'Excessive caffeine']
      },
      'pitta': {
        favorable: ['Cooling foods', 'Sweet, bitter, astringent tastes', 'Cucumber, leafy greens', 'Dairy products', 'Cooling grains (rice, oats)'],
        unfavorable: ['Hot, spicy foods', 'Acidic foods', 'Pungent, sour, salty tastes', 'Red meat', 'Alcohol, coffee']
      },
      'kapha': {
        favorable: ['Light, dry foods', 'Pungent, bitter, astringent tastes', 'Spicy foods', 'Salads and raw vegetables', 'Warming spices'],
        unfavorable: ['Heavy, oily foods', 'Sweet, sour, salty tastes', 'Dairy products in excess', 'Frozen foods', 'Overeating']
      },
      'tri-dosha': {
        favorable: ['Balanced diet with variety', 'Seasonal, fresh foods', 'Moderate portions', 'All six tastes in moderation'],
        unfavorable: ['Excessive amounts of any taste', 'Overeating', 'Irregular eating patterns']
      }
    };

    // For dual doshas, combine recommendations from both
    if (dosha.includes('-') && dosha !== 'tri-dosha') {
      const [first, second] = dosha.split('-');
      const firstRec = recommendations[first] || recommendations.vata;
      const secondRec = recommendations[second] || recommendations.vata;

      return {
        favorable: [...new Set([...firstRec.favorable, ...secondRec.favorable])],
        unfavorable: [...new Set([...firstRec.unfavorable, ...secondRec.unfavorable])]
      };
    }

    return recommendations[dosha] || recommendations.vata;
  }
}

// Export singleton instance
export const doshaCalculator = new DoshaCalculator();
