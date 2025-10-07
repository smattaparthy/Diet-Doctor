#!/bin/bash

# Create demo user with proper validation format

API_BASE="http://localhost:3000/api/v1"

echo "Creating demo user account..."

curl -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@culturaldiet.com",
    "password": "DemoUser123@",
    "name": "Demo User",
    "cuisine_preferences": ["north_indian", "mediterranean"],
    "cultural_background": "Hindu",
    "dietary_restrictions": [
      {
        "type": "religious",
        "restriction": "no beef",
        "severity": "strict"
      }
    ],
    "retailer_preferences": ["patel_brothers", "trader_joes"],
    "dosha": "vata"
  }'

echo ""
echo ""
echo "Login credentials:"
echo "Email: demo@culturaldiet.com"
echo "Password: DemoUser123@"
