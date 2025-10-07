import { Request, Response } from 'express';
import { ShoppingListRepository, ProductCatalogRepository, MealPlanRepository } from '../repositories';
import { ShoppingList, ShoppingListRow, Retailer, RetailerGroup, RecipeIngredient } from '../types';
import { NotFoundError } from '../utils/errors';

export class ShoppingListController {
  private shoppingListRepo: ShoppingListRepository;
  private productCatalogRepo: ProductCatalogRepository;
  private mealPlanRepo: MealPlanRepository;

  constructor() {
    this.shoppingListRepo = new ShoppingListRepository();
    this.productCatalogRepo = new ProductCatalogRepository();
    this.mealPlanRepo = new MealPlanRepository();
  }

  createShoppingList = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { name, items, retailer_groups } = req.body;

      const shoppingList: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'> = {
        user_id: req.user.id,
        name,
        items: items || [],
        retailer_groups: retailer_groups || []
      };

      const listId = await this.shoppingListRepo.createShoppingList(shoppingList);

      // Get created list
      const createdList = await this.shoppingListRepo.findById(listId);
      if (!createdList) {
        throw new Error('Failed to retrieve created shopping list');
      }

      const listRow = createdList as any as ShoppingListRow;
      const list: ShoppingList = {
        ...listRow,
        items: JSON.parse(listRow.items),
        retailer_groups: JSON.parse(listRow.retailer_groups)
      };

      return res.status(201).json({
        success: true,
        data: list,
        message: 'Shopping list created successfully'
      });
    } catch (error) {
      console.error('Create shopping list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create shopping list',
        code: 'CREATE_LIST_ERROR'
      });
    }
  };

  getShoppingLists = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const lists = await this.shoppingListRepo.findByUserId(
        req.user.id,
        parseInt(limit as string),
        offset
      );

      const allLists = await this.shoppingListRepo.findByUserId(req.user.id, 1000, 0);
      const total = allLists.length;

      const parsedLists: ShoppingList[] = lists.map(listRow => {
        const row = listRow as any as ShoppingListRow;
        return {
          ...row,
          items: JSON.parse(row.items),
          retailer_groups: JSON.parse(row.retailer_groups)
        };
      });

      return res.json({
        success: true,
        data: parsedLists,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          total_pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Get shopping lists error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve shopping lists',
        code: 'GET_LISTS_ERROR'
      });
    }
  };

  getShoppingListById = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;

      const list = await this.shoppingListRepo.findById(parseInt(id));
      if (!list) {
        throw new NotFoundError('Shopping list');
      }

      if (list.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      const listRow = list as any as ShoppingListRow;
      const parsedList: ShoppingList = {
        ...listRow,
        items: JSON.parse(listRow.items),
        retailer_groups: JSON.parse(listRow.retailer_groups)
      };

      return res.json({
        success: true,
        data: parsedList
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Get shopping list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve shopping list',
        code: 'GET_LIST_ERROR'
      });
    }
  };

  updateShoppingList = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Verify ownership
      const existingList = await this.shoppingListRepo.findById(parseInt(id));
      if (!existingList) {
        throw new NotFoundError('Shopping list');
      }

      if (existingList.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      const success = await this.shoppingListRepo.updateShoppingList(parseInt(id), updateData);

      if (success) {
        // Get updated list
        const updatedList = await this.shoppingListRepo.findById(parseInt(id));
        if (updatedList) {
          const listRow = updatedList as any as ShoppingListRow;
          return res.json({
            success: true,
            data: {
              ...listRow,
              items: JSON.parse(listRow.items),
              retailer_groups: JSON.parse(listRow.retailer_groups)
            },
            message: 'Shopping list updated successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update shopping list',
        code: 'UPDATE_LIST_ERROR'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Update shopping list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update shopping list',
        code: 'UPDATE_LIST_ERROR'
      });
    }
  };

  addToList = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;
      const itemData = req.body;

      // Verify ownership
      const existingList = await this.shoppingListRepo.findById(parseInt(id));
      if (!existingList) {
        throw new NotFoundError('Shopping list');
      }

      if (existingList.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      // Verify product exists
      const product = await this.productCatalogRepo.findBySKU(itemData.product_sku.split(':')[0], itemData.product_sku.split(':')[1]);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        });
      }

      const success = await this.shoppingListRepo.addItemToList(parseInt(id), itemData);

      if (success) {
        // Get updated list
        const updatedList = await this.shoppingListRepo.findById(parseInt(id));
        if (updatedList) {
          const listRow = updatedList as any as ShoppingListRow;
          return res.json({
            success: true,
            data: {
              ...listRow,
              items: JSON.parse(listRow.items),
              retailer_groups: JSON.parse(listRow.retailer_groups)
            },
            message: 'Item added to shopping list successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to add item to shopping list',
        code: 'ADD_ITEM_ERROR'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Add to list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to add item to shopping list',
        code: 'ADD_ITEM_ERROR'
      });
    }
  };

  removeFromList = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id, itemId } = req.params;

      // Verify ownership
      const existingList = await this.shoppingListRepo.findById(parseInt(id));
      if (!existingList) {
        throw new NotFoundError('Shopping list');
      }

      if (existingList.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      const success = await this.shoppingListRepo.removeItemFromList(parseInt(id), parseInt(itemId));

      if (success) {
        // Get updated list
        const updatedList = await this.shoppingListRepo.findById(parseInt(id));
        if (updatedList) {
          const listRow = updatedList as any as ShoppingListRow;
          return res.json({
            success: true,
            data: {
              ...listRow,
              items: JSON.parse(listRow.items),
              retailer_groups: JSON.parse(listRow.retailer_groups)
            },
            message: 'Item removed from shopping list successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to remove item from shopping list',
        code: 'REMOVE_ITEM_ERROR'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Remove from list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove item from shopping list',
        code: 'REMOVE_ITEM_ERROR'
      });
    }
  };

  updateItemStatus = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id, itemId } = req.params;
      const { purchased } = req.body;

      // Verify ownership
      const existingList = await this.shoppingListRepo.findById(parseInt(id));
      if (!existingList) {
        throw new NotFoundError('Shopping list');
      }

      if (existingList.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      const success = await this.shoppingListRepo.updateItemStatus(parseInt(id), parseInt(itemId), purchased);

      if (success) {
        // Get updated list
        const updatedList = await this.shoppingListRepo.findById(parseInt(id));
        if (updatedList) {
          const listRow = updatedList as any as ShoppingListRow;
          return res.json({
            success: true,
            data: {
              ...listRow,
              items: JSON.parse(listRow.items),
              retailer_groups: JSON.parse(listRow.retailer_groups)
            },
            message: 'Item status updated successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update item status',
        code: 'UPDATE_ITEM_STATUS_ERROR'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Update item status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update item status',
        code: 'UPDATE_ITEM_STATUS_ERROR'
      });
    }
  };

  generateFromMealPlan = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { mealPlanId, listName } = req.body;

      // Get meal plan
      const mealPlan = await this.mealPlanRepo.findById(mealPlanId);
      if (!mealPlan) {
        throw new NotFoundError('Meal plan');
      }

      if (mealPlan.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      // Extract ingredients from all meals in the plan
      const ingredients = await this.extractIngredientsFromMealPlan(mealPlan);

      // Find products for ingredients and organize by retailer
      const retailerGroups = await this.createRetailerGroups(ingredients);

      const totalItems = retailerGroups.reduce((sum, group) => sum + group.items.length, 0);
      const totalEstimate = retailerGroups.reduce((sum, group) => sum + group.estimated_total, 0);

      const shoppingList: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'> = {
        user_id: req.user.id,
        name: listName || `Shopping List - ${new Date().toLocaleDateString()}`,
        items: retailerGroups.flatMap(group => group.items),
        retailer_groups: retailerGroups
      };

      const listId = await this.shoppingListRepo.createShoppingList(shoppingList);

      // Get created list
      const createdList = await this.shoppingListRepo.findById(listId);
      if (!createdList) {
        throw new Error('Failed to retrieve created shopping list');
      }

      const listRow = createdList as any as ShoppingListRow;
      return res.status(201).json({
        success: true,
        data: {
          ...listRow,
          items: JSON.parse(listRow.items),
          retailer_groups: JSON.parse(listRow.retailer_groups)
        },
        message: `Shopping list generated with ${totalItems} items from meal plan. Estimated total: $${totalEstimate.toFixed(2)}`
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Generate from meal plan error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate shopping list from meal plan',
        code: 'GENERATE_FROM_MEAL_PLAN_ERROR'
      });
    }
  };

  getShoppingStats = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const stats = await this.shoppingListRepo.getUserShoppingStats(req.user.id);

      return res.json({
        success: true,
        data: {
          ...stats,
          averageCompletionRate: Math.round(stats.averageCompletionRate * 100) / 100
        }
      });
    } catch (error) {
      console.error('Get shopping stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve shopping statistics',
        code: 'GET_SHOPPING_STATS_ERROR'
      });
    }
  };

  deleteShoppingList = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.params;

      // Verify ownership
      const existingList = await this.shoppingListRepo.findById(parseInt(id));
      if (!existingList) {
        throw new NotFoundError('Shopping list');
      }

      if (existingList.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN'
        });
      }

      const success = await this.shoppingListRepo.deleteShoppingList(parseInt(id));

      return res.json({
        success: success,
        message: success ? 'Shopping list deleted successfully' : 'Shopping list not found'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Delete shopping list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete shopping list',
        code: 'DELETE_LIST_ERROR'
      });
    }
  };

  private async extractIngredientsFromMealPlan(mealPlan: any): Promise<string[]> {
    const ingredients: string[] = [];

    // Parse meals and extract ingredients
    const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
    const { RecipeRepository } = await import('../repositories/recipe.repository');
    const recipeRepo = new RecipeRepository();

    for (const mealType of meals) {
      const meal = mealPlan[mealType];
      if (meal) {
        const parsedMeal = JSON.parse(meal);
        const recipe = await recipeRepo.findById(parsedMeal.recipe_id);
        if (recipe) {
          const recipeIngredients: RecipeIngredient[] = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients;
          ingredients.push(...recipeIngredients.map((ing: RecipeIngredient) => ing.name));
        }
      }
    }

    return [...new Set(ingredients)]; // Remove duplicates
  }

  private async createRetailerGroups(ingredients: string[]): Promise<RetailerGroup[]> {
    const groups: Map<Retailer, any[]> = new Map();
    const { Retailer } = await import('../types');

    // Initialize groups for all retailers
    Object.values(Retailer).forEach(retailer => {
      groups.set(retailer as Retailer, []);
    });

    // For each ingredient, find products across retailers
    for (const ingredient of ingredients) {
      const products = await this.productCatalogRepo.searchByName(ingredient);

      for (const product of products) {
        if (groups.has(product.retailer)) {
          groups.get(product.retailer)!.push({
            id: Date.now() + Math.random(), // Generate unique ID
            product_sku: product.sku,
            quantity: 1,
            unit: 'item',
            purchased: false,
            notes: `For ${ingredient}`
          });
        }
      }
    }

    // Convert to retailer groups
    const retailerGroups: RetailerGroup[] = [];

    for (const [retailer, items] of groups) {
      if (items.length > 0) {
        // Get product details to calculate total
        const skus = items.map(item => item.product_sku.split(':')[1]);
        const products = await Promise.all(
          skus.map(sku => this.productCatalogRepo.findBySKU(retailer, sku))
        );

        const validProducts = products.filter(p => p !== null);
        const estimatedTotal = validProducts.reduce((sum, p) => sum + (p?.price || 0), 0);

        retailerGroups.push({
          retailer,
          items,
          estimated_total: estimatedTotal,
          currency: 'USD'
        });
      }
    }

    return retailerGroups;
  }
}