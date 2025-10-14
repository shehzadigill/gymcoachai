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
cargo lambda build --release --target x86_64-unknown-linux-musl
cd ../..

# Build notification-scheduler
echo "Building notification-scheduler..."
cd services/notification-scheduler
cargo lambda build --release --target x86_64-unknown-linux-musl
cd ../..

# Build ai-service
# echo "Building ai-service..."
# cd services/ai-service
# cargo lambda build --release --target x86_64-unknown-linux-gnu
# cd ../..

echo "All Lambda functions built successfully!"