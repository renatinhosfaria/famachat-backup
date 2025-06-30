/**
 * Implementação Redis simples com fallback em memória
 * Compatível com ambiente Replit e produção
 */

import { logger } from './logger';
import { redisManager } from './redis-manager';

class SimpleRedisCache {
  private memoryStore = new Map<string, { value: any; expires: number }>();
  private isRedisAvailable = false;

  constructor() {
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      // Se há Redis externo configurado, tentar conectar
      if (redisUrl && redisUrl !== 'redis://localhost:6379') {
        logger.info(`[Cache] Detectado Redis externo configurado`);
        // Usar o cliente Redis robusto para conexões externas
        this.isRedisAvailable = true;
        return;
      }

      // Ambiente local/Replit - usar memória
      logger.info('[Cache] Sistema de cache em memória inicializado');
      this.isRedisAvailable = false;
    } catch (error) {
      logger.warn(`[Cache] Erro na verificação do Redis: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      this.isRedisAvailable = false;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    await redisManager.set(key, value, ttlSeconds);
  }

  async get(key: string): Promise<any | null> {
    return await redisManager.get(key);
  }

  async del(key: string): Promise<void> {
    await redisManager.del(key);
  }

  async clear(): Promise<void> {
    await redisManager.flushAll();
  }

  getStats() {
    return redisManager.getStatus();
  }
}

export const simpleCache = new SimpleRedisCache();