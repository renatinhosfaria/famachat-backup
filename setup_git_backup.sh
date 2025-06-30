#!/bin/bash

# Script de configuração inicial do Git para backup
# Execute este script apenas uma vez para configurar o repositório

echo "=== Configuração Inicial do Git para Backup ==="
echo

# Navegar para o diretório do projeto
cd /var/www/famachat

# Configurar informações do usuário (se não estiver configurado)
echo "Configurando informações do usuário Git..."
git config user.name "Backup Bot"
git config user.email "backup@famachat.local"

# Inicializar repositório se não existir
if [ ! -d ".git" ]; then
    echo "Inicializando repositório Git..."
    git init
    git branch -M main
else
    echo "Repositório Git já existe."
fi

echo
echo "=== PRÓXIMOS PASSOS ==="
echo "1. Crie um repositório no GitHub com o nome 'famachat-backup'"
echo "2. Execute o comando abaixo substituindo SEU_USUARIO pelo seu usuário do GitHub:"
echo "   git remote add origin https://github.com/SEU_USUARIO/famachat-backup.git"
echo
echo "3. Para configurar autenticação sem senha, use um dos métodos:"
echo "   a) Token de acesso pessoal do GitHub"
echo "   b) Chave SSH"
echo
echo "4. Faça o primeiro push manualmente:"
echo "   git add ."
echo "   git commit -m 'Backup inicial'"
echo "   git push -u origin main"
echo
echo "5. Depois execute este comando para agendar o backup diário às 23:00:"
echo "   (crontab -l 2>/dev/null; echo '0 23 * * * /var/www/famachat/backup_github.sh') | crontab -"
echo
echo "Para testar o script de backup, execute: ./backup_github.sh"
