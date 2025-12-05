#!/bin/bash
#
# Unified test runner for the compliance-engine project
# Run from the project root: ./scripts/run-tests.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default settings
RUN_FRONTEND=true
RUN_BACKEND=true
RUN_E2E=false
COVERAGE=false
WATCH=false
VERBOSE=false

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --frontend      Run frontend tests only"
    echo "  -b, --backend       Run backend tests only"
    echo "  -e, --e2e           Include E2E tests (Playwright)"
    echo "  -c, --coverage      Generate coverage reports"
    echo "  -w, --watch         Run in watch mode (frontend only)"
    echo "  -a, --all           Run all tests including E2E"
    echo "  -v, --verbose       Verbose output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  Run frontend and backend unit tests"
    echo "  $0 -c               Run all tests with coverage"
    echo "  $0 -f -w            Run frontend tests in watch mode"
    echo "  $0 -a -c            Run everything with coverage"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--frontend)
            RUN_FRONTEND=true
            RUN_BACKEND=false
            shift
            ;;
        -b|--backend)
            RUN_FRONTEND=false
            RUN_BACKEND=true
            shift
            ;;
        -e|--e2e)
            RUN_E2E=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -a|--all)
            RUN_FRONTEND=true
            RUN_BACKEND=true
            RUN_E2E=true
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
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Compliance Engine Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FAILED=0

# Backend Tests
if [ "$RUN_BACKEND" = true ]; then
    echo -e "${YELLOW}▶ Running Backend Tests (Python)${NC}"
    echo "----------------------------------------"

    cd "$PROJECT_ROOT/backend"

    if [ ! -d ".venv" ]; then
        echo -e "${RED}Error: Backend virtual environment not found${NC}"
        echo "Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
        FAILED=1
    else
        source .venv/bin/activate

        PYTEST_ARGS=""
        if [ "$COVERAGE" = true ]; then
            PYTEST_ARGS="--cov=src --cov-report=html --cov-report=term-missing"
        fi
        if [ "$VERBOSE" = true ]; then
            PYTEST_ARGS="$PYTEST_ARGS -v"
        fi

        if pytest $PYTEST_ARGS; then
            echo -e "${GREEN}✓ Backend tests passed${NC}"
            if [ "$COVERAGE" = true ]; then
                echo -e "  Coverage report: ${BLUE}backend/htmlcov/index.html${NC}"
            fi
        else
            echo -e "${RED}✗ Backend tests failed${NC}"
            FAILED=1
        fi

        deactivate
    fi
    echo ""
fi

# Frontend Tests
if [ "$RUN_FRONTEND" = true ]; then
    echo -e "${YELLOW}▶ Running Frontend Tests (Jest)${NC}"
    echo "----------------------------------------"

    cd "$PROJECT_ROOT/frontend"

    if [ ! -d "node_modules" ]; then
        echo -e "${RED}Error: Frontend node_modules not found${NC}"
        echo "Run: cd frontend && npm install"
        FAILED=1
    else
        JEST_ARGS=""
        if [ "$COVERAGE" = true ]; then
            JEST_ARGS="--coverage"
        fi
        if [ "$WATCH" = true ]; then
            JEST_ARGS="$JEST_ARGS --watch"
        fi
        if [ "$VERBOSE" = true ]; then
            JEST_ARGS="$JEST_ARGS --verbose"
        fi

        if npm test -- $JEST_ARGS; then
            echo -e "${GREEN}✓ Frontend tests passed${NC}"
            if [ "$COVERAGE" = true ]; then
                echo -e "  Coverage report: ${BLUE}frontend/coverage/lcov-report/index.html${NC}"
            fi
        else
            echo -e "${RED}✗ Frontend tests failed${NC}"
            FAILED=1
        fi
    fi
    echo ""
fi

# E2E Tests
if [ "$RUN_E2E" = true ]; then
    echo -e "${YELLOW}▶ Running E2E Tests (Playwright)${NC}"
    echo "----------------------------------------"

    BACKEND_COVERAGE_ENABLED=false

    # Start backend with coverage if coverage mode is enabled
    if [ "$COVERAGE" = true ]; then
        echo "Starting backend with coverage instrumentation..."
        cd "$PROJECT_ROOT/backend"
        if [ -f "scripts/run-with-coverage.sh" ] && [ -d ".venv" ]; then
            ./scripts/run-with-coverage.sh start
            BACKEND_COVERAGE_ENABLED=true
            echo -e "${BLUE}Backend running with coverage on port 8000${NC}"
        else
            echo -e "${YELLOW}Warning: Backend coverage script or venv not found, skipping backend coverage${NC}"
        fi
    fi

    cd "$PROJECT_ROOT/frontend"

    E2E_RESULT=0
    if npm run test:e2e; then
        echo -e "${GREEN}✓ E2E tests passed${NC}"
    else
        echo -e "${RED}✗ E2E tests failed${NC}"
        E2E_RESULT=1
        FAILED=1
    fi

    # Stop backend and generate coverage report
    if [ "$BACKEND_COVERAGE_ENABLED" = true ]; then
        echo ""
        echo "Stopping backend and generating coverage report..."
        cd "$PROJECT_ROOT/backend"
        ./scripts/run-with-coverage.sh stop
        ./scripts/run-with-coverage.sh report
        echo -e "  Backend coverage report: ${BLUE}backend/coverage_html/index.html${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  All tests passed!${NC}"
else
    echo -e "${RED}  Some tests failed${NC}"
fi
echo -e "${BLUE}========================================${NC}"

exit $FAILED
