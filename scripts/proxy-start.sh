#!/bin/bash

# Start proxy server script
# This script ensures a clean start of the proxy server

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Proxy Server..."

# First, ensure no proxy is already running
echo "Checking for existing proxy processes..."
if lsof -i:3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 is in use. Stopping existing proxy server..."
    pkill -f "nodemon.*server-local" 2>/dev/null
    pkill -f "node.*server-local.js" 2>/dev/null
    
    # Force kill if still running
    sleep 1
    if lsof -i:3001 > /dev/null 2>&1; then
        PID=$(lsof -ti:3001)
        echo "Force killing process $PID on port 3001..."
        kill -9 $PID 2>/dev/null
    fi
    
    sleep 1
fi

# Verify port is free
if lsof -i:3001 > /dev/null 2>&1; then
    echo "❌ Failed to free port 3001. Please manually kill the process."
    lsof -i:3001
    exit 1
fi

echo "✅ Port 3001 is free"

# Start the proxy server
cd "$REPO_ROOT/proxy-server"

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "Installing proxy server dependencies..."
    npm install
fi

echo "Starting proxy server..."
npm run dev:local > "$REPO_ROOT/logs/proxy.log" 2>&1 &

# Save PID
echo $! > "$REPO_ROOT/logs/proxy.pid"

# Wait a moment and verify it started
sleep 2

if lsof -i:3001 > /dev/null 2>&1; then
    echo "✅ Proxy server started successfully on http://localhost:3001"
    echo "📝 Logs: $REPO_ROOT/logs/proxy.log"
    echo "🛑 Stop: $REPO_ROOT/scripts/proxy-stop.sh"
else
    echo "❌ Proxy server failed to start. Check logs:"
    echo "   tail -50 $REPO_ROOT/logs/proxy.log"
    exit 1
fi
