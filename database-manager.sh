#!/bin/bash

# Database Management Script for Cultural Diet App
# Comprehensive database operations and management tools

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-cultural-diet}
ENVIRONMENT="${ENVIRONMENT:-dev}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
DATABASE_PATH="/app/database/cultural_diet.db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "${QUIET:-}" != "true" ] || [ "$level" = "ERROR" ]; then
        case "$level" in
            "INFO")  echo -e "${GREEN}[INFO]${NC}  ${timestamp} - $message" ;;
            "WARN")  echo -e "${YELLOW}[WARN]${NC}  ${timestamp} - $message" ;;
            "ERROR") echo -e "${RED}[ERROR]${NC} ${timestamp} - $message" ;;
            "DEBUG") echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message" ;;
            "SQL")   echo -e "${CYAN}[SQL]${NC}   ${timestamp} - $message" ;;
            *)       echo -e "[LOG]   ${timestamp} - $message" ;;
        esac
    fi
}

# Display usage
usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [COMMAND] [OPTIONS]

Database management for Cultural Diet App

ENVIRONMENTS:
  dev          Development environment (default)
  prod         Production environment

COMMANDS:
  status       Show database status and information
  backup       Create database backup
  restore      Restore database from backup
  migrate      Run database migrations
  seed         Seed database with sample data
  reset        Reset database (warning: deletes all data)
  analyze      Analyze database performance
  repair       Repair database corruption
  export       Export data to various formats
  import       Import data from files
  query        Execute custom SQL queries
  shell        Open SQLite shell
  optimize     Optimize database performance
  vacuum       Reclaim database space

OPTIONS:
  -f, --file FILE         Specify backup or import file
  -t, --table TABLE       Target specific table
  -q, --query SQL         Execute SQL query
  --format FORMAT         Export format (sql, csv, json)
  --dry-run               Show what would be done
  --force                 Skip confirmation prompts
  -v, --verbose           Verbose output
  -h, --help              Show this help message

EXAMPLES:
  $0 status                    # Show database status
  $0 prod backup               # Backup production database
  $0 restore --latest          # Restore from latest backup
  $0 migrate                   # Run migrations
  $0 seed                      # Seed with sample data
  $0 query "SELECT COUNT(*) FROM users"  # Execute query
  $0 export --table users --format csv  # Export users table
  $0 analyze                   # Analyze performance
  $0 shell                     # Open SQLite shell

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

# Execute SQLite command
exec_sql() {
    local sql="$1"
    local database="${2:-$DATABASE_PATH}"

    if [ "${DRY_RUN:-}" = "true" ]; then
        log "SQL" "$sql"
        return 0
    fi

    log "SQL" "Executing: $sql"
    run_compose exec -T backend sqlite3 "$database" "$sql" 2>/dev/null || {
        log "ERROR" "SQL execution failed: $sql"
        return 1
    }
}

# Wait for database to be available
wait_for_database() {
    local max_wait=30
    local wait_count=0

    log "INFO" "Waiting for database..."

    while [ $wait_count -lt $max_wait ]; do
        if exec_sql "SELECT 1;" &>/dev/null; then
            log "INFO" "Database is available"
            return 0
        fi
        sleep 1
        ((wait_count++))
    done

    log "ERROR" "Database did not become available"
    return 1
}

# Database status
show_status() {
    log "INFO" "Database Status Report"
    echo "========================"

    # Check if database exists and is accessible
    if exec_sql "SELECT 1;" &>/dev/null; then
        log "INFO" "✅ Database: Accessible"
    else
        log "ERROR" "❌ Database: Not accessible"
        return 1
    fi

    # Database file info
    local file_size=$(run_compose exec backend ls -lh "$DATABASE_PATH" | awk '{print $5}')
    local file_date=$(run_compose exec backend stat -c %y "$DATABASE_PATH" 2>/dev/null | cut -d' ' -f1,2 || echo "unknown")
    log "INFO" "📁 File size: $file_size"
    log "INFO" "📅 Last modified: $file_date"

    # Database information
    log "INFO" "📊 Database Information:"
    local page_size=$(exec_sql "PRAGMA page_size;")
    local page_count=$(exec_sql "PRAGMA page_count;")
    local total_size=$((page_size * page_count))
    log "INFO" "   - Page size: $page_size bytes"
    log "INFO" "   - Page count: $page_count"
    log "INFO" "   - Calculated size: $(numfmt --to=iec $total_size)"

    # Table statistics
    log "INFO" "📋 Tables:"
    exec_sql "
        SELECT
            name as table_name,
            sql as definition
        FROM sqlite_master
        WHERE type='table'
        ORDER BY name;
    " | while IFS='|' read -r table_name definition; do
        if [ -n "$table_name" ] && [ "$table_name" != "table_name" ]; then
            local row_count=$(exec_sql "SELECT COUNT(*) FROM $table_name;")
            log "INFO" "   - $table_name: $row_count rows"
        fi
    done

    # Index information
    log "INFO" "📑 Indexes:"
    exec_sql "
        SELECT
            name as index_name,
            tbl_name as table_name
        FROM sqlite_master
        WHERE type='index'
        ORDER BY tbl_name, name;
    " | while IFS='|' read -r index_name table_name; do
        if [ -n "$index_name" ] && [ "$index_name" != "index_name" ]; then
            log "INFO" "   - $index_name (on $table_name)"
        fi
    done

    # Database schema version
    local version_info=$(exec_sql "PRAGMA user_version;" || echo "0")
    log "INFO" "🏷️  Schema version: $version_info"

    # Foreign key constraints
    local fk_enabled=$(exec_sql "PRAGMA foreign_keys;")
    log "INFO" "🔗 Foreign keys: $fk_enabled"

    # Journal mode
    local journal_mode=$(exec_sql "PRAGMA journal_mode;")
    log "INFO" "📝 Journal mode: $journal_mode"

    echo "========================"
}

# Database backup
create_backup() {
    log "INFO" "Creating database backup..."

    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="manual_backup_${timestamp}.db"
    local backup_dir="/app/backups"

    # Ensure backup directory exists
    run_compose exec backend mkdir -p "$backup_dir"

    local backup_path="$backup_dir/$backup_file"

    # Create backup
    if exec_sql ".backup '$backup_path'" "/app/database/cultural_diet.db"; then
        log "INFO" "✅ Backup created: $backup_file"

        # Verify backup
        if exec_sql "PRAGMA integrity_check;" "$backup_path" | grep -q "ok"; then
            log "INFO" "✅ Backup integrity verified"
        else
            log "ERROR" "❌ Backup integrity check failed"
            return 1
        fi

        # Get backup size
        local backup_size=$(run_compose exec backend ls -lh "$backup_path" | awk '{print $5}')
        log "INFO" "📁 Backup size: $backup_size"
    else
        log "ERROR" "❌ Backup creation failed"
        return 1
    fi
}

# Database restore
restore_database() {
    local backup_option="$1"

    log "INFO" "Restoring database..."

    case "$backup_option" in
        --latest|"")
            # Find latest backup
            local latest_backup=$(run_compose exec backend find /app/backups -name "*backup_*.db" -type f | sort | tail -n 1)
            if [ -z "$latest_backup" ]; then
                log "ERROR" "No backup files found"
                return 1
            fi
            backup_file="$latest_backup"
            ;;
        --file)
            backup_file="$2"
            ;;
        *)
            log "ERROR" "Invalid restore option: $backup_option"
            return 1
            ;;
    esac

    # Verify backup exists
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        backup_file="/app/backups/$backup_file"
        if [ ! -f "$backup_file" ]; then
            log "ERROR" "Backup file not found: $backup_file"
            return 1
        fi
    fi

    # Create emergency backup before restore
    local emergency_backup="emergency_restore_backup_$(date +%Y%m%d_%H%M%S).db"
    run_compose exec backend cp "$DATABASE_PATH" "/app/backups/$emergency_backup" || log "WARN" "Emergency backup failed"

    log "INFO" "Restoring from: $(basename "$backup_file")"

    # Verify backup integrity
    if ! exec_sql "PRAGMA integrity_check;" "$backup_file" | grep -q "ok"; then
        log "ERROR" "Backup file is corrupted"
        return 1
    fi

    # Perform restore
    if [ "${DRY_RUN:-}" != "true" ]; then
        if exec_sql ".restore '$backup_file'" "$DATABASE_PATH"; then
            log "INFO" "✅ Database restored successfully"

            # Verify restored database
            if exec_sql "PRAGMA integrity_check;" | grep -q "ok"; then
                log "INFO" "✅ Restored database integrity verified"
            else
                log "ERROR" "❌ Restored database integrity check failed"
                return 1
            fi
        else
            log "ERROR" "❌ Database restore failed"
            return 1
        fi
    else
        log "INFO" "[DRY RUN] Would restore from $backup_file"
    fi
}

# Database migration
run_migrations() {
    log "INFO" "Running database migrations..."

    wait_for_database

    # Get current schema version
    local current_version=$(exec_sql "PRAGMA user_version;")
    log "INFO" "Current schema version: $current_version"

    # Run migration command
    if [ "${DRY_RUN:-}" != "true" ]; then
        if run_compose exec backend npm run migrate; then
            local new_version=$(exec_sql "PRAGMA user_version;")
            log "INFO" "✅ Migrations completed"
            log "INFO" "New schema version: $new_version"
        else
            log "ERROR" "❌ Migration failed"
            return 1
        fi
    else
        log "INFO" "[DRY RUN] Would run migrations"
    fi
}

# Database seeding
seed_database() {
    log "INFO" "Seeding database with sample data..."

    wait_for_database

    if [ "${DRY_RUN:-}" != "true" ]; then
        if run_compose exec backend npm run seed; then
            log "INFO" "✅ Database seeding completed"
            log "INFO" "📊 New data counts:"
            show_table_counts
        else
            log "ERROR" "❌ Database seeding failed"
            return 1
        fi
    else
        log "INFO" "[DRY RUN] Would seed database with sample data"
    fi
}

# Reset database
reset_database() {
    log "WARN" "⚠️  WARNING: This will delete all data in the database!"

    if [ "${FORCE:-}" != "true" ]; then
        echo -n "Are you sure you want to reset the database? (type 'RESET' to confirm): "
        read -r confirmation
        if [ "$confirmation" != "RESET" ]; then
            log "INFO" "Database reset cancelled"
            return 0
        fi
    fi

    # Create backup before reset
    log "INFO" "Creating pre-reset backup..."
    create_backup

    # Delete database file
    if [ "${DRY_RUN:-}" != "true" ]; then
        run_compose exec backend rm "$DATABASE_PATH" || log "WARN" "Could not remove database file"

        # Run migrations and seed
        run_migrations
        seed_database

        log "INFO" "✅ Database reset completed"
    else
        log "INFO" "[DRY RUN] Would reset database"
    fi
}

# Show table counts
show_table_counts() {
    exec_sql "
        SELECT
            name as table_name
        FROM sqlite_master
        WHERE type='table'
        ORDER BY name;
    " | while read -r table_name; do
        if [ -n "$table_name" ] && [ "$table_name" != "table_name" ]; then
            local row_count=$(exec_sql "SELECT COUNT(*) FROM $table_name;")
            log "INFO" "   - $table_name: $row_count rows"
        fi
    done
}

