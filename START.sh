#!/usr/bin/env bash
# =============================================================================
# START.sh - Inicializador do WhatsApp ChatBot Amaral Support
# =============================================================================
# Uso:    ./START.sh [opcoes]
# Opcoes: --build     Reconstroi as imagens antes de subir
#         --logs      Mostra logs apos subir (modo attached)
#         --skip-n8n  Pula importacao/ativacao de workflows n8n
#         --help      Exibe esta ajuda
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Cores e formatacao
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Variaveis de controle
# ---------------------------------------------------------------------------
OPT_BUILD=false
OPT_LOGS=false
OPT_SKIP_N8N=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_CMD=""

# ---------------------------------------------------------------------------
# Funcoes utilitarias
# ---------------------------------------------------------------------------

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}============================================================${RESET}"
    echo -e "${BOLD}${BLUE}   Amaral Support - WhatsApp ChatBot${RESET}"
    echo -e "${BOLD}${BLUE}============================================================${RESET}"
    echo ""
}

print_step() {
    local step_num=$1
    local step_desc=$2
    echo -e "${BOLD}${CYAN}[Passo $step_num]${RESET} $step_desc"
}

print_ok() {
    echo -e "  ${GREEN}[OK]${RESET} $1"
}

print_warn() {
    echo -e "  ${YELLOW}[AVISO]${RESET} $1"
}

print_error() {
    echo -e "  ${RED}[ERRO]${RESET} $1" >&2
}

print_info() {
    echo -e "  ${DIM}$1${RESET}"
}

separator() {
    echo -e "${DIM}------------------------------------------------------------${RESET}"
}

spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local frames=('|' '/' '-' '\')
    local i=0

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  ${YELLOW}${frames[$i]}${RESET}  %s..." "$message"
        i=$(( (i + 1) % 4 ))
        sleep $delay
    done
    printf "\r  ${GREEN}[OK]${RESET} %s   \n" "$message"
}

wait_for_http() {
    local name=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=0
    local delay=2

    while [ $attempt -lt $max_attempts ]; do
        local code
        code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "405" ]; then
            return 0
        fi
        attempt=$((attempt + 1))
        printf "\r  ${YELLOW}[...]${RESET} Aguardando $name (tentativa $attempt/$max_attempts)..."
        sleep $delay
    done
    printf "\r  ${RED}[FALHA]${RESET} $name nao respondeu apos $((max_attempts * delay))s\n"
    return 1
}

