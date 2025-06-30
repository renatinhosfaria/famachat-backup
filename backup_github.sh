#!/bin/bash

# Script de backup automático para GitHub
# Executa backup diário do projeto famachat

# Configurações
PROJECT_DIR="/var/www/famachat"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"

# Função para log
log() {
    echo "[$DATE] $1" | tee -a "$LOG_FILE"
}

# Navegar para o diretório do projeto
cd "$PROJECT_DIR" || {
    log "ERRO: Não foi possível navegar para $PROJECT_DIR"
    exit 1
}

log "Iniciando backup automático..."

# Verificar se o git está inicializado
if [ ! -d ".git" ]; then
    log "Inicializando repositório Git..."
    git init
    git branch -M main
fi

# Verificar se o remote está configurado
if ! git remote get-url origin > /dev/null 2>&1; then
    log "AVISO: Remote 'origin' não configurado. Configure com:"
    log "git remote add origin https://github.com/SEU_USUARIO/famachat-backup.git"
    exit 1
fi

# Adicionar todos os arquivos (incluindo novos arquivos)
log "Adicionando todos os arquivos..."
git add -A

# Verificar se há mudanças para commit
if git diff --staged --quiet; then
    log "Nenhuma mudança detectada. Backup não necessário."
    exit 0
fi

# Mostrar estatísticas das mudanças
log "Mudanças detectadas:"
git diff --staged --stat | while IFS= read -r line; do
    log "  $line"
done

# Fazer commit
COMMIT_MESSAGE="Backup automático - $DATE"
log "Fazendo commit: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

if [ $? -eq 0 ]; then
    log "Commit realizado com sucesso"
else
    log "ERRO: Falha no commit"
    exit 1
fi

# Push para o GitHub
log "Enviando para GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    log "Backup concluído com sucesso!"
else
    log "ERRO: Falha no push para GitHub"
    log "Verifique a conectividade e autenticação"
    exit 1
fi

# Limpeza de logs antigos (manter apenas os últimos 30 dias)
find "$LOG_DIR" -name "backup.log.*" -type f -mtime +30 -delete 2>/dev/null

# Rotacionar log atual se for muito grande (> 10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.$TIMESTAMP"
    gzip "$LOG_FILE.$TIMESTAMP"
    log "Log rotacionado devido ao tamanho"
fi

log "Backup finalizado"
