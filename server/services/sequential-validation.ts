/**
 * Serviço para validação sequencial de números de WhatsApp
 * 
 * Este serviço permite validar todos os clientes, mas um de cada vez,
 * evitando sobrecarregar a API e prevenindo erros de "Connection Closed".
 */

import { logger } from "../utils/logger";
import { db } from "../database";
import { clientes } from "@shared/schema";
import { WhatsAppInstanceStatus } from "@shared/schema";
import { eq } from "drizzle-orm";
import { whatsappApi } from "./whatsapp-api";


// Interfaces
export interface ValidationQueueStatus {
  isProcessing: boolean;
  currentIndex: number;
  totalClients: number;
  completedCount: number;
  successCount: number;
  failureCount: number;
  startTime: Date | null;
  endTime: Date | null;
  lastUpdated: Date | null;
  currentClientId: number | null;
  currentClientName: string | null;
  lastResult: ValidationResult | null;
  percentComplete: number;
  estimatedTimeRemaining: number | null; // em segundos
  errorMessage: string | null;
  recentResults: ValidationResult[];
}

export interface ValidationResult {
  clienteId: number;
  clienteName: string;
  phoneNumber: string;
  isRegistered: boolean;
  timestamp: Date;
  errorMessage?: string;
  formattedNumber?: string;
  jid?: string | null;
}

// Estado global da fila de validação - mantido na memória
let queueStatus: ValidationQueueStatus = {
  isProcessing: false,
  currentIndex: 0,
  totalClients: 0,
  completedCount: 0,
  successCount: 0,
  failureCount: 0,
  startTime: null,
  endTime: null,
  lastUpdated: null,
  currentClientId: null,
  currentClientName: null,
  lastResult: null,
  percentComplete: 0,
  estimatedTimeRemaining: null,
  errorMessage: null,
  recentResults: []
};

/**
 * Iniciar o processo de validação sequencial
 * @param instanceName Nome da instância do WhatsApp a ser usada
 * @returns Status inicial da fila
 */
export async function startSequentialValidation(instanceName: string): Promise<ValidationQueueStatus> {
  // Se já estiver processando, retornar o status atual
  if (queueStatus.isProcessing) {
    return queueStatus;
  }
  
  try {
    // Verificar se a instância está conectada
    if (!await isInstanceConnected(instanceName)) {
      throw new Error(`A instância ${instanceName} não está conectada`);
    }
    
    // Buscar todos os clientes com telefone
    const clientesComTelefone = await db.query.clientes.findMany({
      where: (cliente, { not, isNull }) => not(isNull(cliente.phone)),
      orderBy: (cliente, { desc }) => [desc(cliente.id)],
    });
    
    // Filtrar apenas clientes com telefone válido
    const clientesValidos = clientesComTelefone.filter(
      cliente => cliente.phone && cliente.phone.trim().length > 0
    );
    
    if (clientesValidos.length === 0) {
      throw new Error("Nenhum cliente com número de telefone válido encontrado");
    }
    
    logger.info(`Iniciando validação sequencial de ${clientesValidos.length} clientes`);
    
    // Resetar o status da fila
    queueStatus = {
      isProcessing: true,
      currentIndex: 0,
      totalClients: clientesValidos.length,
      completedCount: 0,
      successCount: 0,
      failureCount: 0,
      startTime: new Date(),
      endTime: null,
      lastUpdated: new Date(),
      currentClientId: clientesValidos[0].id,
      currentClientName: clientesValidos[0].fullName,
      lastResult: null,
      percentComplete: 0,
      estimatedTimeRemaining: null,
      errorMessage: null,
      recentResults: []
    };
    
    // Iniciar o processamento em background
    processNextClient(instanceName, clientesValidos);
    
    return queueStatus;
  } catch (error) {
    logger.error(`Erro ao iniciar validação sequencial: ${error}`);
    
    queueStatus = {
      ...queueStatus,
      isProcessing: false,
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
    };
    
    return queueStatus;
  }
}

/**
 * Obter o status atual da fila de validação
 * @returns Status atual da fila
 */
export function getValidationQueueStatus(): ValidationQueueStatus {
  return queueStatus;
}

/**
 * Parar o processo de validação sequencial
 * @returns Status final da fila
 */
export function stopSequentialValidation(): ValidationQueueStatus {
  if (!queueStatus.isProcessing) {
    return queueStatus;
  }
  
  logger.info("Parando validação sequencial a pedido do usuário");
  
  queueStatus = {
    ...queueStatus,
    isProcessing: false,
    endTime: new Date(),
    lastUpdated: new Date(),
    errorMessage: "Validação interrompida pelo usuário"
  };
  
  return queueStatus;
}

/**
 * Verifica se uma instância está realmente conectada
 * @param instanceName Nome da instância a verificar
 * @returns true se conectada, false caso contrário
 */
async function isInstanceConnected(instanceName: string): Promise<boolean> {
  try {
    // Verificar se a instância existe no banco de dados
    const instance = await db.query.whatsappInstances.findFirst({
      where: (whatsappInst) => eq(whatsappInst.instanceName, instanceName)
    });
    
    if (!instance) {
      throw new Error(`Instância ${instanceName} não encontrada`);
    }
    
    logger.info(`Estado da instância ${instanceName} no banco de dados: ${instance.status}`);
    
    // Verificar o estado real da conexão com a API Evolution usando o serviço configurado
    const stateResponse = await whatsappApi.get(`instance/connectionState/${instanceName}`);
    
    // Extrair estado da conexão da resposta da API
    const connectionData = stateResponse.data;
    const connectionState = connectionData?.instance?.state || connectionData?.state || "unknown";
    
    logger.info(`Estado da conexão da instância ${instanceName} segundo a API: ${connectionState}`);
    
    // Verificar se a instância está realmente conectada
    const validStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
    return validStates.includes(connectionState);
    
  } catch (error) {
    logger.error(`Erro ao verificar estado da instância ${instanceName}: ${error}`);
    return false;
  }
}

/**
 * Processa o próximo cliente na fila
 * @param instanceName Nome da instância do WhatsApp
 * @param clientes Lista de clientes a serem processados
 */
async function processNextClient(instanceName: string, clientesList: any[]): Promise<void> {
  // Se a validação foi interrompida, não continuar
  if (!queueStatus.isProcessing) {
    logger.info("Processamento da fila interrompido");
    return;
  }
  
  // Se já processou todos os clientes, finalizar
  if (queueStatus.currentIndex >= queueStatus.totalClients) {
    logger.info("Processamento da fila concluído com sucesso");
    
    queueStatus = {
      ...queueStatus,
      isProcessing: false,
      endTime: new Date(),
      lastUpdated: new Date(),
      percentComplete: 100,
      estimatedTimeRemaining: 0
    };
    
    return;
  }
  
  // Obter o cliente atual
  const currentClient = clientesList[queueStatus.currentIndex];
  
  if (!currentClient) {
    logger.error(`Cliente na posição ${queueStatus.currentIndex} não encontrado`);
    
    // Avançar para o próximo cliente
    queueStatus = {
      ...queueStatus,
      currentIndex: queueStatus.currentIndex + 1,
      completedCount: queueStatus.completedCount + 1,
      failureCount: queueStatus.failureCount + 1,
      lastUpdated: new Date(),
      percentComplete: Math.round(((queueStatus.currentIndex + 1) / queueStatus.totalClients) * 100)
    };
    
    // Processar o próximo cliente após um pequeno delay
    setTimeout(() => {
      processNextClient(instanceName, clientesList);
    }, 1000);
    
    return;
  }
  
  try {
    // Atualizar o status da fila
    queueStatus = {
      ...queueStatus,
      currentClientId: currentClient.id,
      currentClientName: currentClient.fullName,
      lastUpdated: new Date()
    };
    
    logger.info(`Validando cliente ${currentClient.id} (${currentClient.fullName}): ${currentClient.phone}`);
    
    // Importar o serviço de validação
    const { validateSingleNumber } = await import('./whatsapp-validation');
    
    // Validar o número do cliente
    const validationResult = await validateSingleNumber(instanceName, currentClient.phone);
    
    if (!validationResult) {
      throw new Error(`Falha ao validar número ${currentClient.phone}`);
    }
    
    // Atualizar o campo hasWhatsapp e whatsappJid do cliente
    await db.update(clientes)
      .set({ 
        hasWhatsapp: validationResult.isRegistered, 
        whatsappJid: validationResult.isRegistered ? validationResult.jid || null : null,
        updatedAt: new Date()
      })
      .where(eq(clientes.id, currentClient.id));
    
    logger.info(`Cliente ID ${currentClient.id} atualizado: hasWhatsapp = ${validationResult.isRegistered}`);
    
    // Criar resultado da validação
    const result: ValidationResult = {
      clienteId: currentClient.id,
      clienteName: currentClient.fullName,
      phoneNumber: currentClient.phone,
      isRegistered: validationResult.isRegistered,
      timestamp: new Date(),
      formattedNumber: validationResult.formattedNumber,
      jid: validationResult.jid
    };
    
    // Atualizar estatísticas
    const elapsedTime = new Date().getTime() - (queueStatus.startTime?.getTime() || 0);
    const avgTimePerClient = elapsedTime / (queueStatus.completedCount + 1);
    const remainingClients = queueStatus.totalClients - (queueStatus.currentIndex + 1);
    const estimatedRemainingTime = Math.round((avgTimePerClient * remainingClients) / 1000);
    
    // Atualizar o status da fila
    queueStatus = {
      ...queueStatus,
      currentIndex: queueStatus.currentIndex + 1,
      completedCount: queueStatus.completedCount + 1,
      successCount: queueStatus.successCount + (validationResult.isRegistered ? 1 : 0),
      failureCount: queueStatus.failureCount + (validationResult.isRegistered ? 0 : 1),
      lastUpdated: new Date(),
      lastResult: result,
      percentComplete: Math.round(((queueStatus.currentIndex + 1) / queueStatus.totalClients) * 100),
      estimatedTimeRemaining: estimatedRemainingTime,
      recentResults: [result, ...queueStatus.recentResults.slice(0, 9)] // Manter apenas os 10 resultados mais recentes
    };
    
  } catch (error) {
    logger.error(`Erro ao validar cliente ${currentClient.id}: ${error}`);
    
    // Criar resultado da validação com erro
    const result: ValidationResult = {
      clienteId: currentClient.id,
      clienteName: currentClient.fullName,
      phoneNumber: currentClient.phone,
      isRegistered: false,
      timestamp: new Date(),
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
    };
    
    // Atualizar o status da fila
    queueStatus = {
      ...queueStatus,
      currentIndex: queueStatus.currentIndex + 1,
      completedCount: queueStatus.completedCount + 1,
      failureCount: queueStatus.failureCount + 1,
      lastUpdated: new Date(),
      lastResult: result,
      percentComplete: Math.round(((queueStatus.currentIndex + 1) / queueStatus.totalClients) * 100),
      recentResults: [result, ...queueStatus.recentResults.slice(0, 9)] // Manter apenas os 10 resultados mais recentes
    };
  }
  
  // Processar o próximo cliente após um delay otimizado
  // Reduzido para 3s para melhor performance, ainda respeitando rate limits
  const PROCESS_INTERVAL = 3000; // 3 segundos
  logger.info(`Aguardando ${PROCESS_INTERVAL/1000}s antes de processar o próximo cliente...`);
  
  setTimeout(() => {
    processNextClient(instanceName, clientesList);
  }, PROCESS_INTERVAL);
}