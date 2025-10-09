// User related types
export interface User {
  id: number;
  name: string;
  email: string;
  password_hash?: string;
  cuisine_preferences: string[];
  dietary_restrictions: DietaryRestriction[];
  dosha: Dosha | null;
  cultural_background: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  cuisine_preferences: string[];
  dietary_restrictions: DietaryRestriction[];
  dosha: Dosha | null;
  cultural_background: string;
}

export interface UpdateUserRequest {
  name?: string;
  cuisine_preferences?: string[];
  dietary_restrictions?: DietaryRestriction[];
  dosha?: Dosha | null;
  cultural_background?: string;
}

// Dietary and cultural types
export enum Dosha {
  VATA = 'vata',
  PITTA = 'pitta',
  KAPHA = 'kapha',
  TRIDOSHA = 'tridosha'
}

export interface DietaryRestriction {
  type: 'religious' | 'medical' | 'ethical' | 'cultural';
  restriction: string;
  severity: 'strict' | 'moderate' | 'mild';
}

export enum CuisineType {
  NORTH_INDIAN = 'north_indian',
  SOUTH_INDIAN = 'south_indian',
  MUGHLAI = 'mughlai',
  GUJARATI = 'gujarati',
  PUNJABI = 'punjabi',
  BENGALI = 'bengali',
  RAJASTHANI = 'rajasthani',
  CHINESE = 'chinese',
  JAPANESE = 'japanese',
  THAI = 'thai',
  MEDITERRANEAN = 'mediterranean',
  MEXICAN = 'mexican'
}

// Recipe types
export interface Recipe {
  id: number;
  cuisine_type: CuisineType;
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cultural_notes: string;
  ayurvedic_info: AyurvedicInfo;
  nutritional_info: NutritionalInfo;
  protein_type?: string; // 'chicken', 'fish', 'seafood', 'legumes', 'dairy', 'eggs', 'plant-based'
  cooking_method?: string; // 'grilled', 'roasted', 'sauteed', 'steamed', 'boiled', 'fried', 'baked', 'raw'
  tags?: string[]; // ['vegetarian', 'vegan', 'gluten-free', 'quick', 'comfort-food']
  seasonal_tags?: string[]; // ['winter', 'summer', 'spring', 'fall', 'year-round']
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
  substitute?: string;
}

export interface AyurvedicInfo {
  dominant_dosha: Dosha[];
  taste_profile: ('sweet' | 'sour' | 'salty' | 'pungent' | 'bitter' | 'astringent')[];
  energy: 'heating' | 'cooling' | 'neutral';
  effect_on_doshas: {
    vata: 'increases' | 'decreases' | 'neutral';
    pitta: 'increases' | 'decreases' | 'neutral';
    kapha: 'increases' | 'decreases' | 'neutral';
  };
  seasonal_recommendation: ('spring' | 'summer' | 'monsoon' | 'autumn' | 'winter')[];
  contraindications: string[];
}

export interface NutritionalInfo {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

// Product catalog types
export interface ProductCatalogItem {
  id: number;
  retailer: Retailer;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  cultural_tags: string[];
  dietary_certifications: string[];
  size: string;
  price: number;
  currency: string;
  cultural_equivalent: string[];
  ayurvedic_properties?: string[];
  created_at: string;
  updated_at: string;
}

export enum Retailer {
  PATEL_BROTHERS = 'patel_brothers',
  SUBZI_MANDI = 'subzi_mandi',
  HANUMAN = 'hanuman',
  TRADER_JOES = 'trader_joes'
}

// Meal planning types
export interface MealPlan {
  id: number;
  user_id: number;
  date: string;
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
  snack?: Meal;
  total_nutrition: NutritionalInfo;
  cultural_compliance_score: number;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  recipe_id: number;
  serving_size: number;
  notes?: string;
  substitutions?: string[];
}

export interface GenerateMealPlanRequest {
  start_date: string;
  end_date: string;
  meal_preferences: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack: boolean;
  };
  cuisine_preferences?: CuisineType[];
  avoid_ingredients?: string[];
  max_prep_time?: number;
}

// Shopping list types
export interface ShoppingList {
  id: number;
  user_id: number;
  name: string;
  items: ShoppingListItem[];
  retailer_groups: RetailerGroup[];
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: number;
  product_sku: string;
  quantity: number;
  unit: string;
  purchased: boolean;
  notes?: string;
}

export interface RetailerGroup {
  retailer: Retailer;
  items: ShoppingListItem[];
  estimated_total: number;
  currency: string;
}

// Cultural rules types
export interface CulturalRule {
  id: number;
  name: string;
  type: 'religious' | 'dietary' | 'cultural' | 'ayurvedic';
  description: string;
  applicability: string[];
  forbidden_ingredients: string[];
  conditional_restrictions: ConditionalRestriction[];
  severity: 'strict' | 'moderate' | 'mild';
}

export interface ConditionalRestriction {
  condition: string;
  restriction: string;
  exception?: string;
}

// Database row types (with JSON serialization)
// These represent data as stored in SQLite with TEXT columns for JSON arrays
export interface CulturalRuleRow {
  id: number;
  name: string;
  type: 'religious' | 'dietary' | 'cultural' | 'ayurvedic';
  description: string;
  applicability: string; // JSON serialized string[]
  forbidden_ingredients: string; // JSON serialized string[]
  conditional_restrictions: string; // JSON serialized ConditionalRestriction[]
  severity: 'strict' | 'moderate' | 'mild';
}

export interface RecipeRow {
  id: number;
  cuisine_type: CuisineType;
  title: string;
  description: string;
  ingredients: string; // JSON serialized RecipeIngredient[]
  instructions: string; // JSON serialized string[]
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cultural_notes: string;
  ayurvedic_info: string; // JSON serialized AyurvedicInfo
  nutritional_info: string; // JSON serialized NutritionalInfo
  protein_type?: string;
  cooking_method?: string;
  tags?: string; // JSON serialized string[]
  seasonal_tags?: string; // JSON serialized string[]
  created_at: string;
  updated_at: string;
}

export interface ProductCatalogItemRow {
  id: number;
  retailer: Retailer;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  cultural_tags: string; // JSON serialized string[]
  dietary_certifications: string; // JSON serialized string[]
  size: string;
  price: number;
  currency: string;
  cultural_equivalent: string; // JSON serialized string[]
  ayurvedic_properties?: string; // JSON serialized string[]
  created_at: string;
  updated_at: string;
}

