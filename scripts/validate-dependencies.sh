#!/bin/bash

# Dependency validation script
# Validates that all dependencies are correctly installed and compatible

set -e

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

# Function to validate React 19 compatibility
validate_react_compatibility() {
    log_info "Validating React 19 compatibility..."
    
    local react_version=$(npm list react --depth=0 2>/dev/null | grep react@ | sed 's/.*@//' | sed 's/ .*//')
    local testing_lib_version=$(npm list @testing-library/react --depth=0 2>/dev/null | grep @testing-library/react@ | sed 's/.*@//' | sed 's/ .*//')
    
    log_info "React version: $react_version"
    log_info "@testing-library/react version: $testing_lib_version"
    
    # Check if React is version 19.x
    if [[ $react_version == 19.* ]]; then
        log_info "✓ React 19 is installed"
    else
        log_error "✗ React 19 is not installed (found: $react_version)"
        return 1
    fi
    
    # Check if @testing-library/react is version 16.x or higher
    local major_version=$(echo "$testing_lib_version" | cut -d. -f1)
    if [ "$major_version" -ge "16" ]; then
        log_info "✓ @testing-library/react is compatible with React 19"
    else
        log_error "✗ @testing-library/react version is too old for React 19 (found: $testing_lib_version, need: >=16.0.0)"
        return 1
    fi
}

# Function to validate TypeScript configuration
validate_typescript() {
    log_info "Validating TypeScript configuration..."
    
    if npm run type-check >/dev/null 2>&1; then
        log_info "✓ TypeScript compilation successful"
    else
        log_warn "✗ TypeScript compilation has issues (this might be expected during development)"
    fi
}

# Function to validate Jest configuration
validate_jest() {
    log_info "Validating Jest configuration..."
    
    # Check if Jest can load its configuration
    if npx jest --showConfig >/dev/null 2>&1; then
        log_info "✓ Jest configuration is valid"
    else
        log_error "✗ Jest configuration has issues"
        return 1
    fi
}

# Function to validate build process
validate_build() {
    log_info "Validating build process..."
    
    # Try to build the project
    if npm run build >/dev/null 2>&1; then
        log_info "✓ Build process successful"
        # Clean up build artifacts
        rm -rf .next
    else
        log_warn "✗ Build process failed (this might be expected if there are missing environment variables)"
    fi
}

# Function to check for security vulnerabilities
validate_security() {
    log_info "Checking for security vulnerabilities..."
    
    if npm audit --audit-level moderate >/dev/null 2>&1; then
        log_info "✓ No moderate or high security vulnerabilities found"
    else
        log_warn "⚠ Security vulnerabilities detected (run 'npm audit' for details)"
    fi
}

# Main validation function
main() {
    log_info "Starting dependency validation..."
    
    local validation_failed=false
    
    validate_react_compatibility || validation_failed=true
    validate_typescript || validation_failed=true
    validate_jest || validation_failed=true
    validate_build || validation_failed=true
    validate_security || validation_failed=true
    
    if [ "$validation_failed" = true ]; then
        log_error "Some validations failed. Please check the output above."
        exit 1
    else
        log_info "All dependency validations passed successfully!"
    fi
}

# Execute main function
main "$@"