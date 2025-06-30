/**
 * Gerenciador Redis unificado com suporte a Redis externo
 * Substitui os clientes Redis anteriores com implementação mais robusta
 */

import Redis from 'ioredis';

export class RedisManager {
  private client: Redis | null = null;
  private isConnected = false;
  private memoryFallback = new Map<string, { value: any; expires: number }>();
  private connectionConfig: any;

  constructor() {
    // Aguardar um pouco para garantir que as variáveis de ambiente estejam carregadas
    setTimeout(() => this.setupConnection(), 100);
  }

  private setupConnection() {
    // Verificar se Redis externo está habilitado via variável de ambiente
    const enableExternalRedis = process.env.ENABLE_EXTERNAL_REDIS === 'true';
    const redisHost = process.env.REDIS_HOST || '144.126.134.23';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisDb = parseInt(process.env.REDIS_DB || '0');
    
    // Usar cache em memória por padrão
    if (!enableExternalRedis) {
      console.log('[Redis] Usando cache em memória (recomendado para desenvolvimento)');
      this.isConnected = false;
      return;
    }
    
    console.log(`[Redis] Tentando conectar ao Redis externo: ${redisHost}:${redisPort}`);
    
    // Configurar Redis externo apenas se explicitamente habilitado
    this.connectionConfig = {
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      db: redisDb,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 2000,
      lazyConnect: true,
      keepAlive: 5000,
      family: 4,
    };
    
    this.connectToRedis();
  }

  private async connectToRedis() {
    try {
      this.client = new Redis(this.connectionConfig);

      this.client.on('connect', () => {
        console.log('[Redis] Conectado ao Redis externo');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('[Redis] Redis externo pronto para uso');
        this.isConnected = true;
      });

      this.client.on('error', (error: any) => {
        console.warn(`[Redis] Erro de conexão: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.warn('[Redis] Conexão fechada');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] Reconectando...');
      });

      this.client.on('end', () => {
        console.warn('[Redis] Conexão terminada');
        this.isConnected = false;
      });

      // Tentar conectar
      await this.client.ping();
      console.log('[Redis] Ping bem-sucedido');
      
    } catch (error: any) {
      console.warn(`[Redis] Falha na conexão externa: ${error.message}`);
      this.isConnected = false;
      this.client = null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    const fullKey = `famachat:${key}`;
    
    if (this.isConnected && this.client) {
      try {
        const serializedValue = JSON.stringify(value);
        await this.client.setex(fullKey, ttlSeconds, serializedValue);
        // console.log(`[Redis] Cache armazenado: ${key}`);
        return true;
      } catch (error: any) {
        console.warn(`[Redis] Erro ao armazenar ${key}: ${error.message}`);
      }
    }

    // Fallback para memória
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.memoryFallback.set(fullKey, { value, expires: expiresAt });
    // console.log(`[Redis] Cache em memória armazenado: ${key}`);
    return true;
  }

  async get(key: string): Promise<any | null> {
    const fullKey = `famachat:${key}`;
    
    if (this.isConnected && this.client) {
      try {
        const result = await this.client.get(fullKey);
        if (result) {
          return JSON.parse(result);
        }
      } catch (error: any) {
        console.warn(`[Redis] Erro ao recuperar ${key}: ${error.message}`);
      }
    }

    // Fallback para memória
    const cached = this.memoryFallback.get(fullKey);
    if (cached) {
      if (Date.now() < cached.expires) {
        return cached.value;
      } else {
        this.memoryFallback.delete(fullKey);
      }
    }
    
    // console.log(`[Redis] Cache não encontrado: ${key}`);
    return null;
  }

  async del(key: string): Promise<boolean> {
    const fullKey = `famachat:${key}`;
    
    if (this.isConnected && this.client) {
      try {
        await this.client.del(fullKey);
        return true;
      } catch (error: any) {
        console.warn(`[Redis] Erro ao deletar ${key}: ${error.message}`);
      }
    }

    // Fallback para memória
    this.memoryFallback.delete(fullKey);
    // console.log(`[Redis] Cache removido da memória: ${key}`);
    return true;
  }

  async flushAll(): Promise<boolean> {
    if (this.isConnected && this.client) {
      try {
        await this.client.flushdb();
        return true;
      } catch (error: any) {
        console.warn(`[Redis] Erro ao limpar cache: ${error.message}`);
      }
    }

    // Fallback para memória
    this.memoryFallback.clear();
    console.log('[Redis] Cache em memória limpo');
    return true;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'memory',
      memoryKeys: this.memoryFallback.size,
      redisHost: this.isConnected ? '144.126.134.23:6379' : 'local',
      keyPrefix: 'famachat:'
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }
}

export const redisManager = new RedisManager();