import { logger } from '../utils/logger';
import { whatsappApi } from './whatsapp-api';

// Inicializa o logger para o serviço de validação WhatsApp
const validationLogger = logger.createLogger("WhatsAppValidation");

// Referência para o objeto global de status da validação definido em routes/whatsapp.ts
// Declaração de tipo para acessá-lo externamente
declare global {
  var validationStatus: {
    currentBatch: number;
    totalBatches: number;
    isRunning: boolean;
    isFinished: boolean;
    startedAt: Date;
    completedAt: Date | null;
  };
}

export interface WhatsAppValidationResult {
  number: string;
  isRegistered: boolean;
  status: string;
  formattedNumber?: string;
  jid?: string | null; // JID do WhatsApp (ex: "553499999999@s.whatsapp.net")
}

/**
 * Formata um número de telefone para o padrão do WhatsApp
 * @param number Número de telefone para formatar
 * @returns Número formatado com código do país
 */
function formatPhoneNumber(number: string): string {
  // Remover todos os caracteres não numéricos
  const cleanNumber = number.replace(/\D/g, '');
  
  // Se o número estiver vazio, retornamos uma string vazia
  if (!cleanNumber || cleanNumber.length < 8) {
    return '';
  }
  
  // IMPORTANTE: Não removemos mais o 9º dígito, pois a API Evolution espera o número completo
  
  // Se o número já começa com 55 (código do Brasil), manter como está
  if (cleanNumber.startsWith('55')) {
    return cleanNumber;
  }
  
  // Outros casos: adicionar 55 na frente
  return `55${cleanNumber}`;
}

/**
 * Processa um lote de números de telefone com a API Evolution
 * @param instanceName Nome da instância do WhatsApp
 * @param phoneNumbers Array de números de telefone para validar
 * @param originalNumbers Array dos números originais (não formatados)
 * @returns Array com resultados da validação
 */
async function processPhoneBatch(
  instanceName: string,
  phoneNumbers: string[],
  originalNumbers: string[]
): Promise<WhatsAppValidationResult[]> {
  try {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    
    if (!apiUrl || !apiKey) {
      throw new Error("Configuração da API não encontrada");
    }
    
    // URL da requisição para verificar números
    const url = `${apiUrl}/instance/connectionState/${instanceName}`;
    
    // Primeiro, verificar se a instância está conectada
    logger.info(`Verificando estado da conexão da instância ${instanceName}`);
    try {
      const stateResponse = await whatsappApi.get(`instance/connectionState/${instanceName}`);
      
      // Extrair estado da conexão usando a mesma estratégia em todo o código
      const stateData = stateResponse.data;
      const connectionState = stateData?.instance?.state || stateData?.state || 'unknown';
      
      // Log detalhado para diagnóstico
      logger.info(`Estado da conexão da instância: ${connectionState}`);
      logger.debug(`Detalhes da resposta do processPhoneBatch: data.instance.state=${stateData?.instance?.state}, data.state=${stateData?.state}`);
      
      // Se a instância não estiver conectada, não podemos prosseguir
      const validStates = ["open", "connected", "CONNECTED", "ONLINE", "online", "ready"];
      if (!validStates.includes(connectionState)) {
        logger.error(`Instância ${instanceName} não está conectada (estado: ${connectionState})`);
        return phoneNumbers.map((num, i) => ({
          number: originalNumbers[i],
          isRegistered: false,
          status: `Instância desconectada: ${connectionState}`,
          formattedNumber: num,
          jid: null
        }));
      }
    } catch (stateError) {
      logger.error(`Erro ao verificar estado da instância: ${stateError}`);
      // Continuar mesmo com erro, pois a API de verificação de números pode funcionar
    }
    
    // Novo endpoint que permite verificar múltiplos números em uma única chamada
    const checkUrl = `${apiUrl}/chat/whatsappNumbers/${instanceName}`;
    
    logger.info(`Processando lote de ${phoneNumbers.length} números`);
    logger.info(`Enviando requisição para ${checkUrl}`);
    
    // Sistema de retry para lidar com falhas temporárias
    const MAX_RETRIES = 3;
    let lastError: any = null;
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          logger.info(`Tentativa ${retry + 1} de ${MAX_RETRIES} para verificar números`);
          // Esperar entre tentativas
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Preparar o payload com os números
        const payload = { numbers: phoneNumbers.map(n => n.trim()) };
        
        // Log detalhado para debug
        logger.info(`Enviando payload: ${JSON.stringify(payload)}`);
        
        // Enviar todos os números em uma única requisição usando o serviço configurado
        const response = await whatsappApi.post(
          `chat/whatsappNumbers/${instanceName}`,
          payload,
          {
            timeout: 60000 // 60 segundos de timeout para o lote completo
          }
        );
        
        // Processando a resposta
        const resultadosIndividuais: WhatsAppValidationResult[] = [];
        const data = response.data;
        
        // Log completo da resposta para depuração
        logger.info(`Resposta completa da API: ${JSON.stringify(data)}`);
        logger.info(`Status da resposta: ${response.status}`);
        
        // Se temos uma resposta com erro "Connection Closed", tentar novamente
        if (
          data?.error === 'Internal Server Error' || 
          data?.response?.message === 'Connection Closed'
        ) {
          lastError = new Error('Connection Closed (erro 500)');
          logger.warn(`Erro de conexão fechada, tentando novamente...`);
          continue; // Tentar novamente
        }
        
        // A resposta da API pode vir em formatos diferentes dependendo da versão
        // Versão 1: Objeto com propriedades exists, jid, number/exists (resposta de lote)
        // Versão 2: Array com objetos que têm propriedades exists, jid, number
        
        if (Array.isArray(data)) {
          // Formato atual do Postman: array de objetos com exists, jid e number
          logger.info(`Processando resposta no formato de array com ${data.length} itens`);
          
          data.forEach(item => {
            if (item) {
              // Verificar propriedades esperadas (exists/exist e jid)
              const isRegistered = item.exists === true || (typeof item[0] === 'object' && item[0].exists === true);
              const jid = item.jid || (typeof item[0] === 'object' && item[0].jid);
              
              resultadosIndividuais.push({
                number: originalNumbers[0], // Usamos o primeiro (e único) número original
                isRegistered: isRegistered,
                status: isRegistered ? 'Registrado' : 'Não registrado',
                formattedNumber: phoneNumbers[0], // Usamos o primeiro (e único) número formatado
                jid: isRegistered && jid ? jid : null
              });
            }
          });
        } else if (data && typeof data === 'object') {
          // Versão mais antiga: objeto onde cada chave é um número com valor que tem exists e jid
          for (let i = 0; i < phoneNumbers.length; i++) {
            const formattedNumber = phoneNumbers[i];
            const originalNumber = originalNumbers[i];
            
            // Verificar se temos um resultado para este número
            const numberResult = data[formattedNumber] || null;
            
            if (numberResult) {
              // Resultado encontrado, verificar se está registrado
              const isRegistered = numberResult.exists === true || numberResult.exist === true;
              
              resultadosIndividuais.push({
                number: originalNumber,
                isRegistered: isRegistered,
                status: isRegistered ? 'Registrado' : 'Não registrado',
                formattedNumber: formattedNumber,
                jid: isRegistered && numberResult.jid ? numberResult.jid : null
              });
            } else {
              // Resultado não encontrado para este número
              resultadosIndividuais.push({
                number: originalNumber,
                isRegistered: false,
                status: 'Não encontrado na resposta',
                formattedNumber: formattedNumber,
                jid: null
              });
            }
          }
        } else {
          // Formato de resposta não reconhecido
          logger.warn(`Formato de resposta não reconhecido: ${JSON.stringify(data)}`);
          lastError = new Error('Formato de resposta não reconhecido');
          continue; // Tentar novamente
        }
        
        // Adicionar resultados para números não encontrados na resposta
        if (resultadosIndividuais.length === 0) {
          phoneNumbers.forEach((num, idx) => {
            resultadosIndividuais.push({
              number: originalNumbers[idx],
              isRegistered: false,
              status: 'Não encontrado na resposta',
              formattedNumber: num,
              jid: null
            });
          });
        }
        
        // Se chegamos aqui, tivemos sucesso
        return resultadosIndividuais;
        
      } catch (requestError: any) {
        lastError = requestError;
        
        // Verificar se o erro é de "Connection Closed"
        const isConnectionClosed = 
          requestError?.response?.data?.response?.message === 'Connection Closed' ||
          requestError?.response?.data?.error === 'Internal Server Error';
        
        if (isConnectionClosed) {
          logger.warn(`Erro de conexão fechada na tentativa ${retry + 1}, tentando novamente...`);
          // Continuar para a próxima tentativa
        } else {
          logger.error(`Erro na requisição (tentativa ${retry + 1}): ${requestError}`);
          if (retry < MAX_RETRIES - 1) {
            // Continuar para a próxima tentativa se não for a última
          } else {
            // Na última tentativa, lançar o erro para ser capturado abaixo
            throw requestError;
          }
        }
      }
    }
    
    // Se chegamos aqui, todas as tentativas falharam
    logger.error(`Todas as ${MAX_RETRIES} tentativas falharam para verificar números`);
    const errorMessage = lastError instanceof Error ? lastError.message : 'Erro desconhecido após múltiplas tentativas';
    
    return phoneNumbers.map((num, i) => ({
      number: originalNumbers[i],
      isRegistered: false,
      status: 'Erro na verificação: ' + errorMessage,
      formattedNumber: num,
      jid: null
    }));
    
  } catch (err) {
    logger.error(`Erro ao processar lote: ${err}`);
    
    // Em caso de erro, retornamos resultados de erro para cada número
    const errorMessage = err instanceof Error ? err.message : 'Erro na verificação';
    return phoneNumbers.map((num, i) => ({
      number: originalNumbers[i],
      isRegistered: false,
      status: errorMessage,
      formattedNumber: num,
      jid: null
    }));
  }
}

/**
 * Divide um array em lotes de tamanho específico
 * @param array Array para dividir
 * @param batchSize Tamanho de cada lote
 * @returns Array de lotes
 */
function chunkArray<T>(array: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    chunks.push(array.slice(i, i + batchSize));
  }
  return chunks;
}

/**
 * Valida números de WhatsApp usando a Evolution API
 * @param instanceName Nome da instância do WhatsApp
 * @param phoneNumbers Array de números de telefone para validar
 * @param batchSize Quantidade de números a processar por lote (padrão: 20)
 * @returns Array com resultados da validação
 */
/**
 * Valida um único número de WhatsApp
 * @param instanceName Nome da instância do WhatsApp
 * @param phoneNumber Número de telefone para validar
 * @returns Resultado da validação ou null em caso de erro
 */
export async function validateSingleNumber(
  instanceName: string,
  phoneNumber: string
): Promise<WhatsAppValidationResult | null> {
  try {
    // Verificar se o número é válido
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      logger.warn(`Número de telefone vazio ou inválido`);
      return {
        number: phoneNumber || '',
        isRegistered: false,
        status: "Número inválido",
        formattedNumber: phoneNumber || '',
        jid: null
      };
    }
    
    // Formatar o número
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber || formattedNumber.length === 0) {
      logger.warn(`Falha ao formatar número: ${phoneNumber}`);
      return {
        number: phoneNumber,
        isRegistered: false,
        status: "Número com formato inválido",
        formattedNumber: phoneNumber,
        jid: null
      };
    }
    
    // Verificar se temos as configurações necessárias
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    
    if (!apiUrl || !apiKey) {
      logger.error(`Configuração da API não encontrada`);
      return {
        number: phoneNumber,
        isRegistered: false,
        status: "Configuração da API não encontrada",
        formattedNumber: formattedNumber,
        jid: null
      };
    }
    
    // Como o processamento sequencial já verifica a conexão anteriormente e tem delay entre requisições,
    // podemos remover a verificação redundante de conexão aqui para reduzir requisições à API
    // e ir direto para a verificação do número
    
    logger.info(`Processando validação para ${formattedNumber}`);
    
    // A verificação do estado da conexão foi removida para reduzir as chamadas à API
    // O serviço de validação sequencial já garante que a instância está conectada
    
    // Usar o novo processamento em lote que suporta múltiplos números
    // com sistema de retry para maior confiabilidade
    logger.info(`Validando número ${formattedNumber} usando instância ${instanceName}`);
    
    // Sistema de retry para lidar com falhas temporárias
    const MAX_RETRIES = 3;
    let lastError: any = null;
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          logger.info(`Tentativa ${retry + 1} de ${MAX_RETRIES} para validar número ${formattedNumber}`);
          // Esperar entre tentativas - otimizado para melhor performance
          const RETRY_INTERVAL = 2000; // 2 segundos
          logger.info(`Aguardando ${RETRY_INTERVAL/1000}s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
        }
        
        const results = await processPhoneBatch(instanceName, [formattedNumber], [phoneNumber]);
        
        if (results && results.length > 0) {
          return results[0];
        }
        
        logger.warn(`Resultado vazio retornado para o número ${formattedNumber}, tentando novamente`);
      } catch (error) {
        lastError = error;
        
        // Verificar se o erro é "Connection Closed" - comum na API Evolution
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Connection Closed') || errorMessage.includes('status code 500')) {
          logger.warn(`Erro de conexão fechada para ${formattedNumber}, tentando novamente...`);
          // Esperar antes da próxima tentativa - reduzido para melhor performance
          const ERROR_RETRY_INTERVAL = 3000; // 3 segundos
          logger.warn(`Erro de conexão: aguardando ${ERROR_RETRY_INTERVAL/1000}s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, ERROR_RETRY_INTERVAL));
          continue;
        }
        
        logger.error(`Erro ao validar número ${formattedNumber}: ${error}`);
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    logger.error(`Todas as ${MAX_RETRIES} tentativas falharam para o número ${formattedNumber}`);
    
    return {
      number: phoneNumber,
      isRegistered: false,
      status: lastError ? `Erro: ${lastError.message || 'Desconhecido'}` : 'Falha na validação após várias tentativas',
      formattedNumber: formattedNumber,
      jid: null
    };
  } catch (error) {
    logger.error(`Erro ao validar número único de WhatsApp: ${error}`);
    return {
      number: phoneNumber || '',
      isRegistered: false,
      status: `Erro: ${error instanceof Error ? error.message : String(error)}`,
      formattedNumber: formatPhoneNumber(phoneNumber) || phoneNumber || '',
      jid: null
    };
  }
}

export async function validateWhatsAppNumbers(
  instanceName: string,
  phoneNumbers: string[],
  batchSize: number = 10 // Reduzido de 20 para 10 para diminuir a carga na API
): Promise<WhatsAppValidationResult[]> {
  try {
    // Inicializar o status global de validação
    if (global.validationStatus) {
      global.validationStatus.isRunning = true;
      global.validationStatus.isFinished = false;
      global.validationStatus.currentBatch = 0;
      global.validationStatus.totalBatches = 0;
      global.validationStatus.startedAt = new Date();
      global.validationStatus.completedAt = null;
    }
    
    // Filtrar números vazios
    const validNumbers = phoneNumbers.filter(number => number && number.trim().length > 0);
    
    if (validNumbers.length === 0) {
      // Finalizar o status global se não houver números para validar
      if (global.validationStatus) {
        global.validationStatus.isRunning = false;
        global.validationStatus.isFinished = true;
        global.validationStatus.completedAt = new Date();
      }
      return [];
    }
    
    // Formatando os números para o padrão da API Evolution (com código do país)
    const formattedNumbers = validNumbers.map(formatPhoneNumber);
    
    // Filtramos novamente para remover números que foram retornados vazios pelo formatPhoneNumber
    const filteredFormattedNumbers = formattedNumbers.filter(number => number.length > 0);
    const validOriginalNumbers: string[] = [];
    
    // Criamos um novo array com os números originais correspondentes aos números formatados válidos
    for (let i = 0; i < validNumbers.length; i++) {
      if (formattedNumbers[i] && formattedNumbers[i].length > 0) {
        validOriginalNumbers.push(validNumbers[i]);
      }
    }
    
    logger.info(`Verificando ${filteredFormattedNumbers.length} números válidos através da instância ${instanceName}`);
    
    // Se não temos números válidos após a filtragem, retornamos um array vazio
    if (filteredFormattedNumbers.length === 0) {
      // Finalizar o status global se não houver números formatados para validar
      if (global.validationStatus) {
        global.validationStatus.isRunning = false;
        global.validationStatus.isFinished = true;
        global.validationStatus.completedAt = new Date();
      }
      return [];
    }
    
    // Dividir em lotes para não sobrecarregar a API
    const batches = chunkArray(filteredFormattedNumbers, batchSize);
    const originalBatches = chunkArray(validOriginalNumbers, batchSize);
    
    // Atualizar o status global de validação com o total de lotes
    if (global.validationStatus) {
      global.validationStatus.totalBatches = batches.length;
      global.validationStatus.currentBatch = 0;
    }
    
    // Processar cada lote sequencialmente
    const allResults: WhatsAppValidationResult[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      // Atualizar o status global com o lote atual
      if (global.validationStatus) {
        global.validationStatus.currentBatch = i + 1;
      }
      
      logger.info(`Processando lote ${i+1} de ${batches.length}`);
      
      try {
        // Adicionar um atraso mais longo entre os lotes para não sobrecarregar a API 
        // Aumentado para 15 segundos para maior estabilidade e confiabilidade
        // com lotes menores e intervalos maiores, reduzimos significativamente a carga na API
        if (i > 0) {
          const BATCH_INTERVAL = 15000; // 15 segundos
          logger.info(`Aguardando ${BATCH_INTERVAL/1000}s antes de processar o próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL));
        }
        
        const batchResults = await processPhoneBatch(
          instanceName,
          batches[i],
          originalBatches[i]
        );
        
        allResults.push(...batchResults);
      } catch (batchError) {
        // Se houver erro ao processar um lote, adicionamos resultados de erro para cada número do lote
        logger.error(`Erro ao processar lote ${i+1}: ${batchError}. Continuando para o próximo lote.`);
        
        const errorResults = batches[i].map((num, idx) => ({
          number: originalBatches[i][idx],
          isRegistered: false,
          status: 'Erro na verificação',
          formattedNumber: num,
          jid: null
        }));
        
        allResults.push(...errorResults);
      }
    }
    
    // Marcar como concluído no status global
    if (global.validationStatus) {
      global.validationStatus.isFinished = true;
      global.validationStatus.isRunning = false;
      global.validationStatus.completedAt = new Date();
    }
    
    logger.info(`Processamento concluído. Verificados ${allResults.length} números.`);
    return allResults;
    
  } catch (error) {
    logger.error(`Erro ao validar números de WhatsApp: ${error}`);
    
    // Obtendo mais detalhes do erro para depuração
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      logger.error(`Detalhes do erro: Status ${axiosError.response?.status}, Dados: ${JSON.stringify(axiosError.response?.data)}`);
    }
    
    // Em vez de lançar o erro, retornamos um array vazio
    return [];
  }
}