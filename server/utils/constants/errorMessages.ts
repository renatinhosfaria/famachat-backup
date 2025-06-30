/**
 * Mensagens de erro padronizadas para todo o sistema
 * Estas mensagens devem ser usadas em todas as respostas de erro da API
 */

export const ErrorMessages = {
  // Erros de autenticação
  AUTH_REQUIRED: "Autenticação necessária",
  INVALID_CREDENTIALS: "Credenciais inválidas",
  USER_NOT_FOUND: "Usuário não encontrado",
  PERMISSION_DENIED: "Permissão negada",
  SESSION_EXPIRED: "Sessão expirada",
  
  // Erros de validação
  INVALID_DATA: "Dados inválidos",
  REQUIRED_FIELDS: "Campos obrigatórios não preenchidos",
  INVALID_FORMAT: "Formato inválido",
  
  // Erros de recurso
  RESOURCE_NOT_FOUND: "Recurso não encontrado",
  RESOURCE_EXISTS: "Recurso já existe",
  
  // Erros específicos de cliente
  CLIENT_NOT_FOUND: "Cliente não encontrado",
  INVALID_CLIENT_DATA: "Dados de cliente inválidos",
  FAILED_FETCH_CLIENTS: "Falha ao buscar clientes",
  FAILED_CREATE_CLIENT: "Falha ao criar cliente",
  FAILED_UPDATE_CLIENT: "Falha ao atualizar cliente",
  
  // Erros específicos de WhatsApp
  WHATSAPP_CONFIG_MISSING: "Configuração da API WhatsApp ausente",
  WHATSAPP_INSTANCE_NOT_FOUND: "Instância WhatsApp não encontrada",
  WHATSAPP_CONNECTION_ERROR: "Erro de conexão com WhatsApp",
  WHATSAPP_QR_ERROR: "Erro ao gerar QR Code",
  WHATSAPP_API_ERROR: "Erro na API WhatsApp",
  
  // Erros de banco de dados
  DB_CONNECTION_ERROR: "Erro de conexão com o banco de dados",
  DB_QUERY_ERROR: "Erro na consulta ao banco de dados",
  
  // Erros gerais
  INTERNAL_ERROR: "Erro interno do servidor",
  API_ERROR: "Erro na API",
  UNKNOWN_ERROR: "Erro desconhecido",
  TIMEOUT: "Tempo limite excedido",
  
  // Recomendações
  TRY_AGAIN: "Tente novamente mais tarde",
  CHECK_CONNECTION: "Verifique sua conexão",
  CONTACT_ADMIN: "Entre em contato com o administrador"
}; 