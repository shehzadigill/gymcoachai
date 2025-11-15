#!/bin/bash

# Stop proxy server script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛑 Stopping Proxy Server..."

# Kill by PID file if it exists
if [ -f "$REPO_ROOT/logs/proxy.pid" ]; then
    PID=$(cat "$REPO_ROOT/logs/proxy.pid")
    if ps -p $PID > /dev/null 2>&1; then
        echo "Killing process $PID..."
        kill $PID 2>/dev/null
        sleep 1
        
        # Force kill if still running
        if ps -p $PID > /dev/null 2>&1; then
            kill -9 $PID 2>/dev/null
        fi
    fi
    rm -f "$REPO_ROOT/logs/proxy.pid"
fi

# Kill any remaining proxy processes
pkill -f "nodemon.*server-local" 2>/dev/null
pkill -f "node.*server-local.js" 2>/dev/null

# Force kill anything on port 3001
if lsof -i:3001 > /dev/null 2>&1; then
    PID=$(lsof -ti:3001)
    echo "Force killing process $PID on port 3001..."
    kill -9 $PID 2>/dev/null
fi

sleep 1

# Verify it's stopped
if lsof -i:3001 > /dev/null 2>&1; then
    echo "⚠️  Warning: Port 3001 is still in use:"
    lsof -i:3001
    exit 1
else
    echo "✅ Proxy server stopped successfully"
fi
