import axios from "axios";
import { db } from "../database";
import { clientes, whatsappInstances } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { getApiConfig } from "../routes/whatsapp";

// Inicializa o logger para o serviço de foto de perfil WhatsApp
const profilePicLogger = logger.createLogger("WhatsAppProfilePic");

// Flag para controlar atualizações automáticas de fotos
export const AUTO_UPDATE_PROFILE_PICS = true;

/**
 * Interface para o resultado da busca da foto de perfil
 */
interface ProfilePicResponse {
  status: boolean;
  urlImage?: string;
  message?: string;
  error?: string;
}

/**
 * Interface para resultado da busca em lote de fotos de perfil
 */
interface BatchProfilePicResponse {
  successes: number;
  failures: number;
  errors: string[];
}

/**
 * Interface para resposta da busca direta de foto de perfil
 */
interface DirectProfilePicResponse {
  success: boolean;
  profilePictureUrl?: string;
  error?: string;
  message?: string;
  isDefault?: boolean; // Indica se é um avatar gerado pelo sistema
  hadError?: boolean;  // Indica se houve erro durante o processo
}

/**
 * Status global para rastreamento da busca de fotos de perfil
 */
declare global {
  var profilePicStatus: {
    currentBatch: number;
    totalBatches: number;
    processedClients: number;
    totalClients: number;
    isRunning: boolean;
    isFinished: boolean;
    startedAt: Date;
    completedAt: Date | null;
    summary?: string;
    results: {
      successes: number;
      failures: number;
    };
  };
}

// Inicializar o status global de busca de fotos de perfil
global.profilePicStatus = {
  currentBatch: 0,
  totalBatches: 0,
  processedClients: 0,
  totalClients: 0,
  isRunning: false,
  isFinished: false,
  startedAt: new Date(),
  completedAt: null,
  summary: '',
  results: {
    successes: 0,
    failures: 0
  }
};

/**
 * Processa a resposta da API de foto de perfil e extrai a URL da foto
 * @param data Dados da resposta da API
 * @param clienteId ID do cliente
 * @returns Promise com o resultado do processamento
 */
async function processProfilePicResponse(
  data: any, 
  clienteId: number
): Promise<ProfilePicResponse> {
  // Verificar os diferentes formatos possíveis de resposta
  // Formato 1: { urlImage: "url..." }
  // Formato 2: { url: "url..." }
  // Formato 3: { result: { url: "url..." } }
  // Formato 4: { imgUrl: "url..." }
  // Formato 5: { profilePictureUrl: "url..." } // Evolution API
  // Formato 6: { wuid: "jid", profilePictureUrl: "url..." } // Evolution API
  
  // Log inicial para depuração
  logger.debug(`Analisando resposta: ${JSON.stringify(data)}`);

  // Tratamento especial para o formato específico da Evolution API
  if (data && typeof data === 'object') {
    // Verificar se temos o formato da Evolution API
    if (data.wuid && data.profilePictureUrl) {
      const url = data.profilePictureUrl;
      logger.info(`Detectado formato Evolution API (wuid + profilePictureUrl). URL encontrada: ${url}`);
      
      if (url && typeof url === 'string' && url.startsWith('http')) {
        // Atualizar a foto do cliente no banco de dados
        logger.info(`Atualizando foto de perfil do cliente ${clienteId} com URL: ${url}`);
        await db.update(clientes)
          .set({ profilePicUrl: url })
          .where(eq(clientes.id, clienteId));

        return {
          status: true,
          urlImage: url
        };
      }
    }
    
    // Verificar outros formatos conhecidos
    let profileUrl = null;
    
    // Testar diferentes formatos conhecidos
    if (data.urlImage) {
      profileUrl = data.urlImage;
    } else if (data.url) {
      profileUrl = data.url;
    } else if (data.imgUrl) {
      profileUrl = data.imgUrl;
    } else if (data.profilePictureUrl) {
      profileUrl = data.profilePictureUrl;
    } else if (data.result && data.result.url) {
      profileUrl = data.result.url;
    } else if (data.result && data.result.urlImage) {
      profileUrl = data.result.urlImage;
    } else if (data.result && data.result.profilePictureUrl) {
      profileUrl = data.result.profilePictureUrl;
    }
    
    // Se encontrou uma URL em algum formato
    if (profileUrl && typeof profileUrl === 'string' && profileUrl.startsWith('http')) {
      logger.info(`URL de imagem encontrada em formato alternativo: ${profileUrl}`);
      
      // Atualizar a foto do cliente no banco de dados
      await db.update(clientes)
        .set({ profilePicUrl: profileUrl })
        .where(eq(clientes.id, clienteId));

      return {
        status: true,
        urlImage: profileUrl
      };
    }
    
    // Verificar se é um erro explícito
    if (data.status === "error") {
      logger.error(`API retornou erro: ${data.message || JSON.stringify(data)}`);
      return {
        status: false,
        message: data.message || "Erro na API do WhatsApp",
        error: data.message || "Erro desconhecido"
      };
    }
  }
  
  // Se chegou até aqui, não encontrou URL válida
  logger.info(`Nenhuma foto de perfil encontrada para o cliente ${clienteId}`);
  return {
    status: false,
    message: "Imagem de perfil não encontrada ou formato não reconhecido"
  };
}

/**
 * Busca e atualiza a foto de perfil de um cliente específico
 * @param clienteId ID do cliente
 * @param instanceName Nome da instância do WhatsApp
 * @returns Promise com o resultado da operação
 */
export async function updateClienteProfilePic(
  clienteId: number,
  instanceName: string
): Promise<ProfilePicResponse> {
  try {
    // Verificar se temos configuração da API do WhatsApp
    const apiConfig = getApiConfig();
    if (!apiConfig) {
      return {
        status: false,
        message: "Configuração da API do WhatsApp não encontrada"
      };
    }

    // Buscar cliente no banco
    const cliente = await db.query.clientes.findFirst({
      where: eq(clientes.id, clienteId)
    });

    if (!cliente) {
      return {
        status: false,
        message: "Cliente não encontrado"
      };
    }

    // Verificar se o cliente tem WhatsApp
    if (!cliente.hasWhatsapp) {
      return {
        status: false,
        message: "Cliente não tem WhatsApp"
      };
    }

    // Extrair número do telefone do JID ou usar diretamente o número do cliente
    let phoneNumber = cliente.phone;
    
    if (cliente.whatsappJid && cliente.whatsappJid.includes('@')) {
      // Se temos um JID, extrair o número dele (parte antes do @)
      phoneNumber = cliente.whatsappJid.split('@')[0];
    } else if (cliente.phone) {
      // Se não temos JID mas temos telefone, limpar o formato
      phoneNumber = cliente.phone.replace(/\D/g, '');
    }
    
    // Garantir que o número esteja no formato correto (apenas dígitos)
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    if (!phoneNumber) {
      return {
        status: false,
        message: "Número de telefone inválido"
      };
    }
    
    logger.debug(`Número extraído para busca de foto: ${phoneNumber}`);
    
    try {
      // Usar o endpoint correto da Evolution API conforme endpoints-evolution.md
      const url = `${apiConfig.apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`;
      // Formato do payload conforme documentação
      const payload = { number: phoneNumber };
      
      logger.debug(`Enviando requisição para ${url}`);
      logger.debug(`Payload: ${JSON.stringify(payload)}`);
      
      // Fazer a requisição
      logger.info(`Tentando obter foto de perfil do WhatsApp para ${phoneNumber} usando instância ${instanceName}`);
      const response = await axios.post(
        url,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": apiConfig.apiKey
          },
          timeout: 15000 // Timeout de 15 segundos
        }
      );
      
      logger.info(`Resposta recebida (status ${response.status}): ${JSON.stringify(response.data)}`);
      
      // Se a requisição foi bem-sucedida, processar a resposta
      if (response.status === 200) {
        logger.info(`Resposta da API de foto bem-sucedida para cliente ${clienteId}`);
        const result = await processProfilePicResponse(response.data, clienteId);
        logger.info(`Resultado do processamento de foto para cliente ${clienteId}: ${JSON.stringify(result)}`);
        return result;
      } else {
        logger.error(`API retornou status diferente de 200 para cliente ${clienteId}: ${response.status}`);
        return {
          status: false,
          message: "API retornou resposta com status diferente de 200",
          error: `Status: ${response.status}`
        };
      }
    } catch (error: any) {
      // Se a requisição falhar, registrar o erro
      logger.warn(`Erro na requisição de foto: ${error.message}`);
      
      // Se tiver uma resposta, registrar para análise
      if (error.response) {
        logger.debug(`Status: ${error.response.status}, Dados: ${JSON.stringify(error.response.data)}`);
      }
      
      return {
        status: false,
        message: "Não foi possível obter a foto de perfil",
        error: error.message
      };
    }
  } catch (error: any) {
    logger.error(`Erro ao buscar foto de perfil: ${error.message}`);
    return {
      status: false,
      error: error.message
    };
  }
}

/**
 * Busca e atualiza as fotos de perfil de todos os clientes com WhatsApp
 * @param instanceName Nome da instância do WhatsApp
 * @param clienteIds Lista opcional de IDs de clientes para atualizar. Se não fornecido, atualiza todos
 * @param forceUpdate Se true, força a atualização mesmo para clientes que já têm foto de perfil
 * @returns Promise com o resultado da operação
 */
/**
 * Função auxiliar para buscar a foto de perfil de um cliente quando um número é criado ou atualizado
 * Esta função é especialmente projetada para ser chamada após criar ou atualizar um cliente
 * @param clienteId ID do cliente 
 * @returns Promise com resultado da busca de foto ou null se não for possível buscar
 */
/**
 * Função para buscar foto de perfil de WhatsApp usando chamada direta à API Evolution
 * @param instanceName Nome da instância WhatsApp
 * @param phoneNumber Número de telefone (com ou sem @s.whatsapp.net)
 * @returns Resultado da busca
 */
export async function fetchProfilePictureDirectly(
  instanceName: string,
  phoneNumber: string
): Promise<DirectProfilePicResponse> {
  try {
    // Verificar configuração da API
    const apiConfig = getApiConfig();
    if (!apiConfig) {
      // Gerar avatar com UI Avatars se não tiver configuração
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const initials = cleanNumber.substring(cleanNumber.length - 2);
      const defaultUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
      
      logger.info(`Configuração da API não encontrada, usando avatar fallback: ${defaultUrl}`);
      return {
        success: true,
        profilePictureUrl: defaultUrl,
        isDefault: true
      };
    }
    
    // Formatar o número se necessário
    let formattedNumber = phoneNumber;
    
    // Garantir que o número está no formato correto
    if (!formattedNumber.includes('@s.whatsapp.net')) {
      // Limpar formatação do número
      formattedNumber = formattedNumber.replace(/\D/g, '');
      // Adicionar sufixo
      formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }
    
    logger.info(`Buscando foto de perfil diretamente via Evolution API para número ${formattedNumber}`);
    
    try {
      // Fazer a requisição direta para a API do WhatsApp
      const url = `${apiConfig.apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`;
      const response = await axios.post(
        url,
        {
          number: formattedNumber
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiConfig.apiKey
          },
          timeout: 60000 // 60 segundos (1 minuto)
        }
      );
      
      // Logar a resposta completa para diagnóstico
      logger.debug(`Resposta completa: ${JSON.stringify(response.data)}`);
      
      // Verificar se temos URL na resposta
      if (response.data && response.data.profilePictureUrl) {
        logger.info(`URL de foto de perfil obtida com sucesso: ${response.data.profilePictureUrl}`);
        return {
          success: true,
          profilePictureUrl: response.data.profilePictureUrl
        };
      }
    } catch (apiError: any) {
      logger.warn(`Erro na API Evolution: ${apiError.message}`);
      // Não fazer nada, vamos gerar avatar de fallback abaixo
    }
    
    // Se não conseguiu obter a foto, gerar um avatar de fallback
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length > 8) {
      const initials = cleanNumber.substring(cleanNumber.length - 2);
      // Usar um serviço público de geração de avatar que aceita requisições diretas
      const defaultUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
      logger.info(`Usando serviço UI Avatars como fallback para foto de perfil: ${defaultUrl}`);
      
      return {
        success: true,
        profilePictureUrl: defaultUrl,
        isDefault: true
      };
    }
    
    // Se o número for inválido, retornar erro
    logger.warn(`Resposta sem sucesso ao buscar foto de perfil para ${formattedNumber}`);
    return {
      success: false,
      message: "Falha ao buscar foto de perfil",
      error: "Número inválido ou Evolution API indisponível"
    };
  } catch (error: any) {
    logger.error(`Erro ao buscar foto de perfil diretamente: ${error.message}`);
    
    // Mesmo com erro, vamos retornar um avatar de fallback
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length > 8) {
      const initials = cleanNumber.substring(cleanNumber.length - 2);
      const defaultUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
      logger.info(`[Devido a erro] Usando serviço UI Avatars como fallback: ${defaultUrl}`);
      
      return {
        success: true,
        profilePictureUrl: defaultUrl,
        isDefault: true,
        hadError: true
      };
    }
    
    return {
      success: false,
      message: "Erro na requisição de foto de perfil",
      error: error.message
    };
  }
}

export async function fetchSingleClientProfilePic(clienteId: number): Promise<ProfilePicResponse | null> {
  try {
    // Verificar se a atualização automática está habilitada
    if (!AUTO_UPDATE_PROFILE_PICS) {
      logger.info(`Atualização automática de fotos desabilitada`);
      return null;
    }

    // Buscar cliente
    const cliente = await db.query.clientes.findFirst({
      where: eq(clientes.id, clienteId)
    });

    if (!cliente) {
      logger.error(`Cliente ID ${clienteId} não encontrado para busca de foto`);
      return null;
    }

    // Se o cliente não tem WhatsApp, não prosseguir
    if (!cliente.hasWhatsapp) {
      logger.info(`Cliente ID ${clienteId} não tem WhatsApp, pulando busca de foto`);
      return null;
    }

    // Buscar uma instância do WhatsApp ativa para usar
    const instance = await db.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.instanceStatus, "Conectado")
    });

    if (!instance) {
      logger.warn(`Nenhuma instância do WhatsApp ativa disponível para buscar foto do cliente ${clienteId}`);
      return null;
    }
    
    // Verificar e logar informações sobre a instância encontrada
    logger.info(`Encontrada instância "${instance.instanceName}" com status "${instance.instanceStatus}" para buscar foto`);

    // Com a instância encontrada, buscar a foto do cliente
    logger.info(`Buscando foto para o cliente ${clienteId} usando a instância ${instance.instanceName}`);
    return await updateClienteProfilePic(clienteId, instance.instanceName);

  } catch (error: any) {
    logger.error(`Erro ao buscar foto automaticamente para cliente ${clienteId}: ${error.message}`);
    // Adicionar log mais detalhado para debugging
    if (error.stack) {
      logger.debug(`Stack trace do erro: ${error.stack}`);
    }
    if (error.sql) {
      logger.error(`SQL com erro: ${error.sql}`);
    }
    return null;
  }
}

export async function updateAllProfilePics(
  instanceName: string,
  clienteIds?: number[] | null,
  forceUpdate: boolean = false
): Promise<BatchProfilePicResponse> {
  try {
    // Inicializar o status de progresso
    global.profilePicStatus = {
      currentBatch: 0,
      totalBatches: 0,
      processedClients: 0,
      totalClients: 0,
      isRunning: true,
      isFinished: false,
      startedAt: new Date(),
      completedAt: null,
      summary: '',
      results: {
        successes: 0,
        failures: 0
      }
    };

    const result: BatchProfilePicResponse = {
      successes: 0,
      failures: 0,
      errors: []
    };

    // Buscar todos os clientes que têm WhatsApp (hasWhatsapp = true)
    let clientesComWhatsApp;
    
    if (clienteIds && clienteIds.length > 0) {
      // Se recebermos uma lista de IDs, filtrar apenas esses clientes
      if (forceUpdate) {
        // Buscar todos os clientes da lista que têm WhatsApp
        clientesComWhatsApp = await db.query.clientes.findMany({
          where: (clientes, { and, eq, inArray }) => 
            and(
              eq(clientes.hasWhatsapp, true),
              inArray(clientes.id, clienteIds)
            )
        });
      } else {
        // Buscar apenas clientes da lista que têm WhatsApp e não têm foto
        clientesComWhatsApp = await db.query.clientes.findMany({
          where: (clientes, { and, eq, inArray, or, isNull }) => 
            and(
              eq(clientes.hasWhatsapp, true),
              inArray(clientes.id, clienteIds),
              or(
                isNull(clientes.profilePicUrl),
                eq(clientes.profilePicUrl, '')
              )
            )
        });
      }
      
      logger.info(`Encontrados ${clientesComWhatsApp.length} clientes com WhatsApp ${forceUpdate ? '(atualização forçada)' : 'sem foto'} entre os ${clienteIds.length} solicitados`);
    } else {
      if (forceUpdate) {
        // Caso contrário, buscar todos os clientes com WhatsApp
        clientesComWhatsApp = await db.query.clientes.findMany({
          where: (clientes, { eq }) => eq(clientes.hasWhatsapp, true)
        });
        
        logger.info(`Encontrados ${clientesComWhatsApp.length} clientes com WhatsApp para atualização forçada de foto`);
      } else {
        // Ou apenas os que não têm foto ainda
        clientesComWhatsApp = await db.query.clientes.findMany({
          where: (clientes, { and, eq, or, isNull }) => 
            and(
              eq(clientes.hasWhatsapp, true),
              or(
                isNull(clientes.profilePicUrl),
                eq(clientes.profilePicUrl, '')
              )
            )
        });
        
        logger.info(`Encontrados ${clientesComWhatsApp.length} clientes com WhatsApp sem foto para atualizar`);
      }
    }

    // Atualizar as informações de progresso
    const totalClientes = clientesComWhatsApp.length;
    global.profilePicStatus.totalClients = totalClientes;

    // Processar em lotes menores para evitar sobrecarga
    const batchSize = 5;
    const totalBatches = Math.ceil(totalClientes / batchSize);
    global.profilePicStatus.totalBatches = totalBatches;

    // Log inicial
    logger.info(`Iniciando busca de fotos de perfil para ${totalClientes} clientes em ${totalBatches} lotes`);

    const startTime = Date.now();
    for (let i = 0; i < clientesComWhatsApp.length; i += batchSize) {
      const batch = clientesComWhatsApp.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      // Atualizar informações de progresso
      global.profilePicStatus.currentBatch = batchNumber;

      logger.info(`Processando lote ${batchNumber}/${totalBatches} (${batch.length} clientes)`);

      // Processar cada cliente no lote
      const batchPromises = batch.map(async (cliente) => {
        try {
          const response = await updateClienteProfilePic(cliente.id, instanceName);
          
          // Incrementar contadores globais
          global.profilePicStatus.processedClients++;
          
          if (response.status) {
            result.successes++;
            global.profilePicStatus.results.successes++;
            return true;
          } else {
            result.failures++;
            global.profilePicStatus.results.failures++;
            if (response.message || response.error) {
              result.errors.push(`Cliente ID ${cliente.id}: ${response.message || response.error}`);
            }
            return false;
          }
        } catch (error: any) {
          result.failures++;
          global.profilePicStatus.results.failures++;
          result.errors.push(`Cliente ID ${cliente.id}: ${error.message}`);
          return false;
        }
      });

      // Esperar todas as requisições do lote
      await Promise.all(batchPromises);

      // Esperar um pouco entre os lotes para não sobrecarregar a API
      if (i + batchSize < clientesComWhatsApp.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Marcar como concluído
    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000); // Tempo em segundos
    
    // Prepare um resumo conciso para exibição ao usuário
    const resumo = `${result.successes} fotos atualizadas em ${totalTime}s.`;
    
    global.profilePicStatus.isRunning = false;
    global.profilePicStatus.isFinished = true;
    global.profilePicStatus.completedAt = new Date();
    global.profilePicStatus.summary = resumo;
    
    logger.info(`Processamento concluído. ${resumo}`);
    
    return result;

  } catch (error: any) {
    // Marcar como concluído com erro
    global.profilePicStatus.isRunning = false;
    global.profilePicStatus.isFinished = true;
    global.profilePicStatus.completedAt = new Date();
    
    // Adicionar mensagem de resumo em caso de erro
    const resumo = `Erro ao buscar fotos: ${error.message.substring(0, 120)}`;
    global.profilePicStatus.summary = resumo;
    
    logger.error(`Erro ao atualizar fotos de perfil em lote: ${error.message}`);
    return {
      successes: 0,
      failures: 0,
      errors: [error.message]
    };
  }
}