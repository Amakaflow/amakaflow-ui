#!/bin/bash
# Health check script - waits for services to be ready
# Polls localhost:3000 and localhost:8004/health

set -e

FRONTEND_URL="${1:-http://localhost:3000}"
BACKEND_URL="${2:-http://localhost:8004/health}"
MAX_WAIT="${3:-120}"
INTERVAL="${4:-2}"

echo "Waiting for services..."
echo "  Frontend: $FRONTEND_URL"
echo "  Backend: $BACKEND_URL"
echo "  Max wait: ${MAX_WAIT}s"

start_time=$(date +%s)
frontend_ready=false
backend_ready=false

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -ge $MAX_WAIT ]; then
        echo "ERROR: Timeout waiting for services after ${MAX_WAIT}s"
        exit 1
    fi
    
    # Check frontend (allow any response, just need it to be up)
    if [ "$frontend_ready" = false ]; then
        if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null | grep -q "200\|301\|302"; then
            echo "  Frontend ($FRONTEND_URL) is ready!"
            frontend_ready=true
        fi
    fi
    
    # Check backend health endpoint
    if [ "$backend_ready" = false ]; then
        if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL" 2>/dev/null | grep -q "200"; then
            echo "  Backend ($BACKEND_URL) is ready!"
            backend_ready=true
        fi
    fi
    
    # Both ready?
    if [ "$frontend_ready" = true ] && [ "$backend_ready" = true ]; then
        echo "All services ready!"
        exit 0
    fi
    
    echo "  Waiting... (${elapsed}s elapsed)"
    sleep $INTERVAL
done
