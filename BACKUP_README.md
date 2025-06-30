# Sistema de Backup Automático - FamaChat

Este sistema automatiza o backup completo do projeto FamaChat para o GitHub, incluindo todos os diretórios e arquivos importantes.

## 🚀 Configuração Rápida

Execute o script de configuração completa:

```bash
./setup_complete_backup.sh
```

Este script irá:
- ✅ Configurar o Git
- ✅ Conectar ao GitHub
- ✅ Configurar o .gitignore
- ✅ Agendar backup automático
- ✅ Fazer backup inicial

## 📁 Estrutura dos Scripts

### Scripts Principais

| Script | Descrição |
|--------|-----------|
| `setup_complete_backup.sh` | Configuração completa do sistema de backup |
| `backup_github.sh` | Script de backup automático |
| `monitor_backup.sh` | Monitoramento e status dos backups |
| `setup_git_backup.sh` | Configuração básica do Git (legado) |

### Scripts de Uso

```bash
# Configuração inicial (execute apenas uma vez)
./setup_complete_backup.sh

# Monitorar status dos backups
./monitor_backup.sh status

# Ver logs de backup
./monitor_backup.sh logs

# Testar backup manual
./monitor_backup.sh test

# Ver apenas erros
./monitor_backup.sh errors

# Backup manual
./backup_github.sh
```

## 🔧 Configuração Manual

Se preferir configurar manualmente:

### 1. Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Nome: `famachat-backup` (ou escolha outro)
3. **NÃO** inicialize com README, .gitignore ou licença
4. Clique em "Create repository"

### 2. Configurar Remote

```bash
git remote add origin https://github.com/SEU_USUARIO/famachat-backup.git
```

### 3. Configurar Autenticação

#### Opção A: Token de Acesso Pessoal
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Selecione scopes: `repo`
4. Use o token como senha ao fazer push

#### Opção B: Chave SSH
```bash
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"
cat ~/.ssh/id_ed25519.pub
# Adicione a chave pública no GitHub → Settings → SSH keys
```

### 4. Agendar Backup Automático

```bash
# Backup diário às 23:00
(crontab -l 2>/dev/null; echo "0 23 * * * /var/www/famachat/backup_github.sh") | crontab -
```

## 📊 Monitoramento

### Verificar Status
```bash
./monitor_backup.sh status
```

### Ver Logs em Tempo Real
```bash
tail -f logs/backup.log
```

### Verificar Agendamentos
```bash
crontab -l
```

## 📝 Logs

Os logs são armazenados em:
- **Localização**: `logs/backup.log`
- **Rotação**: Automática quando > 10MB
- **Retenção**: 30 dias

### Exemplo de Log
```
[2025-06-30 23:00:01] Iniciando backup automático...
[2025-06-30 23:00:02] Adicionando todos os arquivos...
[2025-06-30 23:00:02] Mudanças detectadas:
[2025-06-30 23:00:02]   server/index.ts | 5 +++++
[2025-06-30 23:00:02]   client/src/App.tsx | 3 +--
[2025-06-30 23:00:03] Fazendo commit: Backup automático - 2025-06-30 23:00:01
[2025-06-30 23:00:03] Commit realizado com sucesso
[2025-06-30 23:00:04] Enviando para GitHub...
[2025-06-30 23:00:06] Backup concluído com sucesso!
```

## 🔍 Solução de Problemas

### Erro de Autenticação
```bash
# Verificar configuração do remote
git remote -v

# Reconfigurar com token
git remote set-url origin https://TOKEN@github.com/USUARIO/REPO.git
```

### Backup não Executando
```bash
# Verificar se o cron está rodando
sudo systemctl status cron

# Verificar logs do cron
sudo journalctl -u cron

# Testar script manualmente
./backup_github.sh
```

### Problemas de Conectividade
```bash
# Testar conectividade com GitHub
ping github.com

# Verificar se o Git consegue acessar o GitHub
git ls-remote origin
```

## 📋 Arquivos Incluídos no Backup

O backup inclui todos os arquivos do projeto, exceto:

### Excluídos (.gitignore)
- `node_modules/`
- `.env` (variáveis de ambiente)
- `dist/` e `build/` (arquivos compilados)
- `logs/*.log` (logs de aplicação)
- `uploads/temp/` (uploads temporários)
- Arquivos de IDE e sistema

### Incluídos
- Todo código fonte (`client/`, `server/`, `shared/`)
- Arquivos de configuração
- Documentação (`docs/`)
- Scripts de banco de dados
- Arquivos de build (package.json, tsconfig.json, etc.)

## 🚨 Backup de Emergência

Para fazer um backup manual imediato:

```bash
# Backup completo manual
git add -A
git commit -m "Backup emergencial - $(date)"
git push origin main
```

## 🔄 Restauração

Para restaurar o projeto a partir do backup:

```bash
# Clonar o repositório
git clone https://github.com/SEU_USUARIO/famachat-backup.git

# Entrar no diretório
cd famachat-backup

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações
```

## ⚙️ Personalização

### Alterar Horário do Backup
```bash
# Editar crontab
crontab -e

# Exemplo: backup a cada 6 horas
0 */6 * * * /var/www/famachat/backup_github.sh
```

### Alterar Mensagem do Commit
Edite o arquivo `backup_github.sh` e modifique a linha:
```bash
COMMIT_MESSAGE="Backup automático - $DATE"
```

### Adicionar Webhook (Opcional)
Para notificações do backup, adicione no final do `backup_github.sh`:
```bash
# Notificação via webhook (Discord, Slack, etc.)
curl -X POST "SEU_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Backup FamaChat concluído com sucesso!"}'
```

## 📞 Suporte

- **Logs**: Sempre verifique `logs/backup.log` primeiro
- **Status**: Use `./monitor_backup.sh status`
- **Teste**: Execute `./monitor_backup.sh test`

---

**Nota**: Este sistema foi projetado para funcionar de forma autônoma. Após a configuração inicial, os backups serão executados automaticamente todos os dias no horário configurado.
