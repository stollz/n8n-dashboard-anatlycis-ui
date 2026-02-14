#!/usr/bin/env bash
set -euo pipefail

PIDFILE="/tmp/n8n-dashboard.pid"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  echo "Usage: $0 {start|stop|restart|status} [dev|prod]"
  echo ""
  echo "  start   [dev|prod]  Start the server (default: prod)"
  echo "  stop                Stop the running server"
  echo "  restart [dev|prod]  Stop then start"
  echo "  status              Show if the server is running"
  exit 1
}

is_running() {
  [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

do_stop() {
  if is_running; then
    local pid
    pid=$(cat "$PIDFILE")
    echo "Stopping server (PID $pid)..."
    kill "$pid" 2>/dev/null
    # Wait up to 5s for graceful shutdown
    for _ in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    # Force kill if still alive
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    rm -f "$PIDFILE"
    echo "Stopped."
  else
    echo "Server is not running."
    rm -f "$PIDFILE"
  fi
}

do_start() {
  local mode="${1:-prod}"

  if is_running; then
    echo "Server is already running (PID $(cat "$PIDFILE")). Stop it first."
    exit 1
  fi

  cd "$APP_DIR"

  if [[ "$mode" == "dev" ]]; then
    echo "Starting dev server..."
    nohup npm run dev > /tmp/n8n-dashboard.log 2>&1 &
  else
    echo "Building..."
    npm run build
    echo "Starting production server..."
    nohup npm run start > /tmp/n8n-dashboard.log 2>&1 &
  fi

  echo $! > "$PIDFILE"
  sleep 3

  if is_running; then
    echo "Server started (PID $(cat "$PIDFILE"), mode: $mode)"
    echo "Logs: tail -f /tmp/n8n-dashboard.log"
  else
    echo "Server failed to start. Check /tmp/n8n-dashboard.log"
    rm -f "$PIDFILE"
    exit 1
  fi
}

do_status() {
  if is_running; then
    echo "Server is running (PID $(cat "$PIDFILE"))"
  else
    echo "Server is not running."
  fi
}

[[ $# -lt 1 ]] && usage

case "$1" in
  start)   do_start "${2:-prod}" ;;
  stop)    do_stop ;;
  restart) do_stop; do_start "${2:-prod}" ;;
  status)  do_status ;;
  *)       usage ;;
esac
