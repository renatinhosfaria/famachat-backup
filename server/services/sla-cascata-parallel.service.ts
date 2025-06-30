import { db } from '../database';
import { sistemaLeadsCascata, leads, clientes, users, sistemaConfigAutomacaoLeads } from '@shared/schema';
import { eq, and, lt, asc, or, ne, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Serviço de SLA em Cascata Paralelo
 * Implementa a nova regra onde múltiplos usuários podem atender o mesmo cliente simultaneamente
 */
export class SLACascataParallelService {
  private static instance: SLACascataParallelService;

  public static getInstance(): SLACascataParallelService {
    if (!SLACascataParallelService.instance) {
      SLACascataParallelService.instance = new SLACascataParallelService();
    }
    return SLACascataParallelService.instance;
  }

  /**
   * Busca usuários ativos EXCLUSIVAMENTE da configuração cascade_user_order
   */
  private async buscarUsuariosAtivos(): Promise<any[]> {
    try {
      // Buscar configuração ativa para obter ordem dos usuários
      const config = await db
        .select()
        .from(sistemaConfigAutomacaoLeads)
        .where(eq(sistemaConfigAutomacaoLeads.active, true))
        .limit(1);

      if (config.length === 0 || !config[0].cascadeUserOrder) {
        logger.warn(`[SLA Cascata Paralelo] Nenhuma configuração cascade_user_order encontrada`);
        return [];
      }

      const ordemUsuarios = config[0].cascadeUserOrder as number[];
      
      if (ordemUsuarios.length === 0) {
        logger.warn(`[SLA Cascata Paralelo] Lista cascade_user_order está vazia`);
        return [];
      }

      // Buscar APENAS os usuários que estão na configuração cascade_user_order
      const usuariosDaCascata = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          department: users.department,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            // Filtrar apenas usuários que estão na lista cascade_user_order
            inArray(users.id, ordemUsuarios)
          )
        );

      // Ordenar conforme a sequência definida em cascade_user_order
      return usuariosDaCascata.sort((a: any, b: any) => {
        const posA = ordemUsuarios.indexOf(a.id);
        const posB = ordemUsuarios.indexOf(b.id);
        return posA - posB;
      });

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar usuários da cascata: ${error}`);
      return [];
    }
  }

  /**
   * Busca o próximo usuário para round-robin EXCLUSIVAMENTE da cascade_user_order
   */
  private async buscarProximoUsuarioRoundRobin(): Promise<any | null> {
    try {
      // Buscar configuração ativa
      const config = await this.buscarConfiguracaoSLA();
      
      logger.info(`[SLA Round-Robin Debug] Configuração encontrada: ${JSON.stringify(config)}`);
      
      if (!config || !config.cascadeUserOrder) {
        logger.warn(`[SLA Round-Robin Debug] Não há cascade_user_order configurado`);
        return null;
      }

      // Buscar usuários EXCLUSIVAMENTE da configuração cascade_user_order
      const ordemUsuarios = config.cascadeUserOrder as number[];
      
      logger.info(`[SLA Round-Robin Debug] Ordem dos usuários (cascade_user_order): ${JSON.stringify(ordemUsuarios)}`);
      
      if (ordemUsuarios.length === 0) {
        logger.warn(`[SLA Round-Robin Debug] Lista cascade_user_order está vazia`);
        return null;
      }

      // Buscar APENAS os usuários que estão na configuração e estão ativos
      const usuariosDaCascata = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          department: users.department,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            inArray(users.id, ordemUsuarios)
          )
        );

      // Ordenar conforme a sequência definida em cascade_user_order
      const usuariosRoundRobin = usuariosDaCascata.sort((a: any, b: any) => {
        const posA = ordemUsuarios.indexOf(a.id);
        const posB = ordemUsuarios.indexOf(b.id);
        return posA - posB;
      });

      if (usuariosRoundRobin.length === 0) {
        logger.warn(`[SLA Round-Robin Debug] Nenhum usuário ativo encontrado na cascade_user_order`);
        return null;
      }

      // Buscar último usuário que recebeu um lead (mais recente)
      const ultimoAtendimento = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(eq(sistemaLeadsCascata.sequencia, 1)) // Apenas primeiros atendimentos
        .orderBy(desc(sistemaLeadsCascata.createdAt))
        .limit(1);

      logger.info(`[SLA Round-Robin Debug] Último atendimento: ${ultimoAtendimento.length > 0 ? JSON.stringify(ultimoAtendimento[0]) : 'nenhum'}`);

      if (ultimoAtendimento.length === 0) {
        // Primeiro lead, usar primeiro usuário da lista cascade_user_order
        logger.info(`[SLA Round-Robin Debug] Primeiro lead, usando primeiro usuário da cascade_user_order: ${usuariosRoundRobin[0].id}`);
        return usuariosRoundRobin[0];
      }

      // Encontrar próximo usuário na sequência
      const ultimoUserId = ultimoAtendimento[0].userId;
      const indiceAtual = usuariosRoundRobin.findIndex((u: any) => u.id === ultimoUserId);
      
      logger.info(`[SLA Round-Robin Debug] Último usuário: ${ultimoUserId}, índice: ${indiceAtual}`);
      
      if (indiceAtual === -1) {
        // Usuário não encontrado na cascade_user_order, usar primeiro da lista
        logger.info(`[SLA Round-Robin Debug] Usuário não encontrado na cascade_user_order, usando primeiro: ${usuariosRoundRobin[0].id}`);
        return usuariosRoundRobin[0];
      }

      // Próximo usuário (circular)
      const proximoIndice = (indiceAtual + 1) % usuariosRoundRobin.length;
      const proximoUsuario = usuariosRoundRobin[proximoIndice];
      
      logger.info(`[SLA Round-Robin Debug] Próximo índice: ${proximoIndice}, próximo usuário: ${proximoUsuario.id}`);
      
      return proximoUsuario;

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar próximo usuário round-robin: ${error}`);
      return null;
    }
  }

  /**
   * Inicia o processo de SLA em cascata paralelo para um lead
   */
  async iniciarSLACascataParalelo(leadId: number, clienteId: number): Promise<void> {
    try {
      logger.info(`[SLA Cascata Paralelo] Iniciando para lead ${leadId}, cliente ${clienteId}`);

      // Verificar se já existe cascata ativa para este cliente
      const cascataExistente = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(
          and(
            eq(sistemaLeadsCascata.clienteId, clienteId),
            eq(sistemaLeadsCascata.status, 'Ativo')
          )
        );

      if (cascataExistente.length > 0) {
        logger.info(`[SLA Cascata Paralelo] Cascata já existe para cliente ${clienteId}`);
        return;
      }

      // Buscar próximo usuário usando round-robin
      const proximoUsuario = await this.buscarProximoUsuarioRoundRobin();

      if (!proximoUsuario) {
        logger.warn('[SLA Cascata Paralelo] Nenhum usuário disponível encontrado');
        return;
      }

      // Buscar configuração de SLA
      const config = await this.buscarConfiguracaoSLA();
      const slaHoras = config?.cascadeSlaHours || 24;

      // Criar primeiro atendimento na cascata (sequência 1)
      const expiraEm = new Date(Date.now() + slaHoras * 60 * 60 * 1000);

      await db.insert(sistemaLeadsCascata).values({
        clienteId,
        leadId,
        userId: proximoUsuario.id,
        sequencia: 1,
        status: 'Ativo',
        slaHoras,
        expiraEm,
      });

      // Atualizar a coluna assigned_to na tabela sistema_leads
      if (leadId) {
        await db
          .update(leads)
          .set({ assignedTo: proximoUsuario.id })
          .where(eq(leads.id, leadId));
        
        logger.info(`[SLA Cascata Paralelo] Lead ${leadId} atribuído ao usuário ${proximoUsuario.username} (round-robin)`);
      }

      // Atualizar a coluna assigned_to na tabela clientes
      if (clienteId) {
        await db
          .update(clientes)
          .set({ assignedTo: proximoUsuario.id })
          .where(eq(clientes.id, clienteId));
        
        logger.info(`[SLA Cascata Paralelo] Cliente ${clienteId} atribuído ao usuário ${proximoUsuario.username} (round-robin)`);
      }

      logger.info(`[SLA Cascata Paralelo] Criado primeiro atendimento para usuário ${proximoUsuario.username} (sequência 1) - Método: round-robin`);

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao iniciar: ${error}`);
      throw error;
    }
  }

  /**
   * Processa SLAs expirados e duplica para próximos usuários
   */
  async processarSLAsExpirados(): Promise<void> {
    try {
      logger.info('[SLA Cascata Paralelo] Processando SLAs expirados');

      // Buscar atendimentos ativos que expiraram
      const agora = new Date();
      const atendimentosExpirados = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(
          and(
            eq(sistemaLeadsCascata.status, 'Ativo'),
            lt(sistemaLeadsCascata.expiraEm, agora)
          )
        );

      logger.info(`[SLA Cascata Paralelo] Encontrados ${atendimentosExpirados.length} atendimentos expirados`);

      for (const atendimento of atendimentosExpirados) {
        await this.processarAtendimentoExpirado(atendimento);
      }

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao processar expirados: ${error}`);
    }
  }

  /**
   * Processa um atendimento específico que expirou (modelo paralelo)
   */
  private async processarAtendimentoExpirado(atendimento: any): Promise<void> {
    try {
      logger.info(`[SLA Cascata Paralelo] Processando atendimento expirado: ID ${atendimento.id}, Usuário ${atendimento.userId}, Sequência ${atendimento.sequencia}`);

      // Marcar atendimento atual como expirado
      await db
        .update(sistemaLeadsCascata)
        .set({
          status: 'Expirado',
          finalizadoEm: new Date(),
          motivo: 'SLA_Expirado'
        })
        .where(eq(sistemaLeadsCascata.id, atendimento.id));

      // Buscar próximo usuário na sequência
      const proximoUsuario = await this.buscarProximoUsuario(atendimento.userId);

      if (proximoUsuario) {
        // Buscar configuração de SLA
        const config = await this.buscarConfiguracaoSLA();
        const slaHoras = config?.cascadeSlaHours || 24;
        
        const novaExpiracao = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
        const proximaSequencia = atendimento.sequencia + 1;

        // Criar novo atendimento para o próximo usuário (MODELO PARALELO: mantém todos os anteriores ativos)
        await db.insert(sistemaLeadsCascata).values({
          clienteId: atendimento.clienteId,
          leadId: atendimento.leadId,
          userId: proximoUsuario.id,
          sequencia: proximaSequencia,
          status: 'Ativo',
          slaHoras,
          expiraEm: novaExpiracao,
        });

        // Atualizar assigned_to nas tabelas principais para o novo usuário
        if (atendimento.leadId) {
          await db
            .update(leads)
            .set({ assignedTo: proximoUsuario.id })
            .where(eq(leads.id, atendimento.leadId));
        }

        if (atendimento.clienteId) {
          await db
            .update(clientes)
            .set({ assignedTo: proximoUsuario.id })
            .where(eq(clientes.id, atendimento.clienteId));
        }

        logger.info(`[SLA Cascata Paralelo] Criado novo atendimento paralelo: usuário ${proximoUsuario.username}, sequência ${proximaSequencia}`);
        logger.info(`[SLA Cascata Paralelo] Lead ${atendimento.leadId} e Cliente ${atendimento.clienteId} reatribuídos para ${proximoUsuario.username}`);

        // Enviar notificação para o novo usuário
        await this.notificarNovoAtendimento(proximoUsuario.id, atendimento.clienteId, proximaSequencia, atendimento.leadId);

      } else {
        logger.warn(`[SLA Cascata Paralelo] Não há próximo usuário disponível para cliente ${atendimento.clienteId}`);
      }

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao processar atendimento ${atendimento.id}: ${error}`);
    }
  }

  /**
   * Busca o próximo usuário na sequência EXCLUSIVAMENTE da cascade_user_order
   */
  private async buscarProximoUsuario(usuarioAtualId: number): Promise<any | null> {
    try {
      // Buscar usuários EXCLUSIVAMENTE da configuração cascade_user_order
      const usuariosAtivos = await this.buscarUsuariosAtivos();
      
      if (usuariosAtivos.length === 0) {
        logger.warn(`[SLA Cascata Paralelo] Nenhum usuário encontrado na cascade_user_order`);
        return null;
      }

      const indiceAtual = usuariosAtivos.findIndex(u => u.id === usuarioAtualId);
      
      // Se não encontrou o usuário atual ou é o último, volta para o primeiro
      if (indiceAtual === -1 || indiceAtual === usuariosAtivos.length - 1) {
        return usuariosAtivos[0];
      }

      return usuariosAtivos[indiceAtual + 1];

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar próximo usuário: ${error}`);
      return null;
    }
  }

  /**
   * Finaliza TODAS as duplicatas de um cliente quando alguém faz o agendamento
   */
  async finalizarTodasDuplicatas(clienteId: number, userId: number, motivo: string = 'Agendamento'): Promise<void> {
    try {
      logger.info(`[SLA Cascata Paralelo] Finalizando todas as duplicatas para cliente ${clienteId}, usuário que agendou: ${userId}`);

      // Buscar todos os atendimentos ativos para este cliente
      const atendimentosAtivos = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(
          and(
            eq(sistemaLeadsCascata.clienteId, clienteId),
            eq(sistemaLeadsCascata.status, 'Ativo')
          )
        );

      if (atendimentosAtivos.length === 0) {
        logger.info(`[SLA Cascata Paralelo] Nenhum atendimento ativo encontrado para cliente ${clienteId}`);
        return;
      }

      // Finalizar todos os atendimentos ativos
      const agora = new Date();
      for (const atendimento of atendimentosAtivos) {
        const statusFinal = atendimento.userId === userId ? 'Finalizado_Sucesso' : 'Finalizado_Duplicata';
        const motivoFinal = atendimento.userId === userId ? motivo : `Finalizado_por_usuario_${userId}`;

        await db
          .update(sistemaLeadsCascata)
          .set({
            status: statusFinal,
            finalizadoEm: agora,
            motivo: motivoFinal
          })
          .where(eq(sistemaLeadsCascata.id, atendimento.id));

        logger.info(`[SLA Cascata Paralelo] Atendimento ${atendimento.id} finalizado com status: ${statusFinal}`);
      }

      logger.info(`[SLA Cascata Paralelo] Finalizadas ${atendimentosAtivos.length} duplicatas para cliente ${clienteId}`);

      // Notificar sobre a finalização da cascata
      if (atendimentosAtivos.length > 1) {
        const outrosUsuarios = atendimentosAtivos.map((a: any) => a.userId).filter((id: any) => id !== userId);
        await this.notificarFinalizacaoCascata(clienteId, userId, outrosUsuarios);
      }

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao finalizar duplicatas: ${error}`);
    }
  }

  /**
   * Busca atendimentos ativos para um usuário
   */
  async buscarAtendimentosAtivos(userId: number): Promise<any[]> {
    try {
      const atendimentos = await db
        .select({
          id: sistemaLeadsCascata.id,
          clienteId: sistemaLeadsCascata.clienteId,
          leadId: sistemaLeadsCascata.leadId,
          sequencia: sistemaLeadsCascata.sequencia,
          expiraEm: sistemaLeadsCascata.expiraEm,
          iniciadoEm: sistemaLeadsCascata.iniciadoEm,
          slaHoras: sistemaLeadsCascata.slaHoras,
          clienteNome: clientes.fullName,
          clienteEmail: clientes.email,
          clientePhone: clientes.phone,
          clienteStatus: clientes.status,
          leadStatus: leads.status,
        })
        .from(sistemaLeadsCascata)
        .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id))
        .leftJoin(leads, eq(sistemaLeadsCascata.leadId, leads.id))
        .where(
          and(
            eq(sistemaLeadsCascata.userId, userId),
            eq(sistemaLeadsCascata.status, 'Ativo')
          )
        )
        .orderBy(asc(sistemaLeadsCascata.expiraEm));

      return atendimentos;

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar atendimentos ativos: ${error}`);
      return [];
    }
  }

  /**
   * Busca dados de cascata para exibição no dashboard
   */
  async buscarDadosCascata(clienteId?: number): Promise<any[]> {
    try {
      let query = db
        .select({
          id: sistemaLeadsCascata.id,
          clienteId: sistemaLeadsCascata.clienteId,
          leadId: sistemaLeadsCascata.leadId,
          userId: sistemaLeadsCascata.userId,
          sequencia: sistemaLeadsCascata.sequencia,
          status: sistemaLeadsCascata.status,
          slaHoras: sistemaLeadsCascata.slaHoras,
          iniciadoEm: sistemaLeadsCascata.iniciadoEm,
          expiraEm: sistemaLeadsCascata.expiraEm,
          finalizadoEm: sistemaLeadsCascata.finalizadoEm,
          motivo: sistemaLeadsCascata.motivo,
          userName: users.username,
          userFullName: users.fullName,
          clienteNome: clientes.fullName,
          clientePhone: clientes.phone,
        })
        .from(sistemaLeadsCascata)
        .leftJoin(users, eq(sistemaLeadsCascata.userId, users.id))
        .leftJoin(clientes, eq(sistemaLeadsCascata.clienteId, clientes.id));

      if (clienteId) {
        query = query.where(eq(sistemaLeadsCascata.clienteId, clienteId));
      }

      const dados = await query.orderBy(
        asc(sistemaLeadsCascata.clienteId),
        asc(sistemaLeadsCascata.sequencia)
      );

      return dados;

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar dados de cascata: ${error}`);
      return [];
    }
  }

  /**
   * Busca configuração de SLA
   */
  private async buscarConfiguracaoSLA(): Promise<any | null> {
    try {
      const config = await db
        .select()
        .from(sistemaConfigAutomacaoLeads)
        .where(eq(sistemaConfigAutomacaoLeads.active, true))
        .limit(1);

      return config.length > 0 ? config[0] : null;
    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao buscar configuração: ${error}`);
      return null;
    }
  }

  /**
   * Notifica usuário sobre novo atendimento
   */
  private async notificarNovoAtendimento(userId: number, clienteId: number, sequencia: number, leadId?: number): Promise<void> {
    try {
      // Importar o serviço de notificações
      const { notificationService } = await import('./notification.service');
      
      // Enviar notificação através do serviço
      await notificationService.notificarNovoAtendimento(userId, clienteId, sequencia, leadId);
      
    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao notificar usuário: ${error}`);
    }
  }

  /**
   * Notifica sobre finalização de cascata
   */
  private async notificarFinalizacaoCascata(clienteId: number, usuarioQueAgendou: number, outrosUsuarios: number[]): Promise<void> {
    try {
      // Importar o serviço de notificações
      const { notificationService } = await import('./notification.service');
      
      // Enviar notificações sobre finalização
      await notificationService.notificarFinalizacaoCascata(clienteId, usuarioQueAgendou, outrosUsuarios);
      
    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao notificar finalização de cascata: ${error}`);
    }
  }

  /**
   * Obter métricas de performance do sistema de cascata
   */
  async obterMetricasPerformance(dataInicio?: Date, dataFim?: Date): Promise<any> {
    try {
      const agora = new Date();
      const inicio = dataInicio || new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
      const fim = dataFim || agora;

      // Buscar todos os registros no período
      const registros = await db
        .select()
        .from(sistemaLeadsCascata)
        .where(
          and(
            eq(sistemaLeadsCascata.iniciadoEm, inicio), // Usar operadores de comparação apropriados
            eq(sistemaLeadsCascata.iniciadoEm, fim)
          )
        );

      // Calcular métricas
      const totalAtendimentos = registros.length;
      const atendimentosFinalizados = registros.filter((r: any) => r.status.startsWith('Finalizado')).length;
      const atendimentosExpirados = registros.filter((r: any) => r.status === 'Expirado').length;
      const atendimentosAtivos = registros.filter((r: any) => r.status === 'Ativo').length;

      const taxaConversao = totalAtendimentos > 0 ? (atendimentosFinalizados / totalAtendimentos) * 100 : 0;
      const taxaExpiracao = totalAtendimentos > 0 ? (atendimentosExpirados / totalAtendimentos) * 100 : 0;

      // Métricas por usuário
      const metricasPorUsuario = registros.reduce((acc: any, reg: any) => {
        if (!acc[reg.userId]) {
          acc[reg.userId] = {
            total: 0,
            finalizados: 0,
            expirados: 0,
            ativos: 0
          };
        }
        acc[reg.userId].total++;
        if (reg.status.startsWith('Finalizado')) acc[reg.userId].finalizados++;
        if (reg.status === 'Expirado') acc[reg.userId].expirados++;
        if (reg.status === 'Ativo') acc[reg.userId].ativos++;
        return acc;
      }, {} as any);

      return {
        periodo: { inicio, fim },
        resumo: {
          totalAtendimentos,
          atendimentosFinalizados,
          atendimentosExpirados,
          atendimentosAtivos,
          taxaConversao: Math.round(taxaConversao * 100) / 100,
          taxaExpiracao: Math.round(taxaExpiracao * 100) / 100,
        },
        porUsuario: metricasPorUsuario
      };

    } catch (error) {
      logger.error(`[SLA Cascata Paralelo] Erro ao obter métricas: ${error}`);
      return null;
    }
  }

  /**
   * Inicia o processamento automático de SLAs
   */
  iniciarProcessamentoAutomatico(): void {
    logger.info('[SLA Cascata Paralelo] Iniciando processamento automático');
    
    // Executar imediatamente
    this.processarSLAsExpirados();
    
    // Configurar execução a cada minuto
    setInterval(() => {
      this.processarSLAsExpirados();
    }, 60 * 1000);
  }
}

// Exportar instância singleton
export const slaCascataParallelService = SLACascataParallelService.getInstance();
