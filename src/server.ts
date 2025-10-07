import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authenticate, optionalAuth } from './middleware/auth.middleware';
import { validateRequest } from './middleware/validation.middleware';

// Import controllers
import { UserController } from './controllers/user.controller';
import { RecipeController } from './controllers/recipe.controller';
import { MealPlanController } from './controllers/meal-plan.controller';
import { mealPlanController as enhancedMealPlanController } from './controllers/MealPlanController';
import { shareController } from './controllers/ShareController';
import { ShoppingListController } from './controllers/shopping-list.controller';
import { ProductCatalogController } from './controllers/product-catalog.controller';
import { CulturalRulesController } from './controllers/cultural-rules.controller';

// Import configurations
import { userValidationSchema } from './utils/validation';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize controllers
const userController = new UserController();
const recipeController = new RecipeController();
const mealPlanController = new MealPlanController();
const shoppingListController = new ShoppingListController();
const productCatalogController = new ProductCatalogController();
const culturalRulesController = new CulturalRulesController();

// Security and general middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for HTML pages
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"], // Allow fetch/XHR to same origin
    },
  },
}));
app.use(cors({
  origin: true, // Allow all origins for local development
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from build directory with proper caching
app.use(express.static(path.join(__dirname, '../build'), {
  setHeaders: (res, filepath) => {
    // Don't cache HTML files to ensure CSP updates are picked up
    if (filepath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Redirect root to login page with cache-busting
app.get('/', (_req, res) => {
  // Add timestamp to bust Safari's aggressive caching
  res.redirect(`/login.html?v=${Date.now()}`);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Cultural Diet API',
    version: '1.0.0'
  });
});

// API routes
const apiRouter = express.Router();

// User authentication routes
apiRouter.post('/auth/register',
  validateRequest(userValidationSchema.create),
  userController.register
);

apiRouter.post('/auth/login',
  validateRequest(userValidationSchema.login),
  userController.login
);

apiRouter.post('/auth/refresh',
  userController.refreshToken
);

// User profile routes
apiRouter.get('/users/profile',
  authenticate,
  userController.getProfile
);

apiRouter.put('/users/profile',
  authenticate,
  validateRequest(userValidationSchema.update),
  userController.updateProfile
);

apiRouter.post('/users/change-password',
  authenticate,
  userController.changePassword
);

apiRouter.delete('/users/account',
  authenticate,
  userController.deleteAccount
);

// Recipe routes
apiRouter.get('/recipes',
  optionalAuth,
  recipeController.search
);

apiRouter.get('/recipes/favorites',
  authenticate,
  recipeController.getFavorites
);

apiRouter.get('/recipes/:id',
  optionalAuth,
  recipeController.getById
);

apiRouter.post('/recipes',
  authenticate,
  recipeController.create
);

apiRouter.post('/recipes/:id/favorite',
  authenticate,
  recipeController.addToFavorites
);

apiRouter.delete('/recipes/:id/favorite',
  authenticate,
  recipeController.removeFromFavorites
);

apiRouter.post('/recipes/:id/rate',
  authenticate,
  recipeController.rateRecipe
);

// Meal planning routes
apiRouter.post('/meal-plans/generate',
  authenticate,
  mealPlanController.generateMealPlan
);

apiRouter.get('/meal-plans',
  authenticate,
  mealPlanController.getMealPlans
);

apiRouter.get('/meal-plans/stats',
  authenticate,
  mealPlanController.getMealPlanStats
);

apiRouter.get('/meal-plans/:date',
  authenticate,
  mealPlanController.getMealPlanByDate
);

apiRouter.put('/meal-plans/:date',
  authenticate,
  mealPlanController.updateMeal
);

apiRouter.delete('/meal-plans/:date',
  authenticate,
  mealPlanController.deleteMealPlan
);

// Enhanced Meal Plan Generation routes (new algorithm)
apiRouter.post('/meal-plans/weekly/generate',
  authenticate,
  (req, res) => enhancedMealPlanController.generateMealPlan(req, res)
);

apiRouter.get('/meal-plans/weekly/:id',
  authenticate,
  (req, res) => enhancedMealPlanController.getMealPlan(req, res)
);

apiRouter.get('/meal-plans/weekly/user/:userId',
  authenticate,
  (req, res) => enhancedMealPlanController.getUserMealPlans(req, res)
);

apiRouter.put('/meal-plans/weekly/:id/status',
  authenticate,
  (req, res) => enhancedMealPlanController.updateMealPlanStatus(req, res)
);

apiRouter.delete('/meal-plans/weekly/:id',
  authenticate,
  (req, res) => enhancedMealPlanController.deleteMealPlan(req, res)
);

apiRouter.put('/meal-plans/items/:itemId/recipe',
  authenticate,
  (req, res) => enhancedMealPlanController.swapRecipe(req, res)
);

apiRouter.put('/meal-plans/items/:itemId/complete',
  authenticate,
  (req, res) => enhancedMealPlanController.completeMeal(req, res)
);

// Meal Plan Export and Share routes
apiRouter.post('/meal-plans/:id/export',
  authenticate,
  (req, res) => shareController.exportMealPlan(req, res)
);

apiRouter.post('/meal-plans/:id/share',
  authenticate,
  (req, res) => shareController.generateShareLink(req, res)
);

// Shared meal plan (NO AUTH REQUIRED)
apiRouter.get('/shared/:shareToken',
  (req, res) => shareController.getSharedMealPlan(req, res)
);

// Shopping list routes
apiRouter.post('/shopping-lists',
  authenticate,
  shoppingListController.createShoppingList
);

apiRouter.get('/shopping-lists',
  authenticate,
  shoppingListController.getShoppingLists
);

apiRouter.get('/shopping-lists/stats',
  authenticate,
  shoppingListController.getShoppingStats
);

apiRouter.get('/shopping-lists/:id',
  authenticate,
  shoppingListController.getShoppingListById
);

apiRouter.put('/shopping-lists/:id',
  authenticate,
  shoppingListController.updateShoppingList
);

apiRouter.post('/shopping-lists/:id/items',
  authenticate,
  shoppingListController.addToList
);

apiRouter.delete('/shopping-lists/:id/items/:itemId',
  authenticate,
  shoppingListController.removeFromList
);

apiRouter.patch('/shopping-lists/:id/items/:itemId',
  authenticate,
  shoppingListController.updateItemStatus
);

apiRouter.post('/shopping-lists/from-meal-plan',
  authenticate,
  shoppingListController.generateFromMealPlan
);

apiRouter.delete('/shopping-lists/:id',
  authenticate,
  shoppingListController.deleteShoppingList
);

// Product catalog routes
apiRouter.get('/products',
  optionalAuth,
  productCatalogController.searchProducts
);

apiRouter.get('/products/retailers',
  productCatalogController.getRetailers
);

apiRouter.get('/products/categories',
  productCatalogController.getCategories
);

apiRouter.get('/products/brands',
  productCatalogController.getBrands
);

apiRouter.get('/products/price-comparison',
  productCatalogController.priceComparison
);

apiRouter.get('/products/:retailer/:sku',
  optionalAuth,
  productCatalogController.getProduct
);

// Cultural rules routes
apiRouter.get('/cultural-rules',
  culturalRulesController.getAllRules
);

apiRouter.post('/cultural-rules',
  culturalRulesController.createRule
);

apiRouter.put('/cultural-rules/:id',
  culturalRulesController.updateRule
);

apiRouter.delete('/cultural-rules/:id',
  culturalRulesController.deleteRule
);

apiRouter.get('/cultural-rules/stats',
  culturalRulesController.getRuleStatistics
);

apiRouter.get('/cultural-rules/forbidden-ingredients',
  culturalRulesController.getForbiddenIngredients
);

apiRouter.post('/cultural-rules/validate-recipe/:recipeId',
  authenticate,
  culturalRulesController.validateRecipe
);

apiRouter.post('/cultural-rules/validate-ingredient',
  authenticate,
  culturalRulesController.validateIngredient
);

apiRouter.get('/cultural-rules/substitutions',
  authenticate,
  culturalRulesController.getSubstitutions
);

apiRouter.get('/cultural-rules/ayurvedic-recommendations',
  authenticate,
  culturalRulesController.getAyurvedicRecommendations
);

apiRouter.get('/cultural-rules/hindu-dietary-guidance',
  authenticate,
  culturalRulesController.getHinduDietaryGuidance
);

// API v1 routes
app.use('/api/v1', apiRouter);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Cultural Diet API Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n📝 Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;