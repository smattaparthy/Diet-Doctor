#!/bin/bash

# Maintenance Script for Cultural Diet App
# Database maintenance, system health checks, and optimization

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cultural-diet}
ENVIRONMENT="${ENVIRONMENT:-dev}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC}  ${timestamp} - $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  ${timestamp} - $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} ${timestamp} - $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message" ;;
        *)       echo -e "[LOG]   ${timestamp} - $message" ;;
    esac
}

# Display usage
usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [COMMAND] [OPTIONS]

Maintenance script for Cultural Diet App

ENVIRONMENTS:
  dev          Development environment (default)
  prod         Production environment

COMMANDS:
  health       Health check for all services
  backup       Create database backup
  cleanup      Clean up old data and optimize database
  logs         Analyze and rotate logs
  update       Update application and dependencies
  repair       Repair database corruption
  monitor      System monitoring and metrics
  maintenance  Full maintenance routine

OPTIONS:
  -f, --force              Force operation without confirmation
  -v, --verbose            Verbose output
  -q, --quiet              Quiet output (errors only)
  --dry-run                Show what would be done without executing
  --backup-only            Only backup, skip other operations
  --cleanup-only           Only cleanup, skip backup
  -h, --help               Show this help message

EXAMPLES:
  $0 health                     # Check health
  $0 prod backup                # Backup production database
  $0 prod maintenance           # Full maintenance in production
  $0 cleanup --dry-run          # Show cleanup plan
  $0 prod update --force        # Force update production

EOF
}

# Get docker compose command
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# Run docker compose command
run_compose() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    local cmd="$compose_cmd -f $COMPOSE_FILE --project-name $COMPOSE_PROJECT_NAME"

    if [ "${VERBOSE:-}" = "true" ]; then
        log "DEBUG" "Running: $cmd $*"
    fi

    $cmd "$@"
}

# Wait for service to be ready
wait_for_service() {
    local service="$1"
    local max_wait="${2:-60}"
    local wait_count=0

    log "INFO" "Waiting for $service to be ready..."

    while [ $wait_count -lt $max_wait ]; do
        if run_compose exec "$service" curl -f http://localhost:3000/health &>/dev/null; then
            log "INFO" "$service is ready"
            return 0
        fi
        sleep 2
        ((wait_count++))
    done

    log "ERROR" "$service did not become ready within ${max_wait} seconds"
    return 1
}

