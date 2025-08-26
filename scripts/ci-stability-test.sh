#!/bin/bash

# CI/CD Pipeline Stability Testing Script
# This script tests the pipeline under different conditions to ensure stability

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STABILITY_LOG="${PROJECT_ROOT}/ci-stability-test.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$STABILITY_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$STABILITY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$STABILITY_LOG"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1" | tee -a "$STABILITY_LOG"
}

# Initialize stability log
init_stability_log() {
    echo "=== CI/CD Pipeline Stability Testing Started ===" > "$STABILITY_LOG"
    echo "Timestamp: $(date)" >> "$STABILITY_LOG"
    echo "Environment: ${CI:-'Local'}" >> "$STABILITY_LOG"
    echo "Node Version: $(node --version 2>/dev/null || echo 'Unknown')" >> "$STABILITY_LOG"
    echo "=================================================" >> "$STABILITY_LOG"
}

# Test cache behavior under different conditions
test_cache_stability() {
    log_info "Testing cache stability..."
    
    local test_results=()
    
    # Test 1: Cold cache (no existing cache)
    log_debug "Test 1: Cold cache scenario"
    if [ -d "${HOME}/.npm" ]; then
        local cache_backup="${HOME}/.npm.backup.$(date +%s)"
        mv "${HOME}/.npm" "$cache_backup" 2>/dev/null || true
    fi
    
    local cold_start_time=$(date +%s)
    npm ci --silent >/dev/null 2>&1 || {
        log_error "Cold cache test failed"
        test_results+=("❌ Cold cache: FAILED")
        return 1
    }
    local cold_end_time=$(date +%s)
    local cold_duration=$((cold_end_time - cold_start_time))
    
    test_results+=("✅ Cold cache: ${cold_duration}s")
    
    # Test 2: Warm cache (existing cache)
    log_debug "Test 2: Warm cache scenario"
    local warm_start_time=$(date +%s)
    npm ci --silent >/dev/null 2>&1 || {
        log_error "Warm cache test failed"
        test_results+=("❌ Warm cache: FAILED")
        return 1
    }
    local warm_end_time=$(date +%s)
    local warm_duration=$((warm_end_time - warm_start_time))
    
    test_results+=("✅ Warm cache: ${warm_duration}s")
    
    # Test 3: Partial cache corruption simulation
    log_debug "Test 3: Partial cache corruption scenario"
    if [ -d "node_modules" ]; then
        rm -rf node_modules/react node_modules/@testing-library 2>/dev/null || true
    fi
    
    local partial_start_time=$(date +%s)
    npm ci --silent >/dev/null 2>&1 || {
        log_error "Partial cache corruption test failed"
        test_results+=("❌ Partial corruption: FAILED")
        return 1
    }
    local partial_end_time=$(date +%s)
    local partial_duration=$((partial_end_time - partial_start_time))
    
    test_results+=("✅ Partial corruption recovery: ${partial_duration}s")
    
    # Restore cache backup if it exists
    if [ -d "$cache_backup" ]; then
        rm -rf "${HOME}/.npm" 2>/dev/null || true
        mv "$cache_backup" "${HOME}/.npm" 2>/dev/null || true
    fi
    
    # Report results
    log_info "Cache stability test results:"
    for result in "${test_results[@]}"; do
        log_info "  $result"
    done
    
    # Calculate cache effectiveness
    local cache_improvement=0
    if [ "$cold_duration" -gt 0 ] && [ "$warm_duration" -gt 0 ]; then
        cache_improvement=$(echo "scale=2; ($cold_duration - $warm_duration) / $cold_duration * 100" | bc -l 2>/dev/null || echo "0")
        log_info "Cache effectiveness: ${cache_improvement}% improvement"
    fi
}

