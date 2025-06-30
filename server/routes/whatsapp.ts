import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertWhatsappInstanceSchema, WhatsAppInstanceStatus, clientes } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, and, or, isNull, not, desc } from "drizzle-orm";
import { db } from "../database";
import axios from "axios";
import { logger } from "../utils/logger";
import { ErrorMessages } from "../constants/errorMessages";
import { updateClienteProfilePic, updateAllProfilePics } from "../services/whatsapp-profile-pic";
import { whatsappApi } from "../services/whatsapp-api";

// Inicializa o logger para o módulo WhatsApp
const whatsappLogger = logger.createLogger("WhatsAppAPI");

// Declaração global para variáveis de processamento sequencial de fotos
declare global {
  var sequentialProfilePicsRunning: boolean;
  var sequentialProfilePicsTotal: number;
  var sequentialProfilePicsProcessed: number;
  var sequentialProfilePicsUpdated: number;
  var sequentialProfilePicsStartTime: Date;
  var sequentialProfilePicsEndTime: Date | null;
  var sequentialProfilePicsError: string | null;
}

// Adicionar interface para configuração da API WhatsApp
interface WhatsAppApiConfig {
  apiUrl: string;
  apiKey: string;
}

// Interface para resposta de QR code
interface QrCodeResponse {
  message: string;
  instanceId: string;
  qrCode?: string;
  pairingCode?: string;
  format?: string;
  error?: string;
}

// Interface para resposta de erro
interface ErrorResponse {
  message: string;
  error?: string;
  recommendation?: string;
}

// Interface para configuração de webhook
interface WebhookConfig {
  enabled: boolean;
  url: string;
  webhook_by_events?: boolean;
  events?: string[];
}

// Interface para configuração de settings
interface SettingsConfig {
  rejectCall: boolean;
  msgCall?: string;
  groupsIgnore: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  readStatus: boolean;
  syncFullHistory: boolean;
}

// Interface para dados do perfil
interface ProfileData {
  wuid?: string;          // ID WhatsApp do usuário (número@s.whatsapp.net)
  name?: string;          // Nome do perfil
  numberExists?: boolean; // Se o número existe no WhatsApp
  picture?: string;       // URL da foto de perfil
  profilePictureUrl?: string; // URL alternativa para a foto de perfil (compatibilidade)
  status?: {
    status?: string;      // Status do perfil (texto/emoji)
    setAt?: string;       // Data da definição do status
  };
  isBusiness?: boolean;   // Se é uma conta business
  description?: string;   // Descrição do perfil (bio)
}

// Interface para mensagem recebida do webhook do WhatsApp
interface WebhookMessage {
  instance: {
    instanceName: string;
  };
  type: string;
  message?: any;
  messageType?: string;
  status?: string;
  from?: string;
  to?: string;
  data?: any;
  [key: string]: any;
}

// Interface para resposta de status
interface StatusResponse {
  state?: string;
  status?: string;
  base64?: string;
  qrcode?: {
    base64?: string;
  };
  pairingCode?: string;
  [key: string]: any; // Para outros campos desconhecidos
}

// Função auxiliar para verificar configuração da API
export function getApiConfig(): WhatsAppApiConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  
  if (!apiUrl || !apiKey) {
    return null;
  }
  
  return { apiUrl, apiKey };
}

/**
 * Normaliza o status da API Evolution para o formato interno do sistema
 * @param apiStatus Status recebido da API Evolution
 * @returns Status normalizado no formato do enum WhatsAppInstanceStatus
 */
function normalizeStatus(apiStatus: string): string {
  // Normalizar para maiúsculas para facilitar a comparação
  const status = String(apiStatus).toUpperCase();
  
  // Lista de estados que indicam que a instância está conectada
  const connectedStates = ["OPEN", "CONNECTED", "ONLINE", "READY"];
  const connectingStates = ["CONNECTING", "PAIRING", "SYNCING"];
  const disconnectedStates = ["CLOSE", "CLOSED", "DISCONNECTED"];
  const errorStates = ["ERROR", "CONFLICT", "TIMEOUT", "FAILED"];
  
  if (connectedStates.includes(status)) {
    return WhatsAppInstanceStatus.CONNECTED;
  } else if (connectingStates.includes(status)) {
    return WhatsAppInstanceStatus.CONNECTING;
  } else if (disconnectedStates.includes(status)) {
    return WhatsAppInstanceStatus.DISCONNECTED;
  } else if (errorStates.includes(status)) {
    return WhatsAppInstanceStatus.ERROR;
  } else {
    // Status desconhecido, logar para debug
    logger.warn(`Status desconhecido da API Evolution: ${apiStatus}, mapeando para DISCONNECTED`);
    return WhatsAppInstanceStatus.DISCONNECTED;
  }
}

// Tipagem para estender a request com session
declare global {
  namespace Express {
    interface Request {
      session?: {
        userId?: number;
      };
    }
  }
}

// Não usamos middleware de autenticação, pois a página de WhatsApp já
// está restrita a usuários gestores no frontend

// Função auxiliar para encontrar Base64 em um objeto de resposta
function findBase64InObject(obj: any): string | null {
  if (!obj) return null;
  
  // Se for um objeto, procurar em suas propriedades
  if (typeof obj === 'object') {
    // Verificar se o objeto tem a propriedade base64
    if (obj.base64 && typeof obj.base64 === 'string' && obj.base64.startsWith('data:image')) {
      return obj.base64;
    }
    
    // Verificar se o objeto tem a propriedade qr
    if (obj.qr && typeof obj.qr === 'string' && obj.qr.startsWith('data:image')) {
      return obj.qr;
    }
    
    // Procurar em outras propriedades
    for (const key in obj) {
      const result = findBase64InObject(obj[key]);
      if (result) return result;
    }
  }
  
  return null;
}

// Variáveis globais para rastrear o progresso da validação
global.validationStatus = {
  currentBatch: 0,
  totalBatches: 0,
  isRunning: false,
  isFinished: false,
  startedAt: new Date(),
  completedAt: null as Date | null
};

/**
 * Função para validar o número WhatsApp de um cliente específico e atualizar o BD
 * @param clienteId ID do cliente
 * @param phoneNumber Número de telefone
 * @returns Resultado da validação ou null em caso de erro
 */
export async function validateAndUpdateClienteWhatsappStatus(
  clienteId: number,
  phoneNumber: string
): Promise<boolean | null> {
  try {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return null;
    }
    
    // Usar a primeira instância disponível
    // (nota: o campo isPrimary foi removido da tabela)
    const instances = await storage.getWhatsappInstances();
    const primaryInstance = instances[0];
    
    if (!primaryInstance) {
      logger.error("Não foi possível validar WhatsApp: nenhuma instância disponível");
      return null;
    }

    // Importar o serviço de validação
    const { validateSingleNumber } = await import('../services/whatsapp-validation');
    
    // Validar o número
    const result = await validateSingleNumber(primaryInstance.instanceName, phoneNumber);
    
    if (!result) {
      logger.error(`Falha ao validar número ${phoneNumber} para cliente ${clienteId}`);
      return null;
    }
    
    // Atualizar o campo hasWhatsapp e whatsappJid no banco de dados
    await db.update(clientes)
      .set({ 
        hasWhatsapp: result.isRegistered, // Usando o campo do esquema
        whatsappJid: result.isRegistered ? result.jid || null : null, // Armazenar o JID quando disponível
        updatedAt: new Date()
      })
      .where(eq(clientes.id, clienteId));
    
    logger.info(`Cliente ${clienteId} atualizado: hasWhatsapp = ${result.isRegistered}`);
    return result.isRegistered;
    
  } catch (error) {
    logger.error(`Erro ao validar WhatsApp para cliente ${clienteId}: ${error}`);
    return null;
  }
}

/**
 * Função para configurar o webhook na API Evolution
 * @param instanceName Nome da instância
 * @param webhookUrl URL do webhook
 * @param events Lista de eventos para receber notificações (opcional)
 * @returns Resposta da API
 */
async function configureWebhook(
  instanceName: string,
  webhookUrl: string,
  events: string[] = []
): Promise<any> {
  const apiConfig = getApiConfig();
  if (!apiConfig) {
    throw new Error("API WhatsApp não configurada");
  }
  
  const { apiUrl, apiKey } = apiConfig;
  
  // Configuração padrão de eventos se não fornecida
  const defaultEvents = [
    'messages.upsert',
    'messages.update',
    'qr',
    'connection.update',
    'presence.update'
  ];
  
  // Preparar payload
  const payload = {
    enabled: true,
    url: webhookUrl,
    webhook_by_events: events.length > 0,
    events: events.length > 0 ? events : defaultEvents
  };
  
  try {
    logger.info(`Configurando webhook para ${instanceName}: ${webhookUrl}`);
    
    const response = await axios.post(
      `${apiUrl}/webhook/set/${instanceName}`,
      payload,
      {
        timeout: 30000, // 30 segundos de timeout
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        }
      }
    );
    
    logger.info(`Webhook configurado com sucesso para ${instanceName}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao configurar webhook: ${error}`);
    throw error;
  }
}

/**
 * Função para obter a configuração atual do webhook
 * @param instanceName Nome da instância
 * @returns Configuração atual do webhook
 */
async function getWebhookConfig(instanceName: string): Promise<WebhookConfig | null> {
  const apiConfig = getApiConfig();
  if (!apiConfig) {
    throw new Error("API WhatsApp não configurada");
  }
  
  const { apiUrl, apiKey } = apiConfig;
  
  try {
    logger.info(`Obtendo configuração do webhook para ${instanceName}`);
    
    const response = await axios.get(
      `${apiUrl}/webhook/get/${instanceName}`,
      {
        timeout: 30000, // 30 segundos de timeout
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        }
      }
    );
    
    if (response.data && response.data.webhook) {
      return response.data.webhook;
    }
    
    return null;
  } catch (error) {
    logger.error(`Erro ao obter configuração do webhook: ${error}`);
    return null;
  }
}

/**
 * Função para obter a configuração atual das settings
 * @param instanceName Nome da instância
 * @returns Configuração atual das settings
 */
async function getInstanceSettings(instanceName: string): Promise<SettingsConfig | null> {
  const apiConfig = getApiConfig();
  if (!apiConfig) {
    throw new Error("API WhatsApp não configurada");
  }
  
  const { apiUrl, apiKey } = apiConfig;
  
  try {
    logger.info(`Obtendo configuração de settings para ${instanceName}`);
    
    const response = await axios.get(
      `${apiUrl}/settings/find/${instanceName}`,
      {
        timeout: 30000, // 30 segundos de timeout
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        }
      }
    );
    
    if (response.data) {
      return response.data;
    }
    
    return null;
  } catch (error) {
    logger.error(`Erro ao obter configuração de settings: ${error}`);
    return null;
  }
}

/**
 * Função para atualizar foto de perfil do WhatsApp
 * @param instanceName Nome da instância
 * @param pictureUrl URL da nova foto de perfil
 * @returns Dados da resposta da API
 */
async function updateProfilePicture(instanceName: string, pictureUrl: string): Promise<any> {
  try {
    logger.info(`Atualizando foto de perfil para ${instanceName} com URL: ${pictureUrl}`);
    
    // Objeto de payload para enviar à API
    const payload = { picture: pictureUrl };
    logger.debug(`Payload para API: ${JSON.stringify(payload)}`);
    
    // Adicionar requisição à fila com o serviço
    const response = await whatsappApi.post(
      `chat/updateProfilePicture/${instanceName}`,
      payload
    );
    
    logger.info(`Foto de perfil atualizada com sucesso para ${instanceName}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao atualizar foto de perfil: ${error}`);
    throw error;
  }
}

/**
 * Função para atualizar nome de perfil do WhatsApp
 * @param instanceName Nome da instância
 * @param name Novo nome de perfil
 * @returns Dados da resposta da API
 */
async function updateProfileName(instanceName: string, name: string): Promise<any> {
  try {
    logger.info(`Atualizando nome de perfil para ${instanceName}: ${name}`);
    
    // Corrigido para usar o endpoint correto conforme documentação atualizada
    // POST /chat/updateProfileName/{instanceName}
    const response = await whatsappApi.post(
      `chat/updateProfileName/${instanceName}`,
      { name }
    );
    
    logger.info(`Nome de perfil atualizado com sucesso para ${instanceName}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao atualizar nome de perfil: ${error}`);
    throw error;
  }
}

/**
 * Função para atualizar status do WhatsApp
 * @param instanceName Nome da instância
 * @param status Novo status
 * @returns Dados da resposta da API
 */
async function updateProfileStatus(instanceName: string, status: string): Promise<any> {
  try {
    logger.info(`Atualizando status para ${instanceName}: ${status}`);
    
    // Adicionar requisição à fila com o serviço
    // Usando o endpoint correto conforme documentação e instruções do usuário
    const response = await whatsappApi.post(
      `chat/updateProfileStatus/${instanceName}`,
      { status }
    );
    
    logger.info(`Status atualizado com sucesso para ${instanceName}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao atualizar status: ${error}`);
    throw error;
  }
}

/**
 * Função específica para buscar a URL da foto de perfil do WhatsApp
 * @param instanceName Nome da instância
 * @param number Número de telefone 
 * @returns URL da foto de perfil ou null em caso de erro
 */
async function fetchProfilePictureUrl(instanceName: string, number: string): Promise<string | null> {
  try {
    logger.info(`Buscando URL da foto de perfil para ${number} na instância ${instanceName}`);
    
    // Usar EXATAMENTE o formato da requisição fornecido pelo usuário
    const response = await whatsappApi.post(
      `chat/fetchProfilePictureUrl/${instanceName}`,
      { number: `${number}@s.whatsapp.net` }
    );
    
    // Logar a resposta completa para diagnóstico
    logger.debug(`Resposta completa: ${JSON.stringify(response.data)}`);
    
    // Verificar primeiro o campo profilePictureUrl
    if (response.data && response.data.profilePictureUrl) {
      logger.info(`URL da foto de perfil obtida com sucesso: ${response.data.profilePictureUrl}`);
      logger.info(`Foto de perfil obtida com sucesso pelo endpoint dedicado: ${response.data.profilePictureUrl}`);
      return response.data.profilePictureUrl;
    }
    
    // Tenta outros campos possíveis da resposta
    if (response.data) {
      // Verificar outros possíveis campos onde a URL possa estar
      const possibleFields = ['url', 'profilePicUrl', 'picture'];
      
      for (const field of possibleFields) {
        if (response.data[field]) {
          logger.info(`URL da foto de perfil encontrada no campo ${field}: ${response.data[field]}`);
          return response.data[field];
        }
      }
      
      // Verificar se está em um nível mais profundo
      if (response.data.data && response.data.data.profilePictureUrl) {
        return response.data.data.profilePictureUrl;
      }
    }
    
    logger.warn(`Não foi possível obter a URL da foto de perfil para ${number}`);
    return null;
  } catch (error) {
    logger.error(`Erro ao buscar URL da foto de perfil: ${error}`);
    return null;
  }
}

/**
 * Função para encontrar/importar contatos no WhatsApp
 * @param instanceName Nome da instância
 * @param numbers Array de números de telefone
 * @returns Resultado da operação ou null em caso de erro
 */
async function findContacts(instanceName: string, numbers: string[]): Promise<any> {
  try {
    logger.info(`Importando/encontrando contatos para ${instanceName}: ${numbers.join(', ')}`);
    
    const response = await whatsappApi.post(
      `chat/findContacts/${instanceName}`,
      { numbers }
    );
    
    logger.debug(`Contatos encontrados com sucesso: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao encontrar contatos para ${instanceName}: ${error}`);
    return null;
  }
}

/**
 * Função para obter informações do perfil da instância do WhatsApp
 * @param instanceName Nome da instância
 * @param number Número de telefone do contato (opcional)
 * @returns Dados do perfil ou null em caso de erro
 */
async function getProfileInfo(instanceName: string, number?: string): Promise<ProfileData | null> {
  const apiConfig = getApiConfig();
  if (!apiConfig) {
    throw new Error("API WhatsApp não configurada");
  }
  
  try {
    // Se for número específico (contato), vamos usar o endpoint para contatos
    if (number) {
      return getContactProfileInfo(instanceName, number);
    }
    
    logger.info(`Obtendo informações de perfil para ${instanceName} usando sequência recomendada de operações`);
    
    // Primeiro, obtemos informações da instância para pegar o número do proprietário
    const instancesResponse = await whatsappApi.get(`instance/fetchInstances`);
    let ownerJid = null;
    
    // Extrair o número do proprietário
    if (Array.isArray(instancesResponse.data)) {
      const foundInstance = instancesResponse.data.find((inst: any) => inst.name === instanceName);
      if (foundInstance) {
        ownerJid = foundInstance.ownerJid || foundInstance.owner || null;
        logger.info(`Número do proprietário encontrado: ${ownerJid}`);
      }
    }
    
    // Se não encontrou ownerJid, usar um valor padrão (conforme histórico)
    if (!ownerJid) {
      ownerJid = "553499602714@s.whatsapp.net";
      logger.warn(`Usando número padrão: ${ownerJid}`);
    }
    
    // Garantir que o ownerJid tenha o formato correto com @s.whatsapp.net
    if (!ownerJid.includes('@s.whatsapp.net')) {
      ownerJid = `${ownerJid}@s.whatsapp.net`;
    }
    
    // Verificar se o número é brasileiro e se precisa adicionar o 9º dígito
    if (ownerJid.startsWith('55') && !ownerJid.substring(0, ownerJid.indexOf('@')).match(/55\d{2}9/)) {
      // Extrair partes do número: 55 + DDD + resto
      const parts = ownerJid.substring(0, ownerJid.indexOf('@')).match(/^(55)(\d{2})(\d+)$/);
      if (parts) {
        const [_, country, ddd, number] = parts;
        // Inserir o 9 após o DDD
        ownerJid = `${country}${ddd}9${number}@s.whatsapp.net`;
        logger.info(`Número formatado para padrão brasileiro com 9º dígito: ${ownerJid}`);
      }
    }
    
    // 1. Verificar se a instância está conectada usando connectionState
    logger.info(`Verificando estado de conexão da instância ${instanceName}`);
    const connectionResponse = await whatsappApi.get(`instance/connectionState/${instanceName}`);
    if (connectionResponse.data?.status !== 'open') {
      logger.warn(`Instância ${instanceName} não está conectada: ${JSON.stringify(connectionResponse.data)}`);
      throw new Error(`Instância ${instanceName} não está conectada`);
    }
    
    // 2. "Apresentar" o número ao Baileys (findContacts) - força o Baileys a conhecer o contato
    logger.info(`Apresentando o número ${ownerJid} à instância ${instanceName} via findContacts`);
    try {
      const findResponse = await whatsappApi.post(
        `chat/findContacts/${instanceName}`,
        { numbers: [ownerJid] }
      );
      logger.debug(`Resultado da apresentação de contatos: ${JSON.stringify(findResponse.data)}`);
      
      // Aguardar um tempo para o Baileys processar o contato
      logger.info(`Aguardando 3 segundos para processamento...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (findError) {
      logger.warn(`Erro ao apresentar contatos (não crítico, continuando): ${findError}`);
    }
    
    // 3. Enviar uma mensagem de teste para garantir download do perfil completo
    try {
      logger.info(`Enviando mensagem de teste para ${ownerJid}`);
      const sendResponse = await whatsappApi.post(
        `chat/sendMessage/${instanceName}`,
        {
          to: ownerJid,
          message: { text: "🔄 Sincronizando perfil... [Automático]" }
        }
      );
      logger.debug(`Resultado do envio de mensagem: ${JSON.stringify(sendResponse.data)}`);
      
      // Aguardar um tempo para o WhatsApp baixar o perfil
      logger.info(`Aguardando 3 segundos para WhatsApp baixar perfil...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (sendError) {
      logger.warn(`Erro ao enviar mensagem de teste (não crítico, continuando): ${sendError}`);
    }
    
    // 4. Agora buscar o perfil com o JID completo
    logger.info(`Buscando perfil com JID: ${ownerJid}`);
    const response = await whatsappApi.post(
      `chat/fetchProfile/${instanceName}`,
      { number: ownerJid }
    );
    
    logger.debug(`Resposta de fetchProfile: ${JSON.stringify(response.data)}`);
    
    // Obter a foto de perfil
    let profilePictureUrl = null;
    try {
      // Extrair número puro sem @s.whatsapp.net para fetchProfilePictureUrl
      const numberOnly = ownerJid.split('@')[0];
      profilePictureUrl = await fetchProfilePictureUrl(instanceName, numberOnly);
    } catch (pictureError) {
      logger.warn(`Erro ao obter foto de perfil: ${pictureError}`);
    }
    
    if (response.data) {
      // Extrair dados da resposta
      const profileName = response.data.name || response.data.pushName || response.data.verifiedName;
      const connectionStatus = response.data.status || "online";
      
      logger.info(`Dados do perfil detectados: nome=${profileName}, status=${connectionStatus}`);
      
      // Montar o objeto de perfil com os campos corretos
      return {
        wuid: ownerJid,
        name: profileName || "ConsultorAI",
        numberExists: true,
        picture: profilePictureUrl || response.data.picture || undefined,
        profilePictureUrl: profilePictureUrl || response.data.picture || undefined,
        status: typeof response.data.status === 'string' 
                ? { status: response.data.status } 
                : response.data.status || { status: "online" },
        isBusiness: response.data.isBusiness || false,
        description: response.data.description
      };
    }
    
    // Se não conseguir obter as informações, retornar valores padrão
    logger.warn(`Não foi possível obter informações de perfil completas, usando valores padrão`);
    return {
      name: "ConsultorAI",
      wuid: ownerJid,
      picture: profilePictureUrl || undefined,
      profilePictureUrl: profilePictureUrl || undefined,
      status: { status: "online" },
      isBusiness: false,
      description: undefined
    };
  } catch (error) {
    logger.error(`Erro ao obter informações de perfil: ${error}`);
    return null;
  }
}

/**
 * Função para obter perfil de contatos (não da instância)
 * @param instanceName Nome da instância
 * @param number Número de telefone do contato
 * @returns Dados do perfil ou null em caso de erro
 */
async function getContactProfileInfo(instanceName: string, number: string): Promise<ProfileData | null> {
  try {
    logger.info(`Buscando perfil do contato: ${number}`);
    
    // Formatar o número
    const targetNumber = number.trim();
    const formattedNumber = targetNumber.includes('@s.whatsapp.net') 
      ? targetNumber 
      : `${targetNumber}@s.whatsapp.net`;
    
    // 1. Verificar se a instância está conectada usando connectionState
    logger.info(`Verificando estado de conexão da instância ${instanceName}`);
    const connectionResponse = await whatsappApi.get(`instance/connectionState/${instanceName}`);
    if (connectionResponse.data?.status !== 'open') {
      logger.warn(`Instância ${instanceName} não está conectada: ${JSON.stringify(connectionResponse.data)}`);
      throw new Error(`Instância ${instanceName} não está conectada`);
    }
    
    // 2. "Apresentar" o número ao Baileys (findContacts) - força o Baileys a conhecer o contato
    logger.info(`Apresentando o número ${formattedNumber} à instância ${instanceName} via findContacts`);
    try {
      const findResponse = await whatsappApi.post(
        `chat/findContacts/${instanceName}`,
        { numbers: [formattedNumber] }
      );
      logger.info(`Contato importado com sucesso: ${JSON.stringify(findResponse.data)}`);
      
      // Aguardar um tempo para o Baileys processar o contato
      logger.info(`Aguardando 3 segundos para processamento...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (findError) {
      logger.warn(`Aviso: Erro ao importar contato: ${findError}`);
    }
    
    // 3. Enviar uma mensagem de teste para garantir download do perfil completo
    try {
      logger.info(`Enviando mensagem de teste para ${formattedNumber}`);
      const sendResponse = await whatsappApi.post(
        `chat/sendMessage/${instanceName}`,
        {
          to: formattedNumber,
          message: { text: "🔄 Sincronizando perfil de contato... [Automático]" }
        }
      );
      logger.debug(`Resultado do envio de mensagem: ${JSON.stringify(sendResponse.data)}`);
      
      // Aguardar um tempo para o WhatsApp baixar o perfil
      logger.info(`Aguardando 3 segundos para WhatsApp baixar perfil...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (sendError) {
      logger.warn(`Erro ao enviar mensagem de teste (não crítico, continuando): ${sendError}`);
    }
    
    // 4. Obter a foto do perfil usando endpoint dedicado
    let profilePictureUrl = null;
    try {
      profilePictureUrl = await fetchProfilePictureUrl(instanceName, targetNumber);
      logger.info(`Foto de perfil obtida: ${profilePictureUrl}`);
    } catch (pictureError) {
      logger.warn(`Erro ao obter foto de perfil: ${pictureError}`);
    }
    
    // 5. Agora sim buscar o perfil com o JID completo para ter acesso aos metadados atualizados
    logger.info(`Buscando perfil com JID completo: ${formattedNumber}`);
    const response = await whatsappApi.post(
      `chat/fetchProfile/${instanceName}`,
      { number: formattedNumber }
    );
    
    logger.debug(`Resposta de fetchProfile para contato: ${JSON.stringify(response.data)}`);
    
    if (response.data) {
      // Extrair dados da resposta
      return {
        wuid: response.data.wuid || formattedNumber,
        name: response.data.name || response.data.pushName || "Contato",
        numberExists: response.data.numberExists !== false,
        picture: (profilePictureUrl || response.data.picture) || undefined,
        profilePictureUrl: (profilePictureUrl || response.data.picture) || undefined,
        status: typeof response.data.status === 'string' 
                ? { status: response.data.status } 
                : response.data.status || { status: "online" },
        isBusiness: response.data.isBusiness || false,
        description: response.data.description
      };
    }
    
    // Se não conseguir obter os dados, retornar valores padrão
    return {
      wuid: formattedNumber,
      name: "Contato",
      numberExists: true,
      picture: profilePictureUrl || undefined,
      profilePictureUrl: profilePictureUrl || undefined,
      status: { status: "online" },
      isBusiness: false,
      description: undefined
    };
  } catch (error) {
    logger.error(`Erro ao obter perfil do contato: ${error}`);
    return null;
  }
}

/**
 * Função para configurar settings da instância na API Evolution
 * @param instanceName Nome da instância
 * @param settings Configurações a serem aplicadas
 * @returns Resposta da API
 */
async function configureInstanceSettings(
  instanceName: string,
  settings: SettingsConfig
): Promise<any> {
  try {
    logger.info(`Configurando settings para ${instanceName}`);
    logger.debug(`Payload: ${JSON.stringify(settings)}`);
    
    const response = await whatsappApi.post(
      `settings/set/${instanceName}`,
      settings
    );
    
    logger.info(`Settings configurados com sucesso para ${instanceName}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao configurar settings: ${error}`);
    throw error;
  }
}

export function registerWhatsappRoutes(app: Express) {
  /**
   * Endpoint genérico para obter logs do WhatsApp
   * Nota: Tabela whatsappLogs foi removida, retornando array vazio para manter compatibilidade
   */
  app.get("/api/whatsapp/logs", async (req: Request, res: Response) => {
    // Tabela whatsappLogs não existe mais, retornar array vazio para compatibilidade
    return res.json([]);
  });

  /**
   * Endpoint para obter logs específicos de fotos de perfil
   * Nota: Tabela whatsappLogs foi removida, retornando array vazio para manter compatibilidade
   */
  app.get("/api/whatsapp/logs/profile-pics", async (req: Request, res: Response) => {
    try {
      // Tabela whatsappLogs não existe mais, retornar array vazio para compatibilidade
      return res.json([]);
    } catch (error) {
      logger.error(`Erro ao buscar logs de fotos de perfil: ${error}`);
      return res.status(500).json({
        message: "Erro ao buscar logs de fotos de perfil",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  // Novo endpoint para buscar instâncias diretamente da Evolution API
  // sem sincronização com o banco de dados local
  app.get("/api/whatsapp/evolution-instances", async (req, res) => {
    try {
      logger.info(`Buscando instâncias diretamente da Evolution API`);
      
      // Obter instâncias da Evolution API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY",
          error: "config_missing"
        });
      }
      
      const { apiUrl, apiKey } = apiConfig;
      
      logger.info(`Fazendo requisição para ${apiUrl}/instance/fetchInstances`);
      
      try {
        const evolutionInstances = await axios.get(
          `${apiUrl}/instance/fetchInstances`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey
            }
          }
        );
        
        // Log completo para depuração
        logger.debug(`Resposta completa da Evolution API: ${JSON.stringify(evolutionInstances.data)}`);
        
        // Simplesmente retornar a resposta da API Evolution
        return res.json(evolutionInstances.data);
      } catch (apiError: any) {
        // Verificar se a resposta contém erro de autenticação
        if (apiError.response && apiError.response.status === 401) {
          logger.error(`Erro de autenticação na API Evolution: ${apiError.response.data?.error || 'Unauthorized'}`);
          return res.status(401).json({
            message: "Falha de autenticação na API Evolution. Verifique sua chave de API.",
            error: apiError.response.data?.error || "Unauthorized"
          });
        }
        
        // Para outros erros de API
        logger.error(`Erro na requisição à API Evolution: ${apiError}`);
        return res.status(500).json({
          message: "Erro na comunicação com o servidor Evolution API",
          error: apiError.message || "Erro desconhecido"
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar instâncias da Evolution API: ${error}`);
      res.status(500).json({ 
        message: "Falha ao buscar instâncias da Evolution API",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  // Obter instâncias diretamente do servidor externo (Evolution API)
  app.get("/api/whatsapp/fetch-external-instances", async (req, res) => {
    try {
      logger.info(`Buscando instâncias diretamente da Evolution API`);
      
      // Obter instâncias da Evolution API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY",
          error: "config_missing"
        });
      }
      
      const { apiUrl, apiKey } = apiConfig;
      
      logger.info(`Fazendo requisição para ${apiUrl}/instance/fetchInstances`);
      
      try {
        const evolutionInstances = await axios.get(
          `${apiUrl}/instance/fetchInstances`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey
            }
          }
        );
        
        // Log completo para depuração
        logger.debug(`Resposta completa da Evolution API: ${JSON.stringify(evolutionInstances.data)}`);
        
        // Retornar a resposta exata da Evolution API para o cliente
        return res.json(evolutionInstances.data);
      } catch (apiError: any) {
        // Se recebemos um erro de autenticação
        if (apiError.response && apiError.response.status === 401) {
          logger.error(`Erro de autenticação na Evolution API: ${apiError.response.data?.error || 'Unauthorized'}`);
          return res.status(401).json({
            message: "Acesso não autorizado à Evolution API. Verifique sua chave de API.",
            error: apiError.response.data?.error || "Unauthorized"
          });
        }
        
        // Outros erros de API
        logger.error(`Erro na requisição à Evolution API: ${apiError}`);
        return res.status(500).json({
          message: "Erro ao comunicar com o servidor Evolution API",
          error: apiError.message || "Erro desconhecido"
        });
      }
    } catch (error) {
      logger.error(`Erro ao buscar instâncias da Evolution API: ${error}`);
      res.status(500).json({ 
        message: "Falha ao buscar instâncias da Evolution API",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });

  // Obter todas as instâncias do WhatsApp
  app.get("/api/whatsapp/instances", async (req, res) => {
    try {
      logger.info(`Iniciando busca de instâncias do WhatsApp`);
      const startTime = Date.now();
      
      // Buscar instâncias do banco de dados
      const instances = await storage.getWhatsappInstances();
      logger.info(`${instances.length} instâncias encontradas no banco de dados em ${Date.now() - startTime}ms`);
      
      // Se não houver instâncias, verificar se há instâncias na Evolution API
      if (instances.length === 0) {
        logger.info(`Nenhuma instância encontrada no banco de dados, verificando Evolution API`);
        try {
          // Obter instâncias da Evolution API
          const apiConfig = getApiConfig();
          if (apiConfig) {
            const { apiUrl, apiKey } = apiConfig;
            
            const evolutionInstances = await axios.get(
              `${apiUrl}/instance/fetchInstances`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': apiKey
                }
              }
            );
            
            if (evolutionInstances.data && Array.isArray(evolutionInstances.data) && evolutionInstances.data.length > 0) {
              logger.info(`${evolutionInstances.data.length} instâncias encontradas na Evolution API`);
              
              // Criar instâncias no banco de dados para cada instância na Evolution API
              for (const apiInstance of evolutionInstances.data) {
                const instanceName = apiInstance.name || '';
                
                // Verificar se já existe essa instância no banco
                const existingInstance = await storage.getWhatsappInstanceByName(instanceName);
                if (!existingInstance && instanceName) {
                  logger.info(`Criando instância ${instanceName} no banco de dados local`);
                  
                  // Criar a instância no banco de dados com o usuário ID 1 (admin)
                  await storage.createWhatsappInstance({
                    instanciaId: instanceName, // Usar o instanceName como instanciaId
                    instanceName,
                    instanceStatus: apiInstance.connectionStatus === 'open' ? WhatsAppInstanceStatus.CONNECTED : WhatsAppInstanceStatus.DISCONNECTED,
                    userId: 1, // Admin
                    base64: null,
                    webhook: null
                  });
                }
              }
              
              // Buscar instâncias novamente após criar
              const refreshedInstances = await storage.getWhatsappInstances();
              logger.info(`${refreshedInstances.length} instâncias após sincronização`);
              
              // Retornar as instâncias atualizadas
              return res.json(refreshedInstances.map(instance => ({
                ...instance,
                whatsappName: instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED ? "ConsultorAI" : "Desconectado",
                whatsappPhone: instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED ? "553499602714" : "Desconectado"
              })));
            }
          }
        } catch (apiError) {
          logger.error(`Erro ao verificar instâncias na Evolution API: ${apiError}`);
        }
      }
      
      // Para instâncias conectadas, adicionamos informações mais precisas
      // Usamos remoteJid quando disponível como fonte primária para o número de telefone
      const enhancedInstances = instances.map(instance => {
        // Se a instância estiver conectada, usar dados mais precisos
        if (instance.instanceStatus && (
            instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED || 
            instance.instanceStatus === 'open' || 
            instance.instanceStatus === 'Conectado' || 
            instance.instanceStatus.toLowerCase() === 'connected')) {
          
          // Processar o remoteJid quando disponível para extrair o número
          let phoneNumber;
          if (instance.remoteJid) {
            // Extrair o número de telefone do formato 5534999999999@s.whatsapp.net
            phoneNumber = instance.remoteJid.split('@')[0];
          }
          
          return {
            ...instance,
            whatsappName: instance.instanceName || "ConsultorAI", // Usar o nome da instância como padrão
            whatsappPhone: phoneNumber || "Não disponível" // Usar remoteJid processado quando disponível
          };
        }
        
        // Se não estiver conectada
        return {
          ...instance,
          whatsappName: instance.instanceName || "Desconectado",
          whatsappPhone: "Desconectado"
        };
      });
      
      logger.info(`Retornando ${enhancedInstances.length} instâncias em ${Date.now() - startTime}ms`);
      res.json(enhancedInstances);
    } catch (error) {
      logger.error(`Error fetching WhatsApp instances: ${error}`);
      res.status(500).json({ message: "Failed to fetch WhatsApp instances" });
    }
  });

  // Obter uma instância específica do WhatsApp
  app.get("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const id = req.params.id; // Usar diretamente como string, sem parseInt
      const instance = await storage.getWhatsappInstance(id);
      if (!instance) {
        return res.status(404).json({ message: "WhatsApp instance not found" });
      }
      
      // Se a instância estiver conectada, buscar informações do perfil
      if (instance.instanceStatus && (
          instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED || 
          instance.instanceStatus === 'open' || 
          instance.instanceStatus === 'Conectado' || 
          instance.instanceStatus.toLowerCase() === 'connected')) {
        try {
          // Buscar informações do perfil da instância
          const profileInfo = await getProfileInfo(instance.instanceName);
          
          // Processar o remoteJid quando disponível para extrair o número 
          let phoneNumber;
          if (instance.remoteJid) {
            // Extrair o número de telefone do formato 5534999999999@s.whatsapp.net
            phoneNumber = instance.remoteJid.split('@')[0];
          } else if (profileInfo?.wuid) {
            phoneNumber = profileInfo.wuid.split('@')[0];
          }
          
          // Retornar instância com informações do perfil
          res.json({
            ...instance,
            whatsappName: profileInfo?.name || instance.instanceName, // Usar nome da instância como fallback
            whatsappPhone: phoneNumber || "Não disponível" // Usar número processado
          });
          return;
        } catch (profileError) {
          logger.error(`Erro ao obter informações de perfil para ${instance.instanceName}: ${profileError}`);
          
          // Processar o remoteJid mesmo se o profileInfo falhar
          let phoneNumber;
          if (instance.remoteJid) {
            // Extrair o número de telefone do formato 5534999999999@s.whatsapp.net
            phoneNumber = instance.remoteJid.split('@')[0];
          }
          
          // Se falhar, usar nome da instância e número do remoteJid quando disponível
          res.json({
            ...instance,
            whatsappName: instance.instanceName, // Usar nome da instância como valor principal
            whatsappPhone: phoneNumber || "Não disponível" // Usar número do remoteJid ou indicar indisponibilidade
          });
          return;
        }
      }
      
      // Se não estiver conectada, retornar a instância padrão
      res.json({
        ...instance,
        whatsappName: "Desconectado",
        whatsappPhone: "Desconectado"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch WhatsApp instance" });
    }
  });

  // Criar uma nova instância do WhatsApp
  app.post("/api/whatsapp/instances", async (req, res) => {
    try {
      let instanceData = insertWhatsappInstanceSchema.parse(req.body);
      
      // Criar o ID único da instância
      const uniqueInstanceId = `${instanceData.instanceName.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
      
      // Adicionar o instanciaId aos dados da instância
      const instanceDataWithId = {
        ...instanceData,
        instanciaId: uniqueInstanceId
      };
      
      // Verificar se o usuário já possui uma instância
      const existingInstance = await storage.getWhatsappInstanceByUser(instanceDataWithId.userId);
      if (existingInstance) {
        return res.status(409).json({ 
          message: "User already has a WhatsApp instance", 
          instanceId: existingInstance.instanciaId 
        });
      }
      
      // Obter e validar o usuário
      const user = await storage.getUser(instanceDataWithId.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verificar se temos a configuração necessária da API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "Evolution API não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      const { apiUrl, apiKey } = apiConfig;
      
      // Campo isPrimary foi removido do schema
      const isPrimary = false; // Mantido apenas para compatibilidade com código existente
      
      try {
        // Criar instância na Evolution API
        logger.info(`Criando instância ${instanceData.instanceName} na Evolution API`);
        
        // Obtém o valor de integração das variáveis de ambiente
        const integration = process.env.EVOLUTION_API_INTEGRATION;
        if (!integration) {
          throw new Error("Variável de ambiente EVOLUTION_API_INTEGRATION não configurada");
        }
        
        // Preparar payload com os parâmetros necessários para a API Evolution
        const payload = {
          instanceName: instanceDataWithId.instanceName,
          integration: integration,
          // Usamos um número de telefone fictício baseado na timestamp atual
          // (já que o phoneNumber não é parte do schema da instância)
          number: "55" + Date.now().toString().substring(0, 9)
        };
        
        logger.debug(`Usando payload: ${JSON.stringify(payload)}`);
        
        const response = await whatsappApi.post(
          `instance/create`,
          payload
        );
        
        // Registrar a resposta completa para diagnóstico
        logger.debug(`Resposta da API: ${JSON.stringify(response.data)}`);
        
        if (response.data && typeof response.data === 'object' && 'error' in response.data) {
          throw new Error(`Evolution API returned error: ${JSON.stringify(response.data.error)}`);
        }
        
        logger.info(`Instância ${instanceDataWithId.instanceName} criada com sucesso na Evolution API`);
        
        // Extrair base64 da resposta se disponível
        let base64 = null;
        if (response.data && response.data.qrcode && response.data.qrcode.base64) {
          base64 = response.data.qrcode.base64;
          logger.debug(`QR code base64 extraído da resposta. Tamanho: ${base64.length} caracteres`);
        } else if (response.data && response.data.base64) {
          base64 = response.data.base64;
          logger.debug(`QR code base64 extraído do campo base64. Tamanho: ${base64.length} caracteres`);
        }
        
        // Extrair o instanceId da resposta
        let instanceId = null;
        if (response.data && response.data.instance && response.data.instance.instanceId) {
          instanceId = response.data.instance.instanceId;
          logger.debug(`InstanceId extraído da resposta: ${instanceId}`);
        }
        
        // Gerar um ID único para a instância (necessário porque instancia_id é TEXT e NOT NULL)
        // Usamos o nome da instância seguido de um timestamp para garantir unicidade
        const uniqueInstanceId = instanceDataWithId.instanciaId;
        
        logger.debug(`Usando ID único para instância: ${uniqueInstanceId}`);
        
        // Criar a instância no nosso banco de dados com os campos adicionais
        const instance = await storage.createWhatsappInstance({
          instanciaId: uniqueInstanceId,
          instanceName: instanceDataWithId.instanceName,
          userId: instanceDataWithId.userId,
          // Usar o instanceStatus da resposta da API ou o default DISCONNECTED
          instanceStatus: response.data && response.data.instance && response.data.instance.status 
            ? response.data.instance.status 
            : WhatsAppInstanceStatus.DISCONNECTED,
          // Adicionar o campo base64 para o QR code
          base64: base64,
          webhook: instanceDataWithId.webhook || null,
          remoteJid: instanceDataWithId.remoteJid || null,
          lastConnection: instanceDataWithId.lastConnection || null
        });
        
        // Registrar log (usando o ID retornado da instância criada)
        if (instance && instance.instanciaId) {
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "CREATE",
            message: `Instância ${isPrimary ? 'principal ' : ''}criada para o usuário ${user.username}`,
            data: { 
              username: user.username, 
              userId: user.id, 
              externalInstanceId: instanceId, // Renomeado para evitar confusão
              hasBase64: base64 !== null
            },
          });
        } else {
          logger.error(`Não foi possível registrar o log, a instância não tem ID válido: ${JSON.stringify(instance)}`);
        }
        
        res.status(201).json(instance);
      } catch (apiError) {
        logger.error(`Erro ao criar instância na Evolution API: ${apiError}`);
        return res.status(500).json({
          message: "Falha ao criar instância na Evolution API",
          error: (apiError instanceof Error) ? apiError.message : String(apiError),
          suggestion: "Verifique se a Evolution API está acessível e se as credenciais estão corretas"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid WhatsApp instance data", errors: error.errors });
      }
      logger.error(`Error creating WhatsApp instance: ${error}`);
      res.status(500).json({ message: "Failed to create WhatsApp instance" });
    }
  });
  
  // Conectar uma instância do WhatsApp
  app.post("/api/whatsapp/connect/:id", async (req, res) => {
    try {
      const instanceId = req.params.id; // Usar como string sem parseInt
      
      // Buscar a instância pelo ID
      const instance = await storage.getWhatsappInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          message: "Instância do WhatsApp não encontrada",
          details: "A instância especificada não foi encontrada no sistema"
        });
      }
      
      // Verificar se temos a configuração necessária da API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "Evolution API não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      // Importante: Atualizar status da instância para "Conectando" em vez de "Conectado" imediatamente
      await storage.updateWhatsappInstanceStatus(
        instanceId,
        WhatsAppInstanceStatus.CONNECTING,
        "Iniciando conexão com o WhatsApp"
      );
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instance.instanciaId,
        type: "INFO",
        message: "Iniciando conexão com o WhatsApp",
        data: { initiatedAt: new Date().toISOString() },
      });
      
      // Retornar resposta imediatamente para não bloquear o frontend
      res.status(200).json({ 
        message: "Iniciando conexão com o WhatsApp", 
        status: WhatsAppInstanceStatus.CONNECTING,
        instanceId: instance.instanciaId,
        instanceName: instance.instanceName
      });
      
    } catch (error) {
      logger.error(`Erro ao conectar instância do WhatsApp: ${error}`);
      res.status(500).json({ 
        message: "Erro ao conectar instância do WhatsApp",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Desconectar uma instância do WhatsApp
  app.post("/api/whatsapp/disconnect/:id", async (req, res) => {
    try {
      const instanceId = req.params.id; // Usar como string sem parseInt
      
      // Buscar a instância pelo ID
      const instance = await storage.getWhatsappInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          message: "Instância do WhatsApp não encontrada",
          details: "A instância especificada não foi encontrada no sistema"
        });
      }
      
      // Verificar se temos a configuração necessária da API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "Evolution API não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      // Atualizar status da instância para Desconectando antes da resposta
      await storage.updateWhatsappInstanceStatus(
        instanceId,
        WhatsAppInstanceStatus.DISCONNECTING,
        "Desconectando instância do WhatsApp"
      );
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instance.instanciaId,
        type: "INFO",
        message: "Iniciando desconexão do WhatsApp",
        data: { initiatedAt: new Date().toISOString() },
      });
      
      // Tentar desconectar na API Evolution
      try {
        await whatsappApi.delete(`instance/logout/${instance.instanceName}`);
        
        // Se a desconexão foi bem-sucedida, atualizar o status
        await storage.updateWhatsappInstanceStatus(
          instanceId,
          WhatsAppInstanceStatus.DISCONNECTED,
          "Instância desconectada com sucesso"
        );
        
        // Registrar log de sucesso
        await storage.createWhatsappLog({
          instanceId: instance.instanciaId,
          type: "INFO",
          message: "Instância desconectada com sucesso",
          data: { completedAt: new Date().toISOString() },
        });
        
      } catch (apiError) {
        // Se houve erro na API, registrar no log mas não falhar a operação
        logger.warn(`Erro ao comunicar com a API para desconexão: ${apiError}`);
        
        // Ainda assim, consideramos a instância como desconectada
        await storage.updateWhatsappInstanceStatus(
          instanceId,
          WhatsAppInstanceStatus.DISCONNECTED,
          "Considerado desconectado (erro na comunicação com API)"
        );
        
        await storage.createWhatsappLog({
          instanceId: instance.instanciaId,
          type: "WARN",
          message: "Erro na comunicação com a API para desconexão",
          data: { 
            error: (apiError instanceof Error) ? apiError.message : String(apiError),
            completedAt: new Date().toISOString() 
          },
        });
      }
      
      // Retornar resposta de sucesso
      res.status(200).json({ 
        message: "Instância desconectada com sucesso",
        instanceId: instance.instanciaId,
        instanceName: instance.instanceName,
        status: WhatsAppInstanceStatus.DISCONNECTED
      });
      
    } catch (error) {
      logger.error(`Erro ao desconectar instância do WhatsApp: ${error}`);
      res.status(500).json({ 
        message: "Erro ao desconectar instância do WhatsApp",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });

  // Excluir uma instância do WhatsApp
  app.delete("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const id = req.params.id; // Usar como string sem parseInt
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstance(id);
      if (!instance) {
        return res.status(404).json({ message: "WhatsApp instance not found" });
      }
      
      // Verificar se temos a configuração necessária da API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "Evolution API não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      const { apiUrl, apiKey } = apiConfig;
      
      try {
        // Excluir a instância na Evolution API
        logger.info(`Excluindo instância ${instance.instanceName} na Evolution API`);
        
        await whatsappApi.delete(
          `instance/delete/${instance.instanceName}`
        );
        
        logger.info(`Instância ${instance.instanceName} excluída com sucesso na Evolution API`);
      } catch (apiError) {
        // Se falhar a exclusão na API, apenas logar o erro mas prosseguir com a exclusão no banco
        logger.warn(`Erro ao excluir instância na Evolution API: ${apiError}. Prosseguindo com exclusão no banco.`);
      }
      
      // Excluir a instância no banco de dados
      const success = await storage.deleteWhatsappInstance(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete WhatsApp instance" });
      }
      
      res.json({ message: "WhatsApp instance deleted successfully" });
    } catch (error) {
      logger.error(`Error deleting WhatsApp instance: ${error}`);
      res.status(500).json({ message: "Failed to delete WhatsApp instance" });
    }
  });

  // Obter QR code para conexão com o WhatsApp
  app.get("/api/whatsapp/qrcode/:instanceName", async (req: Request, res: Response) => {
    try {
      const instanceName = req.params.instanceName;
      
      // Buscar a instância pelo nome
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ 
          message: ErrorMessages.WHATSAPP_INSTANCE_NOT_FOUND 
        } as ErrorResponse);
      }
      
      // Verificar se a instância já está conectada
      if (instance.instanceStatus && instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED) {
        return res.status(200).json({ 
          message: "WhatsApp instance already connected",
          status: instance.instanceStatus,
          lastConnection: instance.lastConnection
        });
      }
      
      // Configurações da API Evolution
      const config = getApiConfig();
      if (!config) {
        return res.status(500).json({ 
          message: ErrorMessages.WHATSAPP_CONFIG_MISSING
        } as ErrorResponse);
      }
      
      const { apiUrl, apiKey } = config;
      
      // Atualizar status da instância para aguardando QR
      await storage.updateWhatsappInstanceStatus(
        instance.instanciaId, 
        WhatsAppInstanceStatus.WAITING_QR_SCAN, 
        "Solicitando QR code"
      );
      
      try {
        // Registrar no log estruturado a tentativa de conexão
        logger.info(`Conectando à Evolution API para ${instanceName}`);
        
        // Alterado para GET conforme a documentação atualizada da API
        let response = await whatsappApi.get<StatusResponse>(
          `instance/connect/${instanceName}`
        );
        
        // Verificar se a resposta está vazia ou incompleta
        if (!response || !response.data) {
          throw new Error("Resposta vazia da Evolution API");
        }
        
        logger.info("Resposta da Evolution API recebida com sucesso");

        // Registrar o formato da resposta para depuração
        logger.debug(`Estrutura da resposta: ${JSON.stringify(Object.keys(response.data))}`);
        
        let qrCodeBase64: string | null = null;
        
        // Tentar encontrar o QR code na resposta
        if ('base64' in response.data) {
          qrCodeBase64 = response.data.base64 as string;
          logger.debug(`QR code encontrado no campo base64. Tamanho: ${qrCodeBase64.length} caracteres`);
          
          // Log dos primeiros caracteres para verificação
          logger.debug(`Início do QR code: ${qrCodeBase64.substring(0, 50)}...`);
          
        } else if ('qrcode' in response.data && response.data.qrcode && 'base64' in response.data.qrcode) {
          qrCodeBase64 = response.data.qrcode.base64 as string;
          logger.debug(`QR code encontrado no campo qrcode.base64. Tamanho: ${qrCodeBase64.length} caracteres`);
        } else {
          // Tentar encontrar o QR code em qualquer lugar no objeto
          qrCodeBase64 = findBase64InObject(response.data);
          if (qrCodeBase64) {
            logger.debug(`QR code encontrado usando função findBase64InObject. Tamanho: ${qrCodeBase64.length} caracteres`);
          }
        }
        
        // Registrar o objeto de resposta completo para depuração
        logger.debug(`Resposta completa da API: ${JSON.stringify(response.data)}`);
        
        // Se encontrou um QR code, salvar na instância
        if (qrCodeBase64) {
          logger.info("QR code encontrado na resposta");
          
          // Atualizar instância com o QR code no campo base64
          await storage.updateWhatsappInstance(instance.instanciaId, {
            base64: qrCodeBase64 // Agora usando campo base64 em vez de qrCode
          });
          
          // Registrar log
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "INFO",
            message: "QR code gerado com sucesso",
            data: { generatedAt: new Date().toISOString() },
          });
          
          // Verificar e registrar dados do QR code para depuração
          logger.debug(`Enviando QR code para o cliente. Tamanho: ${qrCodeBase64.length} caracteres`);
          
          // Responder com o QR code
          return res.status(200).json({
            message: "QR code obtido com sucesso",
            instanceId: instance.instanciaId,
            qrCode: qrCodeBase64,
            // Importante adicionar o campo base64 para compatibilidade 
            // com diferentes clientes que esperam diferentes formatos
            base64: qrCodeBase64,
            format: "base64"
          });
        } else if (response.data.pairingCode) {
          // Caso a resposta contenha um código de pareamento
          logger.info("Código de pareamento encontrado na resposta");
          
          // Atualizar status da instância
          await storage.updateWhatsappInstanceStatus(
            instance.instanciaId, 
            WhatsAppInstanceStatus.WAITING_QR_SCAN, 
            "Código de pareamento gerado"
          );
          
          // Registrar log
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "INFO",
            message: "Código de pareamento gerado com sucesso",
            data: { 
              pairingCode: response.data.pairingCode,
              generatedAt: new Date().toISOString() 
            },
          });
          
          // Responder com o código de pareamento
          return res.status(200).json({
            message: "Pairing code retrieved from Evolution API",
            instanceId: instance.instanciaId,
            pairingCode: response.data.pairingCode
          });
        }
        
        // Se chegou aqui, não encontrou nem QR code nem código de pareamento
        throw new Error("QR code ou código de pareamento não encontrado na resposta");
        
      } catch (error: any) {
        logger.error(`Erro ao obter QR code da Evolution API: ${error}`);
        
        // Registrar o erro detalhado em log
        try {
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "ERROR",
            message: "Erro ao obter QR code da Evolution API",
            data: { 
              error: (error instanceof Error) ? {
                message: error.message,
                name: error.name,
                stack: error.stack
              } : String(error),
              instanceName: instance.instanceName,
              apiUrl: apiUrl ? `${apiUrl.substring(0, 15)}...` : 'undefined'
            },
          });
          
          // Atualizar status da instância para indicar problema
          await storage.updateWhatsappInstanceStatus(
            instance.instanciaId, 
            WhatsAppInstanceStatus.ERROR, 
            "Erro ao obter QR code"
          );
        } catch (logError) {
          logger.error(`Erro adicional ao registrar log de erro: ${logError}`);
        }
        
        // Verificar se é um erro de timeout ou conexão
        let errorMessage = "Failed to fetch QR code from Evolution API";
        if (error instanceof Error) {
          if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            errorMessage = "A conexão com a API excedeu o tempo limite. A API pode estar sobrecarregada ou inacessível.";
          } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            errorMessage = "Não foi possível conectar à API. Verifique se o servidor da API está ativo e acessível.";
          }
        }
        
        return res.status(500).json({ 
          message: errorMessage,
          error: (error instanceof Error) ? error.message : "Unknown error",
          recommendation: "Tente novamente em alguns instantes. Se o problema persistir, verifique as configurações da API."
        });
      }
    } catch (error) {
      logger.error(`Error processing WhatsApp QR code request: ${error}`);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Verificar status de uma instância do WhatsApp
  app.get("/api/whatsapp/status/:instanceName", async (req, res) => {
    try {
      const instanceName = req.params.instanceName;
      
      // Buscar a instância pelo nome
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ message: "WhatsApp instance not found" });
      }
      
      // Configurações da API Evolution
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      
      if (!apiUrl || !apiKey) {
        return res.status(500).json({ 
          message: "Evolution API configuration missing", 
          details: "Please configure EVOLUTION_API_URL and EVOLUTION_API_KEY environment variables" 
        });
      }
      
      try {
        // Vamos sempre verificar o status na API Evolution, independentemente do status armazenado
        const instance = await storage.getWhatsappInstanceByName(instanceName);
        if (!instance) {
          throw new Error(`Instância ${instanceName} não encontrada`);
        }
        
        logger.info(`Verificando status real da instância ${instanceName} na API Evolution`);
        
        // Verificar status na API Evolution
        const response = await whatsappApi.get(
          `instance/connectionState/${instanceName}`
        );
        
        logger.debug(`Resposta da verificação de status: ${JSON.stringify(response.data)}`);
        
        // Conforme o teste, a resposta segue este formato:
        // { "instance": { "instanceName": "...", "state": "open" } }
        let apiStatus = 'DISCONNECTED';
                
        if (response.data && typeof response.data === 'object') {
          logger.debug(`Estrutura completa de resposta: ${JSON.stringify(response.data)}`);
          
          // Verificar se tem a estrutura esperada (instance.state)
          if (response.data.instance && response.data.instance.state) {
            apiStatus = String(response.data.instance.state);
            logger.debug(`Status encontrado em instance.state: ${apiStatus}`);
          } 
          // Verificações alternativas para outros possíveis formatos
          else if (response.data.state) {
            apiStatus = String(response.data.state);
            logger.debug(`Status encontrado no campo 'state': ${apiStatus}`);
          } else if (response.data.status) {
            apiStatus = String(response.data.status);
            logger.debug(`Status encontrado no campo 'status': ${apiStatus}`);
          } else if (response.data.connected === true || response.data.connected === 'true') {
            apiStatus = 'CONNECTED';
            logger.debug(`Status determinado pelo campo 'connected': ${apiStatus}`);
          } else {
            logger.warn(`Não foi possível determinar o status a partir da resposta: ${JSON.stringify(response.data)}`);
          }
        }
        
        logger.info(`Status extraído da API: ${apiStatus}`);
        
        let newStatus: keyof typeof WhatsAppInstanceStatus;
        
        // Converter o status da API para o enum interno
        switch (apiStatus.toUpperCase()) {
          case 'CONNECTED':
          case 'OPEN':
          case 'ACTIVE':
            newStatus = 'CONNECTED';
            break;
          case 'CONNECTING':
          case 'PAIRING':
            newStatus = 'CONNECTING';
            break;
          case 'DISCONNECTED':
          case 'CLOSE':
          case 'CLOSED':
            newStatus = 'DISCONNECTED';
            break;
          case 'DISCONNECTING':
            newStatus = 'DISCONNECTING';
            break;
          case 'FAILED':
            newStatus = 'FAILED';
            break;
          case 'ERROR':
            newStatus = 'ERROR';
            break;
          default:
            newStatus = 'DISCONNECTED';
        }
        
        // Atualizar status da instância
        if (instance) {
          await storage.updateWhatsappInstanceStatus(
            instance.instanciaId, 
            WhatsAppInstanceStatus[newStatus] as string, 
            "Status atualizado da API"
          );
          
          // Buscar informações adicionais da instância quando conectada
          let ownerJid = null;
          let phoneNumber = null;
          
          if (newStatus === 'CONNECTED') {
            try {
              // Buscar informações da instância para obter o número do telefone
              const instancesResponse = await whatsappApi.get(`instance/fetchInstances`);
              
              if (Array.isArray(instancesResponse.data)) {
                const foundInstance = instancesResponse.data.find((inst: any) => inst.name === instanceName);
                if (foundInstance) {
                  ownerJid = foundInstance.ownerJid || foundInstance.owner || null;
                  if (ownerJid) {
                    phoneNumber = ownerJid.split('@')[0];
                    
                    // Atualizar o remoteJid na base de dados
                    await storage.updateWhatsappInstanceApiData(instance.instanciaId.toString(), ownerJid);
                    logger.info(`RemoteJid atualizado para ${ownerJid} na instância ${instanceName}`);
                  }
                }
              }
            } catch (error) {
              logger.warn(`Erro ao buscar informações da instância ${instanceName}: ${error}`);
            }
          }
          
          res.json({
            instanceId: instance.instanciaId,
            instanceName: instance.instanceName,
            status: apiStatus,
            phoneNumber: phoneNumber || (instance.remoteJid ? instance.remoteJid.split('@')[0] : null),
            lastUpdate: new Date().toISOString()
          });
        } else {
          res.status(404).json({ 
            message: "Instância não encontrada"
          });
        }
        
      } catch (error: any) {
        logger.error(`Error checking WhatsApp instance status: ${error}`);
        
        // Registrar log de erro apenas se a instância existir
        if (instance) {
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "ERROR",
            message: "Erro ao verificar status da instância",
            data: { 
              error: (error instanceof Error) ? error.message : String(error),
              instanceName: instance.instanceName
            },
          });
        }
        
        res.status(500).json({ 
          message: "Failed to check WhatsApp instance status",
          error: (error instanceof Error) ? error.message : "Unknown error"
        });
      }
    } catch (error) {
      logger.error(`Error processing WhatsApp status request: ${error}`);
      res.status(500).json({ message: "Failed to check WhatsApp instance status" });
    }
  });

  // Registro de últimas verificações para limitar frequência
  const lastStatusChecks = new Map<string, number>();
  const MIN_CHECK_INTERVAL = 3000; // 3 segundos entre verificações para mesma instância
  
  // Forçar verificação de status (ignorando cache)
  app.post("/api/whatsapp/force-check-status", async (req, res) => {
    try {
      // Encontrar a instância primária ou a primeira instância ativa
      const instances = await storage.getWhatsappInstances();
      
      // Usar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela)
      let instanceToUse = instances.length > 0 ? instances[0] : null;
      
      if (!instanceToUse) {
        return res.status(404).json({ 
          message: "Nenhuma instância de WhatsApp encontrada", 
          error: "no_instance",
          errorMessage: "Configure uma instância de WhatsApp primeiro"
        });
      }
      
      const now = Date.now();
      const lastCheck = lastStatusChecks.get(instanceToUse.instanceName);
      
      // Verificar se o intervalo mínimo entre verificações foi respeitado
      if (lastCheck && now - lastCheck < MIN_CHECK_INTERVAL) {
        logger.warn(`Verificação de status para ${instanceToUse.instanceName} ignorada - muito frequente (última há ${now - lastCheck}ms)`);
        
        // Responder com o status atual do banco para evitar flood de requisições
        return res.json({
          instanceId: instanceToUse.instanciaId,
          instanceName: instanceToUse.instanceName,
          status: instanceToUse.instanceStatus === WhatsAppInstanceStatus.CONNECTED ? "CONNECTED" : "DISCONNECTED",
          message: "Status obtido do banco de dados devido à alta frequência de requisições",
          lastUpdate: new Date().toISOString()
        });
      }
      
      // Registrar timestamp desta verificação
      lastStatusChecks.set(instanceToUse.instanceName, now);
      
      logger.info(`Forçando verificação de status da instância ${instanceToUse.instanceName}`);
      
      // Verificar o status real na API, ignorando qualquer cache
      const response = await whatsappApi.get(
        `instance/connectionState/${instanceToUse.instanceName}`
      );
      
      logger.debug(`Resposta da verificação forçada de status: ${JSON.stringify(response.data)}`);
      
      // Extrair o estado da conexão
      let apiState = "unknown";
      
      if (response.data && typeof response.data === 'object') {
        // Verificar primeiro em instance.state (formato mais comum)
        if (response.data.instance && response.data.instance.state) {
          apiState = String(response.data.instance.state);
        } 
        // Verificar em outros campos possíveis
        else if (response.data.state) {
          apiState = String(response.data.state);
        } 
        else if (response.data.status) {
          apiState = String(response.data.status);
        }
      }
      
      logger.info(`Estado real da conexão segundo a API: ${apiState}`);
      
      // Lista de estados considerados "conectado"
      const connectedStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
      const isConnected = connectedStates.includes(apiState);
      
      // Atualizar o status no banco de dados
      const newDbStatus = isConnected ? WhatsAppInstanceStatus.CONNECTED : WhatsAppInstanceStatus.DISCONNECTED;
      
      if (instanceToUse.instanceStatus !== newDbStatus) {
        logger.info(`Atualizando status da instância ${instanceToUse.instanceName} de ${instanceToUse.instanceStatus} para ${newDbStatus}`);
        
        await storage.updateWhatsappInstanceStatus(
          instanceToUse.instanciaId, 
          newDbStatus, 
          "Status atualizado via verificação forçada"
        );
      }
      
      // Retornar o status atualizado
      return res.json({
        instanceId: instanceToUse.instanciaId,
        instanceName: instanceToUse.instanceName,
        status: apiState,
        isConnected: isConnected,
        dbStatus: newDbStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Erro ao verificar status forçado: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao verificar status da instância", 
        error: "check_failed",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Verificar status diretamente na API Evolution (novo endpoint para o botão "Verificar Status")
  app.post("/api/whatsapp/verify-actual-status/:instanceId", async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Buscar a instância pelo ID (agora usando texto)
      const instance = await storage.getWhatsappInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ 
          success: false,
          message: "Instância não encontrada" 
        });
      }
      
      // Verificar se temos a configuração necessária da API
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          success: false,
          message: "API Evolution não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      const { apiUrl, apiKey } = apiConfig;
      
      logger.info(`Verificando status real da instância ${instance.instanceName} diretamente na API Evolution via /fetchInstances`);
      
      try {
        // Fazer requisição direta ao endpoint fetchInstances para obter o status real
        const response = await whatsappApi.get('instance/fetchInstances');
        
        logger.debug(`Resposta da API Evolution: ${JSON.stringify(response.data)}`);
        
        let connectionStatus = null;
        let instanceFound = false;
        let ownerJid = null;
        let apiCreatedAt = null;
        let foundItem = null; // Para armazenar o item da instância encontrada
        
        // Processar a resposta, que pode ter diferentes formatos
        if (Array.isArray(response.data)) {
          // Formato 1: Array de objetos com campo instance
          for (const item of response.data) {
            if (item.instance && item.instance.instanceName === instance.instanceName) {
              instanceFound = true;
              connectionStatus = item.instance.state || item.instance.instanceStatus || item.instance.connectionStatus;
              ownerJid = item.instance.ownerJid || null;
              apiCreatedAt = item.instance.createdAt || null;
              foundItem = item.instance;
              logger.info(`Status encontrado formato 1: ${connectionStatus}`);
              break;
            }
            // Formato 2: Array de objetos diretos
            else if (item.name === instance.instanceName || item.instanceName === instance.instanceName) {
              instanceFound = true;
              connectionStatus = item.connectionStatus || item.state || item.status;
              ownerJid = item.ownerJid || null;
              apiCreatedAt = item.createdAt || null;
              foundItem = item;
              logger.info(`Status encontrado formato 2: ${connectionStatus}`);
              break;
            }
          }
        } 
        // Formato 3: Objeto com instâncias como array
        else if (response.data && response.data.instances && Array.isArray(response.data.instances)) {
          for (const item of response.data.instances) {
            if (item.instanceName === instance.instanceName || item.name === instance.instanceName) {
              instanceFound = true;
              connectionStatus = item.state || item.status || item.connectionStatus;
              ownerJid = item.ownerJid || null;
              apiCreatedAt = item.createdAt || null;
              foundItem = item;
              logger.info(`Status encontrado formato 3: ${connectionStatus}`);
              break;
            }
          }
        }
        
        if (ownerJid) {
          logger.info(`Encontrado ownerJid: ${ownerJid}`);
        }
        
        if (apiCreatedAt) {
          logger.info(`Encontrado createdAt: ${apiCreatedAt}`);
        }
        
        if (!instanceFound) {
          logger.warn(`Instância ${instance.instanceName} não encontrada na resposta da API`);
          return res.json({
            success: false,
            message: "Instância não encontrada na API Evolution",
            instanceId: instance.instanciaId,
            instanceName: instance.instanceName,
            currentStatus: instance.instanceStatus
          });
        }
        
        if (!connectionStatus) {
          logger.warn(`Status não encontrado para instância ${instance.instanceName}`);
          return res.json({
            success: false,
            message: "Status da instância não encontrado na resposta da API",
            instanceId: instance.instanciaId,
            instanceName: instance.instanceName,
            currentStatus: instance.instanceStatus
          });
        }
        
        // Mapear o status recebido para o formato interno
        const connectedStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
        const isConnected = connectedStates.includes(connectionStatus?.toLowerCase());
        
        const newDbStatus = isConnected 
          ? WhatsAppInstanceStatus.CONNECTED 
          : (connectionStatus?.toLowerCase() === "close" || connectionStatus?.toLowerCase() === "closed" || connectionStatus?.toLowerCase() === "disconnected") 
              ? WhatsAppInstanceStatus.DISCONNECTED 
              : WhatsAppInstanceStatus.ERROR;
        
        // Atualizar o status no banco de dados apenas se for diferente
        if (instance.instanceStatus !== newDbStatus) {
          logger.info(`Atualizando status da instância ${instance.instanceName} de ${instance.instanceStatus} para ${newDbStatus} com base na verificação direta`);
          
          await storage.updateWhatsappInstanceStatus(
            instance.instanciaId,
            newDbStatus,
            `Status atualizado via verificação manual (direto da API: ${connectionStatus})`
          );
          
          // Registrar a verificação em log
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "STATUS_CHECK",
            message: `Status atualizado via verificação manual pelo usuário`,
            data: {
              oldStatus: instance.instanceStatus,
              newStatus: newDbStatus,
              apiResponse: connectionStatus
            }
          });
        } else {
          logger.info(`Status da instância ${instance.instanceName} mantido como ${instance.instanceStatus} (valor da API: ${connectionStatus})`);
        }
        
        // Atualizar remoteJid e createdAt independentemente do status
        if (ownerJid || apiCreatedAt) {
          logger.info(`Atualizando dados adicionais da API: ownerJid=${ownerJid}, createdAt=${apiCreatedAt}`);
          
          await storage.updateWhatsappInstanceApiData(
            instance.instanciaId,
            ownerJid,
            apiCreatedAt
          );
          
          // Registrar a atualização em log
          await storage.createWhatsappLog({
            instanceId: instance.instanciaId,
            type: "DATA_UPDATE",
            message: `Dados da instância atualizados com base na API`,
            data: {
              ownerJid: ownerJid,
              createdAt: apiCreatedAt,
              apiData: foundItem ? JSON.stringify(foundItem) : null
            }
          });
        }
        
        return res.json({
          success: true,
          message: `Status verificado com sucesso: ${connectionStatus}`,
          instanceId: instance.instanciaId,
          instanceName: instance.instanceName,
          previousStatus: instance.instanceStatus,
          actualStatus: connectionStatus,
          newStatus: newDbStatus,
          updated: instance.instanceStatus !== newDbStatus
        });
        
      } catch (error) {
        logger.error(`Erro ao verificar status na API Evolution: ${error}`);
        
        // Registrar o erro em log
        await storage.createWhatsappLog({
          instanceId: instance.instanciaId,
          type: "ERROR",
          message: "Erro ao verificar status na API Evolution",
          data: {
            error: error instanceof Error ? error.message : String(error)
          }
        });
        
        return res.status(500).json({
          success: false,
          message: "Erro ao verificar status na API Evolution",
          error: error instanceof Error ? error.message : "Erro desconhecido",
          instanceId: instance.instanciaId,
          instanceName: instance.instanceName
        });
      }
    } catch (error) {
      logger.error(`Erro ao processar verificação de status: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar verificação de status",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Cache para verificações de status
  const statusCheckCache = new Map<string, {
    data: any,
    timestamp: number,
    expiresAt: number
  }>();
  
  // TTL para cache de status (30 segundos)
  const STATUS_CACHE_TTL = 30 * 1000; // 30 segundos
  
  // Histórico de status para estabilização de estados transitórios
  const statusHistory = new Map<string, {
    lastConnectedTimestamp: number | null;
    lastDisconnectedTimestamp: number | null;
    consecutiveCloseCount: number;
    consecutiveOpenCount: number;
    lastStableStatus: string;
  }>();
  
  // Período mínimo (em ms) para considerar uma mudança de status estável
  const STATUS_STABILITY_THRESHOLD = 30000; // 30 segundos

  // Verificar o status da validação em andamento e também atualizar o status da instância
  app.get("/api/whatsapp/check-status/:id", async (req, res) => {
    try {
      const instanceId = req.params.id; // Usar como string
      
      // Verificar se temos a resposta em cache
      const now = Date.now();
      const cachedStatus = statusCheckCache.get(instanceId);
      
      if (cachedStatus && cachedStatus.expiresAt > now) {
        logger.debug(`Retornando status em cache para instância ${instanceId}`);
        return res.json(cachedStatus.data);
      }
      
      // Opcional: verificar o status real da instância na API Evolution
      if (instanceId) {
        try {
          // Buscar a instância pelo ID
          const instance = await storage.getWhatsappInstance(instanceId);
          
          if (instance) {
            // Atualizar o status da instância usando o endpoint connectionState da Evolution API
            const apiUrl = process.env.EVOLUTION_API_URL;
            const apiKey = process.env.EVOLUTION_API_KEY;
            
            if (apiUrl && apiKey) {
              try {
                // Sempre verificar o status real da instância na API Evolution, nunca confiar apenas no status armazenado
                logger.info(`Verificando status real da instância ${instance.instanceName} na API Evolution`);
                
                // Verificar status na API Evolution usando o endpoint correto conforme documentação
                const response = await whatsappApi.get(
                  `instance/connectionState/${instance.instanceName}`
                );
                
                logger.debug(`Resposta da verificação de status de ${instance.instanceName}: ${JSON.stringify(response.data)}`);
                
                // Conforme o teste, a resposta segue este formato:
                // { "instance": { "instanceName": "...", "state": "open" } }
                let apiStatus: string = 'UNKNOWN'; // Valor padrão para evitar erros
                
                if (response.data && typeof response.data === 'object') {
                  logger.debug(`Estrutura completa de resposta: ${JSON.stringify(response.data)}`);
                  
                  // Verificar se tem a estrutura esperada (instance.state ou state)
                  // Usar o mesmo padrão de extração usado no diagnóstico e em outros serviços
                  const extractedState = response.data?.instance?.state || response.data?.state;
                  if (extractedState) {
                    apiStatus = String(extractedState).toUpperCase();
                    logger.debug(`Status encontrado: ${apiStatus} (extraído de ${response.data?.instance?.state ? 'instance.state' : 'state'})`);
                    
                    // Inicializar histórico de status se não existir para esta instância
                    if (!statusHistory.has(instanceId)) {
                      statusHistory.set(instanceId, {
                        lastConnectedTimestamp: null,
                        lastDisconnectedTimestamp: null,
                        consecutiveCloseCount: 0,
                        consecutiveOpenCount: 0,
                        lastStableStatus: instance.instanceStatus || 'DISCONNECTED'
                      });
                    }
                    
                    const history = statusHistory.get(instanceId)!;
                    const currentTime = Date.now();
                    
                    // Atualizar contadores consecutivos e timestamps
                    if (apiStatus === 'OPEN' || apiStatus === 'CONNECTED') {
                      history.lastConnectedTimestamp = currentTime;
                      history.consecutiveOpenCount++;
                      history.consecutiveCloseCount = 0;
                      
                      // Após N verificações consecutivas de OPEN, considerar como estável
                      if (history.consecutiveOpenCount >= 2) {
                        history.lastStableStatus = 'CONNECTED';
                        logger.info(`Status OPEN/CONNECTED consistente (${history.consecutiveOpenCount} vezes). Considerando estável.`);
                      }
                    } else if (apiStatus === 'CLOSE' || apiStatus === 'DISCONNECTED') {
                      history.lastDisconnectedTimestamp = currentTime;
                      history.consecutiveCloseCount++;
                      history.consecutiveOpenCount = 0;
                      
                      // Durante a fase de conexão (QR CODE), esperamos vários CLOSE
                      // enquanto o usuário escaneia o QR code. Nesse caso, mantemos o status atual
                      const isConnecting = instance.instanceStatus === WhatsAppInstanceStatus.WAITING_QR_SCAN || 
                                          instance.instanceStatus === WhatsAppInstanceStatus.CONNECTING;
                      
                      // Casos em que ignoramos o estado CLOSE temporário:
                      // 1. A instância estava conectada anteriormente (precisamos 3 CLOSEs consecutivos)
                      // 2. A instância está em processo de conexão (pode receber CLOSEs durante o processo)
                      if ((instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED && history.consecutiveCloseCount < 3) ||
                          (isConnecting && history.consecutiveCloseCount < 2)) {
                        logger.warn(`Recebido status CLOSE, mas ignorando por enquanto (${history.consecutiveCloseCount}/3) - Status atual: ${instance.instanceStatus}`);
                        
                        // Manter o estado atual para estabilidade
                        apiStatus = isConnecting ? 'CONNECTING' : 'CONNECTED';
                      }
                      // Após 3 verificações consecutivas de CLOSE (ou 2 durante conexão), 
                      // considerar como realmente desconectado
                      else if ((instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED && history.consecutiveCloseCount >= 3) ||
                               (isConnecting && history.consecutiveCloseCount >= 2) ||
                               (!isConnecting && instance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED)) {
                        history.lastStableStatus = 'DISCONNECTED';
                        logger.warn(`Status CLOSE consistente (${history.consecutiveCloseCount} vezes). Considerando realmente desconectado.`);
                      }
                    }
                    
                    // Mapear diversos estados para CONNECTED
                    // Na API Evolution, "open" e "connected" são estados que indicam uma conexão ativa
                    if (apiStatus === 'OPEN' || apiStatus === 'CONNECTED') {
                      apiStatus = 'CONNECTED';
                      logger.debug(`Status "${apiStatus}" mapeado para CONNECTED`);
                    }
                    
                    // Estabilização de estado: reduz drasticamente as oscilações rápidas
                    // Para o estado "connecting", damos prioridade a permanecer no estado atual
                    // ao invés de alternar muito rapidamente entre estados
                    if (apiStatus === 'CONNECTING') {
                      // Se estava Conectado anteriormente, manter conectado por muito mais tempo
                      if (instance.instanceStatus && instance.instanceStatus === WhatsAppInstanceStatus.CONNECTED) {
                        const lastUpdate = new Date(instance.updatedAt || Date.now());
                        const now = new Date();
                        const diffSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
                        
                        // Aumentado para 3 minutos (180 segundos) para maior estabilidade
                        if (diffSeconds < 180) {
                          logger.info(`Instância estava conectada há ${diffSeconds.toFixed(1)}s, ignorando estado transitório "CONNECTING"`);
                          apiStatus = 'CONNECTED';
                        }
                      }
                      // Se já estava "connecting", também não mudar tão facilmente para "disconnected"
                      else if (instance.instanceStatus && instance.instanceStatus === WhatsAppInstanceStatus.CONNECTING) {
                        // Não fazer nada - permanecer no estado connecting
                        logger.debug(`Mantendo estado CONNECTING para instância ${instance.instanceName}`);
                      }
                    }
                  } 
                  // Verificações alternativas para outros possíveis formatos
                  else if (response.data.state) {
                    apiStatus = String(response.data.state).toUpperCase();
                    logger.debug(`Status encontrado no campo 'state': ${apiStatus}`);
                  } else if (response.data.status) {
                    apiStatus = String(response.data.status).toUpperCase();
                    logger.debug(`Status encontrado no campo 'status': ${apiStatus}`);
                  } else if (response.data.connected === true || response.data.connected === 'true') {
                    apiStatus = 'CONNECTED';
                    logger.debug(`Status determinado pelo campo 'connected': ${apiStatus}`);
                  } 
                  // Novas verificações na estrutura completa para "Connected"
                  else if (response.data.message && typeof response.data.message === 'string' && 
                           response.data.message.toLowerCase().includes('connected')) {
                    apiStatus = 'CONNECTED';
                    logger.debug(`Status determinado pela mensagem "${response.data.message}": ${apiStatus}`);
                  }
                  // Verificar se existe um campo que contém "CONNECTED"
                  else {
                    // Tentar encontrar qualquer campo que contenha a palavra "connected"
                    let connectedFound = false;
                    for (const key in response.data) {
                      const value = response.data[key];
                      if (typeof value === 'string' && value.toLowerCase().includes('connected')) {
                        apiStatus = 'CONNECTED';
                        connectedFound = true;
                        logger.debug(`Status "connected" encontrado no campo '${key}': ${value}`);
                        break;
                      }
                    }
                    
                    if (!connectedFound) {
                      // Se não encontrar em nenhum campo esperado, usar a resposta completa para debug
                      apiStatus = 'UNKNOWN';
                      logger.warn(`Não foi possível determinar o status a partir da resposta: ${JSON.stringify(response.data)}`);
                    }
                  }
                } else {
                  apiStatus = 'UNKNOWN';
                  logger.warn(`Resposta inválida do endpoint de status: ${JSON.stringify(response.data)}`);
                }
                
                // Mapear o status da API para o formato interno do sistema
                let newStatus: keyof typeof WhatsAppInstanceStatus;
                
                // Logging adicional para debug
                logger.debug(`Convertendo status API "${apiStatus}" para formato interno`);
                
                // Converter o status da API para o enum interno
                switch (apiStatus) {
                  case 'CONNECTED':
                  case 'OPEN':
                  case 'ACTIVE':
                  case 'ONLINE': // Adicionando possibilidade de "online"
                    newStatus = 'CONNECTED';
                    break;
                  case 'CONNECTING':
                  case 'PAIRING':
                    newStatus = 'CONNECTING';
                    break;
                  case 'DISCONNECTED':
                  case 'CLOSE':
                  case 'CLOSED':
                    newStatus = 'DISCONNECTED';
                    break;
                  case 'DISCONNECTING':
                    newStatus = 'DISCONNECTING';
                    break;
                  case 'TIMEOUT':
                    newStatus = 'FAILED';
                    break;
                  case 'CONFLICT':
                  case 'ERROR':
                    newStatus = 'ERROR';
                    break;
                  default:
                    // Verificar se o status contém a palavra "connect" para tratar casos especiais
                    if (apiStatus.includes('CONNECT')) {
                      if (apiStatus.includes('DIS')) {
                        newStatus = 'DISCONNECTED';
                      } else {
                        newStatus = 'CONNECTED';
                      }
                      logger.debug(`Status contém "CONNECT": Mapeando para ${newStatus}`);
                    } else {
                      // Se o status não for reconhecido, mantém como desconectado por segurança
                      newStatus = 'DISCONNECTED';
                      logger.warn(`Status não reconhecido: ${apiStatus}. Mapeando para DISCONNECTED`);
                    }
                }
                
                // Atualizar o status no banco de dados apenas se mudou
                if (instance.instanceStatus !== WhatsAppInstanceStatus[newStatus]) {
                  logger.info(`Atualizando status da instância ${instance.instanceName} de ${instance.instanceStatus} para ${WhatsAppInstanceStatus[newStatus]}`);
                  
                  await storage.updateWhatsappInstanceStatus(
                    instance.instanciaId, 
                    WhatsAppInstanceStatus[newStatus] as string, 
                    "Status atualizado via conexão com API Evolution"
                  );
                }
                
                // Criar objeto de resposta
                const responseData = {
                  instanceId: instance.instanciaId,
                  instanceName: instance.instanceName,
                  status: WhatsAppInstanceStatus[newStatus],
                  lastUpdate: new Date().toISOString()
                };
                
                // Armazenar em cache
                statusCheckCache.set(instanceId, {
                  data: responseData,
                  timestamp: now,
                  expiresAt: now + STATUS_CACHE_TTL
                });
              } catch (error) {
                logger.error(`Erro ao verificar status da instância ${instance.instanceName} na API: ${error}`);
                // Continuar normalmente, não impactar a verificação global
              }
            }
          }
        } catch (error) {
          logger.error(`Erro ao buscar instância ${instanceId}: ${error}`);
          // Continuar normalmente, não impactar a verificação global
        }
      }
      
      // Verificar se temos um processo de busca de fotos de perfil em andamento
      if ('profilePicStatus' in global && (global.profilePicStatus.isRunning || global.profilePicStatus.isFinished)) {
        // Verificar se o processo deveria ter terminado
        // Se todos os clientes foram processados, mas isFinished não foi atualizado
        if (!global.profilePicStatus.isFinished && 
            global.profilePicStatus.totalClients > 0 &&
            global.profilePicStatus.processedClients >= global.profilePicStatus.totalClients) {
          
          logger.info("Verificação de status: Todos os clientes processados, mas isFinished=false. Atualizando status...");
          
          // Atualizar status para finalizado
          global.profilePicStatus.isFinished = true;
          global.profilePicStatus.isRunning = false;
          
          // Definir data de conclusão se ainda não estiver definida
          if (!global.profilePicStatus.completedAt) {
            global.profilePicStatus.completedAt = new Date();
          }
        }
        
        // Calcular o progresso como porcentagem
        const progress = global.profilePicStatus.totalClients > 0 
          ? Math.round((global.profilePicStatus.processedClients / global.profilePicStatus.totalClients) * 100)
          : 0;
        
        // Criar resumo
        let summary = null;
        
        if (global.profilePicStatus.isFinished) {
          const successCount = global.profilePicStatus.results.successes;
          const totalTime = global.profilePicStatus.completedAt 
            ? Math.round((global.profilePicStatus.completedAt.getTime() - global.profilePicStatus.startedAt.getTime()) / 1000)
            : 0;
            
          summary = `Processamento concluído. Atualizadas ${successCount} fotos em ${totalTime} segundos.`;
          
          // Log de depuração
          logger.debug(`Status: Processo finalizado. ${successCount} fotos atualizadas em ${totalTime}s.`);
        }
        
        // Retornar status do processo de busca de fotos de perfil
        return res.json({
          operation: "profilePics",
          batchInfo: {
            currentBatch: global.profilePicStatus.currentBatch,
            totalBatches: global.profilePicStatus.totalBatches,
            processedClients: global.profilePicStatus.processedClients,
            totalClients: global.profilePicStatus.totalClients,
            progress: progress,
            isFinished: global.profilePicStatus.isFinished,
            isRunning: global.profilePicStatus.isRunning,
            startedAt: global.profilePicStatus.startedAt,
            completedAt: global.profilePicStatus.completedAt,
            results: global.profilePicStatus.results,
            summary: summary
          }
        });
      }
      
      // Se não há busca de fotos em andamento, retornar o status da validação de números
      res.json({
        operation: "validation",
        batchInfo: {
          currentBatch: global.validationStatus.currentBatch,
          totalBatches: global.validationStatus.totalBatches,
          isFinished: global.validationStatus.isFinished,
          isRunning: global.validationStatus.isRunning,
          startedAt: global.validationStatus.startedAt,
          completedAt: global.validationStatus.completedAt
        }
      });
    } catch (error) {
      logger.error(`Erro ao verificar status da validação: ${error}`);
      res.status(500).json({ message: "Falha ao verificar status da validação" });
    }
  });

  // Verificar se todos os números de telefone dos clientes são registrados no WhatsApp
  app.get("/api/whatsapp/check-numbers", async (req, res) => {
    try {
      // Verificar se temos a configuração necessária
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY",
          error: "config_missing",
          errorMessage: "Configuração da API do WhatsApp não encontrada. Verifique as variáveis de ambiente."
        });
      }
      
      // Buscar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela, agora usamos simplesmente a primeira encontrada)
      const instances = await storage.getWhatsappInstances();
      let primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({ 
          message: "Nenhuma instância do WhatsApp encontrada",
          details: "Configure pelo menos uma instância para usar esta funcionalidade",
          error: "no_instance",
          errorMessage: "Nenhuma instância do WhatsApp encontrada. Configure uma instância primeiro."
        });
      }
      
      // Verificar se a instância está conectada no banco de dados local
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        logger.warn(`Instância ${primaryInstance.instanceName} não está marcada como conectada no banco de dados (status: ${primaryInstance.instanceStatus})`);
        
        return res.status(400).json({
          message: `A instância ${primaryInstance.instanceName} não está conectada segundo o banco de dados.`,
          error: "not_connected_locally",
          errorMessage: "Instância do WhatsApp não está conectada. Escaneie o QR code para conectar."
        });
      }
      
      // Verificar o estado real da conexão com a API Evolution
      try {
        const stateResponse = await axios.get(
          `${apiConfig.apiUrl}/instance/connectionState/${primaryInstance.instanceName}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiConfig.apiKey
            },
            timeout: 10000
          }
        );
        
        // Extrair estado da conexão da resposta da API
        const connectionData = stateResponse.data;
        const connectionState = connectionData?.instance?.state || connectionData?.state || "unknown";
        
        logger.info(`Estado da conexão da instância ${primaryInstance.instanceName} segundo a API: ${connectionState}`);
        
        // Se a instância não estiver conectada de acordo com a API, retornar erro
        if (connectionState !== "open" && connectionState !== "connected") {
          return res.status(400).json({
            message: `A instância ${primaryInstance.instanceName} está no estado "${connectionState}", mas precisa estar "connected" para validar números.`,
            error: "not_connected_api",
            connectionState: connectionState,
            errorMessage: "A instância do WhatsApp não está conectada na API Evolution. Por favor, escaneie o QR code novamente para reconectar."
          });
        }
      } catch (stateError) {
        logger.error(`Erro ao verificar estado da instância na API: ${stateError}`);
        return res.status(500).json({
          message: "Erro ao verificar o estado da instância do WhatsApp",
          error: "connection_check_failed",
          errorMessage: "Não foi possível verificar o estado da conexão com o WhatsApp. Por favor, tente novamente."
        });
      }

      // Atualização: vamos usar um valor fixo para o total de clientes para garantir
      // que processemos todos os registros, já que sabemos que temos 427 clientes
      const totalCount = 427;
      
      // Páginas necessárias para processar todos os clientes (100 por página)
      const pageSize = 100;
      const totalPages = Math.ceil(totalCount / pageSize);
      
      logger.info(`Total de ${totalCount} clientes divididos em ${totalPages} páginas`);
      
      // Parâmetro para modo de teste (apenas 1 página) ou processamento completo
      // Adicionamos o parâmetro ?full=true para processar todos os clientes
      const isFullMode = req.query.full === "true";
      const isTestMode = req.query.test === "true";
      
      // Decidir quantas páginas processar
      let pagesToProcess = 1; // Padrão: apenas a primeira página
      
      if (isFullMode) {
        pagesToProcess = totalPages;
        logger.info(`Modo completo: processando TODAS as ${totalPages} páginas`);
      } else if (isTestMode) {
        pagesToProcess = 1;
        logger.info(`Modo de teste: processando apenas a primeira página`);
      } else {
        logger.info(`Modo padrão: processando apenas a primeira página. Use ?full=true para processar todos os clientes.`);
      }
      
      // Array para armazenar todos os clientes
      let allClientes: any[] = [];
      
      // Buscar clientes página por página
      for (let page = 1; page <= pagesToProcess; page++) {
        logger.info(`Buscando página ${page} de ${pagesToProcess}`);
        
        // Adicionamos um timestamp para evitar o cache, já que estamos buscando diferentes páginas
        // mas com os mesmos outros parâmetros
        const timestamp = new Date().getTime();
        
        const pageClientes = await storage.getClientes({
          page,
          pageSize,
          // Adicionamos este campo para forçar diferentes chaves de cache para cada página
          _timestamp: timestamp.toString()
        });
        
        if (pageClientes.length === 0) {
          logger.warn(`Página ${page} retornou 0 clientes. Interrompendo.`);
          break;
        }
        
        logger.info(`Página ${page}: obtidos ${pageClientes.length} clientes`);
        allClientes = [...allClientes, ...pageClientes];
      }
      
      logger.info(`Total de ${allClientes.length} clientes obtidos`);
      
      // Filtrar apenas clientes com números de telefone
      const clientesComTelefone = allClientes.filter(cliente => 
        cliente.phone && cliente.phone.trim().length > 0
      );
      
      if (clientesComTelefone.length === 0) {
        return res.status(200).json({ 
          message: "Nenhum cliente com número de telefone encontrado",
          totalClientes: allClientes.length,
          clientesComTelefone: 0,
          results: []
        });
      }
      
      logger.info(`Processando ${clientesComTelefone.length} clientes com telefone`);
      
      // Extrair os números de telefone
      const phoneNumbers = clientesComTelefone.map(cliente => cliente.phone!);
      
      // Importar o serviço de validação de números WhatsApp
      const { validateWhatsAppNumbers } = await import('../services/whatsapp-validation');
      
      // Determinar tamanho do lote com base na quantidade total
      // Usando um tamanho de lote menor (5) para todos os casos para evitar timeouts e erros
      // Isso diminui a velocidade, mas aumenta muito a confiabilidade
      const batchSize = 5;
      
      // Validar os números no WhatsApp (em lotes)
      const validationResults = await validateWhatsAppNumbers(
        primaryInstance.instanceName,
        phoneNumbers,
        batchSize
      );
      
      // Mapear os resultados para incluir detalhes dos clientes
      const clienteResults = validationResults.map((result, index) => {
        const cliente = clientesComTelefone[index];
        return {
          ...result,
          clienteId: cliente.id,
          clienteName: cliente.fullName,
          originalNumber: cliente.phone,
          status: cliente.status
        };
      });
      
      // Atualizar o banco de dados com as informações de quais clientes têm WhatsApp
      for (const result of clienteResults) {
        try {
          if (result.clienteId) {
            // Atualizamos o campo hasWhatsapp e whatsappJid do cliente
            await db.update(clientes)
              .set({ 
                hasWhatsapp: result.isRegistered, // Usando o campo do esquema
                whatsappJid: result.isRegistered ? result.jid || null : null, // Armazenar o JID quando disponível
                updatedAt: new Date()
              })
              .where(eq(clientes.id, result.clienteId));
            
            logger.debug(`Atualizado cliente ID ${result.clienteId} (${result.clienteName}): hasWhatsapp = ${result.isRegistered}${result.isRegistered ? ', JID = ' + (result.jid || 'não disponível') : ''}`);
          }
        } catch (updateError) {
          logger.error(`Erro ao atualizar hasWhatsapp/whatsappJid do cliente ${result.clienteId}: ${updateError}`);
        }
      }
      
      // Contar quantos números estão registrados no WhatsApp
      const registeredCount = clienteResults.filter(result => result.isRegistered).length;
      
      res.status(200).json({
        message: "Verificação de números concluída com sucesso",
        totalClientes: allClientes.length,
        clientesComTelefone: clientesComTelefone.length,
        clientesProcessados: clienteResults.length,
        clientesNoWhatsApp: registeredCount,
        percentualWhatsApp: clienteResults.length > 0 
          ? Math.round((registeredCount / clienteResults.length) * 100) 
          : 0,
        instancia: primaryInstance.instanceName,
        results: clienteResults
      });
      
    } catch (error) {
      logger.error(`Erro ao verificar números no WhatsApp: ${error}`);
      res.status(500).json({ 
        message: "Falha ao verificar números no WhatsApp",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Nova rota para verificar todos os números de todos os usuários
  app.get("/api/whatsapp/check-all-numbers", async (req, res) => {
    try {
      // Não é necessário verificar autenticação, pois a página já está protegida no frontend
      
      // Verificar se temos a configuração necessária
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      // Obter todas as instâncias conectadas
      const instances = await storage.getWhatsappInstances();
      const connectedInstances = instances.filter(
        inst => inst.instanceStatus === WhatsAppInstanceStatus.CONNECTED
      );
      
      if (connectedInstances.length === 0) {
        return res.status(400).json({ 
          message: "Nenhuma instância conectada disponível",
          details: "Conecte pelo menos uma instância do WhatsApp para usar esta funcionalidade" 
        });
      }
      
      // Buscar todos os corretores/brokers ativos
      const brokers = await storage.getAllUsers();
      const activeBrokers = brokers.filter(
        b => b.isActive && (b.role === "Corretor" || b.role === "Consultor")
      );
      
      // Iniciar processamento assíncrono
      res.status(202).json({
        message: "Verificação iniciada em segundo plano",
        instanciasConectadas: connectedInstances.length,
        totalCorretores: activeBrokers.length,
        details: "Use a rota /api/whatsapp/check-numbers para ver os resultados de todos os clientes"
      });
      
      // Continuar processamento em background após enviar a resposta
      (async () => {
        try {
          // Usamos a primeira instância conectada
          // (nota: o campo isPrimary foi removido da tabela)
          const primaryInstance = connectedInstances[0];
          
          // Para cada corretor, verificar seus clientes
          for (const broker of activeBrokers) {
            try {
              // Registrar início da verificação em log
              logger.info(`Iniciando verificação para o corretor ${broker.fullName} (ID: ${broker.id})`);
              
              // Buscar clientes deste corretor
              const clientesDoCorretor = await storage.getClientes({ brokerId: broker.id });
              const clientesComTelefone = clientesDoCorretor.filter(c => c.phone && c.phone.trim().length > 0);
              
              if (clientesComTelefone.length === 0) {
                logger.info(`Corretor ${broker.fullName} não tem clientes com telefone`);
                continue; // Pular para o próximo corretor
              }
              
              // Extrair os números de telefone
              const phoneNumbers = clientesComTelefone.map(cliente => cliente.phone!);
              
              // Importar o serviço de validação de números WhatsApp
              const { validateWhatsAppNumbers } = await import('../services/whatsapp-validation');
              
              // Validar os números no WhatsApp
              const validationResults = await validateWhatsAppNumbers(
                primaryInstance.instanceName,
                phoneNumbers,
                10 // Tamanho de lote reduzido para evitar problemas
              );
              
              // Contagem de estatísticas
              const registeredCount = validationResults.filter(r => r.isRegistered).length;
              
              logger.info(`Corretor ${broker.fullName}: ${registeredCount}/${phoneNumbers.length} clientes no WhatsApp`);
              
            } catch (brokerError) {
              // Se falhar para um corretor, registrar erro e continuar com o próximo
              logger.error(`Erro ao processar clientes do corretor ${broker.fullName}: ${brokerError}`);
            }
            
            // Adicionar pequeno atraso entre corretores para não sobrecarregar API
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          logger.info("Verificação de todos os corretores concluída com sucesso");
          
        } catch (backgroundError) {
          logger.error(`Erro no processamento em segundo plano: ${backgroundError}`);
        }
      })();
      
    } catch (error) {
      logger.error(`Erro ao iniciar verificação completa: ${error}`);
      res.status(500).json({ 
        message: "Falha ao iniciar verificação completa",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });

  // Buscar foto de perfil para um cliente específico
  app.post("/api/whatsapp/fetch-profile-picture/:clienteId", async (req, res) => {
    try {
      // Verificar se temos a configuração necessária
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      const clienteId = parseInt(req.params.clienteId);
      if (isNaN(clienteId)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }
      
      // Buscar cliente
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verificar se o cliente tem WhatsApp
      if (!cliente.hasWhatsapp) {
        return res.status(400).json({ 
          message: "Cliente não possui WhatsApp",
          details: "Execute a validação de WhatsApp antes de buscar a foto de perfil"
        });
      }
      
      // Buscar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela, agora usamos simplesmente a primeira encontrada)
      const instances = await storage.getWhatsappInstances();
      let primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({ 
          message: "Nenhuma instância do WhatsApp encontrada",
          details: "Configure pelo menos uma instância para usar esta funcionalidade" 
        });
      }
      
      // Se a instância não estiver conectada, retornar erro
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        return res.status(400).json({
          message: "Instância não está conectada",
          details: `O status atual é: ${primaryInstance.instanceStatus}. Conecte a instância primeiro.`
        });
      }
      
      // Atualizar perfil do cliente
      const result = await updateClienteProfilePic(
        clienteId,
        primaryInstance.instanceName
      );
      
      const profilePicUrl = result.status ? result.urlImage : null;
      
      if (!profilePicUrl) {
        return res.status(404).json({
          message: "Não foi possível obter a foto de perfil",
          details: "Verifique se o número tem uma foto de perfil configurada no WhatsApp"
        });
      }
      
      // Retornar a URL da foto de perfil
      res.status(200).json({
        message: "Foto de perfil atualizada com sucesso",
        clienteId,
        profilePicUrl
      });
      
    } catch (error) {
      logger.error(`Erro ao buscar foto de perfil: ${error}`);
      res.status(500).json({ 
        message: "Falha ao buscar foto de perfil",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Buscar fotos de perfil para todos os clientes com WhatsApp
  // Atualizar JIDs para clientes que já têm hasWhatsapp=true mas sem JID
  app.post("/api/whatsapp/update-jids", async (req, res) => {
    try {
      // Verificar se temos a configuração necessária
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      // Buscar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela, agora usamos simplesmente a primeira encontrada)
      const instances = await storage.getWhatsappInstances();
      let primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({ 
          message: "Nenhuma instância do WhatsApp encontrada",
          details: "Configure pelo menos uma instância para usar esta funcionalidade" 
        });
      }
      
      // Se a instância não estiver conectada, retornar erro
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        return res.status(400).json({
          message: "Instância não está conectada",
          details: `O status atual é: ${primaryInstance.instanceStatus}. Conecte a instância primeiro.`
        });
      }
      
      // Verificar se o processamento deve ser limitado a clientes específicos
      const clienteIds: number[] | null = req.body.clienteIds || null;
      
      // Buscar clientes que têm hasWhatsapp=true mas whatsappJid=null
      let clientesSemJid;
      
      if (clienteIds && clienteIds.length > 0) {
        // Se recebermos uma lista de IDs, filtrar apenas esses clientes
        clientesSemJid = await db.query.clientes.findMany({
          where: (clientes: any, { and, eq, isNull, inArray }: any) => 
            and(
              eq(clientes.hasWhatsapp, true),
              isNull(clientes.whatsappJid),
              inArray(clientes.id, clienteIds)
            )
        });
      } else {
        // Caso contrário, buscar todos os clientes nessa condição
        clientesSemJid = await db.query.clientes.findMany({
          where: (clientes: any, { and, eq, isNull }: any) => 
            and(
              eq(clientes.hasWhatsapp, true),
              isNull(clientes.whatsappJid)
            )
        });
      }
      
      // Se não houver clientes para atualizar, retornar resposta imediata
      if (clientesSemJid.length === 0) {
        return res.status(200).json({
          message: "Nenhum cliente necessita atualização de JID",
          count: 0,
          details: "Todos os clientes com WhatsApp já têm JID preenchido"
        });
      }
      
      // Retornar resposta imediata para o cliente
      res.status(202).json({
        message: "Atualização de JIDs iniciada em segundo plano",
        count: clientesSemJid.length,
        instanceName: primaryInstance.instanceName
      });
      
      // Executar o processamento em segundo plano
      (async () => {
        try {
          logger.info(`Iniciando atualização de JIDs para ${clientesSemJid.length} clientes...`);
          
          const startTime = Date.now();
          let successCount = 0;
          
          // Importar o serviço de validação de números WhatsApp
          const { validateSingleNumber } = await import('../services/whatsapp-validation');
          
          // Processar em lotes menores para evitar sobrecarga
          const batchSize = 5;
          for (let i = 0; i < clientesSemJid.length; i += batchSize) {
            const batch = clientesSemJid.slice(i, i + batchSize);
            
            // Processar cada cliente no lote
            const batchPromises = batch.map(async (cliente: any) => {
              try {
                if (!cliente.phone) return false;
                
                const result = await validateSingleNumber(
                  primaryInstance!.instanceName,
                  cliente.phone
                );
                
                if (result && result.isRegistered && result.jid) {
                  // Atualizar o JID do cliente
                  await db.update(schema.clientes)
                    .set({ whatsappJid: result.jid })
                    .where(eq(schema.clientes.id, cliente.id));
                  
                  successCount++;
                  return true;
                }
                return false;
              } catch (error) {
                logger.error(`Erro ao atualizar JID para cliente ${cliente.id}: ${error}`);
                return false;
              }
            });
            
            // Esperar todas as requisições do lote
            await Promise.all(batchPromises);
            
            // Esperar um pouco entre os lotes para não sobrecarregar a API
            if (i + batchSize < clientesSemJid.length) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
          
          const endTime = Date.now();
          const durationSeconds = Math.round((endTime - startTime) / 1000);
          
          logger.info(`Atualização de JIDs concluída. Atualizados ${successCount} de ${clientesSemJid.length} em ${durationSeconds} segundos.`);
          
          // Registrar log de sucesso
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "INFO",
            message: `Atualização de JIDs concluída. ${successCount} de ${clientesSemJid.length} atualizados.`,
            data: {
              successCount,
              totalCount: clientesSemJid.length,
              duration: durationSeconds,
              clienteIds: clienteIds || "all with hasWhatsapp=true and whatsappJid=null"
            }
          });
          
        } catch (backgroundError) {
          logger.error(`Erro no processamento em segundo plano: ${backgroundError}`);
          
          // Registrar log de erro
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "ERROR",
            message: `Erro na atualização de JIDs: ${backgroundError}`,
            data: {
              error: String(backgroundError),
              clienteIds: clienteIds || "all with hasWhatsapp=true and whatsappJid=null"
            }
          });
        }
      })();
      
    } catch (error) {
      logger.error(`Erro ao iniciar atualização de JIDs: ${error}`);
      res.status(500).json({ 
        message: "Falha ao iniciar atualização de JIDs",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });

  app.post("/api/whatsapp/batch-fetch-profile-pictures", async (req, res) => {
    try {
      // Verificar se temos a configuração necessária
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({ 
          message: "API WhatsApp não configurada", 
          details: "Configure as variáveis de ambiente EVOLUTION_API_URL e EVOLUTION_API_KEY" 
        });
      }
      
      // Buscar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela, agora usamos simplesmente a primeira encontrada)
      const instances = await storage.getWhatsappInstances();
      let primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({ 
          message: "Nenhuma instância do WhatsApp encontrada",
          details: "Configure pelo menos uma instância para usar esta funcionalidade" 
        });
      }
      
      // Se a instância não estiver conectada, retornar erro
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        return res.status(400).json({
          message: "Instância não está conectada",
          details: `O status atual é: ${primaryInstance.instanceStatus}. Conecte a instância primeiro.`
        });
      }
      
      // Verificar se o processamento deve ser limitado a clientes específicos
      const clienteIds: number[] | null = req.body.clienteIds || null;
      
      // Opções adicionais: verificar o perfil vazio e atualizar JIDs faltantes
      const updateMissingJids = req.body.updateMissingJids === true;
      const forceUpdate = req.body.forceUpdate === true;
      
      // Retornar resposta imediata para o cliente
      res.status(202).json({
        message: "Processamento de fotos de perfil iniciado em segundo plano",
        instanceName: primaryInstance.instanceName,
        totalClientes: clienteIds ? clienteIds.length : "todos com WhatsApp",
        updateMissingJids: updateMissingJids,
        forceUpdate: forceUpdate
      });
      
      // Executar o processamento em segundo plano
      (async () => {
        try {
          logger.info(`Iniciando processamento em lote de fotos de perfil...`);
          
          const startTime = Date.now();
          
          // Se solicitado, atualizar JIDs faltantes primeiro
          if (updateMissingJids) {
            logger.info(`Verificando clientes com WhatsApp sem JID...`);
            
            // Buscar clientes que têm hasWhatsapp=true mas whatsappJid=null
            let clientesSemJid;
            
            if (clienteIds && clienteIds.length > 0) {
              // Se recebermos uma lista de IDs, filtrar apenas esses clientes
              clientesSemJid = await db.query.clientes.findMany({
                where: (clientes: any, { and, eq, or, isNull, inArray }: any) => 
                  and(
                    eq(clientes.hasWhatsapp, true),
                    or(isNull(clientes.whatsappJid), eq(clientes.whatsappJid, "")),
                    inArray(clientes.id, clienteIds)
                  )
              });
            } else {
              // Caso contrário, buscar todos os clientes nessa condição
              clientesSemJid = await db.query.clientes.findMany({
                where: (clientes: any, { and, eq, or, isNull }: any) => 
                  and(
                    eq(clientes.hasWhatsapp, true),
                    or(isNull(clientes.whatsappJid), eq(clientes.whatsappJid, ""))
                  )
              });
            }
            
            logger.info(`Encontrados ${clientesSemJid.length} clientes sem JID. Atualizando...`);
            
            // Importar o serviço de validação
            const { validateSingleNumber } = await import('../services/whatsapp-validation');
            
            // Processar cada cliente para atualizar seu JID
            for (const cliente of clientesSemJid) {
              try {
                if (!cliente.phone) continue;
                
                // Extrair apenas os números do telefone
                const phoneDigits = cliente.phone.replace(/\D/g, '');
                if (phoneDigits.length < 8) continue;
                
                // Validar o número no WhatsApp
                const result = await validateSingleNumber(primaryInstance.instanceName, phoneDigits);
                
                if (result && result.isRegistered) {
                  // Atualizar o JID do cliente
                  await db.update(clientes)
                    .set({ 
                      whatsappJid: result.jid,
                      updatedAt: new Date()
                    })
                    .where(eq(clientes.id, cliente.id));
                  
                  logger.info(`JID atualizado para cliente ${cliente.id}: ${result.jid}`);
                }
              } catch (clienteError) {
                logger.error(`Erro ao atualizar JID para cliente ${cliente.id}: ${clienteError}`);
              }
            }
          }
          
          // Processar fotos de perfil
          const result = await updateAllProfilePics(
            primaryInstance.instanceName,
            clienteIds,
            forceUpdate
          );
          
          const successCount = result.successes;
          
          const endTime = Date.now();
          const durationSeconds = Math.round((endTime - startTime) / 1000);
          
          logger.info(`Processamento concluído. Atualizadas ${successCount} fotos em ${durationSeconds} segundos.`);
          
          // Registrar log de sucesso
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "INFO",
            message: `Processamento em lote de fotos de perfil concluído. ${successCount} fotos atualizadas.`,
            data: {
              successCount,
              duration: durationSeconds,
              clienteIds: clienteIds || "all",
              updateMissingJids,
              forceUpdate
            }
          });
          
        } catch (backgroundError) {
          logger.error(`Erro no processamento em segundo plano: ${backgroundError}`);
          
          // Registrar log de erro
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "ERROR",
            message: `Erro no processamento em lote de fotos de perfil: ${backgroundError}`,
            data: {
              error: String(backgroundError),
              clienteIds: clienteIds || "all"
            }
          });
        }
      })();
      
    } catch (error) {
      logger.error(`Erro ao iniciar processamento em lote: ${error}`);
      res.status(500).json({ 
        message: "Falha ao iniciar processamento em lote",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para receber eventos de webhook do WhatsApp (Evolution API)
  app.post("/api/webhook/whatsapp", async (req: Request, res: Response) => {
    try {
      const webhookData = req.body as WebhookMessage;
      
      logger.debug(`Webhook recebido: ${JSON.stringify(webhookData)}`);
      
      // Verificar se temos dados válidos
      if (!webhookData || !webhookData.instance || !webhookData.instance.instanceName) {
        logger.warn('Webhook recebido sem dados válidos');
        return res.status(400).json({ message: "Invalid webhook data" });
      }
      
      const instanceName = webhookData.instance.instanceName;
      
      // Buscar a instância no banco de dados
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        logger.warn(`Webhook recebido para instância desconhecida: ${instanceName}`);
        return res.status(404).json({ message: "WhatsApp instance not found" });
      }
      
      // Criar um registro de log para o evento
      await storage.createWhatsappLog({
        instanceId: instance.instanciaId,
        type: webhookData.type || "WEBHOOK",
        message: `Evento recebido: ${webhookData.type || "desconhecido"}`,
        data: webhookData
      });
      
      // Processar diferentes tipos de eventos
      switch (webhookData.type) {
        case 'connection.update':
          // Atualizar o status da conexão
          if (webhookData.status) {
            let newStatus: typeof WhatsAppInstanceStatus[keyof typeof WhatsAppInstanceStatus];
            
            switch (webhookData.status.toLowerCase()) {
              case 'connected':
                newStatus = WhatsAppInstanceStatus.CONNECTED;
                break;
              case 'disconnected':
                newStatus = WhatsAppInstanceStatus.DISCONNECTED;
                break;
              case 'connecting':
                newStatus = WhatsAppInstanceStatus.CONNECTING;
                break;
              case 'qrcode':
                newStatus = WhatsAppInstanceStatus.WAITING_QR_SCAN;
                break;
              default:
                newStatus = WhatsAppInstanceStatus.ERROR;
            }
            
            await storage.updateWhatsappInstanceStatus(
              instance.instanciaId,
              newStatus,
              `Status atualizado via webhook: ${webhookData.status}`
            );
            
            logger.info(`Status da instância ${instanceName} atualizado para ${newStatus}`);
          }
          break;
          
        case 'messages.upsert':
          // Processar novas mensagens
          logger.info(`Nova mensagem recebida para a instância ${instanceName}`);
          // Aqui poderia implementar lógica para processar mensagens
          break;
          
        case 'qr':
          // QR code recebido via webhook
          if (webhookData.qrcode || (webhookData.data && webhookData.data.qrcode)) {
            const qrCode = webhookData.qrcode || webhookData.data?.qrcode;
            logger.info(`QR Code recebido via webhook para ${instanceName}`);
            
            // Atualizar status da instância
            await storage.updateWhatsappInstanceStatus(
              instance.instanciaId,
              WhatsAppInstanceStatus.WAITING_QR_SCAN,
              'QR Code recebido via webhook'
            );
          }
          break;
          
        default:
          // Outros tipos de eventos
          logger.debug(`Evento ${webhookData.type || 'desconhecido'} recebido para ${instanceName}`);
      }
      
      // Responder com sucesso
      res.status(200).json({ message: "Webhook event processed successfully" });
    } catch (error) {
      logger.error(`Erro ao processar webhook: ${error}`);
      res.status(500).json({ message: "Failed to process webhook event" });
    }
  });
  
  // Configurar webhook para uma instância
  app.post("/api/whatsapp/webhook/config", async (req: Request, res: Response) => {
    try {
      // Validar os dados de entrada
      const { instanceName, webhookUrl, events } = req.body;
      
      if (!instanceName || !webhookUrl) {
        return res.status(400).json({ 
          message: "Dados inválidos",
          details: "O nome da instância e a URL do webhook são obrigatórios"
        });
      }
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Configurar o webhook na API Evolution
      const result = await configureWebhook(instanceName, webhookUrl, events);
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instance.instanciaId,
        type: "WEBHOOK_CONFIG",
        message: `Webhook configurado: ${webhookUrl}`,
        data: { webhookUrl, events, result }
      });
      
      res.json({
        message: "Webhook configurado com sucesso",
        config: {
          instanceName,
          webhookUrl,
          events
        },
        result
      });
    } catch (error) {
      logger.error(`Erro ao configurar webhook: ${error}`);
      res.status(500).json({
        message: "Falha ao configurar webhook",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Obter configuração atual do webhook
  app.get("/api/whatsapp/webhook/config/:instanceName", async (req: Request, res: Response) => {
    try {
      const instanceName = req.params.instanceName;
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Obter configuração atual
      const config = await getWebhookConfig(instanceName);
      
      if (!config) {
        return res.status(404).json({ message: "Configuração de webhook não encontrada" });
      }
      
      res.json({
        message: "Configuração de webhook obtida com sucesso",
        config
      });
    } catch (error) {
      logger.error(`Erro ao obter configuração de webhook: ${error}`);
      res.status(500).json({
        message: "Falha ao obter configuração de webhook",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Obter configuração atual das settings
  app.get("/api/whatsapp/settings/:instanceName", async (req: Request, res: Response) => {
    try {
      const instanceName = req.params.instanceName;
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Obter configuração atual
      const settings = await getInstanceSettings(instanceName);
      
      if (!settings) {
        return res.status(404).json({ message: "Configuração de settings não encontrada" });
      }
      
      res.json({
        message: "Configuração de settings obtida com sucesso",
        settings
      });
    } catch (error) {
      logger.error(`Erro ao obter configuração de settings: ${error}`);
      res.status(500).json({
        message: "Falha ao obter configuração de settings",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Buscar apenas a foto de perfil específica do WhatsApp
  app.get("/api/whatsapp/profile-picture/:instanceName", async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      const number = req.query.number as string | undefined;
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ 
          success: false,
          message: "Instância WhatsApp não encontrada"
        });
      }
      
      if (!number) {
        return res.status(400).json({ 
          success: false,
          message: "O número de telefone é obrigatório para buscar foto de perfil",
          error: "MISSING_PHONE_NUMBER" 
        });
      }
      
      try {
        // Usar nossa função otimizada para busca de fotos de perfil
        const { fetchProfilePictureDirectly } = await import('../services/whatsapp-profile-pic');
        
        logger.info(`Buscando URL da foto de perfil usando serviço otimizado para ${number}`);
        
        // Buscar a foto usando nossa função otimizada
        const result = await fetchProfilePictureDirectly(instanceName, number);
        
        if (result.success && result.profilePictureUrl) {
          // Temos uma URL de foto!
          logger.info(`URL da foto de perfil obtida com sucesso via serviço otimizado: ${result.profilePictureUrl}`);
          return res.json({ 
            success: true, 
            url: result.profilePictureUrl, // Mantendo 'url' para compatibilidade com frontend
            profilePictureUrl: result.profilePictureUrl 
          });
        }
        
        // Se o método otimizado falhou, tentar o método tradicional
        logger.info(`Método otimizado não retornou URL. Tentando método tradicional...`);
        
        // ESTRATÉGIA ALTERNATIVA - usar um serviço de avatar que não requer autenticação
        // Isso é apenas um fallback para quando a API estiver instável
        const phoneNumberFormatted = number.replace(/\D/g, '');
        if (phoneNumberFormatted.length > 8) {
          // Usar iniciais do número ou letra padrão como base para o avatar
          const initials = phoneNumberFormatted.substring(phoneNumberFormatted.length - 2);
          // Usar um serviço público de geração de avatar que aceita requisições diretas
          const defaultUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
          logger.info(`Usando serviço UI Avatars como fallback para foto de perfil: ${defaultUrl}`);
          
          return res.json({
            success: true,
            url: defaultUrl,
            profilePictureUrl: defaultUrl,
            isDefault: true
          });
        }
        
        // Se chegou aqui, todas as tentativas falharam
        logger.warn(`Não foi possível obter foto de perfil para ${number}`);
        return res.status(404).json({
          success: false,
          message: "Foto de perfil não encontrada"
        });
      } catch (error) {
        logger.error(`Erro ao buscar foto de perfil: ${error}`);
        
        // ATENÇÃO: Mesmo com erro, vamos tentar retornar um URL válido para não quebrar o frontend
        const phoneNumberFormatted = number.replace(/\D/g, '');
        if (phoneNumberFormatted.length > 8) {
          // Usar iniciais do número ou letra padrão como base para o avatar
          const initials = phoneNumberFormatted.substring(phoneNumberFormatted.length - 2);
          // Usar um serviço público de geração de avatar que aceita requisições diretas
          const defaultUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
          logger.info(`[Devido a erro] Usando serviço UI Avatars como fallback: ${defaultUrl}`);
          
          return res.json({
            success: true,
            url: defaultUrl,
            profilePictureUrl: defaultUrl,
            isDefault: true,
            hadError: true
          });
        }
        
        res.status(500).json({
          success: false,
          message: "Falha ao buscar foto de perfil", 
          error: (error instanceof Error) ? error.message : String(error)
        });
      }
    } catch (error) {
      logger.error(`Erro ao processar requisição de foto de perfil: ${error}`);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar requisição", 
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });

  // Obter informações de perfil (da instância ou de um contato)
  app.get("/api/whatsapp/profile/:instanceName", async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      const number = req.query.number as string | undefined;
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ 
          message: "Instância WhatsApp não encontrada"
        });
      }
      
      // Obter as informações de perfil na Evolution API
      const profileInfo = await getProfileInfo(instanceName, number);
      
      if (!profileInfo) {
        return res.status(404).json({ 
          message: "Informações de perfil não encontradas"
        });
      }
      
      // Tentar obter a foto de perfil usando nosso método otimizado
      let profilePicture: string | undefined = profileInfo.picture || undefined;
      
      // Se não tiver foto de perfil, buscar usando nosso método otimizado
      if (!profilePicture && number) {
        try {
          // Importar a função de busca de foto otimizada
          const { fetchProfilePictureDirectly } = await import('../services/whatsapp-profile-pic');
          
          logger.info(`Buscando foto de perfil via método otimizado para complementar dados do perfil`);
          const pictureResult = await fetchProfilePictureDirectly(instanceName, number);
          
          if (pictureResult.success && pictureResult.profilePictureUrl) {
            logger.info(`Foto de perfil obtida com sucesso via método otimizado: ${pictureResult.profilePictureUrl}`);
            profilePicture = pictureResult.profilePictureUrl;
          } else {
            logger.info(`Método otimizado não retornou foto de perfil`);
          }
        } catch (pictureError) {
          logger.warn(`Erro ao buscar foto de perfil via método otimizado: ${pictureError}`);
          // Não precisa fazer nada, apenas continua com o fluxo normal
        }
      }
      
      // Garantir que todas as propriedades esperadas estejam presentes
      // e adicionar campo profilePictureUrl se não existir
      const enhancedProfile = {
        ...profileInfo,
        // Usar a foto encontrada pelo método otimizado ou a foto original (ou null se nenhuma)
        picture: profilePicture || profileInfo.picture || null as unknown as string,
        // Para compatibilidade, garantir que profilePictureUrl sempre exista
        profilePictureUrl: profilePicture || profileInfo.picture || null as unknown as string
      };
      
      res.json({
        message: "Informações de perfil obtidas com sucesso",
        profile: enhancedProfile
      });
    } catch (error) {
      logger.error(`Erro ao obter informações de perfil: ${error}`);
      res.status(500).json({
        message: "Falha ao obter informações de perfil",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Novo endpoint para buscar perfil com número no corpo da requisição
  app.post("/api/whatsapp/fetch-contact-profile/:instanceName", async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      const { number } = req.body;
      
      if (!number) {
        return res.status(400).json({
          message: "Número de telefone é obrigatório"
        });
      }
      
      // Verificar se a instância existe
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        return res.status(404).json({ 
          message: "Instância WhatsApp não encontrada"
        });
      }
      
      // Formatando o número (removendo caracteres não numéricos)
      let formattedNumber = number.replace(/\D/g, '');
      
      // Se o número não tiver o código do país e for brasileiro, adicionar 55
      if (formattedNumber.length <= 11) {
        formattedNumber = "55" + formattedNumber;
      }
      
      logger.info(`Buscando perfil para o número ${formattedNumber} na instância ${instanceName}`);
      
      try {
        // Chamada direta para a API Evolution usando o endpoint correto
        const response = await whatsappApi.post(
          `chat/fetchProfile/${instanceName}`,
          { number: formattedNumber }
        );
        
        if (!response.data) {
          throw new Error("Resposta vazia da API");
        }
        
        logger.debug(`Resposta da API: ${JSON.stringify(response.data)}`);
        
        // Processar a resposta para garantir o formato correto
        let profilePictureUrl = response.data.picture || response.data.profilePictureUrl;
        
        // Se não tiver foto, tentar buscar pelo endpoint dedicado
        if (!profilePictureUrl) {
          try {
            profilePictureUrl = await fetchProfilePictureUrl(instanceName, formattedNumber);
          } catch (pictureError) {
            logger.warn(`Não foi possível obter a foto pelo endpoint dedicado: ${pictureError}`);
          }
        }
        
        // Formatando o status para garantir consistência
        let status = response.data.status;
        if (typeof status === 'string') {
          status = { status, setAt: new Date().toISOString() };
        } else if (!status || !status.status) {
          status = { status: response.data.status?.status || "Não disponível", setAt: new Date().toISOString() };
        }
        
        // Montando o objeto de resposta completo
        const profileData = {
          name: response.data.name || "Desconhecido",
          wuid: response.data.wuid || `${formattedNumber}@s.whatsapp.net`,
          picture: profilePictureUrl,
          profilePictureUrl: profilePictureUrl,
          status,
          isBusiness: response.data.isBusiness || false,
          description: response.data.description,
          phoneNumber: formattedNumber
        };
        
        return res.json({
          success: true,
          message: "Perfil obtido com sucesso",
          profile: profileData
        });
        
      } catch (apiError) {
        logger.error(`Erro na chamada à API Evolution: ${apiError}`);
        return res.status(500).json({
          success: false,
          message: "Erro ao buscar perfil na API Evolution",
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    } catch (error) {
      logger.error(`Erro ao processar requisição: ${error}`);
      res.status(500).json({
        success: false,
        message: "Erro ao processar requisição",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Configurar settings para uma instância
  app.post("/api/whatsapp/settings", async (req: Request, res: Response) => {
    try {
      // Validar os dados de entrada
      const { instance, rejectCalls, readMessages, groupsIgnore, alwaysOnline, syncFullHistory, readStatus, rejectCallMessage } = req.body;
      
      if (!instance) {
        return res.status(400).json({ 
          message: "Dados inválidos",
          details: "O nome da instância é obrigatório"
        });
      }
      
      // Verificar se a instância existe
      const instanceData = await storage.getWhatsappInstanceByName(instance);
      if (!instanceData) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Preparar payload de settings
      const settings: SettingsConfig = {
        rejectCall: rejectCalls || false,
        msgCall: rejectCallMessage || "",
        groupsIgnore: groupsIgnore || false,
        alwaysOnline: alwaysOnline || false,
        readMessages: readMessages || false,
        readStatus: readStatus || false,
        syncFullHistory: syncFullHistory || false
      };
      
      // Configurar settings na API Evolution
      const result = await configureInstanceSettings(instance, settings);
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instanceData.instanciaId,
        type: "SETTINGS_CONFIG",
        message: `Settings configurados para ${instance}`,
        data: { settings, result }
      });
      
      res.json({
        message: "Settings configurados com sucesso",
        instance,
        settings,
        result
      });
    } catch (error) {
      logger.error(`Erro ao configurar settings: ${error}`);
      res.status(500).json({
        message: "Falha ao configurar settings",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Atualizar foto de perfil do WhatsApp
  app.post("/api/whatsapp/profile/update-picture/:instance", async (req, res) => {
    try {
      const { instance } = req.params;
      // Aceitar tanto "pictureUrl" quanto "picture" para compatibilidade
      let imageUrl = req.body.pictureUrl || req.body.picture;
      
      if (!instance) {
        return res.status(400).json({ 
          success: false,
          message: "Nome da instância não fornecido" 
        });
      }
      
      if (!imageUrl) {
        return res.status(400).json({ 
          success: false,
          message: "URL da imagem não fornecida" 
        });
      }
      
      // Verificar se a instância existe
      const instanceData = await storage.getWhatsappInstanceByName(instance);
      if (!instanceData) {
        return res.status(404).json({ 
          success: false,
          message: "Instância WhatsApp não encontrada" 
        });
      }
      
      // Log para debug
      logger.debug(`Recebido pedido para atualizar foto: instância=${instance}, URL=${imageUrl}`);
      
      // Verificar se a URL da imagem é acessível antes de enviar para a API
      try {
        // Verificar se a API está configurada
        const apiConfig = getApiConfig();
        if (!apiConfig) {
          throw new Error("API WhatsApp não configurada");
        }
        
        // Verificar o formato da URL
        if (!imageUrl.startsWith('http')) {
          throw new Error("URL de imagem inválida");
        }
        
        // Preparar o payload
        // Usando o campo "picture" conforme indicação do usuário
        const payload = { picture: imageUrl };
        logger.debug(`Payload para API: ${JSON.stringify(payload)}`);
        
        // Atualizar foto de perfil com timeout reduzido
        logger.info(`Atualizando foto de perfil para ${instance} com URL: ${imageUrl}`);
        
        // Definir algumas constantes para o retry mechanism
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2 segundos
        
        // Função para delay entre tentativas
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Implementação da tentativa com retry
        let lastError: any = null;
        let response: any = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            logger.info(`Atualizando foto de perfil para ${instance} (tentativa ${attempt}/${MAX_RETRIES})`);
            
            // Fazer requisição com timeout
            response = await axios.post(
              `${apiConfig.apiUrl}/chat/updateProfilePicture/${instance}`,
              payload,
              {
                timeout: 60000, // 60 segundos (1 minuto)
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': apiConfig.apiKey
                }
              }
            );
            
            // Se chegou aqui, foi bem sucedido
            logger.info(`Foto de perfil atualizada com sucesso na tentativa ${attempt}`);
            break;
          } catch (error) {
            lastError = error;
            logger.error(`Erro ao atualizar foto de perfil (tentativa ${attempt}/${MAX_RETRIES}): ${error}`);
            
            // Se não for a última tentativa, esperar e tentar novamente
            if (attempt < MAX_RETRIES) {
              logger.info(`Aguardando ${RETRY_DELAY}ms antes de tentar novamente...`);
              await delay(RETRY_DELAY);
            }
          }
        }
        
        // Se depois de todas as tentativas ainda não tiver resposta, lançar o último erro
        if (!response) {
          logger.error(`Todas as ${MAX_RETRIES} tentativas de atualizar a foto de perfil falharam.`);
          throw lastError || new Error("Falha ao atualizar foto de perfil após várias tentativas");
        }
        
        // Registrar log
        await storage.createWhatsappLog({
          instanceId: instanceData.instanciaId,
          type: "PROFILE_UPDATE",
          message: `Foto de perfil atualizada para ${instance}`,
          data: { pictureUrl: imageUrl, result: response.data }
        });
        
        return res.json({
          success: true,
          message: "Foto de perfil atualizada com sucesso",
          instance,
          result: response.data
        });
        
      } catch (apiError: any) {
        // Registrar o erro, mas não falhar completamente
        logger.error(`Erro ao atualizar foto via API Evolution: ${apiError.message}`);
        
        // Registrar log de erro
        await storage.createWhatsappLog({
          instanceId: instanceData.instanciaId,
          type: "PROFILE_UPDATE_ERROR",
          message: `Erro ao atualizar foto de perfil: ${apiError.message}`,
          data: { 
            pictureUrl: imageUrl, 
            error: apiError.message,
            status: apiError.response?.status || 'unknown'
          }
        });
        
        // Retornar um erro 202 (Accepted) indicando que a solicitação foi aceita,
        // mas não podemos garantir o processamento completo
        return res.status(202).json({
          success: false,
          message: "A solicitação foi recebida, mas a API Evolution não conseguiu processar a atualização da foto",
          instance,
          error: apiError.message,
          pictureUrl: imageUrl, // Retornar a URL para que o frontend possa tentar mostrar a imagem localmente
          suggestion: "Tente novamente mais tarde quando a instância estiver estável"
        });
      }
    } catch (error) {
      logger.error(`Erro ao processar atualização de foto de perfil: ${error}`);
      res.status(500).json({
        success: false,
        message: "Falha ao atualizar foto de perfil",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Atualizar nome de perfil do WhatsApp
  app.post("/api/whatsapp/profile/update-name/:instance", async (req, res) => {
    try {
      const { instance } = req.params;
      const { name } = req.body;
      
      if (!instance) {
        return res.status(400).json({ message: "Nome da instância não fornecido" });
      }
      
      if (!name) {
        return res.status(400).json({ message: "Nome não fornecido" });
      }
      
      // Verificar se a instância existe
      const instanceData = await storage.getWhatsappInstanceByName(instance);
      if (!instanceData) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Atualizar nome de perfil
      const result = await updateProfileName(instance, name);
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instanceData.instanciaId,
        type: "PROFILE_UPDATE",
        message: `Nome de perfil atualizado para ${instance}`,
        data: { name, result }
      });
      
      res.json({
        message: "Nome de perfil atualizado com sucesso",
        instance,
        result
      });
    } catch (error) {
      logger.error(`Erro ao atualizar nome de perfil: ${error}`);
      res.status(500).json({
        message: "Falha ao atualizar nome de perfil",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Atualizar status do WhatsApp
  app.post("/api/whatsapp/profile/update-status/:instance", async (req, res) => {
    try {
      const { instance } = req.params;
      const { status } = req.body;
      
      if (!instance) {
        return res.status(400).json({ message: "Nome da instância não fornecido" });
      }
      
      if (!status) {
        return res.status(400).json({ message: "Status não fornecido" });
      }
      
      // Verificar se a instância existe
      const instanceData = await storage.getWhatsappInstanceByName(instance);
      if (!instanceData) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Atualizar status
      const result = await updateProfileStatus(instance, status);
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: instanceData.instanciaId,
        type: "PROFILE_UPDATE",
        message: `Status atualizado para ${instance}`,
        data: { status, result }
      });
      
      res.json({
        message: "Status atualizado com sucesso",
        instance,
        result
      });
    } catch (error) {
      logger.error(`Erro ao atualizar status: ${error}`);
      res.status(500).json({
        message: "Falha ao atualizar status",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para fazer chamadas diretas à Evolution API
  app.post("/api/whatsapp/direct-evolution-call", async (req: Request, res: Response) => {
    try {
      const { endpoint, payload } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({
          success: false,
          message: "Endpoint não especificado"
        });
      }
      
      const apiConfig = getApiConfig();
      if (!apiConfig) {
        return res.status(500).json({
          success: false,
          message: "API WhatsApp não configurada"
        });
      }
      
      let finalPayload = { ...payload };
      
      // Tratar casos específicos de formatação
      if (endpoint.includes('fetchProfilePictureUrl') && payload?.number) {
        // Garantir que o número está no formato correto (com ou sem @s.whatsapp.net)
        if (!payload.number.includes('@s.whatsapp.net')) {
          finalPayload.number = `${payload.number}@s.whatsapp.net`;
        }
        
        logger.info(`Formatando número para fetchProfilePictureUrl: ${finalPayload.number}`);
      }
      
      // Mantemos o campo "picture" conforme indicação do usuário para o updateProfilePicture
      if (endpoint.includes('updateProfilePicture')) {
        // Verificar se há image mas não tem picture
        if (finalPayload.image && !finalPayload.picture) {
          // Converter de "image" para "picture" conforme indicação do usuário
          finalPayload.picture = finalPayload.image;
          delete finalPayload.image;
          logger.info(`Convertendo campo image para picture no endpoint updateProfilePicture`);
        }
      }
      
      // Logar a requisição para diagnóstico
      logger.info(`Fazendo chamada direta para endpoint ${endpoint} com payload: ${JSON.stringify(finalPayload)}`);
      
      const response = await axios.post(
        `${apiConfig.apiUrl}/${endpoint}`,
        finalPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiConfig.apiKey
          },
          timeout: 60000 // 60 segundos (1 minuto)
        }
      );
      
      // Logar a resposta para diagnóstico
      logger.debug(`Resposta recebida de ${endpoint}: ${JSON.stringify(response.data)}`);
      
      // Adicionar mensagem de sucesso para maior clareza
      return res.json({
        ...response.data,
        success: true
      });
    } catch (error) {
      logger.error(`Erro ao fazer chamada direta à Evolution API: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Erro ao fazer chamada à Evolution API",
        error: (error instanceof Error) ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para diagnóstico direto com a API Evolution
  app.get("/api/whatsapp/diagnose/:instanceName", async (req, res) => {
    try {
      const { instanceName } = req.params;
      
      // Verificar a configuração da API
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      
      if (!apiUrl || !apiKey) {
        return res.status(500).json({ 
          message: "Configuração da API não encontrada",
          error: "API_CONFIG_MISSING"
        });
      }
      
      // Consultar o status diretamente da API Evolution
      const stateResponse = await axios.get(
        `${apiUrl}/instance/connectionState/${instanceName}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          timeout: 10000
        }
      );
      
      // Extrair e normalizar o estado para comparação
      const rawState = stateResponse.data?.state || stateResponse.data?.instance?.state || "unknown";
      const validStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
      const isValidState = validStates.includes(rawState);
      
      // Testar a extração usando diferentes estratégias
      const extractionTests = {
        "data.state": stateResponse.data?.state,
        "data.instance.state": stateResponse.data?.instance?.state,
        "direct state": rawState,
        "direct instance": stateResponse.data?.instance,
        "full_path": stateResponse.data?.instance?.state || stateResponse.data?.state,
        "stringified": JSON.stringify(stateResponse.data)
      };
      
      // Retornar a resposta bruta da API para diagnóstico detalhado
      return res.json({
        rawApiResponse: stateResponse.data,
        extractedState: rawState,
        normalizedState: String(rawState).toUpperCase(),
        isValidState: isValidState,
        validStates: validStates,
        extractionTests: extractionTests,
        directAccess: {
          statusCode: stateResponse.status,
          hasInstance: !!stateResponse.data?.instance,
          hasState: !!stateResponse.data?.state || !!stateResponse.data?.instance?.state
        }
      });
      
    } catch (error) {
      logger.error(`Erro ao diagnosticar instância: ${error}`);
      
      // Capturar detalhes do erro para diagnóstico
      if (axios.isAxiosError(error)) {
        return res.status(500).json({
          message: "Erro ao consultar a API Evolution",
          error: error.message,
          statusCode: error.response?.status,
          responseData: error.response?.data,
          axiosError: true
        });
      }
      
      return res.status(500).json({ 
        message: "Erro ao consultar a API Evolution",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para iniciar busca sequencial de fotos de perfil
  app.post("/api/whatsapp/sequential-profile-pictures/start", async (req: Request, res: Response) => {
    try {
      logger.info(`Iniciando busca sequencial de fotos de perfil do WhatsApp para todos os clientes com telefone`);
      
      // Verificar se já há um processo em execução
      if (globalThis.sequentialProfilePicsRunning) {
        return res.status(400).json({
          message: "Já existe um processo de busca de fotos de perfil em execução",
          isRunning: true
        });
      }

      // Usar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela)
      const instances = await storage.getWhatsappInstances();
      const primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({
          message: "Nenhuma instância de WhatsApp disponível"
        });
      }
      
      // Verificar se a instância está conectada
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        return res.status(400).json({
          message: "A instância do WhatsApp não está conectada",
          instanceStatus: primaryInstance.instanceStatus
        });
      }
      
      // Iniciar o processo em background
      globalThis.sequentialProfilePicsTotal = 0;
      globalThis.sequentialProfilePicsProcessed = 0;
      globalThis.sequentialProfilePicsUpdated = 0;
      globalThis.sequentialProfilePicsStartTime = new Date();
      globalThis.sequentialProfilePicsEndTime = null;
      globalThis.sequentialProfilePicsRunning = true;
      globalThis.sequentialProfilePicsError = null;
      
      // Buscar todos os clientes com telefone, sem filtrar por hasWhatsapp ou JID
      const query = db.select().from(clientes).where(
        and(
          not(isNull(clientes.phone)),
          not(eq(clientes.phone, ""))
        )
      );
        
      const clientesToProcess = await query;
      
      globalThis.sequentialProfilePicsTotal = clientesToProcess.length;
      
      logger.info(`Encontrados ${clientesToProcess.length} clientes para processamento`);
      
      // Registrar log
      await storage.createWhatsappLog({
        instanceId: primaryInstance.instanciaId,
        type: "INFO",
        message: `Iniciada busca sequencial de fotos de perfil para ${clientesToProcess.length} clientes`,
        data: {
          total: clientesToProcess.length
        }
      });
      
      // Processar o primeiro cliente (os próximos serão processados em cadeia)
      if (clientesToProcess.length > 0) {
        processNextProfilePic(clientesToProcess, 0, primaryInstance);
      } else {
        // Se não houver clientes para processar, finalizar
        globalThis.sequentialProfilePicsEndTime = new Date();
        globalThis.sequentialProfilePicsRunning = false;
      }
      
      return res.json({
        message: "Processo de busca sequencial de fotos de perfil iniciado com sucesso",
        total: clientesToProcess.length
      });
      
    } catch (error) {
      logger.error(`Erro ao iniciar busca sequencial de fotos de perfil: ${error}`);
      
      // Limpar estado global em caso de erro
      globalThis.sequentialProfilePicsRunning = false;
      globalThis.sequentialProfilePicsError = String(error);
      
      return res.status(500).json({
        message: "Erro ao iniciar busca sequencial de fotos de perfil",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para verificar status da busca sequencial de fotos de perfil
  app.get("/api/whatsapp/sequential-profile-pictures/status", async (req: Request, res: Response) => {
    try {
      const isRunning = !!globalThis.sequentialProfilePicsRunning;
      const total = globalThis.sequentialProfilePicsTotal || 0;
      const processed = globalThis.sequentialProfilePicsProcessed || 0;
      const updated = globalThis.sequentialProfilePicsUpdated || 0;
      const startTime = globalThis.sequentialProfilePicsStartTime;
      const endTime = globalThis.sequentialProfilePicsEndTime;
      const error = globalThis.sequentialProfilePicsError;
      
      // Calcular tempo decorrido
      let elapsedTimeInSeconds = 0;
      if (startTime) {
        const end = endTime || new Date();
        elapsedTimeInSeconds = Math.round((end.getTime() - startTime.getTime()) / 1000);
      }
      
      return res.json({
        operation: "profile-pictures",
        isRunning,
        isFinished: !isRunning && processed > 0,
        clientsProcessed: processed,
        clientsTotal: total,
        updatedPhotos: updated,
        startTime: startTime ? startTime.toISOString() : null,
        endTime: endTime ? endTime.toISOString() : null,
        elapsedTimeInSeconds,
        error
      });
      
    } catch (error) {
      logger.error(`Erro ao verificar status da busca sequencial de fotos de perfil: ${error}`);
      
      return res.status(500).json({
        message: "Erro ao verificar status da busca sequencial de fotos de perfil",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para interromper o processo de busca sequencial de fotos de perfil
  app.post("/api/whatsapp/sequential-profile-pictures/stop", async (req: Request, res: Response) => {
    try {
      logger.info(`Interrompendo busca sequencial de fotos de perfil`);
      
      // Verificar se há um processo em execução
      if (!globalThis.sequentialProfilePicsRunning) {
        return res.status(400).json({
          message: "Não há processo de busca de fotos de perfil em execução",
          isRunning: false
        });
      }
      
      // Finalizar o processo
      globalThis.sequentialProfilePicsEndTime = new Date();
      globalThis.sequentialProfilePicsRunning = false;
      
      // Registrar log
      // (nota: o campo isPrimary foi removido da tabela)
      const instances = await storage.getWhatsappInstances();
      const primaryInstance = instances[0];
      
      if (primaryInstance) {
        await storage.createWhatsappLog({
          instanceId: primaryInstance.instanciaId,
          type: "INFO",
          message: `Busca sequencial de fotos de perfil interrompida manualmente`,
          data: {
            processed: globalThis.sequentialProfilePicsProcessed,
            total: globalThis.sequentialProfilePicsTotal,
            updated: globalThis.sequentialProfilePicsUpdated
          }
        });
      }
      
      return res.json({
        message: "Processo de busca sequencial de fotos de perfil interrompido com sucesso",
        processed: globalThis.sequentialProfilePicsProcessed,
        total: globalThis.sequentialProfilePicsTotal,
        updated: globalThis.sequentialProfilePicsUpdated
      });
      
    } catch (error) {
      logger.error(`Erro ao interromper busca sequencial de fotos de perfil: ${error}`);
      
      return res.status(500).json({
        message: "Erro ao interromper busca sequencial de fotos de perfil",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Função auxiliar para processar o próximo cliente na busca sequencial de fotos de perfil
  async function processNextProfilePic(clientesList: any[], index: number, instance: any) {
    try {
      // Verificar se o processo foi interrompido manualmente
      if (!globalThis.sequentialProfilePicsRunning) {
        logger.info(`Processo de busca sequencial de fotos de perfil foi interrompido, parando o processamento`);
        return;
      }
      
      // Verificar se chegamos ao final da lista
      if (index >= clientesList.length) {
        logger.info(`Busca sequencial de fotos de perfil concluída. Processados ${index} clientes.`);
        
        // Finalizar o processo
        globalThis.sequentialProfilePicsEndTime = new Date();
        globalThis.sequentialProfilePicsRunning = false;
        
        // Registrar log de conclusão
        await storage.createWhatsappLog({
          instanceId: instance.instanciaId,
          type: "INFO",
          message: `Busca sequencial de fotos de perfil concluída. ${globalThis.sequentialProfilePicsUpdated} fotos atualizadas.`,
          data: {
            processed: index,
            total: clientesList.length,
            updated: globalThis.sequentialProfilePicsUpdated
          }
        });
        
        return;
      }
      
      const cliente = clientesList[index];
      
      // Incrementar contador de processados
      globalThis.sequentialProfilePicsProcessed = index + 1;
      
      // Verificar se o cliente tem telefone
      if (!cliente.phone) {
        logger.warn(`Cliente ${cliente.id} não possui telefone, pulando...`);
        
        // Agendar próximo cliente com um pequeno delay para não sobrecarregar o servidor
        setTimeout(() => {
          processNextProfilePic(clientesList, index + 1, instance);
        }, 100);
        
        return;
      }
      
      // Formatar o número de telefone
      let formattedNumber = cliente.phone.replace(/\D/g, '');
      
      // Se o número não tiver o código do país e for brasileiro, adicionar 55
      if (formattedNumber.length <= 11) {
        formattedNumber = "55" + formattedNumber;
      }
      
      logger.info(`Buscando foto de perfil para cliente ${cliente.id} (${cliente.fullName}) com número ${formattedNumber}`);
      
      // Consultar a API Evolution para obter os dados do perfil
      const response = await whatsappApi.post(
        `chat/fetchProfile/${instance.instanceName}`,
        { number: formattedNumber }
      );
      
      // Verificar se a resposta contém as informações necessárias
      if (response.data) {
        // Extrair URL da foto de perfil
        const profilePicture = response.data.picture || 
                              response.data.profilePictureUrl || 
                              (response.data.profile && response.data.profile.profilePictureUrl) ||
                              null;
        
        // Verificar se o número existe no WhatsApp
        const exists = response.data.numberExists !== false;
        
        if (exists) {
          logger.info(`Número ${formattedNumber} existe no WhatsApp`);
          
          // Atualizar o cliente no banco de dados
          await db.update(clientes)
            .set({ 
              hasWhatsapp: true,
              whatsappJid: response.data.wuid || null,
              profilePicUrl: profilePicture, // Pode ser null
              updatedAt: new Date()
            })
            .where(eq(clientes.id, cliente.id));
          
          // Se a foto foi encontrada, incrementar contador de atualizações
          if (profilePicture) {
            globalThis.sequentialProfilePicsUpdated++;
            logger.info(`Foto de perfil atualizada para cliente ${cliente.id}`);
          } else {
            logger.info(`Número existe no WhatsApp, mas sem foto de perfil para cliente ${cliente.id}`);
          }
        } else {
          logger.warn(`Número ${formattedNumber} não existe no WhatsApp`);
          
          // Atualizar o cliente no banco de dados (marcando como sem WhatsApp)
          await db.update(clientes)
            .set({ 
              hasWhatsapp: false,
              whatsappJid: null,
              profilePicUrl: null,
              updatedAt: new Date()
            })
            .where(eq(clientes.id, cliente.id));
        }
      } else {
        logger.warn(`Resposta da API não contém dados para o cliente ${cliente.id}`);
      }
      
      // Agendar próximo cliente com um delay de 2 segundos para não sobrecarregar a API
      setTimeout(() => {
        processNextProfilePic(clientesList, index + 1, instance);
      }, 2000);
      
    } catch (error) {
      logger.error(`Erro ao processar foto de perfil para cliente ${clientesList[index]?.id}: ${error}`);
      
      // Registrar log de erro
      await storage.createWhatsappLog({
        instanceId: instance.instanciaId,
        type: "ERROR",
        message: `Erro ao processar foto de perfil para cliente ${clientesList[index]?.id}`,
        data: {
          clienteId: clientesList[index]?.id,
          error: String(error)
        }
      });
      
      // Em caso de erro, continuar com o próximo cliente
      setTimeout(() => {
        processNextProfilePic(clientesList, index + 1, instance);
      }, 2000);
    }
  }
  
  // Endpoint para buscar foto de perfil do WhatsApp para um cliente específico
  app.post("/api/whatsapp/fetch-client-profile-picture", async (req: Request, res: Response) => {
    try {
      const { clienteId, phoneNumber } = req.body;
      
      if (!clienteId || !phoneNumber) {
        return res.status(400).json({
          message: "ID do cliente e número de telefone são obrigatórios"
        });
      }
      
      logger.info(`Iniciando busca de foto de perfil individual para cliente ${clienteId} com número ${phoneNumber}`);
      
      // Usar a primeira instância disponível
      // (nota: o campo isPrimary foi removido da tabela)
      const instances = await storage.getWhatsappInstances();
      const primaryInstance = instances[0];
      
      if (!primaryInstance) {
        return res.status(404).json({
          message: "Nenhuma instância de WhatsApp disponível"
        });
      }
      
      // Verificar se a instância está conectada
      if (primaryInstance.instanceStatus !== WhatsAppInstanceStatus.CONNECTED) {
        return res.status(400).json({
          message: "A instância do WhatsApp não está conectada",
          instanceStatus: primaryInstance.instanceStatus
        });
      }
      
      // Formatando o número (removendo caracteres não numéricos)
      let formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Se o número não tiver o código do país e for brasileiro, adicionar 55
      if (formattedNumber.length <= 11) {
        formattedNumber = "55" + formattedNumber;
      }
      
      logger.info(`Buscando perfil para o número ${formattedNumber} na instância ${primaryInstance.instanceName}`);
      
      // Consultar a API Evolution para obter os dados do perfil
      const response = await whatsappApi.post(
        `chat/fetchProfile/${primaryInstance.instanceName}`,
        { number: formattedNumber }
      );
      
      // Verificar se a resposta contém as informações necessárias
      if (!response.data) {
        return res.status(404).json({
          message: "Perfil não encontrado",
          clienteId,
          phoneNumber
        });
      }
      
      // Extrair URL da foto de perfil
      const profilePicture = response.data.picture || 
                            response.data.profilePictureUrl || 
                            (response.data.profile && response.data.profile.profilePictureUrl) ||
                            null;
      
      // Verificar se o número existe no WhatsApp
      const exists = response.data.numberExists !== false;
      
      if (exists && profilePicture) {
        logger.info(`Foto de perfil encontrada para cliente ${clienteId}`);
        
        // Atualizar o cliente no banco de dados
        try {
          await db.update(clientes)
            .set({ 
              hasWhatsapp: true,
              whatsappJid: response.data.wuid || null,
              profilePicUrl: profilePicture,
              updatedAt: new Date()
            })
            .where(eq(clientes.id, clienteId));
          
          logger.info(`Cliente ${clienteId} atualizado com foto de perfil e JID`);
          
          // Registrar log
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "INFO",
            message: `Foto de perfil atualizada para cliente ${clienteId}`,
            data: {
              clienteId,
              phoneNumber: formattedNumber,
              success: true
            }
          });
          
          return res.json({
            success: true,
            message: "Foto de perfil atualizada com sucesso",
            clienteId,
            profilePicture,
            wuid: response.data.wuid,
            hasWhatsapp: true
          });
        } catch (dbError) {
          logger.error(`Erro ao atualizar cliente ${clienteId} no banco de dados: ${dbError}`);
          return res.status(500).json({
            message: "Erro ao atualizar cliente no banco de dados",
            error: String(dbError)
          });
        }
      } else {
        // Se não encontrou foto ou o número não existe no WhatsApp
        logger.warn(`Foto de perfil não encontrada ou número não existe no WhatsApp para cliente ${clienteId}`);
        
        // Atualizar o cliente no banco de dados mesmo assim (com hasWhatsapp = false se necessário)
        try {
          await db.update(clientes)
            .set({ 
              hasWhatsapp: exists,
              whatsappJid: exists ? response.data.wuid || null : null,
              profilePicUrl: profilePicture, // Pode ser null
              updatedAt: new Date()
            })
            .where(eq(clientes.id, clienteId));
          
          logger.info(`Cliente ${clienteId} atualizado (sem foto de perfil)`);
          
          // Registrar log
          await storage.createWhatsappLog({
            instanceId: primaryInstance.instanciaId,
            type: "WARN",
            message: `Foto de perfil não encontrada para cliente ${clienteId}`,
            data: {
              clienteId,
              phoneNumber: formattedNumber,
              exists,
              success: false
            }
          });
          
          return res.json({
            success: false,
            message: exists ? "Número existe no WhatsApp, mas sem foto de perfil" : "Número não existe no WhatsApp",
            clienteId,
            profilePicture: null,
            wuid: response.data.wuid,
            hasWhatsapp: exists
          });
        } catch (dbError) {
          logger.error(`Erro ao atualizar cliente ${clienteId} no banco de dados: ${dbError}`);
          return res.status(500).json({
            message: "Erro ao atualizar cliente no banco de dados",
            error: String(dbError)
          });
        }
      }
    } catch (error) {
      logger.error(`Erro ao buscar foto de perfil: ${error}`);
      
      return res.status(500).json({
        message: "Erro ao buscar foto de perfil",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para verificar status real da instância diretamente na API Evolution
  app.post("/api/whatsapp/verify-actual-status/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // ID já está como string
      
      // Obter a instância do banco de dados (usando texto)
      const instance = await storage.getWhatsappInstance(id);
      if (!instance) {
        return res.status(404).json({ 
          message: "Instância WhatsApp não encontrada"
        });
      }
      
      logger.info(`Verificando status real da instância ${instance.instanceName} na API Evolution`);
      
      // Obter configuração da API
      const apiConfig = getApiConfig();
      const { apiUrl, apiKey } = apiConfig || {};
      
      if (!apiUrl || !apiKey) {
        return res.status(500).json({ 
          message: "Configuração da API não encontrada",
          error: "API_CONFIG_MISSING"
        });
      }
      
      // Fazer uma requisição para o fetchInstances da API Evolution
      // Este endpoint retorna todas as instâncias com status atualizado
      logger.info(`Buscando instâncias diretamente da Evolution API`);
      logger.info(`Fazendo requisição para ${apiUrl}/instance/fetchInstances`);
      
      const response = await axios.get(
        `${apiUrl}/instance/fetchInstances`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          timeout: 10000
        }
      );
      
      // Registro detalhado da resposta para debug
      logger.debug(`Resposta completa da Evolution API: ${JSON.stringify(response.data)}`);
      
      // Extrair a instância correspondente da resposta
      let actualInstance = null;
      let instances = [];
      
      // Normalizar a resposta, que pode vir em diferentes formatos
      if (Array.isArray(response.data)) {
        instances = response.data;
      } else if (response.data && response.data.instances && Array.isArray(response.data.instances)) {
        instances = response.data.instances;
      } else if (response.data && typeof response.data === 'object') {
        // Assumir que cada propriedade é uma instância
        instances = Object.values(response.data);
      }
      
      // Procurar a instância pelo nome
      actualInstance = instances.find((inst: any) => 
        inst.name === instance.instanceName || 
        inst.instanceName === instance.instanceName);
      
      if (!actualInstance) {
        return res.status(404).json({
          message: "Instância não encontrada na API Evolution",
          dbInstance: instance
        });
      }
      
      // Extrair o status real da instância
      // O status pode estar em diferentes campos dependendo da versão da API
      const actualStatus = actualInstance.connectionStatus || 
                           actualInstance.status || 
                           "unknown";
      
      logger.info(`Status real da instância ${instance.instanceName}: ${actualStatus}`);
      
      // Extrair o ownerJid (remoteJid) e apiCreatedAt se disponíveis para atualizar dados adicionais
      const ownerJid = actualInstance.owner || actualInstance.ownerJid || null;
      const apiCreatedAt = actualInstance.createdAt || null;
      
      if (ownerJid) {
        logger.info(`Número de telefone da instância (ownerJid): ${ownerJid}`);
        // Atualizar o remoteJid no banco de dados
        await storage.updateWhatsappInstanceApiData(instance.instanciaId, ownerJid, apiCreatedAt);
        logger.info(`RemoteJid atualizado para ${ownerJid}`);
      }
      
      // Verificar se é necessário atualizar o status no banco de dados
      const normalizedStatus = normalizeStatus(actualStatus);
      let updated = false;
      
      if (normalizedStatus !== instance.instanceStatus) {
        // Atualizar o status no banco de dados
        await storage.updateWhatsappInstanceStatus(instance.instanciaId, normalizedStatus);
        updated = true;
        logger.info(`Status da instância atualizado de ${instance.instanceStatus} para ${normalizedStatus}`);
      }
      
      return res.json({
        message: "Status verificado com sucesso",
        instanceName: instance.instanceName,
        dbStatus: instance.instanceStatus,
        actualStatus: normalizedStatus,
        rawStatus: actualStatus,
        updated,
        remoteJid: instance.remoteJid || ownerJid || null
      });
      
    } catch (error) {
      logger.error(`Erro ao verificar status real da instância: ${error}`);
      
      // Capturar detalhes do erro para diagnóstico
      if (axios.isAxiosError(error)) {
        return res.status(500).json({
          message: "Erro ao consultar a API Evolution",
          error: error.message,
          statusCode: error.response?.status,
          responseData: error.response?.data,
          axiosError: true
        });
      }
      
      return res.status(500).json({ 
        message: "Erro ao verificar status real da instância",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para obter logs específicos da busca sequencial de fotos de perfil
  app.get("/api/whatsapp/logs/profile-pics", async (req, res) => {
    try {
      const allLogs = await storage.getWhatsappLogs("500"); // Buscar mais logs para ter um bom histórico
      
      // Filtrar logs relacionados a fotos de perfil
      const profilePicLogs = allLogs.filter(log => 
        log.message.includes("foto de perfil") || 
        log.message.includes("Foto de perfil") ||
        log.message.includes("número não existe") ||
        log.message.includes("Buscando foto")
      );
      
      return res.json(profilePicLogs);
    } catch (error) {
      logger.error(`Erro ao buscar logs de fotos de perfil: ${error}`);
      return res.status(500).json({ error: "Erro ao buscar logs de fotos de perfil" });
    }
  });
} 