#!/bin/bash

# View logs for a specific service or all services
# Usage: ./scripts/view-logs.sh [service-name]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOGS_DIR="$REPO_ROOT/logs"

if [ ! -d "$LOGS_DIR" ]; then
    echo "No logs directory found. Services may not be running."
    exit 1
fi

SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
    echo "📋 Available logs:"
    echo "===================="
    ls -lh "$LOGS_DIR"/*.log 2>/dev/null || echo "No log files found"
    echo ""
    echo "Usage: $0 <service-name>"
    echo "Example: $0 user-profile-service"
    echo "Example: $0 proxy"
    exit 0
fi

LOG_FILE="$LOGS_DIR/$SERVICE_NAME.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    echo ""
    echo "Available logs:"
    ls -1 "$LOGS_DIR"/*.log 2>/dev/null | xargs -n1 basename | sed 's/.log$//'
    exit 1
fi

echo "📖 Viewing logs for $SERVICE_NAME"
echo "Press Ctrl+C to stop"
echo "===================="
echo ""

tail -f "$LOG_FILE"
