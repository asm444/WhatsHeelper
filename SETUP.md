# Guia de Instalacao e Configuracao - Amaral Support

Este documento cobre todos os passos necessarios para instalar, configurar e verificar o ambiente do WhatsApp ChatBot "Amaral Support" em qualquer sistema operacional suportado.

---

## Pre-requisitos

### Versoes Obrigatorias

| Ferramenta | Versao Minima | Verificar com | Instalar em |
|---|---|---|---|
| Node.js | 20.0.0 | `node --version` | https://nodejs.org/en/download |
| npm | 9.0.0 | `npm --version` | Incluido com Node.js |
| Docker | 24.0.0 | `docker --version` | https://docs.docker.com/get-docker |
| Docker Compose | 2.20.0 | `docker compose version` | Incluido com Docker Desktop |
| Git | 2.40.0 | `git --version` | https://git-scm.com/downloads |

> **Nota sobre Docker Compose:** O projeto usa `docker compose` (plugin v2), nao o antigo `docker-compose` (v1 standalone). Se o comando `docker compose version` falhar, atualize o Docker.

### Por Sistema Operacional

**Linux (Fedora / Ubuntu / Debian):**

```bash
# Verificar versao do Node.js
node --version   # deve exibir v20.x.x ou superior

# Verificar Docker
docker --version
docker compose version

# Em Fedora: pode ser necessario usar sg para permissoes de grupo Docker
sg docker -c "docker compose version"
```

**macOS:**

```bash
# Recomendado: instalar Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20

# Docker Desktop para Mac inclui Compose
docker compose version
```

**Windows (WSL2):**

```bash
# Instale o WSL2 primeiro:
# wsl --install (PowerShell como Administrador)

# Dentro do terminal WSL2 Ubuntu, instale Node.js:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker Desktop para Windows com integracao WSL2 habilitada
# Configuracoes > Resources > WSL Integration > habilite sua distro
docker compose version
```

---

## Passo 1: Clonar o Repositorio

```bash
git clone <url-do-repositorio> WhatsAppChatBot
cd WhatsAppChatBot
```

Verifique a estrutura apos clonar:

```
WhatsAppChatBot/
├── docker-compose.yml
├── .env.example
├── Makefile
├── package.json
├── services/
│   ├── chat-simulator/
│   ├── business-engine/
│   ├── dashboard-api/
│   └── agent-dashboard/
├── n8n/workflows/
└── scripts/
```

---

## Passo 2: Instalar Dependencias Node.js

O projeto usa npm workspaces. Um unico comando instala as dependencias de todos os quatro servicos:

```bash
npm install
```

O npm lerá o `package.json` raiz e instalará automaticamente as dependencias de:
- `services/chat-simulator`
- `services/business-engine`
- `services/dashboard-api`
- `services/agent-dashboard`

Saida esperada (sem erros):
```
added 847 packages, and audited 848 packages in 12s
found 0 vulnerabilities
```

---

## Passo 3: Configurar Variaveis de Ambiente

### 3.1 Copiar o Template

```bash
cp .env.example .env
```

### 3.2 Editar o Arquivo .env

Abra `.env` no seu editor e configure as variaveis. As obrigatorias estao marcadas com `[OBRIGATORIA]`:

```bash
# ===================================================
# PostgreSQL
# ===================================================
POSTGRES_USER=amaral
POSTGRES_PASSWORD=amaral_secret_2024       # Mude em producao
POSTGRES_DB=amaral_suport
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://amaral:amaral_secret_2024@postgres:5432/amaral_suport

# ===================================================
# n8n - Interface de workflows
# ===================================================
N8N_PORT=5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=admin123           # Mude em producao
N8N_ENCRYPTION_KEY=change-me-to-random-string  # MUDE ESTE VALOR

# ===================================================
# WAHA - Bridge com WhatsApp
# ===================================================
WAHA_PORT=3000

# ===================================================
# Google Gemini Pro                         [OBRIGATORIA]
# ===================================================
GEMINI_API_KEY=your-gemini-api-key-here    # Veja Passo 3.3
GEMINI_MODEL=gemini-2.0-flash

# ===================================================
# Servicos internos (valores padrao funcionam)
# ===================================================
BUSINESS_ENGINE_PORT=3002
BUSINESS_ENGINE_URL=http://business-engine:3002
CHAT_SIMULATOR_PORT=3001
CHAT_SIMULATOR_URL=http://chat-simulator:3001
DASHBOARD_API_PORT=3003
DASHBOARD_API_URL=http://dashboard-api:3003
DASHBOARD_FRONTEND_PORT=3004

# ===================================================
# Configuracoes do Bot
# ===================================================
BOT_NAME=Amaral AllSuport
BOT_LANGUAGE=pt-BR
CONFIDENCE_THRESHOLD=0.4
MAX_RETRIES_BEFORE_ESCALATION=3
```

### 3.3 Obter a Chave da API do Google Gemini

