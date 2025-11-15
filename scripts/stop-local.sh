#!/bin/bash

# Stop all local development services

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛑 Stopping GymCoach AI Local Development Environment"
echo "=================================================="

# Function to stop a service by PID file
stop_service() {
    local service_name=$1
    local pid_file="$REPO_ROOT/logs/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping $service_name (PID: $pid)..."
            kill $pid 2>/dev/null || true
            rm "$pid_file"
        else
            echo "$service_name is not running"
            rm "$pid_file"
        fi
    fi
}

# Check if tmux session exists
if command -v tmux &> /dev/null; then
    if tmux has-session -t gymcoach 2>/dev/null; then
        echo "Killing tmux session 'gymcoach'..."
        tmux kill-session -t gymcoach
        echo "✅ Tmux session killed"
        exit 0
    fi
fi

# If not using tmux, stop individual processes
echo "Stopping background processes..."

stop_service "auth-layer"
stop_service "ai-service-python"
stop_service "user-profile-service"
stop_service "workout-service"
stop_service "coaching-service"
stop_service "analytics-service"
stop_service "nutrition-service"
stop_service "notification-service"
stop_service "notification-scheduler"
stop_service "proxy"

# Kill any remaining cargo lambda watch processes
echo "Cleaning up any remaining cargo lambda processes..."
pkill -f "cargo lambda watch" 2>/dev/null || true

# Kill any remaining Python processes
pkill -f "ai-service-python" 2>/dev/null || true

echo ""
echo "✅ All services stopped!"
echo "Logs are preserved at: $REPO_ROOT/logs/"
