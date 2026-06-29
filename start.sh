#!/bin/bash
set -e

APP_NAME="AI Contract Lifecycle Manager"
DB_NAME="ai_contract_manager"
BACKEND_PORT=3001
FRONTEND_PORT=3000

echo "========================================="
echo "  $APP_NAME"
echo "========================================="

cd "$(dirname "$0")"
ROOT_DIR=$(pwd)

kill_port() {
  local port=$1
  local pids
  for _ in 1 2 3; do
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [ -z "$pids" ] && return 0
    echo "  Killing process(es) on port $port: $pids"
    for pid in $pids; do
      local ppid
      local gpid
      local pcmd
      local gcmd
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
      pcmd=$(ps -o command= -p "$ppid" 2>/dev/null || true)
      gpid=$(ps -o ppid= -p "$ppid" 2>/dev/null | tr -d ' ' || true)
      gcmd=$(ps -o command= -p "$gpid" 2>/dev/null || true)
      if echo "$pcmd" | grep -Eq 'nodemon server\.js|npm exec nodemon'; then
        kill "$ppid" 2>/dev/null || true
      fi
      if echo "$gcmd" | grep -Eq 'nodemon server\.js|npm exec nodemon'; then
        kill "$gpid" 2>/dev/null || true
      fi
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
  done
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
}

# Kill processes on used ports and app-specific watchers that can respawn children.
echo "Cleaning ports $BACKEND_PORT and $FRONTEND_PORT..."
pkill -f "$ROOT_DIR/backend.*nodemon server.js" 2>/dev/null || true
pkill -f "$ROOT_DIR/backend/server.js" 2>/dev/null || true
pkill -f "$ROOT_DIR/frontend.*react-scripts start" 2>/dev/null || true
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"
sleep 1

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo "Loaded .env"
fi

# Install dependencies
echo "Installing backend dependencies..."
cd "$ROOT_DIR/backend" && npm install

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/frontend" && npm install

# Create database if not exists
echo "Setting up database..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || psql -U postgres -c "CREATE DATABASE $DB_NAME"

# Run seed
echo "Seeding database..."
cd "$ROOT_DIR/backend" && node seeds/seed.js

# Start backend with nodemon
echo "Starting backend on port $BACKEND_PORT..."
cd "$ROOT_DIR/backend" && npx nodemon server.js &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on port $FRONTEND_PORT..."
cd "$ROOT_DIR/frontend" && BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  $APP_NAME is running!"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Login:    admin@contractai.com / admin123"
echo "========================================="

cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
