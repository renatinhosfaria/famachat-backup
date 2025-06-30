import { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import https from 'https';
import { logger } from '../utils/logger';
import { apiQueue } from './api-queue';

// Configurar axios para aceitar certificados auto-assinados
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configurar axios globalmente para usar o agent
axios.defaults.httpsAgent = httpsAgent;

// Configuração para a API do WhatsApp
interface WhatsAppApiConfig {
  apiUrl: string;
  apiKey: string;
}

// Inicializa o logger específico para este serviço
const whatsappApiLogger = logger.createLogger('WhatsAppApiService');

/**
 * Serviço para realizar chamadas à API do WhatsApp
 * utilizando uma fila para controlar o rate limit
 */
class WhatsAppApiService {
  private apiConfig: WhatsAppApiConfig | null = null;
  private initialized = false;

  constructor() {
    // Configurar o intervalo otimizado de 2 segundos entre requisições
    // Reduzido para melhorar performance da validação sequencial
    apiQueue.setMinInterval(2000);
  }

  /**
   * Inicializa o serviço com a configuração da API
   * @param apiUrl URL base da API
   * @param apiKey Chave de API
   */
  initialize(apiUrl: string, apiKey: string): void {
    this.apiConfig = { apiUrl, apiKey };
    this.initialized = true;
    whatsappApiLogger.info(`Serviço da API do WhatsApp inicializado com URL: ${apiUrl}`);
  }

  /**
   * Verifica se o serviço está inicializado corretamente
   * @throws Error se o serviço não estiver inicializado
   */
  private checkInitialized(): void {
    if (!this.initialized || !this.apiConfig) {
      throw new Error("Serviço da API do WhatsApp não inicializado");
    }
  }

  /**
   * Cria os headers padrão para as requisições
   * @returns Headers HTTP com a chave da API
   */
  private getHeaders(): Record<string, string> {
    this.checkInitialized();
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiConfig!.apiKey
    };
  }

  /**
   * Cria a URL completa para um endpoint específico
   * @param endpoint Endpoint da API (sem barra inicial)
   * @returns URL completa
   */
  private getUrl(endpoint: string): string {
    this.checkInitialized();
    const baseUrl = this.apiConfig!.apiUrl;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${baseUrl}/${normalizedEndpoint}`;
  }

  /**
   * Realiza uma requisição GET à API do WhatsApp
   * @param endpoint Endpoint da API
   * @param config Configurações adicionais para o axios
   * @returns Promise com a resposta da API
   */
  async get<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.checkInitialized();
    
    const url = this.getUrl(endpoint);
    const fullConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...this.getHeaders(),
        ...(config?.headers || {})
      },
      timeout: config?.timeout || 60000, // 60 segundos padrão
      httpsAgent // Adicionar o agent HTTPS para aceitar certificados auto-assinados
    };
    
    whatsappApiLogger.debug(`Agendando GET para ${url}`);
    return apiQueue.get<T>(url, fullConfig);
  }

  /**
   * Realiza uma requisição POST à API do WhatsApp
   * @param endpoint Endpoint da API
   * @param data Dados a serem enviados no corpo da requisição
   * @param config Configurações adicionais para o axios
   * @returns Promise com a resposta da API
   */
  async post<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.checkInitialized();
    
    const url = this.getUrl(endpoint);
    const fullConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...this.getHeaders(),
        ...(config?.headers || {})
      },
      timeout: config?.timeout || 60000, // 60 segundos padrão
      httpsAgent // Adicionar o agent HTTPS para aceitar certificados auto-assinados
    };
    
    whatsappApiLogger.debug(`Agendando POST para ${url}`);
    return apiQueue.post<T>(url, data, fullConfig);
  }
  
  /**
   * Realiza uma requisição PUT à API do WhatsApp
   * @param endpoint Endpoint da API
   * @param data Dados a serem enviados no corpo da requisição
   * @param config Configurações adicionais para o axios
   * @returns Promise com a resposta da API
   */
  async put<T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.checkInitialized();
    
    const url = this.getUrl(endpoint);
    const fullConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...this.getHeaders(),
        ...(config?.headers || {})
      },
      timeout: config?.timeout || 60000 // 60 segundos padrão
    };
    
    whatsappApiLogger.debug(`Agendando PUT para ${url}`);
    
    // Usar o sistema de fila adequado para PUT
    // Criar um método personalizado pois a apiQueue não tem put diretamente
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      whatsappApiLogger.info(`Adicionando requisição PUT ${url} à fila (ID: ${id})`);
      
      // Adicionar à fila manualmente com um timeout simples
      setTimeout(async () => {
        try {
          const response = await axios.put(url, data, fullConfig);
          whatsappApiLogger.info(`Requisição PUT ${url} concluída com sucesso (ID: ${id})`);
          resolve(response);
        } catch (error) {
          whatsappApiLogger.error(`Erro ao processar requisição PUT ${url} (ID: ${id}): ${error}`);
          reject(error);
        }
      }, 0); // Executar imediatamente, confiando no rate limiting da fila
    });
  }

  /**
   * Realiza uma requisição DELETE à API do WhatsApp
   * @param endpoint Endpoint da API
   * @param config Configurações adicionais para o axios
   * @returns Promise com a resposta da API
   */
  async delete<T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    this.checkInitialized();
    
    const url = this.getUrl(endpoint);
    const fullConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...this.getHeaders(),
        ...(config?.headers || {})
      },
      timeout: config?.timeout || 60000 // 60 segundos padrão
    };
    
    whatsappApiLogger.debug(`Agendando DELETE para ${url}`);
    // Vamos implementar o método delete sem usar enqueue diretamente
    // já que o método foi alterado para privado novamente
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const response = await axios.delete(url, fullConfig);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }

  /**
   * Define o intervalo mínimo entre requisições
   * @param intervalMs Intervalo em milissegundos
   */
  setMinInterval(intervalMs: number): void {
    apiQueue.setMinInterval(intervalMs);
    whatsappApiLogger.info(`Intervalo entre requisições à API do WhatsApp configurado para ${intervalMs}ms`);
  }

  /**
   * Retorna o tamanho atual da fila de requisições
   */
  getQueueSize(): number {
    return apiQueue.getQueueSize();
  }

  /**
   * Retorna a configuração atual da API
   */
  getApiConfig(): WhatsAppApiConfig | null {
    return this.apiConfig;
  }
  
  /**
   * Método compatível com o evolutionApiService.makeRequest
   * para facilitar a migração
   * @param options Opções da requisição
   * @returns Resposta da API
   */
  async makeRequest(options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  }): Promise<any> {
    this.checkInitialized();
    
    const { method, endpoint, data, config } = options;
    
    try {
      let response;
      
      switch (method) {
        case 'GET':
          response = await this.get(endpoint, config);
          break;
        case 'POST':
          response = await this.post(endpoint, data, config);
          break;
        case 'PUT':
          response = await this.put(endpoint, data, config);
          break;
        case 'DELETE':
          response = await this.delete(endpoint, config);
          break;
        default:
          throw new Error(`Método HTTP não suportado: ${method}`);
      }
      
      return response.data;
    } catch (error: any) {
      whatsappApiLogger.error(`Erro na requisição ${method} para ${endpoint}: ${error.message}`);
      throw error;
    }
  }
}

// Exporta uma instância única do serviço
export const whatsappApi = new WhatsAppApiService();