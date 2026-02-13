.PHONY: up down build logs test-unit test-integration test-e2e health clean dev

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
	@echo "Iniciando serviços em modo desenvolvimento..."
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
	npm run test:integration --workspaces --if-present

test-e2e:
	cd e2e && npm test

test: test-unit

# === Health Check ===
health:
	@echo "=== Verificando serviços ==="
	@curl -sf http://localhost:3001/health && echo " ✓ Chat Simulator (3001)" || echo " ✗ Chat Simulator (3001)"
	@curl -sf http://localhost:3002/health && echo " ✓ Business Engine (3002)" || echo " ✗ Business Engine (3002)"
	@curl -sf http://localhost:3003/health && echo " ✓ Dashboard API (3003)" || echo " ✗ Dashboard API (3003)"
	@curl -sf http://localhost:3004/ > /dev/null 2>&1 && echo " ✓ Agent Dashboard (3004)" || echo " ✗ Agent Dashboard (3004)"
	@curl -sf http://localhost:5678/healthz && echo " ✓ n8n (5678)" || echo " ✗ n8n (5678)"
	@curl -sf http://localhost:3000/api/health && echo " ✓ WAHA (3000)" || echo " ✗ WAHA (3000)"

# === Limpeza ===
clean:
	docker compose down -v
	rm -rf node_modules services/*/node_modules services/*/dist
