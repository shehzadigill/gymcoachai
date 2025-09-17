#!/bin/bash

# Build script for Rust Lambda functions
set -e

echo "Building Rust Lambda functions..."

# Install cargo-lambda if not already installed
if ! command -v cargo-lambda &> /dev/null; then
    echo "Installing cargo-lambda..."
    cargo install cargo-lambda
fi

# Build auth layer
echo "Building auth layer..."
cd services/auth-layer
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build user-profile-service
echo "Building user-profile-service..."
cd services/user-profile-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build workout-service
echo "Building workout-service..."
cd services/workout-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build coaching-service
echo "Building coaching-service..."
cd services/coaching-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build analytics-service
echo "Building analytics-service..."
cd services/analytics-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build nutrition-service
echo "Building nutrition-service..."
cd services/nutrition-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

# Build ai-service
echo "Building ai-service..."
cd services/ai-service
cargo lambda build --release --target x86_64-unknown-linux-gnu
cd ../..

echo "All Lambda functions built successfully!"
