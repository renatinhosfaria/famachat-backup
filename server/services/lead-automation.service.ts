/**
 * Serviço para automação de processamento de leads
 */
import { db } from '../database';
import { eq, and, desc, count, sql, SQL, or, inArray } from 'drizzle-orm';
import { 
  leads,
  users,
  type InsertLead,
  type Lead,
  type User,
  LeadStatusEnum
} from '@shared/schema';
import { getAutomationConfig } from './automation-config.service';
import { logger } from '../utils/logger';

// Inicializa o logger para o serviço de automação de leads
const leadAutomationLogger = logger.createLogger("LeadAutomationService");

/**
 * Tipos de processamento de lead 
 */
export enum LeadProcessingType {
  NEW_LEAD = 'new_lead',
  RECURRING_LEAD = 'recurring_lead',
  REASSIGNMENT = 'reassignment',
  ESCALATION = 'escalation'
}

/**
 * Interface para os dados de processamento 
 */
export interface LeadProcessingData {
  type: LeadProcessingType;
  lead: Lead | InsertLead;
  userId?: number; // Opcional: ID do usuário para atribuição manual
}

/**
 * Resultado do processamento de automação
 */
export interface AutomationResult {
  leadId?: number;
  assignedTo?: number;
  assignedToName?: string; 
  status: string;
  isRecurring?: boolean;
  message: string;
  success: boolean;
}

/**
 * Processa um lead de acordo com as regras de automação configuradas
 */