# Database analysis
analyze_database() {
    log "INFO" "Analyzing database performance..."

    # Analyze database
    log "INFO" "Running ANALYZE..."
    exec_sql "ANALYZE;"

    # Show table statistics
    log "INFO" "📊 Table Statistics:"
    exec_sql "
        SELECT
            name as table_name
        FROM sqlite_master
        WHERE type='table'
        ORDER BY name;
    " | while read -r table_name; do
        if [ -n "$table_name" ] && [ "$table_name" != "table_name" ]; then
            local row_count=$(exec_sql "SELECT COUNT(*) FROM $table_name;")
            local table_info=$(exec_sql "PRAGMA table_info($table_name);")
            local index_info=$(exec_sql "PRAGMA index_list($table_name);")

            log "INFO" "   Table: $table_name"
            log "INFO" "   - Rows: $row_count"
            log "INFO" "   - Columns: $(echo "$table_info" | wc -l)"
            log "INFO" "   - Indexes: $(echo "$index_info" | wc -l)"
        fi
    done

    # Check for optimization opportunities
    log "INFO" "🔍 Optimization Suggestions:"

    # Check for tables without indexes
    exec_sql "
        SELECT name as table_name
        FROM sqlite_master
        WHERE type='table'
        AND name NOT IN (SELECT DISTINCT tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%')
        ORDER BY name;
    " | while read -r table_name; do
        if [ -n "$table_name" ] && [ "$table_name" != "table_name" ]; then
            local row_count=$(exec_sql "SELECT COUNT(*) FROM $table_name;")
            if [ "$row_count" -gt 100 ]; then
                log "INFO" "   - Consider adding indexes to $table_name ($row_count rows)"
            fi
        fi
    done

    # Database size analysis
    local page_size=$(exec_sql "PRAGMA page_size;")
    local page_count=$(exec_sql "PRAGMA page_count;")
    local total_size=$((page_size * page_count))

    log "INFO" "📈 Database Size Analysis:"
    log "INFO" "   - Total size: $(numfmt --to=iec $total_size)"
    log "INFO" "   - Page size: $page_size"
    log "INFO" "   - Page count: $page_count"

    # Fragmentation check
    local free_page_count=$(exec_sql "PRAGMA freelist_count;")
    local fragmented_size=$((free_page_count * page_size))
    if [ "$fragmented_size" -gt 1048576 ]; then  # > 1MB
        log "INFO" "   - Fragmented space: $(numfmt --to=iec $fragmented_size) (consider VACUUM)"
    fi
}

# Export data
export_data() {
    local table="${TABLE:-}"
    local format="${FORMAT:-csv}"
    local output_file="export_${table:-all}_$(date +%Y%m%d_%H%M%S).${format}"

    log "INFO" "Exporting data to $format format..."

    if [ -n "$table" ]; then
        # Export specific table
        log "INFO" "Exporting table: $table"
        case "$format" in
            csv)
                exec_sql ".headers on
.mode csv
.output '/app/exports/$output_file'
SELECT * FROM $table;" || log "ERROR" "CSV export failed"
                ;;
            json)
                exec_sql ".mode json
.output '/app/exports/$output_file'
SELECT * FROM $table;" || log "ERROR" "JSON export failed"
                ;;
            sql)
                exec_sql ".output '/app/exports/$output_file'
.dump $table" || log "ERROR" "SQL export failed"
                ;;
            *)
                log "ERROR" "Unsupported export format: $format"
                return 1
                ;;
        esac
    else
        # Export all tables
        log "INFO" "Exporting all tables"
        exec_sql ".output '/app/exports/$output_file'
.dump" || log "ERROR" "Full export failed"
    fi

    # Create exports directory
    run_compose exec backend mkdir -p /app/exports

    # Get file size
    local export_size=$(run_compose exec backend ls -lh "/app/exports/$output_file" 2>/dev/null | awk '{print $5}' || echo "unknown")
    log "INFO" "✅ Export completed: $output_file ($export_size)"
}

# Import data
import_data() {
    local file="$1"
    local format="${FORMAT:-}"
    local table="${TABLE:-}"

    log "INFO" "Importing data from: $file"

    if [ -z "$file" ]; then
        log "ERROR" "Import file not specified"
        return 1
    fi

    # Determine format from file extension
    if [ -z "$format" ]; then
        case "$file" in
            *.csv) format="csv" ;;
            *.json) format="json" ;;
            *.sql) format="sql" ;;
            *)
                log "ERROR" "Cannot determine format from file extension"
                return 1
                ;;
        esac
    fi

    # Check if file exists
    if ! run_compose exec backend test -f "/app/imports/$file"; then
        log "ERROR" "Import file not found: $file"
        return 1
    fi

    # Create imports directory
    run_compose exec backend mkdir -p /app/imports

    # Import based on format
    case "$format" in
        sql)
            log "INFO" "Importing SQL file..."
            if [ "${DRY_RUN:-}" != "true" ]; then
                exec_sql ".read '/app/imports/$file'"
                log "INFO" "✅ SQL import completed"
            else
                log "INFO" "[DRY RUN] Would import SQL file: $file"
            fi
            ;;
        csv)
            if [ -z "$table" ]; then
                log "ERROR" "Target table required for CSV import"
                return 1
            fi
            log "INFO" "Importing CSV to table: $table"
            if [ "${DRY_RUN:-}" != "true" ]; then
                exec_sql ".mode csv
.import '/app/imports/$file' $table"
                log "INFO" "✅ CSV import completed"
            else
                log "INFO" "[DRY RUN] Would import CSV to table: $table"
            fi
            ;;
        *)
            log "ERROR" "Unsupported import format: $format"
            return 1
            ;;
    esac
}

