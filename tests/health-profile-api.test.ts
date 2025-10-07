/**
 * Health Profile API Integration Tests
 *
 * Tests for EPIC 4 - API Endpoints (Backend Services)
 * - Story 4.1: Health Profile Management Endpoints
 * - Story 4.2: Recipe Recommendation Endpoints
 * - Story 4.3: User Interaction Tracking Endpoints
 */

import request from 'supertest';
import app from '../src/server';

describe('Health Profile API - Story 4.1', () => {
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    // Register a test user
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User Health',
        email: 'healthtest@test.com',
        password: 'TestPassword123!',
        cuisine_preferences: ['north_indian', 'mediterranean'],
        dietary_restrictions: [],
        dosha: null,
        cultural_background: 'hindu'
      });

    authToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  describe('GET /api/v1/users/dosha-assessment/questions', () => {
    it('should return questionnaire questions without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/users/dosha-assessment/questions')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('sections');
      expect(Array.isArray(res.body.data.sections)).toBe(true);
      expect(res.body.data.sections.length).toBeGreaterThan(0);

      // Verify question structure
      const firstSection = res.body.data.sections[0];
      expect(firstSection).toHaveProperty('id');
      expect(firstSection).toHaveProperty('title');
      expect(firstSection).toHaveProperty('questions');
      expect(Array.isArray(firstSection.questions)).toBe(true);
    });
  });

  describe('POST /api/v1/users/dosha-assessment', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/users/dosha-assessment')
        .send({ answers: [] })
        .expect(401);
    });

    it('should validate answers array is present', async () => {
      const res = await request(app)
        .post('/api/v1/users/dosha-assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('array');
    });

    it('should return validation errors for incomplete answers', async () => {
      const res = await request(app)
        .post('/api/v1/users/dosha-assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          answers: [
            { questionId: 'q1', selectedOptions: [0] }
            // Missing other required questions
          ]
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_ANSWERS');
      expect(res.body.details).toBeDefined();
    });

    it('should calculate dosha scores with valid answers', async () => {
      // Get questions first to build valid answers
      const questionsRes = await request(app)
        .get('/api/v1/users/dosha-assessment/questions');

      const sections = questionsRes.body.data.sections;
      const answers = sections.flatMap((section: any) =>
        section.questions.map((q: any) => ({
          questionId: q.id,
          selectedOptions: [0] // Select first option for each question
        }))
      );

      const res = await request(app)
        .post('/api/v1/users/dosha-assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ answers })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('rawScores');
      expect(res.body.data).toHaveProperty('percentages');
      expect(res.body.data).toHaveProperty('primaryDosha');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('dietaryRecommendations');

      // Verify scores structure
      expect(res.body.data.rawScores).toHaveProperty('vata');
      expect(res.body.data.rawScores).toHaveProperty('pitta');
      expect(res.body.data.rawScores).toHaveProperty('kapha');

      // Verify percentages sum to 100
      const percentages = res.body.data.percentages;
      const sum = percentages.vata + percentages.pitta + percentages.kapha;
      expect(sum).toBe(100);
    });
  });

  describe('GET /api/v1/users/health-profile', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/users/health-profile')
        .expect(401);
    });

    it('should return user health profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/health-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('profile');
      expect(res.body.data.profile).toHaveProperty('cuisinePreferences');
      expect(res.body.data.profile).toHaveProperty('dietaryRestrictions');
      expect(res.body.data.profile).toHaveProperty('culturalBackground');

      // Dosha info may or may not be present depending on whether assessment was completed
      if (res.body.data.doshaInfo) {
        expect(res.body.data.doshaInfo).toHaveProperty('primaryDosha');
        expect(res.body.data.doshaInfo).toHaveProperty('description');
      }
    });
  });

  describe('POST /api/v1/users/health-profile', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/users/health-profile')
        .send({ cuisinePreferences: ['indian'] })
        .expect(401);
    });

    it('should update health profile', async () => {
      const res = await request(app)
        .post('/api/v1/users/health-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisinePreferences: ['north_indian', 'south_indian'],
          dietaryRestrictions: [
            { type: 'religious', restriction: 'hindu', severity: 'strict' }
          ],
          culturalBackground: 'hindu'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.cuisinePreferences).toContain('north_indian');
      expect(res.body.data.cuisinePreferences).toContain('south_indian');
    });

    it('should return error when no update data provided', async () => {
      const res = await request(app)
        .post('/api/v1/users/health-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NO_UPDATE_DATA');
    });
  });

  describe('GET /api/v1/users/dosha-balance', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/users/dosha-balance')
        .expect(401);
    });

    it('should return dosha balance information', async () => {
      const res = await request(app)
        .get('/api/v1/users/dosha-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('primaryDosha');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('dietaryRecommendations');
      expect(res.body.data).toHaveProperty('balanceStatus');
      expect(res.body.data.balanceStatus).toHaveProperty('status');
      expect(res.body.data.balanceStatus).toHaveProperty('tips');
    });
  });
});

describe('Recipe Recommendations API - Story 4.2', () => {
  let authToken: string;

  beforeAll(async () => {
    // Register test user with dosha
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User Recipes',
        email: 'recipetest@test.com',
        password: 'TestPassword123!',
        cuisine_preferences: ['north_indian'],
        dietary_restrictions: [],
        dosha: 'vata',
        cultural_background: 'hindu'
      });

    authToken = res.body.data.token;
  });

  describe('GET /api/v1/recipes/recommended', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/recipes/recommended')
        .expect(401);
    });

    it('should return personalized recommendations', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('metadata');
      expect(res.body.metadata).toHaveProperty('basedOn');
      expect(res.body.metadata).toHaveProperty('dosha');
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/recommended?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should support cuisine filtering', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/recommended?cuisine=north_indian')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // All returned recipes should match the cuisine filter
      res.body.data.forEach((recipe: any) => {
        expect(recipe.cuisine_type).toBe('north_indian');
      });
    });
  });

  describe('GET /api/v1/recipes/for-dosha/:dosha', () => {
    it('should return recipes for specified dosha', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/for-dosha/vata')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.metadata.dosha).toBe('vata');
    });

    it('should validate dosha parameter', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/for-dosha/invalid')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_DOSHA');
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/for-dosha/pitta?limit=10')
        .expect(200);

      expect(res.body.pagination.limit).toBe(10);
    });
  });
});

describe('User Interaction Tracking API - Story 4.3', () => {
  let authToken: string;
  let recipeId: number;

  beforeAll(async () => {
    // Register test user
    const authRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User Interaction',
        email: 'interactiontest@test.com',
        password: 'TestPassword123!',
        cuisine_preferences: ['north_indian'],
        dietary_restrictions: [],
        dosha: 'pitta',
        cultural_background: 'hindu'
      });

    authToken = authRes.body.data.token;

    // Get a recipe ID for testing
    const recipesRes = await request(app)
      .get('/api/v1/recipes?limit=1');

    if (recipesRes.body.data && recipesRes.body.data.length > 0) {
      recipeId = recipesRes.body.data[0].id;
    }
  });

  describe('POST /api/v1/recipes/:id/feedback', () => {
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/recipes/${recipeId}/feedback`)
        .send({ rating: 5, feedback: 'Great recipe!' })
        .expect(401);
    });

    it('should validate rating is required', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'Good' })
        .expect(400);

      expect(res.body.code).toBe('INVALID_RATING');
    });

    it('should validate rating range', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 6 })
        .expect(400);

      expect(res.body.code).toBe('INVALID_RATING');
    });

    it('should submit feedback successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rating: 4,
          feedback: 'Delicious and easy to make!'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.feedback).toBe('Delicious and easy to make!');
    });

    it('should handle non-existent recipe', async () => {
      const res = await request(app)
        .post('/api/v1/recipes/999999/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5 })
        .expect(404);

      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/recipes/:id/interaction', () => {
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/recipes/${recipeId}/interaction`)
        .send({ interactionType: 'view' })
        .expect(401);
    });

    it('should validate interaction type', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/interaction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interactionType: 'invalid' })
        .expect(400);

      expect(res.body.code).toBe('INVALID_INTERACTION_TYPE');
    });

    it('should track view interaction', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/interaction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interactionType: 'view' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.interactionType).toBe('view');
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('should track save interaction', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/interaction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interactionType: 'save' })
        .expect(200);

      expect(res.body.data.interactionType).toBe('save');
    });

    it('should track cook interaction', async () => {
      const res = await request(app)
        .post(`/api/v1/recipes/${recipeId}/interaction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interactionType: 'cook' })
        .expect(200);

      expect(res.body.data.interactionType).toBe('cook');
    });

    it('should handle non-existent recipe', async () => {
      const res = await request(app)
        .post('/api/v1/recipes/999999/interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interactionType: 'view' })
        .expect(404);

      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