export interface MealPlanRow {
  id: number;
  user_id: number;
  date: string;
  breakfast: string | null; // JSON serialized Meal
  lunch: string | null; // JSON serialized Meal
  dinner: string | null; // JSON serialized Meal
  snack: string | null; // JSON serialized Meal
  total_nutrition: string; // JSON serialized NutritionalInfo
  cultural_compliance_score: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListRow {
  id: number;
  user_id: number;
  name: string;
  items: string; // JSON serialized ShoppingListItem[]
  retailer_groups: string; // JSON serialized RetailerGroup[]
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Database types
export interface Database {
  users: User;
  recipes: Recipe;
  product_catalog: ProductCatalogItem;
  meal_plans: MealPlan;
  shopping_lists: ShoppingList;
  cultural_rules: CulturalRule;
}

// ============================================================================
// Enhanced Meal Plan Types (for new algorithm)
// ============================================================================

export interface WeeklyMealPlan {
  id?: number;
  user_id: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  name: string;
  status: 'active' | 'archived' | 'draft';
  preferences: string; // JSON object
  balance_metrics: string; // JSON object
  created_at?: string;
  updated_at?: string;
  items: MealPlanItem[];
}

export interface MealPlanItem {
  id?: number;
  weekly_plan_id?: number;
  date: string; // YYYY-MM-DD
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id: number;
  servings: number;
  score_breakdown?: string; // JSON object
  cultural_notes?: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ConstraintRule {
  id?: number;
  name: string;
  type: 'HARD_RULE' | 'PREFERENCE' | 'SOFT_RULE';
  category: 'religious' | 'dietary' | 'ayurvedic' | 'cultural';
  applicability: string; // JSON array
  weight: number;
  validator_function: string;
  forbidden_ingredients?: string; // JSON array
  favorable_attributes?: string; // JSON array
  unfavorable_attributes?: string; // JSON array
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile extends User {
  retailer_prefs?: string[];
}

export interface BalanceMetrics {
  proteinVariety: number; // 0-1
  cookingMethodVariety: number; // 0-1
  doshaBalance: number; // 0-1
  culturalAuthenticity: number; // 0-1
  nutritionalBalance: number; // 0-1
}

// ============================================================================
// Health Profile Types (for Ayurvedic Profiling System)
// ============================================================================

export interface UserHealthProfile {
  id?: number;
  user_id: number;

  // Prakriti (constitutional type - birth constitution)
  prakriti_vata: number;  // 0-100
  prakriti_pitta: number; // 0-100
  prakriti_kapha: number; // 0-100

  // Vikriti (current state - may differ from prakriti)
  vikriti_vata: number;  // 0-100
  vikriti_pitta: number; // 0-100
  vikriti_kapha: number; // 0-100

  // Primary dosha type determined from questionnaire
  primary_dosha: string; // 'vata', 'pitta', 'kapha', 'vata-pitta', etc.

  // Health and dietary information (JSON arrays)
  allergies: string[];  // ['dairy', 'nuts', 'shellfish']
  dietary_restrictions: string[];  // ['vegetarian', 'no-beef', 'gluten-free']
  health_concerns: string[];  // ['digestion', 'weight-management', 'energy']

  // Preferences (JSON arrays)
  cuisine_preferences: string[];  // ['north_indian', 'mediterranean']
  spice_level: 'mild' | 'medium' | 'hot';
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  stress_level: 'low' | 'moderate' | 'high';
  sleep_quality: 'poor' | 'fair' | 'good' | 'excellent';

  // Timestamps
  assessment_completed_at?: string | undefined;
  last_updated_at?: string | undefined;
  created_at?: string | undefined;
}

export interface UserHealthProfileRow {
  id: number;
  user_id: number;
  prakriti_vata: number;
  prakriti_pitta: number;
  prakriti_kapha: number;
  vikriti_vata: number;
  vikriti_pitta: number;
  vikriti_kapha: number;
  primary_dosha: string;
  allergies: string;  // JSON
  dietary_restrictions: string;  // JSON
  health_concerns: string;  // JSON
  cuisine_preferences: string;  // JSON
  spice_level: string;
  activity_level: string;
  stress_level: string;
  sleep_quality: string;
  assessment_completed_at: string | null;
  last_updated_at: string;
  created_at: string;
}

// ============================================================================
// Recipe Filtering & Recommendation Types
// ============================================================================

export interface FilterConstraints {
  allergens: string[];  // Must be excluded
  dietaryRestrictions: string[];  // Must be respected
  culturalRestrictions: string[];  // Religious/cultural requirements
  maxPrepTime?: number;  // Optional time constraint
  maxCookTime?: number;  // Optional time constraint
}

export interface RecipeScore {
  recipeId: number;
  totalScore: number;  // 0-100
  doshaScore: number;  // 0-100 (40% weight)
  preferenceScore: number;  // 0-100 (30% weight)
  healthScore: number;  // 0-100 (30% weight)
  explanation: string;  // Human-readable reason for recommendation
}

export interface ScoredRecipe extends Recipe {
  score: RecipeScore;
}

export interface RecommendationOptions {
  limit?: number;  // Number of recommendations to return
  cuisineFilter?: CuisineType[];  // Optional cuisine filter
  minScore?: number;  // Minimum threshold score
  includePenalizedRecipes?: boolean;  // Include recipes with negative dosha effects
}

export interface RecommendationResult {
  recipes: ScoredRecipe[];
  userProfile: UserHealthProfile;
  metadata: {
    totalEvaluated: number;
    filteredOut: number;
    recommendationCount: number;
    cacheHit: boolean;
    generatedAt: string;
  };
}

export interface DoshaCompatibility {
  vata: 'increase' | 'decrease' | 'neutral';
  pitta: 'increase' | 'decrease' | 'neutral';
  kapha: 'increase' | 'decrease' | 'neutral';
}

export interface HealthGoalMapping {
  goal: string;  // e.g., 'weight-management', 'digestion', 'energy'
  beneficialTastes: string[];  // Ayurvedic tastes that help
  beneficialQualities: string[];  // Ayurvedic qualities that help
  doshaRecommendations: string[];  // Which doshas to balance
}