A API do Gemini tem uso gratuito suficiente para desenvolvimento e testes (15 requisicoes/minuto, 1.000.000 tokens/dia).

**Passos:**

1. Acesse https://aistudio.google.com/apikey
2. Faca login com uma conta Google
3. Clique em **"Create API Key"**
4. Selecione um projeto Google Cloud existente ou crie um novo
5. Copie a chave gerada (comeca com `AIzaSy...`)
6. Cole no `.env`:
   ```bash
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

**Verificar se a chave funciona:**

```bash
curl -s \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Diga apenas: OK"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=SEU_API_KEY" \
  | grep -o '"text": "[^"]*"'
```

Resposta esperada: `"text": "OK"` (ou algo similar).

### 3.4 Gerar N8N_ENCRYPTION_KEY Segura

A encryption key deve ter pelo menos 32 caracteres. Para gerar uma chave aleatoria:

```bash
# Linux / macOS / WSL2:
openssl rand -hex 32
# Exemplo de saida: a3f8b2c9d1e4f7a0b5c8d2e6f9a3b7c1d4e8f2a5b9c3d7e1f4a8b2c6d9e3f7a1

# Ou usando Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado no `.env`:
```bash
N8N_ENCRYPTION_KEY=a3f8b2c9d1e4f7a0b5c8d2e6f9a3b7c1d4e8f2a5b9c3d7e1f4a8b2c6d9e3f7a1
```

---

## Passo 4: Iniciar os Containers Docker

### 4.1 Subir todos os servicos

```bash
docker compose up -d
```

Na primeira execucao, o Docker ira:
- Baixar imagens base (postgres:16-alpine, devlikeapro/waha, n8nio/n8n)
- Compilar as imagens customizadas dos 4 servicos TypeScript
- Criar os volumes `postgres_data` e `n8n_data`
- Criar a rede `whatsappchatbot_amaral-net`

Isso pode levar de 3 a 10 minutos na primeira vez.

### 4.2 Verificar status dos containers

```bash
docker compose ps
```

Todos os servicos devem aparecer como `running` (ou `healthy` para postgres):

```
NAME                     STATUS
amaral-postgres          running (healthy)
amaral-n8n               running
amaral-waha              running
amaral-business-engine   running
amaral-chat-simulator    running
amaral-dashboard-api     running
amaral-agent-dashboard   running
```

### 4.3 Aguardar inicializacao completa

O PostgreSQL leva alguns segundos para criar as tabelas. Os servicos que dependem do banco ficam aguardando automaticamente (via `depends_on: condition: service_healthy`).

Para acompanhar os logs em tempo real:

```bash
docker compose logs -f
```

Use `Ctrl+C` para sair dos logs sem parar os servicos.

---

## Passo 5: Importar Workflows do n8n

O n8n precisa ter os workflows importados e ativados para o fluxo de mensagens funcionar.

### 5.1 Via script automatizado

```bash
./scripts/import-workflows.sh
```

### 5.2 Via interface web (alternativa manual)

1. Acesse http://localhost:5678
2. Faca login: usuario `admin`, senha conforme `N8N_BASIC_AUTH_PASSWORD` do `.env`
3. Va em **Workflows** no menu lateral esquerdo
4. Clique em **"Import from File"**
5. Importe o arquivo `n8n/workflows/main-chatbot.json`
6. Clique em **"Activate"** (botao toggle no canto superior direito)
7. Repita para `n8n/workflows/agent-response.json`

---

## Passo 6: Verificacao de Saude

### 6.1 Script de health check

```bash
./scripts/health-check.sh
```

Saida esperada:
```
=== Verificacao de Saude - Amaral AllSuport ===

[Servicos Customizados]
  [OK] Chat Simulator (3001)
  [OK] Business Engine (3002)
  [OK] Dashboard API (3003)
  [OK] Agent Dashboard (3004)

[Infraestrutura]
  [OK] n8n (5678)
  [OK] WAHA (3000)

Resultado: 6 OK, 0 falhas
```

### 6.2 Verificacao manual por endpoint

```bash
# Chat Simulator
curl http://localhost:3001/health

# Business Engine
curl http://localhost:3002/health

# Dashboard API
curl http://localhost:3003/health

# n8n
curl http://localhost:5678/healthz

# WAHA
curl http://localhost:3000/api/health
```

Todos devem retornar HTTP 200.

### 6.3 Teste rapido do fluxo completo

```bash
# Enviar mensagem de teste via Business Engine
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d '{"message":"Meu computador nao liga","phone":"5511999999999"}' \
  | python3 -m json.tool
```

Resposta esperada (simplificada):
```json
{
  "category": "hardware",
  "confidence": 0.85,
  "shouldEscalate": false,
  "agentHandling": false
}
```

---

## URLs de Acesso

