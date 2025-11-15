#!/bin/bash

# Local development script for all Lambda functions
# This script uses cargo-lambda watch for Rust services and AWS SAM for Python service

set -e

echo "🚀 Starting GymCoach AI Local Development Environment"
echo "=================================================="

# Ensure we're in the repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Set AWS profile
export AWS_PROFILE=shehzadi
export AWS_REGION=eu-west-1

# Check required tools
echo "Checking required tools..."

if ! command -v cargo-lambda &> /dev/null; then
    echo "❌ cargo-lambda not found. Installing..."
    cargo install cargo-lambda
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js."
    exit 1
fi

# Check if tmux is available (optional but recommended)
if command -v tmux &> /dev/null; then
    USE_TMUX=true
    echo "✅ tmux found - will use tmux for better process management"
else
    USE_TMUX=false
    echo "ℹ️  tmux not found - processes will run in background"
    echo "   Install tmux for better process management: brew install tmux"
fi

# Create logs directory
mkdir -p "$REPO_ROOT/logs"

# Load environment variables from .env.local if it exists
if [ -f "$REPO_ROOT/.env.local" ]; then
    echo "Loading environment variables from .env.local..."
    export $(grep -v '^#' "$REPO_ROOT/.env.local" | xargs)
fi

# Export environment variables for Lambda functions
export DYNAMODB_TABLE="${DYNAMODB_TABLE:-gymcoach-ai-main-dev}"
export AWS_REGION="${AWS_REGION:-eu-west-1}"
export ENVIRONMENT="${ENVIRONMENT:-dev}"

echo ""
echo "Environment Configuration:"
echo "  AWS_PROFILE: $AWS_PROFILE"
echo "  AWS_REGION: $AWS_REGION"
echo "  DYNAMODB_TABLE: $DYNAMODB_TABLE"
echo "  ENVIRONMENT: $ENVIRONMENT"
echo ""

# Function to start a Rust Lambda service
start_rust_lambda() {
    local service_name=$1
    local port=$2
    
    echo "Starting $service_name on port $port..."
    
    cd "$REPO_ROOT/services/$service_name"
    
    if [ "$USE_TMUX" = true ]; then
        tmux new-window -t gymcoach -n "$service_name" \
            "cd $REPO_ROOT/services/$service_name && \
             AWS_PROFILE=$AWS_PROFILE \
             TABLE_NAME=$DYNAMODB_TABLE \
             DYNAMODB_TABLE=$DYNAMODB_TABLE \
             AWS_REGION=$AWS_REGION \
             ENVIRONMENT=$ENVIRONMENT \
             cargo lambda watch --invoke-port $port 2>&1 | tee $REPO_ROOT/logs/$service_name.log"
    else
        (cd "$REPO_ROOT/services/$service_name" && \
         AWS_PROFILE=$AWS_PROFILE \
         TABLE_NAME=$DYNAMODB_TABLE \
         DYNAMODB_TABLE=$DYNAMODB_TABLE \
         AWS_REGION=$AWS_REGION \
         ENVIRONMENT=$ENVIRONMENT \
         cargo lambda watch --invoke-port $port > "$REPO_ROOT/logs/$service_name.log" 2>&1) &
        echo $! > "$REPO_ROOT/logs/$service_name.pid"
    fi
    
    cd "$REPO_ROOT"
}

# Function to start Python Lambda service
start_python_lambda() {
    echo "Starting ai-service-python on port 9001..."
    
    cd "$REPO_ROOT/services/ai-service-python"
    
    # Install dependencies if needed
    if [ ! -f "venv/bin/activate" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install -q -r requirements.txt flask 2>&1 | grep -v "Requirement already satisfied" || true
    
    # Create a simple Flask wrapper for local development
    cat > local_server.py << 'EOF'
import json
import sys
import os
from flask import Flask, request, jsonify
from lambda_function import lambda_handler

app = Flask(__name__)

@app.route('/2015-03-31/functions/function/invocations', methods=['POST'])
def invoke():
    try:
        event = request.get_json()
        context = type('obj', (object,), {
            'function_name': 'ai-service-python',
            'function_version': '1',
            'invoked_function_arn': 'arn:aws:lambda:local',
            'memory_limit_in_mb': 512,
            'aws_request_id': 'local-request-id',
            'log_group_name': '/aws/lambda/ai-service-python',
            'log_stream_name': 'local',
        })()
        
        result = lambda_handler(event, context)
        return jsonify(result)
    except Exception as e:
        import traceback
        return jsonify({
            'statusCode': 500,
            'body': json.dumps({'error': str(e), 'trace': traceback.format_exc()})
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'ai-service-python'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9001, debug=False)
EOF
    
    if [ "$USE_TMUX" = true ]; then
        tmux new-window -t gymcoach -n "ai-service-python" \
            "cd $REPO_ROOT/services/ai-service-python && source venv/bin/activate && \
             AWS_PROFILE=$AWS_PROFILE \
             COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID \
             USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID \
             JWT_SECRET=$JWT_SECRET \
             DYNAMODB_TABLE=$DYNAMODB_TABLE \
             AWS_REGION=$AWS_REGION \
             ENVIRONMENT=$ENVIRONMENT \
             python local_server.py 2>&1 | tee $REPO_ROOT/logs/ai-service-python.log"
    else
        (cd "$REPO_ROOT/services/ai-service-python" && \
         source venv/bin/activate && \
         AWS_PROFILE=$AWS_PROFILE \
         COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID \
         USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID \
         JWT_SECRET=$JWT_SECRET \
         DYNAMODB_TABLE=$DYNAMODB_TABLE \
         AWS_REGION=$AWS_REGION \
         ENVIRONMENT=$ENVIRONMENT \
         python local_server.py > "$REPO_ROOT/logs/ai-service-python.log" 2>&1) &
        echo $! > "$REPO_ROOT/logs/ai-service-python.pid"
    fi
    
    cd "$REPO_ROOT"
}

# Function to start proxy server
start_proxy() {
    echo "Starting proxy server on port 3001..."
    
    cd "$REPO_ROOT/proxy-server"
    
    if [ ! -d "node_modules" ]; then
        echo "Installing proxy server dependencies..."
        npm install
    fi
    
    if [ "$USE_TMUX" = true ]; then
        tmux new-window -t gymcoach -n "proxy" \
            "cd $REPO_ROOT/proxy-server && npm run dev:local 2>&1 | tee $REPO_ROOT/logs/proxy.log"
    else
        (cd "$REPO_ROOT/proxy-server" && \
         npm run dev:local > "$REPO_ROOT/logs/proxy.log" 2>&1) &
        echo $! > "$REPO_ROOT/logs/proxy.pid"
    fi
    
    cd "$REPO_ROOT"
}

# Main execution
if [ "$USE_TMUX" = true ]; then
    # Kill existing tmux session if it exists
    tmux kill-session -t gymcoach 2>/dev/null || true
    
    # Create new tmux session
    tmux new-session -d -s gymcoach -n "main"
    tmux send-keys -t gymcoach:main "cd $REPO_ROOT" C-m
    tmux send-keys -t gymcoach:main "echo 'GymCoach AI Local Development - Main Window'" C-m
    tmux send-keys -t gymcoach:main "echo 'Use Ctrl+B then W to see all windows'" C-m
    tmux send-keys -t gymcoach:main "echo 'Use Ctrl+B then N/P to navigate windows'" C-m
    tmux send-keys -t gymcoach:main "echo 'Use Ctrl+B then D to detach from session'" C-m
fi

echo ""
echo "Starting Lambda services..."
echo "=================================================="

# Start Rust Lambda services (from build-lambdas.sh)
start_rust_lambda "auth-layer" 9000
start_rust_lambda "user-profile-service" 9002
start_rust_lambda "workout-service" 9003
start_rust_lambda "coaching-service" 9004
start_rust_lambda "analytics-service" 9005
start_rust_lambda "nutrition-service" 9006
start_rust_lambda "notification-service" 9007
start_rust_lambda "notification-scheduler" 9008

# Start Python Lambda service
start_python_lambda

# Start proxy server
start_proxy

echo ""
echo "=================================================="
echo "✅ All services started!"
echo ""
echo "Service Ports:"
echo "  auth-layer:              http://localhost:9000"
echo "  ai-service-python:       http://localhost:9001"
echo "  user-profile-service:    http://localhost:9002"
echo "  workout-service:         http://localhost:9003"
echo "  coaching-service:        http://localhost:9004"
echo "  analytics-service:       http://localhost:9005"
echo "  nutrition-service:       http://localhost:9006"
echo "  notification-service:    http://localhost:9007"
echo "  notification-scheduler:  http://localhost:9008"
echo "  proxy-server:            http://localhost:3001"
echo ""
echo "Logs are available at: $REPO_ROOT/logs/"
echo ""

if [ "$USE_TMUX" = true ]; then
    echo "Attaching to tmux session..."
    echo "To detach: Press Ctrl+B then D"
    echo "To reattach later: tmux attach -t gymcoach"
    echo ""
    sleep 2
    tmux attach -t gymcoach
else
    echo "All services running in background."
    echo "To stop all services, run: ./scripts/stop-local.sh"
    echo ""
    echo "Tailing proxy server logs (Ctrl+C to stop viewing)..."
    sleep 2
    tail -f "$REPO_ROOT/logs/proxy.log"
fi
