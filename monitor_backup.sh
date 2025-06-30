#!/bin/bash

# Script de Monitoramento do Backup
# Verifica o status dos backups e fornece relatórios

# Configurações
PROJECT_DIR="/var/www/famachat"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backup.log"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Função para verificar último backup
check_last_backup() {
    if [ -f "$LOG_FILE" ]; then
        local last_success=$(grep "Backup concluído com sucesso" "$LOG_FILE" | tail -1)
        if [ -n "$last_success" ]; then
            local backup_date=$(echo "$last_success" | grep -o '\[.*\]' | tr -d '[]')
            print_success "Último backup bem-sucedido: $backup_date"
        else
            print_warning "Nenhum backup bem-sucedido encontrado nos logs"
        fi
        
        local last_error=$(grep "ERRO" "$LOG_FILE" | tail -1)
        if [ -n "$last_error" ]; then
            local error_date=$(echo "$last_error" | grep -o '\[.*\]' | tr -d '[]')
            print_error "Último erro: $error_date"
            echo "  Detalhes: $(echo "$last_error" | sed 's/\[.*\] //')"
        fi
    else
        print_warning "Arquivo de log não encontrado"
    fi
}

# Função para verificar status do Git
check_git_status() {
    cd "$PROJECT_DIR" || exit 1
    
    # Verificar se há mudanças não commitadas
    if ! git diff --quiet; then
        print_warning "Há mudanças não commitadas nos arquivos"
        git diff --stat
    elif ! git diff --staged --quiet; then
        print_warning "Há mudanças em staging aguardando commit"
        git diff --staged --stat
    else
        print_success "Todos os arquivos estão commitados"
    fi
    
    # Verificar último commit
    local last_commit=$(git log -1 --pretty=format:"%h - %s (%cr)")
    print_info "Último commit: $last_commit"
    
    # Verificar status do remote
    if git remote get-url origin >/dev/null 2>&1; then
        local remote_url=$(git remote get-url origin)
        print_success "Remote configurado: $remote_url"
        
        # Tentar verificar se está atualizado com o remote
        if git fetch origin main --dry-run >/dev/null 2>&1; then
            if git diff --quiet origin/main; then
                print_success "Repositório local está atualizado com o remote"
            else
                print_warning "Há diferenças entre o repositório local e o remote"
            fi
        else
            print_warning "Não foi possível verificar status do remote (possível problema de conectividade)"
        fi
    else
        print_error "Remote não configurado"
    fi
}

# Função para verificar agendamento do cron
check_cron_schedule() {
    local cron_entry=$(crontab -l 2>/dev/null | grep "backup_github.sh" || echo "")
    if [ -n "$cron_entry" ]; then
        print_success "Backup agendado encontrado:"
        echo "  $cron_entry"
    else
        print_error "Nenhum agendamento de backup encontrado no cron"
        print_info "Para agendar, execute: ./setup_complete_backup.sh"
    fi
}

# Função para mostrar estatísticas
show_statistics() {
    if [ -f "$LOG_FILE" ]; then
        local total_backups=$(grep -c "Backup concluído com sucesso" "$LOG_FILE" 2>/dev/null || echo "0")
        local total_errors=$(grep -c "ERRO" "$LOG_FILE" 2>/dev/null || echo "0")
        local log_size=$(du -h "$LOG_FILE" 2>/dev/null | cut -f1 || echo "0")
        
        print_info "Estatísticas:"
        echo "  • Backups bem-sucedidos: $total_backups"
        echo "  • Erros registrados: $total_errors"
        echo "  • Tamanho do log: $log_size"
    fi
}

# Função para executar teste de backup
test_backup() {
    print_info "Executando teste de backup..."
    if "$PROJECT_DIR/backup_github.sh"; then
        print_success "Teste de backup executado com sucesso"
    else
        print_error "Teste de backup falhou"
    fi
}

# Menu principal
case "${1:-status}" in
    "status")
        print_header "STATUS DO BACKUP FAMACHAT"
        check_last_backup
        echo
        check_git_status
        echo
        check_cron_schedule
        echo
        show_statistics
        ;;
    "logs")
        print_header "LOGS DE BACKUP"
        if [ -f "$LOG_FILE" ]; then
            echo "Mostrando últimas 20 linhas do log:"
            echo
            tail -20 "$LOG_FILE"
        else
            print_warning "Arquivo de log não encontrado"
        fi
        ;;
    "test")
        print_header "TESTE DE BACKUP"
        test_backup
        ;;
    "errors")
        print_header "ÚLTIMOS ERROS"
        if [ -f "$LOG_FILE" ]; then
            grep "ERRO" "$LOG_FILE" | tail -10
        else
            print_warning "Arquivo de log não encontrado"
        fi
        ;;
    "help")
        print_header "MONITOR DE BACKUP FAMACHAT"
        echo "Uso: $0 [comando]"
        echo
        echo "Comandos disponíveis:"
        echo "  status   - Mostra status geral do backup (padrão)"
        echo "  logs     - Mostra os últimos logs"
        echo "  test     - Executa um teste de backup"
        echo "  errors   - Mostra os últimos erros"
        echo "  help     - Mostra esta ajuda"
        echo
        ;;
    *)
        print_error "Comando inválido: $1"
        echo "Use '$0 help' para ver os comandos disponíveis"
        exit 1
        ;;
esac
