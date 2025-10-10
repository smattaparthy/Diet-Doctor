#!/bin/bash

# Test script for improved Dosha Assessment API
# Tests both numeric indices and text values for selectedOptions

API_BASE="http://localhost:3000/api/v1"

echo "=========================================="
echo "Dosha Assessment API Test Suite"
echo "=========================================="
echo ""

# Register a test user and get token
echo "Step 1: Registering test user..."
cat > /tmp/register_test.json << 'EOF'
{
  "email": "doshatest@example.com",
  "password": "Test123!",
  "name": "Dosha Test User",
  "cuisine_preferences": ["north_indian"],
  "cultural_background": "hindu"
}
EOF

REG_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d @/tmp/register_test.json)

TOKEN=$(echo "$REG_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to register user. Response:"
  echo "$REG_RESPONSE" | jq .
  exit 1
fi

echo "✅ User registered successfully"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Test 1: Numeric indices (backward compatibility)
echo "=========================================="
echo "TEST 1: Numeric Indices (Backward Compatibility)"
echo "=========================================="

cat > /tmp/test_numeric.json << 'EOF'
{
  "answers": [
    {"questionId": "q1_body_frame", "selectedOptions": [0]},
    {"questionId": "q2_skin_type", "selectedOptions": [0]},
    {"questionId": "q3_digestion", "selectedOptions": [0]},
    {"questionId": "q4_energy_levels", "selectedOptions": [0]},
    {"questionId": "q5_temperature_preference", "selectedOptions": [0]},
    {"questionId": "q6_activity_level", "selectedOptions": [0]},
    {"questionId": "q7_stress_response", "selectedOptions": [0]},
    {"questionId": "q8_sleep_patterns", "selectedOptions": [0]},
    {"questionId": "q9_decision_making", "selectedOptions": [0]},
    {"questionId": "q10_food_preferences", "selectedOptions": [0]},
    {"questionId": "q11_health_concerns", "selectedOptions": [0]},
    {"questionId": "q12_health_goal", "selectedOptions": [0]}
  ]
}
EOF

echo "Request payload: Using numeric indices [0] for all questions"
RESPONSE=$(curl -s -X POST "$API_BASE/users/dosha-assessment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_numeric.json)

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
PRIMARY_DOSHA=$(echo "$RESPONSE" | jq -r '.data.primaryDosha')

if [ "$SUCCESS" == "true" ]; then
  echo "✅ Test PASSED - Numeric indices accepted"
  echo "Primary Dosha: $PRIMARY_DOSHA"
  echo "Percentages:"
  echo "$RESPONSE" | jq '.data.percentages'
else
  echo "❌ Test FAILED - Numeric indices rejected"
  echo "Error:"
  echo "$RESPONSE" | jq '{error: .error, code: .code, details: .details}'
fi
echo ""

# Register another user for Test 2
echo "Registering second test user for text value test..."
cat > /tmp/register_test2.json << 'EOF'
{
  "email": "doshatest2@example.com",
  "password": "Test123!",
  "name": "Dosha Test User 2",
  "cuisine_preferences": ["north_indian"],
  "cultural_background": "hindu"
}
EOF

REG_RESPONSE2=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d @/tmp/register_test2.json)

TOKEN2=$(echo "$REG_RESPONSE2" | jq -r '.data.token')
echo "✅ Second user registered"
echo ""

# Test 2: Text values (new format)
echo "=========================================="
echo "TEST 2: Text Values (New Developer-Friendly Format)"
echo "=========================================="

cat > /tmp/test_text.json << 'EOF'
{
  "answers": [
    {"questionId": "q1_body_frame", "selectedOptions": ["Slim/thin, hard to gain weight"]},
    {"questionId": "q2_skin_type", "selectedOptions": ["Dry, rough, or thin"]},
    {"questionId": "q3_digestion", "selectedOptions": ["Irregular, gas/bloating"]},
    {"questionId": "q4_energy_levels", "selectedOptions": ["Comes in bursts, easily fatigued"]},
    {"questionId": "q5_temperature_preference", "selectedOptions": ["I feel cold easily, prefer warmth"]},
    {"questionId": "q6_activity_level", "selectedOptions": ["Very active, restless, always on the go"]},
    {"questionId": "q7_stress_response", "selectedOptions": ["Anxious, worried, fearful"]},
    {"questionId": "q8_sleep_patterns", "selectedOptions": ["Light, interrupted, difficulty falling asleep"]},
    {"questionId": "q9_decision_making", "selectedOptions": ["Quickly, but often change mind"]},
    {"questionId": "q10_food_preferences", "selectedOptions": ["Sweet foods"]},
    {"questionId": "q11_health_concerns", "selectedOptions": ["Anxiety or nervousness"]},
    {"questionId": "q12_health_goal", "selectedOptions": ["Reduce stress and anxiety"]}
  ]
}
EOF

echo "Request payload: Using text values like 'Slim/thin, hard to gain weight'"
RESPONSE2=$(curl -s -X POST "$API_BASE/users/dosha-assessment" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_text.json)

SUCCESS2=$(echo "$RESPONSE2" | jq -r '.success')
PRIMARY_DOSHA2=$(echo "$RESPONSE2" | jq -r '.data.primaryDosha')

if [ "$SUCCESS2" == "true" ]; then
  echo "✅ Test PASSED - Text values accepted and converted"
  echo "Primary Dosha: $PRIMARY_DOSHA2"
  echo "Percentages:"
  echo "$RESPONSE2" | jq '.data.percentages'
else
  echo "❌ Test FAILED - Text values rejected"
  echo "Error:"
  echo "$RESPONSE2" | jq '{error: .error, code: .code, details: .details}'
fi
echo ""

# Test 3: Invalid text value (error message quality)
echo "=========================================="
echo "TEST 3: Invalid Text Value (Error Messaging)"
echo "=========================================="

cat > /tmp/test_invalid.json << 'EOF'
{
  "answers": [
    {"questionId": "q1_body_frame", "selectedOptions": ["invalid option text"]},
    {"questionId": "q2_skin_type", "selectedOptions": [0]},
    {"questionId": "q3_digestion", "selectedOptions": [0]},
    {"questionId": "q4_energy_levels", "selectedOptions": [0]},
    {"questionId": "q5_temperature_preference", "selectedOptions": [0]},
    {"questionId": "q6_activity_level", "selectedOptions": [0]},
    {"questionId": "q7_stress_response", "selectedOptions": [0]},
    {"questionId": "q8_sleep_patterns", "selectedOptions": [0]},
    {"questionId": "q9_decision_making", "selectedOptions": [0]},
    {"questionId": "q10_food_preferences", "selectedOptions": [0]},
    {"questionId": "q11_health_concerns", "selectedOptions": [0]},
    {"questionId": "q12_health_goal", "selectedOptions": [0]}
  ]
}
EOF

echo "Request payload: Using invalid text 'invalid option text'"
RESPONSE3=$(curl -s -X POST "$API_BASE/users/dosha-assessment" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_invalid.json)

SUCCESS3=$(echo "$RESPONSE3" | jq -r '.success')

if [ "$SUCCESS3" == "false" ]; then
  echo "✅ Test PASSED - Invalid text properly rejected with helpful error"
  echo "Error message:"
  echo "$RESPONSE3" | jq -r '.error'
else
  echo "❌ Test FAILED - Invalid text should be rejected"
  echo "$RESPONSE3" | jq .
fi
echo ""

# Test 4: Mixed format
echo "=========================================="
echo "TEST 4: Mixed Format (Numeric + Text)"
echo "=========================================="

cat > /tmp/test_mixed.json << 'EOF'
{
  "answers": [
    {"questionId": "q1_body_frame", "selectedOptions": [0]},
    {"questionId": "q2_skin_type", "selectedOptions": ["Dry, rough, or thin"]},
    {"questionId": "q3_digestion", "selectedOptions": [0]},
    {"questionId": "q4_energy_levels", "selectedOptions": ["Comes in bursts, easily fatigued"]},
    {"questionId": "q5_temperature_preference", "selectedOptions": [0]},
    {"questionId": "q6_activity_level", "selectedOptions": [0]},
    {"questionId": "q7_stress_response", "selectedOptions": [0]},
    {"questionId": "q8_sleep_patterns", "selectedOptions": [0]},
    {"questionId": "q9_decision_making", "selectedOptions": [0]},
    {"questionId": "q10_food_preferences", "selectedOptions": [0]},
    {"questionId": "q11_health_concerns", "selectedOptions": [0]},
    {"questionId": "q12_health_goal", "selectedOptions": [0]}
  ]
}
EOF

# Register third user
cat > /tmp/register_test3.json << 'EOF'
{
  "email": "doshatest3@example.com",
  "password": "Test123!",
  "name": "Dosha Test User 3",
  "cuisine_preferences": ["north_indian"],
  "cultural_background": "hindu"
}
EOF

TOKEN3=$(curl -s -X POST "$API_BASE/auth/register" -H "Content-Type: application/json" -d @/tmp/register_test3.json | jq -r '.data.token')

echo "Request payload: Mixed format - some numeric [0], some text values"
RESPONSE4=$(curl -s -X POST "$API_BASE/users/dosha-assessment" \
  -H "Authorization: Bearer $TOKEN3" \
  -H "Content-Type: application/json" \
  -d @/tmp/test_mixed.json)

SUCCESS4=$(echo "$RESPONSE4" | jq -r '.success')
PRIMARY_DOSHA4=$(echo "$RESPONSE4" | jq -r '.data.primaryDosha')

if [ "$SUCCESS4" == "true" ]; then
  echo "✅ Test PASSED - Mixed format accepted"
  echo "Primary Dosha: $PRIMARY_DOSHA4"
else
  echo "❌ Test FAILED - Mixed format rejected"
  echo "Error:"
  echo "$RESPONSE4" | jq '{error: .error, code: .code, details: .details}'
fi
echo ""

# Summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Test 1 (Numeric):    $([ "$SUCCESS" == "true" ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "Test 2 (Text):       $([ "$SUCCESS2" == "true" ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "Test 3 (Invalid):    $([ "$SUCCESS3" == "false" ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "Test 4 (Mixed):      $([ "$SUCCESS4" == "true" ] && echo '✅ PASSED' || echo '❌ FAILED')"
echo "=========================================="

# Cleanup
rm -f /tmp/register_test*.json /tmp/test_*.json
