import {
  test, expect, chromium, BrowserContext, Page
} from '@playwright/test';

describe('Cultural Diet - Complete User Journey Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let userEmail: string;

  test.beforeAll(async () => {
    // Setup browser with proper viewport
    context = await chromium.launchPersistentContext('', {
      viewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Generate unique user email
    userEmail = `test-${Date.now()}@culturaldiet.com`;
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Cultural Hindu User Complete Journey', () => {
    test('should successfully onboard Hindu user with dosha preferences', async () => {
      page = await context.newPage();

      // Navigate to application
      await page.goto('http://localhost:3000');

      // Test if we can see the app
      const title = await page.title();
      expect(title).toContain('Cultural Diet');

      // Start onboarding - Cultural Background Selection
      await page.click('[data-testid="select-cultural-background"]');
      await page.click('[data-testid="hindu-option"]');
      await page.click('[data-testid="continue-cultural"]');

      // Dosha Questionnaire
      await page.click('[data-testid="dosha-question-vata-yes"]');
      await page.click('[data-testid="dosha-question-pitta-maybe"]');
      await page.click('[data-testid="dosha-question-kapha-no"]');
      await page.click('[data-testid="continue-dosha"]');

      // Dietary Restrictions
      await page.click('[data-testid="restriction-vegetarian"]');
      await page.click('[data-testid="restriction-gluten-free"]');
      await page.click('[data-testid="continue-restrictions"]');

      // Cuisine Preferences
      await page.click('[data-testid="cuisine-north-indian"]');
      await page.click('[data-testid="cuisine-south-indian"]');
      await page.click('[data-testid="continue-cuisine"]');

      // Account Creation
      await page.fill('[data-testid="name-input"]', 'Hindu Test User');
      await page.fill('[data-testid="email-input"]', userEmail);
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.click('[data-testid="create-account"]');

      // Wait for dashboard
      await page.waitForSelector('[data-testid="dashboard"]');

      // Verify cultural preferences saved
      const savedBackground = await page.textContent('[data-testid="cultural-background"]');
      expect(savedBackground).toContain('Hindu');

      const savedDosha = await page.textContent('[data-testid="user-dosha"]');
      expect(savedDosha).toContain('Pitta');
    });

    test('should generate culturally appropriate meal plan', async () => {
      // Navigate to meal planning
      await page.click('[data-testid="meal-planning"]');
      await page.click('[data-testid="generate-meal-plan"]');

      // Configure meal plan
      await page.selectOption('[data-testid="plan-duration"]', '7');
      await page.click('[data-testid="breakfast-included"]');
      await page.click('[data-testid="lunch-included"]');
      await page.click('[data-testid="dinner-included"]');
      await page.click('[data-testid="generate-plan"]');

      // Wait for meal plan generation
      await page.waitForSelector('[data-testid="meal-plan-results"]');

      // Verify cultural compliance
      const meals = await page.locator('[data-testid="meal-item"]').count();
      expect(meals).toBeGreaterThan(0);

      // Check for cultural compliance warnings
      const warnings = await page.locator('[data-testid="cultural-warning"]').count();
      expect(warnings).toBe(0);
    });

    test('should validate no red meat in meal plan', async () => {
      // Get all meal items
      const mealItems = await page.locator('[data-testid="meal-ingredients"]').all();

      let redMeatFound = false;
      const redMeats = ['beef', 'pork', 'lamb', 'veal'];

      for (const mealItem of mealItems) {
        const ingredients = await mealItem.textContent();
        if (redMeats.some(meat => ingredients.toLowerCase().includes(meat))) {
          redMeatFound = true;
          break;
        }
      }

      expect(redMeatFound).toBe(false);
    });

    test('should create shopping list with retailer organization', async () => {
      // Navigate to shopping lists
      await page.click('[data-testid="shopping-lists"]');
      await page.click('[data-testid="create-from-meal-plan"]');

      // Select meal plan
      await page.click('[data-testid="select-meal-plan"]');
      await page.click('[data-testid="generate-shopping-list"]');

      // Wait for shopping list generation
      await page.waitForSelector('[data-testid="shopping-list-generated"]');

      // Verify retailer organization
      const retailers = await page.locator('[data-testid="retailer-section"]').count();
      expect(retailers).toBeGreaterThan(0);

      // Check for major retailers
      const wholeFoods = await page.locator('[data-testid="retailer-whole-foods"]').count();
      const traderJoes = await page.locator('[data-testid="retailer-trader-joes"]').count();
      const kroger = await page.locator('[data-testid="retailer-kroger"]').count();
      const walmart = await page.locator('[data-testid="retailer-walmart"]').count();

      expect(wholeFoods + traderJoes + kroger + walmart).toBeGreaterThan(0);
    });

    test('should browse culturally appropriate recipes', async () => {
      // Navigate to recipes
      await page.click('[data-testid="recipes"]');

      // Apply cultural filters
      await page.click('[data-testid="filter-cultural-background"]');
      await page.check('[data-testid="filter-hindu"]');
      await page.click('[data-testid="apply-filters"]');

      // Verify all recipes are culturally appropriate
      const recipes = await page.locator('[data-testid="recipe-card"]').all();

      for (const recipe of recipes) {
        const culturalTag = await recipe.locator('[data-testid="recipe-cultural-tag"]').textContent();
        expect(culturalTag).toContain('Hindu-friendly');

        // Check for warnings about prohibited ingredients
        const warnings = await recipe.locator('[data-testid="cultural-warning"]').count();
        expect(warnings).toBe(0);
      }
    });

    test('should validate individual recipe ingredients', async () => {
      // Click on a recipe
      await page.locator('[data-testid="recipe-card"]').first().click();

      await page.waitForSelector('[data-testid="recipe-details"]');

      // Check ingredient validation
      const ingredients = await page.locator('[data-testid="recipe-ingredient"]').all();

      for (const ingredient of ingredients) {
        const status = await ingredient.locator('[data-testid="ingredient-status"]').textContent();
        expect(status).toBe('Culturally Approved');
      }
    });
  });

  test.describe('Ayurvedic Dosha Specific Journey', () => {
    test('should provide Vata-pacifying recommendations', async () => {
      // Navigate to Ayurvedic recommendations
      await page.click('[data-testid="ayurvedic-guide"]');
      await page.selectOption('[data-testid="dosha-selector"]', 'vata');
      await page.click('[data-testid="get-recommendations"]');

      // Wait for recommendations
      await page.waitForSelector('[data-testid="dosha-recommendations"]');

      // Verify Vata-specific recommendations
      const warmingFoods = await page.locator('[data-testid="warming-food-category"]').count();
      expect(warmingFoods).toBeGreaterThan(0);

      // Check for specific Vata recommendations
      const recommendations = await page.locator('[data-testid="recommendation-item"]').all();
      let vataSpecificFound = false;

      for (const recommendation of recommendations) {
        const text = await recommendation.textContent();
        if (text.toLowerCase().includes('warming') ||
            text.toLowerCase().includes('grounding') ||
            text.toLowerCase().includes('ginger') ||
            text.toLowerCase().includes('nuts')) {
          vataSpecificFound = true;
          break;
        }
      }

      expect(vataSpecificFound).toBe(true);
    });

    test('should adjust meal plan based on dosha', async () => {
      // Go back to meal planning
      await page.click('[data-testid="meal-planning"]');

      // Create new meal plan with dosha focus
      await page.click('[data-testid="new-meal-plan"]');
      await page.check('[data-testid="vata-focused"]');
      await page.check('[data-testid="seasonal-adjustment"]');
      await page.click('[data-testid="generate-with-dosha"]');

      await page.waitForSelector('[data-testid="meal-plan-results"]');

      // Verify dosha-balancing ingredients
      const mealItems = await page.locator('[data-testid="meal-item"]').all();
      let vataBalancingFound = false;

      for (const mealItem of mealItems) {
        const properties = await mealItem.locator('[data-testid="vata-balancing"]').count();
        if (properties > 0) {
          vataBalancingFound = true;
          break;
        }
      }

      expect(vataBalancingFound).toBe(true);
    });
  });

  test.describe('Cross-Platform Functionality', () => {
    test('should maintain cultural compliance across screen sizes', async () => {
      const viewports = [
        { width: 375, height: 667 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1280, height: 720 }  // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.reload();

        // Verify cultural warning system works
        await page.click('[data-testid="recipes"]');
        await page.waitForSelector('[data-testid="recipe-list"]');

        // Cultural compliance should be preserved
        const culturalWarnings = await page.locator('[data-testid="cultural-warning"]').count();
        expect(culturalWarnings).toBe(0);
      }
    });
  });

  test.describe('Error Handling Edge Cases', () => {
    test('should gracefully handle invalid cultural combinations', async () => {
      // Try to create impossible cultural combination
      await page.click('[data-testid="settings"]');
      await page.click('[data-testid="cultural-preferences"]');

      // Try to add conflicting preferences
      await page.check('[data-testid="preference-hindu"]');
      await page.check('[data-testid="preference-non-vegetarian"]');
      await page.click('[data-testid="save-preferences"]');

      // Should show validation message
      await page.waitForSelector('[data-testid="validation-message"]');
      const message = await page.textContent('[data-testid="validation-message"]');
      expect(message).toContain('incompatible');
    });

    test('should maintain cultural compliance when API fails', async () => {
      // Mock network failure
      await page.route('**/api/v1/recipes', route => route.abort());

      // Try to browse recipes
      await page.click('[data-testid="recipes"]');

      // Should show user-friendly error message
      await page.waitForSelector('[data-testid="error-message"]');
      const error = await page.textContent('[data-testid="error-message"]');
      expect(error).toContain('Unable to load recipes');

      // Should maintain cultural integrity
      await page.unroute('**/api/v1/recipes');
    });
  });
});