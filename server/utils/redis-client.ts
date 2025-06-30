/**
 * Cliente Redis com fallback para cache em memória
 * Funciona tanto no Replit quanto em produção
 */

import Redis from 'ioredis';
import { logger } from './logger';

type CacheValue = string | number | Buffer | object;

class RedisManager {
  private client: Redis | null = null;
  private isConnected = false;
  private memoryCache = new Map<string, { value: any; expires: number }>();
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Verificar se há URL Redis externa configurada
      const redisUrl = process.env.REDIS_URL;
      
      let redisConfig: any;
      
      if (redisUrl && redisUrl !== 'redis://localhost:6379') {
        // Usar Redis externo (produção)
        logger.info(`[Redis] Conectando ao Redis externo: ${redisUrl.replace(/:[^:]*@/, ':***@')}`);
        redisConfig = redisUrl;
      } else {
        // Configuração local/Replit
        redisConfig = {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
        };
      }

      this.client = new Redis(redisConfig);

      // Tentar conectar
      await this.client.connect();
      
      // Testar conexão
      await this.client.ping();
      
      this.isConnected = true;
      logger.info('[Redis] Conexão estabelecida com sucesso');

      // Eventos de conexão
      this.client.on('connect', () => {
        logger.info('[Redis] Conectado');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        logger.warn(`[Redis] Erro de conexão: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('[Redis] Conexão fechada');
        this.isConnected = false;
      });

    } catch (error) {
      this.connectionAttempts++;
      logger.warn(`[Redis] Falha na conexão (tentativa ${this.connectionAttempts}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        logger.info('[Redis] Usando cache em memória como fallback');
        this.isConnected = false;
        this.client = null;
      } else {
        // Tentar novamente em 5 segundos
        setTimeout(() => this.initializeRedis(), 5000);
      }
    }
  }

  async set(key: string, value: CacheValue, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await this.client.setex(key, ttlSeconds, serializedValue);
        return true;
      } else {
        // Fallback para cache em memória
        const expires = Date.now() + (ttlSeconds * 1000);
        this.memoryCache.set(key, { value, expires });
        return true;
      }
    } catch (error) {
      logger.warn(`[Redis] Erro ao definir chave ${key}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      // Fallback para memória em caso de erro
      const expires = Date.now() + (ttlSeconds * 1000);
      this.memoryCache.set(key, { value, expires });
      return true;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      if (this.isConnected && this.client) {
        const result = await this.client.get(key);
        if (result === null) return null;
        
        // Tentar fazer parse do JSON, senão retornar string
        try {
          return JSON.parse(result);
        } catch {
          return result;
        }
      } else {
        // Fallback para cache em memória
        const cached = this.memoryCache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expires) {
          this.memoryCache.delete(key);
          return null;
        }
        
        return cached.value;
      }
    } catch (error) {
      logger.warn(`[Redis] Erro ao buscar chave ${key}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      // Fallback para memória
      const cached = this.memoryCache.get(key);
      if (!cached) return null;
      
      if (Date.now() > cached.expires) {
        this.memoryCache.delete(key);
        return null;
      }
      
      return cached.value;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      }
      // Sempre remover da memória também
      this.memoryCache.delete(key);
      return true;
    } catch (error) {
      logger.warn(`[Redis] Erro ao deletar chave ${key}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      this.memoryCache.delete(key);
      return true;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        const result = await this.client.exists(key);
        return result === 1;
      } else {
        const cached = this.memoryCache.get(key);
        if (!cached) return false;
        
        if (Date.now() > cached.expires) {
          this.memoryCache.delete(key);
          return false;
        }
        
        return true;
      }
    } catch (error) {
      logger.warn(`[Redis] Erro ao verificar existência da chave ${key}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      const cached = this.memoryCache.get(key);
      if (!cached) return false;
      
      if (Date.now() > cached.expires) {
        this.memoryCache.delete(key);
        return false;
      }
      
      return true;
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        await this.client.flushall();
      }
      this.memoryCache.clear();
      return true;
    } catch (error) {
      logger.warn(`[Redis] Erro ao limpar cache: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      this.memoryCache.clear();
      return true;
    }
  }

  getConnectionStatus(): { isConnected: boolean; mode: 'redis' | 'memory' } {
    return {
      isConnected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'memory'
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.isConnected = false;
    this.memoryCache.clear();
  }
}

// Instância singleton
export const redisClient = new RedisManager();

// Exportar para compatibilidade
export default redisClient;