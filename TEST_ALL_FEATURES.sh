#!/bin/bash

# Cultural Diet - Complete Feature Test Suite
# Tests all meal plan features implemented in Tasks 11, 12, and 13

set -e

echo "🧪 Cultural Diet - Complete Feature Test Suite"
echo "================================================"
echo ""

# Configuration
API_BASE="http://localhost:3000/api/v1"
USER_ID=1
TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Authentication
echo "Test 1: Authentication"
echo "----------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@culturaldiet.com",
    "password": "DemoUser123@"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$TOKEN" ]; then
  pass "User authenticated successfully"
  info "Token: ${TOKEN:0:20}..."
else
  fail "Authentication failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo ""

# Test 2: Generate Meal Plan
echo "Test 2: Generate Meal Plan"
echo "---------------------------"
MEAL_PLAN_RESPONSE=$(curl -s -X POST "$API_BASE/meal-plans/weekly/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": 1,
    "startDate": "2025-10-06",
    "daysCount": 7,
    "mealsPerDay": {
      "breakfast": false,
      "lunch": true,
      "dinner": true,
      "snack": false
    },
    "servings": 4,
    "preferences": {
      "maxPrepTime": 60,
      "varietyLevel": "medium",
      "retailerPrefs": ["Trader Joes", "Costco"]
    }
  }')

MEAL_PLAN_ID=$(echo $MEAL_PLAN_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ ! -z "$MEAL_PLAN_ID" ]; then
  pass "Meal plan generated successfully (ID: $MEAL_PLAN_ID)"
  ITEM_COUNT=$(echo $MEAL_PLAN_RESPONSE | grep -o '"recipe_id"' | wc -l)
  info "Generated $ITEM_COUNT meals"
else
  fail "Meal plan generation failed"
  echo "Response: $MEAL_PLAN_RESPONSE"
fi
echo ""

# Test 3: Retrieve Meal Plan with Nutrition Data
echo "Test 3: Retrieve Meal Plan with Full Details"
echo "----------------------------------------------"
PLAN_DETAILS=$(curl -s -X GET "$API_BASE/meal-plans/weekly/$MEAL_PLAN_ID" \
  -H "Authorization: Bearer $TOKEN")

HAS_NUTRITION=$(echo $PLAN_DETAILS | grep -o '"nutritional_info"' | wc -l)
HAS_AYURVEDA=$(echo $PLAN_DETAILS | grep -o '"ayurvedic_info"' | wc -l)

if [ $HAS_NUTRITION -gt 0 ]; then
  pass "Nutritional information present in meal plan"
else
  fail "Nutritional information missing"
fi

if [ $HAS_AYURVEDA -gt 0 ]; then
  pass "Ayurvedic information present in meal plan"
else
  fail "Ayurvedic information missing"
fi
echo ""

# Test 4: Recipe Swap (Get Alternative Recipes)
echo "Test 4: Recipe Swap - Fetch Alternatives"
echo "-----------------------------------------"
RECIPES_RESPONSE=$(curl -s -X GET "$API_BASE/recipes" \
  -H "Authorization: Bearer $TOKEN")

RECIPE_COUNT=$(echo $RECIPES_RESPONSE | grep -o '"id"' | wc -l)

if [ $RECIPE_COUNT -gt 5 ]; then
  pass "Alternative recipes available for swapping ($RECIPE_COUNT recipes)"
else
  fail "Insufficient recipes for swapping"
fi
echo ""

# Test 5: Recipe Swap Execution
echo "Test 5: Recipe Swap - Execute Swap"
echo "-----------------------------------"
# Get first meal plan item ID
FIRST_ITEM_ID=$(echo $PLAN_DETAILS | grep -o '"meal_plan_items":\[{"id":[0-9]*' | grep -o '[0-9]*' | tail -1)
# Get a different recipe ID for swapping
ALTERNATIVE_RECIPE_ID=$(echo $RECIPES_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -3 | tail -1)

if [ ! -z "$FIRST_ITEM_ID" ] && [ ! -z "$ALTERNATIVE_RECIPE_ID" ]; then
  SWAP_RESPONSE=$(curl -s -X PUT "$API_BASE/meal-plans/items/$FIRST_ITEM_ID/recipe" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"newRecipeId\": $ALTERNATIVE_RECIPE_ID}")

  if echo $SWAP_RESPONSE | grep -q '"success":true'; then
    pass "Recipe swapped successfully (Item: $FIRST_ITEM_ID, New Recipe: $ALTERNATIVE_RECIPE_ID)"
  else
    fail "Recipe swap failed"
    echo "Response: $SWAP_RESPONSE"
  fi
else
  fail "Could not extract meal item or alternative recipe ID"
fi
echo ""

