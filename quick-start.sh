#!/bin/bash

# Quick Start Script for Cultural Diet App
# Simplified setup for new users

set -euo pipefail

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

    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC}  $timestamp - $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  $timestamp - $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $timestamp - $message" ;;
        "STEP")  echo -e "${BLUE}[STEP]${NC}  $timestamp - $message" ;;
        "SUCCESS") echo -e "${CYAN}[SUCCESS]${NC} $timestamp - $message" ;;
        *)       echo -e "[LOG]   $timestamp - $message" ;;
    esac
}

# Display banner
display_banner() {
    echo -e "${BLUE}"
    cat <<'EOF'
 _____ _     _     _                _____           _                  _
|  ___| |   | |   | |              /  ___|         | |                | |
| |__ | |   | |   | |   __ _ ______\ `--. _   _ _ __| |_ ___ _ __ _ __ | |
|  __|| |   | |   | |  / _` |______|`--. \ | | | '__| __/ _ \ '__| '_ \| |
| |___| |___| |___| | | (_| |      /\__/ / |_| | |  | ||  __/ |  | |_) | |
\____/_____|_____|/   \__,_|     \____/ \__,_|_|   \__\___|_|  | .__/|_|
                                                            | |
                                                            |_|
EOF
    echo -e "${NC}"
    echo -e "${CYAN}Cultural Diet App - Docker Quick Start${NC}"
    echo -e "${CYAN}Ayurvedic and Traditional Nutrition Management${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log "STEP" "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed"
        echo -e "${YELLOW}Please install Docker: https://www.docker.com/get-docker/${NC}"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log "ERROR" "Docker Compose is not installed"
        echo -e "${YELLOW}Please install Docker Compose: https://docs.docker.com/compose/install/${NC}"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log "ERROR" "Docker daemon is not running"
        echo -e "${YELLOW}Please start Docker Desktop or Docker daemon${NC}"
        exit 1
    fi

    log "SUCCESS" "Prerequisites check passed"
}

# Setup initial configuration
setup_configuration() {
    log "STEP" "Setting up initial configuration..."

    # Create .env file if it doesn't exist
    if [ ! -f ".env.dev" ]; then
        log "INFO" "Creating development environment file..."
        cp .env.example .env.dev

        # Generate random JWT secret
        local jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo "change-this-jwt-secret-in-production")
        sed -i.bak "s/your-production-jwt-secret/$jwt_secret/g" .env.dev
        rm -f .env.dev.bak

        log "SUCCESS" "Development environment file created"
    else
        log "INFO" "Development environment file already exists"
    fi

    # Create data directories
    log "INFO" "Creating data directories..."
    mkdir -p .docker-data/{dev,prod}/{database,logs,exports,imports}

    log "SUCCESS" "Configuration setup completed"
}

# Show options menu
show_menu() {
    echo ""
    echo -e "${BLUE}Choose your setup option:${NC}"
    echo "1) 🚀 Quick Development Start (recommended)"
    echo "2) 🛠️  Development with Admin Tools"
    echo "3) 🏭 Production Setup"
    echo "4) 🗄️  Database Operations"
    echo "5) 📊 Service Status"
    echo "6) 🛑 Stop Services"
    echo "7) 🧹 Clean Up"
    echo "0) ❌ Exit"
    echo ""
    echo -n "Enter your choice [0-7]: "
}

# Quick development start
quick_dev_start() {
    log "STEP" "Starting quick development environment..."

    # Start services
    if ./deploy.sh dev up; then
        log "SUCCESS" "Development environment started successfully"
        show_access_info
    else
        log "ERROR" "Failed to start development environment"
        exit 1
    fi
}

# Development with admin tools
dev_with_admin() {
    log "STEP" "Starting development with admin tools..."

    # Start services with admin profile
    if ./deploy.sh dev up --profile admin; then
        log "SUCCESS" "Development environment with admin tools started"
        show_access_info_admin
    else
        log "ERROR" "Failed to start development environment"
        exit 1
    fi
}

# Production setup
production_setup() {
    log "STEP" "Setting up production environment..."

    echo -e "${YELLOW}⚠️  Production setup requires additional configuration${NC}"
    echo ""

    # Check if production env file exists
    if [ ! -f ".env.prod" ]; then
        echo "Creating production environment file..."
        cp .env.example .env.prod

        # Generate secure JWT secret
        local jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo "change-this-jwt-secret-in-production")
        sed -i.bak "s/your-production-jwt-secret/$jwt_secret/g" .env.prod
        rm -f .env.prod.bak

        echo -e "${YELLOW}⚠️  Please edit .env.prod with your production settings${NC}"
        echo "Press Enter to continue after you've configured the file..."
        read -r
    fi

    # Start production services
    if ./deploy.sh prod up --profile backup; then
        log "SUCCESS" "Production environment started"
        show_production_info
    else
        log "ERROR" "Failed to start production environment"
        exit 1
    fi
}

# Database operations menu
database_operations() {
    echo ""
    echo -e "${BLUE}Database Operations:${NC}"
    echo "1) 📊 Show Database Status"
    echo "2) 💾 Create Backup"
    echo "3) 🔄 Restore from Latest Backup"
    echo "4) 🌱 Seed Database"
    echo "5) 🗄️  Open Database Shell"
    echo "0) 🔙 Back to Main Menu"
    echo ""
    echo -n "Enter your choice [0-5]: "

    read -r choice

    case $choice in
        1)
            ./database-manager.sh status
            ;;
        2)
            ./database-manager.sh backup
            ;;
        3)
            ./database-manager.sh restore --latest
            ;;
        4)
            ./database-manager.sh seed
            ;;
        5)
            ./database-manager.sh shell
            ;;
        0)
            return
            ;;
        *)
            log "ERROR" "Invalid choice"
            ;;
    esac

    echo ""
    echo -n "Press Enter to continue..."
    read -r
}

# Show service status
show_service_status() {
    log "STEP" "Checking service status..."

    echo ""
    echo -e "${BLUE}Container Status:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo -e "${BLUE}Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -10

    echo ""
    echo -e "${BLUE}Health Checks:${NC}"
    if curl -f http://localhost:3000/health &>/dev/null; then
        echo -e "${GREEN}✅ Backend API: Healthy${NC}"
    else
        echo -e "${RED}❌ Backend API: Unhealthy${NC}"
    fi

    if curl -f http://localhost:3001 &>/dev/null; then
        echo -e "${GREEN}✅ Frontend: Healthy${NC}"
    else
        echo -e "${RED}❌ Frontend: Unhealthy${NC}"
    fi
}

# Stop services
stop_services() {
    log "STEP" "Stopping all services..."

    if ./deploy.sh dev down; then
        log "SUCCESS" "All services stopped"
    else
        log "ERROR" "Failed to stop services"
        exit 1
    fi
}

# Clean up
cleanup() {
    log "STEP" "Cleaning up Docker resources..."

    echo -e "${YELLOW}⚠️  This will remove all containers, volumes, and images${NC}"
    echo -n "Are you sure? (type 'yes' to confirm): "
    read -r confirmation

    if [ "$confirmation" = "yes" ]; then
        ./deploy.sh dev clean
        log "SUCCESS" "Cleanup completed"
    else
        log "INFO" "Cleanup cancelled"
    fi
}

# Show access information
show_access_info() {
    echo ""
    echo -e "${GREEN}🎉 Development environment is ready!${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  🌐 Frontend:        ${CYAN}http://localhost:3001${NC}"
    echo -e "  🔧 Backend API:     ${CYAN}http://localhost:3000${NC}"
    echo -e "  ❤️  Health Check:   ${CYAN}http://localhost:3000/health${NC}"
    echo ""
    echo -e "${BLUE}Quick Commands:${NC}"
    echo -e "  📋 View logs:       ${CYAN}./deploy.sh dev logs${NC}"
    echo -e "  🛑 Stop services:    ${CYAN}./deploy.sh dev down${NC}"
    echo -e "  🗄️  Database ops:    ${CYAN}./database-manager.sh dev${NC}"
    echo ""
    echo -e "${YELLOW}💡 Tip: Use Ctrl+C to stop following logs${NC}"
}

# Show access information with admin tools
show_access_info_admin() {
    echo ""
    echo -e "${GREEN}🎉 Development environment with admin tools is ready!${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  🌐 Frontend:        ${CYAN}http://localhost:3001${NC}"
    echo -e "  🔧 Backend API:     ${CYAN}http://localhost:3000${NC}"
    echo -e "  🗄️  Database Admin:  ${CYAN}http://localhost:8080${NC}"
    echo -e "  ❤️  Health Check:   ${CYAN}http://localhost:3000/health${NC}"
    echo ""
    echo -e "${BLUE}Quick Commands:${NC}"
    echo -e "  📋 View logs:       ${CYAN}./deploy.sh dev logs${NC}"
    echo -e "  🛑 Stop services:    ${CYAN}./deploy.sh dev down${NC}"
    echo -e "  🗄️  Database ops:    ${CYAN}./database-manager.sh dev${NC}"
    echo ""
    echo -e "${YELLOW}💡 Tip: Database Admin lets you browse and edit the SQLite database${NC}"
}

# Show production information
show_production_info() {
    echo ""
    echo -e "${GREEN}🎉 Production environment is running!${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  🌐 Frontend:        ${CYAN}http://localhost:3001${NC}"
    echo -e "  🔧 Backend API:     ${CYAN}http://localhost:3000${NC}"
    echo -e "  ❤️  Health Check:   ${CYAN}http://localhost:3000/health${NC}"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo -e "  📊 Health check:    ${CYAN}./maintenance.sh prod health${NC}"
    echo -e "  💾 Create backup:    ${CYAN}./deploy.sh prod backup${NC}"
    echo -e "  🛑 Stop services:    ${CYAN}./deploy.sh prod down${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Remember to configure your production settings in .env.prod${NC}"
}

# Main function
main() {
    display_banner
    check_prerequisites
    setup_configuration

    while true; do
        show_menu
        read -r choice
        echo ""

        case $choice in
            1)
                quick_dev_start
                ;;
            2)
                dev_with_admin
                ;;
            3)
                production_setup
                ;;
            4)
                database_operations
                ;;
            5)
                show_service_status
                ;;
            6)
                stop_services
                ;;
            7)
                cleanup
                ;;
            0)
                log "INFO" "Goodbye!"
                exit 0
                ;;
            *)
                log "ERROR" "Invalid choice. Please enter 0-7."
                ;;
        esac

        echo ""
        echo -n "Press Enter to continue..."
        read -r
    done
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi