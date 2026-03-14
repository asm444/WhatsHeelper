.PHONY: up down build logs restart dev install test-unit test-integration test-e2e test health clean

# === Docker ===
up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

# === Desenvolvimento Local ===
dev:
	@echo "Iniciando servicos em modo desenvolvimento..."
	cd services/business-engine && npm run dev &
	cd services/chat-simulator && npm run dev &
	cd services/dashboard-api && npm run dev &
	cd services/agent-dashboard && npm run dev &

install:
	npm install

# === Testes ===
test-unit:
	npm run test:unit --workspaces --if-present

test-integration:
	docker compose -f docker-compose.test.yml up -d --wait
	npm run test:integration --workspaces --if-present
	docker compose -f docker-compose.test.yml down

test-e2e:
	cd e2e && npm test

test: test-unit

# === Health Check ===
health:
	@echo "=== Amaral Support - Health Check ==="
	@curl -sf http://localhost:3001/health > /dev/null && echo " [OK] Chat Simulator (3001)" || echo " [FAIL] Chat Simulator (3001)"
	@curl -sf http://localhost:3002/health > /dev/null && echo " [OK] Business Engine (3002)" || echo " [FAIL] Business Engine (3002)"
	@curl -sf http://localhost:3003/health > /dev/null && echo " [OK] Dashboard API (3003)" || echo " [FAIL] Dashboard API (3003)"
	@curl -sf http://localhost:3004/ > /dev/null 2>&1 && echo " [OK] Agent Dashboard (3004)" || echo " [FAIL] Agent Dashboard (3004)"
	@curl -sf http://localhost:5678/healthz > /dev/null && echo " [OK] n8n (5678)" || echo " [FAIL] n8n (5678)"
	@curl -sf http://localhost:3000/api/health > /dev/null && echo " [OK] WAHA (3000)" || echo " [FAIL] WAHA (3000)"

# === Limpeza ===
clean:
	docker compose down -v
	rm -rf node_modules services/*/node_modules services/*/dist
