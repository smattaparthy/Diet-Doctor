#!/bin/bash

# Backup Cleanup Script for Cultural Diet App
# Manages backup retention and storage cleanup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
LOG_DIR="${LOG_DIR:-/app/logs}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_MAX_SIZE_GB="${BACKUP_MAX_SIZE_GB:-10}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_DAILY="${KEEP_DAILY:-7}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/backup-cleanup.log"
}

# Convert GB to bytes
gb_to_bytes() {
    echo "$(($1 * 1024 * 1024 * 1024))"
}

# Calculate age in days
file_age_days() {
    local file="$1"
    local now=$(date +%s)
    local file_time=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo 0)
    echo $(((now - file_time) / 86400))
}

# Smart backup retention based on age patterns
smart_retention() {
    log "🧠 Applying smart retention policies..."

    # Find all backup files
    local backup_files=()
    while IFS= read -r -d '' file; do
        backup_files+=("$file")
    done < <(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -print0)

    # Sort files by date (newest first)
    IFS=$'\n' backup_files=($(sort -r <<<"${backup_files[*]}"))

    local total_files=${#backup_files[@]}
    local deleted_files=0
    local saved_size=0

    # Keep patterns
    declare -A kept_files
    local now_date=$(date +%Y%m%d)
    local one_week_ago=$(date -d '7 days ago' +%Y%m%d 2>/dev/null || date -v-7d +%Y%m%d)
    local one_month_ago=$(date -d '30 days ago' +%Y%m%d 2>/dev/null || date -v-30d +%Y%m%d)

    for file in "${backup_files[@]}"; do
        local file_name=$(basename "$file")
        local file_date=$(echo "$file_name" | grep -o '[0-9]\{8\}' | head -n1)
        local age_days=$(file_age_days "$file")
        local file_size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo 0)

        # Skip if we can't determine file date
        if [ -z "$file_date" ]; then
            log "⚠️ Skipping file with undetermined date: $file_name"
            continue
        fi

        local should_keep=false
        local reason=""

        # Always keep files younger than 1 day
        if [ "$age_days" -lt 1 ]; then
            should_keep=true
            reason="recent (<1 day)"
        # Keep daily backups for last $KEEP_DAILY days
        elif [ "$age_days" -le "$KEEP_DAILY" ]; then
            should_keep=true
            reason="daily backup"
        # Keep weekly backups for last $KEEP_WEEKLY weeks
        elif [ "$age_days" -le $((KEEP_WEEKLY * 7)) ]; then
            local day_of_week=$(date -d "$file_date" +%u 2>/dev/null || date -j -f "%Y%m%d" "$file_date" +%u 2>/dev/null || echo "1")
            if [ "$day_of_week" = "1" ]; then  # Keep Monday backups
                should_keep=true
                reason="weekly backup"
            fi
        # Keep monthly backups for last $KEEP_MONTHLY months
        elif [ "$age_days" -le $((KEEP_MONTHLY * 30)) ]; then
            local day_of_month=$(date -d "$file_date" +%d 2>/dev/null || date -j -f "%Y%m%d" "$file_date" +%d 2>/dev/null || echo "01")
            if [ "$day_of_month" = "01" ]; then  # Keep 1st of month backups
                should_keep=true
                reason="monthly backup"
            fi
        # Keep if it's the first backup of a month
        else
            local file_month=$(date -d "$file_date" +%Y%m 2>/dev/null || date -j -f "%Y%m%d" "$file_date" +%Y%m 2>/dev/null || echo "$file_date")
            local month_key="${file_month}_kept"

            if [ -z "${kept_files[$month_key]:-}" ]; then
                should_keep=true
                reason="first of month"
                kept_files[$month_key]=1
            fi
        fi

        if [ "$should_keep" = true ]; then
            log "✅ Keeping: $file_name (age: ${age_days}d, reason: $reason)"
        else
            log "🗑️ Deleting: $file_name (age: ${age_days}d, size: $(numfmt --to=iec $file_size))"
            rm -f "$file"
            ((deleted_files++))
            saved_size=$((saved_size + file_size))
        fi
    done

    log "📊 Smart retention summary:"
    log "   - Total files processed: $total_files"
    log "   - Files deleted: $deleted_files"
    log "   - Space saved: $(numfmt --to=iec $saved_size)"
}

# Size-based cleanup
size_based_cleanup() {
    local max_bytes=$(gb_to_bytes "$BACKUP_MAX_SIZE_GB")
    local current_size=$(du -sb "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo 0)

    if [ "$current_size" -le "$max_bytes" ]; then
        log "📏 Backup directory size ($(numfmt --to=iec $current_size)) is under limit ($(numfmt --to=iec $max_bytes))"
        return
    fi

    local excess_size=$((current_size - max_bytes))
    log "⚖️ Need to free $(numfmt --to=iec $excess_size) to meet size limit"

    # Find oldest backup files and delete until under limit
    local backup_files=()
    while IFS= read -r -d '' file; do
        backup_files+=("$file")
    done < <(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -print0 | sort -z)

    local freed_size=0
    for file in "${backup_files[@]}"; do
        if [ "$current_size" -le "$max_bytes" ]; then
            break
        fi

        local file_size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo 0)
        local file_name=$(basename "$file")

        log "🗑️ Deleting oldest backup: $file_name (size: $(numfmt --to=iec $file_size))"
        rm -f "$file"

        current_size=$((current_size - file_size))
        freed_size=$((freed_size + file_size))
    done

    log "✅ Size-based cleanup completed, freed $(numfmt --to=iec $freed_size)"
}

