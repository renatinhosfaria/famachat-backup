#!/bin/bash

# Script de Configuração Completa do Backup GitHub
# Este script configura completamente o backup automático do famachat para GitHub

set -e  # Sair em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
print_header() {
    echo
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Função para solicitar input do usuário
ask_user() {
    local prompt="$1"
    local default="$2"
    local response
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " response
        echo "${response:-$default}"
    else
        read -p "$prompt: " response
        echo "$response"
    fi
}

# Função para validar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_header "CONFIGURAÇÃO COMPLETA DO BACKUP FAMACHAT"

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "client" ]; then
    print_error "Este script deve ser executado no diretório raiz do projeto famachat"
    exit 1
fi

PROJECT_DIR=$(pwd)
print_info "Diretório do projeto: $PROJECT_DIR"

# Verificar dependências
print_header "VERIFICANDO DEPENDÊNCIAS"

if ! command_exists git; then
    print_error "Git não está instalado. Instale o Git primeiro."
    exit 1
fi
print_success "Git encontrado"

if ! command_exists crontab; then
    print_error "Crontab não está disponível. Instale o cron primeiro."
    exit 1
fi
print_success "Crontab encontrado"

# Configurar Git se necessário
print_header "CONFIGURAÇÃO DO GIT"

GIT_NAME=$(git config user.name 2>/dev/null || echo "")
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "")

if [ -z "$GIT_NAME" ]; then
    GIT_NAME=$(ask_user "Nome do usuário Git" "FamaChat Backup Bot")
    git config user.name "$GIT_NAME"
fi
print_success "Nome do usuário: $GIT_NAME"

if [ -z "$GIT_EMAIL" ]; then
    GIT_EMAIL=$(ask_user "Email do usuário Git" "backup@famachat.local")
    git config user.email "$GIT_EMAIL"
fi
print_success "Email do usuário: $GIT_EMAIL"

# Inicializar repositório Git se necessário
if [ ! -d ".git" ]; then
    print_info "Inicializando repositório Git..."
    git init
    git branch -M main
    print_success "Repositório Git inicializado"
else
    print_success "Repositório Git já existe"
fi

# Configurar remote do GitHub
print_header "CONFIGURAÇÃO DO REPOSITÓRIO GITHUB"

CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$CURRENT_REMOTE" ]; then
    echo "Você precisa configurar um repositório no GitHub."
    echo "1. Vá para https://github.com/new"
    echo "2. Crie um repositório chamado 'famachat-backup' (ou outro nome de sua escolha)"
    echo "3. NÃO inicialize com README, .gitignore ou licença"
    echo
    
    GITHUB_USER=$(ask_user "Seu usuário do GitHub")
    REPO_NAME=$(ask_user "Nome do repositório" "famachat-backup")
    
    REPO_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"
    git remote add origin "$REPO_URL"
    print_success "Remote configurado: $REPO_URL"
else
    print_success "Remote já configurado: $CURRENT_REMOTE"
fi

# Verificar e melhorar .gitignore
print_header "CONFIGURANDO .GITIGNORE"

if [ ! -f ".gitignore" ]; then
    print_info "Criando arquivo .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
.next/
.nuxt/
.vite/

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
Thumbs.db
ehthumbs.db

# Logs
logs/*.log
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.nyc_output/

# Grunt intermediate storage
.grunt/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# PM2 logs
.pm2/

# Database
*.sqlite
*.db

# Uploads temporários
uploads/temp/

# Cache
.cache/
.parcel-cache/

# Redis dump
dump.rdb
EOF
    print_success "Arquivo .gitignore criado"
else
    print_success "Arquivo .gitignore já existe"
fi

# Configurar agendamento automático
print_header "CONFIGURAÇÃO DO BACKUP AUTOMÁTICO"

BACKUP_TIME=$(ask_user "Horário para backup diário (formato HH:MM)" "23:00")
BACKUP_HOUR=$(echo "$BACKUP_TIME" | cut -d':' -f1)
BACKUP_MINUTE=$(echo "$BACKUP_TIME" | cut -d':' -f2)

# Remover agendamentos existentes do famachat
crontab -l 2>/dev/null | grep -v "famachat" > /tmp/crontab_temp || true

# Adicionar novo agendamento
echo "$BACKUP_MINUTE $BACKUP_HOUR * * * $PROJECT_DIR/backup_github.sh" >> /tmp/crontab_temp

# Instalar nova crontab
crontab /tmp/crontab_temp
rm /tmp/crontab_temp

print_success "Backup agendado para $BACKUP_TIME diariamente"

# Fazer backup inicial
print_header "EXECUTANDO BACKUP INICIAL"

echo "Você deseja fazer um backup inicial agora? (y/n)"
read -p "Resposta: " DO_INITIAL_BACKUP

if [ "$DO_INITIAL_BACKUP" = "y" ] || [ "$DO_INITIAL_BACKUP" = "Y" ]; then
    print_info "Executando backup inicial..."
    
    # Adicionar todos os arquivos
    git add -A
    
    # Verificar se há arquivos para commit
    if ! git diff --staged --quiet; then
        git commit -m "Backup inicial - $(date '+%Y-%m-%d %H:%M:%S')"
        
        print_info "Fazendo push para GitHub..."
        if git push -u origin main; then
            print_success "Backup inicial concluído com sucesso!"
        else
            print_warning "Push falhou. Verifique suas credenciais do GitHub."
            print_info "Configure um token de acesso pessoal ou chave SSH"
        fi
    else
        print_info "Nenhum arquivo novo para backup inicial"
    fi
fi

# Resumo final
print_header "CONFIGURAÇÃO CONCLUÍDA"

print_success "✓ Git configurado"
print_success "✓ Repositório GitHub conectado"
print_success "✓ Arquivo .gitignore configurado"
print_success "✓ Backup automático agendado para $BACKUP_TIME"
print_success "✓ Scripts de backup prontos"

echo
print_info "PRÓXIMOS PASSOS:"
echo "1. Configure a autenticação do GitHub (token ou SSH)"
echo "2. Teste o backup manual: ./backup_github.sh"
echo "3. Verifique os logs em: $PROJECT_DIR/logs/backup.log"
echo
print_info "COMANDOS ÚTEIS:"
echo "• Ver agendamentos: crontab -l"
echo "• Testar backup: ./backup_github.sh"
echo "• Ver logs: tail -f logs/backup.log"
echo "• Status do Git: git status"
echo
print_success "Automação do backup configurada com sucesso!"
