#!/bin/bash
# Diagnostic script to test MockAPI.io endpoints

BASE_URL="https://6917363aa7a34288a27ff1d7.mockapi.io/api/v1"

echo "Testing MockAPI.io endpoints..."
echo "Base URL: $BASE_URL"
echo ""

# Test common resource name patterns
echo "Testing common resource names..."
for resource in "health" "workouts" "ingest" "exports"; do
    echo -n "  GET /$resource: "
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/$resource")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Found! (HTTP $http_code)"
        echo "   Response preview: $(echo "$body" | head -1)"
    else
        echo "❌ Not found (HTTP $http_code)"
    fi
done

echo ""
echo "If none of these work, please check:"
echo "1. Are the resources actually created in your MockAPI.io dashboard?"
echo "2. What are the exact resource names shown in the dashboard?"
echo "3. Is the project ID correct? (Current: 6917363aa7a34288a27ff1d7)"

