#!/bin/bash

# Cultural Diet App - Settings Feature E2E Test
# Tests settings CRUD operations

API_URL="http://localhost:3000/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiZGVtb0BjdWx0dXJhbGRpZXQuY29tIiwiaWF0IjoxNzU5Njg5ODYxLCJleHAiOjE3NjAyOTQ2NjEsImF1ZCI6ImN1bHR1cmFsLWRpZXQtYXBwIiwiaXNzIjoiY3VsdHVyYWwtZGlldC1hcGkifQ._akC86ut6jjbCtZ3QISsVLW3l41HoM9WqYOdyzoao1Q"

echo "==================================="
echo "Settings Feature E2E Test"
echo "==================================="
echo ""

# Test 1: Get User Profile/Settings
echo "Test 1: GET /api/v1/users/profile"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/users/profile")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE (Success)"
    echo "$BODY" | python3 -m json.tool | head -20
else
    echo "❌ Status: $HTTP_CODE (Failed)"
    echo "$BODY"
fi
echo ""

# Test 2: Update User Profile
echo "Test 2: PUT /api/v1/users/profile"
echo "-----------------------------------"
UPDATE_DATA='{
  "name": "Test User Updated",
  "cuisine_preferences": ["north_indian", "mediterranean"],
  "dietary_restrictions": ["vegetarian"],
  "dosha": "pitta",
  "cultural_background": "Indian-American"
}'

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_DATA" \
  "$API_URL/users/profile")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE (Success)"
    echo "$BODY" | python3 -m json.tool | head -15
else
    echo "❌ Status: $HTTP_CODE (Failed)"
    echo "$BODY"
fi
echo ""

# Test 3: Verify Updated Profile
echo "Test 3: Verify updated profile"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/users/profile")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE (Success)"
    echo "Checking updated fields:"
    echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
user = data.get('data', {}).get('user', {})
print(f'  Name: {user.get(\"name\")}')
print(f'  Cuisine: {user.get(\"cuisine_preferences\")}')
print(f'  Dietary: {user.get(\"dietary_restrictions\")}')
print(f'  Dosha: {user.get(\"dosha\")}')
print(f'  Culture: {user.get(\"cultural_background\")}')
"
else
    echo "❌ Status: $HTTP_CODE (Failed)"
    echo "$BODY"
fi
echo ""

# Test 4: Frontend Accessibility
echo "Test 4: Frontend page accessibility"
echo "-----------------------------------"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/settings.html")

if [ "$FRONTEND_CODE" = "200" ]; then
    echo "✅ Settings page accessible: $FRONTEND_CODE"
else
    echo "❌ Settings page not accessible: $FRONTEND_CODE"
fi
echo ""

# Test 5: Settings page has key elements
echo "Test 5: Settings page content validation"
echo "-----------------------------------"
SETTINGS_HTML=$(curl -s "http://localhost:8000/settings.html")

CHECKS=(
    "Profile Information"
    "Cuisine Preferences"
    "Dietary Restrictions"
    "Ayurvedic Profile"
    "Cultural Background"
    "Change Password"
    "Delete Account"
)

for check in "${CHECKS[@]}"; do
    if echo "$SETTINGS_HTML" | grep -q "$check"; then
        echo "✅ Found: $check"
    else
        echo "❌ Missing: $check"
    fi
done
echo ""

echo "==================================="
echo "Settings Feature Test Complete"
echo "==================================="
