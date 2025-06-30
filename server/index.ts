import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db, pool, testConnection } from "./database";
import { migrate } from "./migrate";
import path from "path";
import { whatsappApi } from "./services/whatsapp-api";
import { logger } from "./utils/logger";
import { slaCascataService } from "./services/sla-cascata-simple.service";
import { automationInitializer } from "./services/automation-initializer";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Função para corrigir problemas de encoding em strings
function fixEncoding(input: any): any {
  if (typeof input === 'string') {
    // Correções específicas
    if (input === 'OpÃ§Ã£o' || input === 'OpÃ§Ã£o ') {
      return 'Opção';
    }
    
    // Substituições gerais de caracteres mal-codificados
    return input
      .replace(/Ã£/g, 'ã')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã©/g, 'é')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã³/g, 'ó')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã¢/g, 'â')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã­/g, 'í')
      .replace(/Ã"/g, 'Ã')
      .replace(/Ã‡/g, 'Ç');
  } else if (Array.isArray(input)) {
    return input.map(item => fixEncoding(item));
  } else if (input !== null && typeof input === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = fixEncoding(value);
    }
    return result;
  }
  return input;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // Corrigir problemas de encoding na resposta antes de enviar
    capturedJsonResponse = bodyJson;
    
    // Aplicar correção de encoding se for a rota de proprietários
    if (req.path.includes('/proprietarios')) {
      const fixedResponse = fixEncoding(bodyJson);
      return originalResJson.apply(res, [fixedResponse, ...args]);
    }
    
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        let responseText = JSON.stringify(capturedJsonResponse);
        if (responseText.length > 80) {
          responseText = responseText.slice(0, 79) + "…";
        }
        logLine += ` :: ${responseText}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Testa a conexão com o banco de dados
  try {
    await testConnection();
    logger.info("Conexão com PostgreSQL estabelecida com sucesso!");
    
    // Executar o sistema de migrações centralizado
    logger.info("Executando sistema de migrações centralizado...");
    await migrate();
    
    logger.info("Todas as migrações foram executadas com sucesso!");
    
    // Configurar diretório de uploads - apontar para o diretório server/uploads
    const uploadsDir = path.resolve(process.cwd(), 'server/uploads');
    logger.info(`Diretório de uploads configurado em: ${uploadsDir}`);
    
    // Middleware de debug para rotas estáticas
    app.use((req, res, next) => {
      if (req.path.startsWith('/uploads/') || req.path.startsWith('/upload/')) {
        logger.info(`Requisição de arquivo estático: ${req.path}`);
      }
      next();
    });
    
    // Servir arquivos estáticos de uploads com handler de erro
    app.use('/uploads', (req, res, next) => {
      express.static(uploadsDir, { index: false })(req, res, (err) => {
        if (err) {
          log(`Erro ao servir arquivo estático ${req.path}: ${err.message}`, "error");
          res.status(404).send(`Arquivo não encontrado: ${req.path}`);
        } else {
          next();
        }
      });
    });
    
    // Servir os mesmos arquivos em /upload para compatibilidade com URLs existentes
    app.use('/upload', (req, res, next) => {
      express.static(uploadsDir, { index: false })(req, res, (err) => {
        if (err) {
          logger.error(`Erro ao servir arquivo estático ${req.path}: ${err.message}`);
          res.status(404).send(`Arquivo não encontrado: ${req.path}`);
        } else {
          next();
        }
      });
    });
    logger.info(`Configurada rota de compatibilidade para arquivos em /upload -> uploads`);
    
    // Inicializar serviço de API do WhatsApp
    // Forçar URL correta devido a problema de cache de variáveis de ambiente
    const apiUrl = "https://evolution.famachat.com.br";
    const apiKey = "IwOLgVnyOfbN";
    if (apiUrl && apiKey) {
      whatsappApi.initialize(apiUrl, apiKey);
      logger.info("Serviço de API do WhatsApp inicializado com sucesso");
      logger.info(`Intervalo entre requisições: 10 segundos`);
    } else {
      logger.warn("Configuração da API do WhatsApp não encontrada nas variáveis de ambiente");
    }

    // Inicializar serviço de SLA em cascata (legado - compatibilidade)
    slaCascataService.iniciarProcessamentoAutomatico();
    logger.info("Serviço de SLA em cascata (legado) inicializado com sucesso");

    // Inicializar novo sistema de automação SLA Cascata Paralelo
    await automationInitializer.initialize();
    logger.info("Sistema de automação SLA Cascata Paralelo inicializado com sucesso");
  } catch (error) {
    logger.error(`Erro ao conectar com PostgreSQL ou executar migrações: ${error}`);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Em ambiente de produção, não expor detalhes técnicos de erros
    const isProd = process.env.NODE_ENV === 'production';
    
    // Gerar ID de erro único para referência
    const errorId = Math.random().toString(36).substring(2, 15);
    
    // Categorizar erros para mensagens mais úteis mesmo em produção
    let publicMessage = "";
    if (status === 400) {
      publicMessage = "Requisição inválida. Verifique os dados fornecidos.";
    } else if (status === 401) {
      publicMessage = "Autenticação necessária para acessar este recurso.";
    } else if (status === 403) {
      publicMessage = "Você não tem permissão para acessar este recurso.";
    } else if (status === 404) {
      publicMessage = "Recurso não encontrado.";
    } else if (status === 409) {
      publicMessage = "Conflito ao processar a requisição. O recurso pode já existir.";
    } else if (status >= 500) {
      publicMessage = `Ocorreu um erro interno no servidor. Código de erro: ${errorId}`;
    } else {
      publicMessage = "Ocorreu um erro ao processar sua requisição.";
    }
      
    // Mensagem original do erro para desenvolvimento
    const devMessage = err.message || "Internal Server Error";
    
    // Sanitizar informações sensíveis (eliminar senhas, tokens, etc)
    const sanitizedError = { ...err };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    if (sanitizedError.config && sanitizedError.config.headers) {
      sensitiveFields.forEach(field => {
        if (sanitizedError.config.headers[field]) {
          sanitizedError.config.headers[field] = '[REDACTED]';
        }
      });
    }
    
    if (sanitizedError.request && sanitizedError.request.body) {
      sensitiveFields.forEach(field => {
        if (sanitizedError.request.body[field]) {
          sanitizedError.request.body[field] = '[REDACTED]';
        }
      });
    }
    
    // Log detalhado do erro para depuração no servidor
    const errorDetails = {
      errorId,
      message: devMessage,
      status,
      stack: sanitizedError.stack,
      timestamp: new Date().toISOString()
    };
    
    // Em produção, logar erro detalhado, mas responder apenas com mensagem genérica
    if (isProd) {
      logger.error(`Erro [${status}] ID:${errorId}: ${JSON.stringify(errorDetails)}`);
      res.status(status).json({ 
        success: false,
        message: publicMessage,
        errorId: errorId
      });
    } else {
      // Em desenvolvimento, expor mais detalhes
      logger.error(`Erro [${status}] ID:${errorId}: ${devMessage}`);
      res.status(status).json({ 
        success: false,
        message: devMessage,
        errorId: errorId,
        details: sanitizedError.details || undefined,
        stack: process.env.NODE_ENV === 'development' ? sanitizedError.stack : undefined
      });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Usar a porta definida no .env baseada no ambiente
  // DEV_PORT para desenvolvimento (tsx), PORT para produção (node)
  const isDevelopment = process.argv[0].includes('tsx') || 
                        process.argv.join(' ').includes('tsx') ||
                        process.env.NODE_ENV === 'development';
  
  // Para desenvolvimento: 3000, para produção: 5000
  const defaultPort = isDevelopment ? 3000 : 5000;
  const envPort = isDevelopment ? process.env.DEV_PORT : process.env.PORT;
  const port = envPort ? parseInt(envPort, 10) : defaultPort;
  
  console.log(`[DEBUG] isDevelopment: ${isDevelopment}`);
  console.log(`[DEBUG] process.argv: ${process.argv.join(' ')}`);
  console.log(`[DEBUG] Using port: ${port}`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info(`serving on port ${port}`);
  });
})();
