#!/bin/bash

# Docker Deployment Script for Cultural Diet App
# Easy deployment for development and production environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PROJECT_NAME="cultural-diet"
ENVIRONMENT="${ENVIRONMENT:-dev}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
PROFILE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
Usage: $0 [ENVIRONMENT] [OPTIONS] [COMMAND]

Deploy Cultural Diet App using Docker Compose

ENVIRONMENTS:
  dev          Development environment with hot reload (default)
  prod         Production environment with optimizations

COMMANDS:
  up           Start all services (default)
  down         Stop all services and remove containers
  restart      Restart all services
  logs         Show logs for all services
  build        Build/rebuild all images
  clean        Clean up containers, volumes, and images
  status       Show status of all services
  backup       Create database backup
  restore      Restore database from backup
  migrate      Run database migrations
  seed         Seed database with sample data

OPTIONS:
  -p, --profile PROFILE   Enable docker-compose profile (e.g., monitoring, backup)
  -f, --force             Force rebuild without cache
  -v, --verbose           Verbose output
  -h, --help              Show this help message

EXAMPLES:
  $0                      # Start development environment
  $0 prod up              # Start production environment
  $0 dev --profile admin up   # Start dev with admin tools
  $0 prod restart         # Restart production services
  $0 prod --profile monitoring up  # Start prod with monitoring
  $0 prod backup          # Create backup in production
  $0 prod restore --latest # Restore from latest backup

ENVIRONMENT VARIABLES:
  ENVIRONMENT             Set environment (dev/prod)
  COMPOSE_PROJECT_NAME    Docker compose project name
  JWT_SECRET              JWT secret for production
  BACKUP_SCHEDULE         Backup cron schedule
  BACKUP_RETENTION_DAYS   Backup retention period

EOF
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed or not in PATH"
        log "ERROR" "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log "ERROR" "Docker Compose is not installed"
        log "ERROR" "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Check compose file exists
    if [ ! -f "$SCRIPT_DIR/$COMPOSE_FILE" ]; then
        log "ERROR" "Docker Compose file not found: $COMPOSE_FILE"
        log "ERROR" "Available files:"
        ls -la "$SCRIPT_DIR"/docker-compose*.yml 2>/dev/null || log "ERROR" "No compose files found"
        exit 1
    fi

    log "INFO" "Prerequisites check passed"
}

# Setup environment
setup_environment() {
    log "INFO" "Setting up $ENVIRONMENT environment..."

    # Create necessary directories
    local dirs=(
        ".docker-data/$ENVIRONMENT/database"
        ".docker-data/$ENVIRONMENT/logs"
        ".docker-data/$ENVIRONMENT/backups"
        ".docker-data/$ENVIRONMENT/uploads"
        ".docker-data/$ENVIRONMENT/user_data"
    )

    for dir in "${dirs[@]}"; do
        mkdir -p "$SCRIPT_DIR/$dir"
        log "DEBUG" "Created directory: $dir"
    done

    # Create .env file if it doesn't exist
    local env_file="$SCRIPT_DIR/.env.$ENVIRONMENT"
    if [ ! -f "$env_file" ]; then
        log "INFO" "Creating environment file: $env_file"
        cat > "$env_file" << EOF
# Cultural Diet App - $ENVIRONMENT Environment
# Generated on $(date '+%Y-%m-%d %H:%M:%S')

# Core Configuration
NODE_ENV=$ENVIRONMENT
PORT=3000
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME

# Database
DATABASE_PATH=/app/database/cultural_diet.db

# Security
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-this-jwt-secret-in-production")
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=info

# Backup Configuration
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# Production Only (set these for production)
# S3_BUCKET=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# GRAFANA_PASSWORD=
EOF
        log "WARN" "Environment file created. Please review and update secrets in $env_file"
    fi

    # Export environment variables
    set -a
    if [ -f "$env_file" ]; then
        # shellcheck source=/dev/null
        source "$env_file"
    fi
    set +a

    log "INFO" "Environment setup completed"
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

    local cmd="$compose_cmd -f $COMPOSE_FILE"

    if [ -n "$PROFILE" ]; then
        cmd="$cmd --profile $PROFILE"
    fi

    cmd="$cmd --project-name $COMPOSE_PROJECT_NAME"

    if [ "${VERBOSE:-}" = "true" ]; then
        log "DEBUG" "Running: $cmd $*"
    fi

    $cmd "$@"
}

