#!/bin/bash

# Dependency installation script with error handling and retry mechanism
# This script ensures consistent dependency installation across local and CI environments

set -e

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5
INSTALL_TIMEOUT=600  # 10 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in CI environment
is_ci() {
    [ "${CI}" = "true" ] || [ -n "${GITHUB_ACTIONS}" ]
}

# Function to validate package.json and package-lock.json
validate_package_files() {
    log_info "Validating package files..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    if [ ! -f "package-lock.json" ]; then
        log_error "package-lock.json not found"
        exit 1
    fi
    
    # Check if package-lock.json is valid JSON
    if ! jq empty package-lock.json 2>/dev/null; then
        log_error "package-lock.json is not valid JSON"
        exit 1
    fi
    
    log_info "Package files validation passed"
}

# Function to clean npm cache if needed
clean_npm_cache() {
    log_info "Cleaning npm cache..."
    npm cache clean --force
}

# Function to install dependencies with retry mechanism
install_dependencies() {
    local attempt=1
    local install_cmd
    
    # Determine install command based on environment
    if is_ci; then
        install_cmd="npm ci --legacy-peer-deps --no-audit --no-fund"
        log_info "Using CI install command: $install_cmd"
    else
        install_cmd="npm install --legacy-peer-deps"
        log_info "Using local install command: $install_cmd"
    fi
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Dependency installation attempt $attempt/$MAX_RETRIES"
        
        # Run installation command with timeout handling
        if command -v timeout >/dev/null 2>&1; then
            # Use timeout if available (Linux/CI)
            if timeout $INSTALL_TIMEOUT $install_cmd; then
                log_info "Dependencies installed successfully"
                return 0
            else
                local exit_code=$?
                log_warn "Installation attempt $attempt failed with exit code $exit_code"
            fi
        else
            # Fallback for systems without timeout (macOS)
            if $install_cmd; then
                log_info "Dependencies installed successfully"
                return 0
            else
                local exit_code=$?
                log_warn "Installation attempt $attempt failed with exit code $exit_code"
            fi
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_info "Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
            
            # Clean cache before retry
            clean_npm_cache
        else
            log_error "All installation attempts failed"
            return ${exit_code:-1}
        fi
        
        ((attempt++))
    done
}

# Function to verify critical dependencies
verify_dependencies() {
    log_info "Verifying critical dependencies..."
    
    local critical_deps=(
        "react"
        "@testing-library/react"
        "jest"
        "typescript"
        "next"
    )
    
    for dep in "${critical_deps[@]}"; do
        if npm list "$dep" --depth=0 >/dev/null 2>&1; then
            local version=$(npm list "$dep" --depth=0 2>/dev/null | grep "$dep" | sed 's/.*@//' | sed 's/ .*//')
            log_info "✓ $dep@$version"
        else
            log_error "✗ $dep not found or not properly installed"
            return 1
        fi
    done
    
    log_info "All critical dependencies verified successfully"
}

# Function to check for peer dependency warnings
check_peer_dependencies() {
    log_info "Checking for peer dependency issues..."
    
    # Run npm ls to check for peer dependency issues
    if npm ls --depth=0 2>&1 | grep -i "peer dep" >/dev/null; then
        log_warn "Peer dependency warnings detected (this is expected with --legacy-peer-deps)"
    else
        log_info "No peer dependency issues detected"
    fi
}

# Function to display environment information
display_environment_info() {
    log_info "Environment Information:"
    echo "  Node.js version: $(node --version)"
    echo "  npm version: $(npm --version)"
    echo "  Platform: $(uname -s)"
    echo "  Architecture: $(uname -m)"
    echo "  CI Environment: $(is_ci && echo "Yes" || echo "No")"
    echo "  Working Directory: $(pwd)"
}

# Main execution
main() {
    log_info "Starting dependency installation process..."
    
    display_environment_info
    validate_package_files
    install_dependencies
    verify_dependencies
    check_peer_dependencies
    
    log_info "Dependency installation completed successfully!"
}

# Handle script interruption
trap 'log_error "Script interrupted"; exit 130' INT TERM

# Execute main function
main "$@"