#!/bin/bash

# Local development setup script
# Ensures local environment matches CI environment for dependency installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check Node.js version
check_node_version() {
    log_step "Checking Node.js version..."
    
    local required_version="18"
    local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
    
    if [ "$current_version" -ge "$required_version" ]; then
        log_info "Node.js version $(node --version) is compatible (>= v$required_version)"
    else
        log_error "Node.js version $(node --version) is not compatible. Required: >= v$required_version"
        log_info "Please update Node.js to version $required_version or higher"
        exit 1
    fi
}

# Function to check npm version
check_npm_version() {
    log_step "Checking npm version..."
    
    local npm_version=$(npm --version)
    log_info "npm version: $npm_version"
    
    # Check if npm version is at least 8.x
    local major_version=$(echo "$npm_version" | cut -d. -f1)
    if [ "$major_version" -ge "8" ]; then
        log_info "npm version is compatible"
    else
        log_warn "npm version might be outdated. Consider updating to npm 8.x or higher"
    fi
}

# Function to setup npm configuration for consistency with CI
setup_npm_config() {
    log_step "Setting up npm configuration..."
    
    # Set legacy peer deps globally for this project
    npm config set legacy-peer-deps true
    log_info "Set legacy-peer-deps to true"
    
    # Set audit level to avoid blocking on audit issues
    npm config set audit-level moderate
    log_info "Set audit-level to moderate"
    
    # Set fund to false to reduce noise
    npm config set fund false
    log_info "Set fund to false"
}

# Function to clean existing installation
clean_installation() {
    log_step "Cleaning existing installation..."
    
    if [ -d "node_modules" ]; then
        log_info "Removing existing node_modules..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        log_info "Backing up existing package-lock.json..."
        cp package-lock.json package-lock.json.backup
    fi
    
    log_info "Cleaning npm cache..."
    npm cache clean --force
}

# Function to install dependencies
install_dependencies() {
    log_step "Installing dependencies..."
    
    # Use the same script as CI for consistency
    if [ -f "scripts/install-dependencies.sh" ]; then
        log_info "Using install-dependencies.sh script for consistency with CI"
        ./scripts/install-dependencies.sh
    else
        log_warn "install-dependencies.sh not found, using fallback method"
        npm install --legacy-peer-deps
    fi
}

# Function to verify installation
verify_installation() {
    log_step "Verifying installation..."
    
    # Check if critical scripts work
    local test_scripts=("lint" "type-check" "test:unit")
    
    for script in "${test_scripts[@]}"; do
        if npm run "$script" --silent >/dev/null 2>&1; then
            log_info "✓ npm run $script works"
        else
            log_warn "✗ npm run $script failed (this might be expected if no tests exist yet)"
        fi
    done
}

# Function to create .nvmrc file for Node version consistency
create_nvmrc() {
    log_step "Creating .nvmrc file for Node version consistency..."
    
    local node_version=$(node --version)
    echo "$node_version" > .nvmrc
    log_info "Created .nvmrc with Node.js version $node_version"
}

# Function to display setup summary
display_summary() {
    log_step "Setup Summary"
    echo "  Node.js version: $(node --version)"
    echo "  npm version: $(npm --version)"
    echo "  Project directory: $(pwd)"
    echo "  Dependencies installed: $([ -d "node_modules" ] && echo "Yes" || echo "No")"
    echo "  package-lock.json exists: $([ -f "package-lock.json" ] && echo "Yes" || echo "No")"
    
    log_info "Local development environment is now consistent with CI!"
    log_info "You can now run:"
    echo "  - npm run dev (start development server)"
    echo "  - npm run test (run tests)"
    echo "  - npm run build (build for production)"
}

# Main execution
main() {
    log_info "Setting up local development environment..."
    log_info "This script ensures your local environment matches the CI environment"
    echo
    
    check_node_version
    check_npm_version
    setup_npm_config
    clean_installation
    install_dependencies
    verify_installation
    create_nvmrc
    
    echo
    display_summary
}

# Handle script interruption
trap 'log_error "Setup interrupted"; exit 130' INT TERM

# Execute main function
main "$@"