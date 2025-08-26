#!/bin/bash

# GitHub Actions Workflow Performance Tracker
# This script tracks and analyzes workflow performance across multiple runs

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PERFORMANCE_DATA_DIR="${PROJECT_ROOT}/.github/performance-data"
WORKFLOW_METRICS_FILE="${PERFORMANCE_DATA_DIR}/workflow-metrics.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_metric() {
    echo -e "${PURPLE}[METRIC]${NC} $1"
}

# Initialize performance data directory
init_performance_data() {
    mkdir -p "$PERFORMANCE_DATA_DIR"
    
    if [ ! -f "$WORKFLOW_METRICS_FILE" ]; then
        cat > "$WORKFLOW_METRICS_FILE" << EOF
{
  "workflow_runs": [],
  "performance_trends": {
    "avg_duration": 0,
    "avg_test_duration": 0,
    "avg_build_duration": 0,
    "cache_hit_rate": 0
  },
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
        log_info "Initialized workflow metrics file"
    fi
}

# Record current workflow run metrics
record_workflow_metrics() {
    log_info "Recording workflow metrics..."
    
    local run_data=$(cat << EOF
{
  "run_id": "${GITHUB_RUN_ID:-'local'}",
  "run_number": ${GITHUB_RUN_NUMBER:-0},
  "workflow": "${GITHUB_WORKFLOW:-'local'}",
  "branch": "${GITHUB_REF_NAME:-'unknown'}",
  "commit_sha": "${GITHUB_SHA:-'unknown'}",
  "actor": "${GITHUB_ACTOR:-'unknown'}",
  "event": "${GITHUB_EVENT_NAME:-'unknown'}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "node_version": "${NODE_VERSION:-'unknown'}",
  "runner_os": "${RUNNER_OS:-'unknown'}",
  "metrics": {
    "total_duration": ${TOTAL_DURATION:-0},
    "test_duration": ${TEST_DURATION:-0},
    "build_duration": ${BUILD_DURATION:-0},
    "coverage_duration": ${COVERAGE_DURATION:-0},
    "cache_effectiveness": ${CACHE_EFFECTIVENESS_SCORE:-0},
    "system_resources": {
      "cpu_cores": ${SYSTEM_CPU_CORES:-0},
      "memory_available": ${SYSTEM_MEMORY_AVAILABLE:-0},
      "disk_available": ${SYSTEM_DISK_AVAILABLE:-0}
    }
  },
  "job_results": {
    "test": "${TEST_JOB_RESULT:-'unknown'}",
    "security": "${SECURITY_JOB_RESULT:-'unknown'}",
    "build": "${BUILD_JOB_RESULT:-'unknown'}"
  }
}
EOF
)
    
    # Add the new run data to the metrics file
    if command -v jq >/dev/null 2>&1; then
        local temp_file=$(mktemp)
        jq --argjson new_run "$run_data" '.workflow_runs += [$new_run] | .last_updated = now | strftime("%Y-%m-%dT%H:%M:%SZ")' "$WORKFLOW_METRICS_FILE" > "$temp_file"
        mv "$temp_file" "$WORKFLOW_METRICS_FILE"
        
        # Keep only the last 50 runs to prevent file from growing too large
        jq '.workflow_runs = (.workflow_runs | sort_by(.timestamp) | .[-50:])' "$WORKFLOW_METRICS_FILE" > "$temp_file"
        mv "$temp_file" "$WORKFLOW_METRICS_FILE"
        
        log_info "Workflow metrics recorded successfully"
    else
        log_warn "jq not available, skipping metrics recording"
    fi
}

# Calculate performance trends
calculate_performance_trends() {
    log_info "Calculating performance trends..."
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping trend calculation"
        return
    fi
    
    local temp_file=$(mktemp)
    
    # Calculate averages and trends
    jq '
    .performance_trends = {
      "avg_duration": (.workflow_runs | map(.metrics.total_duration) | add / length),
      "avg_test_duration": (.workflow_runs | map(.metrics.test_duration) | add / length),
      "avg_build_duration": (.workflow_runs | map(.metrics.build_duration) | add / length),
      "avg_cache_effectiveness": (.workflow_runs | map(.metrics.cache_effectiveness) | add / length),
      "success_rate": ((.workflow_runs | map(select(.job_results.test == "success" and .job_results.build == "success")) | length) / (.workflow_runs | length) * 100),
      "trend_analysis": {
        "last_5_runs_avg": (.workflow_runs | .[-5:] | map(.metrics.total_duration) | add / length),
        "last_10_runs_avg": (.workflow_runs | .[-10:] | map(.metrics.total_duration) | add / length),
        "performance_trend": (
          if (.workflow_runs | length) >= 10 then
            ((.workflow_runs | .[-5:] | map(.metrics.total_duration) | add / length) - 
             (.workflow_runs | .[-10:-5] | map(.metrics.total_duration) | add / length))
          else
            0
          end
        )
      }
    }
    ' "$WORKFLOW_METRICS_FILE" > "$temp_file"
    
    mv "$temp_file" "$WORKFLOW_METRICS_FILE"
    log_info "Performance trends calculated"
}

# Generate performance insights
generate_performance_insights() {
    log_info "Generating performance insights..."
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping insights generation"
        return
    fi
    
    local insights_file="${PERFORMANCE_DATA_DIR}/performance-insights.md"
    
    # Extract key metrics
    local avg_duration=$(jq -r '.performance_trends.avg_duration // 0' "$WORKFLOW_METRICS_FILE")
    local avg_test_duration=$(jq -r '.performance_trends.avg_test_duration // 0' "$WORKFLOW_METRICS_FILE")
    local avg_build_duration=$(jq -r '.performance_trends.avg_build_duration // 0' "$WORKFLOW_METRICS_FILE")
    local success_rate=$(jq -r '.performance_trends.success_rate // 0' "$WORKFLOW_METRICS_FILE")
    local performance_trend=$(jq -r '.performance_trends.trend_analysis.performance_trend // 0' "$WORKFLOW_METRICS_FILE")
    local total_runs=$(jq -r '.workflow_runs | length' "$WORKFLOW_METRICS_FILE")
    
    cat > "$insights_file" << EOF
# Workflow Performance Insights

**Generated:** $(date)  
**Total Runs Analyzed:** $total_runs  
**Data Period:** Last 50 workflow runs

## Key Performance Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Average Total Duration | ${avg_duration}s | $([ "${avg_duration%.*}" -lt 900 ] && echo "✅ Good" || echo "⚠️ Needs Optimization") |
| Average Test Duration | ${avg_test_duration}s | $([ "${avg_test_duration%.*}" -lt 300 ] && echo "✅ Good" || echo "⚠️ Slow") |
| Average Build Duration | ${avg_build_duration}s | $([ "${avg_build_duration%.*}" -lt 180 ] && echo "✅ Good" || echo "⚠️ Slow") |
| Success Rate | ${success_rate}% | $([ "${success_rate%.*}" -gt 95 ] && echo "✅ Excellent" || [ "${success_rate%.*}" -gt 90 ] && echo "⚠️ Good" || echo "❌ Needs Attention") |

## Performance Trends

$(if (( $(echo "$performance_trend < -30" | bc -l 2>/dev/null || echo "0") )); then
    echo "📈 **Improving Performance:** Workflows are getting faster by ${performance_trend#-}s on average"
elif (( $(echo "$performance_trend > 30" | bc -l 2>/dev/null || echo "0") )); then
    echo "📉 **Performance Degradation:** Workflows are getting slower by ${performance_trend}s on average"
else
    echo "➡️ **Stable Performance:** No significant performance trend detected"
fi)

## Optimization Recommendations

EOF

    # Add dynamic recommendations based on metrics
    if (( $(echo "$avg_duration > 900" | bc -l 2>/dev/null || echo "0") )); then
        echo "- 🚀 **Workflow Optimization:** Total duration (${avg_duration}s) exceeds 15 minutes. Consider parallel job execution." >> "$insights_file"
    fi
    
    if (( $(echo "$avg_test_duration > 300" | bc -l 2>/dev/null || echo "0") )); then
        echo "- 🧪 **Test Optimization:** Test duration (${avg_test_duration}s) is high. Consider test sharding or parallel execution." >> "$insights_file"
    fi
    
    if (( $(echo "$avg_build_duration > 180" | bc -l 2>/dev/null || echo "0") )); then
        echo "- 🏗️ **Build Optimization:** Build duration (${avg_build_duration}s) is high. Review caching strategy and build process." >> "$insights_file"
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l 2>/dev/null || echo "0") )); then
        echo "- 🔧 **Reliability Improvement:** Success rate (${success_rate}%) is below 95%. Investigate common failure patterns." >> "$insights_file"
    fi
    
    if (( $(echo "$performance_trend > 30" | bc -l 2>/dev/null || echo "0") )); then
        echo "- 📊 **Performance Regression:** Recent runs are slower. Review recent changes and optimize accordingly." >> "$insights_file"
    fi
    
    # Add positive feedback if everything is optimal
    if (( $(echo "$avg_duration <= 900 && $avg_test_duration <= 300 && $avg_build_duration <= 180 && $success_rate >= 95" | bc -l 2>/dev/null || echo "0") )); then
        echo "- ✅ **Excellent Performance:** All metrics are within optimal ranges. Continue current practices." >> "$insights_file"
    fi
    
    cat >> "$insights_file" << EOF

