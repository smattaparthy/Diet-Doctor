#!/bin/bash

# Database Backup Script for Cultural Diet App
# Creates automated backups with optional cloud storage

set -euo pipefail

# Configuration
DATABASE_PATH="${DATABASE_PATH:-/app/database/cultural_diet.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
LOG_DIR="${LOG_DIR:-/app/logs}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/backup.log"
}

# Create timestamp
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="cultural_diet_backup_${TIMESTAMP}.db"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

log "🚀 Starting database backup process..."

# Check if database exists
if [ ! -f "$DATABASE_PATH" ]; then
    log "❌ Database file not found: $DATABASE_PATH"
    exit 1
fi

# Create backup using sqlite3 backup command (VACUUM)
log "📦 Creating backup: $BACKUP_FILE"
if ! sqlite3 "$BACKUP_PATH" ".backup '$DATABASE_PATH'" 2>> "$LOG_DIR/backup.log"; then
    log "❌ Failed to create backup using sqlite3 backup command"
    # Fallback to copy
    log "🔄 Trying fallback method: file copy"
    if ! cp "$DATABASE_PATH" "$BACKUP_PATH"; then
        log "❌ Failed to create backup using file copy"
        exit 1
    fi
fi

# Verify backup
log "🔍 Verifying backup integrity..."
if ! sqlite3 "$BACKUP_PATH" "PRAGMA integrity_check;" > /dev/null 2>> "$LOG_DIR/backup.log"; then
    log "❌ Backup integrity check failed"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log "✅ Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"

# Optional: Upload to S3
if [ -n "$S3_BUCKET" ] && [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    log "☁️ Uploading backup to S3: $S3_BUCKET"

    # Configure AWS CLI
    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

    # Upload to S3
    if aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/backups/$BACKUP_FILE" 2>> "$LOG_DIR/backup.log"; then
        log "✅ Backup uploaded to S3 successfully"

        # Create S3 metadata file
        METADATA_FILE="backup_metadata_${TIMESTAMP}.json"
        cat > "$BACKUP_DIR/$METADATA_FILE" << EOF
{
    "backup_file": "$BACKUP_FILE",
    "timestamp": "$(date -Iseconds)",
    "size_bytes": $(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo 0),
    "database_path": "$DATABASE_PATH",
    "retention_days": $BACKUP_RETENTION_DAYS,
    "uploaded_to_s3": true,
    "s3_bucket": "$S3_BUCKET",
    "s3_key": "backups/$BACKUP_FILE"
}
EOF

        aws s3 cp "$BACKUP_DIR/$METADATA_FILE" "s3://$S3_BUCKET/backups/$METADATA_FILE" 2>> "$LOG_DIR/backup.log" || true
    else
        log "⚠️ Failed to upload backup to S3"
    fi
fi

# Cleanup old backups
log "🧹 Cleaning up old backups (retention: $BACKUP_RETENTION_DAYS days)"
find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>> "$LOG_DIR/backup.log" || true
find "$BACKUP_DIR" -name "backup_metadata_*.json" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>> "$LOG_DIR/backup.log" || true

# List current backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f | wc -l)
log "📊 Current backup count: $BACKUP_COUNT files"

# Log success
echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$LOG_DIR/backup_last_success.log"
log "🎉 Backup process completed successfully"

# Summary
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "📋 Backup Summary:"
log "   - File: $BACKUP_FILE"
log "   - Size: $BACKUP_SIZE"
log "   - Directory: $BACKUP_DIR"
log "   - Total backup storage: $TOTAL_SIZE"
log "   - Retention period: $BACKUP_RETENTION_DAYS days"

exit 0