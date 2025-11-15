#!/bin/bash

# Setup script for local development prerequisites
# Run this once before using dev-local.sh for the first time

set -e

echo "🔧 Setting up GymCoach AI Local Development Environment"
echo "========================================================"
echo ""

# Check operating system
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script is optimized for macOS. Some commands may need adjustment for other OS."
    echo ""
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Rust
echo "Checking Rust..."
if command_exists rustc; then
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust installed: $RUST_VERSION"
else
    echo "❌ Rust not found"
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo "✅ Rust installed"
fi

# Check cargo-lambda
echo ""
echo "Checking cargo-lambda..."
if command_exists cargo-lambda; then
    CARGO_LAMBDA_VERSION=$(cargo-lambda --version || echo "unknown")
    echo "✅ cargo-lambda installed: $CARGO_LAMBDA_VERSION"
else
    echo "❌ cargo-lambda not found"
    echo "Installing cargo-lambda..."
    cargo install cargo-lambda
    echo "✅ cargo-lambda installed"
fi

# Add musl target for static builds
echo ""
echo "Adding Rust musl target..."
rustup target add x86_64-unknown-linux-musl 2>/dev/null || echo "✅ Target already installed"

# Check Python
echo ""
echo "Checking Python..."
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python installed: $PYTHON_VERSION"
else
    echo "❌ Python3 not found"
    echo "Please install Python3:"
    echo "  macOS: brew install python3"
    exit 1
fi

# Check Node.js
echo ""
echo "Checking Node.js..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    echo "Please install Node.js:"
    echo "  macOS: brew install node"
    exit 1
fi

# Check AWS CLI
echo ""
echo "Checking AWS CLI..."
if command_exists aws; then
    AWS_VERSION=$(aws --version)
    echo "✅ AWS CLI installed: $AWS_VERSION"
    
    # Check AWS profile
    if aws sts get-caller-identity --profile shehzadi >/dev/null 2>&1; then
        echo "✅ AWS profile 'shehzadi' is configured and working"
        aws sts get-caller-identity --profile shehzadi
    else
        echo "⚠️  AWS profile 'shehzadi' not found or not working"
        echo "Please configure it with: aws configure --profile shehzadi"
    fi
else
    echo "❌ AWS CLI not found"
    echo "Please install AWS CLI:"
    echo "  macOS: brew install awscli"
    exit 1
fi

# Check tmux (optional)
echo ""
echo "Checking tmux (optional but recommended)..."
if command_exists tmux; then
    TMUX_VERSION=$(tmux -V)
    echo "✅ tmux installed: $TMUX_VERSION"
else
    echo "ℹ️  tmux not found (optional)"
    echo "For better process management, install tmux:"
    echo "  macOS: brew install tmux"
fi

# Check jq (optional, for testing)
echo ""
echo "Checking jq (optional, for JSON formatting in tests)..."
if command_exists jq; then
    JQ_VERSION=$(jq --version)
    echo "✅ jq installed: $JQ_VERSION"
else
    echo "ℹ️  jq not found (optional)"
    echo "For better JSON output in tests, install jq:"
    echo "  macOS: brew install jq"
fi

# Install proxy server dependencies
echo ""
echo "Installing proxy server dependencies..."
cd proxy-server
if [ ! -d "node_modules" ]; then
    npm install
    echo "✅ Proxy server dependencies installed"
else
    echo "✅ Proxy server dependencies already installed"
fi
cd ..

# Create logs directory
echo ""
echo "Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"

# Create .env.local if not exists
if [ ! -f ".env.local" ]; then
    echo ""
    echo "Creating .env.local from example..."
    cp .env.local.example .env.local
    echo "✅ .env.local created"
    echo "ℹ️  You can customize .env.local as needed"
else
    echo ""
    echo "✅ .env.local already exists"
fi

echo ""
echo "========================================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize .env.local if needed"
echo "2. Start local development: npm run dev:local"
echo "3. Read LOCAL_DEVELOPMENT.md for detailed guide"
echo ""
echo "Quick commands:"
echo "  npm run dev:local  - Start all services"
echo "  npm run dev:stop   - Stop all services"
echo "  npm run test:local - Test a service"
echo ""
