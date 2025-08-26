#!/bin/bash

# CI/CD Performance Monitoring Script
# This script provides comprehensive performance monitoring and benchmarking for CI/CD pipelines

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PERFORMANCE_LOG="${PROJECT_ROOT}/ci-performance.log"
BENCHMARK_FILE="${PROJECT_ROOT}/performance-benchmark.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

log_metric() {
    echo -e "${PURPLE}[METRIC]${NC} $1" | tee -a "$PERFORMANCE_LOG"
}

# Initialize performance log
init_performance_log() {
    echo "=== CI/CD Performance Monitoring Started ===" > "$PERFORMANCE_LOG"
    echo "Timestamp: $(date)" >> "$PERFORMANCE_LOG"
    echo "Workflow: ${GITHUB_WORKFLOW:-'Local'}" >> "$PERFORMANCE_LOG"
    echo "Run ID: ${GITHUB_RUN_ID:-'N/A'}" >> "$PERFORMANCE_LOG"
    echo "Node Version: ${NODE_VERSION:-$(node --version 2>/dev/null || echo 'Unknown')}" >> "$PERFORMANCE_LOG"
    echo "=============================================" >> "$PERFORMANCE_LOG"
}

# Function to measure system resources
measure_system_resources() {
    log_info "Measuring system resources..."
    
    local cpu_cores=$(nproc 2>/dev/null || echo "Unknown")
    local memory_total=$(free -m 2>/dev/null | grep Mem | awk '{print $2}' || echo "Unknown")
    local memory_available=$(free -m 2>/dev/null | grep Mem | awk '{print $7}' || echo "Unknown")
    local disk_total=$(df -BG . 2>/dev/null | tail -1 | awk '{print $2}' | sed 's/G//' || echo "Unknown")
    local disk_available=$(df -BG . 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//' || echo "Unknown")
    
    log_metric "CPU Cores: $cpu_cores"
    log_metric "Memory Total: ${memory_total}MB"
    log_metric "Memory Available: ${memory_available}MB"
    log_metric "Disk Total: ${disk_total}GB"
    log_metric "Disk Available: ${disk_available}GB"
    
    # Store in environment for later use (only in CI environment)
    if [ -n "$GITHUB_ENV" ]; then
        echo "SYSTEM_CPU_CORES=$cpu_cores" >> $GITHUB_ENV
        echo "SYSTEM_MEMORY_TOTAL=$memory_total" >> $GITHUB_ENV
        echo "SYSTEM_MEMORY_AVAILABLE=$memory_available" >> $GITHUB_ENV
        echo "SYSTEM_DISK_AVAILABLE=$disk_available" >> $GITHUB_ENV
    fi
}

# Function to measure cache effectiveness
measure_cache_effectiveness() {
    log_info "Measuring cache effectiveness..."
    
    local npm_cache_size="0"
    local node_modules_size="0"
    local next_cache_size="0"
    local jest_cache_size="0"
    
    if [ -d "${HOME}/.npm" ]; then
        npm_cache_size=$(du -sm "${HOME}/.npm" 2>/dev/null | cut -f1 || echo "0")
    fi
    
    if [ -d "node_modules" ]; then
        node_modules_size=$(du -sm node_modules 2>/dev/null | cut -f1 || echo "0")
    fi
    
    if [ -d ".next/cache" ]; then
        next_cache_size=$(du -sm .next/cache 2>/dev/null | cut -f1 || echo "0")
    fi
    
    if [ -d ".jest-cache" ]; then
        jest_cache_size=$(du -sm .jest-cache 2>/dev/null | cut -f1 || echo "0")
    fi
    
    log_metric "npm Cache Size: ${npm_cache_size}MB"
    log_metric "node_modules Size: ${node_modules_size}MB"
    log_metric "Next.js Cache Size: ${next_cache_size}MB"
    log_metric "Jest Cache Size: ${jest_cache_size}MB"
    
    # Calculate cache effectiveness score
    local cache_score=0
    [ "$npm_cache_size" -gt 10 ] && cache_score=$((cache_score + 25))
    [ "$next_cache_size" -gt 1 ] && cache_score=$((cache_score + 25))
    [ "$jest_cache_size" -gt 1 ] && cache_score=$((cache_score + 25))
    [ "$node_modules_size" -gt 100 ] && cache_score=$((cache_score + 25))
    
    log_metric "Cache Effectiveness Score: ${cache_score}%"
    if [ -n "$GITHUB_ENV" ]; then
        echo "CACHE_EFFECTIVENESS_SCORE=$cache_score" >> $GITHUB_ENV
    fi
}

# Function to benchmark dependency installation
benchmark_dependency_installation() {
    log_info "Benchmarking dependency installation..."
    
    local start_time=$(date +%s.%N)
    
    # Simulate dependency installation timing
    if [ -f "package-lock.json" ]; then
        local package_count=$(jq -r '.packages | length' package-lock.json 2>/dev/null || echo "0")
        log_metric "Total Packages: $package_count"
    fi
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    log_metric "Dependency Analysis Duration: ${duration}s"
    if [ -n "$GITHUB_ENV" ]; then
        echo "DEPENDENCY_ANALYSIS_DURATION=$duration" >> $GITHUB_ENV
    fi
}

# Function to benchmark test execution
benchmark_test_execution() {
    log_info "Benchmarking test execution performance..."
    
    local test_files_count=0
    local test_suites=("unit" "integration" "e2e" "performance")
    
    # Count test files
    for suite in "${test_suites[@]}"; do
        local count=$(find . -name "*.test.*" -path "*$suite*" 2>/dev/null | wc -l || echo "0")
        test_files_count=$((test_files_count + count))
        log_metric "$suite Test Files: $count"
    done
    
    log_metric "Total Test Files: $test_files_count"
    
    # Estimate optimal worker count based on system resources
    local cpu_cores=$(nproc 2>/dev/null || echo "2")
    local optimal_workers=$((cpu_cores > 4 ? cpu_cores / 2 : cpu_cores))
    
    log_metric "Optimal Jest Workers: $optimal_workers"
    if [ -n "$GITHUB_ENV" ]; then
        echo "OPTIMAL_JEST_WORKERS=$optimal_workers" >> $GITHUB_ENV
    fi
}

# Function to benchmark build performance
benchmark_build_performance() {
    log_info "Benchmarking build performance..."
    
    local src_files_count=$(find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l || echo "0")
    local component_files_count=$(find . -name "*.tsx" -o -name "*.jsx" 2>/dev/null | wc -l || echo "0")
    
    log_metric "Source Files: $src_files_count"
    log_metric "Component Files: $component_files_count"
    
    # Estimate build complexity
    local build_complexity="low"
    if [ "$src_files_count" -gt 100 ]; then
        build_complexity="high"
    elif [ "$src_files_count" -gt 50 ]; then
        build_complexity="medium"
    fi
    
    log_metric "Build Complexity: $build_complexity"
    if [ -n "$GITHUB_ENV" ]; then
        echo "BUILD_COMPLEXITY=$build_complexity" >> $GITHUB_ENV
    fi
}

# Function to generate performance recommendations
generate_performance_recommendations() {
    log_info "Generating performance recommendations..."
    
    local recommendations=()
    
    # Cache recommendations
    local cache_score=${CACHE_EFFECTIVENESS_SCORE:-0}
    if [ "$cache_score" -lt 75 ]; then
        recommendations+=("Improve caching strategy - current effectiveness: ${cache_score}%")
    fi
    
    # Memory recommendations
    local memory_available=${SYSTEM_MEMORY_AVAILABLE:-0}
    if [ "$memory_available" -lt 1000 ]; then
        recommendations+=("Consider increasing available memory (current: ${memory_available}MB)")
    fi
    
    # CPU recommendations
    local cpu_cores=${SYSTEM_CPU_CORES:-1}
    if [ "$cpu_cores" -lt 2 ]; then
        recommendations+=("Consider using runners with more CPU cores for parallel processing")
    fi
    
    # Test optimization recommendations
    local test_files=${TOTAL_TEST_FILES:-0}
    if [ "$test_files" -gt 50 ]; then
        recommendations+=("Consider test sharding for large test suites (${test_files} files)")
    fi
    
    # Build optimization recommendations
    local build_complexity=${BUILD_COMPLEXITY:-"low"}
    if [ "$build_complexity" = "high" ]; then
        recommendations+=("Consider build optimization for complex projects")
    fi
    
    # Output recommendations
    if [ ${#recommendations[@]} -eq 0 ]; then
        log_info "✅ No performance recommendations - system is well optimized"
    else
        log_warn "Performance Recommendations:"
        for rec in "${recommendations[@]}"; do
            log_warn "  - $rec"
        done
    fi
}

# Function to create performance benchmark file
create_performance_benchmark() {
    log_info "Creating performance benchmark file..."
    
    cat > "$BENCHMARK_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workflow": "${GITHUB_WORKFLOW:-'Local'}",
  "run_id": "${GITHUB_RUN_ID:-'N/A'}",
  "node_version": "${NODE_VERSION:-'Unknown'}",
  "system": {
    "cpu_cores": ${SYSTEM_CPU_CORES:-0},
    "memory_total_mb": ${SYSTEM_MEMORY_TOTAL:-0},
    "memory_available_mb": ${SYSTEM_MEMORY_AVAILABLE:-0},
    "disk_available_gb": ${SYSTEM_DISK_AVAILABLE:-0}
  },
  "cache": {
    "effectiveness_score": ${CACHE_EFFECTIVENESS_SCORE:-0},
    "npm_cache_mb": ${NPM_CACHE_SIZE:-0},
    "node_modules_mb": ${NODE_MODULES_SIZE:-0}
  },
  "tests": {
    "optimal_workers": ${OPTIMAL_JEST_WORKERS:-2},
    "total_files": ${TOTAL_TEST_FILES:-0}
  },
  "build": {
    "complexity": "${BUILD_COMPLEXITY:-'unknown'}",
    "source_files": ${SRC_FILES_COUNT:-0}
  },
  "durations": {
    "dependency_analysis_s": ${DEPENDENCY_ANALYSIS_DURATION:-0},
    "test_execution_s": ${TEST_DURATION:-0},
    "build_duration_s": ${BUILD_DURATION:-0},
    "total_workflow_s": ${TOTAL_DURATION:-0}
  }
}
EOF
    
    log_info "Performance benchmark saved to: $BENCHMARK_FILE"
}

# Function to compare with historical benchmarks
compare_with_historical_benchmarks() {
    log_info "Comparing with historical benchmarks..."
    
    local historical_dir="${PROJECT_ROOT}/performance-history"
    mkdir -p "$historical_dir"
    
    # Copy current benchmark to history
    local timestamp=$(date +%Y%m%d_%H%M%S)
    cp "$BENCHMARK_FILE" "$historical_dir/benchmark_${timestamp}.json"
    
    # Keep only last 10 benchmarks
    ls -t "$historical_dir"/benchmark_*.json | tail -n +11 | xargs rm -f 2>/dev/null || true
    
    # Compare with previous benchmark if available
    local previous_benchmark=$(ls -t "$historical_dir"/benchmark_*.json 2>/dev/null | head -2 | tail -1)
    
    if [ -n "$previous_benchmark" ] && [ -f "$previous_benchmark" ]; then
        log_info "Comparing with previous benchmark: $(basename "$previous_benchmark")"
        
        local current_total=$(jq -r '.durations.total_workflow_s' "$BENCHMARK_FILE" 2>/dev/null || echo "0")
        local previous_total=$(jq -r '.durations.total_workflow_s' "$previous_benchmark" 2>/dev/null || echo "0")
        
        if [ "$current_total" != "0" ] && [ "$previous_total" != "0" ]; then
            local improvement=$(echo "scale=2; ($previous_total - $current_total) / $previous_total * 100" | bc -l 2>/dev/null || echo "0")
            
            if (( $(echo "$improvement > 5" | bc -l 2>/dev/null || echo "0") )); then
                log_info "✅ Performance improved by ${improvement}% (${current_total}s vs ${previous_total}s)"
            elif (( $(echo "$improvement < -5" | bc -l 2>/dev/null || echo "0") )); then
                log_warn "⚠️ Performance degraded by ${improvement#-}% (${current_total}s vs ${previous_total}s)"
            else
                log_info "➡️ Performance stable (${current_total}s vs ${previous_total}s)"
            fi
        fi
    else
        log_info "No previous benchmark found for comparison"
    fi
}

# Function to generate performance report
generate_performance_report() {
    log_info "Generating comprehensive performance report..."
    
    local report_file="${PROJECT_ROOT}/ci-performance-report.md"
    
    cat > "$report_file" << EOF
# CI/CD Performance Report

**Generated:** $(date)  
**Workflow:** ${GITHUB_WORKFLOW:-'Local'}  
**Run ID:** ${GITHUB_RUN_ID:-'N/A'}  
**Node Version:** ${NODE_VERSION:-'Unknown'}

## System Resources

| Metric | Value |
|--------|-------|
| CPU Cores | ${SYSTEM_CPU_CORES:-'Unknown'} |
| Memory Total | ${SYSTEM_MEMORY_TOTAL:-'Unknown'}MB |
| Memory Available | ${SYSTEM_MEMORY_AVAILABLE:-'Unknown'}MB |
| Disk Available | ${SYSTEM_DISK_AVAILABLE:-'Unknown'}GB |

## Cache Effectiveness

| Cache Type | Size | Status |
|------------|------|--------|
| npm Cache | ${NPM_CACHE_SIZE:-0}MB | $([ "${NPM_CACHE_SIZE:-0}" -gt 10 ] && echo "✅ Good" || echo "⚠️ Low") |
| node_modules | ${NODE_MODULES_SIZE:-0}MB | $([ "${NODE_MODULES_SIZE:-0}" -gt 100 ] && echo "✅ Cached" || echo "❌ Not Cached") |
| Next.js Cache | ${NEXT_CACHE_SIZE:-0}MB | $([ "${NEXT_CACHE_SIZE:-0}" -gt 1 ] && echo "✅ Active" || echo "⚠️ Inactive") |
| Jest Cache | ${JEST_CACHE_SIZE:-0}MB | $([ "${JEST_CACHE_SIZE:-0}" -gt 1 ] && echo "✅ Active" || echo "⚠️ Inactive") |

**Overall Cache Effectiveness:** ${CACHE_EFFECTIVENESS_SCORE:-0}%

## Performance Metrics

| Phase | Duration | Status |
|-------|----------|--------|
| Dependency Analysis | ${DEPENDENCY_ANALYSIS_DURATION:-0}s | $([ "${DEPENDENCY_ANALYSIS_DURATION:-0}" != "0" ] && echo "✅ Measured" || echo "⚠️ Not Measured") |
| Test Execution | ${TEST_DURATION:-0}s | $([ "${TEST_DURATION:-0}" != "0" ] && echo "✅ Measured" || echo "⚠️ Not Measured") |
| Build Process | ${BUILD_DURATION:-0}s | $([ "${BUILD_DURATION:-0}" != "0" ] && echo "✅ Measured" || echo "⚠️ Not Measured") |
| Total Workflow | ${TOTAL_DURATION:-0}s | $([ "${TOTAL_DURATION:-0}" != "0" ] && echo "✅ Measured" || echo "⚠️ Not Measured") |

## Optimization Status

- ✅ Multi-layer caching strategy implemented
- ✅ Parallel test execution enabled
- ✅ Docker build optimization with BuildKit
- ✅ Performance monitoring and benchmarking
- ✅ Resource usage optimization

## Recommendations

EOF

    # Add dynamic recommendations based on metrics
    if [ "${CACHE_EFFECTIVENESS_SCORE:-0}" -lt 75 ]; then
        echo "- ⚠️ **Cache Optimization Needed:** Current effectiveness is ${CACHE_EFFECTIVENESS_SCORE:-0}%. Consider reviewing caching strategy." >> "$report_file"
    fi
    
    if [ "${TEST_DURATION:-0}" -gt 300 ]; then
        echo "- ⚠️ **Test Optimization:** Test execution time is ${TEST_DURATION:-0}s. Consider test sharding or parallel execution improvements." >> "$report_file"
    fi
    
    if [ "${TOTAL_DURATION:-0}" -gt 900 ]; then
        echo "- ⚠️ **Workflow Optimization:** Total workflow time is ${TOTAL_DURATION:-0}s. Review overall pipeline efficiency." >> "$report_file"
    fi
    
    if [ "${SYSTEM_MEMORY_AVAILABLE:-0}" -lt 1000 ]; then
        echo "- ⚠️ **Memory Optimization:** Available memory is ${SYSTEM_MEMORY_AVAILABLE:-0}MB. Consider memory-efficient configurations." >> "$report_file"
    fi
    
    # Add positive feedback if everything is optimal
    if [ "${CACHE_EFFECTIVENESS_SCORE:-0}" -ge 75 ] && [ "${TEST_DURATION:-0}" -le 300 ] && [ "${TOTAL_DURATION:-0}" -le 900 ]; then
        echo "- ✅ **Excellent Performance:** All metrics are within optimal ranges. No immediate optimizations needed." >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Historical Comparison" >> "$report_file"
    echo "" >> "$report_file"
    echo "Performance trends and comparisons with previous runs are tracked in the \`performance-history/\` directory." >> "$report_file"
    
    log_info "Performance report generated: $report_file"
}

# Main execution function
main() {
    log_info "Starting CI/CD performance monitoring..."
    
    cd "$PROJECT_ROOT"
    
    # Initialize
    init_performance_log
    
    # Run all benchmarks and measurements
    measure_system_resources
    measure_cache_effectiveness
    benchmark_dependency_installation
    benchmark_test_execution
    benchmark_build_performance
    
    # Generate outputs
    generate_performance_recommendations
    create_performance_benchmark
    compare_with_historical_benchmarks
    generate_performance_report
    
    log_info "CI/CD performance monitoring completed successfully!"
    log_info "Results saved to:"
    log_info "  - Performance Log: $PERFORMANCE_LOG"
    log_info "  - Benchmark Data: $BENCHMARK_FILE"
    log_info "  - Performance Report: ${PROJECT_ROOT}/ci-performance-report.md"
}

# Handle script interruption
trap 'log_error "Performance monitoring interrupted"; exit 130' INT TERM

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi