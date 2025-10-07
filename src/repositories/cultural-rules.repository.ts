import { BaseRepository } from './base.repository';
import { CulturalRule } from '../types';

export class CulturalRulesRepository extends BaseRepository<CulturalRule> {
  protected tableName = 'cultural_rules';

  async findByType(type: 'religious' | 'dietary' | 'cultural' | 'ayurvedic'): Promise<CulturalRule[]> {
    const query = `SELECT * FROM cultural_rules WHERE type = ? ORDER BY name`;
    return this.db.all<CulturalRule>(query, [type]);
  }

  async findByApplicability(applicability: string): Promise<CulturalRule[]> {
    const query = `
      SELECT * FROM cultural_rules
      WHERE applicability LIKE '%' || ? || '%'
      ORDER BY severity DESC, name
    `;
    return this.db.all<CulturalRule>(query, [`%"${applicability}"%`]);
  }

  async findStrictRules(applicability?: string): Promise<CulturalRule[]> {
    let query = `SELECT * FROM cultural_rules WHERE severity = 'strict'`;
    const params: any[] = [];

    if (applicability) {
      query += ` AND applicability LIKE '%' || ? || '%'`;
      params.push(`%"${applicability}"%`);
    }

    query += ` ORDER BY name`;
    return this.db.all<CulturalRule>(query, params);
  }

  async findRulesByForbiddenIngredient(ingredient: string): Promise<CulturalRule[]> {
    const query = `
      SELECT * FROM cultural_rules
      WHERE forbidden_ingredients LIKE '%' || ? || '%'
      ORDER BY severity DESC, name
    `;
    return this.db.all<CulturalRule>(query, [`%"${ingredient}"%`]);
  }

  async getRulesForDietaryProfile(cuisinePreferences: string[], dietaryRestrictions: string[], dosha?: string): Promise<CulturalRule[]> {
    // Build query to find relevant rules
    const conditions: string[] = [];
    const params: any[] = [];

    // Add conditions for cuisine preferences
    if (cuisinePreferences.length > 0) {
      const cuisineConditions = cuisinePreferences.map(() => 'applicability LIKE ?').join(' OR ');
      conditions.push(`(${cuisineConditions})`);
      params.push(...cuisinePreferences.map(cuisine => `%"${cuisine}"%`));
    }

    // Add conditions for dietary restrictions
    if (dietaryRestrictions.length > 0) {
      const restrictionConditions = dietaryRestrictions.map(() => 'applicability LIKE ?').join(' OR ');
      conditions.push(`(${restrictionConditions})`);
      params.push(...dietaryRestrictions.map(restriction => `%"${restriction}"%`));
    }

    // Add dosha-specific rules if provided
    if (dosha) {
      conditions.push('(applicability LIKE ?)');
      params.push(`%"${dosha}"%`);
    }

    // Also include general rules
    conditions.push('(applicability LIKE ?)');
    params.push('%"general"%');

    const query = `
      SELECT DISTINCT * FROM cultural_rules
      WHERE (${conditions.join(' OR ')})
      ORDER BY severity DESC, type, name
    `;

    return this.db.all<CulturalRule>(query, params);
  }

  async createRule(rule: Omit<CulturalRule, 'id'>): Promise<number> {
    const query = `
      INSERT INTO cultural_rules (
        name, type, description, applicability, forbidden_ingredients, conditional_restrictions, severity
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      rule.name,
      rule.type,
      rule.description,
      JSON.stringify(rule.applicability),
      JSON.stringify(rule.forbidden_ingredients),
      JSON.stringify(rule.conditional_restrictions),
      rule.severity
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  async updateRule(ruleId: number, rule: Partial<CulturalRule>): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    const fieldMappings: { [key: string]: string } = {
      name: 'name',
      type: 'type',
      description: 'description',
      applicability: 'applicability',
      forbidden_ingredients: 'forbidden_ingredients',
      conditional_restrictions: 'conditional_restrictions',
      severity: 'severity'
    };

    for (const [key, field] of Object.entries(fieldMappings)) {
      if (key in rule && rule[key as keyof CulturalRule] !== undefined) {
        const value = rule[key as keyof CulturalRule];
        if (Array.isArray(value)) {
          updates.push(`${field} = ?`);
          params.push(JSON.stringify(value));
        } else {
          updates.push(`${field} = ?`);
          params.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(ruleId);

    const query = `UPDATE cultural_rules SET ${updates.join(', ')} WHERE id = ?`;
    const result = await this.db.run(query, params);

    return (result.changes || 0) > 0;
  }

  async searchRules(searchTerm: string): Promise<CulturalRule[]> {
    const query = `
      SELECT * FROM cultural_rules
      WHERE (name LIKE ? OR description LIKE ? OR forbidden_ingredients LIKE ?)
      ORDER BY severity DESC, name
    `;
    const searchPattern = `%${searchTerm}%`;
    return this.db.all<CulturalRule>(query, [searchPattern, searchPattern, searchPattern]);
  }

  async exportRulesByType(): Promise<{ [key: string]: CulturalRule[] }> {
    const rules = await this.db.all<CulturalRule>(`SELECT * FROM ${this.tableName}`);
    const grouped: { [key: string]: CulturalRule[] } = {};

    rules.forEach((rule: CulturalRule) => {
      if (!grouped[rule.type]) {
        grouped[rule.type] = [];
      }
      grouped[rule.type].push(rule);
    });

    return grouped;
  }

  async importRules(rules: Array<Omit<CulturalRule, 'id'>>): Promise<number> {
    await this.db.beginTransaction();

    try {
      let insertedCount = 0;
      for (const rule of rules) {
        try {
          await this.createRule(rule);
          insertedCount++;
        } catch (error) {
          // Log error but continue with next rule
          console.error('Failed to import rule:', rule.name, error);
        }
      }
      await this.db.commit();
      return insertedCount;
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  async getAllForbiddenIngredients(): Promise<string[]> {
    const query = `
      SELECT DISTINCT json_each.value as ingredient
      FROM cultural_rules, json_each(cultural_rules.forbidden_ingredients)
      WHERE json_each.value IS NOT NULL
      ORDER BY ingredient
    `;
    const results = await this.db.all<{ ingredient: string }>(query);
    return results.map((r: { ingredient: string }) => r.ingredient);
  }

  async getRuleStatistics(): Promise<{
    totalRules: number;
    rulesByType: { [key: string]: number };
    rulesBySeverity: { [key: string]: number };
    totalForbiddenIngredients: number;
  }> {
    const [total, byType, bySeverity, ingredients] = await Promise.all([
      this.db.get('SELECT COUNT(*) as count FROM cultural_rules'),
      this.db.all('SELECT type, COUNT(*) as count FROM cultural_rules GROUP BY type'),
      this.db.all('SELECT severity, COUNT(*) as count FROM cultural_rules GROUP BY severity'),
      this.getAllForbiddenIngredients()
    ]);

    return {
      totalRules: total?.count || 0,
      rulesByType: (byType as any[]).reduce((acc, item) => {
        acc[item.type] = item.count;
        return acc;
      }, {} as { [key: string]: number }),
      rulesBySeverity: (bySeverity as any[]).reduce((acc, item) => {
        acc[item.severity] = item.count;
        return acc;
      }, {} as { [key: string]: number }),
      totalForbiddenIngredients: ingredients.length
    };
  }
}