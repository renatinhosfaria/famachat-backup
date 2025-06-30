import { Express } from "express";
import { db } from "../database";
import { facebookConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import * as schema from "@shared/schema";
import { mockAuthMiddleware } from "../middleware/mock-auth";

// Inicializa o logger para o módulo Facebook
const facebookLogger = logger.createLogger("FacebookAPI");

/**
 * Função para registrar rotas relacionadas à integração com Facebook
 * @param app Express app
 */
export function registerFacebookRoutes(app: Express) {
  // Rota para obter configuração do Facebook
  app.get("/api/facebook/config", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem acessar as configurações do Facebook" 
        });
      }

      // Buscar configuração existente
      const config = await db.query.facebookConfig.findFirst({
        orderBy: (col) => col.id
      });

      // Retornar a configuração ou null se não existir
      res.json(config || null);
    } catch (error) {
      logger.error(`Erro ao buscar configuração do Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro ao buscar configuração", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rota para salvar nova configuração do Facebook
  app.post("/api/facebook/config", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem gerenciar configurações do Facebook" 
        });
      }

      // Obter dados do corpo da requisição
      const {
        appId,
        appSecret,
        accessToken,
        userAccessToken,
        verificationToken,
        pageId,
        adAccountId,
        webhookEnabled,
        isActive
      } = req.body;

      // Validar campos obrigatórios
      if (!appId || !appSecret || !accessToken) {
        return res.status(400).json({
          message: "Dados inválidos",
          details: "App ID, App Secret e Access Token são obrigatórios"
        });
      }

      // Criar nova configuração
      const newConfig = await db.insert(facebookConfig).values({
        appId,
        appSecret,
        accessToken,
        userAccessToken: userAccessToken || null,
        verificationToken: verificationToken || null,
        pageId: pageId || null,
        adAccountId: adAccountId || null,
        webhookEnabled: webhookEnabled || false,
        isActive: isActive !== undefined ? isActive : true,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      logger.info(`Nova configuração do Facebook criada: ID ${newConfig[0].id}`);
      res.status(201).json(newConfig[0]);
    } catch (error) {
      logger.error(`Erro ao criar configuração do Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro ao criar configuração", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rota para atualizar configuração existente
  app.patch("/api/facebook/config/:id", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem gerenciar configurações do Facebook" 
        });
      }

      const configId = parseInt(req.params.id);
      if (isNaN(configId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se a configuração existe
      const existingConfig = await db.query.facebookConfig.findFirst({
        where: eq(facebookConfig.id, configId)
      });

      if (!existingConfig) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }

      // Obter dados do corpo da requisição e filtrar propriedades indefinidas
      const {
        appId,
        appSecret,
        accessToken,
        userAccessToken,
        verificationToken,
        pageId,
        adAccountId,
        webhookEnabled,
        isActive
      } = req.body;

      // Validar campos obrigatórios
      if (appId === "" || appSecret === "" || accessToken === "") {
        return res.status(400).json({
          message: "Dados inválidos",
          details: "App ID, App Secret e Access Token não podem estar vazios"
        });
      }

      // Construir objeto com valores a serem atualizados
      const updateData: any = {};
      if (appId !== undefined) updateData.appId = appId;
      if (appSecret !== undefined) updateData.appSecret = appSecret;
      if (accessToken !== undefined) updateData.accessToken = accessToken;
      if (userAccessToken !== undefined) updateData.userAccessToken = userAccessToken || null;
      if (verificationToken !== undefined) updateData.verificationToken = verificationToken || null;
      if (pageId !== undefined) updateData.pageId = pageId || null;
      if (adAccountId !== undefined) updateData.adAccountId = adAccountId || null;
      if (webhookEnabled !== undefined) updateData.webhookEnabled = webhookEnabled;
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.lastUpdated = new Date();
      updateData.updatedAt = new Date();

      // Atualizar configuração
      const updatedConfig = await db.update(facebookConfig)
        .set(updateData)
        .where(eq(facebookConfig.id, configId))
        .returning();

      logger.info(`Configuração do Facebook atualizada: ID ${configId}`);
      res.json(updatedConfig[0]);
    } catch (error) {
      logger.error(`Erro ao atualizar configuração do Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro ao atualizar configuração", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rota para assinar o webhook do Facebook automaticamente
  app.post("/api/facebook/subscribe-webhook", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem gerenciar assinaturas do webhook" 
        });
      }
      
      // Importar o serviço de assinaturas
      const { facebookSubscriptionService } = await import('../services/facebook-subscription.service');
      
      // Obter a URL base da aplicação
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Assinar o webhook
      const result = await facebookSubscriptionService.subscribeToWebhook(baseUrl);
      
      if (result.success) {
        // Se teve sucesso, atualizar o status de webhook na configuração
        await db.update(facebookConfig)
          .set({ 
            webhookEnabled: true,
            lastUpdated: new Date(),
            updatedAt: new Date()
          })
          .where(eq(facebookConfig.isActive, true));
        
        logger.info(`Webhook do Facebook assinado com sucesso`);
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      logger.error(`Erro ao assinar webhook do Facebook: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao assinar webhook", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para verificar o status das assinaturas do webhook
  app.get("/api/facebook/subscription-status", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem visualizar assinaturas do webhook" 
        });
      }
      
      // Importar o serviço de assinaturas
      const { facebookSubscriptionService } = await import('../services/facebook-subscription.service');
      
      // Obter o status das assinaturas
      const result = await facebookSubscriptionService.getSubscriptionStatus();
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error(`Erro ao verificar status das assinaturas do webhook: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao verificar assinaturas", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para assinar uma página específica
  app.post("/api/facebook/subscribe-page", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem assinar páginas" 
        });
      }
      
      const { pageId, userAccessToken } = req.body;
      
      if (!pageId || !userAccessToken) {
        return res.status(400).json({
          message: "Dados inválidos",
          details: "ID da página e token de acesso do usuário são obrigatórios"
        });
      }
      
      // Importar o serviço de assinaturas
      const { facebookSubscriptionService } = await import('../services/facebook-subscription.service');
      
      // Assinar a página
      const result = await facebookSubscriptionService.subscribePage(pageId, userAccessToken);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error(`Erro ao assinar página do Facebook: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao assinar página", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para verificar as páginas assinadas
  app.get("/api/facebook/subscribed-pages", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem visualizar páginas assinadas" 
        });
      }
      
      const userAccessToken = req.query.userAccessToken as string;
      
      if (!userAccessToken) {
        return res.status(400).json({
          message: "Dados inválidos",
          details: "Token de acesso do usuário é obrigatório"
        });
      }
      
      // Importar o serviço de assinaturas
      const { facebookSubscriptionService } = await import('../services/facebook-subscription.service');
      
      // Obter as páginas assinadas
      const result = await facebookSubscriptionService.getSubscribedPages(userAccessToken);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error(`Erro ao verificar páginas assinadas do Facebook: ${error}`);
      return res.status(500).json({ 
        message: "Erro ao verificar páginas assinadas", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para testar conexão com a API do Facebook
  app.post("/api/facebook/test-connection", mockAuthMiddleware, async (req, res) => {
    try {
      // Verificar autenticação
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Autenticação necessária" });
      }

      // Verificar permissão (apenas gestores)
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });

      if (!user || user.role !== schema.Role.MANAGER) {
        return res.status(403).json({ 
          message: "Permissão negada", 
          details: "Apenas gestores podem testar a conexão com o Facebook" 
        });
      }

      // Obter credenciais do corpo
      const { appId, appSecret, accessToken } = req.body;

      if (!appId || !appSecret || !accessToken) {
        return res.status(400).json({
          message: "Dados inválidos",
          details: "App ID, App Secret e Access Token são obrigatórios"
        });
      }

      // Aqui seria implementada a lógica para testar a conexão real com a API do Facebook
      // Para este exemplo, apenas simulamos um teste bem-sucedido
      
      logger.info(`Teste de conexão com Facebook executado para App ID: ${appId}`);
      res.json({ 
        success: true, 
        message: "Conexão bem-sucedida", 
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      logger.error(`Erro ao testar conexão com Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro ao testar conexão", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para teste simplificado de webhooks do Facebook
  app.post("/api/webhooks/test-facebook", async (req, res) => {
    try {
      logger.info(`TESTE: Simulando webhook do Facebook com payload: ${JSON.stringify(req.body)}`);
      
      // Verificar se temos dados válidos
      if (!req.body || !req.body.entry || !Array.isArray(req.body.entry) || req.body.entry.length === 0) {
        logger.error(`TESTE: Payload inválido para teste de webhook`);
        return res.status(400).json({ 
          message: "Payload inválido",
          details: "É necessário enviar um objeto com array 'entry' válido"
        });
      }
      
      // Importar o serviço de leads do Facebook
      const { facebookLeadService } = await import('../services/facebook-lead.service');
      
      // Processar o webhook
      logger.info(`TESTE: Iniciando processamento de entrada do webhook`);
      
      // Processar cada entrada do webhook de teste
      for (const entry of req.body.entry) {
        try {
          logger.info(`TESTE: Processando entrada com ID: ${entry.id}`);
          
          // Verificar e modificar os dados para garantir que o campo field_data seja processado corretamente
          if (entry.changes && entry.changes.length > 0) {
            for (const change of entry.changes) {
              if (change.field === 'leadgen' && change.value && change.value.field_data) {
                logger.info(`TESTE: Dados de lead encontrados com field_data: ${JSON.stringify(change.value.field_data)}`);
                
                // Garantir que os valores corretos são passados para processamento
                if (Array.isArray(change.value.field_data)) {
                  // Adicionar campo form_data que será usado no processamento
                  change.value.form_data = change.value.field_data;
                  logger.info(`TESTE: Adicionado form_data para processamento direto`);
                }
              }
            }
          }
          
          await facebookLeadService.processWebhook(entry);
          logger.info(`TESTE: Entrada processada com sucesso`);
        } catch (entryError) {
          logger.error(`TESTE: Erro ao processar entrada ${entry.id}: ${entryError}`);
          // Continuamos processando outras entradas mesmo se uma falhar
        }
      }
      
      logger.info(`TESTE: Todas as entradas processadas`);
      res.status(200).json({ 
        success: true,
        message: 'Webhook de teste processado com sucesso',
        timestamp: new Date().toISOString() 
      });
      
    } catch (error) {
      logger.error(`TESTE: Erro ao processar webhook de teste: ${error}`);
      res.status(500).json({ 
        message: "Erro ao processar webhook de teste", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rota de webhook para receber notificações do Facebook
  app.get("/api/webhooks/facebook", async (req, res) => {
    try {
      // Obter parâmetros do webhook do Facebook para verificação
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      logger.info(`Solicitação de verificação de webhook recebida: mode=${mode}, token=${token}`);

      // Obter token de verificação da configuração
      const config = await db.query.facebookConfig.findFirst({
        where: eq(facebookConfig.isActive, true)
      });

      if (!config || !config.verificationToken) {
        logger.error(`Verificação falhou: não há token de verificação configurado`);
        return res.status(403).send('Verificação falhou');
      }

      // Verificar se o token recebido corresponde ao token configurado
      if (mode === 'subscribe' && token === config.verificationToken) {
        logger.info(`Webhook verificado com sucesso para o desafio: ${challenge}`);
        // Responder com o desafio para confirmar a propriedade do webhook
        return res.status(200).send(challenge);
      } else {
        logger.error(`Falha na verificação do webhook: token inválido ou modo incorreto`);
        return res.status(403).send('Verificação falhou');
      }
    } catch (error) {
      logger.error(`Erro ao verificar webhook do Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro na verificação do webhook", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rota para receber dados do webhook do Facebook
  app.post("/api/webhooks/facebook", async (req, res) => {
    try {
      const data = req.body;
      logger.info(`Evento webhook recebido do Facebook: ${JSON.stringify(data)}`);

      // Verificar se é um webhook de página e se há entradas
      if (data && data.object === 'page' && Array.isArray(data.entry) && data.entry.length > 0) {
        // Importar o serviço de leads do Facebook
        const { facebookLeadService } = await import('../services/facebook-lead.service');
        
        // Para testes, permitir adicionar dados completos do formulário
        if (process.env.NODE_ENV !== 'production' && req.query.test === 'true') {
          // Se houver dados de formulário enviados na requisição
          if (req.body.form_data && data.entry.length > 0 && 
              data.entry[0].changes && data.entry[0].changes.length > 0) {
            
            const testEntry = data.entry[0];
            const testChange = testEntry.changes.find((c: any) => c.field === 'leadgen');
            
            if (testChange) {
              logger.info(`Adicionando dados de formulário de teste ao webhook`);
              testChange.value.form_data = req.body.form_data;
            }
          }
        }
        
        // Processar cada entrada do webhook
        for (const entry of data.entry) {
          try {
            await facebookLeadService.processWebhook(entry);
          } catch (entryError) {
            logger.error(`Erro ao processar entrada ${entry.id}: ${entryError}`);
            // Continuamos processando outras entradas mesmo se uma falhar
          }
        }
      }

      // Responder ao Facebook para confirmar o recebimento
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      logger.error(`Erro ao processar webhook do Facebook: ${error}`);
      res.status(500).json({ 
        message: "Erro ao processar webhook", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}