# Health check
health_check() {
    log "INFO" "Performing health check..."

    local overall_health=true

    # Check if containers are running
    log "INFO" "Checking container status..."
    if ! run_compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | grep -q "Up"; then
        log "WARN" "Some containers may not be running"
        overall_health=false
    fi

    # Check backend health
    log "INFO" "Checking backend health..."
    if run_compose exec backend curl -f http://localhost:3000/health &>/dev/null; then
        log "INFO" "✅ Backend: Healthy"
    else
        log "ERROR" "❌ Backend: Unhealthy"
        overall_health=false
    fi

    # Check database connectivity
    log "INFO" "Checking database connectivity..."
    if run_compose exec backend sqlite3 /app/database/cultural_diet.db "SELECT 1;" &>/dev/null; then
        log "INFO" "✅ Database: Connected"
    else
        log "ERROR" "❌ Database: Connection failed"
        overall_health=false
    else
        log "ERROR" "❌ Database: Connection failed"
        overall_health=false
    fi

    # Check disk space
    log "INFO" "Checking disk space..."
    local disk_usage=$(run_compose exec backend df /app | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        log "WARN" "⚠️  Disk usage high: ${disk_usage}%"
    elif [ "$disk_usage" -gt 90 ]; then
        log "ERROR" "❌ Disk usage critical: ${disk_usage}%"
        overall_health=false
    else
        log "INFO" "✅ Disk usage: ${disk_usage}%"
    fi

    # Check memory usage
    log "INFO" "Checking memory usage..."
    local mem_usage=$(run_compose exec backend free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$mem_usage" -gt 85 ]; then
        log "WARN" "⚠️  Memory usage high: ${mem_usage}%"
    else
        log "INFO" "✅ Memory usage: ${mem_usage}%"
    fi

    # Check logs for errors
    log "INFO" "Checking for recent errors..."
    local error_count=$(run_compose exec backend grep -c "ERROR" /app/logs/*.log 2>/dev/null || echo "0")
    if [ "$error_count" -gt 0 ]; then
        log "WARN" "⚠️  Found $error_count recent errors in logs"
    else
        log "INFO" "✅ No recent errors found"
    fi

    if [ "$overall_health" = true ]; then
        log "INFO" "🎉 Overall system health: GOOD"
        return 0
    else
        log "WARN" "⚠️  Overall system health: ISSUES DETECTED"
        return 1
    fi
}

# Database maintenance
database_maintenance() {
    log "INFO" "Performing database maintenance..."

    # Create backup before maintenance
    if [ "${BACKUP_ONLY:-}" != "true" ]; then
        log "INFO" "Creating pre-maintenance backup..."
        run_compose exec backup /app/scripts/backup.sh || log "WARN" "Backup failed, continuing with maintenance"
    fi

    # Check database integrity
    log "INFO" "Checking database integrity..."
    if run_compose exec backend sqlite3 /app/database/cultural_diet.db "PRAGMA integrity_check;" | grep -q "ok"; then
        log "INFO" "✅ Database integrity: OK"
    else
        log "WARN" "⚠️  Database integrity issues detected, attempting repair"
        database_repair
    fi

    # Analyze database tables for query optimization
    log "INFO" "Analyzing database tables..."
    run_compose exec backend sqlite3 /app/database/cultural_diet.db "ANALYZE;" || log "WARN" "Database analysis failed"

    # Vacuum database to reclaim space
    log "INFO" "Optimizing database (VACUUM)..."
    run_compose exec backend sqlite3 /app/database/cultural_diet.db "VACUUM;" || log "WARN" "Database VACUUM failed"

    # Update table statistics
    log "INFO" "Updating table statistics..."
    run_compose exec backend sqlite3 /app/database/cultural_diet.db "PRAGMA optimize;" || log "WARN" "Statistics update failed"

    log "INFO" "Database maintenance completed"
}

# Log maintenance
log_maintenance() {
    log "INFO" "Performing log maintenance..."

    # Rotate logs
    log "INFO" "Rotating application logs..."
    run_compose exec backend find /app/logs -name "*.log" -type f -mtime +7 -exec truncate -s 0 {} \; || log "WARN" "Log rotation failed"

    # Compress old logs
    log "INFO" "Compressing archive logs..."
    run_compose exec backend find /app/logs -name "*.log.old" -type f -mtime +1 -exec gzip {} \; || log "WARN" "Log compression failed"

    # Remove very old logs
    log "INFO" "Removing old logs (>30 days)..."
    run_compose exec backend find /app/logs -name "*.log.*" -type f -mtime +30 -delete || log "WARN" "Old log cleanup failed"

    # Check log sizes
    log "INFO" "Checking log file sizes..."
    run_compose exec backend find /app/logs -name "*.log" -type f -exec ls -lh {} \; | while read -r line; do
        local size=$(echo "$line" | awk '{print $5}')
        local file=$(echo "$line" | awk '{print $NF}')
        if [[ "$size" =~ G ]]; then
            log "WARN" "Large log file: $file ($size)"
        fi
    done

    log "INFO" "Log maintenance completed"
}

# System cleanup
system_cleanup() {
    log "INFO" "Performing system cleanup..."

    # Clean up old backups
    if [ "${DRY_RUN:-}" = "true" ]; then
        log "INFO" "[DRY RUN] Would clean up old backups"
    else
        log "INFO" "Cleaning up old backups..."
        run_compose exec backup /app/scripts/backup-cleanup.sh || log "WARN" "Backup cleanup failed"
    fi

    # Clean up temporary files
    log "INFO" "Cleaning up temporary files..."
    if [ "${DRY_RUN:-}" = "true" ]; then
        log "INFO" "[DRY RUN] Would clean up temporary files"
    else
        run_compose exec backend find /tmp -name "*.tmp" -type f -mtime +1 -delete || log "WARN" "Temp cleanup failed"
    fi

    # Remove unused Docker images
    log "INFO" "Cleaning up Docker resources..."
    if [ "${DRY_RUN:-}" = "true" ]; then
        log "INFO" "[DRY RUN] Would prune Docker resources"
    else
        docker system prune -f || log "WARN" "Docker prune failed"
    fi

    # Clean up uploaded files
    log "INFO" "Cleaning up orphaned uploads..."
    if [ "${DRY_RUN:-}" = "true" ]; then
        log "INFO" "[DRY RUN] Would clean up orphaned uploads"
    else
        run_compose exec backend find /app/uploads -type f -mtime +30 -delete || log "WARN" "Upload cleanup failed"
    fi

    log "INFO" "System cleanup completed"
}

# Database repair
database_repair() {
    log "INFO" "Attempting database repair..."

    # Create backup before repair
    log "INFO" "Creating emergency backup..."
    local backup_file="emergency_backup_$(date +%Y%m%d_%H%M%S).db"
    run_compose exec backend cp /app/database/cultural_diet.db "/app/backups/$backup_file" || log "ERROR" "Emergency backup failed"

    # Attempt repair
    log "INFO" "Running database recovery..."
    if run_compose exec backend sqlite3 /app/database/cultural_diet_repair.db ".recover" | run_compose exec -T backend sqlite3 /app/database/cultural_diet_repair.db ".read /dev/stdin" 2>/dev/null; then
        log "INFO" "Database repair completed"
        if [ "${DRY_RUN:-}" != "true" ]; then
            # Replace damaged database with repaired one
            run_compose exec backend mv /app/database/cultural_diet.db /app/database/cultural_diet_corrupted.db
            run_compose exec backend mv /app/database/cultural_diet_repair.db /app/database/cultural_diet.db
            log "INFO" "Repaired database activated"
        fi
    else
        log "ERROR" "Database repair failed"
        return 1
    fi
}

# System update
system_update() {
    log "INFO" "Updating application..."

    if [ "${DRY_RUN:-}" = "true" ]; then
        log "INFO" "[DRY RUN] Would rebuild application images"
        return 0
    fi

    # Create backup before update
    if [ "${BACKUP_ONLY:-}" != "true" ]; then
        log "INFO" "Creating pre-update backup..."
        run_compose exec backup /app/scripts/backup.sh || log "WARN" "Backup failed"
    fi

    # Pull latest images
    log "INFO" "Pulling latest base images..."
    docker pull node:18-alpine3.18 || log "WARN" "Failed to pull base image"

    # Rebuild application images
    log "INFO" "Rebuilding application images..."
    run_compose build --no-cache || log "ERROR" "Build failed"

    # Restart services
    log "INFO" "Restarting services..."
    run_compose down && run_compose up -d || log "ERROR" "Service restart failed"

    # Wait for services to be ready
    wait_for_service backend

    log "INFO" "Update completed"
}

# System monitoring
system_monitoring() {
    log "INFO" "Collecting system metrics..."

    # Container metrics
    log "INFO" "📊 Container Metrics:"
    run_compose exec backend top -b -n 1 | head -10 || log "WARN" "Could not get container metrics"

    # Database metrics
    log "INFO" "📊 Database Metrics:"
    local db_size=$(run_compose exec backend ls -lh /app/database/cultural_diet.db | awk '{print $5}')
    local table_count=$(run_compose exec backend sqlite3 /app/database/cultural_diet.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" || echo "0")
    log "INFO" "  - Database size: $db_size"
    log "INFO" "  - Tables: $table_count"

    # Disk usage
    log "INFO" "📊 Disk Usage:"
    run_compose exec backend df -h | head -5 || log "WARN" "Could not get disk usage"

    # Memory usage
    log "INFO" "📊 Memory Usage:"
    run_compose exec backend free -h || log "WARN" "Could not get memory usage"

    # Network connections
    log "INFO" "📊 Network Connections:"
    run_compose exec backend netstat -an | grep ESTABLISHED | wc -l | xargs -I {} log "INFO" "  - Established connections: {}" || log "WARN" "Could not get network stats"

    # Recent activity
    log "INFO" "📊 Recent Activity:"
    run_compose exec backend tail -n 10 /app logs/application.log 2>/dev/null | tail -5 || log "INFO" "  - No recent activity logs"

    log "INFO" "Monitoring data collected"
}

# Full maintenance routine
full_maintenance() {
    log "INFO" "Starting full maintenance routine..."

    # Health check
    health_check || log "WARN" "Health check revealed issues"

    if [ "${CLEANUP_ONLY:-}" != "true" ]; then
        # Database maintenance
        database_maintenance
    fi

    if [ "${BACKUP_ONLY:-}" != "true" ]; then
        # Log maintenance
        log_maintenance

        # System cleanup
        system_cleanup
    fi

    # Final health check
    log "INFO" "Performing post-maintenance health check..."
    health_check || log "WARN" "Some issues remain after maintenance"

    log "INFO" "🎉 Full maintenance routine completed"
}

# Main function
main() {
    local command="maintenance"
    local confirmation=true

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|prod)
                ENVIRONMENT="$1"
                COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
                shift
                ;;
            -f|--force)
                confirmation=false
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --backup-only)
                BACKUP_ONLY=true
                shift
                ;;
            --cleanup-only)
                CLEANUP_ONLY=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            health|backup|cleanup|logs|update|repair|monitor|maintenance)
                command="$1"
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Set environment
    export ENVIRONMENT
    export COMPOSE_PROJECT_NAME

    log "INFO" "Cultural Diet App Maintenance"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Command: $command"

    # Confirmation prompt
    if [ "$confirmation" = true ] && [ "${DRY_RUN:-}" != "true" ]; then
        echo -n "Are you sure you want to run $command on $ENVIRONMENT? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "INFO" "Operation cancelled"
            exit 0
        fi
    fi

    # Run command
    case "$command" in
        health)
            health_check
            ;;
        backup)
            run_compose exec backup /app/scripts/backup.sh
            ;;
        cleanup)
            if [ "${BACKUP_ONLY:-}" != "true" ]; then
                database_maintenance
            fi
            log_maintenance
            system_cleanup
            ;;
        logs)
            log_maintenance
            ;;
        update)
            system_update
            ;;
        repair)
            database_repair
            ;;
        monitor)
            system_monitoring
            ;;
        maintenance)
            full_maintenance
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi