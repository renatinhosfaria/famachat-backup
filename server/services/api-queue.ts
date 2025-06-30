import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import axios from 'axios';
import https from 'https';
import { logger } from '../utils/logger';

// Configurar axios para aceitar certificados auto-assinados
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Aplicar o agent nas configurações padrão do axios
axios.defaults.httpsAgent = httpsAgent;

// Interface para o cache de resposta
interface CachedResponse {
  timestamp: number;
  data: any;
  url: string;
}

// Configuração do cache
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de TTL para o cache

interface QueueItem {
  id: string;
  url: string;
  method: string;
  data?: any;
  config?: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

/**
 * Serviço que implementa uma fila de requisições para a API do WhatsApp
 * com intervalos mínimos entre chamadas para evitar sobrecarga
 */
class ApiQueueService {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private minIntervalMs: number = 10000; // 10 segundos entre requisições (otimizado)
  private lastRequestTimestamp: number = 0;
  private responseCache: Map<string, CachedResponse> = new Map(); // Cache de respostas

  /**
   * Configura o intervalo mínimo entre as requisições
   * @param intervalMs Intervalo em milissegundos
   */
  setMinInterval(intervalMs: number): void {
    this.minIntervalMs = intervalMs;
    logger.info(`Intervalo mínimo entre requisições configurado para ${intervalMs}ms`);
  }

  /**
   * Agenda uma requisição GET na fila
   * @param url URL da requisição
   * @param config Configurações adicionais para o axios
   * @returns Promise que será resolvida quando a requisição for processada
   */
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.enqueue('GET', url, undefined, config);
  }

  /**
   * Agenda uma requisição POST na fila
   * @param url URL da requisição
   * @param data Dados a serem enviados no corpo da requisição
   * @param config Configurações adicionais para o axios
   * @returns Promise que será resolvida quando a requisição for processada
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.enqueue('POST', url, data, config);
  }

  /**
   * Adiciona uma requisição na fila e inicia o processamento se necessário
   * @param method Método HTTP
   * @param url URL da requisição
   * @param data Dados a serem enviados no corpo da requisição
   * @param config Configurações adicionais para o axios
   * @returns Promise que será resolvida quando a requisição for processada
   */
  enqueue<T = any>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      logger.info(`Adicionando requisição ${method} ${url} à fila (ID: ${id})`);
      
      this.queue.push({
        id,
        url,
        method,
        data,
        config,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processa a fila de requisições, respeitando o intervalo mínimo entre elas
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    
    // Calcula tempo de espera baseado na última requisição
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTimestamp;
    const waitTime = Math.max(0, this.minIntervalMs - timeSinceLastRequest);
    
    if (waitTime > 0) {
      logger.info(`Aguardando ${waitTime}ms antes de processar a próxima requisição`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const item = this.queue.shift();
    if (!item) {
      this.isProcessing = false;
      return;
    }
    
    const timeInQueue = Date.now() - item.timestamp;
    logger.info(`Processando requisição ${item.method} ${item.url} (ID: ${item.id}, tempo na fila: ${timeInQueue}ms)`);
    
    this.lastRequestTimestamp = Date.now();
    
    try {
      const response = await this.makeRequest(item);
      logger.info(`Requisição ${item.method} ${item.url} concluída com sucesso (ID: ${item.id})`);
      item.resolve(response);
    } catch (error) {
      logger.error(`Erro ao processar requisição ${item.method} ${item.url} (ID: ${item.id}): ${error}`);
      item.reject(error);
    }
    
    // Continua processando a fila
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * Gera uma chave de cache única para a requisição
   * @param method Método HTTP
   * @param url URL da requisição
   * @param data Dados da requisição (para POST/PUT)
   */
  private getCacheKey(method: string, url: string, data?: any): string {
    const dataString = data ? JSON.stringify(data) : '';
    return `${method}:${url}:${dataString}`;
  }

  /**
   * Verifica se há uma resposta em cache válida
   * @param cacheKey Chave do cache
   */
  private getCachedResponse(cacheKey: string): CachedResponse | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL_MS) {
      // Cache expirado, remover
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    return cached;
  }

  /**
   * Armazena uma resposta no cache
   */
  private cacheResponse(cacheKey: string, response: any, url: string): void {
    this.responseCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response,
      url
    });
    
    logger.debug(`Resposta para ${url} armazenada no cache`);
  }

  /**
   * Executa a requisição HTTP com suporte a cache e tratamento de erros específicos
   */
  private async makeRequest(item: QueueItem): Promise<any> {
    const { method, url, data, config } = item;
    const cacheKey = this.getCacheKey(method, url, data);
    
    // Verificar cache para GET ou para endpoints específicos do fetchProfile
    if (method.toUpperCase() === 'GET' || 
        (method.toUpperCase() === 'POST' && url.includes('/chat/fetchProfile/'))) {
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        logger.info(`Usando resposta em cache para ${url}`);
        return cached.data;
      }
    }
    
    try {
      // Garantir que o httpsAgent seja aplicado em todas as requisições
      const configWithAgent = {
        ...config,
        httpsAgent
      };
      
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await axios.get(url, configWithAgent);
          break;
        case 'POST':
          response = await axios.post(url, data, configWithAgent);
          break;
        case 'PUT':
          response = await axios.put(url, data, configWithAgent);
          break;
        case 'DELETE':
          response = await axios.delete(url, configWithAgent);
          break;
        default:
          throw new Error(`Método HTTP não suportado: ${method}`);
      }
      
      // Armazenar resposta no cache para GET e endpoints específicos
      if (method.toUpperCase() === 'GET' || 
          (method.toUpperCase() === 'POST' && url.includes('/chat/fetchProfile/'))) {
        this.cacheResponse(cacheKey, response, url);
      }
      
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Tratamento especial para erro 404 em endpoints específicos
      if (axiosError.response?.status === 404) {
        // Se for uma busca por instância e retornar 404, podemos retornar um resultado simulado
        if (url.includes('/instance/fetchInstances/') || url.includes('/instance/connectionState/')) {
          logger.warn(`Endpoint ${url} retornou 404, retornando resposta simulada`);
          
          // Extrair nome da instância da URL
          const parts = url.split('/');
          const instanceName = parts[parts.length - 1];
          
          // Resposta simulada
          const mockedResponse = {
            data: {
              instance: {
                instanceName: instanceName,
                state: "closed"  // Desconectado
              }
            }
          };
          
          return mockedResponse;
        }
      }
      
      // Propagar o erro
      throw error;
    }
  }

  /**
   * Retorna o tamanho atual da fila
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Limpa a fila de requisições
   */
  clearQueue(): void {
    const count = this.queue.length;
    
    // Rejeitar todas as requisições pendentes
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    logger.info(`Fila de requisições limpa (${count} requisições rejeitadas)`);
  }
}

// Exporta uma instância única do serviço
export const apiQueue = new ApiQueueService();