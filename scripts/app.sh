#!/bin/bash

# ThreatDiviner App Management Script
# Usage: ./scripts/app.sh [start|stop|restart|status|logs]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

API_PORT=3001
DASHBOARD_PORT=3000
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

stop_app() {
  echo "Stopping ThreatDiviner..."

  # Kill by PID files first
  if [ -f "$PID_DIR/api.pid" ]; then
    kill $(cat "$PID_DIR/api.pid") 2>/dev/null || true
    rm -f "$PID_DIR/api.pid"
  fi

  if [ -f "$PID_DIR/dashboard.pid" ]; then
    kill $(cat "$PID_DIR/dashboard.pid") 2>/dev/null || true
    rm -f "$PID_DIR/dashboard.pid"
  fi

  # Kill any remaining processes on ports
  lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
  lsof -ti:$DASHBOARD_PORT | xargs kill -9 2>/dev/null || true

  # Kill by pattern (fallback)
  pkill -f "node.*apps/api" 2>/dev/null || true
  pkill -f "node.*apps/dashboard" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "nest start" 2>/dev/null || true

  sleep 2
  echo "Stopped"
}

start_app() {
  echo "Starting ThreatDiviner..."

  # Ensure stopped first
  stop_app 2>/dev/null || true

  # Start API
  echo "Starting API on port $API_PORT..."
  cd "$PROJECT_ROOT/apps/api"
  nohup pnpm run start:dev > "$LOG_DIR/api.log" 2>&1 &
  echo $! > "$PID_DIR/api.pid"

  # Start Dashboard
  echo "Starting Dashboard on port $DASHBOARD_PORT..."
  cd "$PROJECT_ROOT/apps/dashboard"
  nohup pnpm run dev > "$LOG_DIR/dashboard.log" 2>&1 &
  echo $! > "$PID_DIR/dashboard.pid"

  cd "$PROJECT_ROOT"

  # Wait for services
  echo "Waiting for services..."
  for i in {1..30}; do
    if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
      echo "API ready"
      break
    fi
    sleep 1
  done

  for i in {1..30}; do
    if curl -s http://localhost:$DASHBOARD_PORT > /dev/null 2>&1; then
      echo "Dashboard ready"
      break
    fi
    sleep 1
  done

  echo ""
  echo "ThreatDiviner running:"
  echo "  API:       http://localhost:$API_PORT"
  echo "  Dashboard: http://localhost:$DASHBOARD_PORT"
  echo "  Logs:      $LOG_DIR/"
}

restart_app() {
  stop_app
  sleep 2
  start_app
}

status_app() {
  echo "ThreatDiviner Status:"
  echo ""

  if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    echo "  API:       Running (port $API_PORT)"
  else
    echo "  API:       Not running"
  fi

  if curl -s http://localhost:$DASHBOARD_PORT > /dev/null 2>&1; then
    echo "  Dashboard: Running (port $DASHBOARD_PORT)"
  else
    echo "  Dashboard: Not running"
  fi

  echo ""
  echo "Processes:"
  ps aux | grep -E "(nest|next)" | grep -v grep || echo "  None found"
}

logs_app() {
  echo "=== API Logs (last 50 lines) ==="
  tail -50 "$LOG_DIR/api.log" 2>/dev/null || echo "No API logs"
  echo ""
  echo "=== Dashboard Logs (last 50 lines) ==="
  tail -50 "$LOG_DIR/dashboard.log" 2>/dev/null || echo "No Dashboard logs"
}

case "${1:-start}" in
  start)   start_app ;;
  stop)    stop_app ;;
  restart) restart_app ;;
  status)  status_app ;;
  logs)    logs_app ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