# Execute custom query
execute_query() {
    local query="$1"

    if [ -z "$query" ]; then
        log "ERROR" "Query not specified"
        return 1
    fi

    log "INFO" "Executing query..."
    exec_sql "$query"
}

# Open SQLite shell
open_shell() {
    log "INFO" "Opening SQLite shell..."
    run_compose exec backend sqlite3 "$DATABASE_PATH"
}

# Optimize database
optimize_database() {
    log "INFO" "Optimizing database..."

    # Analyze tables
    log "INFO" "Analyzing tables..."
    exec_sql "ANALYZE;"

    # Check foreign key integrity
    log "INFO" "Checking foreign key integrity..."
    exec_sql "PRAGMA foreign_key_check;"

    # Optimize
    log "INFO" "Running optimization..."
    exec_sql "PRAGMA optimize;"

    log "INFO" "✅ Database optimization completed"
}

# Vacuum database
vacuum_database() {
    log "INFO" "Running VACUUM to reclaim space..."

    local before_size=$(run_compose exec backend ls -l "$DATABASE_PATH" | awk '{print $5}')

    if [ "${DRY_RUN:-}" != "true" ]; then
        exec_sql "VACUUM;"

        local after_size=$(run_compose exec backend ls -l "$DATABASE_PATH" | awk '{print $5}')
        local reclaimed=$((before_size - after_size))

        log "INFO" "✅ VACUUM completed"
        log "INFO" "📊 Size reduced: $(numfmt --to=iec $reclaimed)"
    else
        log "INFO" "[DRY RUN] Would run VACUUM"
    fi
}

# Main function
main() {
    local command="status"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|prod)
                ENVIRONMENT="$1"
                COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
                shift
                ;;
            -f|--file)
                BACKUP_FILE="$2"
                shift 2
                ;;
            -t|--table)
                TABLE="$2"
                shift 2
                ;;
            -q|--query)
                QUERY="$2"
                shift 2
                ;;
            --format)
                FORMAT="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            status|backup|restore|migrate|seed|reset|analyze|repair|export|import|query|shell|optimize|vacuum)
                command="$1"
                shift
                ;;
            *)
                if [ "$command" = "restore" ]; then
                    BACKUP_FILE="$1"
                elif [ "$command" = "import" ]; then
                    IMPORT_FILE="$1"
                elif [ "$command" = "query" ]; then
                    QUERY="$1"
                else
                    log "ERROR" "Unknown option: $1"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Set environment
    export ENVIRONMENT
    export COMPOSE_PROJECT_NAME

    log "INFO" "Cultural Diet App Database Manager"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Command: $command"

    # Run command
    case "$command" in
        status)
            show_status
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_database "${BACKUP_FILE:---latest}"
            ;;
        migrate)
            run_migrations
            ;;
        seed)
            seed_database
            ;;
        reset)
            reset_database
            ;;
        analyze)
            analyze_database
            ;;
        repair)
            database_repair
            ;;
        export)
            export_data
            ;;
        import)
            import_data "${IMPORT_FILE:-}"
            ;;
        query)
            execute_query "${QUERY:-}"
            ;;
        shell)
            open_shell
            ;;
        optimize)
            optimize_database
            ;;
        vacuum)
            vacuum_database
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Simple database repair function
database_repair() {
    log "INFO" "Attempting database repair..."

    # Create backup
    local emergency_backup="repair_backup_$(date +%Y%m%d_%H%M%S).db"
    run_compose exec backend cp "$DATABASE_PATH" "/app/backups/$emergency_backup"

    # Check integrity
    local integrity_result=$(exec_sql "PRAGMA integrity_check;")

    if echo "$integrity_result" | grep -q "ok"; then
        log "INFO" "✅ Database integrity is OK, no repair needed"
        return 0
    else
        log "WARN" "⚠️  Database integrity issues detected:"
        echo "$integrity_result"

        # Attempt repair
        log "INFO" "Attempting repair..."
        if exec_sql ".recover" | exec_sql -; then
            log "INFO" "✅ Database repair completed"
        else
            log "ERROR" "❌ Database repair failed"
            return 1
        fi
    fi
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi