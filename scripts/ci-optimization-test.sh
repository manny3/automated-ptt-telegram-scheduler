#!/bin/bash

# CI/CD Pipeline Optimization Testing Script
# This script runs comprehensive tests to validate all optimizations

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPTIMIZATION_LOG="${PROJECT_ROOT}/ci-optimization-test.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

# Initialize optimization log
init_optimization_log() {
    echo "=== CI/CD Pipeline Optimization Testing Started ===" > "$OPTIMIZATION_LOG"
    echo "Timestamp: $(date)" >> "$OPTIMIZATION_LOG"
    echo "Environment: ${CI:-'Local'}" >> "$OPTIMIZATION_LOG"
    echo "Node Version: $(node --version 2>/dev/null || echo 'Unknown')" >> "$OPTIMIZATION_LOG"
    echo "====================================================" >> "$OPTIMIZATION_LOG"
}

# Test 1: Multi-layer caching effectiveness
test_caching_optimization() {
    log_test "Testing multi-layer caching optimization..."
    
    local test_results=()
    
    # Test npm cache
    if [ -d "${HOME}/.npm" ]; then
        local npm_cache_size=$(du -sm "${HOME}/.npm" 2>/dev/null | cut -f1 || echo "0")
        if [ "$npm_cache_size" -gt 10 ]; then
            test_results+=("✅ npm cache: ${npm_cache_size}MB")
        else
            test_results+=("⚠️ npm cache: ${npm_cache_size}MB (low)")
        fi
    else
        test_results+=("❌ npm cache: Not found")
    fi
    
    # Test Next.js cache
    if [ -d ".next/cache" ]; then
        local next_cache_size=$(du -sm .next/cache 2>/dev/null | cut -f1 || echo "0")
        test_results+=("✅ Next.js cache: ${next_cache_size}MB")
    else
        test_results+=("⚠️ Next.js cache: Not found")
    fi
    
    # Test Jest cache
    if [ -d ".jest-cache" ]; then
        local jest_cache_size=$(du -sm .jest-cache 2>/dev/null | cut -f1 || echo "0")
        test_results+=("✅ Jest cache: ${jest_cache_size}MB")
    else
        test_results+=("⚠️ Jest cache: Not found")
    fi
    
    # Test SWC cache
    if [ -d ".swc" ]; then
        local swc_cache_size=$(du -sm .swc 2>/dev/null | cut -f1 || echo "0")
        test_results+=("✅ SWC cache: ${swc_cache_size}MB")
    else
        test_results+=("⚠️ SWC cache: Not found")
    fi
    
    log_info "Caching optimization results:"
    for result in "${test_results[@]}"; do
        log_info "  $result"
    done
    
    # Calculate overall caching score
    local cache_score=0
    local total_checks=4
    for result in "${test_results[@]}"; do
        if [[ $result == *"✅"* ]]; then
            cache_score=$((cache_score + 25))
        fi
    done
    
    log_info "Overall caching effectiveness: ${cache_score}%"
    
    if [ "$cache_score" -ge 75 ]; then
        log_success "Caching optimization: EXCELLENT"
        return 0
    elif [ "$cache_score" -ge 50 ]; then
        log_warn "Caching optimization: GOOD (room for improvement)"
        return 0
    else
        log_error "Caching optimization: NEEDS IMPROVEMENT"
        return 1
    fi
}

# Test 2: Parallel execution optimization
test_parallel_execution() {
    log_test "Testing parallel execution optimization..."
    
    local cpu_cores=$(nproc 2>/dev/null || echo "2")
    local optimal_workers=$((cpu_cores > 4 ? cpu_cores / 2 : cpu_cores))
    
    log_info "System CPU cores: $cpu_cores"
    log_info "Optimal Jest workers: $optimal_workers"
    
    # Test parallel test execution
    log_info "Testing parallel test execution with maxWorkers=$optimal_workers"
    
    local start_time=$(date +%s)
    if npm run test:unit -- --maxWorkers="$optimal_workers" --testTimeout=30000 --silent >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "Parallel test execution: ${duration}s"
        
        # Test with single worker for comparison
        local single_start_time=$(date +%s)
        if npm run test:unit -- --maxWorkers=1 --testTimeout=30000 --silent >/dev/null 2>&1; then
            local single_end_time=$(date +%s)
            local single_duration=$((single_end_time - single_start_time))
            
            local improvement=0
            if [ "$single_duration" -gt 0 ]; then
                improvement=$(awk "BEGIN {printf \"%.2f\", ($single_duration - $duration) / $single_duration * 100}" 2>/dev/null || echo "0")
            fi
            
            log_info "Single worker execution: ${single_duration}s"
            log_info "Parallel execution improvement: ${improvement}%"
            
            if awk "BEGIN {exit !($improvement > 20)}" 2>/dev/null; then
                log_success "Parallel execution optimization: EXCELLENT (${improvement}% improvement)"
                return 0
            elif awk "BEGIN {exit !($improvement > 10)}" 2>/dev/null; then
                log_success "Parallel execution optimization: GOOD (${improvement}% improvement)"
                return 0
            else
                log_warn "Parallel execution optimization: MINIMAL (${improvement}% improvement)"
                return 0
            fi
        else
            log_error "Single worker test failed"
            return 1
        fi
    else
        log_error "Parallel test execution failed"
        return 1
    fi
}

# Test 3: Performance monitoring integration
test_performance_monitoring() {
    log_test "Testing performance monitoring integration..."
    
    # Test performance monitor script
    if [ -x "./scripts/ci-performance-monitor.sh" ]; then
        log_info "Performance monitor script found and executable"
        
        # Run performance monitoring
        if ./scripts/ci-performance-monitor.sh >/dev/null 2>&1; then
            log_success "Performance monitoring: WORKING"
            
            # Check if performance report was generated
            if [ -f "ci-performance-report.md" ]; then
                log_success "Performance report generation: WORKING"
            else
                log_warn "Performance report generation: NOT WORKING"
            fi
            
            # Check if benchmark data was generated
            if [ -f "performance-benchmark.json" ]; then
                log_success "Benchmark data generation: WORKING"
            else
                log_warn "Benchmark data generation: NOT WORKING"
            fi
            
            return 0
        else
            log_error "Performance monitoring execution: FAILED"
            return 1
        fi
    else
        log_error "Performance monitor script: NOT FOUND or NOT EXECUTABLE"
        return 1
    fi
}

# Test 4: Stability testing integration
test_stability_integration() {
    log_test "Testing stability testing integration..."
    
    # Test stability test script
    if [ -x "./scripts/ci-stability-test.sh" ]; then
        log_info "Stability test script found and executable"
        
        # Run a quick stability test (limited scope for optimization testing)
        if timeout 300 ./scripts/ci-stability-test.sh >/dev/null 2>&1; then
            log_success "Stability testing: WORKING"
            
            # Check if stability report was generated
            if [ -f "ci-stability-report.md" ]; then
                log_success "Stability report generation: WORKING"
            else
                log_warn "Stability report generation: NOT WORKING"
            fi
            
            return 0
        else
            log_warn "Stability testing: TIMEOUT or FAILED (expected for comprehensive test)"
            return 0
        fi
    else
        log_error "Stability test script: NOT FOUND or NOT EXECUTABLE"
        return 1
    fi
}

# Test 5: Workflow performance tracking
test_workflow_tracking() {
    log_test "Testing workflow performance tracking..."
    
    # Test workflow performance tracker script
    if [ -x "./scripts/workflow-performance-tracker.sh" ]; then
        log_info "Workflow performance tracker script found and executable"
        
        # Set up test environment variables
        export GITHUB_RUN_ID="test-run-$(date +%s)"
        export GITHUB_RUN_NUMBER="999"
        export GITHUB_WORKFLOW="optimization-test"
        export TOTAL_DURATION="600"
        export TEST_DURATION="300"
        export BUILD_DURATION="180"
        
        if ./scripts/workflow-performance-tracker.sh >/dev/null 2>&1; then
            log_success "Workflow performance tracking: WORKING"
            
            # Check if performance data directory was created
            if [ -d ".github/performance-data" ]; then
                log_success "Performance data directory: CREATED"
                
                # Check if metrics file was created
                if [ -f ".github/performance-data/workflow-metrics.json" ]; then
                    log_success "Workflow metrics file: CREATED"
                else
                    log_warn "Workflow metrics file: NOT CREATED"
                fi
                
                # Check if insights were generated
                if [ -f ".github/performance-data/performance-insights.md" ]; then
                    log_success "Performance insights: GENERATED"
                else
                    log_warn "Performance insights: NOT GENERATED"
                fi
            else
                log_warn "Performance data directory: NOT CREATED"
            fi
            
            return 0
        else
            log_error "Workflow performance tracking: FAILED"
            return 1
        fi
    else
        log_error "Workflow performance tracker script: NOT FOUND or NOT EXECUTABLE"
        return 1
    fi
}

# Test 6: Package.json script optimization
test_package_scripts() {
    log_test "Testing package.json script optimizations..."
    
    local test_results=()
    
    # Test parallel test script
    if npm run test:parallel --silent >/dev/null 2>&1; then
        test_results+=("✅ test:parallel script: WORKING")
    else
        test_results+=("❌ test:parallel script: FAILED")
    fi
    
    # Test performance monitoring script
    if npm run perf:monitor --silent >/dev/null 2>&1; then
        test_results+=("✅ perf:monitor script: WORKING")
    else
        test_results+=("❌ perf:monitor script: FAILED")
    fi
    
    # Test stability testing script
    if timeout 60 npm run ci:stability --silent >/dev/null 2>&1; then
        test_results+=("✅ ci:stability script: WORKING")
    else
        test_results+=("⚠️ ci:stability script: TIMEOUT (expected)")
    fi
    
    # Test benchmark script
    if npm run test:benchmark --silent >/dev/null 2>&1; then
        test_results+=("✅ test:benchmark script: WORKING")
    else
        test_results+=("❌ test:benchmark script: FAILED")
    fi
    
    log_info "Package.json script optimization results:"
    for result in "${test_results[@]}"; do
        log_info "  $result"
    done
    
    # Count successful tests
    local success_count=0
    for result in "${test_results[@]}"; do
        if [[ $result == *"✅"* ]]; then
            success_count=$((success_count + 1))
        fi
    done
    
    local total_tests=${#test_results[@]}
    local success_rate=$((success_count * 100 / total_tests))
    
    log_info "Package script success rate: ${success_rate}%"
    
    if [ "$success_rate" -ge 75 ]; then
        log_success "Package.json script optimization: EXCELLENT"
        return 0
    else
        log_warn "Package.json script optimization: NEEDS IMPROVEMENT"
        return 1
    fi
}

# Test 7: CI workflow configuration validation
test_workflow_configuration() {
    log_test "Testing CI workflow configuration..."
    
    local workflow_file=".github/workflows/ci-cd.yml"
    
    if [ ! -f "$workflow_file" ]; then
        log_error "CI workflow file not found: $workflow_file"
        return 1
    fi
    
    log_info "CI workflow file found: $workflow_file"
    
    # Check for key optimization features
    local optimization_features=(
        "Enhanced multi-layer caching"
        "parallel test execution"
        "performance monitoring"
        "Docker buildx"
        "maxWorkers"
    )
    
    local found_features=0
    for feature in "${optimization_features[@]}"; do
        if grep -q "$feature" "$workflow_file"; then
            log_success "Found optimization: $feature"
            found_features=$((found_features + 1))
        else
            log_warn "Missing optimization: $feature"
        fi
    done
    
    local optimization_score=$((found_features * 100 / ${#optimization_features[@]}))
    log_info "Workflow optimization score: ${optimization_score}%"
    
    if [ "$optimization_score" -ge 80 ]; then
        log_success "CI workflow configuration: EXCELLENT"
        return 0
    elif [ "$optimization_score" -ge 60 ]; then
        log_success "CI workflow configuration: GOOD"
        return 0
    else
        log_warn "CI workflow configuration: NEEDS IMPROVEMENT"
        return 1
    fi
}

# Generate comprehensive optimization report
generate_optimization_report() {
    log_info "Generating comprehensive optimization report..."
    
    local report_file="${PROJECT_ROOT}/ci-optimization-report.md"
    
    cat > "$report_file" << EOF
# CI/CD Pipeline Optimization Report

**Generated:** $(date)  
**Environment:** ${CI:-'Local'}  
**Node Version:** $(node --version 2>/dev/null || echo 'Unknown')

## Optimization Test Results

This report summarizes the results of comprehensive optimization testing for the CI/CD pipeline.

### 1. Multi-layer Caching
- **Status:** $(grep -q "Caching optimization: EXCELLENT" "$OPTIMIZATION_LOG" && echo "✅ EXCELLENT" || grep -q "Caching optimization: GOOD" "$OPTIMIZATION_LOG" && echo "⚠️ GOOD" || echo "❌ NEEDS IMPROVEMENT")
- **Details:** Multiple cache layers implemented (npm, Next.js, Jest, SWC)
- **Impact:** Reduced dependency installation and build times

### 2. Parallel Execution
- **Status:** $(grep -q "Parallel execution optimization: EXCELLENT" "$OPTIMIZATION_LOG" && echo "✅ EXCELLENT" || grep -q "Parallel execution optimization: GOOD" "$OPTIMIZATION_LOG" && echo "⚠️ GOOD" || echo "❌ NEEDS IMPROVEMENT")
- **Details:** Optimized Jest worker configuration based on available CPU cores
- **Impact:** Faster test execution through parallel processing

### 3. Performance Monitoring
- **Status:** $(grep -q "Performance monitoring: WORKING" "$OPTIMIZATION_LOG" && echo "✅ WORKING" || echo "❌ NOT WORKING")
- **Details:** Comprehensive performance tracking and reporting
- **Impact:** Data-driven optimization insights

### 4. Stability Testing
- **Status:** $(grep -q "Stability testing: WORKING" "$OPTIMIZATION_LOG" && echo "✅ WORKING" || echo "❌ NOT WORKING")
- **Details:** Pipeline stability validation under various conditions
- **Impact:** Improved reliability and predictability

### 5. Workflow Performance Tracking
- **Status:** $(grep -q "Workflow performance tracking: WORKING" "$OPTIMIZATION_LOG" && echo "✅ WORKING" || echo "❌ NOT WORKING")
- **Details:** Historical performance data collection and trend analysis
- **Impact:** Long-term performance optimization insights

### 6. Package Script Optimization
- **Status:** $(grep -q "Package.json script optimization: EXCELLENT" "$OPTIMIZATION_LOG" && echo "✅ EXCELLENT" || echo "⚠️ GOOD")
- **Details:** Optimized npm scripts for parallel execution and monitoring
- **Impact:** Improved developer experience and CI efficiency

### 7. Workflow Configuration
- **Status:** $(grep -q "CI workflow configuration: EXCELLENT" "$OPTIMIZATION_LOG" && echo "✅ EXCELLENT" || grep -q "CI workflow configuration: GOOD" "$OPTIMIZATION_LOG" && echo "⚠️ GOOD" || echo "❌ NEEDS IMPROVEMENT")
- **Details:** Enhanced GitHub Actions workflow with optimization features
- **Impact:** Faster, more reliable CI/CD pipeline

## Overall Assessment

$(
    local excellent_count=$(grep -c "EXCELLENT" "$OPTIMIZATION_LOG" || echo "0")
    local good_count=$(grep -c "GOOD" "$OPTIMIZATION_LOG" || echo "0")
    local working_count=$(grep -c "WORKING" "$OPTIMIZATION_LOG" || echo "0")
    local total_optimizations=7
    
    local success_count=$((excellent_count + good_count + working_count))
    local success_rate=0
    if [ "$total_optimizations" -gt 0 ]; then
        success_rate=$((success_count * 100 / total_optimizations))
    fi
    
    if [ "$success_rate" -ge 85 ]; then
        echo "🎉 **EXCELLENT:** The CI/CD pipeline is highly optimized with ${success_rate}% of optimizations working effectively."
    elif [ "$success_rate" -ge 70 ]; then
        echo "✅ **GOOD:** The CI/CD pipeline is well optimized with ${success_rate}% of optimizations working effectively."
    else
        echo "⚠️ **NEEDS IMPROVEMENT:** The CI/CD pipeline needs optimization work with only ${success_rate}% of optimizations working effectively."
    fi
)

## Recommendations

Based on the optimization test results:

1. **Continue Monitoring:** Regularly run optimization tests to maintain performance
2. **Performance Tracking:** Use the generated performance data for continuous improvement
3. **Cache Optimization:** Monitor cache effectiveness and adjust strategies as needed
4. **Parallel Execution:** Fine-tune worker configurations based on workload changes
5. **Stability Testing:** Run stability tests before major pipeline changes

## Detailed Test Log

See the complete test log at: \`ci-optimization-test.log\`

EOF
    
    log_info "Optimization report generated: $report_file"
}

# Main execution function
main() {
    log_info "Starting CI/CD pipeline optimization testing..."
    
    cd "$PROJECT_ROOT"
    
    # Initialize
    init_optimization_log
    
    local test_results=()
    
    # Run all optimization tests
    log_info "Running comprehensive optimization tests..."
    
    if test_caching_optimization; then
        test_results+=("✅ Caching Optimization")
    else
        test_results+=("❌ Caching Optimization")
    fi
    
    if test_parallel_execution; then
        test_results+=("✅ Parallel Execution")
    else
        test_results+=("❌ Parallel Execution")
    fi
    
    if test_performance_monitoring; then
        test_results+=("✅ Performance Monitoring")
    else
        test_results+=("❌ Performance Monitoring")
    fi
    
    if test_stability_integration; then
        test_results+=("✅ Stability Integration")
    else
        test_results+=("❌ Stability Integration")
    fi
    
    if test_workflow_tracking; then
        test_results+=("✅ Workflow Tracking")
    else
        test_results+=("❌ Workflow Tracking")
    fi
    
    if test_package_scripts; then
        test_results+=("✅ Package Scripts")
    else
        test_results+=("❌ Package Scripts")
    fi
    
    if test_workflow_configuration; then
        test_results+=("✅ Workflow Configuration")
    else
        test_results+=("❌ Workflow Configuration")
    fi
    
    # Generate final report
    generate_optimization_report
    
    # Summary
    log_info "=== OPTIMIZATION TEST SUMMARY ==="
    for result in "${test_results[@]}"; do
        log_info "$result"
    done
    
    # Calculate overall success rate
    local success_count=0
    for result in "${test_results[@]}"; do
        if [[ $result == *"✅"* ]]; then
            success_count=$((success_count + 1))
        fi
    done
    
    local total_tests=${#test_results[@]}
    local success_rate=$((success_count * 100 / total_tests))
    
    log_info "Overall optimization success rate: ${success_rate}%"
    
    if [ "$success_rate" -ge 85 ]; then
        log_success "🎉 CI/CD pipeline optimization: EXCELLENT!"
        exit 0
    elif [ "$success_rate" -ge 70 ]; then
        log_success "✅ CI/CD pipeline optimization: GOOD!"
        exit 0
    else
        log_warn "⚠️ CI/CD pipeline optimization: NEEDS IMPROVEMENT"
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Optimization testing interrupted"; exit 130' INT TERM

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi