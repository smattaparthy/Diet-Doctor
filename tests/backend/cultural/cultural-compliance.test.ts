import request from 'supertest';
import app from '../../src/server';

describe('Cultural Compliance Testing Suite', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Register and login a test user for cultural testing
    const userData = {
      email: 'cultural-test@culturaldiet.com',
      password: 'SecurePass123!',
      name: 'Cultural Test User',
      culturalBackground: 'hindu',
      dosha: 'pitta'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    testUserId = registerResponse.body.user.id;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(200);

    authToken = loginResponse.body.token;
  });

  describe('Hindu Dietary Compliance', () => {
    it('should strictly enforce no red meat restriction', async () => {
      const redMeats = ['beef', 'pork', 'lamb', 'veal', 'mutton'];

      for (const meat of redMeats) {
        const response = await request(app)
          .post('/api/v1/cultural-rules/validate-ingredient')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ingredient: meat,
            culturalBackground: 'hindu'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          isAllowed: false,
          culturalBackground: 'hindu',
          ingredient: meat,
          reason: expect.stringContaining('forbidden')
        });
      }
    });

    it('should allow traditional Hindu foods', async () => {
      const hinduFoods = ['lentils', 'rice', 'vegetables', 'ghee', 'yogurt', 'paneer'];

      for (const food of hinduFoods) {
        const response = await request(app)
          .post('/api/v1/cultural-rules/validate-ingredient')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ingredient: food,
            culturalBackground: 'hindu'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          isAllowed: true,
          culturalBackground: 'hindu',
          ingredient: food
        });
      }
    });

    it('should provide appropriate substitutes for forbidden meats', async () => {
      const substitutes = [
        { forbidden: 'beef', allowed: ['lentils', 'paneer', 'chickpeas'] },
        { forbidden: 'pork', allowed: ['tofu', 'tempeh', 'seitan'] },
        { forbidden: 'lamb', allowed: ['mushrooms', 'jackfruit', 'soy chunks'] }
      ];

      for (const test of substitutes) {
        const response = await request(app)
          .get('/api/v1/cultural-rules/substitutions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            ingredient: test.forbidden,
            culturalBackground: 'hindu'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          ingredient: test.forbidden,
          culturalBackground: 'hindu',
          substitutes: expect.any(Array)
        });

        // Verify substitutes are vegetarian and culturally appropriate
        const substitutes = response.body.substitutes;
        expect(substitutes.length).toBeGreaterThan(0);
        substitutes.forEach(sub => {
          expect(sub.dietaryType).toBe('vegetarian');
          expect(sub.cultural).toBe(true);
        });
      }
    });

    it('should validate complete recipes for Hindu compliance', async () => {
      // Create a recipe with beef (should fail validation)
      const invalidRecipe = {
        title: 'Beef Curry',
        ingredients: [
          { name: 'beef', quantity: '500g' },
          { name: 'onions', quantity: '2 medium' },
          { name: 'spices', quantity: 'to taste' }
        ],
        culturalBackground: 'hindu'
      };

      let response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRecipe)
        .expect(400); // Should fail validation

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('forbidden')
          })
        ])
      });

      // Create a valid Hindu recipe
      const validRecipe = {
        title: 'Dal Tadka',
        ingredients: [
          { name: 'lentils', quantity: '1 cup' },
          { name: 'onions', quantity: '2 medium' },
          { name: 'tomatoes', quantity: '2 medium' },
          { name: 'spices', quantity: 'to taste' }
        ],
        culturalBackground: 'hindu'
      };

      response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRecipe)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        recipe: {
          title: 'Dal Tadka',
          culturalBackground: 'hindu'
        }
      });

      // Validate the recipe is culturally compliant
      await request(app)
        .post(`/api/v1/cultural-rules/validate-recipe/${response.body.recipe.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Ayurvedic Dosha Compliance', () => {
    it('should provide Vata-pacifying recommendations', async () => {
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
      const foodRecommendations = recommendations.filter(r => r.category === 'foods');

      // Vata should get warming foods
      const warmingFoods = foodRecommendations.some(r =>
        r.items.some(item =>
          ['ginger', 'cinnamon', 'nuts', 'seeds'].some(warm =>
            item.name.toLowerCase().includes(warm)
          )
        )
      );
      expect(warmingFoods).toBe(true);
    });

    it('should provide Pitta-pacifying recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/ayurvedic-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dosha: 'pitta' })
        .expect(200);

      const recommendations = response.body.recommendations;
      const foodRecommendations = recommendations.filter(r => r.category === 'foods');

      // Pitta should get cooling foods
      const coolingFoods = foodRecommendations.some(r =>
        r.items.some(item =>
          ['cucumber', 'coconut', 'cilantro', 'mint'].some(cool =>
            item.name.toLowerCase().includes(cool)
          )
        )
      );
      expect(coolingFoods).toBe(true);
    });

    it('should provide Kapha-pacifying recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules/ayurvedic-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dosha: 'kapha' })
        .expect(200);

      const recommendations = response.body.recommendations;
      const foodRecommendations = recommendations.filter(r => r.category === 'foods');

      // Kapha should get light, stimulating foods
      const lightFoods = foodRecommendations.some(r =>
        r.items.some(item =>
          ['spices', 'light', 'warming'].some(light =>
            item.description.toLowerCase().includes(light)
          )
        )
      );
      expect(lightFoods).toBe(true);
    });

    it('should balance doshas in meal planning', async () => {
      const mealPlanData = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        culturalBackground: 'hindu',
        dosha: 'pitta',
        dietaryRestrictions: ['vegetarian']
      };

      const response = await request(app)
        .post('/api/v1/meal-plans/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mealPlanData)
        .expect(201);

      const mealPlan = response.body.mealPlan;
      expect(mealPlan.doshaBalancing).toBeDefined();
      expect(mealPlan.doshaBalancing.length).toBeGreaterThan(0);

      // Verify meal plan includes dosha-balancing ingredients
      const allIngredients = mealPlan.meals.flatMap(meal => meal.ingredients || []);
      const balancingIngredients = allIngredients.filter(ing =>
        ing.doshaBalancing && ing.doshaBalancing.includes('pitta')
      );
      expect(balancingIngredients.length).toBeGreaterThan(0);
    });
  });

  describe('Traditional Medicine Guidelines', () => {
    it('should provide Unani dietary recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/cultural-rules')
        .query({ system: 'unani' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        rules: expect.any(Array)
      });

      const unaniRules = response.body.rules.filter(rule =>
        rule.system === 'unani'
      );
      expect(unaniRules.length).toBeGreaterThan(0);

      // Verify Unani temperament principles
      const temperamentRules = unaniRules.filter(rule =>
        rule.category === 'temperament'
      );
      expect(temperamentRules.length).toBeGreaterThan(0);
    });

    it('should incorporate seasonal dietary recommendations', async () => {
      const winterRecommendations = await request(app)
        .get('/api/v1/cultural-rules/ayurvedic-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          dosha: 'vata',
          season: 'winter'
        })
        .expect(200);

      expect(winterRecommendations.body.recommendations).toBeDefined();

      // Winter should emphasize warming, nourishing foods
      const recommendations = winterRecommendations.body.recommendations;
      const seasonalFoods = recommendations.some(r =>
        r.items.some(item =>
          ['soup', 'stew', 'root', 'warming'].some(winter =>
            item.description.toLowerCase().includes(winter)
          )
        )
      );
      expect(seasonalFoods).toBe(true);
    });
  });

  describe('Cultural Authenticity Validation', () => {
    it('should validate traditional cooking methods', async () => {
      const authenticRecipe = {
        title: 'Traditional Ayurvedic Kitchari',
        description: 'Traditional Ayurvedic healing dish',
        ingredients: [
          { name: 'basmati rice', quantity: '1/2 cup', cultural: true },
          { name: 'mung dal', quantity: '1/2 cup', cultural: true },
          { name: 'ghee', quantity: '1 tbsp', cultural: true },
          { name: 'ginger', quantity: '1 tsp', cultural: true },
          { name: 'turmeric', quantity: '1/2 tsp', cultural: true },
          { name: 'cumin', quantity: '1 tsp', cultural: true }
        ],
        instructions: 'Traditional Ayurvedic cooking method with proper spice sequencing',
        cuisine: 'ayurvedic',
        culturalBackground: 'hindu',
        cookingMethod: 'traditional',
        authenticityScore: 95
      };

      const response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(authenticRecipe)
        .expect(201);

      expect(response.body.recipe.authenticityScore).toBeGreaterThanOrEqual(90);
    });

    it('should identify cultural appropriation vs appreciation', async () => {
      const appropriationRecipe = {
        title: 'Fusion "Ayurvedic" Burger',
        ingredients: [
          { name: 'beef patty', quantity: '1', cultural: false }, // Red meat in Hindu recipe
          { name: 'cheese', quantity: '1 slice', cultural: false },
          { name: 'ketchup', quantity: '2 tbsp', cultural: false }
        ],
        cuisine: 'fusion',
        culturalBackground: 'hindu',
        authenticityScore: 10
      });

      const response = await request(app)
        .post('/api/v1/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appropriationRecipe);

      // Should fail validation due to cultural inauthenticity
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Cross-Cultural Dietary Guidelines', () => {
    it('should handle multiple cultural preferences', async () => {
      const multiCulturalUser = {
        email: 'multi-cultural@culturaldiet.com',
        password: 'SecurePass123!',
        name: 'Multi Cultural User',
        culturalBackground: 'mixed',
        dietaryRestrictions: ['hindu-vegetarian', 'halal', 'gluten-free'],
        dosha: 'vata'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(multiCulturalUser)
        .expect(201);

      expect(response.body.user.dietaryRestrictions).toEqual(
        ['hindu-vegetarian', 'halal', 'gluten-free']
      );
    });

    it('should provide appropriate product recommendations across cultures', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          dietaryRestrictions: 'hindu-vegetarian,halal,gluten-free',
          culturalPreferences: 'ayurvedic,traditional'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        products: expect.any(Array)
      });

      // Verify products meet all dietary requirements
      if (response.body.products.length > 0) {
        const products = response.body.products;
        products.forEach(product => {
          expect(product.dietaryInfo).toBeDefined();
          expect(product.dietaryInfo.vegetarian).toBe(true);
          expect(product.dietaryInfo.halalCertified).toBe(true);
          expect(product.dietaryInfo.glutenFree).toBe(true);
        });
      }
    });
  });
});