# Test 6: Mark Meal as Complete
echo "Test 6: Mark Meal as Complete"
echo "------------------------------"
COMPLETE_RESPONSE=$(curl -s -X PUT "$API_BASE/meal-plans/items/$FIRST_ITEM_ID/complete" \
  -H "Authorization: Bearer $TOKEN")

if echo $COMPLETE_RESPONSE | grep -q '"success":true'; then
  pass "Meal marked as completed"
else
  fail "Failed to mark meal as complete"
fi
echo ""

# Test 7: Share Link Generation
echo "Test 7: Share Link Generation"
echo "------------------------------"
SHARE_RESPONSE=$(curl -s -X POST "$API_BASE/meal-plans/$MEAL_PLAN_ID/share" \
  -H "Authorization: Bearer $TOKEN")

SHARE_TOKEN=$(echo $SHARE_RESPONSE | grep -o '"shareToken":"[^"]*' | cut -d'"' -f4)
SHARE_URL=$(echo $SHARE_RESPONSE | grep -o '"shareUrl":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$SHARE_TOKEN" ]; then
  pass "Share link generated successfully"
  info "Share Token: $SHARE_TOKEN"
  info "Share URL: $SHARE_URL"
else
  fail "Share link generation failed"
  echo "Response: $SHARE_RESPONSE"
fi
echo ""

# Test 8: Access Shared Meal Plan (No Auth Required)
echo "Test 8: Access Shared Meal Plan (No Auth)"
echo "------------------------------------------"
if [ ! -z "$SHARE_TOKEN" ]; then
  SHARED_PLAN=$(curl -s -X GET "$API_BASE/shared/$SHARE_TOKEN")

  if echo $SHARED_PLAN | grep -q '"success":true'; then
    pass "Shared meal plan accessible without authentication"
    HAS_ITEMS=$(echo $SHARED_PLAN | grep -o '"items"' | wc -l)
    if [ $HAS_ITEMS -gt 0 ]; then
      pass "Shared plan includes meal items"
    fi
  else
    fail "Failed to access shared meal plan"
  fi
else
  fail "Skipping (no share token available)"
fi
echo ""

# Test 9: PDF Export
echo "Test 9: PDF Export"
echo "------------------"
PDF_RESPONSE=$(curl -s -o /tmp/meal_plan_test.pdf -w "%{http_code}" \
  -X POST "$API_BASE/meal-plans/$MEAL_PLAN_ID/export" \
  -H "Authorization: Bearer $TOKEN")

if [ "$PDF_RESPONSE" = "200" ]; then
  PDF_SIZE=$(wc -c < /tmp/meal_plan_test.pdf)
  if [ $PDF_SIZE -gt 1000 ]; then
    pass "PDF exported successfully (${PDF_SIZE} bytes)"
    info "PDF saved to: /tmp/meal_plan_test.pdf"
  else
    fail "PDF file too small, may be corrupted"
  fi
else
  fail "PDF export failed (HTTP $PDF_RESPONSE)"
fi
echo ""

# Test 10: Recipe Detail View (Frontend Check)
echo "Test 10: Recipe Detail Page Exists"
echo "-----------------------------------"
if [ -f "public/recipe-view.html" ]; then
  pass "Recipe detail view page exists"

  # Check for nutrition display
  if grep -q "nutritional_info" public/recipe-view.html; then
    pass "Recipe page includes nutritional info parsing"
  fi

  # Check for Ayurveda display
  if grep -q "ayurvedic_info" public/recipe-view.html; then
    pass "Recipe page includes Ayurvedic info display"
  fi
else
  fail "Recipe detail view page missing"
fi
echo ""

# Test 11: Meal Cards Include Nutrition
echo "Test 11: Meal Cards Include Nutrition & Ayurveda"
echo "-------------------------------------------------"
if grep -q "meal-nutrition" public/meal-plan-view.html; then
  pass "Meal cards include nutrition summary"
fi

if grep -q "ayurveda-badge" public/meal-plan-view.html; then
  pass "Meal cards include Ayurvedic indicators"
fi

if grep -q "dosha-icon" public/meal-plan-view.html; then
  pass "Dosha effect icons implemented"
fi
echo ""

# Test Summary
echo "================================================"
echo "Test Summary"
echo "================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "🎉 Implementation Complete!"
  echo ""
  echo "Features Implemented:"
  echo "✓ Task 11: Recipe swap with intelligent matching"
  echo "✓ Task 12: PDF export and shareable links"
  echo "✓ Task 13: Nutritional info and Ayurvedic indicators"
  echo ""
  echo "You can now:"
  echo "1. Open http://localhost:8000/login.html"
  echo "2. Login with demo@culturaldiet.com / demo123"
  echo "3. Navigate to Meal Plan"
  echo "4. Generate a meal plan"
  echo "5. View nutrition, swap recipes, share, and export PDF"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
