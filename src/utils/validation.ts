import Joi from 'joi';
import { CreateUserRequest, UpdateUserRequest, Dosha, CuisineType } from '../types';

export const userValidationSchema = {
  create: Joi.object<CreateUserRequest>({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
    cuisine_preferences: Joi.array().items(Joi.string().valid(...Object.values(CuisineType))).min(1).required(),
    dietary_restrictions: Joi.array().items(Joi.object({
      type: Joi.string().valid('religious', 'medical', 'ethical', 'cultural').required(),
      restriction: Joi.string().min(1).max(100).required(),
      severity: Joi.string().valid('strict', 'moderate', 'mild').required()
    })).default([]),
    dosha: Joi.string().valid(...Object.values(Dosha)).allow(null).default(null),
    cultural_background: Joi.string().min(1).max(100).required()
  }),

  update: Joi.object<UpdateUserRequest>({
    name: Joi.string().min(2).max(100),
    cuisine_preferences: Joi.array().items(Joi.string().valid(...Object.values(CuisineType))).min(1),
    dietary_restrictions: Joi.array().items(Joi.object({
      type: Joi.string().valid('religious', 'medical', 'ethical', 'cultural').required(),
      restriction: Joi.string().min(1).max(100).required(),
      severity: Joi.string().valid('strict', 'moderate', 'mild').required()
    })),
    dosha: Joi.string().valid(...Object.values(Dosha)).allow(null),
    cultural_background: Joi.string().min(1).max(100)
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

export const recipeValidationSchema = {
  create: Joi.object({
    cuisine_type: Joi.string().valid(...Object.values(CuisineType)).required(),
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(1000).default(''),
    ingredients: Joi.array().items(Joi.object({
      name: Joi.string().min(1).max(100).required(),
      quantity: Joi.string().min(1).max(50).required(),
      unit: Joi.string().min(1).max(50).required(),
      optional: Joi.boolean().default(false),
      substitute: Joi.string().max(100).allow(null)
    })).min(1).required(),
    instructions: Joi.array().items(Joi.string().min(1).max(500)).min(1).required(),
    prep_time_minutes: Joi.number().integer().min(0).required(),
    cook_time_minutes: Joi.number().integer().min(0).required(),
    servings: Joi.number().integer().min(1).required(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').required(),
    cultural_notes: Joi.string().max(2000).allow(null),
    ayurvedic_info: Joi.object({
      dominantDosha: Joi.array().items(Joi.string().valid(...Object.values(Dosha))).min(1).required(),
      taste_profile: Joi.array().items(Joi.string().valid('sweet', 'sour', 'salty', 'pungent', 'bitter', 'astringent')).min(1).required(),
      energy: Joi.string().valid('heating', 'cooling', 'neutral').required(),
      effect_on_doshas: Joi.object({
        vata: Joi.string().valid('increases', 'decreases', 'neutral').required(),
        pitta: Joi.string().valid('increases', 'decreases', 'neutral').required(),
        kapha: Joi.string().valid('increases', 'decreases', 'neutral').required()
      }).required(),
      seasonal_recommendation: Joi.array().items(Joi.string().valid('spring', 'summer', 'monsoon', 'autumn', 'winter')).default([]),
      contraindications: Joi.array().items(Joi.string().max(200)).default([])
    }).required(),
    nutritional_info: Joi.object({
      calories: Joi.number().min(0).required(),
      protein_g: Joi.number().min(0).required(),
      carbs_g: Joi.number().min(0).required(),
      fat_g: Joi.number().min(0).required(),
      fiber_g: Joi.number().min(0).required(),
      sugar_g: Joi.number().min(0).default(0),
      sodium_mg: Joi.number().min(0).default(0)
    }).required()
  }),

  search: Joi.object({
    searchTerm: Joi.string().min(1).max(100).required(),
    cuisine_type: Joi.string().valid(...Object.values(CuisineType)).optional(),
    dosha: Joi.string().valid(...Object.values(Dosha)).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
    max_preptime: Joi.number().integer().min(0).optional(),
    ingredients: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

export const mealPlanValidationSchema = {
  create: Joi.object({
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
    meal_preferences: Joi.object({
      breakfast: Joi.boolean().required(),
      lunch: Joi.boolean().required(),
      dinner: Joi.boolean().required(),
      snack: Joi.boolean().required()
    }).required(),
    cuisine_preferences: Joi.array().items(Joi.string().valid(...Object.values(CuisineType))).optional(),
    avoid_ingredients: Joi.array().items(Joi.string().min(1).max(100)).optional(),
    max_prep_time: Joi.number().integer().min(0).optional()
  }),

  update: Joi.object({
    breakfast: Joi.object({
      recipe_id: Joi.number().integer().min(1).required(),
      serving_size: Joi.number().integer().min(0.5).required(),
      notes: Joi.string().max(500).allow(null),
      substitutions: Joi.array().items(Joi.string().max(100)).optional()
    }).optional(),
    lunch: Joi.object({
      recipe_id: Joi.number().integer().min(1).required(),
      serving_size: Joi.number().integer().min(0.5).required(),
      notes: Joi.string().max(500).allow(null),
      substitutions: Joi.array().items(Joi.string().max(100)).optional()
    }).optional(),
    dinner: Joi.object({
      recipe_id: Joi.number().integer().min(1).required(),
      serving_size: Joi.number().integer().min(0.5).required(),
      notes: Joi.string().max(500).allow(null),
      substitutions: Joi.array().items(Joi.string().max(100)).optional()
    }).optional(),
    snack: Joi.object({
      recipe_id: Joi.number().integer().min(1).required(),
      serving_size: Joi.number().integer().min(0.5).required(),
      notes: Joi.string().max(500).allow(null),
      substitutions: Joi.array().items(Joi.string().max(100)).optional()
    }).optional()
  })
};

export const shoppingListValidationSchema = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    items: Joi.array().items(Joi.object({
      product_sku: Joi.string().min(1).max(50).required(),
      quantity: Joi.number().integer().min(1).required(),
      unit: Joi.string().min(1).max(50).required(),
      purchased: Joi.boolean().default(false),
      notes: Joi.string().max(500).allow(null)
    })).default([]),
    retailer_groups: Joi.array().items(Joi.object({
      retailer: Joi.string().valid('patel_brothers', 'subzi_mandi', 'hanuman', 'trader_joes').required(),
      items: Joi.array().items(Joi.object({
        id: Joi.number().integer().required(),
        product_sku: Joi.string().required(),
        quantity: Joi.number().integer().required(),
        unit: Joi.string().required(),
        purchased: Joi.boolean(),
        notes: Joi.string().allow(null)
      })).required(),
      estimated_total: Joi.number().min(0).required(),
      currency: Joi.string().default('USD')
    })).default([])
  }),

  addItem: Joi.object({
    product_sku: Joi.string().min(1).max(50).required(),
    quantity: Joi.number().integer().min(1).required(),
    unit: Joi.string().min(1).max(50).required(),
    purchased: Joi.boolean().default(false),
    notes: Joi.string().max(500).allow(null)
  })
};

export const productCatalogValidationSchema = {
  create: Joi.object({
    retailer: Joi.string().valid('patel_brothers', 'subzi_mandi', 'hanuman', 'trader_joes').required(),
    sku: Joi.string().min(1).max(50).required(),
    name: Joi.string().min(1).max(200).required(),
    category: Joi.string().min(1).max(100).required(),
    subcategory: Joi.string().max(100).allow(null),
    brand: Joi.string().max(100).allow(null),
    cultural_tags: Joi.array().items(Joi.string().max(50)).default([]),
    dietary_certifications: Joi.array().items(Joi.string().max(50)).default([]),
    size: Joi.string().max(50).allow(null),
    price: Joi.number().min(0).required(),
    currency: Joi.string().default('USD'),
    cultural_equivalent: Joi.array().items(Joi.string().max(100)).default([]),
    ayurvedic_properties: Joi.array().items(Joi.string().max(100)).default([])
  }),

  search: Joi.object({
    searchTerm: Joi.string().min(1).max(100).optional(),
    retailer: Joi.string().valid('patel_brothers', 'subzi_mandi', 'hanuman', 'trader_joes').optional(),
    category: Joi.string().min(1).max(100).optional(),
    brand: Joi.string().min(1).max(100).optional(),
    cultural_tags: Joi.array().items(Joi.string().min(1).max(50)).optional(),
    dietary_certifications: Joi.array().items(Joi.string().min(1).max(50)).optional(),
    ayurvedic_properties: Joi.array().items(Joi.string().min(1).max(50)).optional(),
    max_price: Joi.number().min(0).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

export const culturalRulesValidationSchema = {
  create: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    type: Joi.string().valid('religious', 'dietary', 'cultural', 'ayurvedic').required(),
    description: Joi.string().min(1).max(1000).required(),
    applicability: Joi.array().items(Joi.string().max(100)).min(1).required(),
    forbidden_ingredients: Joi.array().items(Joi.string().max(100)).default([]),
    conditional_restrictions: Joi.array().items(Joi.object({
      condition: Joi.string().min(1).max(200).required(),
      restriction: Joi.string().min(1).max(200).required(),
      exception: Joi.string().max(200).allow(null)
    })).default([]),
    severity: Joi.string().valid('strict', 'moderate', 'mild').required()
  }),

  search: Joi.object({
    type: Joi.string().valid('religious', 'dietary', 'cultural', 'ayurvedic').optional(),
    applicability: Joi.string().min(1).max(100).optional(),
    severity: Joi.string().valid('strict', 'moderate', 'mild').optional(),
    ingredient: Joi.string().min(1).max(100).optional(),
    searchTerm: Joi.string().min(1).max(100).optional()
  })
};

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});