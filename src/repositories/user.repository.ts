import { BaseRepository } from './base.repository';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';

export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = ?';
    const row = await this.db.get<User>(query, [email]);
    return row || null;
  }

  async create(userData: CreateUserRequest): Promise<number> {
    const query = `
      INSERT INTO users (name, email, password_hash, cuisine_preferences, dietary_restrictions, dosha, cultural_background)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      userData.name,
      userData.email,
      userData.password, // Should be hashed in service layer
      JSON.stringify(userData.cuisine_preferences),
      JSON.stringify(userData.dietary_restrictions),
      userData.dosha,
      userData.cultural_background
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  async updateProfile(userId: number, userData: UpdateUserRequest): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (userData.name !== undefined) {
      updates.push('name = ?');
      params.push(userData.name);
    }

    if (userData.cuisine_preferences !== undefined) {
      updates.push('cuisine_preferences = ?');
      params.push(JSON.stringify(userData.cuisine_preferences));
    }

    if (userData.dietary_restrictions !== undefined) {
      updates.push('dietary_restrictions = ?');
      params.push(JSON.stringify(userData.dietary_restrictions));
    }

    if (userData.dosha !== undefined) {
      updates.push('dosha = ?');
      params.push(userData.dosha);
    }

    if (userData.cultural_background !== undefined) {
      updates.push('cultural_background = ?');
      params.push(userData.cultural_background);
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    const result = await this.db.run(query, params);

    return (result.changes || 0) > 0;
  }

  async getUsersByCuisinePreference(cuisine: string): Promise<User[]> {
    const query = `
      SELECT * FROM users
      WHERE json_extract(cuisine_preferences, '$') LIKE '%' || ? || '%'
    `;
    return this.db.all<User>(query, [`%"${cuisine}"%`]);
  }

  async getUsersByDosha(dosha: string): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE dosha = ?';
    return this.db.all<User>(query, [dosha]);
  }

  async updatePassword(userId: number, passwordHash: string): Promise<boolean> {
    const query = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const result = await this.db.run(query, [passwordHash, userId]);

    return (result.changes || 0) > 0;
  }

  async getUserStats(userId: number): Promise<{
    totalMealPlans: number;
    totalShoppingLists: number;
    favoriteRecipes: number;
  }> {
    const [mealPlans, shoppingLists, favorites] = await Promise.all([
      this.db.get('SELECT COUNT(*) as count FROM meal_plans WHERE user_id = ?', [userId]),
      this.db.get('SELECT COUNT(*) as count FROM shopping_lists WHERE user_id = ?', [userId]),
      this.db.get('SELECT COUNT(*) as count FROM user_recipe_favorites WHERE user_id = ?', [userId])
    ]);

    return {
      totalMealPlans: mealPlans?.count || 0,
      totalShoppingLists: shoppingLists?.count || 0,
      favoriteRecipes: favorites?.count || 0
    };
  }
}