#!/bin/bash
set -e

APP_NAME="AI Contract Lifecycle Manager"
DB_NAME="ai_contract_manager"
BACKEND_PORT=3001
FRONTEND_PORT=3000

echo "========================================="
echo "  $APP_NAME"
echo "========================================="

# Kill processes on used ports
echo "Cleaning ports $BACKEND_PORT and $FRONTEND_PORT..."
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
sleep 1

cd "$(dirname "$0")"
ROOT_DIR=$(pwd)

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
