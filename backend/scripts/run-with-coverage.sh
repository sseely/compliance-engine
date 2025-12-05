#!/bin/bash
#
# Start the backend API with coverage instrumentation
# Used during E2E testing to collect code coverage
#
# Usage: ./scripts/run-with-coverage.sh [start|stop|report]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$BACKEND_ROOT/.coverage-server.pid"
COVERAGE_DATA="$BACKEND_ROOT/.coverage"

cd "$BACKEND_ROOT"

# Activate virtual environment
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    echo "Error: Virtual environment not found at $BACKEND_ROOT/.venv"
    echo "Create it with: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

start_server() {
    echo "Starting backend with coverage instrumentation..."

    # Clean previous coverage data
    rm -f "$COVERAGE_DATA" "$COVERAGE_DATA".*

    # Start uvicorn with coverage wrapper
    # The coverage_server.py script handles signal-safe coverage saving
    python scripts/coverage_server.py &

    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"

    echo "Backend started with PID $SERVER_PID"
    echo "Coverage data will be written to $COVERAGE_DATA"

    # Wait for server to be ready
    echo "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo "Server is ready!"
            return 0
        fi
        sleep 1
    done

    echo "Warning: Server did not respond within 30 seconds"
    return 1
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        echo "Stopping backend (PID $PID)..."

        # Send SIGTERM for graceful shutdown
        kill -TERM "$PID" 2>/dev/null || true

        # Wait for process to stop
        for i in {1..10}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                echo "Server stopped"
                rm -f "$PID_FILE"
                return 0
            fi
            sleep 1
        done

        # Force kill if still running
        kill -9 "$PID" 2>/dev/null || true
        rm -f "$PID_FILE"
        echo "Server force stopped"
    else
        echo "No PID file found, server may not be running"
        # Try to kill any uvicorn processes on port 8000
        pkill -f "uvicorn src.main:app" 2>/dev/null || true
    fi
}

generate_report() {
    echo "Combining coverage data..."

    # Combine parallel coverage files
    coverage combine 2>/dev/null || true

    if [ -f "$COVERAGE_DATA" ]; then
        echo ""
        echo "Coverage Report:"
        echo "================"
        coverage report --show-missing

        echo ""
        echo "Generating HTML report..."
        coverage html -d coverage_html
        echo "HTML report: $BACKEND_ROOT/coverage_html/index.html"

        echo ""
        echo "Generating JSON report..."
        coverage json -o coverage.json
        echo "JSON report: $BACKEND_ROOT/coverage.json"
    else
        echo "No coverage data found"
        return 1
    fi
}

case "${1:-start}" in
    start)
        stop_server 2>/dev/null || true
        start_server
        ;;
    stop)
        stop_server
        ;;
    report)
        generate_report
        ;;
    restart)
        stop_server
        start_server
        ;;
    *)
        echo "Usage: $0 {start|stop|report|restart}"
        exit 1
        ;;
esac
