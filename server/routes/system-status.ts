/**
 * Rotas para monitoramento do sistema
 */

import { Express } from "express";
import { simpleCache } from "../utils/simple-redis";
import { logger } from "../utils/logger";

export function registerSystemRoutes(app: Express): void {
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0"
    });
  });

  // Status do cache
  app.get("/api/system/cache", async (req, res) => {
    try {
      const stats = simpleCache.getStats();
      
      res.json({
        success: true,
        cache: stats,
        timestamp: new Date().toISOString()
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
  app.post("/api/system/cache/clear", async (req, res) => {
    try {
      await simpleCache.clear();
      
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

  // Estatísticas do sistema
  app.get("/api/system/stats", (req, res) => {
    const memUsage = process.memoryUsage();
    
    res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + " MB",
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB"
        }
      },
      cache: simpleCache.getStats(),
      timestamp: new Date().toISOString()
    });
  });
}