#!/bin/bash

# Test script to verify push token registration endpoint
# Usage: ./test_token_registration.sh [AUTH_TOKEN]

API_URL="http://192.168.0.76:3000"
ENDPOINT="/api/users/registerPushToken"
AUTH_TOKEN="${1:-}"

echo "🧪 Testing Push Token Registration Endpoint"
echo "============================================"
echo "API URL: ${API_URL}${ENDPOINT}"
echo ""

# Test data
TEST_TOKEN="dsYKFoZlQ0aW_78U_GHr0P:APA91bHJt4p3w9hKfznyTXubew4UNdZ1bGNF2t72SuzpBoKUHd1N7MbVJHkfwuKaO6FUif4MkVfOP5MOAnmSQSnnc7xoascVCUuuivZwFFD3x5nhxXAATOs"

# Build curl command
CURL_CMD="curl -X POST ${API_URL}${ENDPOINT} \
  -H 'Content-Type: application/json'"

if [ -n "$AUTH_TOKEN" ]; then
  CURL_CMD="${CURL_CMD} -H 'Authorization: Bearer ${AUTH_TOKEN}'"
  echo "✅ Using provided auth token"
else
  echo "⚠️  No auth token provided (endpoint might require authentication)"
fi

CURL_CMD="${CURL_CMD} \
  -d '{
    \"token\": \"${TEST_TOKEN}\",
    \"platform\": \"android\",
    \"osVersion\": \"13\"
  }' \
  -w '\n\nHTTP Status: %{http_code}\n' \
  -v"

echo ""
echo "📤 Sending request..."
echo ""

eval $CURL_CMD

echo ""
echo ""
echo "============================================"
echo "✅ Test complete!"
echo ""
echo "Expected results:"
echo "  - HTTP 200/201: Success"
echo "  - HTTP 401: Authentication required"
echo "  - HTTP 404: Endpoint not found"
echo "  - Connection refused: Backend not reachable"
echo ""