## Historical Data

The complete performance data is available in \`workflow-metrics.json\` for detailed analysis.

### Recent Performance Summary

$(jq -r '.workflow_runs | .[-5:] | .[] | "- Run #\(.run_number): \(.metrics.total_duration)s (\(.job_results.test)/\(.job_results.build))"' "$WORKFLOW_METRICS_FILE" 2>/dev/null || echo "Historical data not available")

EOF
    
    log_info "Performance insights generated: $insights_file"
}

# Create performance dashboard data
create_performance_dashboard() {
    log_info "Creating performance dashboard data..."
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping dashboard creation"
        return
    fi
    
    local dashboard_file="${PERFORMANCE_DATA_DIR}/dashboard-data.json"
    
    # Extract data for dashboard visualization
    jq '{
      "summary": {
        "total_runs": (.workflow_runs | length),
        "avg_duration": .performance_trends.avg_duration,
        "success_rate": .performance_trends.success_rate,
        "last_updated": .last_updated
      },
      "recent_runs": (.workflow_runs | .[-10:] | map({
        "run_number": .run_number,
        "duration": .metrics.total_duration,
        "test_duration": .metrics.test_duration,
        "build_duration": .metrics.build_duration,
        "success": (if .job_results.test == "success" and .job_results.build == "success" then true else false end),
        "timestamp": .timestamp
      })),
      "performance_metrics": {
        "duration_trend": (.workflow_runs | .[-10:] | map(.metrics.total_duration)),
        "test_duration_trend": (.workflow_runs | .[-10:] | map(.metrics.test_duration)),
        "build_duration_trend": (.workflow_runs | .[-10:] | map(.metrics.build_duration)),
        "cache_effectiveness_trend": (.workflow_runs | .[-10:] | map(.metrics.cache_effectiveness))
      }
    }' "$WORKFLOW_METRICS_FILE" > "$dashboard_file"
    
    log_info "Performance dashboard data created: $dashboard_file"
}

# Export performance data for external tools
export_performance_data() {
    log_info "Exporting performance data..."
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping data export"
        return
    fi
    
    # Export CSV for spreadsheet analysis
    local csv_file="${PERFORMANCE_DATA_DIR}/workflow-performance.csv"
    
    echo "run_id,run_number,timestamp,total_duration,test_duration,build_duration,cache_effectiveness,success" > "$csv_file"
    
    jq -r '.workflow_runs[] | [
      .run_id,
      .run_number,
      .timestamp,
      .metrics.total_duration,
      .metrics.test_duration,
      .metrics.build_duration,
      .metrics.cache_effectiveness,
      (if .job_results.test == "success" and .job_results.build == "success" then "true" else "false" end)
    ] | @csv' "$WORKFLOW_METRICS_FILE" >> "$csv_file"
    
    log_info "Performance data exported to CSV: $csv_file"
    
    # Export summary statistics
    local stats_file="${PERFORMANCE_DATA_DIR}/performance-stats.json"
    
    jq '{
      "statistics": {
        "total_runs": (.workflow_runs | length),
        "date_range": {
          "first_run": (.workflow_runs | min_by(.timestamp) | .timestamp),
          "last_run": (.workflow_runs | max_by(.timestamp) | .timestamp)
        },
        "duration_stats": {
          "min": (.workflow_runs | map(.metrics.total_duration) | min),
          "max": (.workflow_runs | map(.metrics.total_duration) | max),
          "avg": (.workflow_runs | map(.metrics.total_duration) | add / length),
          "median": (.workflow_runs | map(.metrics.total_duration) | sort | .[length/2])
        },
        "success_stats": {
          "total_successes": (.workflow_runs | map(select(.job_results.test == "success" and .job_results.build == "success")) | length),
          "success_rate": ((.workflow_runs | map(select(.job_results.test == "success" and .job_results.build == "success")) | length) / (.workflow_runs | length) * 100)
        }
      }
    }' "$WORKFLOW_METRICS_FILE" > "$stats_file"
    
    log_info "Performance statistics exported: $stats_file"
}

# Main execution function
main() {
    log_info "Starting workflow performance tracking..."
    
    cd "$PROJECT_ROOT"
    
    # Initialize performance tracking
    init_performance_data
    
    # Record current run metrics
    record_workflow_metrics
    
    # Calculate trends and insights
    calculate_performance_trends
    generate_performance_insights
    create_performance_dashboard
    export_performance_data
    
    log_info "Workflow performance tracking completed!"
    log_info "Performance data available in: $PERFORMANCE_DATA_DIR"
}

# Handle script interruption
trap 'log_error "Performance tracking interrupted"; exit 130' INT TERM

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi