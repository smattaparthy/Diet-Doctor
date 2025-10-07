import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import { DatabaseConnection } from '../src/database/connection';

const testDatabaseInstance: DatabaseConnection | undefined;

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.DATABASE_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.CORS_ORIGIN = 'http://localhost:3001';

  // Run database migrations for tests
  const db = DatabaseConnection.getInstance();
  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split schema into individual statements and execute them
    const statements = schema
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement) {
        await db.run(statement);
      }
    }

    console.log('Test database schema created successfully');
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  // Cleanup test database
  if (testDatabaseInstance) {
    await testDatabaseInstance.close();
  }
});

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
};