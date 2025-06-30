import express from 'express';
import { storage } from '../storage';
import { insertLeadSchema, updateLeadSchema } from '../../shared/schema';
import { checkAuth, checkRole } from '../middlewares/auth';
import { logger } from '../utils/logger';
import { slaCascataParallelService } from '../services/sla-cascata-parallel.service';

const router = express.Router();

// Inicializa o logger para o módulo de leads
const leadLogger = logger.createLogger('LeadsAPI');

// Middleware para verificar se é um gestor
const checkGestor = checkRole('Gestor');

/**
 * Formata um número de telefone para o padrão brasileiro sem código 55
 * Formato de saída: (DD) 99999-9999 ou (DD) 9999-9999
 * @param phone Número de telefone para formatar
 * @returns Número formatado no padrão brasileiro
 */
function formatPhoneNumberToBrazilian(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleanNumber = phone.replace(/\D/g, '');
  
  // Se o número estiver vazio ou muito curto, retorna como está
  if (!cleanNumber || cleanNumber.length < 10) {
    return phone;
  }
  
  let numberToFormat = cleanNumber;
  
  // Se o número começa com 55 (código do Brasil), remove o 55
  if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
    numberToFormat = cleanNumber.substring(2);
  }
  
  // Agora temos um número sem código do país
  // Formato esperado: DDNNNNNNNNN (11 dígitos) ou DDNNNNNNNN (10 dígitos)
  
  if (numberToFormat.length === 11) {
    // Formato: (DD) 99999-9999
    const ddd = numberToFormat.substring(0, 2);
    const parte1 = numberToFormat.substring(2, 7);
    const parte2 = numberToFormat.substring(7, 11);
    return `(${ddd}) ${parte1}-${parte2}`;
  } else if (numberToFormat.length === 10) {
    // Formato: (DD) 9999-9999
    const ddd = numberToFormat.substring(0, 2);
    const parte1 = numberToFormat.substring(2, 6);
    const parte2 = numberToFormat.substring(6, 10);
    return `(${ddd}) ${parte1}-${parte2}`;
  }
  
  // Se não conseguir formatar, retorna o número original
  return phone;
}

// Rota para obter todos os leads da tabela sistema_leads
router.get('/all', async (req, res) => {
  try {
    // Buscar diretamente da tabela sistema_leads usando SQL
    const { executeSQL } = await import('../database');
    
    const query = `
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
    
    const leads = await executeSQL(query);
    const totalQuery = 'SELECT COUNT(*) as count FROM sistema_leads';
    const totalResult = await executeSQL(totalQuery);
    const total = totalResult[0]?.count || 0;
    
    res.json({
      leads: leads || [],
      total: parseInt(total)
    });
  } catch (error) {
    leadLogger.error('Erro ao listar todos os leads da tabela sistema_leads:', error);
    res.status(500).json({ error: 'Erro ao listar todos os leads', leads: [] });
  }
});

// Listar leads com paginação e filtragem
router.get('/', checkAuth, checkGestor, async (req, res) => {
  try {
    const filter = {
      status: req.query.status as string | undefined,
      source: req.query.source as string | undefined,
      assignedTo: req.query.assignedTo ? Number(req.query.assignedTo) : undefined,
      searchTerm: req.query.searchTerm as string | undefined,
      period: req.query.period as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
      includeCount: req.query.includeCount === 'true'
    };

    const result = await storage.getLeads(filter);
    res.json(result);
  } catch (error) {
    leadLogger.error('Erro ao listar leads:', error);
    res.status(500).json({ error: 'Erro ao listar leads' });
  }
});

// Obter um lead específico
router.get('/:id', checkAuth, checkGestor, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const lead = await storage.getLead(id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.json(lead);
  } catch (error) {
    leadLogger.error(`Erro ao buscar lead ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar lead' });
  }
});

// Criar um novo lead
router.post('/', checkAuth, checkGestor, async (req, res) => {
  try {
    const parseResult = insertLeadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: parseResult.error.format() 
      });
    }

    const lead = await storage.createLead(parseResult.data);
    res.status(201).json(lead);
  } catch (error) {
    leadLogger.error('Erro ao criar lead:', error);
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

// Atualizar um lead existente
router.patch('/:id', checkAuth, checkGestor, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const parseResult = updateLeadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: parseResult.error.format() 
      });
    }

    const updatedLead = await storage.updateLead(id, parseResult.data);
    if (!updatedLead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.json(updatedLead);
  } catch (error) {
    leadLogger.error(`Erro ao atualizar lead ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

// Excluir um lead
router.delete('/:id', checkAuth, checkGestor, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const success = await storage.deleteLead(id);
    if (!success) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.status(204).end();
  } catch (error) {
    leadLogger.error(`Erro ao excluir lead ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

// Converter lead para cliente
router.post('/:id/convert', checkAuth, checkGestor, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const result = await storage.convertLeadToCliente(id);
    
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    leadLogger.error(`Erro ao converter lead ${req.params.id} para cliente:`, error);
    leadLogger.error('Detalhes do erro:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Erro ao converter lead para cliente', details: String(error) });
  }
});

// Rota de teste sem autenticação
router.get('/test-no-auth', (req, res) => {
  console.log('[DEBUG] Rota de teste chamada - sem autenticação');
  res.json({ message: 'Rota funcionando sem autenticação', timestamp: new Date().toISOString() });
});

// Rota de teste para conexão com banco
router.get('/test-db', async (req, res) => {
  try {
    console.log('[DEBUG] Testando conexão com banco de dados');
    const { executeSQL } = await import('../database');
    
    const result = await executeSQL('SELECT COUNT(*) as count FROM sistema_leads');
    const count = result[0]?.count || 0;
    
    res.json({ 
      message: 'Conexão com banco funcionando', 
      totalLeads: parseInt(count),
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('[DEBUG] Erro ao testar banco:', error);
    res.status(500).json({ error: 'Erro ao conectar com banco', details: String(error) });
  }
});

// Rota para obter todos os leads com dados de cascata
router.get('/all-with-cascade', async (req, res) => {
  try {
    console.log('[DEBUG] Rota /all-with-cascade chamada');
    leadLogger.info('Rota /all-with-cascade chamada');
    
    // Buscar diretamente da tabela sistema_leads usando SQL
    const { executeSQL } = await import('../database');
    
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
    leadLogger.error('Erro ao listar leads com dados de cascata:', error);
    res.status(500).json({ error: 'Erro ao listar leads com cascata', leads: [], cascadeData: [] });
  }
});

// API para iniciar SLA cascata paralelo
router.post('/:leadId/start-cascade', checkAuth, checkGestor, async (req, res) => {
  try {
    const leadId = Number(req.params.leadId);
    const { clienteId } = req.body;
    
    if (isNaN(leadId) || !clienteId) {
      return res.status(400).json({ error: 'Lead ID e Cliente ID são obrigatórios' });
    }

    await slaCascataParallelService.iniciarSLACascataParalelo(leadId, clienteId);
    
    res.json({ 
      success: true, 
      message: 'SLA cascata paralelo iniciado com sucesso' 
    });
  } catch (error) {
    leadLogger.error(`Erro ao iniciar SLA cascata para lead ${req.params.leadId}:`, error);
    res.status(500).json({ error: 'Erro ao iniciar SLA cascata' });
  }
});

// API para finalizar todas as duplicatas de um cliente
router.post('/finalize-duplicates', checkAuth, async (req, res) => {
  try {
    const { clienteId, userId, motivo = 'Agendamento' } = req.body;
    
    if (!clienteId || !userId) {
      return res.status(400).json({ error: 'Cliente ID e User ID são obrigatórios' });
    }

    await slaCascataParallelService.finalizarTodasDuplicatas(clienteId, userId, motivo);
    
    res.json({ 
      success: true, 
      message: 'Todas as duplicatas foram finalizadas com sucesso' 
    });
  } catch (error) {
    leadLogger.error(`Erro ao finalizar duplicatas para cliente ${req.body.clienteId}:`, error);
    res.status(500).json({ error: 'Erro ao finalizar duplicatas' });
  }
});

// API para buscar atendimentos ativos de um usuário
router.get('/user/:userId/active-assignments', checkAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'User ID inválido' });
    }

    const atendimentos = await slaCascataParallelService.buscarAtendimentosAtivos(userId);
    
    res.json({ 
      atendimentos,
      total: atendimentos.length 
    });
  } catch (error) {
    leadLogger.error(`Erro ao buscar atendimentos ativos para usuário ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Erro ao buscar atendimentos ativos' });
  }
});

// API para buscar dados de cascata (dashboard)
router.get('/cascade/data', checkAuth, checkGestor, async (req, res) => {
  try {
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : undefined;
    
    const dados = await slaCascataParallelService.buscarDadosCascata(clienteId);
    
    res.json({ 
      cascadeData: dados,
      total: dados.length 
    });
  } catch (error) {
    leadLogger.error(`Erro ao buscar dados de cascata:`, error);
    res.status(500).json({ error: 'Erro ao buscar dados de cascata' });
  }
});

// API para obter métricas de performance
router.get('/cascade/metrics', checkAuth, checkGestor, async (req, res) => {
  try {
    const dataInicio = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const dataFim = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const metricas = await slaCascataParallelService.obterMetricasPerformance(dataInicio, dataFim);
    
    res.json(metricas);
  } catch (error) {
    leadLogger.error(`Erro ao obter métricas de cascata:`, error);
    res.status(500).json({ error: 'Erro ao obter métricas' });
  }
});

// API para processar SLAs expirados manualmente (debug/admin)
router.post('/cascade/process-expired', checkAuth, checkGestor, async (req, res) => {
  try {
    await slaCascataParallelService.processarSLAsExpirados();
    
    res.json({ 
      success: true, 
      message: 'Processamento de SLAs expirados executado com sucesso' 
    });
  } catch (error) {
    leadLogger.error(`Erro ao processar SLAs expirados:`, error);
    res.status(500).json({ error: 'Erro ao processar SLAs expirados' });
  }
});

// Rota de teste para debugging (sem autenticação)
router.get('/test-debug', async (req, res) => {
  try {
    console.log('[DEBUG] Rota /test-debug chamada');
    leadLogger.info('Rota /test-debug chamada');
    
    res.json({
      success: true,
      message: 'Rota de teste funcionando',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DEBUG] Erro na rota /test-debug:', error);
    res.status(500).json({ error: 'Erro interno', details: String(error) });
  }
});

// Endpoint de teste para verificar se o webhook está funcionando
router.get('/webhook/n8n/test', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      message: 'Webhook n8n está funcionando',
      timestamp: new Date().toISOString(),
      endpoint: '/api/leads/webhook/n8n',
      expected_fields: {
        required: ['nome_lead', 'telefone_lead'],
        optional: ['email_lead', 'data_lead']
      },
      example: {
        nome_lead: "João Silva",
        telefone_lead: "5534991677124",
        email_lead: "joao@exemplo.com",
        data_lead: "22/06/2025"
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro no teste do webhook' });
  }
});

// Endpoint especial para receber leads do n8n (sem autenticação)
router.post('/webhook/n8n', async (req, res) => {
  try {
    leadLogger.info('Recebendo lead do n8n:', req.body);
    
    // Validar dados recebidos do n8n
    const { nome_lead, telefone_lead, email_lead, data_lead } = req.body;
    
    if (!nome_lead || !telefone_lead) {
      return res.status(400).json({ 
        error: 'Dados obrigatórios: nome_lead e telefone_lead' 
      });
    }

    // Formatar o telefone antes de criar o lead
    const telefoneFormatado = formatPhoneNumberToBrazilian(telefone_lead);
    leadLogger.info(`Telefone original: ${telefone_lead}, Telefone formatado: ${telefoneFormatado}`);

    // Preparar dados no formato esperado pelo sistema
    const leadData = {
      fullName: nome_lead,
      phone: telefoneFormatado, // Usar o telefone formatado
      email: email_lead || null,
      source: 'Facebook Ads',
      sourceDetails: {
        origem: 'n8n_webhook',
        data_original: data_lead,
        timestamp_recebido: new Date().toISOString(),
        telefone_original: telefone_lead // Salvar o telefone original nos detalhes
      },
      status: 'Novo Lead',
      isRecurring: false,
      tags: ['facebook-ads', 'n8n-automation'],
      metaData: {
        origem_automacao: true,
        webhook_n8n: true,
        data_lead_original: data_lead,
        telefone_original: telefone_lead
      }
    };

    // Validar com o schema
    const parseResult = insertLeadSchema.safeParse(leadData);
    if (!parseResult.success) {
      leadLogger.error('Erro na validação do lead do n8n:', parseResult.error);
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: parseResult.error.format() 
      });
    }

    // Criar o lead
    const novoLead = await storage.createLead(parseResult.data);
  leadLogger.info(`Lead criado com sucesso: ID ${novoLead.id}`);

    // Criar um cliente automaticamente para o SLA cascata funcionar
    let clienteId = novoLead.clienteId;
    
    if (!clienteId) {
      try {
        // Criar cliente com os mesmos dados do lead (usando telefone formatado)
        const clienteData = {
          fullName: nome_lead,
          phone: telefoneFormatado, // Usar o telefone formatado
          email: email_lead || null,
          source: 'Facebook Ads',
          sourceDetails: {
            origem: 'n8n_webhook_auto_cliente',
            lead_id: novoLead.id,
            data_original: data_lead,
            timestamp_criacao: new Date().toISOString(),
            telefone_original: telefone_lead
          },
          status: 'Sem Atendimento'
        };

        const novoCliente = await storage.createCliente(clienteData);
        clienteId = novoCliente.id;
        
        // Atualizar o lead com o clienteId usando SQL direto
        try {
          const { executeSQL } = await import('../database');
          await executeSQL('UPDATE sistema_leads SET cliente_id = $1 WHERE id = $2', [clienteId, novoLead.id]);
          leadLogger.info(`Lead ${novoLead.id} atualizado com cliente_id ${clienteId} via SQL direto`);
        } catch (updateError) {
          leadLogger.error(`Erro ao atualizar lead ${novoLead.id} com SQL direto:`, updateError);
        }
        
        leadLogger.info(`Cliente criado automaticamente: ID ${clienteId} para lead ${novoLead.id}`);

        // Validar WhatsApp do cliente criado automaticamente
        if (telefoneFormatado && telefoneFormatado.trim().length > 0) {
          try {
            leadLogger.info(`[WEBHOOK N8N] Iniciando validação WhatsApp para cliente ${clienteId} com telefone ${telefoneFormatado}`);
            
            // Importar o módulo de validação WhatsApp
            const whatsappModule = await import('./whatsapp');
            const whatsappResult = await whatsappModule.validateAndUpdateClienteWhatsappStatus(clienteId, telefoneFormatado);
            
            if (whatsappResult !== null) {
              leadLogger.info(`[WEBHOOK N8N] Cliente ${clienteId} validação WhatsApp concluída: hasWhatsApp=${whatsappResult}`);
              
              // Se o cliente tem WhatsApp, buscar foto de perfil automaticamente
              if (whatsappResult === true) {
                try {
                  const { fetchSingleClientProfilePic, AUTO_UPDATE_PROFILE_PICS } = await import('../services/whatsapp-profile-pic');
                  if (AUTO_UPDATE_PROFILE_PICS) {
                    leadLogger.info(`[WEBHOOK N8N] Buscando foto de perfil para cliente ${clienteId}`);
                    const photoResult = await fetchSingleClientProfilePic(clienteId);
                    if (photoResult && photoResult.status) {
                      leadLogger.info(`[WEBHOOK N8N] Foto de perfil atualizada para cliente ${clienteId}`);
                    }
                  }
                } catch (photoError) {
                  leadLogger.error(`[WEBHOOK N8N] Erro ao buscar foto de perfil para cliente ${clienteId}:`, photoError);
                }
              }
            } else {
              leadLogger.warn(`[WEBHOOK N8N] Validação WhatsApp retornou null para cliente ${clienteId}`);
            }
          } catch (whatsappError) {
            leadLogger.error(`[WEBHOOK N8N] Erro ao validar WhatsApp para cliente ${clienteId}:`, whatsappError);
            // Continua o processamento mesmo com erro na validação WhatsApp
          }
        } else {
          leadLogger.warn(`[WEBHOOK N8N] Telefone inválido ou vazio para validação WhatsApp: ${telefoneFormatado}`);
        }
      } catch (clienteError) {
        leadLogger.error(`Erro ao criar cliente para lead ${novoLead.id}:`, clienteError);
        // Se não conseguir criar cliente, usar o ID do lead como clienteId
        clienteId = novoLead.id;
      }
    }

    // Iniciar automação SLA cascata paralelo automaticamente
    try {
      await slaCascataParallelService.iniciarSLACascataParalelo(novoLead.id, clienteId);
      leadLogger.info(`SLA cascata iniciado para lead ${novoLead.id}, cliente ${clienteId}`);
    } catch (slaError) {
      leadLogger.error(`Erro ao iniciar SLA cascata para lead ${novoLead.id}:`, slaError);
      // Continua mesmo se houver erro no SLA - o lead já foi criado
    }

    res.status(201).json({
      success: true,
      lead: novoLead,
      message: 'Lead recebido e processado com sucesso'
    });

  } catch (error) {
    leadLogger.error('Erro ao processar lead do n8n:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Erro ao processar lead do n8n'
    });
  }
});

export default router;