| Servico | URL | Descricao |
|---|---|---|
| Chat Simulator | http://localhost:3001 | Interface de simulacao de WhatsApp |
| Business Engine | http://localhost:3002/health | API de classificacao e IA |
| Dashboard API | http://localhost:3003/health | API REST dos tickets |
| Agent Dashboard | http://localhost:3004 | Frontend do atendente |
| n8n | http://localhost:5678 | Interface de workflows |
| WAHA | http://localhost:3000 | WhatsApp Bridge (producao) |

---

## Troubleshooting

### Erro: "docker compose" nao reconhecido

**Causa:** Versao antiga do Docker com `docker-compose` (hifen) em vez do plugin `compose`.

**Solucao:**
```bash
# Atualize o Docker para a versao mais recente
# Linux (Ubuntu/Debian):
sudo apt-get update && sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verifique apos instalar:
docker compose version
```

### Erro: Port already in use (Porta ja em uso)

**Causa:** Outro programa esta usando uma das portas necessarias.

**Diagnostico:**
```bash
# Verificar quem usa a porta (exemplo: 5432)
sudo lsof -i :5432
# ou
sudo ss -tlnp | grep 5432
```

**Solucao:**
```bash
# Opção 1: Parar o servico conflitante (exemplo: PostgreSQL local)
sudo systemctl stop postgresql

# Opcao 2: Mudar a porta no .env
# POSTGRES_PORT=5433  (qualquer porta livre)
# Lembre de atualizar DATABASE_URL tambem se mudar a porta do postgres
```

### Erro: getaddrinfo EAI_AGAIN postgres (n8n nao conecta ao banco)

**Causa:** Containers foram criados em estado "Created" sem se juntarem a rede Docker. Ocorre quando ha containers antigos parados que impedem a remontagem da rede.

**Solucao:**
```bash
# Fazer um ciclo completo down/up (nao apenas restart)
docker compose down
docker compose up -d

# Se persistir, remova os containers antigos forcadamente:
docker compose down --remove-orphans
docker compose up -d
```

### Erro: SELinux permission denied (Fedora / RHEL)

**Causa:** SELinux bloqueia acesso do container ao volume bind-mounted.

**Solucao:** O `docker-compose.yml` ja inclui o sufixo `:z` nos volumes que precisam, que instrui o SELinux a rotular corretamente. Se algum volume novo causar problema:

```bash
# Adicione :z ao final do volume no docker-compose.yml
# Exemplo:
volumes:
  - ./meu-arquivo.sql:/docker-entrypoint-initdb.d/init.sql:z
```

### Erro: GEMINI_API_KEY invalida ou quota excedida

**Causa:** Chave incorreta, expirada ou limite de 15 req/min atingido.

**Diagnostico:**
```bash
# Verificar se a variavel foi carregada no container
docker compose exec business-engine env | grep GEMINI

# Testar chave diretamente
curl -s -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"ola"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$(grep GEMINI_API_KEY .env | cut -d= -f2)"
```

**Solucao:**
- Se a chave for invalida: gere uma nova em https://aistudio.google.com/apikey, atualize `.env` e execute `docker compose up -d --force-recreate business-engine`
- Se for quota: aguarde 1 minuto. O sistema possui fallback automatico para classificacao por palavras-chave.

### Erro: Webhook do n8n retorna 404

**Causa:** Bug conhecido do n8n v2.7.4 onde ativar workflow via API nao registra os webhooks. O Dockerfile do projeto ja aplica o patch necessario.

**Solucao:**
```bash
# Rebuild da imagem do n8n para garantir que o patch foi aplicado
docker compose build n8n
docker compose up -d n8n

# Reimportar e reativar os workflows
./scripts/import-workflows.sh

# Verificar se o webhook esta respondendo
curl -I http://localhost:5678/webhook/waha
# Esperado: HTTP 405 (Method Not Allowed) - indica que o webhook existe
# Problema: HTTP 404 - webhook nao registrado
```

### Containers nao iniciam apos `docker compose up`

**Diagnostico:**
```bash
# Ver logs detalhados de um servico especifico
docker compose logs business-engine
docker compose logs n8n
docker compose logs postgres
```

**Solucao mais comum:** Arquivo `.env` nao foi criado ou tem erros de sintaxe.

```bash
# Verificar se .env existe e tem as variaveis criticas
cat .env | grep -E "GEMINI_API_KEY|DATABASE_URL|N8N_ENCRYPTION_KEY"
```

### Permissao negada ao executar scripts .sh

```bash
# Dar permissao de execucao
chmod +x scripts/health-check.sh scripts/setup.sh
chmod +x START.sh  # se necessario
```

---

## Limpeza do Ambiente

### Parar tudo (preserva dados)
```bash
docker compose down
# ou
make down
```

### Remover tudo incluindo dados do banco
```bash
docker compose down -v
# O -v remove os volumes (postgres_data e n8n_data)
# ATENCAO: todos os tickets, conversas e configuracoes do n8n serao perdidos
```

### Limpeza completa (containers, volumes, node_modules)
```bash
make clean
```

### Remover imagens Docker para reconstruir do zero
```bash
docker compose down -v --rmi local
docker compose up -d --build
```
