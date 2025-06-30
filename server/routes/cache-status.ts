/**
 * Rota para monitorar status do cache Redis/Memória
 */

import { Express } from "express";
import { getCacheStatus } from "../utils/enhanced-cache";
import { redisClient } from "../utils/redis-client";
import { logger } from "../utils/logger";

export function registerCacheRoutes(app: Express): void {
  
  // Status do cache
  app.get("/api/cache/status", async (req, res) => {
    try {
      const status = await getCacheStatus();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        cache: status
      });
    } catch (error) {
      logger.error(`Erro ao obter status do cache: ${error}`);
      res.status(500).json({
        success: false,
        error: "Erro ao obter status do cache"
      });
    }
  });

  // Limpar cache
  app.post("/api/cache/clear", async (req, res) => {
    try {
      await redisClient.flushAll();
      
      res.json({
        success: true,
        message: "Cache limpo com sucesso",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Erro ao limpar cache: ${error}`);
      res.status(500).json({
        success: false,
        error: "Erro ao limpar cache"
      });
    }
  });

  // Estatísticas detalhadas
  app.get("/api/cache/stats", async (req, res) => {
    try {
      const status = await getCacheStatus();
      
      // Adicionar informações de sistema
      const stats = {
        ...status,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      };
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        stats
      });
    } catch (error) {
      logger.error(`Erro ao obter estatísticas do cache: ${error}`);
      res.status(500).json({
        success: false,
        error: "Erro ao obter estatísticas do cache"
      });
    }
  });
}