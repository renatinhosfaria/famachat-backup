/**
 * Rotas para o serviço de validação sequencial de números de WhatsApp
 */

import { Express } from "express";
import { logger } from "../utils/logger";
import { storage } from "../storage";
import { WhatsAppInstanceStatus } from "@shared/schema";
import {
  startSequentialValidation,
  getValidationQueueStatus,
  stopSequentialValidation
} from "../services/sequential-validation";

export function setupSequentialValidationRoutes(app: Express): void {
  // Iniciar validação sequencial
  app.post("/api/whatsapp/sequential-validation/start", async (req, res) => {
    try {
      // Verificar se há instância disponível
      const instances = await storage.getWhatsappInstances();
      
      // Procurar instância conectada com diferentes possíveis status
      const connectedInstance = instances.find(inst => {
        const status = inst.status?.toLowerCase();
        return status === 'connected' || 
               status === 'conectado' || 
               status === 'open' || 
               status === WhatsAppInstanceStatus.CONNECTED.toLowerCase();
      });
      
      if (!connectedInstance) {
        logger.warn(`Nenhuma instância conectada encontrada. Instâncias disponíveis: ${instances.map(i => `${i.instanceName}:${i.status}`).join(', ')}`);
        return res.status(400).json({ 
          message: "Nenhuma instância do WhatsApp conectada", 
          error: "no_connected_instance",
          errorMessage: "É necessário conectar uma instância do WhatsApp para iniciar a validação."
        });
      }
      
      // Iniciar o processo de validação sequencial
      const status = await startSequentialValidation(connectedInstance.instanceName);
      
      return res.status(200).json({
        message: "Validação sequencial iniciada com sucesso",
        status
      });
    } catch (error) {
      logger.error(`Erro ao iniciar validação sequencial: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao iniciar validação sequencial", 
        error: "start_failed",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Cache para o status da validação sequencial
  let statusCache = {
    data: null as any,
    timestamp: 0,
    expiresAt: 0
  };
  const STATUS_CACHE_TTL = 3000; // 3 segundos de cache para evitar múltiplas requisições seguidas
  
  // Obter status da validação sequencial (com cache)
  app.get("/api/whatsapp/sequential-validation/status", (req, res) => {
    try {
      const now = Date.now();
      const forceRefresh = req.query.force === 'true';
      
      // Se não estiver forçando atualização e tiver cache válido, retornar o cache
      if (!forceRefresh && statusCache.data && statusCache.expiresAt > now) {
        // Usar cache
        logger.debug("Retornando status da validação sequencial em cache");
        return res.status(200).json(statusCache.data);
      }
      
      // Buscar status atual
      const status = getValidationQueueStatus();
      
      // Preparar resposta
      const responseData = {
        message: "Status da validação sequencial obtido com sucesso",
        status
      };
      
      // Armazenar em cache apenas se o processo estiver em andamento
      // Caso contrário, não precisamos de cache, pois não muda frequentemente
      if (status.isProcessing) {
        statusCache = {
          data: responseData,
          timestamp: now,
          expiresAt: now + STATUS_CACHE_TTL
        };
      }
      
      return res.status(200).json(responseData);
    } catch (error) {
      logger.error(`Erro ao obter status da validação sequencial: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao obter status da validação sequencial", 
        error: "status_failed",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Parar validação sequencial
  app.post("/api/whatsapp/sequential-validation/stop", (req, res) => {
    try {
      const status = stopSequentialValidation();
      
      return res.status(200).json({
        message: "Validação sequencial interrompida com sucesso",
        status
      });
    } catch (error) {
      logger.error(`Erro ao interromper validação sequencial: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao interromper validação sequencial", 
        error: "stop_failed",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
}