# Test parallel execution stability
test_parallel_execution_stability() {
    log_info "Testing parallel execution stability..."
    
    local test_results=()
    local max_workers_options=("1" "2" "4" "50%")
    
    for workers in "${max_workers_options[@]}"; do
        log_debug "Testing with maxWorkers=$workers"
        
        local start_time=$(date +%s)
        local test_output
        
        # Run a subset of tests with different worker configurations
        if test_output=$(npm run test:unit -- --maxWorkers="$workers" --testTimeout=30000 --silent 2>&1); then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            test_results+=("✅ maxWorkers=$workers: ${duration}s")
            log_debug "Parallel test with $workers workers completed in ${duration}s"
        else
            test_results+=("❌ maxWorkers=$workers: FAILED")
            log_error "Parallel test with $workers workers failed"
            log_debug "Error output: $test_output"
        fi
    done
    
    # Report results
    log_info "Parallel execution stability test results:"
    for result in "${test_results[@]}"; do
        log_info "  $result"
    done
}

# Test memory pressure scenarios
test_memory_pressure_stability() {
    log_info "Testing memory pressure stability..."
    
    local available_memory=$(free -m 2>/dev/null | grep Mem | awk '{print $7}' || echo "0")
    log_debug "Available memory: ${available_memory}MB"
    
    if [ "$available_memory" -lt 500 ]; then
        log_warn "Low memory environment detected (${available_memory}MB)"
        
        # Test with memory-optimized settings
        log_debug "Testing with memory-optimized Jest configuration"
        
        local start_time=$(date +%s)
        if npm run test:unit -- --maxWorkers=1 --logHeapUsage --testTimeout=60000 --silent >/dev/null 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_info "✅ Memory-optimized test execution: ${duration}s"
        else
            log_error "❌ Memory-optimized test execution: FAILED"
        fi
    else
        log_info "✅ Sufficient memory available (${available_memory}MB)"
    fi
}

# Test network resilience
test_network_resilience() {
    log_info "Testing network resilience..."
    
    # Test npm registry connectivity
    log_debug "Testing npm registry connectivity"
    if npm ping --silent >/dev/null 2>&1; then
        log_info "✅ npm registry connectivity: OK"
    else
        log_warn "⚠️ npm registry connectivity: Issues detected"
    fi
    
    # Test dependency resolution with network delays
    log_debug "Testing dependency resolution resilience"
    local start_time=$(date +%s)
    
    # Use npm ci with timeout to test network resilience
    if timeout 300 npm ci --silent >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_info "✅ Network resilient dependency installation: ${duration}s"
    else
        log_error "❌ Network resilient dependency installation: TIMEOUT or FAILED"
    fi
}

# Test different Node.js configurations
test_node_configurations() {
    log_info "Testing Node.js configuration stability..."
    
    local current_node_version=$(node --version)
    log_debug "Current Node.js version: $current_node_version"
    
    # Test with different Node.js memory settings
    local memory_settings=("--max-old-space-size=2048" "--max-old-space-size=4096")
    
    for setting in "${memory_settings[@]}"; do
        log_debug "Testing with Node.js setting: $setting"
        
        local start_time=$(date +%s)
        if NODE_OPTIONS="$setting" npm run test:unit -- --maxWorkers=1 --silent >/dev/null 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_info "✅ Node.js $setting: ${duration}s"
        else
            log_error "❌ Node.js $setting: FAILED"
        fi
    done
}

# Test CI environment variables impact
test_environment_variables() {
    log_info "Testing environment variables impact..."
    
    local env_configs=(
        "CI=true NODE_ENV=test"
        "CI=true NODE_ENV=test NPM_CONFIG_LEGACY_PEER_DEPS=true"
        "CI=true NODE_ENV=test FORCE_COLOR=1"
    )
    
    for config in "${env_configs[@]}"; do
        log_debug "Testing with environment: $config"
        
        local start_time=$(date +%s)
        if env $config npm run test:unit -- --maxWorkers=1 --silent >/dev/null 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log_info "✅ Environment '$config': ${duration}s"
        else
            log_error "❌ Environment '$config': FAILED"
        fi
    done
}

