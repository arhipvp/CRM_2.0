#!/bin/bash
# CRM Frontend Deployment Script
# Deploy frontend to Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CRM Frontend Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed"
  exit 1
fi
print_status "Docker is installed"

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
  print_error "docker-compose is not installed"
  exit 1
fi
print_status "docker-compose is installed"

# Navigate to project root
cd "$PROJECT_ROOT"
print_status "Working directory: $PROJECT_ROOT"

# Load environment variables
if [ -f .env ]; then
  print_status "Loading environment from .env"
  # Source selectively to avoid issues
  set -a
  source .env 2>/dev/null || true
  set +a
else
  print_warning ".env file not found, using defaults"
fi

# Default values
API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://gateway:8080/api/v1}"
AUTH_DISABLED="${NEXT_PUBLIC_AUTH_DISABLED:-true}"
IMAGE_NAME="${FRONTEND_IMAGE_NAME:-crm-frontend:latest}"
FRONTEND_PORT="${FRONTEND_SERVICE_PORT:-3000}"

print_info "Configuration:"
print_info "  API Base URL: $API_BASE_URL"
print_info "  Auth Disabled: $AUTH_DISABLED"
print_info "  Image Name: $IMAGE_NAME"
print_info "  Frontend Port: $FRONTEND_PORT"
echo ""

# Step 1: Check if frontend directory exists
if [ ! -d "frontend" ]; then
  print_error "Frontend directory not found at $PROJECT_ROOT/frontend"
  exit 1
fi
print_status "Frontend directory found"

# Step 2: Build Docker image
echo ""
print_info "Building Docker image..."
if docker build \
  -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
  --build-arg NEXT_PUBLIC_AUTH_DISABLED="$AUTH_DISABLED" \
  --build-arg NEXT_PUBLIC_CRM_SSE_URL="${NEXT_PUBLIC_CRM_SSE_URL:-$API_BASE_URL/streams/deals}" \
  --build-arg NEXT_PUBLIC_NOTIFICATIONS_SSE_URL="${NEXT_PUBLIC_NOTIFICATIONS_SSE_URL:-$API_BASE_URL/streams/notifications}" \
  -t "$IMAGE_NAME" \
  frontend; then
  print_status "Docker image built successfully: $IMAGE_NAME"
else
  print_error "Failed to build Docker image"
  exit 1
fi

# Step 3: Check image size
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
print_status "Image size: $IMAGE_SIZE"

# Step 4: Start services with docker-compose
echo ""
print_info "Starting services with docker-compose..."

COMPOSE_FILE="infra/docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  print_error "docker-compose.yml not found at $COMPOSE_FILE"
  exit 1
fi

# Check if profile parameter was provided
PROFILE="${1:---profile app}"

if docker-compose -f "$COMPOSE_FILE" $PROFILE up -d; then
  print_status "Services started successfully"
else
  print_error "Failed to start services"
  exit 1
fi

# Step 5: Wait for frontend to be healthy
echo ""
print_info "Waiting for frontend to be healthy..."

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  HEALTH=$(docker inspect crm-frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

  if [ "$HEALTH" = "healthy" ]; then
    print_status "Frontend is healthy!"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -ne "\rWaiting... ($RETRY_COUNT/$MAX_RETRIES) - Status: $HEALTH"
  sleep 1
done

if [ "$HEALTH" != "healthy" ]; then
  print_warning "Frontend health check timeout, but container may still be running"
  print_info "Check logs with: docker logs crm-frontend -f"
fi

# Step 6: Display service status
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Service Status${NC}"
echo -e "${BLUE}========================================${NC}"

docker-compose -f "$COMPOSE_FILE" ps frontend

# Step 7: Display access information
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
print_info "Frontend is available at:"
echo "  🌐 http://localhost:$FRONTEND_PORT"
echo ""
print_info "API Gateway is available at:"
echo "  🔌 http://localhost:8080/api/v1"
echo ""
print_info "Useful commands:"
echo "  View logs:     docker logs crm-frontend -f"
echo "  Check health:  docker inspect crm-frontend --format='{{.State.Health.Status}}'"
echo "  Stop frontend: docker-compose -f infra/docker-compose.yml stop frontend"
echo "  Restart:       docker-compose -f infra/docker-compose.yml restart frontend"
echo ""
print_info "For more information, see:"
echo "  📖 FRONTEND_QUICK_START.md"
echo "  📖 FRONTEND_DEPLOYMENT_GUIDE.md"
echo ""
