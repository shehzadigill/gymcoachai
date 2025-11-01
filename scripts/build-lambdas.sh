#!/bin/bash

# Build script for Rust Lambda functions
set -e

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

# Function to build a specific service
build_service() {
    local service=$1
    echo "Building $service..."
    cd "services/$service"
    cargo lambda build --release --target x86_64-unknown-linux-musl
    cd ../..
}

# Check if a specific service is requested
if [ -z "$1" ]; then
    # Build all services
    build_service "auth-layer"
    build_service "user-profile-service"
    build_service "workout-service"
    build_service "coaching-service"
    build_service "analytics-service"
    build_service "nutrition-service"
    build_service "notification-service"
    build_service "notification-scheduler"
    # build_service "ai-service"  # Uncomment if needed
else
    # Build specific service
    case "$1" in
        auth-layer|user-profile-service|workout-service|coaching-service|analytics-service|nutrition-service|notification-service|notification-scheduler)
            build_service "$1"
            ;;
        *)
            echo "Unknown service: $1"
            echo "Available services: auth-layer, user-profile-service, workout-service, coaching-service, analytics-service, nutrition-service, notification-service, notification-scheduler"
            exit 1
            ;;
    esac
fi

echo "Build completed successfully!"