# Start services
start_services() {
    log "INFO" "Starting $ENVIRONMENT services..."

    if [ "${FORCE:-}" = "true" ]; then
        run_compose build --no-cache
    else
        run_compose build
    fi

    run_compose up -d

    log "INFO" "Services started successfully"
    show_service_status
}

# Stop services
stop_services() {
    log "INFO" "Stopping $ENVIRONMENT services..."
    run_compose down
    log "INFO" "Services stopped"
}

# Restart services
restart_services() {
    log "INFO" "Restarting $ENVIRONMENT services..."
    run_compose restart
    log "INFO" "Services restarted"
}

# Show logs
show_logs() {
    log "INFO" "Showing logs for $ENVIRONMENT services..."
    run_compose logs -f --tail=100
}

# Clean up resources
cleanup_resources() {
    log "INFO" "Cleaning up $ENVIRONMENT resources..."

    # Stop and remove containers
    run_compose down --remove-orphans

    # Remove volumes (careful - this deletes data)
    if [ "${FORCE:-}" = "true" ]; then
        log "WARN" "Force cleanup enabled - removing volumes"
        run_compose down -v
    fi

    # Remove built images
    run_compose down --rmi all

    log "INFO" "Cleanup completed"
}

# Show service status
show_service_status() {
    log "INFO" "Service status for $ENVIRONMENT:"
    run_compose ps

    # Show health status
    log "INFO" "Health checks:"
    run_compose exec backend curl -f http://localhost:3000/health 2>/dev/null >/dev/null && \
        log "INFO" "✅ Backend: Healthy" || \
        log "WARN" "❌ Backend: Unhealthy"

    if [ "$ENVIRONMENT" = "dev" ]; then
        # Check frontend in dev mode
        run_compose exec frontend curl -f http://localhost:3001 2>/dev/null >/dev/null && \
            log "INFO" "✅ Frontend: Healthy" || \
            log "WARN" "❌ Frontend: Unhealthy"
    fi
}

# Create backup
create_backup() {
    log "INFO" "Creating backup for $ENVIRONMENT..."
    run_compose exec backup /app/scripts/backup.sh
    log "INFO" "Backup completed"
}

# Restore backup
restore_backup() {
    local backup_option="$1"

    log "INFO" "Restoring backup for $ENVIRONMENT..."

    case "$backup_option" in
        "--latest"|"")
            run_compose exec backup /app/scripts/restore.sh --latest
            ;;
        "--list")
            run_compose exec backup /app/scripts/restore.sh --list
            ;;
        *)
            run_compose exec backup /app/scripts/restore.sh --file "$backup_option"
            ;;
    esac

    log "INFO" "Restore completed"
}

# Run migrations
run_migrations() {
    log "INFO" "Running database migrations for $ENVIRONMENT..."
    run_compose exec backend npm run migrate
    log "INFO" "Migrations completed"
}

# Seed database
seed_database() {
    log "INFO" "Seeding database for $ENVIRONMENT..."
    run_compose exec backend npm run seed
    log "INFO" "Database seeding completed"
}

# Main function
main() {
    local command="up"
    local backup_option=""

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|prod)
                ENVIRONMENT="$1"
                COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
                shift
                ;;
            -p|--profile)
                PROFILE="$2"
                shift 2
                ;;
            -f|--force)
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
            up|down|restart|logs|build|clean|status|backup|restore|migrate|seed)
                command="$1"
                shift
                ;;
            --latest|--list)
                backup_option="$1"
                shift
                ;;
            *)
                if [ "$command" = "restore" ]; then
                    backup_option="$1"
                    shift
                else
                    log "ERROR" "Unknown option: $1"
                    usage
                    exit 1
                fi
                ;;
        esac
    done

    # Set environment variable
    export ENVIRONMENT
    export COMPOSE_PROJECT_NAME

    log "INFO" "Cultural Diet App Deployment"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Command: $command"
    if [ -n "$PROFILE" ]; then
        log "INFO" "Profile: $PROFILE"
    fi

    # Run command
    case "$command" in
        up)
            check_prerequisites
            setup_environment
            start_services
            ;;
        down)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs
            ;;
        build)
            check_prerequisites
            setup_environment

            if [ "${FORCE:-}" = "true" ]; then
                run_compose build --no-cache
            else
                run_compose build
            fi
            ;;
        clean)
            cleanup_resources
            ;;
        status)
            show_service_status
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup "${backup_option:-}"
            ;;
        migrate)
            run_migrations
            ;;
        seed)
            seed_database
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