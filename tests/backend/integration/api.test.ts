import request from 'supertest';
import app from '../../src/server';
import { DatabaseConnection } from '../../src/database/connection';

describe('Cultural Diet API Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let dbConnection: DatabaseConnection;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_PATH = ':memory:';

    // Initialize test database
    dbConnection = DatabaseConnection.getInstance();
  });

  afterAll(async () => {
    // Cleanup test database
    await dbConnection.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'Cultural Diet API',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('User Authentication', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@culturaldiet.com',
        password: 'SecurePass123!',
        name: 'Test User',
        culturalBackground: 'hindu',
        dosha: 'pitta'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully'
      });
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.culturalBackground).toBe(userData.culturalBackground);
      expect(response.body.user.dosha).toBe(userData.dosha);
      testUserId = response.body.user.id;
    });

    it('should login registered user', async () => {
      const loginData = {
        email: 'test@culturaldiet.com',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful'
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      authToken = response.body.token;
    });

    it('should reject invalid credentials', async () => {
      const invalidData = {
        email: 'test@culturaldiet.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(invalidData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid credentials')
      });
    });
  });

  describe('User Profile Management', () => {
    it('should retrieve user profile', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: testUserId,
          email: 'test@culturaldiet.com',
          culturalBackground: 'hindu',
          dosha: 'pitta'
        }
      });
    });

    it('should update user profile', async () => {
      const updateData = {
        name: 'Updated Test User',
        dosha: 'vata',
        dietaryRestrictions: ['vegetarian', 'gluten-free']
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          name: 'Updated Test User',
          dosha: 'vata',
          dietaryRestrictions: ['vegetarian', 'gluten-free']
        }
      });
    });
  });

  describe('Cultural Rules Engine', () => {
    it('should retrieve all cultural rules', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        rules: expect.any(Array)
      });
      expect(response.body.rules.length).toBeGreaterThan(0);
    });

    it('should get forbidden ingredients for Hindu diet', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/forbidden-ingredients')
        .query({ culturalBackground: 'hindu' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        forbiddenIngredients: expect.any(Array)
      });

      // Verify red meat is in forbidden list
      const forbiddenIngredients = response.body.forbiddenIngredients;
      expect(forbiddenIngredients).toContain('beef');
      expect(forbiddenIngredients).toContain('pork');
      expect(forbiddenIngredients).toContain('lamb');
    });

    it('should validate ingredient against Hindu dietary rules', async () => {
      const validationData = {
        ingredient: 'beef',
        culturalBackground: 'hindu'
      };

      const response = await request(app)
        .post('/api/v1/cultural-rules/validate-ingredient')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validationData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        isAllowed: false,
        culturalBackground: 'hindu',
        ingredient: 'beef',
        reason: expect.stringContaining('forbidden')
      });
    });

    it('should get Ayurvedic dosha recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/ayurvedic-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dosha: 'vata' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        dosha: 'vata',
        recommendations: expect.any(Array)
      });

      // Verify Vata-specific recommendations
      const recommendations = response.body.recommendations;
      expect(recommendations.some(r => r.category === 'foods')).toBe(true);
      expect(recommendations.some(r => r.category === 'lifestyle')).toBe(true);
    });

    it('should get Hindu dietary guidance', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/hindu-dietary-guidance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        culturalBackground: 'hindu',
        guidance: expect.any(Object)
      });

      const guidance = response.body.guidance;
      expect(guidance.allowedFoods).toBeDefined();
      expect(guidance.forbiddenFoods).toBeDefined();
      expect(guidance.dietaryPrinciples).toBeDefined();
    });
  });

  describe('Recipe Management', () => {
    let recipeId: string;

    it('should create a culturally compliant recipe', async () => {
      const recipeData = {
        title: 'Traditional Dal Tadka',
        description: 'Authentic Indian lentil dish',
        ingredients: [
          { name: 'lentils', quantity: '1 cup', cultural: true },
          { name: 'turmeric', quantity: '1 tsp', cultural: true },
          { name: 'cumin', quantity: '1 tsp', cultural: true },
          { name: 'onion', quantity: '1 medium', cultural: true },
          { name: 'tomato', quantity: '2 medium', cultural: true }
        ],
        instructions: 'Cook lentils until soft, then temper spices',
        cuisine: 'indian',
        culturalBackground: 'hindu',
        doshaBalancing: ['pitta', 'vata'],
        prepTime: 30,
        cookTime: 45,
        servings: 4
      };

      const response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(recipeData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        recipe: {
          title: 'Traditional Dal Tadka',
          cuisine: 'indian',
          culturalBackground: 'hindu'
        }
      });
      recipeId = response.body.recipe.id;
    });

    it('should search recipes with cultural filters', async () => {
      const response = await request(app)
        .get('/api/v1/recipes')
        .query({
          culturalBackground: 'hindu',
          cuisine: 'indian',
          dosha: 'vata'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        recipes: expect.any(Array),
        pagination: expect.any(Object)
      });

      // Verify all recipes comply with Hindu dietary rules
      const recipes = response.body.recipes;
      recipes.forEach(recipe => {
        expect(recipe.culturalBackground).toBe('hindu');
      });
    });

    it('should validate recipe cultural compliance', async () => {
      const response = await request(app)
        .post(`/api/v1/cultural-rules/validate-recipe/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        recipeId,
        isCompliant: true,
        culturalBackground: 'hindu',
        violations: []
      });
    });
  });

  describe('Meal Planning', () => {
    let mealPlanId: string;

    it('should generate culturally compliant meal plan', async () => {
      const mealPlanData = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        culturalBackground: 'hindu',
        dosha: 'vata',
        dietaryRestrictions: ['vegetarian'],
        mealsPerDay: 3
      };

      const response = await request(app)
        .post('/api/v1/meal-plans/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mealPlanData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        mealPlan: {
          culturalBackground: 'hindu',
          dosha: 'vata',
          dietaryRestrictions: ['vegetarian']
        }
      });
      expect(response.body.mealPlan.meals).toBeDefined();
      expect(response.body.mealPlan.meals.length).toBeGreaterThan(0);
      mealPlanId = response.body.mealPlan.id;

      // Verify no red meat in meal plan
      const meals = response.body.mealPlan.meals;
      const allIngredients = meals.flatMap(meal => meal.ingredients || []);
      const hasRedMeat = allIngredients.some(ing =>
        ['beef', 'pork', 'lamb', 'veal'].includes(ing.name.toLowerCase())
      );
      expect(hasRedMeat).toBe(false);
    });

    it('should retrieve meal plans', async () => {
      const response = await request(app)
        .get('/api/v1/meal-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        mealPlans: expect.any(Array)
      });
    });

    it('should get meal plan statistics', async () => {
      const response = await request(app)
        .get('/api/v1/meal-plans/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        stats: expect.any(Object)
      });

      const stats = response.body.stats;
      expect(stats.totalMealPlans).toBeGreaterThan(0);
      expect(stats.culturalCompliance).toBeDefined();
    });
  });

  describe('Shopping Lists', () => {
    let shoppingListId: string;

    it('should generate shopping list from meal plan', async () => {
      const response = await request(app)
        .post('/api/v1/shopping-lists/from-meal-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mealPlanId })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        shoppingList: expect.any(Object)
      });
      shoppingListId = response.body.shoppingList.id;
    });

    it('should get shopping lists organized by retailer', async () => {
      const response = await request(app)
        .get('/api/v1/shopping-lists')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        shoppingLists: expect.any(Array)
      });
    });

    it('should organize items by retailers', async () => {
      const response = await request(app)
        .get(`/api/v1/shopping-lists/${shoppingListId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        shoppingList: {
          id: shoppingListId,
          items: expect.any(Array)
        }
      });

      // Verify items are organized by retailers
      const shoppingList = response.body.shoppingList;
      expect(shoppingList.retailerMapping).toBeDefined();
      const retailerMapping = shoppingList.retailerMapping;

      // Check at least one retailer has items
      const retailers = Object.keys(retailerMapping);
      expect(retailers.length).toBeGreaterThan(0);
    });
  });

  describe('Product Catalog & Retail Integration', () => {
    it('should get available retailers', async () => {
      const response = await request(app)
        .get('/api/v1/products/retailers')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        retailers: expect.any(Array)
      });

      // Verify all 4 retailers are present
      const retailers = response.body.retailers;
      const retailerNames = retailers.map(r => r.name);
      expect(retailerNames).toContain('Whole Foods Market');
      expect(retailerNames).toContain('Trader Joe\'s');
      expect(retailerNames).toContain('Kroger');
      expect(retailerNames).toContain('Walmart');
    });

    it('should search products', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({ query: 'lentils', category: 'grains' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        products: expect.any(Array),
        pagination: expect.any(Object)
      });
    });

    it('should get price comparison across retailers', async () => {
      const response = await request(app)
        .get('/api/v1/products/price-comparison')
        .query({
          productId: 'lentils-dal',
          retailers: ['whole-foods', 'trader-joes', 'kroger', 'walmart']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        priceComparison: expect.any(Object)
      });

      // Verify price comparison has all retailers
      const priceComparison = response.body.priceComparison;
      expect(priceComparison.retailers).toBeDefined();
    });

    it('should get cultural product substitutes', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/substitutions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          ingredient: 'beef',
          culturalBackground: 'hindu'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        ingredient: 'beef',
        culturalBackground: 'hindu',
        substitutes: expect.any(Array)
      });

      // Verify substitutes are culturally appropriate
      const substitutes = response.body.substitutes;
      expect(substitutes.length).toBeGreaterThan(0);
      substitutes.forEach(sub => {
        expect(sub.cultural).toBe(true);
        expect(sub.dietaryType).toBe('vegetarian');
      });
    });
  });

  describe('Error Handling and Security', () => {
    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('unauthorized')
      });
    });

    it('should validate input data', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.any(Array)
      });
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousInput = {
        email: "test'; DROP TABLE users; --",
        password: 'SecurePass123!',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousInput)
        .expect(400); // Should be caught by validation

      expect(response.body.errors).toBeDefined();
    });

    it('should handle XSS attempts', async () => {
      const xssInput = {
        email: 'test@culturaldiet.com',
        password: 'SecurePass123!',
        name: '<script>alert("xss")</script>'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(xssInput)
        .expect(400); // Should be caught by validation
    });
  });
});