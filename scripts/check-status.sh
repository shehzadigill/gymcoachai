#!/bin/bash

# Check status of all local Lambda services
# Usage: ./scripts/check-status.sh

set -e

echo "🔍 GymCoach AI Local Services Status"
echo "========================================"
echo ""

# Service definitions (service:port)
SERVICES=(
    "auth-layer:9000"
    "ai-service-python:9001"
    "user-profile-service:9002"
    "workout-service:9003"
    "coaching-service:9004"
    "analytics-service:9005"
    "nutrition-service:9006"
    "notification-service:9007"
    "notification-scheduler:9008"
    "proxy:3001"
)

# Function to check if a port is in use
check_port() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
    return $?
}

# Function to get process info for a port
get_process_info() {
    local port=$1
    lsof -i :$port -t 2>/dev/null | head -n1
}

# Check tmux session
if command -v tmux &> /dev/null; then
    if tmux has-session -t gymcoach 2>/dev/null; then
        echo "📦 tmux session: ✅ Running (session: gymcoach)"
        echo "   Attach with: tmux attach -t gymcoach"
    else
        echo "📦 tmux session: ❌ Not running"
    fi
    echo ""
fi

echo "📡 Service Status:"
echo ""

# Table header
printf "%-30s %-8s %-10s %-10s\n" "Service" "Port" "Status" "PID"
printf "%-30s %-8s %-10s %-10s\n" "-------" "----" "------" "---"

# Check each service
for service_port in "${SERVICES[@]}"; do
    service="${service_port%%:*}"
    port="${service_port##*:}"
    
    if check_port $port; then
        pid=$(get_process_info $port)
        printf "%-30s %-8s %-10s %-10s\n" "$service" "$port" "✅ Running" "$pid"
    else
        printf "%-30s %-8s %-10s %-10s\n" "$service" "$port" "❌ Stopped" "-"
    fi
done

echo ""
echo "📂 Recent Logs:"
echo ""

LOGS_DIR="./logs"
if [ -d "$LOGS_DIR" ]; then
    # Show last modified log files
    ls -lt "$LOGS_DIR"/*.log 2>/dev/null | head -n 5 | while read -r line; do
        echo "   $line"
    done
    
    if [ $(ls -1 "$LOGS_DIR"/*.log 2>/dev/null | wc -l) -eq 0 ]; then
        echo "   No log files found"
    fi
else
    echo "   No logs directory found"
fi

echo ""
echo "💡 Commands:"
echo "   Start all: npm run dev:local"
echo "   Stop all:  npm run dev:stop"
echo "   View logs: npm run dev:logs"
echo ""
