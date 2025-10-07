#!/bin/bash

# Shopping List Generation API Test Script
# Tests the /api/v1/shopping-lists/from-meal-plan endpoint

BASE_URL="${API_URL:-http://localhost:3000}"
API_BASE="$BASE_URL/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Shopping List Generation API Tests"
echo "Base URL: $API_BASE"
echo "========================================="
echo ""

# Function to make API calls and pretty print
test_endpoint() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local token=$5
    local expected_status=$6

    echo -e "${YELLOW}Test: $test_name${NC}"
    echo "Request: $method $API_BASE$endpoint"

    if [ -n "$data" ]; then
        echo "Data: $data"
    fi

    # Make request
    if [ -n "$token" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check status
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ Status: $status_code (Expected: $expected_status)${NC}"
    else
        echo -e "${RED}✗ Status: $status_code (Expected: $expected_status)${NC}"
    fi

    # Pretty print JSON response
    echo "Response:"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    echo ""
    echo "-----------------------------------------"
    echo ""
}

# Test 1: Register a test user
echo "=== Setup: Creating Test User ==="
test_endpoint \
    "Register test user" \
    "POST" \
    "/auth/register" \
    '{
        "name": "Test User",
        "email": "test-shopping-list@example.com",
        "password": "Test123!",
        "cuisine_preferences": ["north_indian", "mediterranean"],
        "dietary_restrictions": [],
        "dosha": "vata",
        "cultural_background": "indian"
    }' \
    "" \
    201

# Test 2: Login to get token
echo "=== Setup: Login to Get Token ==="
login_response=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test-shopping-list@example.com",
        "password": "Test123!"
    }')

TOKEN=$(echo "$login_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get authentication token. Exiting.${NC}"
    echo "Login response: $login_response"
    exit 1
fi

echo -e "${GREEN}✓ Got authentication token${NC}"
echo ""

# Test 3: Attempt without authentication
echo "=== Test 1: Unauthorized Access ==="
test_endpoint \
    "Generate shopping list without auth" \
    "POST" \
    "/shopping-lists/from-meal-plan" \
    '{
        "mealPlanId": 1,
        "listName": "Test Shopping List"
    }' \
    "" \
    401

# Test 4: Missing meal plan
echo "=== Test 2: Non-existent Meal Plan ==="
test_endpoint \
    "Generate shopping list for non-existent meal plan" \
    "POST" \
    "/shopping-lists/from-meal-plan" \
    '{
        "mealPlanId": 99999,
        "listName": "Test Shopping List"
    }' \
    "$TOKEN" \
    404

# Test 5: Create a sample meal plan first
echo "=== Setup: Creating Sample Meal Plan ==="

# First, we need to create some recipes
echo "Creating sample recipes..."

# Recipe 1: Simple Breakfast
recipe1_response=$(curl -s -X POST "$API_BASE/recipes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "cuisine_type": "north_indian",
        "title": "Masala Oatmeal",
        "description": "Healthy Indian-style oatmeal",
        "ingredients": [
            {"name": "rolled oats", "quantity": "1", "unit": "cup", "optional": false},
            {"name": "milk", "quantity": "2", "unit": "cup", "optional": false},
            {"name": "cardamom powder", "quantity": "0.5", "unit": "tsp", "optional": false},
            {"name": "almonds", "quantity": "10", "unit": "pieces", "optional": true}
        ],
        "instructions": ["Boil milk", "Add oats", "Add cardamom", "Top with almonds"],
        "prep_time_minutes": 5,
        "cook_time_minutes": 10,
        "servings": 2,
        "difficulty": "easy",
        "cultural_notes": "Indian breakfast variation",
        "ayurvedic_info": {
            "dominant_dosha": ["vata"],
            "taste_profile": ["sweet"],
            "energy": "heating",
            "effect_on_doshas": {"vata": "decreases", "pitta": "neutral", "kapha": "neutral"},
            "seasonal_recommendation": ["winter"],
            "contraindications": []
        },
        "nutritional_info": {
            "calories": 300,
            "protein_g": 10,
            "carbs_g": 45,
            "fat_g": 8,
            "fiber_g": 5,
            "sugar_g": 10,
            "sodium_mg": 100
        }
    }')

RECIPE1_ID=$(echo "$recipe1_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -z "$RECIPE1_ID" ]; then
    echo -e "${RED}Failed to create recipe 1${NC}"
    echo "Response: $recipe1_response"
else
    echo -e "${GREEN}✓ Created recipe 1 (ID: $RECIPE1_ID)${NC}"
fi

# Recipe 2: Simple Lunch
recipe2_response=$(curl -s -X POST "$API_BASE/recipes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "cuisine_type": "north_indian",
        "title": "Dal Tadka",
        "description": "Classic Indian lentil curry",
        "ingredients": [
            {"name": "toor dal", "quantity": "1", "unit": "cup", "optional": false},
            {"name": "tomatoes", "quantity": "2", "unit": "pieces", "optional": false},
            {"name": "onions", "quantity": "1", "unit": "pieces", "optional": false},
            {"name": "cumin seeds", "quantity": "1", "unit": "tsp", "optional": false},
            {"name": "turmeric", "quantity": "0.5", "unit": "tsp", "optional": false}
        ],
        "instructions": ["Pressure cook dal", "Prepare tadka", "Mix together"],
        "prep_time_minutes": 10,
        "cook_time_minutes": 30,
        "servings": 4,
        "difficulty": "medium",
        "cultural_notes": "North Indian staple",
        "ayurvedic_info": {
            "dominant_dosha": ["kapha"],
            "taste_profile": ["sweet", "astringent"],
            "energy": "cooling",
            "effect_on_doshas": {"vata": "neutral", "pitta": "decreases", "kapha": "neutral"},
            "seasonal_recommendation": ["summer"],
            "contraindications": []
        },
        "nutritional_info": {
            "calories": 250,
            "protein_g": 12,
            "carbs_g": 40,
            "fat_g": 3,
            "fiber_g": 10,
            "sugar_g": 5,
            "sodium_mg": 150
        }
    }')

RECIPE2_ID=$(echo "$recipe2_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -z "$RECIPE2_ID" ]; then
    echo -e "${RED}Failed to create recipe 2${NC}"
    echo "Response: $recipe2_response"
else
    echo -e "${GREEN}✓ Created recipe 2 (ID: $RECIPE2_ID)${NC}"
fi

echo ""

# Now create a meal plan
if [ -n "$RECIPE1_ID" ] && [ -n "$RECIPE2_ID" ]; then
    echo "Creating meal plan with recipes..."

    meal_plan_response=$(curl -s -X POST "$API_BASE/meal-plans" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"date\": \"2025-10-06\",
            \"breakfast\": {\"recipe_id\": $RECIPE1_ID, \"serving_size\": 2},
            \"lunch\": {\"recipe_id\": $RECIPE2_ID, \"serving_size\": 4},
            \"dinner\": null,
            \"snack\": null
        }")

    MEAL_PLAN_ID=$(echo "$meal_plan_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

    if [ -z "$MEAL_PLAN_ID" ]; then
        echo -e "${RED}Failed to create meal plan${NC}"
        echo "Response: $meal_plan_response"
    else
        echo -e "${GREEN}✓ Created meal plan (ID: $MEAL_PLAN_ID)${NC}"
    fi
fi

echo ""

# Test 6: Generate shopping list from valid meal plan
if [ -n "$MEAL_PLAN_ID" ]; then
    echo "=== Test 3: Valid Shopping List Generation ==="
    test_endpoint \
        "Generate shopping list from meal plan" \
        "POST" \
        "/shopping-lists/from-meal-plan" \
        "{
            \"mealPlanId\": $MEAL_PLAN_ID,
            \"listName\": \"Test Shopping List - $(date +%Y-%m-%d)\"
        }" \
        "$TOKEN" \
        201
else
    echo -e "${YELLOW}Skipping valid shopping list test - no meal plan created${NC}"
    echo ""
fi

# Test 7: Verify shopping list was created
echo "=== Test 4: Verify Shopping List Created ==="
test_endpoint \
    "Fetch all shopping lists" \
    "GET" \
    "/shopping-lists" \
    "" \
    "$TOKEN" \
    200

# Test 8: Generate another shopping list with default name
if [ -n "$MEAL_PLAN_ID" ]; then
    echo "=== Test 5: Shopping List with Default Name ==="
    test_endpoint \
        "Generate shopping list with default name" \
        "POST" \
        "/shopping-lists/from-meal-plan" \
        "{
            \"mealPlanId\": $MEAL_PLAN_ID
        }" \
        "$TOKEN" \
        201
fi

# Summary
echo ""
echo "========================================="
echo "Test Suite Complete"
echo "========================================="
echo ""
echo "Notes:"
echo "- Product catalog must be populated for meaningful results"
echo "- Ingredients will only appear if matching products exist"
echo "- Check database for product catalog entries"
echo ""
echo "To populate product catalog, run:"
echo "  curl -X POST $API_BASE/product-catalog ..."
echo ""
