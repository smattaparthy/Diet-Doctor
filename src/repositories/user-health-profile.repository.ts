import { BaseRepository } from './base.repository';
import { UserHealthProfile, UserHealthProfileRow } from '../types';

/**
 * UserHealthProfileRepository
 *
 * Handles database operations for user health profiles including
 * Ayurvedic dosha scores, allergies, preferences, and health concerns.
 */
export class UserHealthProfileRepository extends BaseRepository<UserHealthProfile> {
  protected tableName = 'user_health_profiles';

  /**
   * Find health profile by user ID
   */
  async findByUserId(userId: number): Promise<UserHealthProfile | null> {
    const query = 'SELECT * FROM user_health_profiles WHERE user_id = ?';
    const row = await this.db.get<UserHealthProfileRow>(query, [userId]);

    if (!row) {
      return null;
    }

    return this.rowToProfile(row);
  }

  /**
   * Create or update user health profile
   */
  async upsert(profile: UserHealthProfile): Promise<number> {
    // Check if profile exists
    const existing = await this.findByUserId(profile.user_id);

    if (existing) {
      // Update existing profile
      await this.update(existing.id!, profile);
      return existing.id!;
    } else {
      // Create new profile
      return this.create(profile);
    }
  }

  /**
   * Create new health profile
   */
  async create(profile: UserHealthProfile): Promise<number> {
    const query = `
      INSERT INTO user_health_profiles (
        user_id,
        prakriti_vata, prakriti_pitta, prakriti_kapha,
        vikriti_vata, vikriti_pitta, vikriti_kapha,
        primary_dosha,
        allergies, dietary_restrictions, health_concerns,
        cuisine_preferences, spice_level, activity_level,
        stress_level, sleep_quality, assessment_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      profile.user_id,
      profile.prakriti_vata,
      profile.prakriti_pitta,
      profile.prakriti_kapha,
      profile.vikriti_vata,
      profile.vikriti_pitta,
      profile.vikriti_kapha,
      profile.primary_dosha,
      JSON.stringify(profile.allergies),
      JSON.stringify(profile.dietary_restrictions),
      JSON.stringify(profile.health_concerns),
      JSON.stringify(profile.cuisine_preferences),
      profile.spice_level,
      profile.activity_level,
      profile.stress_level,
      profile.sleep_quality,
      profile.assessment_completed_at || new Date().toISOString()
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  /**
   * Update existing health profile
   */
  async update(profileId: number, profile: UserHealthProfile): Promise<boolean> {
    const query = `
      UPDATE user_health_profiles SET
        prakriti_vata = ?, prakriti_pitta = ?, prakriti_kapha = ?,
        vikriti_vata = ?, vikriti_pitta = ?, vikriti_kapha = ?,
        primary_dosha = ?,
        allergies = ?, dietary_restrictions = ?, health_concerns = ?,
        cuisine_preferences = ?, spice_level = ?, activity_level = ?,
        stress_level = ?, sleep_quality = ?,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      profile.prakriti_vata,
      profile.prakriti_pitta,
      profile.prakriti_kapha,
      profile.vikriti_vata,
      profile.vikriti_pitta,
      profile.vikriti_kapha,
      profile.primary_dosha,
      JSON.stringify(profile.allergies),
      JSON.stringify(profile.dietary_restrictions),
      JSON.stringify(profile.health_concerns),
      JSON.stringify(profile.cuisine_preferences),
      profile.spice_level,
      profile.activity_level,
      profile.stress_level,
      profile.sleep_quality,
      profileId
    ];

    const result = await this.db.run(query, params);
    return (result.changes || 0) > 0;
  }

  /**
   * Update only vikriti (current state) scores
   * Used when recalculating dosha balance without full assessment
   */
  async updateVikriti(
    userId: number,
    vikriti: { vata: number; pitta: number; kapha: number }
  ): Promise<boolean> {
    const query = `
      UPDATE user_health_profiles SET
        vikriti_vata = ?,
        vikriti_pitta = ?,
        vikriti_kapha = ?,
        last_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    const params = [vikriti.vata, vikriti.pitta, vikriti.kapha, userId];
    const result = await this.db.run(query, params);
    return (result.changes || 0) > 0;
  }

  /**
   * Find profiles by primary dosha type
   * Useful for analytics and testing
   */
  async findByPrimaryDosha(dosha: string): Promise<UserHealthProfile[]> {
    const query = 'SELECT * FROM user_health_profiles WHERE primary_dosha = ?';
    const rows = await this.db.all<UserHealthProfileRow>(query, [dosha]);
    return rows.map(row => this.rowToProfile(row));
  }

  /**
   * Get users with specific health concerns
   */
  async findByHealthConcern(concern: string): Promise<UserHealthProfile[]> {
    const query = `
      SELECT * FROM user_health_profiles
      WHERE json_extract(health_concerns, '$') LIKE '%' || ? || '%'
    `;
    const rows = await this.db.all<UserHealthProfileRow>(query, [concern]);
    return rows.map(row => this.rowToProfile(row));
  }

  /**
   * Get users with specific allergies
   */
  async findByAllergy(allergen: string): Promise<UserHealthProfile[]> {
    const query = `
      SELECT * FROM user_health_profiles
      WHERE json_extract(allergies, '$') LIKE '%' || ? || '%'
    `;
    const rows = await this.db.all<UserHealthProfileRow>(query, [allergen]);
    return rows.map(row => this.rowToProfile(row));
  }

  /**
   * Delete health profile
   */
  async delete(profileId: number): Promise<boolean> {
    const query = 'DELETE FROM user_health_profiles WHERE id = ?';
    const result = await this.db.run(query, [profileId]);
    return (result.changes || 0) > 0;
  }

  /**
   * Convert database row to UserHealthProfile object
   * Parses JSON fields
   */
  private rowToProfile(row: UserHealthProfileRow): UserHealthProfile {
    return {
      id: row.id,
      user_id: row.user_id,
      prakriti_vata: row.prakriti_vata,
      prakriti_pitta: row.prakriti_pitta,
      prakriti_kapha: row.prakriti_kapha,
      vikriti_vata: row.vikriti_vata,
      vikriti_pitta: row.vikriti_pitta,
      vikriti_kapha: row.vikriti_kapha,
      primary_dosha: row.primary_dosha,
      allergies: JSON.parse(row.allergies),
      dietary_restrictions: JSON.parse(row.dietary_restrictions),
      health_concerns: JSON.parse(row.health_concerns),
      cuisine_preferences: JSON.parse(row.cuisine_preferences),
      spice_level: row.spice_level as 'mild' | 'medium' | 'hot',
      activity_level: row.activity_level as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
      stress_level: row.stress_level as 'low' | 'moderate' | 'high',
      sleep_quality: row.sleep_quality as 'poor' | 'fair' | 'good' | 'excellent',
      assessment_completed_at: row.assessment_completed_at || undefined,
      last_updated_at: row.last_updated_at,
      created_at: row.created_at
    };
  }
}
