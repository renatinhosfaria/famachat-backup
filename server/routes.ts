import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerUserRoutes } from "./routes/users";
import { registerClienteRoutes } from "./routes/clientes";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerWhatsappRoutes } from "./routes/whatsapp";
import { registerFacebookRoutes } from "./routes/facebook";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminUserRoutes } from "./routes/admin-users";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerUploadRoutes } from "./routes/uploads";
import { setupSequentialValidationRoutes } from "./routes/sequential-validation";
import { registerTestLeadDistributionRoutes } from "./routes/test-lead-distribution";
import { registerMetasRoutes } from "./routes/metas-register";
import proprietariosRoutes from './routes/proprietarios';
import imoveisRoutes from './routes/imoveis';
import imoveisNovoRoutes from './routes/imoveis-novo';
import apartamentosRoutes from './routes/apartamentos-novo';
import empreendimentosRoutes from './routes/empreendimentos';
import empreendimentosPageRoutes from './routes/empreendimentos-page';
import leadsRoutes from './routes/leads';
import automationRoutes from './routes/automation';
import horariosUsuarioRoutes from './routes/horarios-usuario';
import openaiRoutes from './routes/openai';
import slaCascataRoutes from './routes/sla-cascata';
import slaDashboardRoutes from './routes/sla-dashboard';
import { registerSystemRoutes } from "./routes/system-status";

/**
 * Registra todas as rotas da aplicação
 * @param app Instância do Express
 * @returns Servidor HTTP
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint para Docker/Traefik
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  // Rota de teste global para verificar autenticação
  app.get('/api/test-auth-global', (_req, res) => {
    res.status(200).json({ 
      message: 'Rota de teste global funcionando', 
      timestamp: new Date().toISOString()
    });
  });

  // Testando se o problema é específico do path /api/leads
  app.get('/api/leads-test-alternative', async (_req, res) => {
    try {
      const { executeSQL } = await import('./database');
      const result = await executeSQL('SELECT COUNT(*) as count FROM sistema_leads');
      const count = result[0]?.count || 0;
      
      res.status(200).json({ 
        message: 'Rota alternativa de leads funcionando',
        totalLeads: parseInt(count),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao testar', details: String(error) });
    }
  });

  // Rota alternativa para buscar leads (temporária)
  app.get('/api/sistema-leads/all-with-cascade', async (_req, res) => {
    try {
      const { executeSQL } = await import('./database');
      
      const leadsQuery = `
        SELECT 
          id,
          full_name as "fullName",
          email,
          phone,
          source,
          source_details as "sourceDetails",
          status,
          assigned_to as "assignedTo",
          notes,
          is_recurring as "isRecurring",
          cliente_id as "clienteId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          tags,
          last_activity_date as "lastActivityDate",
          score,
          interesse,
          budget,
          meta_data as "metaData"
        FROM sistema_leads 
        ORDER BY created_at DESC 
        LIMIT 1000
      `;
      
      const cascadeQuery = `
        SELECT 
          id,
          cliente_id as "clienteId",
          lead_id as "leadId",
          user_id as "userId",
          sequencia,
          status,
          sla_horas as "slaHoras",
          iniciado_em as "iniciadoEm",
          expira_em as "expiraEm",
          finalizado_em as "finalizadoEm",
          motivo,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM sistema_leads_cascata 
        WHERE status = 'Ativo'
        ORDER BY sequencia ASC
      `;
      
      const leads = await executeSQL(leadsQuery);
      const cascadeData = await executeSQL(cascadeQuery);
      
      const totalQuery = 'SELECT COUNT(*) as count FROM sistema_leads';
      const totalResult = await executeSQL(totalQuery);
      const total = totalResult[0]?.count || 0;
      
      res.json({
        leads: leads || [],
        cascadeData: cascadeData || [],
        total: parseInt(total)
      });
    } catch (error) {
      console.error('Erro ao listar leads com dados de cascata:', error);
      res.status(500).json({ error: 'Erro ao listar leads com cascata', leads: [], cascadeData: [] });
    }
  });

  // Registrar todas as rotas modularizadas
  registerAuthRoutes(app); // Rotas de autenticação
  registerAdminUserRoutes(app); // Rotas administrativas de usuários
  registerUserRoutes(app);
  registerMetasRoutes(app); // Rotas para gerenciamento de metas
  
  // Registrar primeiro as novas rotas de leads para que tenham prioridade
  app.use('/api/leads', leadsRoutes); // Rotas para gerenciamento de leads
  app.use('/api/automation', automationRoutes); // Rotas para automação de leads
  app.use('/api/horarios-usuario', horariosUsuarioRoutes); // Rotas para horários de usuários
  app.use('/api/openai', openaiRoutes); // Rotas para OpenAI
  app.use('/api/sla-cascata', slaCascataRoutes); // Rotas para SLA em cascata
  
  // Registrar rota de teste para distribuição de leads
  registerTestLeadDistributionRoutes(app);
  
  // Depois registrar as demais rotas
  registerClienteRoutes(app);
  registerAppointmentRoutes(app);
  registerWhatsappRoutes(app);
  registerFacebookRoutes(app); // Rotas da API do Facebook
  registerDashboardRoutes(app); // Rotas do dashboard
  registerUploadRoutes(app); // Rotas para upload de arquivos
  setupSequentialValidationRoutes(app); // Rotas para validação sequencial de números WhatsApp
  registerSystemRoutes(app); // Rotas para monitoramento do sistema e cache
  app.use('/api/proprietarios', proprietariosRoutes);
  app.use('/api/imoveis', imoveisRoutes);
  app.use('/api/imoveis-novo', imoveisNovoRoutes); // Nova tabela de imóveis
  app.use('/api/apartamentos', apartamentosRoutes); // Rotas para apartamentos
  app.use('/api/empreendimentos', empreendimentosRoutes); // Rotas para empreendimentos
  app.use('/api/empreendimentos-page', empreendimentosPageRoutes); // Rota para página de empreendimentos
  app.use('/api/sla-dashboard', slaDashboardRoutes); // Rotas para dashboard SLA Cascata Paralelo
  
  // Rota para debug de arquivos estáticos
  app.get('/api/debug/static-files', (req, res) => {
    import('path').then(path => {
      import('fs').then(async fs => {
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        
        // Verificar diretório
        const dirExists = fs.existsSync(uploadsDir);
        
        // Estrutura de arquivos
        let fileStructure: Record<string, any> = {};
        
        if (dirExists) {
          const walkDir = (dir: string, basePath = '') => {
            const result: Record<string, any> = {};
            try {
              const items = fs.readdirSync(dir);
              
              for (const item of items) {
                const itemPath = path.join(dir, item);
                const relativePath = path.join(basePath, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                  result[item] = {
                    type: 'directory',
                    path: relativePath,
                    contents: walkDir(itemPath, relativePath)
                  };
                } else {
                  result[item] = {
                    type: 'file',
                    path: relativePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                  };
                }
              }
            } catch (err) {
              result['error'] = `Erro ao acessar diretório: ${(err as Error).message}`;
            }
            
            return result;
          };
          
          try {
            fileStructure = walkDir(uploadsDir);
          } catch (err) {
            fileStructure = { error: `Erro ao listar arquivos: ${(err as Error).message}` };
          }
        }
        
        res.json({
          uploadsDir,
          dirExists,
          fileStructure
        });
      }).catch(err => {
        res.status(500).json({
          success: false,
          message: `Erro ao importar fs: ${err.message}`,
          error: err
        });
      });
    }).catch(err => {
      res.status(500).json({
        success: false,
        message: `Erro ao importar path: ${err.message}`,
        error: err
      });
    });
  });
  
  // Criar e retornar o servidor HTTP
  return createServer(app);
}
