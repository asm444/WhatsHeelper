#!/bin/bash
# Setup inicial do projeto - Amaral Support

set -e

echo "=== Setup - Amaral Support ==="

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "ERRO: Node.js não encontrado. Instale Node.js 20+."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "ERRO: Node.js 20+ necessário. Versão atual: $(node -v)"
  exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
  echo "AVISO: Docker não encontrado. Serviços de infraestrutura não funcionarão."
fi

# Copiar .env se não existir
if [ ! -f .env ]; then
  echo "Criando .env a partir de .env.example..."
  cp .env.example .env
  echo "IMPORTANTE: Edite .env e configure GEMINI_API_KEY"
fi

# Instalar dependências
echo "Instalando dependências..."
npm install

echo ""
echo "=== Setup concluído! ==="
echo ""
echo "Próximos passos:"
echo "  1. Configure GEMINI_API_KEY no arquivo .env"
echo "  2. Execute 'make up' para iniciar todos os serviços"
echo "  3. Execute 'make health' para verificar"
echo "  4. Acesse http://localhost:3001 para o simulador de chat"
echo "  5. Acesse http://localhost:3004 para o dashboard do atendente"
