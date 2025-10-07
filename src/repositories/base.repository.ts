import DatabaseConnection from '../database/connection';

export abstract class BaseRepository<T> {
  protected db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  protected abstract tableName: string;

  async findById(id: number): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const row = await this.db.get<T>(query, [id]);
    return row || null;
  }

  async findAll(limit: number = 50, offset: number = 0): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY id DESC LIMIT ? OFFSET ?`;
    return this.db.all<T>(query, [limit, offset]);
  }

  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const result = await this.db.get<{ count: number }>(query);
    return result?.count || 0;
  }

  async create(data: Partial<T>): Promise<number> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');

    const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.db.run(query, values);

    return result.lastID || 0;
  }

  async update(id: number, data: Partial<T>): Promise<boolean> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');

    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    const result = await this.db.run(query, [...values, id]);

    return (result.changes || 0) > 0;
  }

  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await this.db.run(query, [id]);

    return (result.changes || 0) > 0;
  }

  async exists(id: number): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const row = await this.db.get(query, [id]);
    return !!row;
  }

  async findManyByCondition(condition: string, params: any[] = []): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${condition}`;
    return this.db.all<T>(query, params);
  }

  async findOneByCondition(condition: string, params: any[] = []): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${condition} LIMIT 1`;
    const row = await this.db.get<T>(query, params);
    return row || null;
  }
}