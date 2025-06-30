# Sistema de Backup Automático para GitHub

Este sistema permite fazer backup automático diário do projeto famachat para o GitHub todos os dias às 23:00.

## Arquivos criados:

- `backup_github.sh` - Script principal de backup
- `setup_git_backup.sh` - Script de configuração inicial
- `.gitignore` - Arquivo para ignorar arquivos desnecessários
- `backup.log` - Log das operações de backup (criado automaticamente)

## Configuração Inicial (Execute apenas uma vez):

### 1. Criar repositório no GitHub
1. Acesse [github.com](https://github.com)
2. Crie um novo repositório chamado `famachat-backup`
3. **NÃO** adicione README, .gitignore ou licença (deixe vazio)

### 2. Executar configuração inicial
```bash
cd /var/www/famachat
./setup_git_backup.sh
```

### 3. Configurar remote do GitHub
Substitua `SEU_USUARIO` pelo seu usuário do GitHub:
```bash
git remote add origin https://github.com/SEU_USUARIO/famachat-backup.git
```

### 4. Configurar autenticação (escolha uma opção):

#### Opção A: Token de Acesso Pessoal (Recomendado)
1. No GitHub: Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Gere um novo token com permissões de `repo`
3. Use o token como senha quando solicitado

#### Opção B: Chave SSH
```bash
ssh-keygen -t ed25519 -C "backup@famachat.local"
cat ~/.ssh/id_ed25519.pub
```
Adicione a chave pública nas configurações SSH do GitHub.

### 5. Primeiro backup manual
```bash
git add .
git commit -m "Backup inicial"
git push -u origin main
```

### 6. Agendar backup automático diário às 23:00
```bash
(crontab -l 2>/dev/null; echo "0 23 * * * /var/www/famachat/backup_github.sh") | crontab -
```

## Uso:

### Testar backup manualmente:
```bash
./backup_github.sh
```

### Verificar agendamento do cron:
```bash
crontab -l
```

### Ver logs de backup:
```bash
tail -f backup.log
```

### Desabilitar backup automático:
```bash
crontab -l | grep -v backup_github.sh | crontab -
```

## Funcionamento:

- **Horário**: Todos os dias às 23:00
- **Ação**: Adiciona todos os arquivos, faz commit e push para GitHub
- **Log**: Registra todas as operações em `backup.log`
- **Inteligente**: Só faz backup se houver mudanças
- **Seguro**: Respeita o `.gitignore` para não enviar arquivos sensíveis

## Solução de Problemas:

### Erro de autenticação:
- Verifique se o token/SSH está configurado corretamente
- Teste manualmente: `git push`

### Backup não executa:
- Verifique se o cron está ativo: `sudo systemctl status cron`
- Verifique logs do sistema: `grep CRON /var/log/syslog`

### Ver status do repositório:
```bash
git status
git log --oneline -5
```

## Arquivos ignorados no backup:

O `.gitignore` está configurado para ignorar:
- `node_modules/`
- `.env` e arquivos de configuração sensíveis
- `logs/`
- `dist/` e outros builds
- `uploads/` (arquivos de usuário)
- Arquivos temporários e cache

Se precisar incluir algum arquivo específico, edite o `.gitignore`.
