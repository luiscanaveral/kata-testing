.PHONY: up down build test test-e2e test-integration test-concurrency backend frontend setup help

BACKEND_PORT = $(shell grep ^BACKEND_PORT .env | cut -d= -f2)
FRONTEND_PORT = $(shell grep ^FRONTEND_PORT .env | cut -d= -f2)
up:
	docker compose up --build

down:
	docker compose down -v

build:
	docker compose build

test:
	cd testing && npm install && npx playwright install chromium && API_URL=http://localhost:$(BACKEND_PORT) FRONTEND_URL=http://localhost:$(FRONTEND_PORT) MYSQL_HOST=127.0.0.1 npx playwright test

test-e2e:
	cd testing && API_URL=http://localhost:$(BACKEND_PORT) FRONTEND_URL=http://localhost:$(FRONTEND_PORT) MYSQL_HOST=127.0.0.1 npx playwright test --grep @e2e

test-integration:
	cd testing && API_URL=http://localhost:$(BACKEND_PORT) FRONTEND_URL=http://localhost:$(FRONTEND_PORT) MYSQL_HOST=127.0.0.1 npx playwright test --grep @integration

test-concurrency:
	cd testing && API_URL=http://localhost:$(BACKEND_PORT) FRONTEND_URL=http://localhost:$(FRONTEND_PORT) MYSQL_HOST=127.0.0.1 npx playwright test --grep @concurrency

backend:
	cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

frontend:
	cd frontend && npm install && npm run dev

help:
	@echo "Targets:"
	@echo "  up               - Build and start all services (docker compose)"
	@echo "  down             - Stop and remove all containers"
	@echo "  build            - Build all Docker images"
	@echo "  test             - Run all Playwright tests in Docker"
	@echo "  test-e2e         - Run E2E tests locally"
	@echo "  test-integration - Run integration tests locally"
	@echo "  test-concurrency - Run concurrency/race tests locally"
	@echo "  backend          - Run backend locally (uvicorn)"
	@echo "  frontend         - Run frontend locally (next dev)"
