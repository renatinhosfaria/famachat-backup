/**
 * Rota de teste para distribuição de leads
 */
import { Express } from "express";
import { logger } from "../utils/logger";
import { processLeadAutomation, LeadProcessingType } from "../services/lead-automation.service";

/**
 * Registra rotas para testar a distribuição de leads
 */
export function registerTestLeadDistributionRoutes(app: Express) {
  // Rota para testar a distribuição de leads
  app.post("/api/test/lead-distribution", async (req, res) => {
    try {
      logger.info("Iniciando teste de distribuição de leads");
      
      // Dados básicos para o lead de teste
      const testLead = {
        fullName: req.body.fullName || `Teste Lead ${new Date().toISOString().slice(0, 10)}`,
        email: req.body.email || `teste${Date.now()}@exemplo.com`,
        phone: req.body.phone || `11${Math.floor(Math.random() * 100000000)}`,
        source: "Teste Distribuição",
        notes: "Lead criado para testar o sistema de distribuição round-robin"
      };
      
      // Processa o lead usando o serviço de automação
      const result = await processLeadAutomation({
        type: LeadProcessingType.NEW_LEAD,
        lead: testLead
      });
      
      logger.info(`Resultado do teste de distribuição: ${JSON.stringify(result)}`);
      
      // Retorna o resultado
      res.json({
        success: true,
        message: "Teste de distribuição executado com sucesso",
        distributionResult: result
      });
    } catch (error) {
      logger.error(`Erro no teste de distribuição: ${error}`);
      res.status(500).json({
        success: false,
        message: "Erro ao executar teste de distribuição",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}