# ---------------------------------------------------------------------------
# Processar argumentos
# ---------------------------------------------------------------------------
parse_args() {
    for arg in "$@"; do
        case $arg in
            --build)
                OPT_BUILD=true
                ;;
            --logs)
                OPT_LOGS=true
                ;;
            --skip-n8n)
                OPT_SKIP_N8N=true
                ;;
            --help|-h)
                print_header
                echo "Uso: ./START.sh [opcoes]"
                echo ""
                echo "Opcoes:"
                echo "  --build      Reconstroi as imagens Docker antes de subir"
                echo "  --logs       Permanece mostrando logs apos iniciar"
                echo "  --skip-n8n   Pula importacao/ativacao dos workflows n8n"
                echo "  --help       Exibe esta mensagem"
                echo ""
                exit 0
                ;;
            *)
                print_error "Opcao desconhecida: $arg. Use --help para ajuda."
                exit 1
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Passo 1: Validar pre-requisitos
# ---------------------------------------------------------------------------
check_prerequisites() {
    print_step "1" "Validando pre-requisitos"
    separator
    local failed=false

    # Node.js
    if command -v node &>/dev/null; then
        local node_ver
        node_ver=$(node -v | sed 's/v//')
        local node_major
        node_major=$(echo "$node_ver" | cut -d. -f1)
        if [ "$node_major" -ge 20 ]; then
            print_ok "Node.js v$node_ver"
        else
            print_error "Node.js v$node_ver encontrado, mas v20+ e necessario"
            print_info "Instale em: https://nodejs.org/en/download"
            failed=true
        fi
    else
        print_error "Node.js nao encontrado"
        print_info "Instale em: https://nodejs.org/en/download"
        failed=true
    fi

    # Docker
    if command -v docker &>/dev/null; then
        local docker_ver
        docker_ver=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        print_ok "Docker v$docker_ver"
    else
        print_error "Docker nao encontrado"
        print_info "Instale em: https://docs.docker.com/get-docker"
        failed=true
    fi

    # Docker Compose (plugin v2)
    if docker compose version &>/dev/null 2>&1; then
        local compose_ver
        compose_ver=$(docker compose version --short 2>/dev/null || docker compose version | grep -oP '\d+\.\d+\.\d+')
        print_ok "Docker Compose v$compose_ver"
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null; then
        print_warn "Usando docker-compose v1 (recomendado: plugin v2 via Docker Desktop)"
        COMPOSE_CMD="docker-compose"
    else
        print_error "Docker Compose nao encontrado"
        print_info "Atualize o Docker para a versao mais recente (inclui Compose v2)"
        failed=true
    fi

    # curl (necessario para health checks)
    if command -v curl &>/dev/null; then
        print_ok "curl $(curl --version | head -1 | cut -d' ' -f2)"
    else
        print_warn "curl nao encontrado - health checks serao pulados"
    fi

    # Verificar se Docker daemon esta rodando
    if ! docker info &>/dev/null 2>&1; then
        print_error "Daemon do Docker nao esta rodando"
        print_info "Linux: sudo systemctl start docker"
        print_info "Mac/Windows: abra o Docker Desktop"
        failed=true
    fi

    echo ""
    if [ "$failed" = true ]; then
        print_error "Pre-requisitos nao atendidos. Corrija os erros acima e execute novamente."
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Passo 2: Verificar arquivo .env
# ---------------------------------------------------------------------------
check_env_file() {
    print_step "2" "Verificando configuracao de ambiente"
    separator

    if [ ! -f "$ENV_FILE" ]; then
        print_warn ".env nao encontrado. Criando a partir de .env.example..."
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
            print_ok ".env criado com valores padrao"
        else
            print_error ".env.example tambem nao encontrado. Repositorio corrompido?"
            exit 1
        fi
    else
        print_ok ".env encontrado"
    fi

    # Verificar GEMINI_API_KEY
    local gemini_key
    gemini_key=$(grep -E "^GEMINI_API_KEY=" "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
    if [ -z "$gemini_key" ] || [ "$gemini_key" = "your-gemini-api-key-here" ]; then
        echo ""
        print_warn "GEMINI_API_KEY nao configurada!"
        echo ""
        echo -e "  ${YELLOW}O bot funcionara apenas com classificacao por palavras-chave (sem IA).${RESET}"
        echo -e "  ${YELLOW}Para habilitar o Gemini:${RESET}"
        echo -e "  ${DIM}  1. Acesse: https://aistudio.google.com/apikey${RESET}"
        echo -e "  ${DIM}  2. Crie uma API Key (gratuito)${RESET}"
        echo -e "  ${DIM}  3. Edite .env e defina: GEMINI_API_KEY=AIzaSy...${RESET}"
        echo ""
        read -r -p "  Continuar sem Gemini? [s/N] " resposta
        resposta="${resposta,,}"
        if [ "$resposta" != "s" ] && [ "$resposta" != "sim" ]; then
            echo ""
            print_info "Abra o arquivo .env, configure GEMINI_API_KEY e execute novamente."
            exit 0
        fi
    else
        print_ok "GEMINI_API_KEY configurada"
    fi

    # Verificar N8N_ENCRYPTION_KEY
    local n8n_key
    n8n_key=$(grep -E "^N8N_ENCRYPTION_KEY=" "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
    if [ "$n8n_key" = "change-me-to-random-string" ] || [ ${#n8n_key} -lt 32 ]; then
        print_warn "N8N_ENCRYPTION_KEY com valor padrao inseguro (OK para desenvolvimento)"
    else
        print_ok "N8N_ENCRYPTION_KEY configurada"
    fi

    echo ""
}

# ---------------------------------------------------------------------------
# Passo 3: Build das imagens (opcional)
# ---------------------------------------------------------------------------
build_images() {
    if [ "$OPT_BUILD" = true ]; then
        print_step "3" "Construindo imagens Docker"
        separator
        echo ""
        print_info "Isso pode levar alguns minutos..."
        echo ""
        $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" build 2>&1 | \
            while IFS= read -r line; do
                echo -e "  ${DIM}$line${RESET}"
            done
        print_ok "Imagens construidas com sucesso"
        echo ""
    else
        print_step "3" "Build de imagens (pulado - use --build para reconstruir)"
        echo ""
    fi
}

# ---------------------------------------------------------------------------
# Passo 4: Iniciar os containers
# ---------------------------------------------------------------------------
start_containers() {
    print_step "4" "Iniciando containers"
    separator
    echo ""

    # Detectar containers em estado "Created" (stale) - causa problema de rede
    local stale
    stale=$($COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps -a --status created -q 2>/dev/null | wc -l)
    if [ "$stale" -gt 0 ]; then
        print_warn "Containers em estado 'Created' detectados. Executando ciclo down/up para limpar rede..."
        $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down --remove-orphans &>/dev/null
    fi

    # Subir servicos
    print_info "Executando: docker compose up -d ..."
    $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" up -d --remove-orphans 2>&1 | \
        while IFS= read -r line; do
            # Filtrar linhas relevantes para o usuario
            if echo "$line" | grep -qE "Started|Created|Healthy|Running|error|Error|warn"; then
                echo -e "  ${DIM}$line${RESET}"
            fi
        done

    echo ""
    print_ok "Comando docker compose up executado"
    echo ""
}

# ---------------------------------------------------------------------------
# Passo 5: Aguardar servicos ficarem saudaveis
# ---------------------------------------------------------------------------
wait_for_services() {
    print_step "5" "Aguardando servicos inicializarem"
    separator
    echo ""

    local services_ok=true

    # PostgreSQL - verificar via docker healthcheck
    print_info "Aguardando PostgreSQL (banco de dados)..."
    local pg_attempts=0
    while [ $pg_attempts -lt 30 ]; do
        local pg_health
        pg_health=$($COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps postgres --format json 2>/dev/null \
            | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        if [ "$pg_health" = "healthy" ]; then
            print_ok "PostgreSQL saudavel"
            break
        fi
        pg_attempts=$((pg_attempts + 1))
        printf "\r  ${YELLOW}[...]${RESET} PostgreSQL inicializando (tentativa $pg_attempts/30)..."
        sleep 2
    done
    if [ $pg_attempts -ge 30 ]; then
        print_error "PostgreSQL nao ficou saudavel. Verifique: docker compose logs postgres"
        services_ok=false
    fi

    echo ""

    # Servicos customizados
    local services=(
        "Chat Simulator:http://localhost:3001/health"
        "Business Engine:http://localhost:3002/health"
        "Dashboard API:http://localhost:3003/health"
        "Agent Dashboard:http://localhost:3004/"
    )

    for entry in "${services[@]}"; do
        local name="${entry%%:*}"
        local url="${entry##*:}"
        if wait_for_http "$name" "$url" 30; then
            printf "\r  ${GREEN}[OK]${RESET} %-25s respondendo\n" "$name"
        else
            services_ok=false
        fi
    done

    # n8n - pode demorar mais pois conecta ao postgres e aplica migrations
    echo ""
    print_info "Aguardando n8n (pode levar ate 60s na primeira vez)..."
    if wait_for_http "n8n" "http://localhost:5678/healthz" 40; then
        printf "\r  ${GREEN}[OK]${RESET} n8n respondendo                    \n"
    else
        print_warn "n8n ainda nao esta respondendo. Os workflows podem nao funcionar."
        print_info "Verifique: docker compose logs n8n"
        services_ok=false
    fi

    # WAHA - opcional para testes (usa chat-simulator no lugar)
    echo ""
    print_info "Verificando WAHA (opcional para testes locais)..."
    local waha_code
    waha_code=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "000")
    if [ "$waha_code" = "200" ]; then
        print_ok "WAHA respondendo"
    else
        print_warn "WAHA nao respondeu (normal: use Chat Simulator para testes)"
    fi

    echo ""
    if [ "$services_ok" = false ]; then
        print_warn "Alguns servicos nao estao respondendo. O sistema pode estar parcialmente funcional."
        print_info "Dica: aguarde mais alguns segundos e execute './scripts/health-check.sh'"
    fi
}

# ---------------------------------------------------------------------------
# Passo 6: Verificar/importar workflows n8n
# ---------------------------------------------------------------------------
setup_n8n_workflows() {
    if [ "$OPT_SKIP_N8N" = true ]; then
        print_step "6" "Configuracao n8n (pulado via --skip-n8n)"
        echo ""
        return 0
    fi

    print_step "6" "Verificando workflows n8n"
    separator
    echo ""

    local workflow_dir="$SCRIPT_DIR/n8n/workflows"
    if [ ! -d "$workflow_dir" ] || [ -z "$(ls -A "$workflow_dir" 2>/dev/null)" ]; then
        print_warn "Diretorio n8n/workflows nao encontrado ou vazio"
        print_info "Workflows devem ser importados manualmente em http://localhost:5678"
        echo ""
        return 0
    fi

    if [ -f "$SCRIPT_DIR/scripts/import-workflows.sh" ]; then
        print_info "Executando import-workflows.sh..."
        if bash "$SCRIPT_DIR/scripts/import-workflows.sh" 2>&1 | \
            while IFS= read -r line; do echo -e "  ${DIM}$line${RESET}"; done; then
            print_ok "Workflows importados e ativados"
        else
            print_warn "Falha ao importar workflows automaticamente"
            print_info "Importe manualmente em http://localhost:5678"
        fi
    else
        print_info "Script import-workflows.sh nao encontrado"
        print_info "Importe manualmente em http://localhost:5678"
        print_info "  1. Va em Workflows > Import from File"
        print_info "  2. Importe: n8n/workflows/main-chatbot.json"
        print_info "  3. Importe: n8n/workflows/agent-response.json"
        print_info "  4. Ative ambos os workflows"
    fi

    echo ""
}

# ---------------------------------------------------------------------------
# Dashboard final - mostra todos os links
# ---------------------------------------------------------------------------
print_dashboard() {
    local width=62

    echo ""
    echo -e "${BOLD}${GREEN}============================================================${RESET}"
    echo -e "${BOLD}${GREEN}   Sistema iniciado com sucesso!${RESET}"
    echo -e "${BOLD}${GREEN}============================================================${RESET}"
    echo ""
    echo -e "${BOLD}  Interfaces de Usuario:${RESET}"
    echo ""
    echo -e "  ${GREEN}[ACESSO]${RESET} Chat Simulator (testes)"
    echo -e "  ${CYAN}         http://localhost:3001${RESET}"
    echo ""
    echo -e "  ${GREEN}[ACESSO]${RESET} Agent Dashboard (atendentes)"
    echo -e "  ${CYAN}         http://localhost:3004${RESET}"
    echo ""
    echo -e "  ${GREEN}[ACESSO]${RESET} n8n Workflows"
    echo -e "  ${CYAN}         http://localhost:5678${RESET}"
    echo -e "  ${DIM}         Login: admin / [senha do .env]${RESET}"
    echo ""
    echo -e "${BOLD}  APIs e Servicos:${RESET}"
    echo ""
    echo -e "  ${DIM}  Business Engine    http://localhost:3002/health${RESET}"
    echo -e "  ${DIM}  Dashboard API      http://localhost:3003/health${RESET}"
    echo -e "  ${DIM}  WAHA               http://localhost:3000/api/health${RESET}"
    echo -e "  ${DIM}  PostgreSQL         localhost:5432${RESET}"
    echo ""
    echo -e "${BOLD}  Comandos uteis:${RESET}"
    echo ""
    echo -e "  ${DIM}  Ver logs em tempo real:${RESET}"
    echo -e "  ${YELLOW}  docker compose logs -f${RESET}"
    echo ""
    echo -e "  ${DIM}  Logs de servico especifico:${RESET}"
    echo -e "  ${YELLOW}  docker compose logs -f business-engine${RESET}"
    echo ""
    echo -e "  ${DIM}  Health check completo:${RESET}"
    echo -e "  ${YELLOW}  ./scripts/health-check.sh${RESET}"
    echo ""
    echo -e "  ${DIM}  Executar testes unitarios:${RESET}"
    echo -e "  ${YELLOW}  make test-unit${RESET}"
    echo ""
    echo -e "  ${DIM}  Parar todos os servicos:${RESET}"
    echo -e "  ${YELLOW}  docker compose down${RESET}"
    echo -e "  ${DIM}  ou${RESET}"
    echo -e "  ${YELLOW}  make down${RESET}"
    echo ""
    echo -e "${BOLD}  Documentacao:${RESET}"
    echo ""
    echo -e "  ${DIM}  Instalacao e configuracao:  SETUP.md${RESET}"
    echo -e "  ${DIM}  Tutorial de uso:            USAGE.md${RESET}"
    echo -e "  ${DIM}  Documentacao completa:      DOCUMENTATION.md${RESET}"
    echo ""
    echo -e "${BOLD}${GREEN}============================================================${RESET}"
    echo ""
}

# ---------------------------------------------------------------------------
# Modo attached (--logs): segue logs ate Ctrl+C, depois oferece shutdown
# ---------------------------------------------------------------------------
handle_logs_mode() {
    if [ "$OPT_LOGS" = true ]; then
        echo -e "${DIM}Modo --logs ativo. Pressione Ctrl+C para sair dos logs.${RESET}"
        echo ""
        $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" logs -f || true
        echo ""
    fi
}

# ---------------------------------------------------------------------------
# Oferecer limpeza ao sair (trap SIGINT/SIGTERM)
# ---------------------------------------------------------------------------
cleanup_prompt() {
    echo ""
    echo ""
    echo -e "${YELLOW}Script interrompido.${RESET}"

    # Verificar se containers ainda estao rodando
    local running
    running=$($COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps -q 2>/dev/null | wc -l)
    if [ "$running" -gt 0 ]; then
        echo ""
        read -r -p "  Deseja parar os containers? [s/N] " resposta
        resposta="${resposta,,}"
        if [ "$resposta" = "s" ] || [ "$resposta" = "sim" ]; then
            echo ""
            print_info "Parando containers..."
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down
            print_ok "Containers parados."
        else
            print_info "Containers continuam rodando em background."
            print_info "Para parar: docker compose down"
        fi
    fi
    echo ""
    exit 0
}

trap cleanup_prompt INT TERM

# ---------------------------------------------------------------------------
# Execucao principal
# ---------------------------------------------------------------------------
main() {
    parse_args "$@"
    print_header

    check_prerequisites
    check_env_file
    build_images
    start_containers
    wait_for_services
    setup_n8n_workflows
    print_dashboard
    handle_logs_mode
}

main "$@"