# Cleanup metadata files
cleanup_metadata() {
    log "🧹 Cleaning up metadata files..."

    # Remove orphaned metadata files
    find "$BACKUP_DIR" -name "backup_metadata_*.json" -type f | while read -r metadata_file; do
        local backup_file=$(jq -r '.backup_file // empty' "$metadata_file" 2>/dev/null || echo "")

        if [ -n "$backup_file" ] && [ ! -f "$BACKUP_DIR/$backup_file" ]; then
            log "🗑️ Removing orphaned metadata: $(basename "$metadata_file")"
            rm -f "$metadata_file"
        fi
    done

    # Remove old metadata based on retention policy
    find "$BACKUP_DIR" -name "backup_metadata_*.json" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
}

# S3 cleanup
s3_cleanup() {
    if [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        log "☁️ S3 not configured, skipping S3 cleanup"
        return
    fi

    log "☁️ Cleaning up S3 backups..."

    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

    # List S3 backup files with dates
    local s3_files=()
    while IFS= read -r line; do
        s3_files+=("$line")
    done < <(aws s3 ls "s3://$S3_BUCKET/backups/" --recursive | grep "cultural_diet_backup_" || true)

    if [ ${#s3_files[@]} -eq 0 ]; then
        log "   No S3 backups found"
        return
    fi

    # Process each S3 file
    for s3_info in "${s3_files[@]}"; do
        local s3_key=$(echo "$s3_info" | awk '{print $4}')
        local s3_date_str=$(echo "$s3_info" | awk '{print $1" "$2}')

        # Parse date and check if older than retention period
        local s3_date=$(date -d "$s3_date_str" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$s3_date_str" +%s 2>/dev/null || echo "0")
        local now=$(date +%s)
        local age_days=$(((now - s3_date) / 86400))

        if [ "$age_days" -gt "$BACKUP_RETENTION_DAYS" ]; then
            log "🗑️ Deleting old S3 backup: $s3_key (${age_days} days old)"
            aws s3 rm "s3://$S3_BUCKET/$s3_key" || log "⚠️ Failed to delete S3 file: $s3_key"
        fi
    done

    # Also clean up metadata files
    aws s3 ls "s3://$S3_BUCKET/backups/" --recursive | grep "backup_metadata_" | while read -r s3_info; do
        local s3_key=$(echo "$s3_info" | awk '{print $4}')
        local s3_date_str=$(echo "$s3_info" | awk '{print $1" "$2}')

        local s3_date=$(date -d "$s3_date_str" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$s3_date_str" +%s 2>/dev/null || echo "0")
        local now=$(date +%s)
        local age_days=$(((now - s3_date) / 86400))

        if [ "$age_days" -gt "$BACKUP_RETENTION_DAYS" ]; then
            log "🗑️ Deleting old S3 metadata: $s3_key (${age_days} days old)"
            aws s3 rm "s3://$S3_BUCKET/$s3_key" || log "⚠️ Failed to delete S3 metadata: $s3_key"
        fi
    done
}

# Generate cleanup report
generate_report() {
    log "📊 Generating cleanup report..."

    local total_backups=$(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    local oldest_backup=$(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -exec ls -lt {} + | tail -n 1 | awk '{print $6, $7, $8}' 2>/dev/null || echo "none")
    local newest_backup=$(find "$BACKUP_DIR" -name "cultural_diet_backup_*.db" -type f -exec ls -lt {} + | head -n 1 | awk '{print $6, $7, $8}' 2>/dev/null || echo "none")

    log "📋 Backup Directory Report:"
    log "   - Total backups: $total_backups"
    log "   - Total size: $total_size"
    log "   - Newest backup: $newest_backup"
    log "   - Oldest backup: $oldest_backup"
    log "   - Retention policy: $BACKUP_RETENTION_DAYS days"
    log "   - Size limit: ${BACKUP_MAX_SIZE_GB}GB"

    # Save report to file
    local report_file="$LOG_DIR/cleanup_report_$(date +%Y%m%d_%H%M%S).txt"
    cat > "$report_file" << EOF
Cultural Diet App Backup Cleanup Report
Generated: $(date '+%Y-%m-%d %H:%M:%S')

Configuration:
- Retention Days: $BACKUP_RETENTION_DAYS
- Size Limit: ${BACKUP_MAX_SIZE_GB}GB
- Keep Monthly: $KEEP_MONTHLY
- Keep Weekly: $KEEP_WEEKLY
- Keep Daily: $KEEP_DAILY

Status:
- Total Backups: $total_backups
- Total Size: $total_size
- Newest Backup: $newest_backup
- Oldest Backup: $oldest_backup

Recent Log Entries:
$(tail -n 20 "$LOG_DIR/backup-cleanup.log" 2>/dev/null || echo "No recent logs")
EOF

    log "📄 Report saved to: $report_file"
}

# Main function
main() {
    log "🚀 Starting backup cleanup process..."

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log "❌ Backup directory not found: $BACKUP_DIR"
        exit 1
    fi

    # Run cleanup steps
    smart_retention
    size_based_cleanup
    cleanup_metadata
    s3_cleanup
    generate_report

    log "🎉 Backup cleanup process completed!"
}

# Run main function
main "$@"