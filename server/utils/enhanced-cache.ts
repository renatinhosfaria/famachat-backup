/**
 * Sistema de cache aprimorado com Redis + fallback em memória
 * Substitui o cache simples em memória por uma solução mais robusta
 */

import { redisClient } from './redis-client';
import { logger } from './logger';

export class EnhancedCache<T = any> {
  private memoryCache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private keyPrefix: string;

  constructor(keyPrefix: string = '') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Define um valor no cache com TTL
   */
  async set(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    try {
      // Tentar Redis primeiro
      await redisClient.set(fullKey, JSON.stringify(data), ttlSeconds);
      
      // Manter também em memória como backup
      this.memoryCache.set(fullKey, {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      });

      logger.debug(`[Cache] Dados armazenados: ${fullKey} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.warn(`[Cache] Erro ao armazenar ${fullKey}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      // Fallback apenas em memória
      this.memoryCache.set(fullKey, {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      });
    }
  }

  /**
   * Obtém um valor do cache
   */
  async get(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    
    try {
      // Tentar Redis primeiro
      const redisData = await redisClient.get(fullKey);
      if (redisData !== null) {
        logger.debug(`[Cache] Dados obtidos do Redis: ${fullKey}`);
        
        // Atualizar cache em memória para sincronização
        this.memoryCache.set(fullKey, {
          data: redisData,
          timestamp: Date.now(),
          ttl: 3600 * 1000 // TTL padrão para sincronização
        });
        
        return redisData;
      }
    } catch (error) {
      logger.warn(`[Cache] Erro ao buscar no Redis ${fullKey}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // Fallback para memória
    const memoryData = this.memoryCache.get(fullKey);
    if (memoryData) {
      const now = Date.now();
      
      // Verificar se expirou
      if (now - memoryData.timestamp > memoryData.ttl) {
        this.memoryCache.delete(fullKey);
        logger.debug(`[Cache] Dados expirados removidos da memória: ${fullKey}`);
        return null;
      }
      
      logger.debug(`[Cache] Dados obtidos da memória: ${fullKey}`);
      return memoryData.data;
    }

    return null;
  }

  /**
   * Remove um valor do cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    try {
      await redisClient.del(fullKey);
    } catch (error) {
      logger.warn(`[Cache] Erro ao deletar do Redis ${fullKey}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    this.memoryCache.delete(fullKey);
    logger.debug(`[Cache] Dados removidos: ${fullKey}`);
  }

  /**
   * Verifica se uma chave existe no cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    
    try {
      const redisExists = await redisClient.exists(fullKey);
      if (redisExists) {
        return true;
      }
    } catch (error) {
      logger.warn(`[Cache] Erro ao verificar existência no Redis ${fullKey}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    // Verificar na memória
    const memoryData = this.memoryCache.get(fullKey);
    if (memoryData) {
      const now = Date.now();
      
      if (now - memoryData.timestamp > memoryData.ttl) {
        this.memoryCache.delete(fullKey);
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Limpa todo o cache
   */
  async clear(): Promise<void> {
    try {
      // Limpar apenas as chaves com o prefixo no Redis seria ideal,
      // mas para simplicidade vamos limpar tudo
      await redisClient.flushAll();
    } catch (error) {
      logger.warn(`[Cache] Erro ao limpar Redis: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    this.memoryCache.clear();
    logger.debug(`[Cache] Cache limpo completamente`);
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): { memoryKeys: number; prefix: string; redisStatus: any } {
    return {
      memoryKeys: this.memoryCache.size,
      prefix: this.keyPrefix,
      redisStatus: redisClient.getConnectionStatus()
    };
  }

  private getFullKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }
}

// Cache específicos para diferentes tipos de dados
export const clienteCache = new EnhancedCache<any>('clientes');
export const userCache = new EnhancedCache<any>('users');
export const appointmentCache = new EnhancedCache<any>('appointments');
export const performanceCache = new EnhancedCache<any>('performance');
export const apiCache = new EnhancedCache<any>('api');

// Função para obter status geral do cache
export async function getCacheStatus() {
  return {
    redis: redisClient.getConnectionStatus(),
    caches: {
      clientes: clienteCache.getStats(),
      users: userCache.getStats(),
      appointments: appointmentCache.getStats(),
      performance: performanceCache.getStats(),
      api: apiCache.getStats()
    }
  };
}