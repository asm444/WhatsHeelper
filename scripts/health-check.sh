#!/bin/bash
# Health check de todos os serviços - Amaral Support

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

check_service() {
  local name=$1
  local url=$2
  local response

  response=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$response" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} $name"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $name (HTTP $response)"
    ((FAIL++))
  fi
}

echo "=== Verificação de Saúde - Amaral Support ==="
echo ""

echo "[Serviços Customizados]"
check_service "Chat Simulator (3001)" "http://localhost:3001/health"
check_service "Business Engine (3002)" "http://localhost:3002/health"
check_service "Dashboard API (3003)" "http://localhost:3003/health"
check_service "Agent Dashboard (3004)" "http://localhost:3004/"

echo ""
echo "[Infraestrutura]"
check_service "n8n (5678)" "http://localhost:5678/healthz"
check_service "WAHA (3000)" "http://localhost:3000/api/health"

echo ""
echo "Resultado: ${PASS} OK, ${FAIL} falhas"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