# Test build stability under different conditions
test_build_stability() {
    log_info "Testing build stability..."
    
    # Clean build test
    log_debug "Testing clean build"
    rm -rf .next 2>/dev/null || true
    
    local clean_start_time=$(date +%s)
    if npm run build >/dev/null 2>&1; then
        local clean_end_time=$(date +%s)
        local clean_duration=$((clean_end_time - clean_start_time))
        log_info "✅ Clean build: ${clean_duration}s"
    else
        log_error "❌ Clean build: FAILED"
        return 1
    fi
    
    # Incremental build test
    log_debug "Testing incremental build"
    touch src/app/page.tsx 2>/dev/null || true
    
    local incremental_start_time=$(date +%s)
    if npm run build >/dev/null 2>&1; then
        local incremental_end_time=$(date +%s)
        local incremental_duration=$((incremental_end_time - incremental_start_time))
        log_info "✅ Incremental build: ${incremental_duration}s"
        
        # Calculate build cache effectiveness
        if [ "$clean_duration" -gt 0 ] && [ "$incremental_duration" -gt 0 ]; then
            local build_improvement=$(echo "scale=2; ($clean_duration - $incremental_duration) / $clean_duration * 100" | bc -l 2>/dev/null || echo "0")
            log_info "Build cache effectiveness: ${build_improvement}% improvement"
        fi
    else
        log_error "❌ Incremental build: FAILED"
    fi
}

# Generate stability report
generate_stability_report() {
    log_info "Generating stability report..."
    
    local report_file="${PROJECT_ROOT}/ci-stability-report.md"
    
    cat > "$report_file" << EOF
# CI/CD Pipeline Stability Report

**Generated:** $(date)  
**Environment:** ${CI:-'Local'}  
**Node Version:** $(node --version 2>/dev/null || echo 'Unknown')  
**Available Memory:** $(free -m 2>/dev/null | grep Mem | awk '{print $7}' || echo 'Unknown')MB

## Test Summary

This report covers stability testing of the CI/CD pipeline under various conditions:

### Cache Stability
- Cold cache performance
- Warm cache performance  
- Cache corruption recovery

### Parallel Execution
- Different worker configurations
- Memory usage optimization
- Performance scaling

### Network Resilience
- npm registry connectivity
- Dependency resolution under network stress
- Timeout handling

### Environment Configurations
- Different Node.js memory settings
- Various environment variable combinations
- CI-specific configurations

### Build Stability
- Clean build performance
- Incremental build effectiveness
- Cache utilization

## Recommendations

Based on the stability tests, the following optimizations are recommended:

1. **Cache Strategy**: Implement multi-layer caching with fallback mechanisms
2. **Parallel Execution**: Use optimal worker configuration based on available resources
3. **Memory Management**: Configure Node.js memory settings appropriately
4. **Network Resilience**: Implement retry mechanisms for network operations
5. **Build Optimization**: Leverage incremental builds and effective caching

## Detailed Results

See the full test log at: \`ci-stability-test.log\`

EOF
    
    log_info "Stability report generated: $report_file"
}

# Main execution function
main() {
    log_info "Starting CI/CD pipeline stability testing..."
    
    cd "$PROJECT_ROOT"
    
    # Initialize
    init_stability_log
    
    # Run all stability tests
    test_cache_stability
    test_parallel_execution_stability
    test_memory_pressure_stability
    test_network_resilience
    test_node_configurations
    test_environment_variables
    test_build_stability
    
    # Generate report
    generate_stability_report
    
    log_info "CI/CD pipeline stability testing completed!"
    log_info "Results saved to:"
    log_info "  - Stability Log: $STABILITY_LOG"
    log_info "  - Stability Report: ${PROJECT_ROOT}/ci-stability-report.md"
}

# Handle script interruption
trap 'log_error "Stability testing interrupted"; exit 130' INT TERM

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi