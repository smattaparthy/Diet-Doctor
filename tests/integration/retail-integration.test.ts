import request from 'supertest';
import app from '../../src/server';

describe('Retail Integration Testing Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup authenticated user for testing
    const userData = {
      email: 'retail-test@culturaldiet.com',
      password: 'SecurePass123!',
      name: 'Retail Test User',
      culturalBackground: 'hindu'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.token;
  });

  describe('Retail Partner Integration', () => {
    it('should return all 4 major retailers', async () => {
      const response = await request(app)
        .get('/api/v1/products/retailers')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        retailers: expect.any(Array)
      });

      const retailers = response.body.retailers;
      expect(retailers.length).toBeGreaterThanOrEqual(4);

      const retailerNames = retailers.map((r: { name: string }) => r.name);
      expect(retailerNames).toContain('Whole Foods Market');
      expect(retailerNames).toContain('Trader Joe\'s');
      expect(retailerNames).toContain('Kroger');
      expect(retailerNames).toContain('Walmart');
    });

    it('should provide retailer-specific product mapping', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          query: 'lentils',
          retailers: ['whole-foods', 'trader-joes', 'kroger', 'walmart']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        products: expect.any(Array)
      });

      if (response.body.products.length > 0) {
        const products = response.body.products;
        products.forEach((product: { retailer: string; cultural_tags: string[] }) => {
          expect(['whole-foods', 'trader-joes', 'kroger', 'walmart']).toContain(product.retailer);
          expect(product.cultural_tags).toBeDefined();
        });
      }
    });

    it('should handle price comparison across retailers', async () => {
      const response = await request(app)
        .get('/api/v1/products/price-comparison')
        .query({
          productId: 'lentils-brown',
          retailers: ['whole-foods', 'trader-joes', 'kroger', 'walmart']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        priceComparison: expect.any(Object)
      });

      const priceComparison = response.body.priceComparison;
      expect(priceComparison.retailers).toBeDefined();
      expect(priceComparison.averagePrice).toBeDefined();
    });
  });

  describe('Cultural Product Compliance', () => {
    it('should filter products by cultural requirements', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          culturalBackground: 'hindu',
          dietaryRestrictions: 'vegetarian',
          query: 'protein'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        products: expect.any(Array)
      });

      if (response.body.products.length > 0) {
        const products = response.body.products;
        products.forEach((product: { dietary_certifications: string[] }) => {
          expect(product.dietary_certifications).toContain('vegetarian');
        });
      }
    });

    it('should provide culturally appropriate substitutions', async () => {
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

      const substitutes = response.body.substitutes;
      expect(substitutes.length).toBeGreaterThan(0);

      substitutes.forEach((substitute: {
        name: string;
        dietary_certifications: string[];
        cultural: boolean;
      }) => {
        expect(substitute.dietary_certifications).toContain('vegetarian');
        expect(substitute.cultural).toBe(true);
      });
    });

    it('should ensure no non-compliant products in Hindu searches', async () => {
      const searchTerms = ['meat', 'protein', 'main-course'];

      for (const term of searchTerms) {
        const response = await request(app)
          .get('/api/v1/products')
          .query({
            query: term,
            culturalBackground: 'hindu'
          })
          .expect(200);

        if (response.body.products.length > 0) {
          const products = response.body.products;
          const nonCompliantProducts = products.filter((product: {
            dietary_certifications: string[];
            name: string;
          }) => {
            const isVegetarian = product.dietary_certifications.includes('vegetarian');
            const containsRedMeat = ['beef', 'pork', 'lamb', 'veal'].some(meat =>
              product.name.toLowerCase().includes(meat)
            );
            return !isVegetarian || containsRedMeat;
          });

          expect(nonCompliantProducts.length).toBe(0);
        }
      }
    });
  });

  describe('Shopping List Integration', () => {
    let shoppingListId: string;

    it('should organize shopping items by retailer', async () => {
      // First create a simple meal plan
      const mealPlanData = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        culturalBackground: 'hindu',
        dietaryRestrictions: ['vegetarian']
      };

      const mealPlanResponse = await request(app)
        .post('/api/v1/meal-plans/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mealPlanData)
        .expect(201);

      // Generate shopping list from meal plan
      const response = await request(app)
        .post('/api/v1/shopping-lists/from-meal-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mealPlanId: mealPlanResponse.body.mealPlan.id })
        .expect(201);

      shoppingListId = response.body.shoppingList.id;

      expect(response.body).toMatchObject({
        success: true,
        shoppingList: expect.any(Object)
      });

      const shoppingList = response.body.shoppingList;
      expect(shoppingList.retailerMapping).toBeDefined();
    });

    it('should provide retailer-specific shopping lists', async () => {
      const response = await request(app)
        .get(`/api/v1/shopping-lists/${shoppingListId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        shoppingList: expect.any(Object)
      });

      const shoppingList = response.body.shoppingList;
      expect(shoppingList.retailerMapping).toBeDefined();

      const retailerMapping = shoppingList.retailerMapping;
      const retailers = Object.keys(retailerMapping);
      expect(retailers.length).toBeGreaterThan(0);
    });

    it('should include price comparison in shopping lists', async () => {
      const response = await request(app)
        .get('/api/v1/products/price-comparison')
        .query({
          products: 'lentils,rice,vegetables',
          retailers: ['whole-foods', 'trader-joes', 'kroger', 'walmart']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        priceComparison: expect.any(Object)
      });

      const priceComparison = response.body.priceComparison;
      expect(priceComparison.totalCostRange).toBeDefined();
      expect(priceComparison.bestValue).toBeDefined();
    });
  });

  describe('Product Data Quality', () => {
    it('should maintain consistent cultural tagging across retailers', async () => {
      const productName = 'lentils';
      const response = await request(app)
        .get('/api/v1/products')
        .query({ query: productName })
        .expect(200);

      if (response.body.products.length > 0) {
        const products = response.body.products;
        const culturalTags = new Set();

        products.forEach((product: { cultural_tags: string[] }) => {
          product.cultural_tags.forEach((tag: string) => culturalTags.add(tag));
        });

        expect(culturalTags.size).toBeGreaterThan(0);
        expect(culturalTags.has('vegetarian')).toBe(true);
        expect(culturalTags.has('hindu-friendly')).toBe(true);
      }
    });

    it('should validate dietary certifications', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({ dietaryRestrictions: 'vegetarian' })
        .expect(200);

      if (response.body.products.length > 0) {
        const products = response.body.products;
        products.forEach((product: { dietary_certifications: string[] }) => {
          expect(product.dietary_certifications).toContain('vegetarian');
        });
      }
    });

    it('should provide complete product metadata', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({ limit: 5 })
        .expect(200);

      if (response.body.products.length > 0) {
        const products = response.body.products;
        products.forEach((product: {
          id: string;
          name: string;
          retailer: string;
          price: number;
          dietary_certifications: string[];
          cultural_tags: string[];
        }) => {
          expect(product.id).toBeDefined();
          expect(product.name).toBeDefined();
          expect(product.retailer).toBeDefined();
          expect(product.price).toBeGreaterThan(0);
          expect(product.dietary_certifications).toBeDefined();
          expect(product.cultural_tags).toBeDefined();
        });
      }
    });
  });

  describe('Retailer API Integration Errors', () => {
    it('should handle unavailable retailers gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          retailers: ['non-existent-retailer'],
          query: 'lentils'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('retailer')
      });
    });

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          query: 'non-existent-product-xyz123',
          limit: 1
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        products: []
      });
    });

    it('should validate retailer availability', async () => {
      const response = await request(app)
        .get('/api/v1/products/retailers')
        .expect(200);

      const retailers = response.body.retailers;
      retailers.forEach((retailer: { id: string; name: string; available: boolean }) => {
        expect(retailer.id).toBeDefined();
        expect(retailer.name).toBeDefined();
        expect(typeof retailer.available).toBe('boolean');
      });
    });
  });

  describe('Cultural-Retail Integration Validation', () => {
    it('should prevent search for culturally inappropriate products', async () => {
      const culturallyInappropriateSearches = ['beef', 'pork', 'lamb'];

      for (const searchTerm of culturallyInappropriateSearches) {
        const response = await request(app)
          .get('/api/v1/products')
          .query({
            query: searchTerm,
            culturalBackground: 'hindu'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('cultural')
        });
      }
    });

    it('should prioritize culturally suitable products in search results', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .query({
          query: 'protein',
          culturalBackground: 'hindu'
        })
        .expect(200);

      if (response.body.products.length > 0) {
        const products = response.body.products;
        const culturallySuitableCount = products.filter((product: {
          cultural_tags: string[];
        }) => product.cultural_tags.includes('hindu-friendly')).length;

        // At least 50% should be culturally suitable
        const suitablePercentage = (culturallySuitableCount / products.length) * 100;
        expect(suitablePercentage).toBeGreaterThanOrEqual(50);
      }
    });
  });
});