export async function processLeadAutomation(
  data: LeadProcessingData
): Promise<AutomationResult> {
  try {
    // Obter configuração de automação
    const config = await getAutomationConfig();
    
    logger.info("Processando lead automação com configuração", {
      context: {
        distributionMethod: config.distributionMethod,
        rotationUsers: config.rotationUsers,
        byEmail: config.byEmail,
        byPhone: config.byPhone,
        byName: config.byName
      }
    });
    
    if (!config.rotationUsers || !Array.isArray(config.rotationUsers) || config.rotationUsers.length === 0) {
      logger.warn("Automação configurada sem usuários de rotação!");
    } else {
      logger.info(`Existem ${config.rotationUsers.length} usuários configurados para distribuição: ${config.rotationUsers.join(', ')}`);
    }
    
    // Verificar se é um lead recorrente
    let existingLead: Lead | null = null;
    let isRecurring = false;
    
    // Obter as regras de identificação de leads recorrentes da configuração
    const checkByEmail = config.byEmail !== false; // Verificar por e-mail por padrão
    const checkByPhone = config.byPhone !== false; // Verificar por telefone por padrão
    const checkByName = config.byName !== false;   // Verificar por nome por padrão
    
    // Verificar por e-mail se a configuração permitir
    if (checkByEmail && 'email' in data.lead && data.lead.email) {
      existingLead = await findLeadByEmail(data.lead.email);
      if (existingLead) isRecurring = true;
    }
    
    // Verificar por telefone se a configuração permitir e ainda não encontrou
    if (!existingLead && checkByPhone && 'phone' in data.lead && data.lead.phone) {
      existingLead = await findLeadByPhone(data.lead.phone);
      if (existingLead) isRecurring = true;
    }
    
    // Verificar por nome se a configuração permitir e ainda não encontrou
    if (!existingLead && checkByName && 'fullName' in data.lead && data.lead.fullName) {
      existingLead = await findLeadByName(data.lead.fullName);
      if (existingLead) isRecurring = true;
    }
    
    // A verificação de horário de funcionamento foi removida completamente
    // Não há mais necessidade de checar o horário de funcionamento
    
    // Tratar lead recorrente
    if (isRecurring && existingLead) {
      return await handleRecurringLead(existingLead, data, config);
    }
    
    // Para novos leads, aplicar regras de distribuição
    logger.info(`Obtendo targetUserId para o lead através do método: ${config.distributionMethod}`);
    logger.info("Dados do lead", {
      context: {
        fullName: data.lead.fullName,
        email: data.lead.email || 'Não fornecido',
        phone: data.lead.phone || 'Não fornecido',
        source: data.lead.source
      }
    });
    
    const targetUserId = data.userId || 
      await getTargetUserIdByDistributionMethod(config.distributionMethod, config);
      
    logger.info(`Resultado da distribuição - ID de usuário selecionado: ${targetUserId}`);
      
    if (!targetUserId) {
      logger.error("Não foi possível encontrar um consultor disponível!");
      
      // Mesmo sem consultor, criar o lead para não perder dados
      logger.warn("Criando lead sem atribuição a consultor.");
      const newLead = await createNewLead(data.lead);
      logger.info(`ID do lead criado sem consultor: ${newLead.id}`);
      
      return {
        leadId: newLead.id,
        status: LeadStatusEnum.SEM_ATENDIMENTO,
        message: 'Não foi possível encontrar um consultor disponível',
        success: true // Mudamos para true pois o lead foi criado com sucesso
      };
    }
    
    // Se for uma reassignment ou um lead existente, atualizar o lead
    if (data.type === LeadProcessingType.REASSIGNMENT && 'id' in data.lead) {
      const updatedLead = await updateLeadAssignment(data.lead.id, targetUserId);
      if (!updatedLead) {
        return {
          status: LeadStatusEnum.SEM_ATENDIMENTO,
          message: 'Erro ao reatribuir lead',
          success: false
        };
      }
      
      const assignedUser = await getUserById(targetUserId);
      
      return {
        leadId: updatedLead.id,
        assignedTo: targetUserId,
        assignedToName: assignedUser?.fullName || 'Consultor',
        status: updatedLead.status,
        message: 'Lead reatribuído com sucesso',
        success: true
      };
    }
    
    // Para novos leads, criar o lead no banco de dados
    logger.info('Criando novo lead', {
      context: {
        leadData: data.lead,
        targetUserId: targetUserId
      }
    });
    
    try {
      logger.debug('DIAGNÓSTICO PRÉ-CRIAÇÃO', {
        context: {
          leadData: data.lead,
          targetUserId: targetUserId
        }
      });
      
      const newLead = await createNewLead(data.lead, targetUserId);
      
      logger.debug('DIAGNÓSTICO PÓS-CRIAÇÃO', {
        context: {
          resultado: newLead ? `LEAD EXISTE (id: ${newLead.id})` : 'LEAD NULO',
          leadCompleto: newLead || 'NULO'
        }
      });
      
      if (!newLead) {
        logger.error('Falha ao criar lead - newLead é nulo');
        return {
          status: LeadStatusEnum.SEM_ATENDIMENTO,
          message: 'Falha ao criar lead: resultado nulo retornado pela função createNewLead',
          success: false
        };
      }
      
      if (newLead.id === undefined || newLead.id === null) {
        logger.error('Lead criado mas ID é undefined/null', {
          context: {
            lead: newLead
          }
        });
        return {
          status: LeadStatusEnum.SEM_ATENDIMENTO,
          message: 'Falha ao criar lead: ID não gerado corretamente',
          success: false
        };
      }
      
      // Verificação adicional para garantir tipo numérico
      if (typeof newLead.id !== 'number') {
        logger.error(`Lead ID não é numérico - ${typeof newLead.id}`, {
          context: {
            leadId: newLead.id,
            leadIdType: typeof newLead.id
          }
        });
        return {
          status: LeadStatusEnum.SEM_ATENDIMENTO,
          message: `Falha ao criar lead: ID tem tipo inválido (${typeof newLead.id})`,
          success: false
        };
      }
      
      const assignedUser = await getUserById(targetUserId);
      logger.info('Usuário atribuído ao lead', {
        context: {
          usuario: assignedUser || 'Não encontrado',
          usuarioId: targetUserId
        }
      });
      
      logger.info('Lead criado com sucesso', {
        context: {
          leadId: newLead.id,
          assignedTo: targetUserId,
          assignedToName: assignedUser?.fullName || 'Consultor'
        }
      });
      
      return {
        leadId: newLead.id,
        assignedTo: targetUserId,
        assignedToName: assignedUser?.fullName || 'Consultor',
        status: newLead.status,
        message: 'Novo lead criado e atribuído com sucesso',
        success: true
      };
    } catch (error) {
      logger.error('Erro ao criar lead', { context: { error } });
      return {
        status: LeadStatusEnum.SEM_ATENDIMENTO,
        message: `Erro ao criar lead: ${error}`,
        success: false
      };
    }
    
  } catch (error) {
    leadAutomationLogger.error('Erro ao processar automação de lead:', error);
    return {
      status: LeadStatusEnum.SEM_ATENDIMENTO,
      message: 'Erro ao processar automação',
      success: false
    };
  }
}



/**
 * Processa lead recorrente de acordo com as regras de automação
 * 
 * MODIFICADO: Agora criando um novo registro para cada lead recorrente
 * ao invés de apenas atualizar o registro existente
 */
async function handleRecurringLead(
  existingLead: Lead,
  data: LeadProcessingData,
  config: any
): Promise<AutomationResult> {
  logger.info("Processando lead recorrente - criando novo registro para cada interação");
  
  // Obter configurações para leads recorrentes
  const keepSameConsultant = config.keepSameConsultant !== false; // Por padrão, manter o mesmo consultor
  
  // Preparar dados para o novo lead
  const newLeadData: any = { ...data.lead };
  newLeadData.isRecurring = true;
  
  // Referência ao cliente existente, se houver
  if (existingLead.clienteId) {
    newLeadData.clienteId = existingLead.clienteId;
  }
  
  // Determinar qual consultor será atribuído
  let assignedConsultantId: number | undefined;
  let consultantName = 'Consultor';
  
  // Se a configuração for para manter o mesmo consultor e existir um consultor atribuído
  if (keepSameConsultant && existingLead.assignedTo) {
    // Verificar se o consultor ainda está ativo
    const consultant = await getUserById(existingLead.assignedTo);
    if (consultant && consultant.isActive) {
      // Manter o mesmo consultor
      assignedConsultantId = existingLead.assignedTo;
      consultantName = consultant.fullName;
      logger.info(`Mantendo o mesmo consultor (${consultant.fullName}) para o lead recorrente`);
    }
  }
  
  // Se não foi possível manter o mesmo consultor, obter um novo
  if (!assignedConsultantId) {
    assignedConsultantId = data.userId || 
      await getTargetUserIdByDistributionMethod(config.distributionMethod, config);
    
    if (assignedConsultantId) {
      const newConsultant = await getUserById(assignedConsultantId);
      if (newConsultant) {
        consultantName = newConsultant.fullName;
      }
      logger.info(`Atribuindo novo consultor (${consultantName}) para o lead recorrente`);
    }
  }
  
  // Criar um novo lead
  logger.info(`Criando novo registro para lead recorrente com consultor ID: ${assignedConsultantId}`);
  const newLead = await createNewLead(newLeadData, assignedConsultantId);
  
  if (!newLead || !newLead.id) {
    logger.error("Falha ao criar novo registro para lead recorrente");
    return {
      leadId: existingLead.id,
      assignedTo: existingLead.assignedTo,
      status: existingLead.status,
      isRecurring: true,
      message: 'Erro ao criar novo registro para lead recorrente',
      success: false
    };
  }
  
  return {
    leadId: newLead.id,
    assignedTo: assignedConsultantId,
    assignedToName: consultantName,
    status: newLead.status,
    isRecurring: true,
    message: 'Novo registro de lead recorrente criado com sucesso',
    success: true
  };
}

/**
 * Determina o ID do usuário de destino com base no método de distribuição
 */
async function getTargetUserIdByDistributionMethod(
  method: string,
  config: any
): Promise<number | undefined> {
  switch (method) {
    case 'volume':
      return await getUserByVolume(config);
    case 'performance':
      return await getUserByPerformance(config);
    case 'round-robin':
      return await getUserByRoundRobin(config);
    default:
      return await getUserByVolume(config); // Método padrão
  }
}

/**
 * Encontra um consultor pelo volume (menor número de leads atribuídos)
 */
async function getUserByVolume(config: any): Promise<number | undefined> {
  // Verificar se há usuários configurados para rotação
  if (!config.rotationUsers || !Array.isArray(config.rotationUsers) || config.rotationUsers.length === 0) {
    logger.warn('Nenhum usuário configurado para rotação de leads');
    return undefined;
  }
  
  logger.info('Usando lista de rotação de usuários para distribuição por volume: ' + JSON.stringify(config.rotationUsers));
  
  // Filtros para consultores ativos de acordo com a configuração
  const whereConditions: SQL[] = [
    eq(users.isActive, true),
    // Distribuição apenas entre os usuários configurados na rotação
    inArray(users.id, config.rotationUsers)
  ];
  
  // Consulta para obter o consultor com menos leads ativos
  const consultantsWithLeadCount = await db
    .select({
      userId: users.id,
      leadCount: count(leads.id).as('leadCount')
    })
    .from(users)
    .leftJoin(
      leads,
      and(
        eq(leads.assignedTo, users.id),
        eq(leads.status, LeadStatusEnum.EM_ATENDIMENTO)
      )
    )
    .where(and(...whereConditions))
    .groupBy(users.id)
    .orderBy(sql`lead_count`, 'asc')
    .limit(1);
  
  logger.debug('Consultores encontrados com contagem de leads:', consultantsWithLeadCount);
  
  return consultantsWithLeadCount.length > 0 
    ? consultantsWithLeadCount[0].userId 
    : undefined;
}

/**
 * Encontra um consultor por desempenho (maior taxa de conversão)
 */
async function getUserByPerformance(config: any): Promise<number | undefined> {
  // Verificar se há usuários configurados para rotação
  if (!config.rotationUsers || !Array.isArray(config.rotationUsers) || config.rotationUsers.length === 0) {
    logger.warn('Nenhum usuário configurado para rotação de leads (performance)');
    return undefined;
  }
  
  logger.info('Usando lista de rotação de usuários para distribuição por performance: ' + JSON.stringify(config.rotationUsers));
  
  // Em uma implementação real, seria feita uma análise de desempenho mais elaborada
  // Aqui, simplificamos para demonstração e usamos apenas os usuários da rotação
  
  const consultants = await db
    .select({
      id: users.id,
      isActive: users.isActive
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        // Distribuição apenas entre os usuários configurados na rotação
        inArray(users.id, config.rotationUsers)
      )
    )
    .limit(1);
  
  logger.debug('Consultores encontrados para performance:', consultants);
  
  return consultants.length > 0 ? consultants[0].id : undefined;
}

/**
 * Encontra um consultor por round-robin com rotação de fila
 * Quando um usuário recebe um lead, ele vai para o fim da fila
 */
async function getUserByRoundRobin(config: any): Promise<number | undefined> {
  // Verificar se há usuários configurados para rotação
  if (!config.rotationUsers || !Array.isArray(config.rotationUsers) || config.rotationUsers.length === 0) {
    logger.warn('Nenhum usuário configurado para rotação de leads');
    return undefined;
  }
  
  logger.info('Usando lista de rotação de usuários: ' + JSON.stringify(config.rotationUsers));
  
  // Usar a ordem configurada (cascadeUserOrder) se disponível, senão usar rotationUsers
  const userQueue = config.cascadeUserOrder && Array.isArray(config.cascadeUserOrder) && config.cascadeUserOrder.length > 0
    ? config.cascadeUserOrder
    : config.rotationUsers;
  
  logger.info('Fila de usuários para distribuição: ' + JSON.stringify(userQueue));
  
  // Obter a lista de consultores ativos que estão na fila
  const activeConsultants = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.id, userQueue)
      )
    );
  
  logger.info('Consultores ativos encontrados na fila: ' + JSON.stringify(activeConsultants.map(c => c.id)));
  
  if (activeConsultants.length === 0) {
    logger.warn('Nenhum consultor ativo encontrado na fila de rotação');
    return undefined;
  }
  
  // Filtrar apenas consultores que estão ativos
  const orderedActiveConsultants = userQueue.filter(userId => 
    activeConsultants.some(consultant => consultant.id === userId)
  );
  
  if (orderedActiveConsultants.length === 0) {
    logger.warn('Nenhum consultor ativo na ordem configurada');
    return undefined;
  }
  
  logger.info('Consultores ativos na ordem configurada: ' + JSON.stringify(orderedActiveConsultants));
  
  // Obter o primeiro usuário da fila (próximo a receber)
  const nextUserId = orderedActiveConsultants[0];
  
  logger.info(`Próximo consultor selecionado: ${nextUserId} (primeiro da fila)`);
  
  // Atualizar a configuração para mover o usuário para o fim da fila
  await rotateUserQueueAfterAssignment(nextUserId, config);
  
  return nextUserId;
}

/**
 * Move o usuário que recebeu o lead para o fim da fila
 */
async function rotateUserQueueAfterAssignment(assignedUserId: number, config: any): Promise<void> {
  try {
    // Determinar qual fila usar
    const currentQueue = config.cascadeUserOrder && Array.isArray(config.cascadeUserOrder) && config.cascadeUserOrder.length > 0
      ? [...config.cascadeUserOrder]
      : [...config.rotationUsers];
    
    // Encontrar o índice do usuário atribuído
    const userIndex = currentQueue.indexOf(assignedUserId);
    
    if (userIndex === -1) {
      logger.warn(`Usuário ${assignedUserId} não encontrado na fila atual`);
      return;
    }
    
    // Se o usuário não está na primeira posição, não precisa mover
    if (userIndex !== 0) {
      logger.info(`Usuário ${assignedUserId} não está na primeira posição, não é necessário rotacionar`);
      return;
    }
    
    // Remover o usuário da posição atual e adicionar ao final
    const rotatedQueue = [...currentQueue.slice(1), assignedUserId];
    
    logger.info(`Rotacionando fila: ${JSON.stringify(currentQueue)} -> ${JSON.stringify(rotatedQueue)}`);
    
    // Atualizar a configuração no banco de dados
    const { getAutomationConfig, updateAutomationConfig } = await import('./automation-config.service');
    const currentConfig = await getAutomationConfig();
    
    if (currentConfig) {
      await updateAutomationConfig(currentConfig.id, {
        cascadeUserOrder: rotatedQueue,
        rotationUsers: rotatedQueue // Manter sincronizado
      });
      
      logger.info('Configuração de fila atualizada com sucesso');
    }
    
  } catch (error) {
    logger.error('Erro ao rotacionar fila de usuários:', error);
  }
}

/**
 * Encontra um lead pelo e-mail
 * Implementa uma correspondência exata e case-insensitive
 */
async function findLeadByEmail(email: string): Promise<Lead | null> {
  // Se o email for vazio ou nulo, retornar null
  if (!email || email.trim() === '') {
    return null;
  }
  
  // Normalizar o email (trim e lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  // Buscar todos os leads para comparação exata mas case-insensitive
  const allLeads = await db
    .select()
    .from(leads)
    .where(sql`LOWER(email) = ${normalizedEmail}`)
    .orderBy(leads.createdAt, 'desc')
    .limit(1);
  
  return allLeads.length > 0 ? allLeads[0] : null;
}

/**
 * Encontra um lead pelo telefone com lógica aprimorada:
 * 1. Compara apenas os dígitos numéricos
 * 2. Lida com presença ou ausência do nono dígito (formato brasileiro)
 */
async function findLeadByPhone(phone: string): Promise<Lead | null> {
  // Se o telefone for vazio ou nulo, retornar null
  if (!phone || phone === 'Não informado') {
    return null;
  }
  
  // Obter apenas os dígitos do telefone fornecido
  const cleanedPhone = phone.replace(/\D/g, '');
  
  // Se não houver dígitos, retornar null
  if (!cleanedPhone) {
    return null;
  }
  
  // Remover o código do país (55) se presente
  let normalizedPhone = cleanedPhone;
  if (normalizedPhone.startsWith('55')) {
    normalizedPhone = normalizedPhone.substring(2);
  }
  
  // Extrair DDD e número sem o nono dígito para comparação
  let ddd = '';
  let numeroSemNono = '';
  
  if (normalizedPhone.length >= 10) { // tem DDD + número com 8 ou 9 dígitos
    ddd = normalizedPhone.substring(0, 2);
    
    // Se tiver 11 dígitos (com nono dígito), remove o nono para comparação adicional
    if (normalizedPhone.length === 11) {
      numeroSemNono = normalizedPhone.substring(3); // Pula DDD e nono dígito
    } else {
      numeroSemNono = normalizedPhone.substring(2); // Apenas pula o DDD
    }
  }
  
  // Buscar todos os leads para comparação manual dos telefones
  const allLeads = await db
    .select()
    .from(leads)
    .orderBy(leads.createdAt, 'desc');
  
  // Encontrar um lead que tenha o mesmo número (com comparação flexível)
  for (const lead of allLeads) {
    if (lead.phone) {
      // Limpar o telefone do lead
      let leadPhone = lead.phone.replace(/\D/g, '');
      
      // Remover código do país se presente
      if (leadPhone.startsWith('55')) {
        leadPhone = leadPhone.substring(2);
      }
      
      // Verificação direta - números exatamente iguais
      if (leadPhone === normalizedPhone) {
        return lead;
      }
      
      // Se temos DDD e número sem nono dígito para comparação
      if (ddd && numeroSemNono && numeroSemNono.length >= 8) {
        // Extrair DDD e número do lead para comparação
        let leadDDD = '';
        let leadNumero = '';
        
        if (leadPhone.length >= 10) {
          leadDDD = leadPhone.substring(0, 2);
          
          // Verificar com e sem o nono dígito
          if (leadPhone.length === 11) { // tem nono dígito
            leadNumero = leadPhone.substring(3); // Pula DDD e nono
          } else if (leadPhone.length === 10) { // sem nono dígito
            leadNumero = leadPhone.substring(2); // Apenas pula DDD
          }
          
          // Comparar DDD e número sem considerar o nono dígito
          if (leadDDD === ddd && leadNumero === numeroSemNono) {
            return lead;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Encontra um lead pelo nome completo com correspondência mais precisa
 * Compara nome e sobrenome exatos, evitando correspondências apenas pelo sobrenome
 */
async function findLeadByName(name: string): Promise<Lead | null> {
  // Se o nome for vazio, retornar null
  if (!name || name.trim() === '') {
    return null;
  }
  
  // Normalizar o nome (trim e dividir em partes)
  const normalizedName = name.trim();
  const nameParts = normalizedName.split(' ').filter(part => part.length > 0);
  
  // Se não tiver pelo menos duas partes (nome e sobrenome), fazer busca exata
  if (nameParts.length < 2) {
    const results = await db
      .select()
      .from(leads)
      .where(eq(leads.fullName, normalizedName))
      .orderBy(leads.createdAt, 'desc')
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }
  
  // Extrair primeiro nome e último sobrenome para comparação mais precisa
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  // Buscar leads para comparação manual mais precisa
  const allLeads = await db
    .select()
    .from(leads)
    .orderBy(leads.createdAt, 'desc');
  
  // Procurar por correspondência exata no nome completo
  for (const lead of allLeads) {
    if (lead.fullName === normalizedName) {
      return lead;
    }
  }
  
  // Se não encontrou correspondência exata, verificar primeiro nome E último sobrenome
  for (const lead of allLeads) {
    if (lead.fullName) {
      const leadNameParts = lead.fullName.trim().split(' ').filter(part => part.length > 0);
      
      if (leadNameParts.length >= 2) {
        const leadFirstName = leadNameParts[0];
        const leadLastName = leadNameParts[leadNameParts.length - 1];
        
        // Apenas considerar um match se TANTO o primeiro nome QUANTO o último sobrenome forem iguais
        if (leadFirstName.toLowerCase() === firstName.toLowerCase() && 
            leadLastName.toLowerCase() === lastName.toLowerCase()) {
          return lead;
        }
      }
    }
  }
  
  return null;
}

/**
 * Obtém um usuário pelo ID
 */
async function getUserById(id: number): Promise<User | null> {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  return results.length > 0 ? results[0] : null;
}

/**
 * Cria um novo lead
 */
async function createNewLead(leadData: InsertLead | Lead, assignedTo?: number): Promise<Lead> {
  try {
    logger.debug("DIAGNÓSTICO CREATE: Criando novo lead com dados: " + JSON.stringify(leadData));
    logger.debug("DIAGNÓSTICO CREATE: Atribuindo ao consultor ID: " + assignedTo);
    
    // Preparar os dados para inserção
    const insertData: any = { ...leadData };
    
    // Se houver um consultor atribuído, adicionar
    if (assignedTo) {
      insertData.assignedTo = assignedTo;
      logger.debug("DIAGNÓSTICO CREATE: Consultor atribuído: " + assignedTo);
    }
    
    // Definir a data de criação e atualização
    const now = new Date();
    insertData.createdAt = now;
    insertData.updatedAt = now;
    
    // Se for um objeto Lead, remover o ID para fazer a inserção
    if ('id' in insertData) {
      logger.debug("DIAGNÓSTICO CREATE: Removendo ID existente para inserção: " + insertData.id);
      delete insertData.id;
    }
    
    // Garantir que temos pelo menos os campos obrigatórios
    if (!insertData.fullName) {
      logger.warn("AVISO: fullName não definido, usando valor padrão");
      insertData.fullName = "Lead sem nome";
    }
    
    if (!insertData.phone) {
      logger.warn("AVISO: phone não definido, usando valor padrão");
      insertData.phone = "Não informado";
    }
    
    if (!insertData.status) {
      logger.debug("DIAGNÓSTICO CREATE: Status não definido, usando SEM_ATENDIMENTO");
      insertData.status = LeadStatusEnum.SEM_ATENDIMENTO;
    }
    
    logger.debug("DIAGNÓSTICO CREATE: Dados finais para inserção: " + JSON.stringify(insertData));
    
    // Inserir o lead no banco de dados
    const result = await db
      .insert(leads)
      .values(insertData)
      .returning();
    
    logger.debug("DIAGNÓSTICO CREATE: Resultado completo da inserção: " + JSON.stringify(result));
    
    if (!result || result.length === 0) {
      logger.error("ERRO CRÍTICO: Inserção retornou array vazio");
      throw new Error("A inserção do lead falhou: nenhum resultado retornado");
    }
    
    const newLead = result[0];
    
    if (!newLead) {
      logger.error("ERRO CRÍTICO: Primeiro elemento do resultado é null/undefined");
      throw new Error("A inserção do lead falhou: resultado inválido");
    }
    
    if (newLead.id === undefined || newLead.id === null) {
      logger.error("ERRO CRÍTICO: Lead criado sem ID válido: " + JSON.stringify(newLead));
      throw new Error("A inserção do lead falhou: ID não gerado");
    }
    
    logger.debug(`DIAGNÓSTICO CREATE: Lead criado com sucesso - ID: ${newLead.id}, Nome: ${newLead.fullName}`);
    return newLead;
  } catch (error) {
    logger.error("ERRO CRÍTICO AO CRIAR LEAD: " + error);
    throw error;
  }
}

/**
 * Atualiza a atribuição de um lead existente
 */
async function updateLeadAssignment(leadId: number, assignedTo: number): Promise<Lead | null> {
  const [updatedLead] = await db
    .update(leads)
    .set({
      assignedTo,
      updatedAt: new Date()
    })
    .where(eq(leads.id, leadId))
    .returning();
  
  return updatedLead || null;
}

/**
 * Atualiza um lead recorrente mantendo o mesmo consultor
 */
async function updateRecurringLead(leadId: number, newData: InsertLead | Lead): Promise<Lead | null> {
  // Filtrar apenas os campos que devem ser atualizados
  const updateData: any = {};
  
  // Atualizar informações básicas se fornecidas
  if ('fullName' in newData && newData.fullName) updateData.fullName = newData.fullName;
  if ('email' in newData && newData.email) updateData.email = newData.email;
  if ('phone' in newData && newData.phone) updateData.phone = newData.phone;
  if ('source' in newData && newData.source) updateData.source = newData.source;
  if ('sourceDetails' in newData && newData.sourceDetails) {
    updateData.sourceDetails = newData.sourceDetails;
  }
  if ('interesse' in newData && newData.interesse) updateData.interesse = newData.interesse;
  if ('budget' in newData && newData.budget) updateData.budget = newData.budget;
  
  // Marcar como lead recorrente
  updateData.isRecurring = true;
  
  // Atualizar data
  updateData.updatedAt = new Date();
  updateData.lastActivityDate = new Date();
  
  // Executar a atualização
  const [updatedLead] = await db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, leadId))
    .returning();
  
  return updatedLead || null;
}

/**
 * Atualiza um lead recorrente com um novo consultor
 */
async function updateRecurringLeadWithNewConsultant(
  leadId: number, 
  newData: InsertLead | Lead,
  assignedTo: number
): Promise<Lead | null> {
  // Obter dados de atualização básicos
  const updateData: any = await updateRecurringLead(leadId, newData);
  
  // Adicionar o novo consultor
  updateData.assignedTo = assignedTo;
  
  // Executar a atualização
  const [updatedLead] = await db
    .update(leads)
    .set({
      assignedTo,
      updatedAt: new Date()
    })
    .where(eq(leads.id, leadId))
    .returning();
  
  return updatedLead || null;
}