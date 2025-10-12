#!/bin/bash

# Build script for Rust Lambda functions
set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 [SERVICE_NAME]"
    echo ""
    echo "Build Rust Lambda functions"
    echo ""
    echo "Arguments:"
    echo "  SERVICE_NAME    Optional. Build only the specified service"
    echo "                 If not provided, builds all services"
    echo ""
    echo "Available services:"
    echo "  auth-layer"
    echo "  user-profile-service"
    echo "  workout-service"
    echo "  coaching-service"
    echo "  analytics-service"
    echo "  nutrition-service"
    echo "  notification-service"
    echo "  notification-scheduler"
    echo "  user-service"
    echo "  metrics-collector"
    echo "  performance-optimizer"
    echo "  security-middleware"
    echo "  shared-logging"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build all services"
    echo "  $0 analytics-service   # Build only analytics-service"
}

# Check if help is requested
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Get the service name from first argument (optional)
SERVICE_NAME="$1"

echo "Building Rust Lambda functions..."

# Ensure we run from repo root regardless of where this script is invoked
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Install cargo-lambda if not already installed
if ! command -v cargo-lambda &> /dev/null; then
    echo "Installing cargo-lambda..."
    cargo install cargo-lambda
fi

# Ensure musl target is installed for static builds (avoids GLIBC requirements)
rustup target add x86_64-unknown-linux-musl >/dev/null 2>&1 || true

# Function to build a single service
build_service() {
    local service_name="$1"
    local service_dir="services/$service_name"
    
    if [[ ! -d "$service_dir" ]]; then
        echo "Error: Service directory '$service_dir' does not exist"
        echo "Available services:"
        ls -1 services/ | grep -v "^\\." | sed 's/^/  /'
        exit 1
    fi
    
    echo "Building $service_name..."
    cd "$service_dir"
    cargo lambda build --release --target x86_64-unknown-linux-musl --output-format zip --lambda-dir ./target/lambda/$service_name --flatten bootstrap
    cd target/lambda/$service_name && unzip bootstrap.zip && rm bootstrap.zip && cd "$REPO_ROOT/$service_dir"
    cd "$REPO_ROOT"
}

# If a specific service is requested, build only that service
if [[ -n "$SERVICE_NAME" ]]; then
    build_service "$SERVICE_NAME"
    echo "Lambda function '$SERVICE_NAME' built successfully!"
else
    # Build all services
    echo "Building all Lambda functions..."
    
    # Build auth layer
    echo "Building auth layer (crate, not used as layer artifact)..."
    cd services/auth-layer
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build user-profile-service
    echo "Building user-profile-service..."
    cd services/user-profile-service
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build workout-service
    echo "Building workout-service..."
    cd services/workout-service
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build coaching-service
    echo "Building coaching-service..."
    cd services/coaching-service
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build analytics-service
    echo "Building analytics-service..."
    cd services/analytics-service
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build nutrition-service
    echo "Building nutrition-service..."
    cd services/nutrition-service
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
    
    # Build notification-service
    echo "Building notification-service..."
    cd services/notification-service
    cargo lambda build --release --target x86_64-unknown-linux-musl --output-format zip --lambda-dir ./target/lambda/notification-service --flatten bootstrap
    cd target/lambda/notification-service && unzip bootstrap.zip && rm bootstrap.zip && cd ../../..
    cd ../..
    
    # Build notification-scheduler
    echo "Building notification-scheduler..."
    cd services/notification-scheduler
    cargo lambda build --release --target x86_64-unknown-linux-musl --output-format zip --lambda-dir ./target/lambda/notification-scheduler --flatten bootstrap
    cd target/lambda/notification-scheduler && unzip bootstrap.zip && rm bootstrap.zip && cd ../../..
    cd ../..
    
    # Build ai-service
    # echo "Building ai-service..."
    # cd services/ai-service
    # cargo lambda build --release --target x86_64-unknown-linux-gnu
    # cd ../..
    
    echo "All Lambda functions built successfully!"
fi
