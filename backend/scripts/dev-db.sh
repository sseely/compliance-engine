#!/bin/bash
# Development Database Management Script
# Manages PostgreSQL container for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="compliance_engine"
DB_USER="postgres"
DB_PASSWORD="postgres"

print_usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|shell|reset|migrate|seed}"
    echo ""
    echo "Commands:"
    echo "  start     - Start PostgreSQL container"
    echo "  stop      - Stop containers"
    echo "  restart   - Restart containers"
    echo "  status    - Show container status"
    echo "  logs      - Show PostgreSQL logs"
    echo "  shell     - Connect to PostgreSQL shell"
    echo "  reset     - Reset database (destroys all data!)"
    echo "  migrate   - Run Alembic migrations"
    echo "  seed      - Load seed data"
    echo "  full      - Start full stack (backend + database)"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon is not running${NC}"
        exit 1
    fi
}

wait_for_db() {
    echo -e "${BLUE}Waiting for database to be ready...${NC}"
    local max_attempts=60  # Increased from 30 to 60 (2 minutes)
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec compliance-engine-postgres pg_isready -U $DB_USER -d $DB_NAME &> /dev/null; then
            echo -e "${GREEN}Database is ready!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}Database failed to start within timeout${NC}"
    return 1
}

start_services() {
    echo -e "${BLUE}Starting database service...${NC}"
    cd "$PROJECT_DIR"
    docker compose up -d postgres
    wait_for_db
    echo -e "${GREEN}Database service started successfully${NC}"
}

stop_services() {
    echo -e "${BLUE}Stopping database service...${NC}"
    cd "$PROJECT_DIR"
    docker compose down
    echo -e "${GREEN}Database service stopped${NC}"
}

restart_services() {
    echo -e "${BLUE}Restarting database service...${NC}"
    stop_services
    start_services
}

show_status() {
    echo -e "${BLUE}Container Status:${NC}"
    docker compose ps
    echo ""
    echo -e "${BLUE}Database Connection Test:${NC}"
    if docker exec compliance-engine-postgres pg_isready -U $DB_USER -d $DB_NAME &> /dev/null; then
        echo -e "${GREEN}✓ Database is accessible${NC}"
    else
        echo -e "${RED}✗ Database is not accessible${NC}"
    fi
}

show_logs() {
    echo -e "${BLUE}PostgreSQL Logs:${NC}"
    docker compose logs -f postgres
}

open_shell() {
    echo -e "${BLUE}Opening PostgreSQL shell...${NC}"
    docker exec -it compliance-engine-postgres psql -U $DB_USER -d $DB_NAME
}

reset_database() {
    read -p "This will destroy ALL data in the database. Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Resetting database...${NC}"
        cd "$PROJECT_DIR"
        docker-compose down -v  # Remove volumes
        docker volume rm compliance-engine-postgres-data 2>/dev/null || true
        start_services
        echo -e "${GREEN}Database reset complete${NC}"
    else
        echo -e "${BLUE}Database reset cancelled${NC}"
    fi
}

run_migrations() {
    echo -e "${BLUE}Running Alembic migrations...${NC}"
    cd "$PROJECT_DIR"
    
    # Ensure virtual environment is activated
    if [[ "$VIRTUAL_ENV" == "" ]]; then
        source .venv/bin/activate
    fi
    
    # Set database URL for migrations
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    alembic upgrade head
    echo -e "${GREEN}Migrations completed${NC}"
}

load_seed_data() {
    echo -e "${BLUE}Loading seed data...${NC}"
    cd "$PROJECT_DIR"
    
    if [[ -f "src/database/seed_data.sql" ]]; then
        docker exec -i compliance-engine-postgres psql -U $DB_USER -d $DB_NAME < src/database/seed_data.sql
        echo -e "${GREEN}Seed data loaded${NC}"
    else
        echo -e "${YELLOW}No seed data file found at src/database/seed_data.sql${NC}"
    fi
}

start_full_stack() {
    echo -e "${BLUE}Starting full stack (database + backend)...${NC}"
    cd "$PROJECT_DIR"
    docker-compose --profile full-stack up -d
    wait_for_db
    echo -e "${GREEN}Full stack started successfully${NC}"
    echo -e "${BLUE}Backend available at: http://localhost:8000${NC}"
}

# Main script logic
case "${1:-}" in
    start)
        check_docker
        start_services
        ;;
    stop)
        check_docker
        stop_services
        ;;
    restart)
        check_docker
        restart_services
        ;;
    status)
        check_docker
        show_status
        ;;
    logs)
        check_docker
        show_logs
        ;;
    shell)
        check_docker
        open_shell
        ;;
    reset)
        check_docker
        reset_database
        ;;
    migrate)
        check_docker
        run_migrations
        ;;
    seed)
        check_docker
        load_seed_data
        ;;
    full)
        check_docker
        start_full_stack
        ;;
    *)
        print_usage
        exit 1
        ;;
esac