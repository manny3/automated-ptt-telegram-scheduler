#!/bin/bash

# CI/CD Status Monitoring Script
# This script provides detailed monitoring and reporting for GitHub Actions workflows

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Function to check CI environment
check_ci_environment() {
    log_info "Checking CI environment..."
    
    echo "Environment Variables:"
    echo "  CI: ${CI:-'not set'}"
    echo "  GITHUB_ACTIONS: ${GITHUB_ACTIONS:-'not set'}"
    echo "  GITHUB_WORKFLOW: ${GITHUB_WORKFLOW:-'not set'}"
    echo "  GITHUB_RUN_ID: ${GITHUB_RUN_ID:-'not set'}"
    echo "  GITHUB_RUN_NUMBER: ${GITHUB_RUN_NUMBER:-'not set'}"
    echo "  GITHUB_SHA: ${GITHUB_SHA:-'not set'}"
    echo "  GITHUB_REF: ${GITHUB_REF:-'not set'}"
    echo "  GITHUB_ACTOR: ${GITHUB_ACTOR:-'not set'}"
    echo "  GITHUB_EVENT_NAME: ${GITHUB_EVENT_NAME:-'not set'}"
    
    echo ""
    echo "System Information:"
    echo "  OS: $(uname -s)"
    echo "  Architecture: $(uname -m)"
    echo "  Kernel: $(uname -r)"
    echo "  Node.js: $(node --version 2>/dev/null || echo 'not available')"
    echo "  npm: $(npm --version 2>/dev/null || echo 'not available')"
    echo "  Docker: $(docker --version 2>/dev/null || echo 'not available')"
    
    echo ""
    echo "Resource Information:"
    if command -v free >/dev/null 2>&1; then
        echo "  Memory:"
        free -h | grep -E "(Mem|Swap)" | sed 's/^/    /'
    fi
    
    if command -v df >/dev/null 2>&1; then
        echo "  Disk Space:"
        df -h . | sed 's/^/    /'
    fi
}

# Function to analyze test results
analyze_test_results() {
    log_info "Analyzing test results..."
    
    local test_results_dir="${PROJECT_ROOT}/test-results"
    local coverage_dir="${PROJECT_ROOT}/coverage"
    
    if [ -d "$test_results_dir" ]; then
        echo "Test Results Directory: $test_results_dir"
        ls -la "$test_results_dir" | sed 's/^/  /'
        
        # Analyze JUnit XML if available
        if [ -f "$test_results_dir/junit.xml" ]; then
            log_info "JUnit test results found"
            local total_tests=$(grep -o 'tests="[0-9]*"' "$test_results_dir/junit.xml" | grep -o '[0-9]*' | head -1)
            local failures=$(grep -o 'failures="[0-9]*"' "$test_results_dir/junit.xml" | grep -o '[0-9]*' | head -1)
            local errors=$(grep -o 'errors="[0-9]*"' "$test_results_dir/junit.xml" | grep -o '[0-9]*' | head -1)
            
            echo "  Total Tests: ${total_tests:-0}"
            echo "  Failures: ${failures:-0}"
            echo "  Errors: ${errors:-0}"
            echo "  Success Rate: $(( (${total_tests:-0} - ${failures:-0} - ${errors:-0}) * 100 / ${total_tests:-1} ))%"
        fi
    else
        log_warn "Test results directory not found"
    fi
    
    if [ -d "$coverage_dir" ]; then
        echo ""
        echo "Coverage Directory: $coverage_dir"
        ls -la "$coverage_dir" | sed 's/^/  /'
        
        # Analyze coverage summary if available
        if [ -f "$coverage_dir/coverage-summary.json" ]; then
            log_info "Coverage summary found"
            if command -v jq >/dev/null 2>&1; then
                echo "Coverage Summary:"
                jq '.total' "$coverage_dir/coverage-summary.json" | sed 's/^/  /'
            else
                echo "  (jq not available for detailed analysis)"
            fi
        fi
    else
        log_warn "Coverage directory not found"
    fi
}

# Function to check dependency health
check_dependency_health() {
    log_info "Checking dependency health..."
    
    if [ -f "${PROJECT_ROOT}/package.json" ]; then
        echo "Package.json found"
        
        # Check for critical dependencies
        local critical_deps=("react" "@testing-library/react" "jest" "typescript" "next")
        echo "Critical Dependencies Status:"
        
        for dep in "${critical_deps[@]}"; do
            if npm list "$dep" --depth=0 >/dev/null 2>&1; then
                local version=$(npm list "$dep" --depth=0 2>/dev/null | grep "$dep" | sed 's/.*@//' | sed 's/ .*//')
                echo "  ✅ $dep@$version"
            else
                echo "  ❌ $dep (missing or invalid)"
            fi
        done
        
        # Check for security vulnerabilities
        echo ""
        echo "Security Audit:"
        if npm audit --audit-level high --json >/dev/null 2>&1; then
            echo "  ✅ No high-severity vulnerabilities found"
        else
            echo "  ⚠️ Security vulnerabilities detected"
        fi
    else
        log_error "package.json not found"
    fi
}

