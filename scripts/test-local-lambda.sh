#!/bin/bash

# Test script for local Lambda functions
# Usage: ./scripts/test-local-lambda.sh <service-name> [port]

set -e

SERVICE_NAME=${1:-"user-profile-service"}
PORT=${2}

# Auto-detect port if not provided
if [ -z "$PORT" ]; then
    case $SERVICE_NAME in
        "auth-layer") PORT=9000 ;;
        "ai-service-python") PORT=9001 ;;
        "user-profile-service") PORT=9002 ;;
        "workout-service") PORT=9003 ;;
        "coaching-service") PORT=9004 ;;
        "analytics-service") PORT=9005 ;;
        "nutrition-service") PORT=9006 ;;
        "notification-service") PORT=9007 ;;
        "notification-scheduler") PORT=9008 ;;
        *) PORT=9000 ;;
    esac
fi

echo "🧪 Testing $SERVICE_NAME on port $PORT"
echo "=================================================="

# Example test payloads
case $SERVICE_NAME in
    "auth-layer")
        PAYLOAD='{"httpMethod":"GET","path":"/health","headers":{}}'
        ;;
    "user-profile-service")
        PAYLOAD='{"httpMethod":"GET","path":"/profile","headers":{"Authorization":"Bearer test-token"},"requestContext":{"authorizer":{"claims":{"sub":"test-user-id"}}}}'
        ;;
    "workout-service")
        PAYLOAD='{"httpMethod":"GET","path":"/workouts","headers":{"Authorization":"Bearer test-token"},"requestContext":{"authorizer":{"claims":{"sub":"test-user-id"}}}}'
        ;;
    "ai-service-python")
        # Python service has a health endpoint
        echo "Testing health endpoint..."
        curl -s "http://localhost:$PORT/health" | jq '.' || curl -s "http://localhost:$PORT/health"
        echo ""
        echo ""
        echo "Testing Lambda invocation..."
        PAYLOAD='{"httpMethod":"POST","path":"/chat","body":"{\"message\":\"Hello coach!\",\"conversationId\":\"test-123\"}","headers":{"Authorization":"Bearer test-token"},"requestContext":{"authorizer":{"claims":{"sub":"test-user-id"}}}}'
        ;;
    *)
        PAYLOAD='{"httpMethod":"GET","path":"/health","headers":{}}'
        ;;
esac

echo "Sending Lambda invocation request to http://localhost:$PORT/..."
echo "Payload: $PAYLOAD"
echo ""

# Use AWS Lambda Runtime Interface Emulator invoke
curl -X POST \
    "http://localhost:$PORT/2015-03-31/functions/function/invocations" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    | jq '.' 2>/dev/null || curl -X POST \
    "http://localhost:$PORT/2015-03-31/functions/function/invocations" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"

echo ""
echo "✅ Test complete!"
