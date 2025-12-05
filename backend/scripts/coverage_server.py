#!/usr/bin/env python3
"""
Coverage-instrumented server wrapper for e2e testing.
Ensures coverage data is saved on graceful shutdown.
"""

import atexit
import os
import signal
import sys
from pathlib import Path

# Ensure we're running from the backend directory
BACKEND_ROOT = Path(__file__).parent.parent
os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))

import coverage

# Start coverage before importing any application code
cov = coverage.Coverage(source=['src'], branch=True)
cov.start()

def save_coverage():
    """Save coverage data on exit."""
    print("Saving coverage data...", file=sys.stderr)
    cov.stop()
    cov.save()
    print("Coverage data saved.", file=sys.stderr)

# Register cleanup handlers
atexit.register(save_coverage)

def signal_handler(signum, frame):
    """Handle termination signals gracefully."""
    print(f"Received signal {signum}, shutting down...", file=sys.stderr)
    save_coverage()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Now import and run uvicorn
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
