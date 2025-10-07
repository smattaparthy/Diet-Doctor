#!/bin/bash

# Database Restore Script for Cultural Diet App
# Restores database from backup files

set -euo pipefail

# Configuration
DATABASE_PATH="${DATABASE_PATH:-/app/database/cultural_diet.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
LOG_DIR="${LOG_DIR:-/app/logs}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

# Ensure directories exist
mkdir -p "$(dirname "$DATABASE_PATH")"
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/restore.log"
}

# Display usage
usage() {
    echo "Usage: $0 [OPTION]"
    echo "Restore Cultural Diet App database from backup"
    echo ""
    echo "Options:"
    echo "  -f, --file FILE        Restore from specific backup file"
    echo "  -l, --latest           Restore from latest backup"
    echo "  -s, --s3 FILE          Restore from S3 backup file"
    echo "  --list                 List available backups"
    echo "  --download-s3          List S3 backups"
    echo "  -h, --help             Show this help message"
}

# List local backups
list_local_backups() {
    log "📋 Available local backups:"
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -exec ls -lh {} \; | while read -r line; do
            BACKUP_FILE=$(echo "$line" | awk '{print $NF}')
            BACKUP_SIZE=$(echo "$line" | awk '{print $5}')
            BACKUP_DATE=$(echo "$line" | awk '{print $6, $7, $8}')
            echo "   📄 $BACKUP_FILE ($BACKUP_SIZE) - $BACKUP_DATE"
        done
    else
        log "   No backup directory found: $BACKUP_DIR"
    fi
}

# List S3 backups
list_s3_backups() {
    if [ -n "$S3_BUCKET" ] && [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
        log "☁️ Available S3 backups:"
        export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
        export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

        aws s3 ls "s3://$S3_BUCKET/backups/" --recursive | grep "cultural_diet_backup_" | while read -r line; do
            echo "   ☁️  $line"
        done
    else
        log "❌ S3 credentials not configured"
    fi
}

# Find latest local backup
find_latest_backup() {
    find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f | sort -r | head -n 1
}

# Restore database
restore_database() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log "❌ Backup file not found: $backup_file"
        exit 1
    fi

    # Verify backup integrity
    log "🔍 Verifying backup integrity..."
    if ! sqlite3 "$backup_file" "PRAGMA integrity_check;" > /dev/null 2>> "$LOG_DIR/restore.log"; then
        log "❌ Backup file is corrupted: $backup_file"
        exit 1
    fi

    # Create backup of current database before restore
    if [ -f "$DATABASE_PATH" ]; then
        PRE_RESTORE_BACKUP="$DATABASE_PATH.pre_restore_$(date '+%Y%m%d_%H%M%S')"
        log "💾 Creating pre-restore backup: $(basename "$PRE_RESTORE_BACKUP")"
        cp "$DATABASE_PATH" "$PRE_RESTORE_BACKUP"
    fi

    # Restore database
    log "🔄 Restoring database from: $(basename "$backup_file")"

    # Use sqlite3 restore command if available, otherwise copy
    if sqlite3 "$DATABASE_PATH" ".restore '$backup_file'" 2>> "$LOG_DIR/restore.log"; then
        log "✅ Database restored successfully using sqlite3 restore"
    else
        log "🔄 Falling back to file copy method"
        cp "$backup_file" "$DATABASE_PATH"
    fi

    # Verify restored database
    if ! sqlite3 "$DATABASE_PATH" "PRAGMA integrity_check;" > /dev/null 2>> "$LOG_DIR/restore.log"; then
        log "❌ Restored database is corrupted!"
        exit 1
    fi

    # Get database info
    TABLE_COUNT=$(sqlite3 "$DATABASE_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")

    log "🎉 Database restore completed successfully!"
    log "📊 Database info:"
    log "   - File: $DATABASE_PATH"
    log "   - Size: $(du -h "$DATABASE_PATH" | cut -f1)"
    log "   - Tables: $TABLE_COUNT"
    log "   - Source: $(basename "$backup_file")"

    if [ -n "${PRE_RESTORE_BACKUP:-}" ]; then
        log "   - Pre-restore backup: $(basename "$PRE_RESTORE_BACKUP")"
    fi
}

# Download from S3
download_from_s3() {
    local s3_key="$1"
    local local_file="$2"

    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

    log "☁️ Downloading from S3: $s3_key"
    if aws s3 cp "s3://$S3_BUCKET/$s3_key" "$local_file" 2>> "$LOG_DIR/restore.log"; then
        log "✅ Downloaded successfully"
    else
        log "❌ Failed to download from S3"
        exit 1
    fi
}

# Main script logic
main() {
    local backup_file=""
    local from_s3=""

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                backup_file="$2"
                shift 2
                ;;
            -l|--latest)
                backup_file=$(find_latest_backup)
                shift
                ;;
            -s|--s3)
                from_s3="$2"
                shift 2
                ;;
            --list)
                list_local_backups
                exit 0
                ;;
            --download-s3)
                list_s3_backups
                exit 0
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Handle S3 download
    if [ -n "$from_s3" ]; then
        local temp_file="/tmp/s3_backup_$(date +%s).db"
        download_from_s3 "$from_s3" "$temp_file"
        backup_file="$temp_file"
    fi

    # Validate backup file
    if [ -z "$backup_file" ]; then
        log "❌ No backup file specified"
        usage
        exit 1
    fi

    log "🚀 Starting database restore process..."

    # Perform restore
    restore_database "$backup_file"

    # Cleanup temporary file if downloaded from S3
    if [ -n "$from_s3" ] && [ -f "$temp_file" ]; then
        rm -f "$temp_file"
    fi

    log "🎉 Restore process completed!"
}

# Check if we have arguments
if [ $# -eq 0 ]; then
    echo "❌ No arguments provided"
    usage
    exit 1
fi

# Run main function
main "$@"