# Function to generate performance metrics
generate_performance_metrics() {
    log_info "Generating performance metrics..."
    
    local start_time="${GITHUB_WORKFLOW_START_TIME:-$(date +%s)}"
    local current_time=$(date +%s)
    local duration=$((current_time - start_time))
    
    echo "Workflow Performance:"
    echo "  Duration: ${duration}s ($(date -u -d @${duration} +%H:%M:%S 2>/dev/null || echo "${duration}s"))"
    echo "  Start Time: $(date -d @${start_time} 2>/dev/null || echo "Unknown")"
    echo "  Current Time: $(date)"
    
    # Check cache effectiveness
    if [ -d "${HOME}/.npm" ]; then
        local cache_size=$(du -sh "${HOME}/.npm" 2>/dev/null | cut -f1)
        echo "  npm Cache Size: ${cache_size:-'Unknown'}"
    fi
    
    if [ -d "node_modules" ]; then
        local node_modules_size=$(du -sh node_modules 2>/dev/null | cut -f1)
        echo "  node_modules Size: ${node_modules_size:-'Unknown'}"
    fi
}

# Function to generate recommendations
generate_recommendations() {
    log_info "Generating recommendations..."
    
    echo "Optimization Recommendations:"
    
    # Check for large node_modules
    if [ -d "node_modules" ]; then
        local size_mb=$(du -sm node_modules 2>/dev/null | cut -f1)
        if [ "${size_mb:-0}" -gt 500 ]; then
            echo "  ⚠️ Large node_modules directory (${size_mb}MB) - consider dependency optimization"
        fi
    fi
    
    # Check for missing cache
    if [ ! -d "${HOME}/.npm" ] || [ -z "$(ls -A "${HOME}/.npm" 2>/dev/null)" ]; then
        echo "  ⚠️ npm cache appears empty - caching strategy may need improvement"
    fi
    
    # Check test execution time
    if [ -f "test-results/junit.xml" ]; then
        local test_time=$(grep -o 'time="[0-9.]*"' test-results/junit.xml | grep -o '[0-9.]*' | head -1)
        if [ "${test_time:-0}" -gt 300 ]; then
            echo "  ⚠️ Test execution time is high (${test_time}s) - consider test optimization"
        fi
    fi
    
    echo "  ✅ Use npm ci instead of npm install in CI environments"
    echo "  ✅ Implement multi-layer caching for better performance"
    echo "  ✅ Run tests in parallel when possible"
    echo "  ✅ Use --legacy-peer-deps flag to handle React 19 compatibility"
}

# Function to create summary report
create_summary_report() {
    log_info "Creating summary report..."
    
    local report_file="${PROJECT_ROOT}/ci-status-report.md"
    
    cat > "$report_file" << EOF
# CI/CD Status Report

Generated: $(date)
Workflow: ${GITHUB_WORKFLOW:-'Local'}
Run ID: ${GITHUB_RUN_ID:-'N/A'}

## Environment Information

- OS: $(uname -s)
- Node.js: $(node --version 2>/dev/null || echo 'not available')
- npm: $(npm --version 2>/dev/null || echo 'not available')
- Docker: $(docker --version 2>/dev/null || echo 'not available')

## Test Results

EOF

    # Add test results if available
    if [ -f "test-results/junit.xml" ]; then
        local total_tests=$(grep -o 'tests="[0-9]*"' test-results/junit.xml | grep -o '[0-9]*' | head -1)
        local failures=$(grep -o 'failures="[0-9]*"' test-results/junit.xml | grep -o '[0-9]*' | head -1)
        
        cat >> "$report_file" << EOF
- Total Tests: ${total_tests:-0}
- Failures: ${failures:-0}
- Success Rate: $(( (${total_tests:-0} - ${failures:-0}) * 100 / ${total_tests:-1} ))%

EOF
    else
        echo "- Test results not available" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add coverage information if available
    if [ -f "coverage/coverage-summary.json" ] && command -v jq >/dev/null 2>&1; then
        echo "## Coverage Summary" >> "$report_file"
        echo "" >> "$report_file"
        echo '```json' >> "$report_file"
        jq '.total' coverage/coverage-summary.json >> "$report_file"
        echo '```' >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    echo "## Recommendations" >> "$report_file"
    echo "" >> "$report_file"
    echo "- Use enhanced caching strategies" >> "$report_file"
    echo "- Monitor dependency sizes and security" >> "$report_file"
    echo "- Implement parallel test execution" >> "$report_file"
    echo "- Regular dependency updates and audits" >> "$report_file"
    
    log_info "Summary report created: $report_file"
}

# Main execution
main() {
    log_info "Starting CI/CD status monitoring..."
    
    cd "$PROJECT_ROOT"
    
    check_ci_environment
    echo ""
    analyze_test_results
    echo ""
    check_dependency_health
    echo ""
    generate_performance_metrics
    echo ""
    generate_recommendations
    echo ""
    create_summary_report
    
    log_info "CI/CD status monitoring completed!"
}

# Handle script interruption
trap 'log_error "Script interrupted"; exit 130' INT TERM

# Execute main function
main "$@"